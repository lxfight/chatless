use reqwest::Client;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use urlencoding::encode;

use crate::http_client;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchRequest {
  pub provider: String,       // "google" | "bing" | "custom_scrape" | "ollama" | "duckduckgo"
  pub query: String,          // 搜索关键词
  pub api_key: Option<String>,// provider 对应的 key（google/bing）
  pub cse_id: Option<String>, // google 的 CSE ID
}

#[derive(Serialize, Debug)]
pub struct WebSearchResult {
  pub snippet: String,
  pub source_title: String,
  pub url: String,
}

#[tauri::command]
pub async fn native_web_search(request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  log::info!("[WEB_SEARCH] provider={} query={}", request.provider, request.query);
  let client = http_client::get_browser_like_client() // 统一走“浏览器头”客户端，兼容更多场景
    .map_err(|e| format!("init http client failed: {}", e))?;
  let client_ref: &Client = &client;

  match request.provider.as_str() {
    "google" => call_google_search(client_ref, request).await,
    "bing" => call_bing_search(client_ref, request).await,
    "ollama" => call_ollama_search(client_ref, request).await,
    // DuckDuckGo：默认采用官方html端点解析（无需API Key，鲁棒性强）
    // 如未来需要，可替换为 duckduckgo crate 的实现
    "duckduckgo" => call_duckduckgo_search(client_ref, request).await,
    "custom_scrape" => call_custom_scraper(client_ref, request).await,
    other => Err(format!("Unsupported search provider: {}", other)),
  }
}

async fn call_google_search(client: &Client, request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  let api_key = request.api_key.ok_or_else(|| "Google API Key is missing".to_string())?;
  let cse_id = request.cse_id.ok_or_else(|| "Google CSE ID is missing".to_string())?;
  let url = format!(
    "https://www.googleapis.com/customsearch/v1?key={}&cx={}&q={}",
    api_key, cse_id, encode(&request.query)
  );
  log::info!("[WEB_SEARCH][google] GET {}", "https://www.googleapis.com/customsearch/v1?...");
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("http error: {}", e))?;
  let status = res.status();
  let text = res.text().await.map_err(|e| format!("read body failed: {}", e))?;
  log::info!("[WEB_SEARCH][google] status={} body_head={}", status, sample_for_log(&text));
  let resp: serde_json::Value = serde_json::from_str(&text)
    .map_err(|e| format!("decode json failed: {}; body_head={}", e, sample_for_log(&text)))?;

  // 优化错误提示：Google 返回 { "error": { code, message, errors: [...] } }
  if let Some(err) = resp.get("error") {
    let code = err.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
    let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
    let reason = err.get("errors")
      .and_then(|a| a.as_array())
      .and_then(|arr| arr.get(0))
      .and_then(|o| o.get("reason"))
      .and_then(|r| r.as_str())
      .unwrap_or("");
    return Err(format!(
      "Google API 错误 (code {}): {}{}",
      code,
      msg,
      if reason.is_empty() { "".to_string() } else { format!(" (reason: {})", reason) }
    ));
  }

  let items = resp
    .get("items")
    .and_then(|i| i.as_array())
    .ok_or_else(|| {
      let total = resp.get("searchInformation")
        .and_then(|s| s.get("totalResults"))
        .and_then(|t| t.as_str())
        .unwrap_or("0")
        .to_string();
      format!("Google 搜索无结果或受限（totalResults={}）。请检查 CSE 是否启用、搜索范围与 API Key/CSE ID 是否正确。", total)
    })?;

  let results: Vec<WebSearchResult> = items
    .iter()
    .filter_map(|item| {
      let title = item.get("title")?.as_str()?;
      let link = item.get("link")?.as_str()?;
      let snippet = item.get("snippet")?.as_str().unwrap_or("").to_string();
      Some(WebSearchResult {
        source_title: title.to_string(),
        url: link.to_string(),
        snippet,
      })
    })
    .take(5)
    .collect();

  Ok(results)
}

