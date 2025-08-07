import type { NextConfig } from "next";


const isProd = process.env.NODE_ENV === 'production';

const internalHost = process.env.TAURI_DEV_HOST || 'localhost';


const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  eslint: {
    // 在生产构建时忽略 ESLint 错误，避免因大量 lint 规则阻断打包流程
    // TODO: 后续逐步修复代码风格问题后再启用
    ignoreDuringBuilds: true,
  },
  // 将 .next 目录改为 dist，且 static export 也位于项目根的 dist 目录，
  // 与 tauri.conf.json 中 frontendDist: "../dist" 对应
  distDir: "dist",

  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
} satisfies NextConfig;

export default nextConfig;
