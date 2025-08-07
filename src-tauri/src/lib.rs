// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

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
  let epoch_ms = now.duration_since(UNIX_EPOCH).unwrap().as_millis();
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
    .plugin(tauri_plugin_log::Builder::new().build())
    .setup(|app| {
      // 根据当前操作系统选择正确的 ONNX Runtime 动态库文件名
      let lib_name = if cfg!(target_os = "windows") {
        "onnxruntime.dll"
      } else if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
      } else {
        // 其他平台统一按 Linux 处理
        "libonnxruntime.so"
      };

      let resource_path = app
        .path()
        .resolve(lib_name, BaseDirectory::Resource)
        .expect("failed to resolve resource");

      println!("Attempting to load {lib_name} from: {:?}", resource_path);

      // 根据官方文档，在使用 `load-dynamic` 特性时必须先初始化
      if let Err(e) = ort::init_from(resource_path.to_string_lossy().as_ref()).commit() {
        panic!(
          "Failed to initialize ONNX Runtime: {}. Please ensure {lib_name} is in the correct path.",
          e
        );
      }

      Ok(())
    })
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
        out.finish(format_args!(
          "[{} {}] {}",
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
