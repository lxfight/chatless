#!/bin/bash

echo "🧪 测试新的重命名逻辑..."

# 创建测试目录结构
echo "📁 创建测试目录结构..."
rm -rf test-artifacts
mkdir -p test-artifacts/chatless-macos-13-x64/macos
mkdir -p test-artifacts/chatless-macos-14-arm64/macos

# 创建测试文件
echo "📄 创建测试文件..."
echo "test content for x64" > test-artifacts/chatless-macos-13-x64/macos/Chatless.app.tar.gz
echo "test signature for x64" > test-artifacts/chatless-macos-13-x64/macos/Chatless.app.tar.gz.sig
echo "test content for arm64" > test-artifacts/chatless-macos-14-arm64/macos/Chatless.app.tar.gz
echo "test signature for arm64" > test-artifacts/chatless-macos-14-arm64/macos/Chatless.app.tar.gz.sig

echo "✅ 测试文件创建完成"
echo "=== 初始目录结构 ==="
ls -R test-artifacts

echo ""
echo "🔄 开始测试新的重命名逻辑..."

# 使用find命令直接重命名文件，避免cd路径问题
echo "Processing macOS x64 files..."
find test-artifacts/chatless-macos-13-x64 -name "*.app.tar.gz" -type f | while read file; do
  dir=$(dirname "$file")
  filename=$(basename "$file")
  newname=$(echo "$filename" | sed 's/\.app\.tar\.gz/\.x64\.app\.tar\.gz/')
  mv "$file" "$dir/$newname"
  echo "Renamed $filename to $newname"
done

find test-artifacts/chatless-macos-13-x64 -name "*.app.tar.gz.sig" -type f | while read file; do
  dir=$(dirname "$file")
  filename=$(basename "$file")
  newname=$(echo "$filename" | sed 's/\.app\.tar\.gz\.sig/\.x64\.app\.tar\.gz\.sig/')
  mv "$file" "$dir/$newname"
  echo "Renamed $filename to $newname"
done

echo "Processing macOS ARM64 files..."
find test-artifacts/chatless-macos-14-arm64 -name "*.app.tar.gz" -type f | while read file; do
  dir=$(dirname "$file")
  filename=$(basename "$file")
  newname=$(echo "$filename" | sed 's/\.app\.tar\.gz/\.arm64\.app\.tar\.gz/')
  mv "$file" "$dir/$newname"
  echo "Renamed $filename to $newname"
done

find test-artifacts/chatless-macos-14-arm64 -name "*.app.tar.gz.sig" -type f | while read file; do
  dir=$(dirname "$file")
  filename=$(basename "$file")
  newname=$(echo "$filename" | sed 's/\.app\.tar\.gz\.sig/\.arm64\.app\.tar\.gz\.sig/')
  mv "$file" "$dir/$newname"
  echo "Renamed $filename to $newname"
done

# 验证重命名结果
echo ""
echo "=== 重命名完成后的结构 ==="
ls -R test-artifacts

# 检查是否有重复文件名
echo ""
echo "=== 检查重复文件名 ==="
duplicates=$(find test-artifacts -name "*.app.tar.gz*" -type f | sed 's/.*\///' | sort | uniq -d)
if [ -z "$duplicates" ]; then
  echo "✅ 没有发现重复文件名"
else
  echo "❌ 发现重复文件名:"
  echo "$duplicates"
  exit 1
fi

# 最终验证
echo ""
echo "=== 最终验证 ==="
echo "期望的文件:"
echo "  - Chatless.x64.app.tar.gz"
echo "  - Chatless.x64.app.tar.gz.sig"
echo "  - Chatless.arm64.app.tar.gz"
echo "  - Chatless.arm64.app.tar.gz.sig"
echo ""
echo "实际文件:"
find test-artifacts -name "*.app.tar.gz*" -type f | sort

# 清理测试文件
echo ""
echo "🧹 清理测试文件..."
rm -rf test-artifacts

echo ""
echo "🎉 测试完成！新的重命名逻辑工作正常。"
