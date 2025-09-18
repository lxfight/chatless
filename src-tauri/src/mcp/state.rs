use dashmap::DashMap;
use rmcp::service::{RoleClient, RunningService};
use std::sync::Arc;

// 管理已连接的 MCP 服务实例（key 为服务名）
pub type McpService = RunningService<RoleClient, ()>;

pub struct McpState(pub Arc<DashMap<String, McpService>>);

impl McpState {
  pub fn new() -> Self {
    Self(Arc::new(DashMap::new()))
  }
}
