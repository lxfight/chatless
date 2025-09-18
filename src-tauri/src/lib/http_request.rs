use reqwest::Method;
use serde_json::Value;
use std::collections::HashMap;
use std::str::FromStr;

/// HTTP请求体类型
#[derive(serde::Deserialize, Debug)]
#[serde(tag = "type")]
pub enum RequestBody {
  Json { payload: Value },
  Text { payload: String },
  Form { payload: HashMap<String, String> },
}

/// HTTP请求参数
#[derive(serde::Deserialize, Debug)]
pub struct HttpRequestParams {
  pub url: String,
  pub method: Option<String>,
  pub headers: Option<HashMap<String, String>>,
  pub body: Option<RequestBody>,
  #[serde(rename = "clientType")]
  pub client_type: Option<String>,
  #[serde(rename = "timeoutMs")]
  pub timeout_ms: Option<u64>,
}

/// HTTP响应结果
#[derive(serde::Serialize, Debug)]
pub struct HttpResponseResult {
  pub success: bool,
  pub status: u16,
  pub status_text: String,
  pub headers: HashMap<String, String>,
  pub body: String,
  pub duration_ms: u64,
  pub client_type: String,
  pub error: Option<String>,
}

/// Tauri命令：发送HTTP请求（使用自定义客户端）
#[tauri::command]
pub async fn send_http_request(
  url: String,
  method: Option<String>,
  headers: Option<HashMap<String, String>>,
  body: Option<RequestBody>,
  client_type: Option<String>,
  timeout_ms: Option<u64>,
) -> Result<HttpResponseResult, String> {
  let start_time = std::time::Instant::now();

  // 选择客户端类型
  let client_type = client_type.as_deref().unwrap_or("browser_like");
  let client = match client_type {
    "default" => crate::http_client::get_default_client()?,
    "browser_like" => crate::http_client::get_browser_like_client()?,
    "http1_only" => crate::http_client::get_http1_client()?,
    _ => return Err("Invalid client type".to_string()),
  };

  // 解析HTTP方法
  let method = Method::from_str(&method.unwrap_or_else(|| "GET".to_string()))
    .map_err(|e| format!("Invalid HTTP method: {}", e))?;

  // 构建请求
  let mut request_builder = client.request(method, &url);

  // 添加请求头
  if let Some(headers) = &headers {
    for (key, value) in headers {
      request_builder = request_builder.header(key, value);
    }
  }

  // 添加请求体
  if let Some(body) = &body {
    request_builder = match body {
      RequestBody::Json { payload } => request_builder.json(payload),
      RequestBody::Text { payload } => request_builder.body(payload.clone()),
      RequestBody::Form { payload } => request_builder.form(payload),
    };
  }

  // 设置超时
  if let Some(timeout_ms) = timeout_ms {
    request_builder = request_builder.timeout(std::time::Duration::from_millis(timeout_ms));
  }

  // 发送请求
  match request_builder.send().await {
    Ok(response) => {
      let duration = start_time.elapsed();
      let status = response.status();
      let headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

      let body = response.text().await.map_err(|e| e.to_string())?;

      Ok(HttpResponseResult {
        success: status.is_success(),
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        headers,
        body,
        duration_ms: duration.as_millis() as u64,
        client_type: client_type.to_string(),
        error: None,
      })
    }
    Err(e) => {
      let duration = start_time.elapsed();
      Ok(HttpResponseResult {
        success: false,
        status: 0,
        status_text: "".to_string(),
        headers: HashMap::new(),
        body: "".to_string(),
        duration_ms: duration.as_millis() as u64,
        client_type: client_type.to_string(),
        error: Some(e.to_string()),
      })
    }
  }
}
