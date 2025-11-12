use reqwest::Client;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use urlencoding::encode;

use crate::http_client;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchRequest {
  pub provider: String,       // "google" | "bing" | "custom_scrape"
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
  let resp: serde_json::Value = client
    .get(url)
    .send()
    .await
    .map_err(|e| e.to_string())?
    .json()
    .await
    .map_err(|e| e.to_string())?;

  let items = resp
    .get("items")
    .and_then(|i| i.as_array())
    .ok_or_else(|| "No items found in Google response".to_string())?;

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
  let resp: serde_json::Value = client
    .get(url)
    .header("Ocp-Apim-Subscription-Key", api_key)
    .query(&[("q", request.query.as_str())])
    .send()
    .await
    .map_err(|e| e.to_string())?
    .json()
    .await
    .map_err(|e| e.to_string())?;

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

async fn call_custom_scraper(client: &Client, request: WebSearchRequest) -> Result<Vec<WebSearchResult>, String> {
  let url = format!("https://html.duckduckgo.com/html/?q={}", encode(&request.query));
  let body = client
    .get(url)
    .send()
    .await
    .map_err(|e| e.to_string())?
    .text()
    .await
    .map_err(|e| e.to_string())?;

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

  let resp: serde_json::Value = client
    .post(url)
    .bearer_auth(api_key)
    .json(&payload)
    .send()
    .await
    .map_err(|e| e.to_string())?
    .json()
    .await
    .map_err(|e| e.to_string())?;

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


