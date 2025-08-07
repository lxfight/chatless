use anyhow::{Context, Result};
use docx_rust::DocxFile;
use pulldown_cmark::{Event, Options, Parser, Tag};
use std::fs;
use std::path::Path;

pub struct DocumentParser;

impl DocumentParser {
  /// 统一的文档解析入口点
  pub fn extract_text_from_file(file_path_str: &str) -> Result<String> {
    let path = Path::new(file_path_str);

    if !path.exists() {
      return Err(anyhow::anyhow!("文件未找到: {}", file_path_str));
    }

    match path.extension().and_then(std::ffi::OsStr::to_str) {
      Some("pdf") => Self::extract_pdf_text(file_path_str),
      Some("docx") => Self::extract_docx_text(file_path_str),
      Some("md") | Some("markdown") => Self::extract_markdown_text(file_path_str),
      Some("txt") => Self::extract_txt_text(file_path_str),
      Some(ext) => Err(anyhow::anyhow!("不支持的文件扩展名: {}", ext)),
      None => Err(anyhow::anyhow!(
        "无法确定文件类型，缺少扩展名: {}",
        file_path_str
      )),
    }
  }

  /// PDF 文本提取
  fn extract_pdf_text(file_path_str: &str) -> Result<String> {
    let file_path = Path::new(file_path_str);
    pdf_extract::extract_text(file_path)
      .with_context(|| format!("从PDF文件 '{}' 提取文本失败", file_path_str))
  }

  /// DOCX 文本提取
  fn extract_docx_text(file_path_str: &str) -> Result<String> {
    let file_path = Path::new(file_path_str);

    let docx_file =
      DocxFile::from_file(file_path).map_err(|e| anyhow::anyhow!("无法打开 DOCX 文件: {:?}", e))?;

    let debug_content = {
      let docx = docx_file
        .parse()
        .map_err(|e| anyhow::anyhow!("解析 DOCX 文件失败: {:?}", e))?;
      format!("{:?}", docx.document.body.content)
    };

    let extracted_text = Self::extract_text_from_debug_string(&debug_content);
    let cleaned_text = extracted_text
      .lines()
      .map(|line| line.trim())
      .filter(|line| !line.is_empty())
      .collect::<Vec<&str>>()
      .join("\n");

    if cleaned_text.is_empty() && file_path.metadata()?.len() > 0 {
      return Ok("[文档可能包含复杂格式、图片或其他无法提取的内容]".to_string());
    }

    Ok(cleaned_text)
  }

  /// Markdown 文本提取
  fn extract_markdown_text(file_path_str: &str) -> Result<String> {
    let file_path = Path::new(file_path_str);
    let markdown_input = fs::read_to_string(file_path)
      .with_context(|| format!("无法读取 Markdown 文件: {}", file_path_str))?;

    let mut plain_text = String::new();
    let parser = Parser::new_ext(&markdown_input, Options::empty());

    for event in parser {
      match event {
        Event::Text(text) => {
          plain_text.push_str(&text);
        }
        Event::End(Tag::Paragraph) => {
          plain_text.push('\n');
        }
        Event::End(Tag::Heading { .. }) => {
          plain_text.push('\n');
        }
        Event::End(Tag::CodeBlock(_)) => {
          plain_text.push('\n');
        }
        Event::SoftBreak => {
          plain_text.push(' ');
        }
        Event::HardBreak => {
          plain_text.push('\n');
        }
        _ => {}
      }
    }

    Ok(plain_text.trim().to_string())
  }

  /// TXT 文本提取
  fn extract_txt_text(file_path_str: &str) -> Result<String> {
    let file_path = Path::new(file_path_str);
    fs::read_to_string(file_path).with_context(|| format!("无法读取 TXT 文件: {}", file_path_str))
  }

