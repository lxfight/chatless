"use client";

import React, { useState, useEffect, useRef } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SettingsSectionHeader } from "./SettingsSectionHeader";
// import { ModelCard } from "./ModelCard"; // 不再使用 ModelCard
import { ProviderTableRow } from "./ProviderTableRow";
import { ServerCog, RotateCcw, GripVertical, ChevronRight, Settings, Search } from "lucide-react";
// 导入新模块
/* Commenting out for now due to persistent linter error
import {
  getMergedMetadata,
  ProviderMetadata,
  ModelMetadata,
  updateProviderUrlOverride,
  updateProviderDefaultApiKeyOverride,
  updateModelApiKeyOverride,
  updateOllamaModelsCache,
*/
import { toast } from "@/components/ui/sonner";
// Input 移除，头部使用自定义 SearchInput
import { SearchInput } from "@/components/ui/SearchInput";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
// 不再需要直接导入 tauriFetch
// import { fetch as tauriFetch } from '@tauri-apps/plugin-http'; 
// import { useProviderStatusStore } from '@/store/providerStatusStore'; // <-- 已修改路径
// 导入新的 Hook 和类型
import { useProviderManagement, ProviderWithStatus } from '@/hooks/useProviderManagement';
import { cn } from "@/lib/utils"; // Assuming cn is used somewhere or will be
import { AddProvidersDialog } from './AddProvidersDialog';
import { Button } from '@/components/ui/button';
// 头部过滤器已内化到表头，无需 Select 组件
// duplicate import removed

// 添加一个包含连接状态的 Provider 类型
// 导出接口，以便其他组件可以使用
// export interface ProviderWithStatus extends ProviderMetadata {
//   isConnected?: boolean; // 连接状态是可选的，初始可能未知
//   // 添加用于显示的状态和 tooltip
//   displayStatus?: 'CONNECTED' | 'CONNECTING' | 'NOT_CONNECTED' | 'NO_KEY' | 'UNKNOWN' | 'NO_FETCHER'; // <-- 添加 NO_FETCHER
//   statusTooltip?: string | null;
// }

