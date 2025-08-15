// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use anyhow::Result;
use crc32fast;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri::path::BaseDirectory;
use tauri_plugin_log::{Target, TargetKind};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

#[tauri::command]
fn exit(code: i32) {
  std::process::exit(code);
}

#[path = "lib/onnx_logic.rs"]
pub mod onnx_logic;

#[path = "lib/document_parser.rs"]
pub mod document_parser;

#[path = "lib/sse.rs"]
pub mod sse;

#[tauri::command]
fn greet() -> String {
  let now = SystemTime::now();
  let epoch_ms = now
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  format!("Hello world from Rust! Current epoch: {}", epoch_ms)
}

/// Tauri 命令：使用模拟数据生成嵌入向量（用于测试和回退）
#[tauri::command]
fn generate_embedding_command(texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
  // 为每个输入文本生成一个384维的模拟嵌入向量
  let embeddings = texts
    .iter()
    .map(|text| {
      // 使用文本的哈希值或其他属性来生成确定性的、但看起来随机的向量
      let hash = crc32fast::hash(text.as_bytes());
      let mut vec = vec![0.0f32; 384];
      let mut val = (hash as f32) / (u32::MAX as f32) - 0.5;
      for i in 0..384 {
        vec[i] = val;
        val = (val * 1.1 + 0.1).sin();
      }
      vec
    })
    .collect();
  Ok(embeddings)
}

pub fn run() {
  let _builder = tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      // 尝试在启动时初始化 ONNX Runtime，但不再因失败而中断应用
      let lib_name = if cfg!(target_os = "windows") {
        "onnxruntime.dll"
      } else if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
      } else {
        "libonnxruntime.so"
      };

      match app
        .path()
        .resolve(lib_name, BaseDirectory::Resource)
      {
        Ok(resource_path) => {
          println!("Attempting to load {lib_name} from: {:?}", resource_path);
          if resource_path.exists() {
            if let Err(e) = ort::init_from(resource_path.to_string_lossy().as_ref()).commit() {
              eprintln!(
                "[WARN] Failed to initialize ONNX Runtime at startup: {}. Features depending on ORT may be unavailable until re-initialized.",
                e
              );
            }
          } else {
            eprintln!(
              "[WARN] ORT dynamic library not found at {:?}. You can still use the app without embedding features.",
              resource_path
            );
          }
        }
        Err(e) => {
          eprintln!(
            "[WARN] Failed to resolve ORT resource path: {}. Skipping ORT init at startup.",
            e
          );
        }
      }

      Ok(())
    })
    // 启用 Tauri Updater 插件（仅桌面平台有效）
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_upload::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(
      tauri_plugin_log::Builder::new()
        .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
        .format(|out, message, record| {
          // 生成本地时间戳，失败时退回到 UTC
          let ts = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
          let ts_str = ts.format(&Rfc3339).unwrap_or_else(|_| "-".into());
          out.finish(format_args!(
            "[{}][{}][{}] {}",
            ts_str,
            record.level(),
            record.target(),
            message
          ))
        })
        .targets([
          // 输出到终端
          Target::new(TargetKind::Stdout),
          // 输出到webview控制台
          Target::new(TargetKind::Webview),
          // 输出到日志文件
          Target::new(TargetKind::LogDir {
            file_name: Some("logs".to_string()),
          }),
        ])
        .max_file_size(10 * 1024 * 1024) // 10MB
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
        .build(),
    )
    .manage(onnx_logic::OnnxState {
      session: Default::default(),
      attention_mask: Default::default(),
      token_type_ids: Default::default(),
    })
    .manage(sse::AppState::new())
    .invoke_handler(tauri::generate_handler![
      greet,
      generate_embedding_command,
      exit,
      // Document parser commands
      document_parser::parse_document_text,
      document_parser::parse_document_from_binary,
      document_parser::parse_document_content,
      document_parser::get_supported_file_types,
      // ONNX commands
      onnx_logic::init_onnx_session,
      onnx_logic::tokenize_batch,
      onnx_logic::generate_embedding,
      onnx_logic::release_onnx_session,
      // —— SSE Commands ——
      sse::start_sse,
      sse::stop_sse
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
