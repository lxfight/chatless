"use client";
import React from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { InputField } from "./InputField";
import { KeyRound, MoreHorizontal, SlidersHorizontal, Brain, Workflow, Camera, Pencil, Trash2 } from "lucide-react";
import type { ModelMetadata } from "@/lib/metadata/types";
import { toast } from "sonner";
import { getModelCapabilities } from "@/lib/provider/staticModels";

interface ProviderModelItemProps {
  providerName: string;
  model: ModelMetadata;
  showApiKeyFields: boolean;
  apiKeyValue: string;
  setApiKeyValue: (next: string) => void;
  onModelApiKeyChange: (modelName: string, apiKey: string) => void;
  onModelApiKeyBlur: (modelName: string) => void;
  onOpenParameters: (modelId: string, modelLabel?: string) => void;
  onRename: (modelName: string, nextLabel: string) => Promise<void>;
  canDelete: boolean;
  onDelete: () => Promise<void>;
  // 批量模式回显/设置策略
  showStrategyBadge?: boolean;
  strategy?: string | null;
  onStrategyChange?: (s: string | null) => void;
  allowStrategyActions?: boolean;
  allowDelete?: boolean;
}

export function ProviderModelItem(props: ProviderModelItemProps) {
  const {
    providerName,
    model,
    showApiKeyFields,
    apiKeyValue,
    setApiKeyValue,
    onModelApiKeyChange,
    onModelApiKeyBlur,
    onOpenParameters,
    onRename,
    canDelete,
    onDelete,
    showStrategyBadge,
    strategy,
    onStrategyChange,
    allowStrategyActions = true,
    allowDelete = true,
  } = props;

  return (
    <div className="w-full flex items-center gap-1.5 pl-1.5 border-l border-indigo-200/70 dark:border-indigo-700/70 py-0.5" style={{ paddingLeft: 5 }}>
      {/* 左侧：模型名与能力标记 */}
      <div className="flex flex-row items-center justify-start flex-auto min-w-0 pr-2 gap-1.5 text-[12px]">
        <button
          type="button"
          className="text-left text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate hover:bg-gray-100/60 dark:hover:bg-gray-800/60 rounded px-0.5"
          title={(model.label || model.name) + '（点击复制ID）'}
          onClick={async()=>{ try { await navigator.clipboard.writeText(model.name); toast.success('已复制模型 ID'); } catch { toast.error('复制失败'); } }}
        >
          {model.label || model.name}
        </button>

        {/* 能力图标 */}
        {(() => {
          const caps = getModelCapabilities(model.name);
          const items: Array<{ ok: boolean; Icon: any; title: string }> = [
            { ok: !!caps.supportsThinking, Icon: Brain, title: '支持思考/推理' },
            { ok: !!caps.supportsFunctionCalling, Icon: Workflow, title: '支持工具调用' },
            { ok: !!caps.supportsVision, Icon: Camera, title: '支持视觉' },
          ];
          return (
            <span className="inline-flex items-center gap-1 text-gray-400">
              {items.filter(i=>i.ok).map((i, idx) => (
                <i.Icon key={idx} className="w-3.5 h-3.5" title={i.title} />
              ))}
            </span>
          );
        })()}
        {/* 策略小徽标（仅批量模式展示） */}
        {showStrategyBadge && (
          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] border ${strategy? 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-300' : 'border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-400'}`}
            title={strategy ? `当前覆盖策略：${strategy}` : '使用 Provider 默认策略'}>
            {strategy || '默认'}
          </span>
        )}
      </div>

      {/* 右侧：输入与菜单，整体右对齐 */}
      <div className="ml-auto flex items-center gap-1">
        {/* 先放菜单按钮 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="min-w-[260px]">
            {/* 头部蓝色标题，显示当前模型 */}
            <div className="px-3 pt-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 text-xs font-medium">
                <span className="truncate max-w-[200px]" title={model.label || model.name}>{model.label || model.name}</span>
              </div>
            </div>

            <DropdownMenuItem className="text-xs" onSelect={(e:any)=>{ e?.preventDefault?.(); onOpenParameters(model.name, model.label); }}>
              <span className="inline-flex items-center gap-2 w-full"><SlidersHorizontal className="w-3.5 h-3.5" /> 参数</span>
            </DropdownMenuItem>
            {allowStrategyActions && (
              <div className="px-3 py-2">
                <label className="block text-xs text-gray-500 mb-1">请求策略</label>
                <div className="flex flex-wrap gap-1.5">
                  {['openai-compatible','openai-responses','openai','anthropic','gemini','deepseek'].map((s)=> (
                    <button key={s} className={`px-2 py-0.5 rounded border text-[11px] ${strategy===s? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
                      onClick={async(e)=>{ e.preventDefault(); try { const { specializedStorage } = await import('@/lib/storage'); await specializedStorage.models.setModelStrategy(providerName, model.name, s as any); onStrategyChange?.(s); toast.success('已更新策略'); } catch(err){ console.error(err); toast.error('更新策略失败'); } }}>
                      {s}
                    </button>
                  ))}
                  <button className="px-2 py-0.5 rounded border text-[11px] border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300" onClick={async(e)=>{ e.preventDefault(); try { const { specializedStorage } = await import('@/lib/storage'); await specializedStorage.models.removeModelStrategy(providerName, model.name); onStrategyChange?.(null); toast.success('已清除覆盖'); } catch(err){ console.error(err); toast.error('清除失败'); } }}>清除</button>
                </div>
              </div>
            )}
            {/* 重命名 */}
            <div className="px-2 py-1">
              {(() => {
                const { ProviderRenameModelDialog } = require('./ProviderRenameModelDialog');
                return (
                  <div className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Pencil className="w-3.5 h-3.5" />
                    <ProviderRenameModelDialog providerName={providerName} modelName={model.name} currentLabel={model.label} />
                  </div>
                );
              })()}
            </div>
            {canDelete && allowDelete && (
              <>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem variant="destructive" className="text-xs" onSelect={(e:any)=>e?.preventDefault?.()}>
                      <span className="inline-flex items-center gap-2 w-full"><Trash2 className="w-3.5 h-3.5" /> 删除模型</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除该模型？</AlertDialogTitle>
                      <AlertDialogDescription>该操作仅删除本地配置中的“用户新增模型”条目，不会影响远端服务。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>确认删除</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 再放输入框 */}
        {showApiKeyFields && (
          <InputField
            label=""
            type="password"
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            onBlur={() => { onModelApiKeyChange(model.name, apiKeyValue || ''); onModelApiKeyBlur(model.name); }}
            placeholder="模型 API Key (可选)"
            className="h-7 text-xs w-40"
            wrapperClassName="mb-0 flex-shrink-0"
            icon={<KeyRound className="w-3 h-3 text-gray-400" />}
          />
        )}
      </div>
    </div>
  );
}

