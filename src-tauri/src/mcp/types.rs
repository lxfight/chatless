use serde::{Deserialize, Serialize};

// 前端传入的服务器配置（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
  pub r#type: String,                // stdio | sse | http
  pub command: Option<String>,       // stdio 用
  pub args: Option<Vec<String>>,     // stdio 用
  pub env: Option<Vec<(String,String)>>, // stdio 用（键值对）
  pub base_url: Option<String>,      // sse/http 用
  pub headers: Option<Vec<(String,String)>>, // sse/http 用
}