async fn call_bing_search(client: &Client, request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  let api_key = request.api_key.ok_or_else(|| "Bing API Key is missing".to_string())?;
  let url = "https://api.bing.microsoft.com/v7.0/search";
  log::info!("[WEB_SEARCH][bing] GET {}", url);
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .header("Ocp-Apim-Subscription-Key", api_key)
    .query(&[("q", request.query.as_str())])
    .send()
    .await
    .map_err(|e| format!("http error: {}", e))?;
  let status = res.status();
  let text = res.text().await.map_err(|e| format!("read body failed: {}", e))?;
  log::info!("[WEB_SEARCH][bing] status={} body_head={}", status, sample_for_log(&text));
  let resp: serde_json::Value = serde_json::from_str(&text)
    .map_err(|e| format!("decode json failed: {}; body_head={}", e, sample_for_log(&text)))?;

  let items = resp
    .get("webPages")
    .and_then(|wp| wp.get("value"))
    .and_then(|v| v.as_array())
    .ok_or_else(|| "No webPages found in Bing response".to_string())?;

  let results: Vec<WebSearchResult> = items
    .iter()
    .filter_map(|item| {
      let title = item.get("name")?.as_str()?;
      let url = item.get("url")?.as_str()?;
      let snippet = item.get("snippet")?.as_str().unwrap_or("").to_string();
      Some(WebSearchResult {
        source_title: title.to_string(),
        url: url.to_string(),
        snippet,
      })
    })
    .take(5)
    .collect();

  Ok(results)
}

/// DuckDuckGo 搜索
/// 说明：当前实现沿用基于 https://html.duckduckgo.com 的解析逻辑，与 `custom_scrape` 一致。
/// 这样可在无需额外密钥的情况下提供稳定可用的结果。
/// 若后续需要切换为 duckduckgo crate，可在此处替换为 crate 的调用与结果映射。
async fn call_duckduckgo_search(client: &Client, request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  call_custom_scraper(client, request).await
}

async fn call_custom_scraper(client: &Client, request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  let url = format!("https://html.duckduckgo.com/html/?q={}", encode(&request.query));
  log::info!("[WEB_SEARCH][scrape] GET {}", url);
  let body = client
    .get(url)
    .send()
    .await
    .map_err(|e| format!("http error: {}", e))?
    .text()
    .await
    .map_err(|e| format!("read body failed: {}", e))?;
  log::info!("[WEB_SEARCH][scrape] body_head={}", sample_for_log(&body));

  let document = Html::parse_document(&body);
  let result_selector = Selector::parse("div.result").map_err(|e| e.to_string())?;
  let title_selector = Selector::parse("h2.result__title > a.result__a").map_err(|e| e.to_string())?;
  let snippet_selector = Selector::parse("a.result__snippet").map_err(|e| e.to_string())?;
  let url_selector = Selector::parse("a.result__url").map_err(|e| e.to_string())?;

  let results: Vec<WebSearchResult> = document
    .select(&result_selector)
    .filter_map(|el| {
      let title = el.select(&title_selector).next()?.text().collect::<String>().trim().to_string();
      let snippet = el.select(&snippet_selector).next()?.text().collect::<String>().trim().to_string();
      let url = el.select(&url_selector).next()?.value().attr("href")?.trim().to_string();
      Some(WebSearchResult {
        source_title: title,
        snippet,
        url,
      })
    })
    .take(5)
    .collect();

  Ok(results)
}

async fn call_ollama_search(client: &Client, request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  let api_key = request.api_key.ok_or_else(|| "Ollama API Key is missing".to_string())?;
  let url = "https://ollama.com/api/web_search";
  let payload = serde_json::json!({
    "query": request.query
  });

  log::info!("[WEB_SEARCH][ollama] POST {}", url);
  let res = client
    .post(url)
    .header("Accept", "application/json")
    .bearer_auth(api_key)
    .json(&payload)
    .send()
    .await
    .map_err(|e| format!("http error: {}", e))?;
  let status = res.status();
  let text = res.text().await.map_err(|e| format!("read body failed: {}", e))?;
  log::info!("[WEB_SEARCH][ollama] status={} body_head={}", status, sample_for_log(&text));
  let resp: serde_json::Value = serde_json::from_str(&text)
    .map_err(|e| format!("decode json failed: {}; body_head={}", e, sample_for_log(&text)))?;

  let items = resp.get("results").and_then(|i| i.as_array()).ok_or_else(|| "No results found in Ollama response".to_string())?;
  let results: Vec<WebSearchResult> = items.iter().filter_map(|item| {
    let title = item.get("title")?.as_str()?;
    let url = item.get("url")?.as_str()?;
    let content = item.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
    Some(WebSearchResult {
      source_title: title.to_string(),
      url: url.to_string(),
      snippet: content,
    })
  }).take(5).collect();

  Ok(results)
}

fn sample_for_log(s: &str) -> String {
  let trimmed = s.trim();
  let head: String = trimmed.chars().take(280).collect();
  if trimmed.len() > 280 {
    format!("{}… (len={})", head, trimmed.len())
  } else {
    head
  }
}


