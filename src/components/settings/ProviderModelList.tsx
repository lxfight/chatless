"use client";
import React from "react";
import type { ModelMetadata } from "@/lib/metadata/types";
import type { ProviderWithStatus } from "@/hooks/useProviderManagement";
import { Input } from "@/components/ui/input";
import { ProviderAddModelDialog } from "./ProviderAddModelDialog";
import { Brain, Workflow, Camera } from "lucide-react";
import { getModelCapabilities } from "@/lib/provider/staticModels";
import { ProviderModelItem } from "./ProviderModelItem";
import { toast } from "sonner";

interface ProviderModelListProps {
  provider: ProviderWithStatus;
  modelsForDisplay: ModelMetadata[];
  modelSearch: string;
  setModelSearch: (v: string) => void;
  showApiKeyFields: boolean;
  localModelApiKeys: Record<string, string>;
  setLocalModelApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onModelApiKeyChange: (modelName: string, apiKey: string) => void;
  onModelApiKeyBlur: (modelName: string) => void;
  onOpenParameters: (modelId: string, modelLabel?: string) => void;
}

export function ProviderModelList(props: ProviderModelListProps) {
  const {
    provider, modelsForDisplay, modelSearch, setModelSearch,
    showApiKeyFields, localModelApiKeys, setLocalModelApiKeys,
    onModelApiKeyChange, onModelApiKeyBlur, onOpenParameters,
  } = props;

  const renderItem = (model: ModelMetadata) => (
    <ProviderModelItem
      key={model.name}
      providerName={provider.name}
      model={model}
      showApiKeyFields={showApiKeyFields}
      apiKeyValue={localModelApiKeys[model.name] || ''}
      setApiKeyValue={(v) => setLocalModelApiKeys(prev => ({ ...prev, [model.name]: v }))}
      onModelApiKeyChange={onModelApiKeyChange}
      onModelApiKeyBlur={onModelApiKeyBlur}
      onOpenParameters={onOpenParameters}
      onRename={async (modelName, nextLabelRaw) => {
        const nextLabel = (nextLabelRaw || '').trim();
        if (!nextLabel) { toast.error('名称不可为空'); return; }
        const { modelRepository } = await import('@/lib/provider/ModelRepository');
        const { specializedStorage } = await import('@/lib/storage');
        const list = (await modelRepository.get(provider.name)) || [];
        const updated = list.map((m: any) => (m.name === modelName ? { ...m, label: nextLabel } : m));
        await modelRepository.save(provider.name, updated);
        await specializedStorage.models.setModelLabel(provider.name, modelName, nextLabel);
        toast.success('已重命名', { description: nextLabel });
      }}
      canDelete={(() => {
        const { getStaticModels } = require('@/lib/provider/staticModels');
        const staticList = getStaticModels(provider.name) || getStaticModels((provider as any).aliases?.[0] || provider.name) || [];
        const isStatic = staticList.some((m: any) => m.id === model.name);
        return !isStatic;
      })()}
      onDelete={async () => {
        const { modelRepository } = await import('@/lib/provider/ModelRepository');
        const list = (await modelRepository.get(provider.name)) || [];
        const next = list.filter((m: any) => m.name !== model.name);
        await modelRepository.save(provider.name, next);
        toast.success('已删除模型', { description: model.name });
      }}
    />
  );

  const [filterThinking, setFilterThinking] = React.useState(false);
  const [filterTools, setFilterTools] = React.useState(false);
  const [filterVision, setFilterVision] = React.useState(false);

  // —— 分页 ——
  const PAGE_SIZE = 20;
  const [page, setPage] = React.useState(1);

  React.useEffect(() => { setPage(1); }, [modelSearch, filterThinking, filterTools, filterVision, modelsForDisplay, provider.name]);

  // —— 归类 ——
  const SERIES_ORDER = [
    'Gemini', 'GPT', 'DeepSeek', 'Qwen', 'Grok', 'Claude', 'LLaMA', 'Mistral', 'GLM', 'Gemma', 'Kimi', 'Moonshot', 'Yi'
  ] as const;
  type Series = typeof SERIES_ORDER[number] | '未归类';

  const detectSeries = (model: ModelMetadata): Series => {
    const s = `${model?.name || ''} ${model?.label || ''}`.toLowerCase();

    // 更宽松的匹配，允许匹配到更多变体
    if (s.includes('gemini')) return 'Gemini';
    if (s.includes('gpt') || s.includes('openai')) return 'GPT';
    if (s.includes('deepseek')) return 'DeepSeek';
    if (s.includes('qwen')) return 'Qwen';
    if (s.includes('grok')) return 'Grok';
    if (s.includes('claude') || s.includes('anthropic')) return 'Claude';
    if (
      s.includes('llama') ||
      s.includes('llama2') ||
      s.includes('llama-2') ||
      s.includes('llama3') ||
      s.includes('llama-3')
    ) return 'LLaMA';
    if (s.includes('mistral') || s.includes('mixtral') || s.includes('pixtral') || s.includes('codestral')) return 'Mistral';
    if (s.includes('glm') || s.includes('chatglm')) return 'GLM';
    if (
      s.includes('gemma') ||
      s.includes('gemma2') // 支持 gemma2-9b-it 这类
    ) return 'Gemma';
    if (s.includes('kimi')) return 'Kimi';
    if (s.includes('moonshot')) return 'Moonshot';
    if (s.includes('yi')) return 'Yi';
    return '未归类';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between my-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={()=>setFilterThinking(v=>!v)} className={`p-1 h-6 w-6 rounded-md flex items-center justify-center ${filterThinking? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`} title="仅显示支持思考的模型"><Brain className="w-3.5 h-3.5"/></button>
            <button type="button" onClick={()=>setFilterTools(v=>!v)} className={`p-1 h-6 w-6 rounded-md flex items-center justify-center ${filterTools? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`} title="仅显示支持工具调用的模型"><Workflow className="w-3.5 h-3.5"/></button>
            <button type="button" onClick={()=>setFilterVision(v=>!v)} className={`p-1 h-6 w-6 rounded-md flex items-center justify-center ${filterVision? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`} title="仅显示支持视觉的模型"><Camera className="w-3.5 h-3.5"/></button>
          </div>
          <Input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="输入以筛选模型…" className="h-8 text-sm w-64" />
        </div>
        <ProviderAddModelDialog providerName={provider.name} onAdded={() => setModelSearch('')} />
      </div>

      <div className="space-y-3">
        {modelsForDisplay && modelsForDisplay.length > 0 ? (
          (() => {
            const filtered = modelsForDisplay.filter((m) => {
              const textOk = (m.label || m.name || '').toLowerCase().includes(modelSearch.toLowerCase());
              if (!textOk) return false;
              if (!filterThinking && !filterTools && !filterVision) return true;
              const caps = getModelCapabilities(m.name);
              if (filterThinking && !caps.supportsThinking) return false;
              if (filterTools && !caps.supportsFunctionCalling) return false;
              if (filterVision && !caps.supportsVision) return false;
              return true;
            });

            const total = filtered.length;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const safePage = Math.min(Math.max(1, page), totalPages);
            const start = (safePage - 1) * PAGE_SIZE;
            const pageItems = filtered.slice(start, start + PAGE_SIZE);

            const groups = new Map<Series, ModelMetadata[]>();
            for (const x of pageItems) {
              const series = detectSeries(x);
              if (!groups.has(series)) groups.set(series, []);
              groups.get(series)!.push(x);
            }

            const orderedSeries: Series[] = [...SERIES_ORDER, '未归类'];

            return (
              <>
                {/* 分页控件 */}
                <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                  <span>共 {total} 个模型</span>
                  <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</button>
                  <span>{safePage}/{totalPages}</span>
                  <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>下一页</button>
                </div>

                {/* 分组渲染 */}
                {orderedSeries.map(series => {
                  const list = groups.get(series) || [];
                  if (list.length === 0) return null;
                  return (
                    <div key={series} className="mt-2">
                      <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">{series}</div>
                      <div className="space-y-2">
                        {list.map(renderItem)}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 py-2 pl-2">
            {provider.models && provider.models.length === 0
              ? (provider.displayStatus === 'CONNECTING' ? '正在加载模型...' : '未找到可用模型。')
              : (provider.displayStatus === 'NO_KEY' ? '已显示已知/静态模型。配置 API 密钥后可拉取最新模型。' : '')}
          </p>
        )}
      </div>
    </div>
  );
}

