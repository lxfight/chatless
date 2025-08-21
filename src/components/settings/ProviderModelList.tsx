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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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

  // 批量策略入口对所有 Provider 可见（便于统一批量覆盖）
  const isMultiStrategyProvider = true;

  // —— 批量策略设置（轻量） ——
  const [batchMode, setBatchMode] = React.useState(false);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [batchStrategy, setBatchStrategy] = React.useState<'openai'|'openai-responses'|'openai-compatible'|'anthropic'|'gemini'|'deepseek'>('openai-compatible');
  const [strategyMap, setStrategyMap] = React.useState<Record<string, string | null>>({});

  const toggleChecked = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const setAll = (ids: string[], v: boolean) => setChecked(prev => ({ ...prev, ...Object.fromEntries(ids.map(i => [i, v])) }));

  const applyBatch = async (overrideStrategy?: string) => {
    try {
      const ids = Object.keys(checked).filter(k => checked[k]);
      if (ids.length === 0) { toast.error('请先选择模型'); return; }
      const { specializedStorage } = await import('@/lib/storage');
      const value = (overrideStrategy || batchStrategy) as any;
      await Promise.all(ids.map(id => specializedStorage.models.setModelStrategy(props.provider.name, id, value)));
      setStrategyMap(prev => ({ ...prev, ...Object.fromEntries(ids.map(id => [id, value])) }));
      toast.success(`已为 ${ids.length} 个模型设置策略`);
    } catch (e) {
      console.error(e);
      toast.error('批量设置失败');
    }
  };

  const clearBatch = async () => {
    try {
      const ids = Object.keys(checked).filter(k => checked[k]);
      if (ids.length === 0) { toast.error('请先选择模型'); return; }
      const { specializedStorage } = await import('@/lib/storage');
      await Promise.all(ids.map(id => specializedStorage.models.removeModelStrategy(props.provider.name, id)));
      setStrategyMap(prev => ({ ...prev, ...Object.fromEntries(ids.map(id => [id, null])) }));
      toast.success(`已清除 ${ids.length} 个模型的策略覆盖`);
    } catch (e) {
      console.error(e);
      toast.error('清除覆盖失败');
    }
  };

  // 载入策略覆盖，用于回显
  React.useEffect(() => {
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        const map: Record<string, string | null> = {};
        for (const m of modelsForDisplay) {
          map[m.name] = await specializedStorage.models.getModelStrategy(provider.name, m.name);
        }
        setStrategyMap(map);
      } catch (e) { console.warn(e); }
    })();
  }, [provider.name, modelsForDisplay]);

  const renderItem = (model: ModelMetadata) => (
    <div key={model.name} className="flex items-center gap-2 w-full">
      {batchMode && (
        <Checkbox checked={!!checked[model.name]} onCheckedChange={()=>toggleChecked(model.name)} className="h-3.5 w-3.5" />
      )}
      <div className="flex-1 min-w-0">
      <ProviderModelItem
      providerName={provider.name}
      model={model}
      showApiKeyFields={showApiKeyFields}
      apiKeyValue={localModelApiKeys[model.name] || ''}
      setApiKeyValue={(v) => setLocalModelApiKeys(prev => ({ ...prev, [model.name]: v }))}
      onModelApiKeyChange={onModelApiKeyChange}
      onModelApiKeyBlur={onModelApiKeyBlur}
      onOpenParameters={onOpenParameters}
      showStrategyBadge={batchMode}
      strategy={strategyMap[model.name] || null}
      onStrategyChange={(s: string | null)=>setStrategyMap(prev => ({ ...prev, [model.name]: s }))}
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
    </div>
    </div>
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
        <div className="flex items-center gap-2">
          {isMultiStrategyProvider && (
            <Button variant="outline" className="h-7 px-2 text-xs" onClick={()=>setBatchMode(v=>!v)}>{batchMode? '退出批量' : '批量设置策略'}</Button>
          )}
          {isMultiStrategyProvider && batchMode && (
            <>
              <Select value={batchStrategy} onValueChange={(v:any)=>{ if (v === '__clear__') { const anyChecked = Object.values(checked).some(Boolean); if (anyChecked) { void clearBatch(); } return; } setBatchStrategy(v); const anyChecked = Object.values(checked).some(Boolean); if (anyChecked) { void applyBatch(v); } }}>
                <SelectTrigger className="w-56 h-7 text-xs"><SelectValue placeholder="选择策略"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-compatible" className="text-xs">OpenAI Compatible (/v1/chat/completions)</SelectItem>
                  <SelectItem value="openai-responses" className="text-xs">OpenAI Responses (/v1/responses)</SelectItem>
                  <SelectItem value="openai" className="text-xs">OpenAI Strict</SelectItem>
                  <SelectItem value="anthropic" className="text-xs">Anthropic (messages)</SelectItem>
                  <SelectItem value="gemini" className="text-xs">Google Gemini (generateContent)</SelectItem>
                  <SelectItem value="deepseek" className="text-xs">DeepSeek (chat/completions)</SelectItem>
                  <SelectItem value="__clear__" className="text-xs text-red-600">清除覆盖（恢复默认）</SelectItem>
                </SelectContent>
              </Select>
              <Button className="h-7 px-3 text-xs" onClick={() => applyBatch()}>应用到选中</Button>
              <Button variant="secondary" className="h-7 px-3 text-xs" onClick={clearBatch}>清除覆盖</Button>
              <Button variant="ghost" className="h-7 px-2 text-[11px]" onClick={()=>setAll(modelsForDisplay.map(m=>m.name), true)}>全选</Button>
              <Button variant="ghost" className="h-7 px-2 text-[11px]" onClick={()=>setChecked({})}>清空</Button>
            </>
          )}
          <ProviderAddModelDialog providerName={provider.name} onAdded={() => setModelSearch('')} />
        </div>
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

