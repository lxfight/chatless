"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { useAuthorizationStore } from '@/store/authorizationStore';
// 不再在卡片内部触发重试逻辑

type ToolCallStatus = 'success' | 'error' | 'running' | 'pending_auth';

interface ToolCallCardProps {
  server: string;
  tool: string;
  status: ToolCallStatus;
  args?: Record<string, unknown>;
  resultPreview?: string;
  errorMessage?: string;
  schemaHint?: string; // e.g. required keys or example JSON
  messageId?: string; // enable inline retry when present
  cardId?: string; // 用于授权管理
}

export function ToolCallCard({ server, tool, status, args, resultPreview, errorMessage, schemaHint, cardId }: ToolCallCardProps) {
  // 默认不用展开所有状态的卡片
  const [open, setOpen] = React.useState(false);
  const { approveAuthorization, rejectAuthorization, hasPendingAuthorization } = useAuthorizationStore();
  
  // 检查是否有待授权请求
  // 当 errorMessage 是 'pending_auth' 时，也视为等待授权状态
  const isPendingAuth = status === 'pending_auth' || errorMessage === 'pending_auth' || (cardId && hasPendingAuthorization(cardId));

  // 当状态变化时，确保卡片保持展开
  // React.useEffect(() => {
  //   if (status === 'error' || status === 'success') {
  //     setOpen(true);
  //   }
  // }, [status]);
  
  // 处理授权批准
  const handleApprove = React.useCallback(() => {
    if (cardId) {
      approveAuthorization(cardId);
    }
  }, [cardId, approveAuthorization]);
  
  // 处理授权拒绝
  const handleReject = React.useCallback(() => {
    if (cardId) {
      rejectAuthorization(cardId);
    }
  }, [cardId, rejectAuthorization]);
  
  return (
    <div className={cn(
      // 固定卡片最大宽度，防止随思考栏文本宽度变化
      'w-full rounded-xl border text-sm overflow-hidden backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/50 transition-all duration-300 hover:shadow-lg',
      status === 'error' ? 'border-red-300/60 bg-gradient-to-br from-red-50/60 to-red-100/40 dark:border-red-900/50 dark:from-red-950/30 dark:to-red-900/20 shadow-md shadow-red-200/30 dark:shadow-red-950/30' :
      isPendingAuth ? 'border-yellow-300/60 bg-gradient-to-br from-yellow-50/60 to-amber-50/40 dark:border-yellow-900/50 dark:from-yellow-950/30 dark:to-amber-950/20 shadow-md shadow-yellow-200/30 dark:shadow-yellow-950/30 ring-1 ring-yellow-300/20 dark:ring-yellow-700/20' :
      status === 'running' ? 'border-blue-300/60 bg-gradient-to-br from-blue-50/60 to-cyan-50/40 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-cyan-950/20 shadow-md shadow-blue-200/30 dark:shadow-blue-950/30' :
      'border-green-300/60 bg-gradient-to-br from-green-50/60 to-emerald-50/40 dark:border-green-900/50 dark:from-green-950/30 dark:to-emerald-950/20 shadow-md shadow-green-200/30 dark:shadow-green-950/30'
    )}>
      <div className="px-3.5 py-2.5 flex items-center gap-2.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/20">
        <span className="px-1.5 py-0.5 rounded-md border border-emerald-300/70 bg-emerald-50/80 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold shadow-sm">@</span>
        <button onClick={()=>setOpen(o=>!o)} className="cursor-pointer font-semibold truncate hover:underline text-slate-800 dark:text-slate-200 transition-colors">{server}</button>
        <span className="text-slate-400 dark:text-slate-600">·</span>
        <span className="font-mono text-[12px] truncate text-slate-700 dark:text-slate-300 font-medium">{tool}</span>
        {/* 授权按钮：仅在等待授权时显示 */}
        {isPendingAuth && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={handleApprove}
              className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-95"
              title="授权执行"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              <span className="text-[11px] text-white font-semibold">确认</span>
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-95"
              title="拒绝执行"
            >
              <X className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">取消</span>
            </button>
            <div className="relative flex items-center justify-center w-2 h-2" title="等待授权">
              <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500 shadow-sm" />
            </div>
          </div>
        )}
        {/* 状态指示器：执行中用蓝色点，成功用对号，失败用X */}
        {!isPendingAuth && (
          <div className="ml-auto flex items-center gap-1.5">
            {/* 执行中：蓝色圆点动画 */}
            {status === 'running' && (
              <div className="relative flex items-center justify-center w-2 h-2" title="调用中...">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </div>
            )}
            {/* 成功：绿色对号 */}
            {status === 'success' && (
              <div title="调用成功">
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              </div>
            )}
            {/* 失败：红色X */}
            {status === 'error' && (
              <div title="调用失败">
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>
        )}
      </div>
      {/* 参数显示：所有状态下都显示（running/success/error） */}
      {open && args && Object.keys(args).length > 0 && (
        <div className="px-3.5 py-2.5 text-[12px] text-slate-700 dark:text-slate-300">
          <div className="mb-1.5 font-semibold text-slate-800 dark:text-slate-200">参数</div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[12px] bg-slate-100/50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200/50 dark:border-slate-800/50">{JSON.stringify(args, null, 2)}</pre>
        </div>
      )}
      {/* 结果显示：仅成功状态显示 */}
      {open && status === 'success' && resultPreview && (
        <div className="px-3.5 py-2.5 text-[12px] text-slate-700 dark:text-slate-300 border-t border-slate-200/70 dark:border-slate-800/70">
          <div className="mb-1.5 font-semibold text-slate-800 dark:text-slate-200">结果</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[12px] bg-slate-100/50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200/50 dark:border-slate-800/50">{resultPreview}</pre>
        </div>
      )}
      {open && status === 'error' && (
        <div className="px-3.5 py-2.5 text-[12px] text-red-800 dark:text-red-300">
          <div className="mb-1.5 font-semibold flex items-center gap-2">
            <span>错误信息</span>
            <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md font-semibold shadow-sm">自动重试中...</span>
          </div>
          <div className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-[12px] bg-red-50/70 dark:bg-red-950/30 rounded-lg p-2.5 border border-red-200/70 dark:border-red-900/50">
            {errorMessage || '未知错误'}
          </div>
          {schemaHint && (
            <div className="mt-3 text-[12px] text-slate-700 dark:text-slate-300">
              <div className="mb-1.5 font-semibold text-slate-800 dark:text-slate-200">修复建议</div>
              <div className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[12px] bg-slate-100/50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200/50 dark:border-slate-800/50">
                {schemaHint}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

