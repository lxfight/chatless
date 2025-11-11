"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Lightbulb, Sparkles, MessageSquare, BookOpen, Zap, Loader2 } from "lucide-react";
import "@/styles/thinkbar-animations.css";

export default function ThinkBarPreviewsPage() {
  const [activeDemo, setActiveDemo] = useState<number | null>(null);

  const startDemo = (index: number) => {
    setActiveDemo(index);
    // 10秒后自动完成思考
    setTimeout(() => {
      setActiveDemo(null);
    }, 10000);
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">思考栏样式预览</h1>
        <p className="text-muted-foreground">
          点击"开始思考"按钮查看流式思考效果，10秒后自动切换到完成状态。共 <strong>21 种样式</strong>，专注思考感，避免焦虑。
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">流式文案</span>
          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 rounded text-purple-700 dark:text-purple-300">温和舒适</span>
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">思考专注</span>
          <span className="px-2 py-1 bg-green-100 dark:bg-green-900 rounded text-green-700 dark:text-green-300">个性表达</span>
        </div>
      </div>

      <div className="grid gap-8">
        {/* 样式 3: 思考流程展示 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 3: 思考流程展示</h2>
            <Button onClick={() => startDemo(3)}>开始思考</Button>
          </div>
          <ThinkBar3 isThinking={activeDemo === 3} />
        </Card>

        {/* 样式 5: 思维扩散 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 5: 思维扩散</h2>
            <Button onClick={() => startDemo(5)}>开始思考</Button>
          </div>
          <ThinkBar5 isThinking={activeDemo === 5} />
        </Card>

        {/* 样式 7: 终端思考风 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 7: 终端思考风</h2>
            <Button onClick={() => startDemo(7)}>开始思考</Button>
          </div>
          <ThinkBar7 isThinking={activeDemo === 7} />
        </Card>

        {/* 样式 8: 极简点跳动 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 8: 极简点跳动</h2>
            <Button onClick={() => startDemo(8)}>开始思考</Button>
          </div>
          <ThinkBar8 isThinking={activeDemo === 8} />
        </Card>

        {/* 样式 15: 霓虹脉冲 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 15: 霓虹脉冲</h2>
            <Button onClick={() => startDemo(15)}>开始思考</Button>
          </div>
          <ThinkBar15 isThinking={activeDemo === 15} />
        </Card>

        {/* 样式 16: 流式思考文本 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 16: 流式思考文本（真实场景）</h2>
            <Button onClick={() => startDemo(16)}>开始思考</Button>
          </div>
          <ThinkBar16 isThinking={activeDemo === 16} />
        </Card>

        {/* 样式 18: 对话气泡 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 18: 对话气泡思考</h2>
            <Button onClick={() => startDemo(18)}>开始思考</Button>
          </div>
          <ThinkBar18 isThinking={activeDemo === 18} />
        </Card>

        {/* 样式 26: 思绪流淌 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 26: 思绪流淌</h2>
            <Button onClick={() => startDemo(26)}>开始思考</Button>
          </div>
          <ThinkBar26 isThinking={activeDemo === 26} />
        </Card>

        {/* 样式 30: 静默思考 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 30: 静默思考文本</h2>
            <Button onClick={() => startDemo(30)}>开始思考</Button>
          </div>
          <ThinkBar30 isThinking={activeDemo === 30} />
        </Card>

        {/* 样式 31: 翻页式思考 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 31: 翻页式思考</h2>
            <Button onClick={() => startDemo(31)}>开始思考</Button>
          </div>
          <ThinkBar31 isThinking={activeDemo === 31} />
        </Card>

        {/* 样式 33: 渐进文本流 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 33: 渐进文本流</h2>
            <Button onClick={() => startDemo(33)}>开始思考</Button>
          </div>
          <ThinkBar33 isThinking={activeDemo === 33} />
        </Card>

        {/* 样式 35: 打字机多行 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 35: 打字机多行</h2>
            <Button onClick={() => startDemo(35)}>开始思考</Button>
          </div>
          <ThinkBar35 isThinking={activeDemo === 35} />
        </Card>

        {/* 样式 38: 模糊聚焦文本 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 38: 模糊聚焦文本</h2>
            <Button onClick={() => startDemo(38)}>开始思考</Button>
			</div>
          <ThinkBar38 isThinking={activeDemo === 38} />
        </Card>

        {/* 新增样式 39: 思考片段展示 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 39: 思考片段展示</h2>
            <Button onClick={() => startDemo(39)}>开始思考</Button>
						</div>
          <ThinkBar39 isThinking={activeDemo === 39} />
        </Card>

        {/* 新增样式 40: 温和渐显文本 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 40: 温和渐显文本</h2>
            <Button onClick={() => startDemo(40)}>开始思考</Button>
						</div>
          <ThinkBar40 isThinking={activeDemo === 40} />
        </Card>

        {/* 新增样式 41: 思维日志 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 41: 思维日志</h2>
            <Button onClick={() => startDemo(41)}>开始思考</Button>
						</div>
          <ThinkBar41 isThinking={activeDemo === 41} />
        </Card>

        {/* 新增样式 42: 诗意思考 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 42: 诗意思考</h2>
            <Button onClick={() => startDemo(42)}>开始思考</Button>
					</div>
          <ThinkBar42 isThinking={activeDemo === 42} />
        </Card>

        {/* 新增样式 43: 问答式思考 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 43: 问答式思考</h2>
            <Button onClick={() => startDemo(43)}>开始思考</Button>
						</div>
          <ThinkBar43 isThinking={activeDemo === 43} />
        </Card>

        {/* 新增样式 44: 深度思考流 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 44: 深度思考流</h2>
            <Button onClick={() => startDemo(44)}>开始思考</Button>
					</div>
          <ThinkBar44 isThinking={activeDemo === 44} />
        </Card>

        {/* 新增样式 45: 柔和步骤展示 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 45: 柔和步骤展示</h2>
            <Button onClick={() => startDemo(45)}>开始思考</Button>
					</div>
          <ThinkBar45 isThinking={activeDemo === 45} />
			</Card>

        {/* 新增样式 46: 思考笔记 */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">样式 46: 思考笔记</h2>
            <Button onClick={() => startDemo(46)}>开始思考</Button>
          </div>
          <ThinkBar46 isThinking={activeDemo === 46} />
        </Card>
      </div>
    </div>
  );
}

// 保留的样式组件

// 样式 3: 思考流程展示
function ThinkBar3({ isThinking }: { isThinking: boolean }) {
  const [text, setText] = useState('');
  const fullText = '分析问题 → 检索知识 → 构建方案 → 准备回复';
  
  useEffect(() => {
    if (isThinking) {
      let index = 0;
      setText('');
      const interval = setInterval(() => {
        if (index < fullText.length) {
          setText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    } else {
      setText(fullText);
    }
  }, [isThinking]);

  return (
    <div className="rounded-lg p-4 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-200 dark:border-indigo-800">
      <div className="flex items-start gap-3">
        <Sparkles className={`w-5 h-5 mt-1 ${isThinking ? 'text-indigo-500 animate-spin' : 'text-green-500'}`} />
        
        <div className="flex-1 space-y-2">
          <div className="font-medium">
            {isThinking ? '思维流程' : '思考流程完成'}
          </div>
          
          <div className="text-sm font-mono bg-black/5 dark:bg-white/5 rounded p-2">
            {text}
            {isThinking && <span className="animate-pulse">|</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// 样式 5: 思维扩散
function ThinkBar5({ isThinking }: { isThinking: boolean }) {
  return (
    <div className={`
      relative rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-cyan-500/5 border-cyan-300 dark:border-cyan-700' 
        : 'bg-green-500/5 border-green-300 dark:border-green-700'
      }
    `}>
      {isThinking && (
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-particle"
              style={{
                left: '50%',
                top: '50%',
                animationDelay: `${i * 0.2}s`,
                animationDuration: '2s',
              }}
            />
          ))}
        </div>
      )}
      
      <div className="relative flex items-center gap-3">
        <Brain className={`w-5 h-5 ${isThinking ? 'text-cyan-500 animate-spin' : 'text-green-500'}`} />
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {isThinking ? '思维扩散中' : '思考完成'}
            </span>
            {isThinking && (
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce animation-delay-150" />
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce animation-delay-300" />
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {isThinking ? '多角度分析问题...' : '已完成全面分析'}
          </div>
        </div>
			</div>
		</div>
	);
}

// 样式 7: 终端思考风
function ThinkBar7({ isThinking }: { isThinking: boolean }) {
	return (
    <div className={`
      relative rounded-lg p-4 border-2 overflow-hidden
      ${isThinking 
        ? 'bg-slate-900 border-blue-400' 
        : 'bg-green-900/20 border-green-400'
      }
    `}>
      {isThinking && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/30 to-transparent animate-scan" />
      )}
      
      <div className="relative flex items-center gap-3">
        <Loader2 className={`w-5 h-5 ${isThinking ? 'text-blue-400 animate-spin' : 'text-green-400'}`} />
        
        <div className="flex-1">
          <div className="font-mono text-sm font-semibold" style={{ color: isThinking ? '#60a5fa' : '#4ade80' }}>
            {isThinking ? '>>> THINKING...' : '>>> COMPLETE'}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: isThinking ? '#93c5fd' : '#86efac' }}>
            {isThinking ? '[ANALYZING] [REASONING]' : '[READY]'}
          </div>
        </div>
      </div>
    </div>
  );
}

// 样式 8: 极简点跳动
function ThinkBar8({ isThinking }: { isThinking: boolean }) {
	return (
    <div className={`
      rounded-lg p-4 border transition-all duration-500
      ${isThinking 
        ? 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700' 
        : 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600'
      }
    `}>
			<div className="flex items-center gap-3">
        <div className={`
          w-2 h-2 rounded-full transition-all duration-1000
          ${isThinking ? 'bg-slate-400 animate-pulse' : 'bg-slate-600'}
        `} />
        
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isThinking ? '思考中' : '完成'}
				</div>
        </div>
        
        {isThinking && (
          <div className="flex gap-1.5">
            <div className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
					)}
				</div>
			</div>
  );
}

// 样式 15: 霓虹脉冲
function ThinkBar15({ isThinking }: { isThinking: boolean }) {
  return (
    <div className={`
      relative rounded-lg p-4 overflow-hidden border-2 transition-all duration-300
      ${isThinking 
        ? 'bg-black border-cyan-500 shadow-lg shadow-cyan-500/50' 
        : 'bg-black border-green-500 shadow-lg shadow-green-500/50'
      }
    `}>
      {isThinking && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-neon-flow" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-neon-line" />
        </>
      )}
      
      <div className="relative flex items-center gap-3">
        <Zap className={`w-6 h-6 ${isThinking ? 'text-cyan-400 animate-pulse' : 'text-green-400'}`} />
        
        <div className="flex-1">
          <div className={`
            font-bold text-lg tracking-wider
            ${isThinking ? 'text-cyan-400' : 'text-green-400'}
            ${isThinking ? 'animate-pulse' : ''}
          `}>
            {isThinking ? 'THINKING...' : 'COMPLETE'}
          </div>
          <div className="font-mono text-xs text-white/60 mt-1">
            {isThinking ? '分析中...' : '准备就绪'}
          </div>
        </div>
      </div>
    </div>
  );
}

// 样式 16: 流式思考文本（真实场景）
function ThinkBar16({ isThinking }: { isThinking: boolean }) {
  const [thinkText, setThinkText] = useState('');
  const fullThinkText = '嗯，用户又问了"你能帮我做什么事？"这个问题。看起来他已经多次提问同样的问题了，可能是在测试我的回应是否一致或者在寻找更多的信息...';
  
  useEffect(() => {
    if (isThinking) {
      let index = 0;
      setThinkText('');
      const interval = setInterval(() => {
        if (index < fullThinkText.length) {
          setThinkText(fullThinkText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 30);
      return () => clearInterval(interval);
    } else {
      setThinkText(fullThinkText);
    }
  }, [isThinking]);

  return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' 
        : 'bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${isThinking ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
          <span className="text-xs font-medium text-muted-foreground">
            {isThinking ? '思考中...' : '思考完成'}
						</span>
        </div>
        
        <div className="text-sm text-foreground/80 leading-relaxed min-h-[60px]">
          {thinkText}
          {isThinking && <span className="animate-pulse">▊</span>}
        </div>
      </div>
		</div>
	);
}

// 样式 18: 对话气泡思考
function ThinkBar18({ isThinking }: { isThinking: boolean }) {
	return (
    <div className="flex items-start gap-3">
      <div className={`
        rounded-2xl p-4 max-w-md transition-all duration-500
        ${isThinking 
          ? 'bg-blue-100 dark:bg-blue-900/30' 
          : 'bg-green-100 dark:bg-green-900/30'
        }
      `}>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className={`w-4 h-4 ${isThinking ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
          <span className="text-xs font-medium">
            {isThinking ? 'AI 正在思考' : 'AI 已准备好'}
          </span>
					</div>
        
        {isThinking && (
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        
        {!isThinking && (
          <div className="text-sm text-green-700 dark:text-green-300">
            准备为您解答 ✓
			</div>
        )}
			</div>
		</div>
	);
}

// 样式 26: 思绪流淌
function ThinkBar26({ isThinking }: { isThinking: boolean }) {
	return (
    <div className={`
      rounded-lg p-4 transition-all duration-500
      ${isThinking 
        ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30' 
        : 'bg-green-50 dark:bg-green-950/30'
      }
    `}>
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10">
          {isThinking && (
            <>
              {[...Array(3)].map((_, i) => (
					<div
						key={i}
                  className="absolute w-2 h-2 bg-amber-500 rounded-full animate-flow"
                  style={{
                    top: '50%',
                    left: '0',
                    animationDelay: `${i * 0.5}s`,
                  }}
					/>
				))}
            </>
          )}
			</div>
        
        <div className="flex-1">
          <div className="font-medium">
            {isThinking ? '思绪流淌' : '思考完成'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {isThinking ? '想法如流水般涌现' : '思路已成型'}
          </div>
        </div>
			</div>
		</div>
	);
}

// 新增样式 30: 静默思考文本
function ThinkBar30({ isThinking }: { isThinking: boolean }) {
  const [text, setText] = useState('');
  const fullText = '让我静静思考一下这个问题...需要从多个角度来分析...首先要理解核心需求...然后构思最佳的回答方式...';
  
  useEffect(() => {
    if (isThinking) {
      let index = 0;
      setText('');
      const interval = setInterval(() => {
        if (index < fullText.length) {
          setText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 40);
      return () => clearInterval(interval);
    } else {
      setText('思考完成，已整理好回答思路');
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 transition-all duration-300
      ${isThinking 
        ? 'bg-slate-50 dark:bg-slate-900' 
        : 'bg-green-50 dark:bg-green-950/30'
      }
    `}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-slate-400 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isThinking ? '正在思考' : '完成'}
          </span>
        </div>
        
        <div className="text-sm text-foreground/70 leading-relaxed italic min-h-[50px]">
          {text}
          {isThinking && <span className="animate-pulse">_</span>}
        </div>
      </div>
    </div>
  );
}

// 样式 31: 翻页式思考
function ThinkBar31({ isThinking }: { isThinking: boolean }) {
  const thoughts = [
    '理解问题的核心要点',
    '在知识库中搜索相关内容',
    '整理并组织答案结构',
    '检查逻辑是否连贯'
  ];
  const [currentPage, setCurrentPage] = useState(0);
  
  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setCurrentPage((prev) => (prev + 1) % thoughts.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isThinking]);

				return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className={`w-5 h-5 ${isThinking ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
            <span className="text-sm font-medium">
              {isThinking ? '翻阅思绪' : '阅读完成'}
            </span>
          </div>
          {isThinking && (
            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {thoughts.length}
            </span>
          )}
        </div>
        
        {isThinking && (
          <div className="relative overflow-hidden h-16">
            <div
              className="text-sm leading-relaxed text-foreground/80 animate-page-flip"
              key={currentPage}
            >
              {thoughts[currentPage]}
					</div>
          </div>
        )}
        
			{!isThinking && (
          <div className="text-sm text-muted-foreground">
            所有页面已阅读完毕
          </div>
			)}
      </div>
		</div>
	);
}

// 新增样式 33: 渐进文本流
function ThinkBar33({ isThinking }: { isThinking: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const thinkLines = [
    '正在理解您的问题...',
    '分析问题的关键要素...',
    '检索相关的知识内容...',
    '构建清晰的回答框架...'
  ];
  
  useEffect(() => {
    if (isThinking) {
      setLines([]);
      let currentIndex = 0;
      
      const interval = setInterval(() => {
        if (currentIndex < thinkLines.length) {
          setLines((prev) => [...prev, thinkLines[currentIndex]]);
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-2">
        {isThinking ? (
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="text-sm text-indigo-700 dark:text-indigo-300 animate-gentle-fade-in">
                • {line}
              </div>
            ))}
			</div>
        ) : (
          <div className="text-sm text-green-700 dark:text-green-300">
            ✓ 思考流程已完成
          </div>
        )}
      </div>
		</div>
	);
}

// 样式 35: 打字机多行
function ThinkBar35({ isThinking }: { isThinking: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const thinkLines = [
    '📋 理解用户问题...',
    '🔍 搜索相关知识...',
    '🧩 组织答案结构...',
    '✨ 优化表达方式...'
  ];
  
  useEffect(() => {
    if (isThinking) {
      setLines([]);
      let currentLine = 0;
      let currentChar = 0;
      
      const interval = setInterval(() => {
        if (currentLine < thinkLines.length) {
          const line = thinkLines[currentLine];
          if (currentChar < line.length) {
            setLines((prev) => {
              const newLines = [...prev];
              newLines[currentLine] = line.slice(0, currentChar + 1);
              return newLines;
            });
            currentChar++;
          } else {
            currentLine++;
            currentChar = 0;
          }
        } else {
          clearInterval(interval);
        }
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-2">
				{isThinking ? (
          <div className="space-y-1 font-mono text-sm">
            {lines.map((line, i) => (
              <div key={i} className="text-teal-700 dark:text-teal-300">
                {line}
                {i === lines.length - 1 && <span className="animate-pulse">▊</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-green-700 dark:text-green-300 font-medium">
            ✅ 所有步骤已完成
          </div>
				)}
			</div>
		</div>
	);
}

// 样式 38: 模糊聚焦文本
function ThinkBar38({ isThinking }: { isThinking: boolean }) {
  const [text, setText] = useState('');
  const fullText = '嗯，这个问题很有意思。让我仔细思考一下最佳的回答方式...';
  
	useEffect(() => {
    if (isThinking) {
      let index = 0;
      setText('');
      const interval = setInterval(() => {
        if (index < fullText.length) {
          setText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 60);
      return () => clearInterval(interval);
    } else {
      setText('思考完成，已准备好详细的回答');
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${isThinking ? 'text-slate-600 dark:text-slate-400' : 'text-green-600 dark:text-green-400'}`} />
          <span className="text-xs font-medium text-muted-foreground">
            {isThinking ? '思考中...' : '思考完成'}
          </span>
			</div>
        
        <div className={`
          text-sm leading-relaxed min-h-[60px]
          ${isThinking 
            ? 'text-foreground/70 animate-blur-focus' 
            : 'text-foreground/90'
          }
        `}>
				{text}
          {isThinking && <span className="animate-pulse">▊</span>}
        </div>
			</div>
		</div>
	);
}

