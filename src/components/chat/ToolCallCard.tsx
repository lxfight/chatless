"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { serverManager } from '@/lib/mcp/ServerManager';
import { useChatStore } from '@/store/chatStore';

type ToolCallStatus = 'success' | 'error' | 'running';

interface ToolCallCardProps {
  server: string;
  tool: string;
  status: ToolCallStatus;
  args?: Record<string, unknown>;
  resultPreview?: string;
  errorMessage?: string;
  schemaHint?: string; // e.g. required keys or example JSON
  messageId?: string; // enable inline retry when present
}

export function ToolCallCard({ server, tool, status, args, resultPreview, errorMessage, schemaHint, messageId }: ToolCallCardProps) {
  const canRetry = !!messageId && !!server && !!tool;
  const [open, setOpen] = React.useState(status === 'error');
  React.useEffect(() => {
    if (status === 'error') setOpen(true);
  }, [status]);

  const retry = async () => {
    if (!canRetry) return;
    // 标记为运行中
    try {
      useChatStore.getState().updateMessage(messageId!, {
        content: JSON.stringify({ __tool_call_card__: { status: 'running', server, tool, args: args || {} , messageId } })
      });
    } catch {}
    try {
      const result = await serverManager.callTool(server, tool, (args as any) || undefined);
      const preview = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 2000);
      useChatStore.getState().updateMessage(messageId!, {
        status: 'sent',
        content: JSON.stringify({ __tool_call_card__: { status: 'success', server, tool, args: args || {}, resultPreview: preview, messageId } })
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useChatStore.getState().updateMessage(messageId!, {
        status: 'error',
        content: JSON.stringify({ __tool_call_card__: { status: 'error', server, tool, args: args || {}, errorMessage: msg, messageId } })
      });
    }
  };
  return (
    <div className={cn(
      'w-full max-w-full rounded-md border text-sm overflow-hidden',
      status === 'error' ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10' :
      status === 'running' ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10' :
      'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/30'
    )}>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800">
        <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]">@</span>
        <button onClick={()=>setOpen(o=>!o)} className="font-medium truncate hover:underline">{server}</button>
        <span className="text-slate-400">·</span>
        <span className="font-mono text-[12px] truncate">{tool}</span>
        <span className={cn('ml-auto text-[11px] px-1.5 py-0.5 rounded',
          status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
          status === 'running' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        )}>{status === 'running' ? '调用中' : status === 'success' ? '调用成功' : '调用失败'}</span>
        {canRetry && (
          <button onClick={retry} className="ml-2 text-[11px] px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">重试</button>
        )}
      </div>
      {open && args && Object.keys(args).length > 0 && (
        <div className="px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
          <div className="mb-1 font-medium">参数</div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[12px]">{JSON.stringify(args, null, 2)}</pre>
        </div>
      )}
      {open && status === 'success' && resultPreview && (
        <div className="px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
          <div className="mb-1 font-medium">结果预览</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[12px]">{resultPreview}</pre>
        </div>
      )}
      {open && status === 'error' && (
        <div className="px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          <div className="mb-1 font-medium">错误</div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-[12px]">{errorMessage || '未知错误'}</pre>
          {schemaHint && (
            <div className="mt-2 text-[12px] text-slate-600 dark:text-slate-300">
              <div className="mb-1 font-medium">纠错提示</div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[12px]">{schemaHint}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

