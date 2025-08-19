"use client";
import React from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { InputField } from "./InputField";
import { KeyRound, MoreHorizontal, SlidersHorizontal, Brain, Workflow, Camera } from "lucide-react";
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
  } = props;

  return (
    <div className="flex items-center gap-1.5 pl-1.5 border-l border-indigo-200/70 dark:border-indigo-700/70 py-0.5" style={{ paddingLeft: 5 }}>
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
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="min-w-[180px]">
          <DropdownMenuItem onSelect={(e:any)=>{ e?.preventDefault?.(); onOpenParameters(model.name, model.label); }}>
            <span className="inline-flex items-center gap-2 text-[12px]"><SlidersHorizontal className="w-3.5 h-3.5" /> 参数</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={async(e:any)=>{ e?.preventDefault?.(); const next = prompt('输入新的名称', model.label || ''); if (next!==null) await onRename(model.name, next); }}>重命名</DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem variant="destructive" onSelect={(e:any)=>e?.preventDefault?.()}>删除模型</DropdownMenuItem>
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
  );
}

