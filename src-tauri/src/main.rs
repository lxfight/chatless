// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod env_setup;

fn main() {
    // 设置环境变量
    if let Err(e) = env_setup::setup_environment() {
        eprintln!("Failed to setup environment: {}", e);
        // 继续运行，但记录错误
    }
    
    chatless_lib::run()
}
