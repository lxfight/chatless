"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { tauriFetch } from "@/lib/request";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

type HeaderKV = { id: string; key: string; value: string };
type FormKV = { id: string; key: string; value: string };

type BodyMode = "json" | "form" | "none";
type RequestMode = "tauri" | "browser";

interface SendResultLog {
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  request: {
    mode: RequestMode;
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    bodyPreview?: string;
  };
  response?: {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    bodyText?: string;
    bodyJsonPretty?: string;
  };
  error?: string;
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function HttpRequestDebugger() {
  const [requestMode, setRequestMode] = useState<RequestMode>("tauri");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState<string>("");
  const [headers, setHeaders] = useState<HeaderKV[]>([{ id: uuid(), key: "", value: "" }]);
  const [bodyMode, setBodyMode] = useState<BodyMode>("none");
  const [jsonBody, setJsonBody] = useState<string>(`{
  "hello": "world"
}`);
  const [formBody, setFormBody] = useState<FormKV[]>([{ id: uuid(), key: "", value: "" }]);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<SendResultLog | null>(null);

  const effectiveHeaders = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const h of headers) {
      const k = (h.key || "").trim();
      if (!k) continue;
      obj[k] = h.value ?? "";
    }
    if (bodyMode === "json" && method !== "GET" && method !== "HEAD") {
      if (!Object.keys(obj).some((k) => k.toLowerCase() === "content-type")) {
        obj["Content-Type"] = "application/json";
      }
    }
    if (bodyMode === "form" && method !== "GET" && method !== "HEAD") {
      if (!Object.keys(obj).some((k) => k.toLowerCase() === "content-type")) {
        obj["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }
    return obj;
  }, [headers, bodyMode, method]);

  const bodyPreview = useMemo(() => {
    if (method === "GET" || method === "HEAD") return undefined;
    if (bodyMode === "json") return jsonBody;
    if (bodyMode === "form") {
      const params = new URLSearchParams();
      formBody.forEach((p) => {
        if ((p.key || "").trim().length) params.append(p.key, p.value);
      });
      return params.toString();
    }
    return undefined;
  }, [bodyMode, jsonBody, formBody, method]);

  const addHeader = () => setHeaders((arr) => [...arr, { id: uuid(), key: "", value: "" }]);
  const removeHeader = (id: string) => setHeaders((arr) => (arr.length === 1 ? arr : arr.filter((h) => h.id !== id)));
  const updateHeader = (id: string, patch: Partial<HeaderKV>) =>
    setHeaders((arr) => arr.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const addForm = () => setFormBody((arr) => [...arr, { id: uuid(), key: "", value: "" }]);
  const removeForm = (id: string) => setFormBody((arr) => (arr.length === 1 ? arr : arr.filter((h) => h.id !== id)));
  const updateForm = (id: string, patch: Partial<FormKV>) =>
    setFormBody((arr) => arr.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  async function send() {
    if (!url.trim()) return;
    setSending(true);
    const startedAt = new Date().toISOString();
    const reqLogBase: SendResultLog = {
      startedAt,
      request: {
        mode: requestMode,
        method,
        url,
        headers: effectiveHeaders,
        bodyPreview,
      },
    };
    const finalLog: SendResultLog = { ...reqLogBase };
    const start = performance.now();
    try {
      if (requestMode === "browser") {
        const init: RequestInit = {
          method,
          headers: effectiveHeaders,
        };
        if (method !== "GET" && method !== "HEAD") {
          if (bodyMode === "json") {
            init.body = jsonBody || "";
          } else if (bodyMode === "form") {
            const params = new URLSearchParams();
            formBody.forEach((p) => {
              if ((p.key || "").trim().length) params.append(p.key, p.value);
            });
            init.body = params.toString();
          }
        }
        console.groupCollapsed(`[HttpRequestDebugger][browser] ${method} ${url}`);
        console.log("init:", init);
        const resp = await fetch(url, init);
        const text = await resp.text();
        let pretty: string | undefined;
        try {
          pretty = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          // ignore JSON parse error; keep text body
        }
        const headersObj: Record<string, string> = {};
        resp.headers.forEach((v, k) => (headersObj[k] = v));
        console.log("status:", resp.status, resp.statusText);
        console.log("headers:", headersObj);
        console.log("body:", pretty ?? text);
        console.groupEnd();
        finalLog.response = {
          ok: resp.ok,
          status: resp.status,
          statusText: resp.statusText || "",
          headers: headersObj,
          bodyText: text,
          bodyJsonPretty: pretty,
        };
      } else {
        const init: any = {
          method,
          headers: effectiveHeaders,
          danger: { acceptInvalidCerts: true, acceptInvalidHostnames: false },
          rawResponse: true,
          verboseDebug: true,
          debugTag: "HttpRequestDebugger",
          includeBodyInLogs: true,
        };
        if (method !== "GET" && method !== "HEAD") {
          if (bodyMode === "json") {
            try {
              const parsed = jsonBody ? JSON.parse(jsonBody) : {};
              init.body = { type: "Json", payload: parsed };
            } catch {
              init.body = { type: "Text", payload: jsonBody || "" };
            }
          } else if (bodyMode === "form") {
            const formObj: Record<string, string> = {};
            formBody.forEach((p) => {
              if ((p.key || "").trim().length) formObj[p.key] = p.value;
            });
            init.body = { type: "Form", payload: formObj };
          }
        }
        console.groupCollapsed(`[HttpRequestDebugger][tauri] ${method} ${url}`);
        console.log("init:", init);
        const resp = await tauriFetch(url, init);
        const anyResp: any = resp;
        const status = anyResp.status ?? anyResp.statusCode ?? 0;
        const statusText = anyResp.statusText ?? "";
        const ok = status >= 200 && status < 300;
        const headersObj: Record<string, string> = {};
        anyResp.headers.forEach((v: string, k: string) => (headersObj[k] = v));
        const text = await anyResp.text();
        let pretty: string | undefined;
        try { 
          pretty = JSON.stringify(JSON.parse(text), null, 2); 
        } catch {
          // ignore JSON parse error; keep text body
        }
        console.log("status:", status, statusText);
        console.log("headers:", headersObj);
        console.log("body:", pretty ?? text);
        console.groupEnd();
        finalLog.response = {
          ok,
          status,
          statusText,
          headers: headersObj,
          bodyText: text,
          bodyJsonPretty: pretty,
        };
      }
    } catch (e: any) {
      finalLog.error = e?.message || String(e);
    } finally {
      const finishedAt = new Date().toISOString();
      const durationMs = Math.round(performance.now() - start);
      finalLog.finishedAt = finishedAt;
      finalLog.durationMs = durationMs;
      setLog(finalLog);
      setSending(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">HTTP 请求调试器</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-4">
          <label className="block text-xs text-gray-500 mb-1">请求地址</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/api"
            className="h-9 w-full border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">方法</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className="h-9 w-full border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
          >
            {(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as HttpMethod[]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">模式</label>
          <select
            value={requestMode}
            onChange={(e) => setRequestMode(e.target.value as RequestMode)}
            className="h-9 w-full border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
          >
            <option value="tauri">Tauri HTTP</option>
            <option value="browser">浏览器 fetch</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Body 类型</label>
          <select
            value={bodyMode}
            onChange={(e) => setBodyMode(e.target.value as BodyMode)}
            className="h-9 w-full border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
          >
            <option value="none">无</option>
            <option value="json">JSON</option>
            <option value="form">表单</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button disabled={sending || !url} onClick={send}>{sending ? "发送中…" : "发送"}</Button>
          <Button variant="secondary" onClick={() => setLog(null)}>清空结果</Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500">Headers</label>
          <button className="text-xs text-blue-600 hover:underline" onClick={addHeader}>添加一行</button>
        </div>
        <div className="space-y-2">
          {headers.map((h) => (
            <div key={h.id} className="grid grid-cols-12 gap-2">
              <input
                value={h.key}
                onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                placeholder="Header Key"
                className="col-span-5 h-8 border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
              />
              <input
                value={h.value}
                onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                placeholder="Header Value"
                className="col-span-6 h-8 border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
              />
              <div className="col-span-1 flex items-center justify-end">
                <button className="text-xs text-red-600 hover:underline" onClick={() => removeHeader(h.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {bodyMode === "json" && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">JSON Body</label>
          <textarea
            value={jsonBody}
            onChange={(e) => setJsonBody(e.target.value)}
            className="min-h-[160px] w-full border border-gray-300 rounded px-2 py-1 font-mono text-[12px] bg-white dark:bg-slate-800 dark:border-gray-600"
          />
        </div>
      )}

      {bodyMode === "form" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500">表单参数</label>
            <button className="text-xs text-blue-600 hover:underline" onClick={addForm}>添加一行</button>
          </div>
          {formBody.map((f) => (
            <div key={f.id} className="grid grid-cols-12 gap-2">
              <input
                value={f.key}
                onChange={(e) => updateForm(f.id, { key: e.target.value })}
                placeholder="字段名"
                className="col-span-5 h-8 border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
              />
              <input
                value={f.value}
                onChange={(e) => updateForm(f.id, { value: e.target.value })}
                placeholder="字段值"
                className="col-span-6 h-8 border border-gray-300 rounded px-2 text-sm bg-white dark:bg-slate-800 dark:border-gray-600"
              />
              <div className="col-span-1 flex items-center justify-end">
                <button className="text-xs text-red-600 hover:underline" onClick={() => removeForm(f.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-gray-500">请求与响应日志</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <textarea
            readOnly
            value={(() => {
              if (!log) return "";
              const req = log.request;
              const lines: string[] = [];
              lines.push(`# Request`);
              lines.push(`Mode: ${req.mode}`);
              lines.push(`Method: ${req.method}`);
              lines.push(`URL: ${req.url}`);
              lines.push(`Time: ${log.startedAt}`);
              lines.push(`Headers:`);
              Object.entries(req.headers || {}).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
              if (req.bodyPreview !== undefined) {
                lines.push("\nBody preview:");
                lines.push(typeof req.bodyPreview === "string" ? req.bodyPreview : String(req.bodyPreview));
              }
              return lines.join("\n");
            })()}
            className="min-h-[240px] w-full border border-gray-300 rounded px-2 py-1 font-mono text-[12px] bg-gray-50 dark:bg-slate-800 dark:border-gray-600"
          />
          <textarea
            readOnly
            value={(() => {
              if (!log) return "";
              if (log.error) {
                return [`# Error`, `Finished: ${log.finishedAt ?? ""}  (${log.durationMs ?? 0}ms)`, `Message: ${log.error}`].join("\n");
              }
              const r = log.response;
              if (!r) return "";
              const lines: string[] = [];
              lines.push(`# Response`);
              lines.push(`Finished: ${log.finishedAt ?? ""}  (${log.durationMs ?? 0}ms)`);
              lines.push(`Status: ${r.status} ${r.statusText}`);
              lines.push(`Ok: ${r.ok}`);
              lines.push(`Headers:`);
              Object.entries(r.headers || {}).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
              if (r.bodyJsonPretty) {
                lines.push("\nBody (JSON):");
                lines.push(r.bodyJsonPretty);
              } else if (r.bodyText) {
                lines.push("\nBody (text):");
                lines.push(r.bodyText);
              }
              return lines.join("\n");
            })()}
            className="min-h-[240px] w-full border border-gray-300 rounded px-2 py-1 font-mono text-[12px] bg-gray-50 dark:bg-slate-800 dark:border-gray-600"
          />
        </div>
      </div>
    </div>
  );
}


