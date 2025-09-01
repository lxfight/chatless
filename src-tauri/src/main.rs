// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod env_setup;

fn main() {
    // 设置环境变量
    if let Err(e) = env_setup::setup_environment() {
        eprintln!("Failed to setup environment: {}", e);
        // 继续运行，但记录错误
    }

    // ── Logging: silence verbose sqlx query debug output ────────────────
    // Unless the user explicitly overrides RUST_LOG, we apply a default
    // filter that keeps normal info logs but turns off `sqlx::query`.
    // Example resulting env: `info,sqlx::query=off`
    const DEFAULT_FILTER: &str = "info,sqlx::query=off";
    if std::env::var("RUST_LOG").is_err() {
        // Only set if user hasn't provided their own filter.
        std::env::set_var("RUST_LOG", DEFAULT_FILTER);
    }

    chatless_lib::run()
}
