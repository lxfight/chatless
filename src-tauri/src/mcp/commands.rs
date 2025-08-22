use crate::mcp::state::{McpState, McpService};
use crate::mcp::types::McpServerConfig;
use rmcp::{
  model::{CallToolRequestParam, Tool, ListToolsResult, ReadResourceRequestParam, GetPromptRequestParam},
  service::ServiceExt,
  transport::{TokioChildProcess, ConfigureCommandExt},
};
use tauri::State;
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
      let mut cmd = Command::new(cmd_name);
      if let Some(args) = &config.args { cmd.args(args); }
      if let Some(envs) = &config.env { for (k,v) in envs { cmd.env(k, v); } }

      let service: McpService = ()
        .serve(TokioChildProcess::new(cmd.configure(|_c| {})).map_err(|e| e.to_string())?)
        .await
        .map_err(|e| e.to_string())?;

      state.0.insert(name, service);
      Ok(())
    }
    "sse" | "http" => {
      Err("sse/http 传输将在后续里程碑中实现".to_string())
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

