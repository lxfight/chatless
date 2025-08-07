// 为缺失的 onnxruntime-web 提供临时类型声明，避免编译错误
// TODO: 当引入实际的 onnxruntime-web 依赖时删除此文件

declare module 'onnxruntime-web' {
  // 使用 any 类型占位即可
  const ort: any;
  export = ort;
} 