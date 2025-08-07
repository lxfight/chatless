// 应用信息配置
export const APP_INFO = {
  name: "Chatless",
  version: "0.1.0", // 这个值会在构建时被替换
  description: "一个聪明、高效的本地 AI 对话客户端。",
  author: "kamjin3086",
  repository: "https://github.com/kamjin3086/chatless",
  releases: "https://github.com/kamjin3086/chatless/releases",
  website: "https://chatless.app",
  helpCenter: "https://help.chatless.app",
  feedback: "https://feedback.chatless.app",
  community: "https://community.chatless.app",
  terms: "https://chatless.app/terms",
  privacy: "https://chatless.app/privacy",
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