  /// 从调试字符串中提取文本内容
  fn extract_text_from_debug_string(debug_str: &str) -> String {
    let mut text = String::new();
    let pattern = "text: \"";
    let mut start_pos = 0;

    while let Some(found_pos) = debug_str[start_pos..].find(pattern) {
      let absolute_pos = start_pos + found_pos + pattern.len();

      if let Some(end_quote_pos) = debug_str[absolute_pos..].find('"') {
        let text_content = &debug_str[absolute_pos..absolute_pos + end_quote_pos];

        if !text_content.trim().is_empty() {
          text.push_str(text_content);
          text.push(' ');
        }

        start_pos = absolute_pos + end_quote_pos + 1;
      } else {
        break;
      }
    }

    text.trim().to_string()
  }

  /// 解析Markdown内容（从字符串）
  pub fn parse_markdown_content(markdown_input: &str) -> Result<String> {
    let mut plain_text = String::new();
    let parser = Parser::new_ext(markdown_input, Options::empty());

    for event in parser {
      match event {
        Event::Text(text) => {
          plain_text.push_str(&text);
        }
        Event::End(Tag::Paragraph) => {
          plain_text.push('\n');
        }
        Event::End(Tag::Heading { .. }) => {
          plain_text.push('\n');
        }
        Event::End(Tag::CodeBlock(_)) => {
          plain_text.push('\n');
        }
        Event::SoftBreak => {
          plain_text.push(' ');
        }
        Event::HardBreak => {
          plain_text.push('\n');
        }
        _ => {}
      }
    }

    Ok(plain_text.trim().to_string())
  }
}

/// Tauri 命令：解析文档文本（从文件路径）
#[tauri::command]
pub async fn parse_document_text(file_path: String) -> Result<String, String> {
  DocumentParser::extract_text_from_file(&file_path).map_err(|e| e.to_string())
}

/// Tauri 命令：从二进制数据解析文档（新的统一方案）
#[tauri::command]
pub async fn parse_document_from_binary(
  file_name: String,
  file_content: Vec<u8>,
) -> Result<String, String> {
  use std::time::{SystemTime, UNIX_EPOCH};

  // 生成唯一的临时文件名
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_millis();

  let temp_file_name = format!("tauri_doc_parse_{}_{}", timestamp, file_name);

  // 获取系统临时目录
  let temp_dir = std::env::temp_dir();
  let temp_file_path = temp_dir.join(&temp_file_name);

  // 确保在函数结束时删除临时文件
  struct TempFileGuard {
    path: std::path::PathBuf,
  }

  impl Drop for TempFileGuard {
    fn drop(&mut self) {
      let _ = std::fs::remove_file(&self.path);
    }
  }

  let _guard = TempFileGuard {
    path: temp_file_path.clone(),
  };

  // 将二进制数据写入临时文件
  fs::write(&temp_file_path, file_content).map_err(|e| format!("创建临时文件失败: {}", e))?;

  // 使用现有的文件解析逻辑
  let temp_path_str = temp_file_path.to_string_lossy().to_string();
  DocumentParser::extract_text_from_file(&temp_path_str).map_err(|e| e.to_string())
}

/// Tauri 命令：从文件内容解析文档（简化版，仅用于纯文本）
#[tauri::command]
pub async fn parse_document_content(
  file_name: String,
  file_content: Vec<u8>,
) -> Result<String, String> {
  // 从文件名获取扩展名
  let extension = Path::new(&file_name)
    .extension()
    .and_then(std::ffi::OsStr::to_str)
    .unwrap_or_default();

  // 根据文件类型调用不同的解析逻辑
  match extension {
    "md" | "markdown" => {
      let content_str = String::from_utf8(file_content)
        .map_err(|e| format!("无法将文件内容转换为UTF-8字符串: {}", e))?;
      DocumentParser::parse_markdown_content(&content_str).map_err(|e| e.to_string())
    }
    "txt" => {
      String::from_utf8(file_content).map_err(|e| format!("无法将文件内容转换为UTF-8字符串: {}", e))
    }
    _ => Err(format!("不支持从内容解析'{}'类型的文件", extension)),
  }
}

/// Tauri 命令：获取支持的文件类型
#[tauri::command]
pub fn get_supported_file_types() -> Vec<String> {
  vec![
    "pdf".to_string(),
    "docx".to_string(),
    "md".to_string(),
    "markdown".to_string(),
    "txt".to_string(),
  ]
}
