// 应用信息配置
export const APP_INFO = {
  name: "Chatless",
  description: "一个简洁实用的 AI 对话客户端，支持多模型与知识库。",
  author: "kamjin3086",
  repository: "https://github.com/kamjin3086/chatless",
  releases: "https://github.com/kamjin3086/chatless/releases",
  website: "https://kamjin3086.github.io/chatless",
  helpCenter: "https://kamjin3086.github.io/chatless/help",
  feedback: "https://kamjin3086.github.io/chatless/feedback",
  community: "https://kamjin3086.github.io/chatless/community",
  terms: "https://kamjin3086.github.io/chatless/terms",
  privacy: "https://kamjin3086.github.io/chatless/privacy",
};

/**
 * 返回版本与内部构建号
 * version: package.json 的 version 字段；若不可用则为 'dev'
 * build:   CI 提供的 GITHUB_SHA 前 7 位；本地则为 'local'
 */
export function getVersionInfo() {
  // 在构建阶段，webpack / next.js 会把 process.env.npm_package_version 替换为字面量
  const version = (process.env.npm_package_version as string | undefined) || "dev";
  const build = (process.env.GITHUB_SHA as string | undefined)?.slice(0, 7) || "local";
  return { version, build };
} 