use crate::mcp::state::{McpState, McpService};
use crate::mcp::types::McpServerConfig;
use rmcp::{
  model::{CallToolRequestParam, Tool, ListToolsResult, ReadResourceRequestParam, GetPromptRequestParam},
  service::ServiceExt,
  transport::{
    TokioChildProcess, ConfigureCommandExt,
    sse_client::{SseClientTransport, SseClientConfig},
    streamable_http_client::{StreamableHttpClientTransport, StreamableHttpClientTransportConfig},
  },
};
// use std::sync::Arc; // no longer needed after using with_uri
use tauri::State;
use tokio::time::{timeout, Duration};
use tokio::process::Command;

// 仅在Windows平台编译时，引入 CommandExt Trait
#[cfg(windows)]
use std::os::windows::process::CommandExt;

// —— 工具：从 npx 参数中提取第一个包名（用于首次安装的预拉取） ——
fn extract_npx_package(args: &Option<Vec<String>>) -> Option<String> {
  if let Some(a) = args {
    for it in a {
      // 跳过常见的 flags（以 - 开头）
      if it.starts_with('-') { continue; }
      return Some(it.clone());
    }
  }
  None
}

async fn npx_prefetch_package(pkg: &str) -> Result<(), String> {
  // 只下载依赖，不启动 MCP；最长等待 4 分钟以适配首次安装
  let mut pre = Command::new("npx");
  
  // [关键步骤] 为Windows平台设置无窗口创建标志
  #[cfg(windows)]
  {
    pre.creation_flags(0x08000000); // CREATE_NO_WINDOW
  }
  
  pre.env("NPM_CONFIG_LOGLEVEL", "silent");
  pre.env("NO_COLOR", "1");
  pre.env("NPX_Y", "1");
  pre.args(["-y", "-p", pkg, "node", "-e", "process.exit(0)"]);
  log::info!("[MCP/npx] prefetch package: {}", pkg);
  let status = timeout(Duration::from_secs(240), pre.status())
    .await
    .map_err(|_| "npx prefetch timeout".to_string())?
    .map_err(|e| e.to_string())?;
  if !status.success() {
    return Err(format!("npx prefetch failed with code {:?}", status.code()));
  }
  Ok(())
}

fn is_path_like(arg: &str) -> bool {
  if arg.is_empty() { return false; }
  let lower = arg.to_lowercase();
  if lower.starts_with("http://") || lower.starts_with("https://") { return false; }
  // npm scope 包名，如 @scope/name，不应被当作路径
  if arg.starts_with('@') {
    // 典型包名不包含反斜杠和盘符
    if arg.contains('/') && !arg.contains('\\') && !arg.contains(':') { return false; }
  }
  if arg.starts_with('/') || arg.starts_with("./") || arg.starts_with("../") || arg.starts_with("~/") { return true; }
  // Windows 盘符，如 C:\ 或 C:/
  if arg.len() >= 3 {
    let bytes = arg.as_bytes();
    if bytes[1] == b':' && (bytes[2] == b'/' || bytes[2] == b'\\') { return true; }
  }
  // 包含路径分隔符的其它情况
  arg.contains('/') || arg.contains('\\')
}