export function AiModelSettings() {
  // 使用自定义 Hook 获取状态和处理函数
  const {
    providers,
    isLoading,
    isRefreshing,
    handleServiceUrlChange,
    handleProviderDefaultApiKeyChange,
    handleModelApiKeyChange,
    handleGlobalRefresh,
    handleSingleProviderRefresh,
    handlePreferenceChange
  } = useProviderManagement();

  // 新增：失焦时保存/连接 API Key
  const handleDefaultApiKeyBlur = async (_providerName: string) => {
    // 这里可以根据需要添加保存/连接逻辑，或直接复用 handleProviderDefaultApiKeyChange
    // 由于 onBlur 时已调用 change，这里可用于额外的校验或提示
    // 可留空或补充日志
  };
  const handleModelApiKeyBlur = async (_modelName: string) => {
    // 这里可以根据需要添加保存/连接逻辑，或直接复用 handleModelApiKeyChange
    // 可留空或补充日志
  };

  // 添加 Provider 入口由对话框承载

  
  // Helper function to render the action buttons
  // 底部按钮已移除

  // 搜索与过滤 state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all'|'recently_checked'|'needs_key'|'never_checked'>('all');
  const [headSearchOpen, setHeadSearchOpen] = useState(false);
  // 如需更新 provider 配置请从 store 调用，当前未使用

  // 计算各状态的数量
  // 头部上下箭头切换，不再显示数量面板

  const filteredProviders = providers.filter((p: ProviderWithStatus) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (p.displayName || p.name).toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    const matchesStatus = (() => {
      switch (statusFilter) {
        case 'recently_checked':
          // 最近检查：24小时内检查过
          return p.lastCheckedAt && p.lastCheckedAt > Date.now() - 24 * 60 * 60 * 1000;
        case 'needs_key':
          // 未配置密钥
          return p.configStatus === 'NO_KEY';
        case 'never_checked':
          // 未检查过：从未检查过
          return !p.lastCheckedAt;
        case 'all':
        default:
          return true;
      }
    })();
    return matchesSearch && matchesStatus;
  });

  // —— 拖拽排序：保存用户顺序 ——
  const [localList, setLocalList] = useState<ProviderWithStatus[]>(filteredProviders);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 由父级维护每个 provider 的展开状态，避免因列表刷新而丢失
  const [providerOpenMap, setProviderOpenMap] = useState<Record<string, boolean>>({});
  // 仅在筛选/源数据长度或集合变化时同步，避免每次 render 都触发 setState
  const lastSyncRef = useRef<string>("");
  useEffect(() => {
    // 更细的签名：当名称、默认密钥、URL、模型数量或显示状态变化时，同步到本地列表
    // 移除模型数量对父级列表同步的影响，避免新增模型时整个列表重建导致的折叠/滚动跳动
    const key = filteredProviders
      .map(p => `${p.name}:${p.displayName || ''}:${p.default_api_key ? '1' : '0'}:${p.api_base_url || ''}:${p.displayStatus || ''}`)
      .join('|');
    if (lastSyncRef.current !== key) {
      lastSyncRef.current = key;
      setLocalList(filteredProviders);
    }
  }, [filteredProviders]);

  // dnd-kit 传感器
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
  };

  const handleDragEnd = React.useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localList.findIndex((p: ProviderWithStatus) => p.name === active.id);
    const newIndex = localList.findIndex((p: ProviderWithStatus) => p.name === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(localList, oldIndex, newIndex);
    setLocalList(next);
    setActiveId(null);
    try {
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      await providerRepository.setUserOrder(next.map((p: ProviderWithStatus)=>p.name));
      toast.success('已保存自定义排序');
    } catch (e) {
      console.error(e);
      toast.error('保存排序失败');
    }
  }, [localList]);

  // 保持 DndContext 依赖长度稳定
  const handleDragMove = React.useCallback(() => {}, []);
  const handleDragOverEvt = React.useCallback(() => {}, []);
  const handleDragCancel = React.useCallback(() => { setActiveId(null); }, []);

  // Sortable item with手柄
  function SortableProviderItem({ provider, children }: { provider: ProviderWithStatus; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: provider.name });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };
    // 由顶层 openMap 控制展开态，默认折叠
    return (
      <div ref={setNodeRef} style={style} className={"group transition-shadow duration-200 "+(isDragging?"shadow-lg ring-1 ring-blue-300/60 rounded-lg scale-[0.998]":"") }>
        <div className="relative">
          {/* 竖向吸附把手：折叠时显示，展开后隐藏 */}
          {!providerOpenMap[provider.name] && (
            <button
              aria-label="拖拽排序"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 cursor-grab active:cursor-grabbing text-gray-400/80 hover:text-gray-600 dark:text-gray-400/90 dark:hover:text-gray-200"
              {...attributes} {...listeners}
            >
              <svg viewBox="0 0 6 24" width="6" height="24" fill="currentColor" aria-hidden>
                <circle cx="3" cy="3" r="1"></circle>
                <circle cx="3" cy="9" r="1"></circle>
                <circle cx="3" cy="15" r="1"></circle>
                <circle cx="3" cy="21" r="1"></circle>
              </svg>
            </button>
          )}
          <div className="flex-1 p-1">
            {React.cloneElement(children as any, {
              open: providerOpenMap[provider.name] ?? false,
              onOpenChange: (open: boolean) => setProviderOpenMap((m)=>({ ...m, [provider.name]: open }))
            })}
          </div>
        </div>
      </div>
    );
  }

  // 进度条功能已移除，可在此处实现统计逻辑

  // --- 渲染逻辑 ---
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SettingsSectionHeader
          icon={ServerCog}
          title="管理提供商"
          iconBgColor="from-purple-500 to-indigo-500"
        />

        {/* 操作栏：保留右侧操作按钮，仅移除上方搜索与筛选 */}
        <div className='flex justify-end'>
        <div className="flex items-center gap-3">
            {/* 刷新按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGlobalRefresh}
              disabled={isRefreshing || isLoading}
              className="h-9 px-4 text-sm font-medium border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 group"
            >
              <RotateCcw className={cn("w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200", isRefreshing && 'animate-spin')} />
              刷新
            </Button>
            
            {/* 添加提供商按钮 */}
            <AddProvidersDialog
              trigger={
             

<button
className="w-10 h-10 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center"
>
<Settings className="w-5 h-5" />
                </button>

              }
            />
          </div>
        </div>


      {/* Provider 列表 - 去卡片化设计 */}
      <div className="mt-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* 表头优化：列名与内容对齐；状态列使用下拉；“提供商”列点击图标再展开搜索 */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-12 gap-4 items-center text-[13px] font-medium text-gray-600 dark:text-gray-400">
            <div className="col-span-1" />
            <div className="col-span-6 flex items-center">
              <span>提供商</span>
              <div className="ml-2 h-7 flex items-center">
                {headSearchOpen ? (
                  <div className="w-56 h-full flex items-center">
                    <SearchInput
                      value={searchQuery}
                      onChange={(e)=>setSearchQuery(e.target.value)}
                      placeholder="搜索提供商"
                      variant="withIcon"
                      allowClear
                      autoFocus
                      className="h-7"
                      onBlur={()=>{ if (!searchQuery) setHeadSearchOpen(false); }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={()=>setHeadSearchOpen(true)}
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="搜索提供商"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-span-3 flex items-center">
              <span>状态</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-2 px-2 h-6 rounded-md border border-gray-300 dark:border-gray-600 text-xs bg-white/70 dark:bg-gray-700/70 hover:bg-gray-100 dark:hover:bg-gray-700">
                    {statusFilter === 'all' && '全部'}
                    {statusFilter === 'recently_checked' && '最近检查'}
                    {statusFilter === 'needs_key' && '未配置密钥'}
                    {statusFilter === 'never_checked' && '未检查过'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-28">
                  <DropdownMenuItem onClick={()=>setStatusFilter('all')}>全部</DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>setStatusFilter('recently_checked')}>最近检查</DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>setStatusFilter('needs_key')}>未配置密钥</DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>setStatusFilter('never_checked')}>未检查过</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="col-span-2">操作</div>
          </div>
        </div>

        {/* 表格内容 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragOver={handleDragOverEvt} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}>
          <SortableContext items={localList.map((p: ProviderWithStatus)=>p.name)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-gray-200/60 dark:divide-gray-700/50">
              {localList.map((provider, index) => (
                <SortableProviderItem key={provider.name} provider={provider}>
                  <ProviderTableRow
                    provider={provider}
                    _index={index}
                    isConnecting={provider.displayStatus === 'CONNECTING'}
                    isInitialChecking={isLoading}
                    onUrlChange={(name, url) => handleServiceUrlChange(name, url)}
                    onDefaultApiKeyChange={(name, key) => handleProviderDefaultApiKeyChange(name, key)}
                    onDefaultApiKeyBlur={handleDefaultApiKeyBlur}
                    onModelApiKeyChange={(modelName, apiKey) => handleModelApiKeyChange(provider.name, modelName, apiKey)}
                    onModelApiKeyBlur={handleModelApiKeyBlur}
                    onRefresh={handleSingleProviderRefresh}
                    onPreferenceChange={handlePreferenceChange}
                  />
                </SortableProviderItem>
              ))}
            </div>
          </SortableContext>
          
          {/* 拖拽中的跟随行（半透明、悬浮） */}
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeId ? (
              <div className="opacity-70 scale-[0.98] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                <div className="px-4 py-3">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1 flex items-center gap-2">
                      <div className="cursor-grabbing text-gray-400 dark:text-gray-500">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700"></div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {(() => {
                            const item = localList.find(p=>p.name===activeId);
                            return item?.displayName || item?.name || '';
                          })()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {localList.find(p=>p.name===activeId)?.models?.length || 0} 个模型
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-gray-400 dark:text-gray-500">从未检查</span>
                    </div>
                    <div className="col-span-1 flex items-center gap-1">
                      <div className="w-8 h-8"></div>
                      <div className="w-8 h-8"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* 空状态提示 */}
        {providers.length === 0 && !isLoading && (
          <div className="px-4 py-8 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              <ServerCog className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium mb-1">暂无提供商</p>
              <p className="text-sm">点击右上角"添加提供商"开始配置</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
} 