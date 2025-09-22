"use client";
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AVAILABLE_PROVIDERS_CATALOG, CatalogStrategy } from '@/lib/provider/catalog';
import { providerRepository } from '@/lib/provider/ProviderRepository';
import { ProviderStatus } from '@/lib/provider/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { toast } from '@/components/ui/sonner';
// import { syncDynamicProviders } from '@/lib/llm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateAvatarDataUrl } from '@/lib/avatar';
// import { getStaticModels, type ProviderName } from '@/lib/provider/staticModels';
import { MoreVertical, Pencil, Trash2, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { getAvatarSync, prewarmAvatars } from '@/lib/utils/logoService';
import { getResolvedUrlForBase, isUrlKnownMissing, markResolvedBase, markUrlMissing, ensureLogoCacheReady } from '@/lib/utils/logoService';
import StorageUtil from '@/lib/storage';
import { generateSafeId, validateProviderName, containsChinese } from '@/lib/utils/pinyin';

type Props = {
  trigger: React.ReactNode;
  editProvider?: {
    name: string;
    api_base_url: string;
    strategy: string;
    displayName?: string;
  } | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 当为 true 时，仅展示“编辑提供商”对话框，而不渲染外层“添加/管理提供商”对话框 */
  editOnly?: boolean;
};

// 统一的小图标：优先 png → svg；利用预加载的命中映射/失败清单，避免重复 404
function ProviderIcon({ id, name, size = 18, src }: { id?: string; name: string; size?: number; src?: string }) {
  const exts = ['png', 'svg', 'webp', 'jpeg', 'jpg'] as const;
  const base = id ? `/llm-provider-icon/${id}` : null;
  const mapped = React.useMemo(() => (base ? getResolvedUrlForBase(base) : null), [base]);
  const avatarFallback = React.useMemo(() => generateAvatarDataUrl((id || name).toLowerCase(), name, size), [id, name, size]);
  const [displaySrc, setDisplaySrc] = React.useState<string>(src || mapped || avatarFallback);

  // 首次渲染即有头像，后台尝试真实图标，命中后再替换，避免“无图→有图”的闪动
  React.useEffect(() => {
    if (!base || src) return; // 自带 src 或无 base 直接使用现有
    if (mapped) { setDisplaySrc(mapped); return; }
    const run = async () => {
      await ensureLogoCacheReady();
      const all = exts.map((ext) => `${base}.${ext}`).filter((u) => !isUrlKnownMissing(u));
      const cancelled = false;
      for (const url of all) {
        try {
          const ok = await new Promise<boolean>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
          });
          if (ok) {
            if (!cancelled) setDisplaySrc(url);
            markResolvedBase(base, url);
            return;
          } else {
            markUrlMissing(url);
          }
        } catch { /* noop */ }
      }
    };
    run().catch(()=>{});
    return () => {};
  }, [base, mapped, src]);

  return (
    <img
      src={displaySrc}
      alt={`${name} icon`}
      width={size}
      height={size}
      className="shrink-0 rounded-sm ring-1 ring-black/5 dark:ring-white/10 bg-gray-100 w-[18px] h-[18px]"
    />
  );
}