#[tauri::command]
pub async fn mcp_connect(
  name: String,
  config: McpServerConfig,
  state: State<'_, McpState>,
) -> Result<(), String> {
  if state.0.contains_key(&name) {
    return Ok(());
  }

  match config.r#type.as_str() {
    "stdio" => {
      let cmd_name = config.command.clone().ok_or_else(|| "command required for stdio".to_string())?;
      // —— 基础安全校验：仅允许白名单命令或显式路径；另允许 Windows 包装器 cmd /c ——
      let is_path = cmd_name.contains('/') || cmd_name.contains('\\');
      if !is_path {
        const ALLOW: [&str; 3] = ["npx", "uvx", "bunx"];
        let is_wrapper_cmd = cmd_name.eq_ignore_ascii_case("cmd")
          && config.args.as_ref().map(|a| a.get(0).map(|s| s.eq_ignore_ascii_case("/c")).unwrap_or(false)).unwrap_or(false)
          && config.args.as_ref().map(|a| a.len() >= 2).unwrap_or(false);
        if !ALLOW.contains(&cmd_name.as_str()) && !is_wrapper_cmd {
          return Err(format!(
            "command '{}' is not allowed. use one of: npx, uvx, bunx, an absolute path, or Windows wrapper 'cmd /c <cmd>'",
            cmd_name
          ));
        }
      }
      // 构造命令的闭包，便于重试
      let build_cmd = || {
        let mut c = Command::new(&cmd_name);
        
        // [关键步骤] 为Windows平台设置无窗口创建标志
        #[cfg(windows)]
        {
          c.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        
        if let Some(args) = &config.args { c.args(args); }
        if let Some(envs) = &config.env { for (k,v) in envs { c.env(k, v); } }
        if cmd_name == "npx" {
          c.env("NPM_CONFIG_LOGLEVEL", "silent");
          c.env("NO_COLOR", "1");
          c.env("NPX_Y", "1");
        }
        c
      };
      // —— 参数校验，避免简单的 shell 注入字符 ——
      if let Some(args) = &config.args {
        let joined = args.join(" ");
        if joined.len() > 2048 {
          return Err("args too long".to_string());
        }
        if joined.contains('|') || joined.contains('&') || joined.contains(';') || joined.contains('>') || joined.contains('<') {
          return Err("args contains forbidden shell characters".to_string());
        }
        // 通用路径存在性校验：检测看起来像路径的参数，如果不存在则直接提示（避免特定 MCP 魔法处理）
        // 规则：从第一个非 flag 参数（一般是包名）之后的参数中筛选
        // Windows 包装器 cmd /c <cmd> <args...> 需要跳过前两个参数
        let wrapper_offset = if cmd_name.eq_ignore_ascii_case("cmd")
          && args.get(0).map(|s| s.eq_ignore_ascii_case("/c")).unwrap_or(false)
          && args.len() >= 2 { 2 } else { 0 };

        let args_slice = &args[wrapper_offset..];
        let mut first_non_flag_in_slice: Option<usize> = None;
        for (i, it) in args_slice.iter().enumerate() {
          if !it.starts_with('-') { first_non_flag_in_slice = Some(i); break; }
        }
        if let Some(mut idx) = first_non_flag_in_slice {
          // 特判：cmd /c + npx/uvx/bunx 的形式。此时 idx 指向的是执行器（npx），
          // 需要继续向后找到真正的包名（第一个非 flag），并从包名之后开始校验路径。
          if args_slice.get(idx).map(|s| s.as_str()).map(|s| s.eq_ignore_ascii_case("npx") || s.eq_ignore_ascii_case("uvx") || s.eq_ignore_ascii_case("bunx")).unwrap_or(false) {
            let mut pkg_idx_in_slice: Option<usize> = None;
            for (j, it) in args_slice.iter().enumerate().skip(idx+1) {
              if !it.starts_with('-') { pkg_idx_in_slice = Some(j); break; }
            }
            if let Some(pidx) = pkg_idx_in_slice { idx = pidx; }
          }
          let start = wrapper_offset + idx + 1; // 从包名后的参数开始
          if start < args.len() {
            let mut missing: Vec<String> = Vec::new();
            for raw in &args[start..] {
              if is_path_like(raw) {
                // 直接按原样检查（不展开 ~ 等），以避免误判和隐式替换
                if tokio::fs::metadata(raw).await.is_err() {
                  missing.push(raw.clone());
                }
              }
            }
            if !missing.is_empty() {
              let mut msg = format!("Path arguments do not exist: {}", missing.join(", "));
              let placeholder_hits: Vec<&str> = missing.iter()
                .filter_map(|s| {
                  let ls = s.to_lowercase();
                  if ls.contains("/users/username/") || ls.contains("path/to/other/allowed/dir") { Some(s.as_str()) } else { None }
                })
                .collect();
              if !placeholder_hits.is_empty() {
                msg.push_str(". It looks like placeholder paths are still present. Please replace them with real existing directories.");
              }
              return Err(msg);
            }
          }
        }
      }
      // —— 调试日志 ——
      log::debug!("[MCP/stdio] spawning: cmd='{}' args={:?} envs={}", cmd_name, &config.args, config.env.as_ref().map(|v| v.len()).unwrap_or(0));

      // 一次尝试的封装
      let try_connect = || async {
        let cmd = build_cmd();
        let service: McpService = ()
          .serve(TokioChildProcess::new(cmd.configure(|_c| {})).map_err(|e| e.to_string())?)
          .await
          .map_err(|e| e.to_string())?;
        Ok::<McpService, String>(service)
      };

      // 第一次尝试（可能在 npx 首次下载时失败/超时）
      let first = timeout(Duration::from_secs(30), try_connect())
        .await
        .map_err(|_| "Connect timeout (stdio)".to_string());

      match first {
        Ok(Ok(service)) => { state.0.insert(name, service); Ok(()) }
        Ok(Err(e)) | Err(e) => {
          if cmd_name == "npx" {
            if let Some(pkg) = extract_npx_package(&config.args) {
              log::info!("[MCP/stdio] first connect failed: {}. prefetching {}...", e, pkg);
              // 预下载失败则直接返回组合错误
              npx_prefetch_package(&pkg).await.map_err(|pe| format!("{}; prefetch: {}", e, pe))?;
              // 预下载成功后重试
              let second = timeout(Duration::from_secs(30), try_connect())
                .await
                .map_err(|_| "Connect timeout (stdio, after prefetch)".to_string())??;
              state.0.insert(name, second);
              Ok(())
            } else {
              Err(e)
            }
          } else {
            Err(e)
          }
        }
      }
    }
    "sse" => {
      let base = config.base_url.clone().ok_or_else(|| "baseUrl required for sse".to_string())?;
      log::debug!("[MCP/sse] connecting baseUrl={}", &base);
      let req = crate::http_client::get_browser_like_client()
        .map_err(|e| format!("Failed to get HTTP client: {}", e))?;
      let req = (*req).clone(); // 从Arc<Client>转换为Client
      let cfg = SseClientConfig { sse_endpoint: base.into(), ..Default::default() };
      let transport = SseClientTransport::start_with_client(req, cfg).await.map_err(|e| e.to_string())?;
      let service: McpService = ()
        .serve(transport)
        .await
        .map_err(|e| e.to_string())?;
      state.0.insert(name, service);
      Ok(())
    }
    "http" => {
      let base = config.base_url.clone().ok_or_else(|| "baseUrl required for http".to_string())?;
      log::debug!("[MCP/http] connecting baseUrl={}", &base);
      let req = crate::http_client::get_browser_like_client()
        .map_err(|e| format!("Failed to get HTTP client: {}", e))?;
      let req = (*req).clone(); // 从Arc<Client>转换为Client
      let cfg = StreamableHttpClientTransportConfig::with_uri(base);
      let transport = StreamableHttpClientTransport::with_client(req, cfg);
      let service: McpService = ()
        .serve(transport)
        .await
        .map_err(|e| e.to_string())?;
      state.0.insert(name, service);
      Ok(())
    }
    _ => Err("Unsupported transport type".to_string()),
  }
}

