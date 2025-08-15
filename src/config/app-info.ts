// 应用信息配置
export const APP_INFO = {
  name: "Chatless",
  version: "0.2.1", // 这个值会在构建时被替换
  description: "一个简洁实用的 AI 对话客户端。",
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

// 获取构建日期
export const getBuildDate = (): string => {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
};

// 获取完整版本信息
export const getVersionInfo = () => {
  return {
    version: APP_INFO.version,
    build: getBuildDate(),
  };
}; 