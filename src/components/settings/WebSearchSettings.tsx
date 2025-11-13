"use client";

import { useMemo } from "react";
import { InputField } from "./InputField";
import { SelectField } from "./SelectField";
import { useWebSearchStore, type SearchProvider } from "@/store/webSearchStore";
import { linkOpener } from "@/lib/utils/linkOpener";
import { Globe, ExternalLink, ShieldCheck } from "lucide-react";
import { providerOptions } from "@/lib/websearch/registry";
import { Switch } from "@/components/ui/switch";

export function WebSearchSettings() {
  const store = useWebSearchStore();

  const available = useMemo(() => store.getAvailableProviders(), [store.isWebSearchEnabled, store.apiKeyGoogle, store.cseIdGoogle, store.apiKeyBing]);

  const openLink = async (url: string) => {
    try {
      await linkOpener.openLink(url);
    } catch { /* noop */ }
  };

  return (
    <div className="space-y-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">网络搜索</h2>
        <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/10 p-4 dark:border-slate-700/60 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            配置可用于实时检索的搜索引擎。模型在需要最新信息时会通过此工具进行搜索。
          </p>
        </div>
      </div>

      <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-6 space-y-6 bg-white/70 dark:bg-slate-900/40 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100/80 dark:border-slate-800/60">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">搜索提供商</h3>
        </div>

        <div className="space-y-6">
          {/* 自动授权开关（仅影响 web_search 工具调用） */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">自动授权网络搜索</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">开启后，调用 web_search 工具时将跳过确认；关闭后每次都会询问</span>
            </div>
            <Switch
              checked={store.autoAuthorizeWebSearch}
              onCheckedChange={(v) => store.setAutoAuthorizeWebSearch(!!v)}
            />
          </div>

          <SelectField
            label="默认搜索引擎"
            value={store.provider}
            onChange={(v) => store.setSearchProvider(v as SearchProvider)}
            options={providerOptions() as any}
            tooltip="默认用于未在会话中单独指定的情况下调用的搜索提供商"
          />

          {store.provider === "google" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <InputField
                  label="Google API Key"
                  type="password"
                  value={store.apiKeyGoogle}
                  onChange={(e) => store.setGoogleCredentials(e.target.value, store.cseIdGoogle)}
                />
                <button
                  className="mt-7 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => openLink("https://console.cloud.google.com/apis/credentials")}
                >
                  <ExternalLink className="w-4 h-4" /> API 控制台
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <InputField
                  label="Google CSE ID"
                  value={store.cseIdGoogle}
                  onChange={(e) => store.setGoogleCredentials(store.apiKeyGoogle, e.target.value)}
                />
                <button
                  className="mt-7 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => openLink("https://programmablesearchengine.google.com/")}
                >
                  <ExternalLink className="w-4 h-4" /> CSE 控制台
                </button>
              </div>
            </>
          )}

          {store.provider === "bing" && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <InputField
                label="Bing API Key"
                type="password"
                value={store.apiKeyBing}
                onChange={(e) => store.setBingCredentials(e.target.value)}
              />
              <button
                className="mt-7 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => openLink("https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/Text")}
              >
                <ExternalLink className="w-4 h-4" /> Azure 门户
              </button>
            </div>
          )}

          {store.provider === "ollama" && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <InputField
                label="Ollama API Key"
                type="password"
                value={store.apiKeyOllama}
                onChange={(e) => store.setOllamaApiKey(e.target.value)}
              />
              <button
                className="mt-7 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => openLink("https://ollama.com/blog/web-search")}
              >
                <ExternalLink className="w-4 h-4" /> 文档与开通
              </button>
            </div>
          )}

          {store.provider === "custom_scrape" && (
            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div>
                使用内置抓取器，无需 API Key，但结果可能不稳定或受限。建议优先配置官方 API 提供商以获得更可靠结果。
                <div className="mt-1 text-[11px] text-slate-500">提示：若被风控拦截，可在“高级设置 - 网络”中配置代理后重试。</div>
              </div>
            </div>
          )}

          {/* —— 高级参数（按提供商显示，默认折叠） —— */}
          {(store.provider === 'duckduckgo' || store.provider === 'custom_scrape') && (
            <details className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 p-3 bg-white/60 dark:bg-slate-900/30">
              <summary className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">DuckDuckGo / 自定义抓取 - 高级参数</summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <InputField
                  label="结果数量 (1-10)"
                  type="number"
                  value={String(store.ddgLimit)}
                  onChange={(e)=> store.setDdgAdvanced({ ddgLimit: Math.max(1, Math.min(10, Number(e.target.value)||5)) })}
                />
                <InputField
                  label="Accept-Language"
                  placeholder="例如 zh-CN,zh;q=0.9"
                  value={store.ddgAcceptLanguage}
                  onChange={(e)=> store.setDdgAdvanced({ ddgAcceptLanguage: e.target.value })}
                />
                <InputField
                  label="kl 区域/语言"
                  placeholder="例如 us-en / zh-cn"
                  value={store.ddgKl}
                  onChange={(e)=> store.setDdgAdvanced({ ddgKl: e.target.value })}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-700 dark:text-slate-300">安全搜索（kp）</span>
                    <span className="text-[11px] text-slate-500">开启=kp=1，关闭=kp=-2</span>
                  </div>
                  <Switch checked={!!store.ddgSafe} onCheckedChange={(v)=> store.setDdgAdvanced({ ddgSafe: !!v })} />
                </div>
                <InputField
                  label="site 限定"
                  placeholder="例如 wikipedia.org"
                  value={store.ddgSite}
                  onChange={(e)=> store.setDdgAdvanced({ ddgSite: e.target.value })}
                />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100/70 dark:border-slate-800/60">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Fetch 抓取选项（用于读取网页详情）</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-700 dark:text-slate-300">启用可读性提取（推荐）</span>
                      <span className="text-[11px] text-slate-500">尽量提取正文与标题，效果优于纯文本</span>
                    </div>
                    <Switch checked={!!store.fetchUseReadability} onCheckedChange={(v)=> store.setFetchReadability(!!v)} />
                  </div>
                  <InputField
                    label="正文最大字符数"
                    type="number"
                    value={String(store.fetchMaxContentChars)}
                    onChange={(e)=> store.setFetchAdvanced({ fetchMaxContentChars: Math.max(500, Number(e.target.value)||2000) })}
                  />
                  <InputField
                    label="最大链接数"
                    type="number"
                    value={String(store.fetchMaxLinks)}
                    onChange={(e)=> store.setFetchAdvanced({ fetchMaxLinks: Math.max(10, Number(e.target.value)||50) })}
                  />
                </div>
              </div>
            </details>
          )}

          {store.provider === 'ollama' && (
            <details className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 p-3 bg-white/60 dark:bg-slate-900/30">
              <summary className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">Ollama - 高级参数</summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <InputField
                  label="最大结果数"
                  type="number"
                  value={String(store.ollamaMaxResults)}
                  onChange={(e)=> store.setOllamaAdvanced({ ollamaMaxResults: Math.max(1, Math.min(10, Number(e.target.value)||5)) })}
                />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100/70 dark:border-slate-800/60">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Fetch 抓取选项</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InputField
                    label="正文最大字符数"
                    type="number"
                    value={String(store.fetchMaxContentChars)}
                    onChange={(e)=> store.setFetchAdvanced({ fetchMaxContentChars: Math.max(500, Number(e.target.value)||2000) })}
                  />
                  <InputField
                    label="最大链接数"
                    type="number"
                    value={String(store.fetchMaxLinks)}
                    onChange={(e)=> store.setFetchAdvanced({ fetchMaxLinks: Math.max(10, Number(e.target.value)||50) })}
                  />
                </div>
              </div>
            </details>
          )}

          <div className="pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">已可用的提供商</div>
            <div className="flex flex-wrap gap-2">
              {available.map((p) => (
                <span key={p} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/40">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


