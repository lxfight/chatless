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
      let mut cmd = Command::new(&cmd_name);
      if let Some(args) = &config.args { cmd.args(args); }
      if let Some(envs) = &config.env { for (k,v) in envs { cmd.env(k, v); } }
      // —— 参数校验，避免简单的 shell 注入字符 ——
      if let Some(args) = &config.args {
        let joined = args.join(" ");
        if joined.len() > 2048 {
          return Err("args too long".to_string());
        }
        if joined.contains('|') || joined.contains('&') || joined.contains(';') || joined.contains('>') || joined.contains('<') {
          return Err("args contains forbidden shell characters".to_string());
        }
      }
      // 若使用 npx 启动，静默其安装日志，避免污染 MCP STDIO 握手
      // 这里直接基于传入的可执行文件名判断（tokio::process::Command 无 get_program 方法）
      if cmd_name == "npx" {
        cmd.env("NPM_CONFIG_LOGLEVEL", "silent");
        cmd.env("NO_COLOR", "1");
        cmd.env("NPX_Y", "1");
      }
      // —— 调试日志 ——
      log::debug!("[MCP/stdio] spawning: cmd='{}' args={:?} envs={}", cmd_name, &config.args, config.env.as_ref().map(|v| v.len()).unwrap_or(0));

      let fut = async {
        let service: McpService = ()
          .serve(TokioChildProcess::new(cmd.configure(|_c| {})).map_err(|e| e.to_string())?)
          .await
          .map_err(|e| e.to_string())?;
        Ok::<McpService, String>(service)
      };
      let service = timeout(Duration::from_secs(20), fut)
        .await
        .map_err(|_| "Connect timeout (stdio)".to_string())??;

      state.0.insert(name, service);
      Ok(())
    }
    "sse" => {
      let base = config.base_url.clone().ok_or_else(|| "baseUrl required for sse".to_string())?;
      log::debug!("[MCP/sse] connecting baseUrl={}", &base);
      let req = reqwest::Client::new();
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
      let req = reqwest::Client::new();
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