#[tauri::command]
pub async fn mcp_disconnect(name: String, state: State<'_, McpState>) -> Result<(), String> {
  if let Some((_, service)) = state.0.remove(&name) {
    service.cancel().await.map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(server_name: String, state: State<'_, McpState>) -> Result<Vec<Tool>, String> {
  let service = state.0.get(&server_name).ok_or_else(|| "Server not found".to_string())?;
  let ListToolsResult { tools, .. } = service.list_tools(Default::default()).await.map_err(|e| e.to_string())?;
  Ok(tools)
}

#[tauri::command]
pub async fn mcp_call_tool(
  server_name: String,
  tool_name: String,
  args: Option<serde_json::Map<String, serde_json::Value>>,
  state: State<'_, McpState>,
) -> Result<serde_json::Value, String> {
  let service = state.0.get(&server_name).ok_or_else(|| "Server not found".to_string())?;
  let param = CallToolRequestParam { name: tool_name.into(), arguments: args };
  let res = service.call_tool(param).await.map_err(|e| e.to_string())?;
  Ok(serde_json::to_value(res).map_err(|e| e.to_string())?)
}

// —— Resources ——
#[tauri::command]
pub async fn mcp_list_resources(
  server_name: String,
  state: State<'_, McpState>,
) -> Result<serde_json::Value, String> {
  let service = state.0.get(&server_name).ok_or_else(|| "Server not found".to_string())?;
  let res = service.list_resources(Default::default()).await.map_err(|e| e.to_string())?;
  serde_json::to_value(res).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_read_resource(
  server_name: String,
  uri: String,
  state: State<'_, McpState>,
) -> Result<serde_json::Value, String> {
  let service = state.0.get(&server_name).ok_or_else(|| "Server not found".to_string())?;
  let params = ReadResourceRequestParam { uri: uri.into() };
  let res = service.read_resource(params).await.map_err(|e| e.to_string())?;
  serde_json::to_value(res).map_err(|e| e.to_string())
}

// —— Prompts ——
#[tauri::command]
pub async fn mcp_list_prompts(
  server_name: String,
  state: State<'_, McpState>,
) -> Result<serde_json::Value, String> {
  let service = state.0.get(&server_name).ok_or_else(|| "Server not found".to_string())?;
  let res = service.list_prompts(Default::default()).await.map_err(|e| e.to_string())?;
  serde_json::to_value(res).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_get_prompt(
  server_name: String,
  name: String,
  args: Option<serde_json::Map<String, serde_json::Value>>,
  state: State<'_, McpState>,
) -> Result<serde_json::Value, String> {
  let service = state.0.get(&server_name).ok_or_else(|| "Server not found".to_string())?;
  let params = GetPromptRequestParam { name: name.into(), arguments: args };
  let res = service.get_prompt(params).await.map_err(|e| e.to_string())?;
  serde_json::to_value(res).map_err(|e| e.to_string())
}