// 新增样式 39: 思考片段展示
function ThinkBar39({ isThinking }: { isThinking: boolean }) {
  const [segments, setSegments] = useState<string[]>([]);
  const thinkSegments = [
    '这个问题的核心是什么？',
    '有哪些相关的知识点？',
    '如何组织回答的逻辑？',
    '怎样表达才能更清晰？'
  ];
  
  useEffect(() => {
    if (isThinking) {
      setSegments([]);
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < thinkSegments.length) {
          setSegments((prev) => [...prev, thinkSegments[index]]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className={`w-4 h-4 ${isThinking ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`} />
          <span className="text-xs font-medium">
            {isThinking ? '思考片段' : '思考完成'}
          </span>
			</div>
        
        {isThinking && segments.length > 0 && (
          <div className="space-y-2">
            {segments.map((segment, i) => (
              <div key={i} className="text-sm text-purple-700 dark:text-purple-300 italic animate-gentle-fade-in">
                {segment}
				</div>
            ))}
				</div>
        )}
        
        {!isThinking && (
          <div className="text-sm text-muted-foreground">
            已形成完整思路
          </div>
        )}
			</div>
		</div>
	);
}

// 新增样式 40: 温和渐显文本
function ThinkBar40({ isThinking }: { isThinking: boolean }) {
  const [text, setText] = useState('');
  const fullText = '仔细思考中...从用户的问题出发...理解真正的需求...寻找最合适的答案...';
  
  useEffect(() => {
    if (isThinking) {
      let index = 0;
      setText('');
      const interval = setInterval(() => {
        if (index < fullText.length) {
          setText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    } else {
      setText('思考完成');
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 transition-all duration-500
      ${isThinking 
        ? 'bg-blue-50 dark:bg-blue-950/30' 
        : 'bg-green-50 dark:bg-green-950/30'
      }
    `}>
		<div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {isThinking ? '💭 思考中' : '✓ 完成'}
			</div>
        
        <div className={`
          text-sm leading-relaxed min-h-[50px]
          ${isThinking ? 'text-blue-700 dark:text-blue-300 animate-gentle-fade-in' : 'text-green-700 dark:text-green-300'}
        `}>
          {text}
          {isThinking && <span className="animate-pulse ml-1">•</span>}
        </div>
      </div>
		</div>
	);
}

// 新增样式 41: 思维日志
function ThinkBar41({ isThinking }: { isThinking: boolean }) {
  const [logs, setLogs] = useState<Array<{time: string, text: string}>>([]);
  const thinkLogs = [
    { time: '00:01', text: '开始分析问题' },
    { time: '00:03', text: '检索相关信息' },
    { time: '00:05', text: '组织回答结构' },
    { time: '00:07', text: '准备生成回复' }
  ];
  
  useEffect(() => {
    if (isThinking) {
      setLogs([]);
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < thinkLogs.length) {
          setLogs((prev) => [...prev, thinkLogs[index]]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300 font-mono
      ${isThinking 
        ? 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700'
      }
    `}>
      <div className="space-y-1">
        {isThinking && logs.map((log, i) => (
          <div key={i} className="text-xs text-gray-700 dark:text-gray-300 animate-gentle-fade-in">
            <span className="text-gray-500 dark:text-gray-500">[{log.time}]</span> {log.text}
          </div>
        ))}
        
        {!isThinking && (
          <div className="text-xs text-green-700 dark:text-green-300">
            [DONE] 思考完成
          </div>
        )}
      </div>
		</div>
	);
}

// 新增样式 42: 诗意思考
function ThinkBar42({ isThinking }: { isThinking: boolean }) {
  const [text, setText] = useState('');
  const fullText = '思绪如流水，缓缓流淌\n问题在心间，轻轻回响\n答案的种子，正在萌芽\n等待时机，绽放光芒...';
  
  useEffect(() => {
    if (isThinking) {
      let index = 0;
      setText('');
      const interval = setInterval(() => {
        if (index < fullText.length) {
          setText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 60);
      return () => clearInterval(interval);
    } else {
      setText('思考完成，答案已明');
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 transition-all duration-500
      ${isThinking 
        ? 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30' 
        : 'bg-green-50 dark:bg-green-950/30'
      }
    `}>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground italic">
          {isThinking ? '诗意思考中...' : '思考完成'}
        </div>
        
        <div className={`
          text-sm leading-relaxed whitespace-pre-line min-h-[70px]
          ${isThinking ? 'text-rose-700 dark:text-rose-300' : 'text-green-700 dark:text-green-300'}
          font-serif italic
        `}>
          {text}
        </div>
      </div>
    </div>
  );
}

// 新增样式 43: 问答式思考
function ThinkBar43({ isThinking }: { isThinking: boolean }) {
  const [qa, setQa] = useState<Array<{q: string, a: string}>>([]);
  const thinkQA = [
    { q: '用户想要什么？', a: '了解核心需求' },
    { q: '我知道什么？', a: '检索相关知识' },
    { q: '如何回答？', a: '构建答案框架' }
  ];
  
  useEffect(() => {
    if (isThinking) {
      setQa([]);
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < thinkQA.length) {
          setQa((prev) => [...prev, thinkQA[index]]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 2500);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

				return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-3">
        {isThinking && qa.map((item, i) => (
          <div key={i} className="animate-gentle-fade-in">
            <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
              Q: {item.q}
            </div>
            <div className="text-xs text-cyan-600 dark:text-cyan-400 mt-1 ml-4">
              → {item.a}
            </div>
          </div>
        ))}
        
        {!isThinking && (
          <div className="text-sm text-green-700 dark:text-green-300">
            ✓ 问答式思考完成
          </div>
        )}
      </div>
					</div>
				);
}

// 新增样式 44: 深度思考流
function ThinkBar44({ isThinking }: { isThinking: boolean }) {
  const [text, setText] = useState('');
  const fullText = '深入分析问题的本质...探索多个可能的解决方向...权衡不同方案的优劣...选择最合适的表达方式...确保逻辑的连贯性...';
  
  useEffect(() => {
    if (isThinking) {
      let index = 0;
      setText('');
      const interval = setInterval(() => {
        if (index < fullText.length) {
          setText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 45);
      return () => clearInterval(interval);
    } else {
      setText('深度思考完成');
    }
  }, [isThinking]);

  return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${isThinking ? 'text-indigo-600 dark:text-indigo-400' : 'text-green-600 dark:text-green-400'}`} />
          <span className="text-xs font-medium">
            {isThinking ? '深度思考' : '完成'}
          </span>
        </div>
        
        <div className="text-sm text-foreground/75 leading-relaxed min-h-[60px]">
          {text}
          {isThinking && <span className="animate-pulse">...</span>}
        </div>
      </div>
		</div>
	);
}

// 新增样式 45: 柔和步骤展示
function ThinkBar45({ isThinking }: { isThinking: boolean }) {
  const [steps, setSteps] = useState<string[]>([]);
  const thinkSteps = [
    '理解',
    '分析',
    '综合',
    '表达'
  ];
  
  useEffect(() => {
    if (isThinking) {
      setSteps([]);
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < thinkSteps.length) {
          setSteps((prev) => [...prev, thinkSteps[index]]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

	return (
    <div className={`
      rounded-lg p-4 transition-all duration-300
      ${isThinking 
        ? 'bg-violet-50 dark:bg-violet-950/30' 
        : 'bg-green-50 dark:bg-green-950/30'
      }
    `}>
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {isThinking ? '思考步骤' : '完成'}
        </div>
        
        {isThinking && (
          <div className="flex gap-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="px-3 py-1 bg-violet-100 dark:bg-violet-900/50 rounded-full text-sm text-violet-700 dark:text-violet-300 animate-gentle-fade-in"
              >
                {step}
              </div>
            ))}
          </div>
        )}
        
        {!isThinking && (
          <div className="text-sm text-green-700 dark:text-green-300">
            所有步骤已完成 ✓
          </div>
        )}
			</div>
		</div>
	);
}

// 新增样式 46: 思考笔记
function ThinkBar46({ isThinking }: { isThinking: boolean }) {
  const [notes, setNotes] = useState<string[]>([]);
  const thinkNotes = [
    '📌 问题关键词：理解、分析、回答',
    '📝 思路：从基础概念出发',
    '💡 重点：确保逻辑清晰',
    '✍️ 准备：组织语言表达'
  ];
  
  useEffect(() => {
    if (isThinking) {
      setNotes([]);
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < thinkNotes.length) {
          setNotes((prev) => [...prev, thinkNotes[index]]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

  return (
    <div className={`
      rounded-lg p-4 border transition-all duration-300
      ${isThinking 
        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' 
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }
    `}>
      <div className="space-y-2">
        {isThinking && notes.map((note, i) => (
          <div key={i} className="text-sm text-amber-700 dark:text-amber-300 animate-gentle-fade-in">
            {note}
          </div>
        ))}
        
        {!isThinking && (
          <div className="text-sm text-green-700 dark:text-green-300">
            📋 笔记整理完成
          </div>
        )}
      </div>
    </div>
  );
}