export function AddProvidersDialog({ trigger, editProvider, open: externalOpen, onOpenChange, editOnly }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [keyword, setKeyword] = useState('');
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});
  const [customProviders, setCustomProviders] = useState<Array<{ id: string; displayName: string; url: string; strategy?: CatalogStrategy; isVisible: boolean }>>([]);
  // 自定义 Provider Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customStrategy, setCustomStrategy] = useState<CatalogStrategy>('openai-compatible');
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"builtIn"|"custom">("builtIn");

  // 处理编辑模式初始化
  useEffect(() => {
    if (editProvider && open) {
      setIsEditMode(true);
      setEditingName(editProvider.name); // 使用原始name作为唯一标识
      setCustomDisplayName(editProvider.displayName || editProvider.name); // 使用displayName或回退到name
      setCustomUrl(editProvider.api_base_url);
      setCustomStrategy(editProvider.strategy as CatalogStrategy);
      // 读取已保存的密钥（用于 UI 显示，可为空）
      (async () => {
        try {
          const list = await providerRepository.getAll();
          const target = list.find(p => p.name === editProvider.name);
          setCustomApiKey((target as any)?.apiKey || '');
        } catch { /* noop */ }
      })();
      setCustomModalOpen(true);
    } else if (!editProvider) {
      setIsEditMode(false);
      setEditingName(null);
    }
  }, [editProvider, open]);

  // 读取仓库现状，构建映射
  useEffect(() => {
    if (!open) return;
    (async () => {
      const list = await providerRepository.getAll();
      const map: Record<string, boolean> = {};
      // 目录中的项目
      AVAILABLE_PROVIDERS_CATALOG.forEach((c)=>{
        const ex = list.find(p=>p.name===c.name);
        map[c.name] = ex ? ex.isVisible !== false : false;
      });
      // 自定义（非目录）且非 Ollama
      const customs = list
        .filter(p => p.name !== 'Ollama' && !AVAILABLE_PROVIDERS_CATALOG.some(c=>c.name===p.name))
        .map(p => ({ id: p.name, displayName: (p as any).displayName || p.name, url: p.url || '', strategy: (p as any).strategy as CatalogStrategy | undefined, isVisible: p.isVisible !== false }));
      customs.forEach(cp => { map[cp.id] = cp.isVisible; });
      setCustomProviders(customs);
      // 后台预热自定义 Provider 头像（非阻塞）
      prewarmAvatars(customs.map(cp => ({ seed: cp.id || cp.displayName, label: cp.displayName })), 18).catch(()=>{});
      setVisibleMap(map);
    })().catch(console.error);
  }, [open]);

  const catalog = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return AVAILABLE_PROVIDERS_CATALOG.filter((c) => c.name.toLowerCase().includes(k));
  }, [keyword]);

  const filteredCustoms = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return customProviders.filter(cp => cp.displayName.toLowerCase().includes(k));
  }, [keyword, customProviders]);

  const toggle = async (name: string, checked: boolean) => {
    try {
      if (checked) {
        const { ensureProviderEnabledUseCase } = await import('@/lib/provider/usecases/EnsureProviderEnabled');
        await ensureProviderEnabledUseCase.execute(name);
      } else {
        await providerRepository.setVisibility(name, false);
      }
      setVisibleMap((m) => ({ ...m, [name]: checked }));
      // 同步 customProviders 列表（若目标为自定义项）
      setCustomProviders(prev => prev.map(cp => cp.id === name ? { ...cp, isVisible: checked } : cp));
    } catch (e: any) {
      console.error('toggle provider failed', e);
      toast.error('更新失败', { description: e?.message || String(e) });
    }
  };

  const buildCustomAvatarSeed = (name: string) => {
    // 预留：未来用此种子生成略微简约但有个性的图案
    return `prov-${name}-${Date.now()}`;
  };

  // 智能 ID 生成：
  // - 支持中文，自动转换为拼音
  // - 转小写
  // - 非字母数字与 - 的字符替换为 -
  // - 多个 - 合并，一个开头/结尾的 - 去除
  // - 限制长度 [2, 64]
  const sanitizeId = (raw: string): string => {
    return generateSafeId(raw);
  };

  const saveCustomProvider = async () => {
    const displayName = customDisplayName.trim();
    const url = customUrl.trim();
    const apiKey = (customApiKey || '').trim();
    
    // 验证提供商名称
    const nameValidation = validateProviderName(displayName);
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error || '名称验证失败', { 
        description: nameValidation.suggestion 
      });
      return;
    }
    
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error('无效的服务地址', { description: 'URL 必须以 http:// 或 https:// 开头' });
      return;
    }
    
    const baseId = sanitizeId(displayName);
    if (!baseId || baseId.length < 2) {
      toast.error('名称过短', { description: '请使用至少 2 个字符（字母/数字/连字符）' });
      return;
    }
    setIsSavingCustom(true);
    try {
      const list = await providerRepository.getAll();
      const existingNames = new Set(list.map(p=>p.name));
      let finalId = baseId;
      let n = 2;
      while (existingNames.has(finalId)) {
        finalId = `${baseId}-${n++}`;
      }
      // 预先生成并持久化头像到 store：首次渲染即可从本地读取
      const avatarKey = `avatar:${finalId}:18`;
      const avatarSmall = generateAvatarDataUrl(finalId, displayName, 18);
      await StorageUtil.setItem(avatarKey, avatarSmall, 'logo-cache.json');
      const { updateProviderConfigUseCase } = await import('@/lib/provider/usecases/UpdateProviderConfig');
      // 先创建空壳实体
      await providerRepository.upsert({
        name: finalId,
        url: '',
        requiresKey: customStrategy !== 'ollama',
        status: customStrategy !== 'ollama' ? ProviderStatus.NO_KEY : ProviderStatus.UNKNOWN,
        lastChecked: 0,
        apiKey: null,
        isUserAdded: true,
        isVisible: true,
        strategy: customStrategy,
        avatarSeed: buildCustomAvatarSeed(finalId),
        displayName,
      } as any);
      // 再统一通过用例写入可选的 url（触发刷新链路）
      await updateProviderConfigUseCase.execute(finalId, { url, displayName, strategy: customStrategy, apiKey: apiKey || null });
      setVisibleMap(m=>({ ...m, [finalId]: true }));
      setCustomProviders(prev => ([...prev, { id: finalId, displayName, url, strategy: customStrategy, isVisible: true }]));
      toast.success('已添加自定义 Provider');
      setCustomModalOpen(false);
    } catch (e:any) {
      console.error(e);
      toast.error('保存失败', { description: e?.message || String(e) });
    }
    setIsSavingCustom(false);
  };

  // —— 编辑 ——
  const startEdit = async (name: string) => {
    try {
      const list = await providerRepository.getAll();
      const target = list.find(p=>p.name===name);
      if (!target) return;
    setCustomDisplayName((target as any).displayName || target.name);
      setCustomUrl(target.url || '');
      setCustomStrategy((target as any).strategy || 'openai-compatible');
      setCustomApiKey((target as any)?.apiKey || '');
      setIsEditMode(true);
      setEditingName(target.name);
      setCustomModalOpen(true);
    } catch(e) { console.error(e);}  
  };

  const saveEditProvider = async () => {
    if (!isEditMode || !editingName) return;
    setIsSavingCustom(true);
    try {
      const url = customUrl.trim();
      const displayName = customDisplayName.trim();
      const apiKey = (customApiKey || '').trim();
      
      // 验证提供商名称
      const nameValidation = validateProviderName(displayName);
      if (!nameValidation.isValid) {
        toast.error(nameValidation.error || '名称验证失败', { 
          description: nameValidation.suggestion 
        });
        setIsSavingCustom(false);
        return;
      }
      
      if (url && !/^https?:\/\//i.test(url)) {
        toast.error('无效的服务地址', { description: 'URL 必须以 http:// 或 https:// 开头' });
        setIsSavingCustom(false);
        return;
      }
      const { updateProviderConfigUseCase } = await import('@/lib/provider/usecases/UpdateProviderConfig');
      await updateProviderConfigUseCase.execute(editingName, { displayName: displayName || editingName, url, strategy: customStrategy, apiKey: apiKey || null });
      setCustomProviders(prev => prev.map(cp => cp.id === editingName ? { ...cp, url: customUrl.trim(), strategy: customStrategy, displayName: customDisplayName.trim() || editingName } : cp));
      toast.success('已保存修改');
      setCustomModalOpen(false);
      // editOnly 模式下关闭外层受控对话框
      if (typeof externalOpen !== 'undefined' && onOpenChange) {
        onOpenChange(false);
      }
    } catch (e:any) {
      console.error(e);
      toast.error('保存失败', { description: e?.message || String(e) });
    }
    setIsSavingCustom(false);
  };

  const confirmDelete = async (name: string) => {
    try {
      await providerRepository.deleteByName(name);
      setCustomProviders(prev => prev.filter(cp => cp.id !== name));
      setVisibleMap(prev => { const n = { ...prev }; delete n[name]; return n; });
      toast.success('已删除');
    } catch (e:any) {
      console.error(e);
      toast.error('删除失败', { description: e?.message || String(e) });
    }
  };

  // 打开新增自定义 Provider 弹窗
  const openAddModal = () => {
    setIsEditMode(false);
    setEditingName(null);
    setCustomUrl('');
    setCustomDisplayName('');
    setCustomStrategy('openai-compatible');
    setPreviewAvatar(null);
    setCustomModalOpen(true);
    // 轻微滚动，提示底部存在自定义区
    requestAnimationFrame(()=>{
      listRef.current?.scrollBy({ top: 80, behavior: 'smooth' });
    });
  };

  // --- 仅编辑模式：只展示“编辑提供商”对话框，不渲染外层管理列表 ---
  if (editOnly) {
    const isEditingCustom = editingName ? !AVAILABLE_PROVIDERS_CATALOG.some(c=>c.name===editingName) : true;
    return (
      <Dialog open={open} onOpenChange={(v)=>onOpenChange ? onOpenChange(v) : setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改提供商</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">名称</label>
              <Input
                value={customDisplayName}
                onChange={(e)=>{
                  const val = e.target.value;
                  setCustomDisplayName(val);
                  if (isEditingCustom) {
                    const id = sanitizeId(val);
                    if (id && id.length >= 2) setPreviewAvatar(generateAvatarDataUrl(id, val, 40));
                    else setPreviewAvatar(null);
                  }
                }}
                placeholder="请输入显示名称"
              />
              {editingName && (
                <div className="mt-1 text-[10px] text-gray-400">名称仅用于展示，唯一标识仍为 {editingName}</div>
              )}
            </div>

            {/* 图标显示：内置显示静态图标；自定义显示头像预览 */}
            {isEditingCustom ? (
              previewAvatar && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Image src={previewAvatar} alt="avatar" width={20} height={20} className="rounded-md" />
                  <span>头像预览（保存后将显示）</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {(() => {
                  const def = AVAILABLE_PROVIDERS_CATALOG.find(d=>d.name===editingName);
                  return <ProviderIcon id={def?.id} name={def?.name || editingName || ''} />;
                })()}
                <span>当前图标</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">服务地址（可选）</label>
              <Input value={customUrl} onChange={(e)=>setCustomUrl(e.target.value)} placeholder="例如：https://api.example.com/v1" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API 密钥（可选）</label>
              <Input value={customApiKey} onChange={(e)=>setCustomApiKey(e.target.value)} placeholder="粘贴密钥（可选）" type="password" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API 策略</label>
              <Select value={customStrategy} onValueChange={(v)=>setCustomStrategy(v as CatalogStrategy)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
                  <SelectItem value="openai">OpenAI 官方</SelectItem>
                  <SelectItem value="anthropic">Anthropic（Claude）</SelectItem>
                  <SelectItem value="gemini">Google AI（Gemini）</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="dialogSecondary" onClick={()=> (onOpenChange ? onOpenChange(false) : setOpen(false))}>取消</Button>
              <Button variant="dialogPrimary" onClick={saveEditProvider} disabled={isSavingCustom}>{isSavingCustom ? '保存中...' : '保存'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // --- 默认模式：添加/管理提供商（包含内置列表 + 自定义编辑二级弹窗） ---
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[92vw] w-[92vw] sm:w-auto sm:max-w-xl box-border p-4 sm:p-5 overflow-hidden max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium text-gray-700 dark:text-gray-200">添加/管理提供商</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 min-w-0">
          {/* 为避免在小屏宽度下出现水平溢出，强制容器与输入框不超出 */}
          <Input className="w-full max-w-full min-w-0" placeholder="搜索提供商..." value={keyword} onChange={(e)=>setKeyword(e.target.value)} />
          {/* 顶部TAB */}
          <div className="flex items-center gap-2 px-1">
            <button onClick={()=>setActiveTab("builtIn")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab==='builtIn'?'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>默认</button>
            <button onClick={()=>setActiveTab("custom")} className={`px-3 py-1.5 text-sm rounded-md ${activeTab==='custom'?'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>自定义</button>
          </div>
          <div ref={listRef} className="h-[60vh] overflow-y-auto rounded-md bg-white/70 dark:bg-gray-900/20 space-y-1.5 px-1">
            {activeTab === 'builtIn' && (
              <>
                {catalog.map((c) => {
                  const checked = visibleMap[c.name] ?? false;
                  return (
                    <label key={c.id} className="flex items-center gap-2.5 py-2 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/40 border border-transparent">
                      <Checkbox checked={checked} onCheckedChange={(v)=>toggle(c.name, !!v)} id={`chk-${c.id}`} />
                      <ProviderIcon id={c.id} name={c.name} />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`chk-${c.id}`} className="font-medium truncate cursor-pointer select-none">{c.name}</label>
                        <div className="text-xs text-gray-500 truncate">
                          {c.strategy} {c.defaultUrl ? `· ${c.defaultUrl}` : ''} {c.requiresKey ? '· 需要密钥' : ''}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {catalog.length === 0 && (
                  <div className="py-6 text-center text-sm text-gray-500">未找到匹配的提供商</div>
                )}
              </>
            )}

            {activeTab === 'custom' && (
              <>
                {filteredCustoms.map((cp) => {
                  const id = `chk-custom-${cp.id.replace(/\s+/g,'-')}`;
                  const checked = visibleMap[cp.id] ?? cp.isVisible;
                  return (
                    <div key={cp.id} className="flex items-center gap-2.5 py-2 px-2 group rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/40 border border-transparent">
                      <Checkbox checked={checked} onCheckedChange={(v)=>toggle(cp.id, !!v)} id={id} />
                      <ProviderIcon src={getAvatarSync(cp.id || cp.displayName, cp.displayName, 18)} name={cp.displayName} />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={id} className="font-medium truncate cursor-pointer select-none">{cp.displayName}</label>
                        <div className="text-xs text-gray-500 truncate">
                          {(cp.strategy || 'openai-compatible')} {cp.url ? `· ${cp.url}` : ''}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><MoreVertical className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
                          <DropdownMenuItem onClick={()=>startEdit(cp.id)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> 修改
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={(e)=>{ e.preventDefault(); }}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> 删除
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除该 Provider？</AlertDialogTitle>
                                <AlertDialogDescription>此操作将从当前列表移除该 Provider，但不会删除已配置的密钥和模型参数。</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={()=>confirmDelete(cp.id)}>删除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
                {filteredCustoms.length === 0 && customProviders.length > 0 && keyword.trim() !== '' && (
                  <div className="py-2 text-center text-xs text-gray-400">没有匹配的自定义提供商</div>
                )}
                <div className="py-2 px-1">
                  <Button variant="soft" className="w-full" onClick={openAddModal}>
                    <Plus className="w-4 h-4" /> 添加自定义 Provider
                  </Button>
                </div>
              </>
            )}
          </div>
          {/* 顶部触发器即可关闭，此处不再冗余“完成”按钮，简化界面 */}
        </div>
        {/* 二级弹窗：新增/编辑自定义 Provider */}
        {customModalOpen && (
          <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
      <DialogContent className="sm:max-w-md">
              <DialogHeader>
              <DialogTitle>{isEditMode ? '修改 Provider' : '添加自定义 Provider'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名称</label>
                  <Input
                    value={customDisplayName}
                    onChange={(e)=>{
                      const val = e.target.value;
                      setCustomDisplayName(val);
                      const id = sanitizeId(val);
                      if (id && id.length >= 2) setPreviewAvatar(generateAvatarDataUrl(id, val, 40));
                      else setPreviewAvatar(null);
                    }}
                    placeholder="例如：我的提供商 或 My Provider"
                  />
                  {isEditMode && editingName && (
                    <div className="mt-1 text-[10px] text-gray-400">名称仅用于展示，唯一标识仍为 {editingName}</div>
                  )}
                </div>
                {previewAvatar && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Image src={previewAvatar} alt="avatar" width={20} height={20} className="rounded-md" />
                    <span>头像预览（保存后将显示）</span>
                  </div>
                )}
                {containsChinese(customDisplayName) && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    💡 中文名称将自动转换为拼音ID：{sanitizeId(customDisplayName)}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">服务地址（可选）</label>
                  <Input value={customUrl} onChange={(e)=>setCustomUrl(e.target.value)} placeholder="https://api.example.com/v1" />
                </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API 密钥（可选）</label>
              <Input value={customApiKey} onChange={(e)=>setCustomApiKey(e.target.value)} placeholder="粘贴密钥（可选）" type="password" />
            </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">API 策略</label>
                  <Select value={customStrategy} onValueChange={(v)=>setCustomStrategy(v as CatalogStrategy)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择策略" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
                      <SelectItem value="openai">OpenAI 官方</SelectItem>
                  <SelectItem value="anthropic">Anthropic（Claude）</SelectItem>
                  <SelectItem value="gemini">Google AI（Gemini）</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="dialogSecondary" onClick={()=>setCustomModalOpen(false)}>取消</Button>
                  <Button variant="dialogPrimary" onClick={isEditMode ? saveEditProvider : saveCustomProvider} disabled={isSavingCustom}>
                    {isSavingCustom ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}


