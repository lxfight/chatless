"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { Send, Image, Code, Paperclip, Square, FileText, Loader2, Database, X, StopCircle, CornerDownLeft, Settings } from "lucide-react";
import { DocumentParser } from '@/lib/documentParser';
import { DocumentParseResult } from '@/types/document';
import { KnowledgeService, KnowledgeBase } from '@/lib/knowledgeService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { KnowledgeBaseSelector } from "./input/KnowledgeBaseSelector";
import { AttachedDocumentView } from "./input/AttachedDocumentView";
import { SelectedKnowledgeBaseView } from "./input/SelectedKnowledgeBaseView";
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BrainCircuit } from 'lucide-react';
import { SessionParametersDialog } from './SessionParametersDialog';
import { McpQuickToggle } from './input/McpQuickToggle';
import { McpMentionPanel } from './input/McpMentionPanel';
import type { ModelParameters } from '@/types/model-params';
import { createSafePreview } from '@/lib/utils/tokenBudget';
import { getCurrentKnowledgeBaseConfig } from '@/lib/knowledgeBaseConfig';
import { SlashPromptPanel } from './SlashPromptPanel';
import { usePromptStore } from '@/store/promptStore';
import { useChatStore } from '@/store/chatStore';
import { renderPromptContent } from '@/lib/prompt/render';

interface EditingMessageData {
  content: string;
  documentReference?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    summary: string;
  };
  contextData?: string;
  knowledgeBaseReference?: {
    id: string;
    name: string;
  };
}

interface ChatInputProps {
  onSendMessage: (
    content: string,
    documentData?: {
      documentReference: {
        fileName: string;
        fileType: string;
        fileSize: number;
        summary: string;
      };
      contextData: string;
    },
    knowledgeBase?: {
      id: string;
      name: string;
    },
    options?: { images?: string[] }
  ) => void;
  onImageUpload?: (file: File) => void;
  onFileUpload?: (file: File) => void;
  isLoading?: boolean;
  tokenCount?: number;
  disabled?: boolean;
  onStopGeneration?: () => void;
  onBeforeSendMessage?: () => Promise<boolean>;
  selectedKnowledgeBaseId?: string; // 来自URL参数或父组件的知识库ID
  editingMessage?: EditingMessageData | null;
  onCancelEdit?: () => void;
  // 会话参数相关
  providerName?: string;
  modelId?: string;
  modelLabel?: string;
  conversationId?: string; // 添加会话ID参数
  onSessionParametersChange?: (parameters: ModelParameters) => void;
  currentSessionParameters?: ModelParameters;
}

export function ChatInput({
  onSendMessage,
  onImageUpload,
  onFileUpload,
  isLoading = false,
  disabled = false,
  onStopGeneration,
  onBeforeSendMessage,
  selectedKnowledgeBaseId,
  tokenCount = 0,
  editingMessage = null,
  onCancelEdit,
  providerName,
  modelId,
  modelLabel,
  onSessionParametersChange,
  currentSessionParameters,
  conversationId
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // 直接应用提示词，无需弹窗
  const inlineVarsRef = useRef<Record<string,string>>({});
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [attachedDocument, setAttachedDocument] = useState<{
    name: string;
    content: string;
    summary: string;
    fileSize: number;
  } | null>(null);

  // 知识库选择相关状态
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);
  
  // 会话参数设置弹窗状态
  const [sessionParametersDialogOpen, setSessionParametersDialogOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 根据URL参数设置初始知识库
  useEffect(() => {
    if (selectedKnowledgeBaseId && !selectedKnowledgeBase) {
      loadSelectedKnowledgeBase(selectedKnowledgeBaseId);
    } else if (!selectedKnowledgeBaseId) {
      // 如果URL参数被移除，则清空选择
      setSelectedKnowledgeBase(null);
    }
  }, [selectedKnowledgeBaseId]);

  // 加载指定的知识库
  const loadSelectedKnowledgeBase = async (knowledgeBaseId: string) => {
    try {
      const kb = await KnowledgeService.getKnowledgeBase(knowledgeBaseId);
      if (kb) {
        setSelectedKnowledgeBase(kb);
      }
    } catch (error) {
      console.error('加载知识库失败:', error);
    }
  };

  // 移除知识库选择
  const handleRemoveKnowledgeBase = () => {
    setSelectedKnowledgeBase(null);
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  // 监听来自面板的内联变量赋值
  useEffect(() => {
    const handler = (e: any) => {
      const detail = (e as CustomEvent).detail as Record<string,string>;
      if (detail && typeof detail === 'object') {
        inlineVarsRef.current = detail;
      }
    };
    window.addEventListener('prompt-inline-vars', handler as any);
    return () => window.removeEventListener('prompt-inline-vars', handler as any);
  }, []);

  const slashTokens = useMemo(() => {
    const tokens: string[] = [];
    // 指令 token 支持中文
    const re = /(^|\s)\/([^\s]+)/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inputValue))) {
      const token = m[2];
      if (token && !tokens.includes(token)) tokens.push(token);
    }
    return tokens;
  }, [inputValue]);

  const stripFirstSlashToken = (text: string): string => {
    // 去除首个 /token（支持中文）
    return text.replace(/(^|\s)\/[^\s]+/u, (match) => (match.startsWith(' ') ? ' ' : ''));
  };

  // 解析起始的 /指令 及其参数与可选 “| ” 分隔后的后续文本
  const parseLeadingSlash = (text: string):
    | { leadingSpace: string; token: string; varPart: string; postText: string; hasDelimiter: boolean; prefixRaw: string; postRaw: string }
    | null => {
    const m = text.match(/^(\s*)\/([^\s]+)(.*)$/u);
    if (!m) return null;
    const leadingSpace = m[1] || '';
    const token = m[2];
    const tail = m[3] || '';
    const idx1 = tail.indexOf('| ');
    const idx2 = tail.indexOf('｜ ');
    const idx = [idx1, idx2].filter((v) => v >= 0).sort((a, b) => a - b)[0];
    if (idx !== undefined) {
      const before = tail.slice(0, idx); // 原样保留（包含空格）
      const afterRaw = tail.slice(idx + 2); // 原样保留
      const varPart = before.trim();
      const postText = afterRaw.trim();
      return { leadingSpace, token, varPart, postText, hasDelimiter: true, prefixRaw: before, postRaw: afterRaw };
    }
    return { leadingSpace, token, varPart: tail.trim(), postText: '', hasDelimiter: false, prefixRaw: tail, postRaw: '' };
  };

  // 覆盖层与 textarea 使用一致字体度量，避免像素误差
  const [overlayFont, setOverlayFont] = useState<string>('');
  const [overlayFontSize, setOverlayFontSize] = useState<string>('');
  const [overlayLineHeight, setOverlayLineHeight] = useState<string>('');
  const [mentionOpen, setMentionOpen] = useState<boolean>(false);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setOverlayFont(cs.fontFamily);
    setOverlayFontSize(cs.fontSize);
    setOverlayLineHeight(cs.lineHeight);
  }, [textareaRef.current]);

  // 是否需要覆盖层渲染（/ 指令或 @ 提示）
  const hasSlashOverlay = useMemo(() => !!parseLeadingSlash(inputValue), [inputValue]);
  const hasMentionOverlay = useMemo(() => /@([a-zA-Z0-9_-]{1,64})/g.test(inputValue), [inputValue]);

  // 用渲染结果替换 /指令与其变量片段；若存在 “| ”，会将其后的内容以换行附加在渲染结果后
  const replaceSlashWithRendered = (text: string, rendered: string): string => {
    const parsed = parseLeadingSlash(text);
    if (!parsed) return text;
    const { leadingSpace, varPart, postText, hasDelimiter } = parsed;
    const after = hasDelimiter && postText ? `\n${postText}` : '';
    // 构造要替换的前缀（/token + 可选空格 + varPart，不包含分隔符）
    const prefix = new RegExp(`^${leadingSpace.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\/[^\s]+(?:\\s+[^|｜]*)?`, 'u');
    return text.replace(prefix, `${leadingSpace}${rendered}${after}`);
  };

  // 从输入中移除 /指令与变量片段；若存在 “| ” 则保留其后的普通文本
  const stripSlashTokenAndVars = (text: string): string => {
    const parsed = parseLeadingSlash(text);
    if (!parsed) return stripFirstSlashToken(text);
    const { leadingSpace, postText, hasDelimiter } = parsed;
    return hasDelimiter ? `${leadingSpace}${postText}` : leadingSpace;
  };

  // 斜杠面板开关逻辑：当输入框以 / 开头或包含以空格分隔的 /token 时打开
  useEffect(() => {
    const val = inputValue;
    // 以 / 开头 或 光标前为 / 时唤起，但不改变输入框焦点
    const open = val.startsWith('/') || /\s\/$/.test(val);
    setIsPanelOpen(open);
    // @ 提示：当末尾形如 @xxx 时打开 MCP 引用面板（允许字母数字和 - _）
    setMentionOpen(/@([a-zA-Z0-9_-]*)$/.test(val));
  }, [inputValue]);

  // 当进入编辑模式时，预填充内容
  useEffect(() => {
    if (editingMessage) {
      setInputValue(editingMessage.content);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [editingMessage]);

  const handleSend = async () => {
    if (!inputValue.trim() && !attachedDocument) return;
    if (isLoading) return;

    // 发送前检查
    if (onBeforeSendMessage) {
      const canSend = await onBeforeSendMessage();
      if (!canSend) {
        // 具体错误信息应由父组件处理和显示
        return;
      }
    }

    let userMessage = inputValue.trim();

    // 兜底：若以 / 指令开头但未通过面板选择，尝试在发送前渲染提示词
    if (userMessage.startsWith('/')) {
      try {
        const prompts = usePromptStore.getState().prompts as any[];
        const parts = userMessage.split(/\s+/);
        const token = parts[0].replace(/^\//, '').toLowerCase();
        const rest = userMessage.slice(parts[0].length).trim();
        // 若用户使用了“| ”或“｜ ”分隔的后续文本（例如：/trans 英文 | 你好），兜底时也需要保留
        const parsedForAfter = parseLeadingSlash(userMessage);
        const afterTail = parsedForAfter && parsedForAfter.hasDelimiter && parsedForAfter.postText
          ? `\n${parsedForAfter.postText}`
          : '';
        // 精确匹配已保存的快捷词
        let matched = prompts.find((p:any)=> (p.shortcuts||[]).some((s:string)=> s.toLowerCase()===token));
        if (!matched) {
          // 回退：根据名称/标签生成候选，选择第一个以 token 开头的项
          matched = prompts.find((p:any)=> {
            const hay = `${p.name} ${(p.tags||[]).join(' ')} ${(p.languages||[]).join(' ')}`.toLowerCase();
            return hay.includes(token);
          });
        }
        if (matched) {
          // 解析变量：key=value 或 位置参数（支持 | 与 ｜）
          const inline: Record<string,string> = {};
          const varRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s]+))/gu;
          let m: RegExpExecArray | null;
          while ((m = varRe.exec(rest))) { inline[m[1]] = (m[3] ?? m[4] ?? m[5] ?? '').toString(); }
          let values: Record<string,string> = {};
          const keys: string[] = (() => {
            // 优先元数据中定义的顺序
            if (Array.isArray(matched.variables) && matched.variables.length>0) return matched.variables.map((v:any)=>v.key);
            const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
            const ks: string[] = []; let mm: RegExpExecArray | null;
            while ((mm = pattern.exec(String(matched.content||'')))) { const k = mm[1]; if (k && !ks.includes(k)) ks.push(k); }
            return ks;
          })();
          // 位置参数
          if (Object.keys(inline).length === 0 && rest) {
            const pos = /[|｜]/.test(rest) ? rest.split(/[|｜]/g).map(s=>s.trim()).filter(Boolean) : [rest];
            values = Object.fromEntries(keys.map((k, idx)=> [k, pos[idx] ?? '']));
          } else {
            // 合并默认值
            const defaults: Record<string,string> = Object.fromEntries((matched.variables||[]).map((v:any)=> [v.key, v.defaultValue ?? '']));
            values = { ...defaults, ...inline };
          }
          const rendered = renderPromptContent(String(matched.content||''), values);
          if (rendered && rendered.trim()) {
            // 同步“发送”动作的行为：若存在“| ”后的文本且模板未显式消化它，也要附加到末尾
            userMessage = `${rendered.trim()}${afterTail}`;
            // 计数一次使用（兜底渲染也算使用）
            try { usePromptStore.getState().touchUsage(matched.id as string); } catch {}
          }
        }
      } catch {}
    }
    
    if (attachedImages.length > 0) {
      const imagesData = attachedImages.map(img => img.base64Data);
      onSendMessage(userMessage || '[图片]', undefined, selectedKnowledgeBase ? { id: selectedKnowledgeBase.id, name: selectedKnowledgeBase.name } : undefined, { images: imagesData });
    } else if (editingMessage) {
      // 编辑模式下，保留原引用信息
      const docRef = editingMessage.documentReference
        ? {
            documentReference: editingMessage.documentReference,
            contextData: editingMessage.contextData || ''
          }
        : undefined;
      onSendMessage(
        userMessage,
        docRef,
        editingMessage.knowledgeBaseReference
      );
      // 退出编辑模式
      onCancelEdit?.();
    } else if (attachedDocument) {
      // 可选：自动拼接文档预览到提示词
      let contentToSend = userMessage;
      try {
        const cfg = getCurrentKnowledgeBaseConfig();
        if (cfg.documentProcessing.autoAttachDocumentPreview) {
          const { preview } = createSafePreview(attachedDocument.content, cfg.documentProcessing.previewTokenLimit);
          contentToSend = `${userMessage}\n\n[Document Preview]\n${preview}`;
        }
      } catch {}

      onSendMessage(contentToSend, {
        documentReference: {
          fileName: attachedDocument.name,
          fileType: attachedDocument.name.split('.').pop() || 'unknown',
          fileSize: attachedDocument.fileSize,
          summary: attachedDocument.summary
        },
        contextData: attachedDocument.content
      }, selectedKnowledgeBase ? { id: selectedKnowledgeBase.id, name: selectedKnowledgeBase.name } : undefined);
    } else {
      // 普通消息，如果有选中的知识库则传递
      onSendMessage(userMessage, undefined, selectedKnowledgeBase ? { id: selectedKnowledgeBase.id, name: selectedKnowledgeBase.name } : undefined);
    }

    setInputValue("");
    setAttachedDocument(null);
    setAttachedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 如果会话提示词为 oneOff，则清除
    try {
      const convId = conversationId;
      if (convId) {
        const conv = useChatStore.getState().conversations.find((c:any)=>c.id===convId);
        const applied = conv?.system_prompt_applied;
        if (applied?.mode === 'oneOff') {
          useChatStore.getState().updateConversation(convId, { system_prompt_applied: null } as any);
        }
      }
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // 1) 若 @ 面板打开，回车只代入选择，不发送（由面板自身处理 onSelect）
      if (mentionOpen) { e.preventDefault(); return; }
      // 2) 若 / 面板打开，也不直接发送
      if (isPanelOpen) { e.preventDefault(); return; }
      // 3) 正常发送
      e.preventDefault();
      handleSend();
    }
  };

  const [attachedImages, setAttachedImages] = useState<{ name: string; dataUrl: string; base64Data: string; fileSize: number }[]>([]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      
      // 将Data URL转换为纯base64字符串（Ollama API要求）
      const base64Data = dataUrl.split(',')[1];
      
      setAttachedImages(prev => [...prev, { 
        name: file.name, 
        dataUrl, // 保留原始Data URL用于UI显示
        base64Data, // 纯base64数据用于API调用
        fileSize: file.size 
      }]);
    }
    e.target.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查是否是可解析的文档类型
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const supportedTypes = ['pdf', 'docx', 'md', 'markdown', 'txt', 'json', 'csv', 'xlsx', 'xls', 'html', 'htm', 'rtf', 'epub'];
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB，与后端限制一致
    if (file.size > MAX_SIZE) {
      toast.error('文档过大', { description: `当前限制为 ${Math.round(MAX_SIZE/1024/1024)}MB，请拆分后再试` });
      e.target.value = "";
      return;
    }
    
    if (supportedTypes.includes(fileExtension || '')) {
      // 处理文档解析
      await handleDocumentParsing(file);
    } else if (onFileUpload) {
      // 处理其他类型文件上传
      onFileUpload(file);
    }
    
    e.target.value = "";
  };

  const handleDocumentParsing = async (file: File) => {
    setIsParsingDocument(true);
    
    try {
      // 使用DocumentParser解析文件
      const result = await DocumentParser.parseFileObject(file, { maxFileSize: 20 * 1024 * 1024, timeoutMs: 30_000 });
      
      if (result.success && result.content) {
        const summary = DocumentParser.getDocumentSummary(result.content, 150);
        // 生成安全预览，防止误把超长文本拼进后续提示词
        const { preview } = createSafePreview(result.content, 6000);

        setAttachedDocument({
          name: file.name,
          content: DocumentParser.cleanDocumentContent(preview),
          summary,
          fileSize: file.size
        });
      } else {
        // 解析失败，显示错误信息
        toast.error(`文档解析失败`, {
          description: result.error || '未知错误'
        });
      }

      // 自动聚焦到文本输入框
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      
    } catch (error) {
      console.error('文档解析失败:', error);
      toast.error(`文档解析失败`, {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsParsingDocument(false);
    }
  };

  const removeAttachedDocument = () => {
    setAttachedDocument(null);
  };

  return (
    <div className="input-area bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg rounded-xl mx-0 mb-4 p-3 overflow-x-hidden">
      {/* 编辑模式提示栏 */}
      {editingMessage && (
        <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 text-xs text-yellow-800 dark:text-yellow-200 rounded-md px-3 py-1 mb-2">
          <span>正在编辑之前的消息，发送后将作为新消息重新提交</span>
          <button className="text-xs underline" onClick={onCancelEdit}>取消编辑</button>
        </div>
      )}

      {selectedKnowledgeBase && (
        <SelectedKnowledgeBaseView
          knowledgeBase={selectedKnowledgeBase}
          onRemove={handleRemoveKnowledgeBase}
        />
      )}

      {attachedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group">
              <img src={img.dataUrl} alt="img" className="w-24 h-24 object-cover rounded" />
              <button
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs hidden group-hover:block"
                onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {attachedDocument && (
        <div className="w-full max-w-full overflow-hidden px-1">
          <AttachedDocumentView
            document={attachedDocument}
            onRemove={removeAttachedDocument}
            onIndexed={(kbId) => setSelectedKnowledgeBase(prev => prev || { id: kbId, name: '临时收纳箱' } as any)}
          />
        </div>
      )}

      <div className="relative mt-1">
        <SlashPromptPanel
          open={isPanelOpen}
          onOpenChange={setIsPanelOpen}
          onSelect={(id, opts) => {
            if (!conversationId) { setIsPanelOpen(false); return; }
            const merged = { ...(inlineVarsRef.current||{}) };
            inlineVarsRef.current = {};
            const action = opts?.action || 'apply';
            if (action === 'fill') {
              const prompt = usePromptStore.getState().prompts.find(p=>p.id===id);
              if (prompt) {
                // 渲染内容
                let variableValues: Record<string,string> = merged as any;
                const pos = (merged as any).__positional as string[] | undefined;
                if (Array.isArray(pos)) {
                  const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
                  const keys: string[] = [];
                  let m: RegExpExecArray | null;
                  while ((m = pattern.exec(String(prompt.content||'')))) { const k = m[1]; if (k && !keys.includes(k)) keys.push(k); }
                  if (keys.length > 0) {
                    variableValues = Object.fromEntries(keys.map((k, idx)=> [k, pos[idx] ?? '']));
                  } else if (prompt.variables && prompt.variables.length > 0) {
                    variableValues = Object.fromEntries((prompt.variables||[]).map((v:any, idx:number)=> [v.key, pos[idx] ?? v.defaultValue ?? '']));
                  }
                }
                const rendered = (renderPromptContent as any)(prompt.content, variableValues);
                if (rendered && rendered.trim()) {
                  // 用渲染结果替换 /指令+变量 片段（支持 | 分隔后文本拼接）
                  setInputValue(v => replaceSlashWithRendered(v, rendered));
                  // 计数一次使用（代入即视为使用）
                  try { usePromptStore.getState().touchUsage(id); } catch {}
                }
              }
              setIsPanelOpen(false);
              return;
            }
            if (action === 'send') {
              // 直接发送一次：渲染提示词内容并发送
              const prompt = usePromptStore.getState().prompts.find(p=>p.id===id);
              if (prompt) {
                let variableValues: Record<string,string> = merged as any;
                const pos = (merged as any).__positional as string[] | undefined;
                if (Array.isArray(pos)) {
                  // 优先使用模板中的 {{var}} 顺序推导键名
                  const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
                  const keys: string[] = [];
                  let m: RegExpExecArray | null;
                  while ((m = pattern.exec(String(prompt.content||'')))) { const k = m[1]; if (k && !keys.includes(k)) keys.push(k); }
                  if (keys.length > 0) {
                    variableValues = Object.fromEntries(keys.map((k, idx)=> [k, pos[idx] ?? '']));
                  } else if (prompt.variables && prompt.variables.length > 0) {
                    variableValues = Object.fromEntries((prompt.variables||[]).map((v:any, idx:number)=> [v.key, pos[idx] ?? v.defaultValue ?? '']));
                  }
                }
                const rendered = (renderPromptContent as any)(prompt.content, variableValues);
                if (rendered && rendered.trim()) {
                  // 组装：若存在 "| " 分隔的后续文本，将其按换行拼接
                  const parsed = parseLeadingSlash(inputValue);
                  const after = parsed && parsed.hasDelimiter && parsed.postText ? `\n${parsed.postText}` : '';
                  // 只设置一次，避免随后 strip 再次覆盖导致丢失后续文本
                  setInputValue(`${rendered}${after}`);
                  // 计数一次使用
                  try { usePromptStore.getState().touchUsage(id); } catch {}
                  // 立即发送
                  setTimeout(() => { handleSend(); }, 0);
                }
              }
              setIsPanelOpen(false);
              return;
            }
            // 应用为 system：支持 permanent / oneOff
            const mode = opts?.mode || 'permanent';
            try {
              const prompt = usePromptStore.getState().prompts.find(p=>p.id===id);
              let variableValues: Record<string,string> = merged as any;
              const pos = (merged as any).__positional as string[] | undefined;
               if (prompt && Array.isArray(pos)) {
                const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
                const keys: string[] = [];
                let m: RegExpExecArray | null;
                while ((m = pattern.exec(String(prompt.content||'')))) { const k = m[1]; if (k && !keys.includes(k)) keys.push(k); }
                if (keys.length > 0) {
                  variableValues = Object.fromEntries(keys.map((k, idx)=> [k, pos[idx] ?? '']));
                } else if (prompt.variables && prompt.variables.length > 0) {
                  variableValues = Object.fromEntries((prompt.variables||[]).map((v:any, idx:number)=> [v.key, pos[idx] ?? v.defaultValue ?? '']));
                }
              }
              useChatStore.getState().updateConversation(conversationId, { system_prompt_applied: { promptId: id, variableValues, mode } as any });
              setInputValue(v => stripFirstSlashToken(v));
              toast.success(mode === 'oneOff' ? '已作为一次性系统提示词应用' : '已应用到当前会话');
            } catch {}
            setIsPanelOpen(false);
          }}
          anchorRef={textareaRef as any}
          queryText={inputValue}
        />
        {/* 高亮覆盖层：与 textarea 完全重叠，渲染 “/指令 + 变量 + (可选) | + 后续文本”。
            为避免重影，textarea 在有 /指令 时使用 text-transparent，仅显示插入符。 */}
        {(() => {
          const parsed = parseLeadingSlash(inputValue);
          // 高亮 @mcp 引用（淡绿色） + 兼容 / 指令高亮
          const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g;
          const renderMentions = (text: string) => {
            const parts: React.ReactNode[] = [];
            let last = 0; let m: RegExpExecArray | null;
            while ((m = mentionRe.exec(text))) {
              const i = m.index;
              if (i > last) parts.push(text.slice(last, i));
              parts.push(<span key={i} className="bg-emerald-50 text-emerald-700 rounded px-0.5">{m[0]}</span>);
              last = i + m[0].length;
            }
            if (last < text.length) parts.push(text.slice(last));
            return parts;
          };
          if (!parsed && hasMentionOverlay) {
            // 无 / 指令时，仅做 @ 提示的淡绿色高亮
            return (
              <div className="absolute inset-px pointer-events-none select-none overflow-hidden">
                <div className="pl-14 pr-16 py-[11px] pb-12 whitespace-pre-wrap text-sm tabular-nums" style={{ fontFamily: overlayFont || undefined, fontSize: overlayFontSize || undefined, lineHeight: overlayLineHeight || undefined }}>
                  {renderMentions(inputValue)}
                </div>
              </div>
            );
          }
          if (!parsed) return null;
          const { leadingSpace, token, prefixRaw, hasDelimiter, postRaw } = parsed;
          const prefixText = `/${token}${prefixRaw}${hasDelimiter ? ' | ' : ''}`;
          return (
            <div className="absolute inset-px pointer-events-none select-none overflow-hidden">
              <div className="pl-14 pr-16 py-[11px] pb-12 whitespace-pre-wrap text-sm tabular-nums" style={{ fontFamily: overlayFont || undefined, fontSize: overlayFontSize || undefined, lineHeight: overlayLineHeight || undefined }}>
                {/* 保留前导空格 */}
                {leadingSpace}
                {/* 高亮整段 /token + 变量 + 可选“ | ”，保持与原文本完全一致，避免光标错位 */}
                <span className="rounded bg-yellow-100/70 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100 shadow-sm" style={{ fontFeatureSettings: '"liga" 0, "clig" 0', fontFamily: overlayFont || undefined, fontSize: overlayFontSize || undefined, lineHeight: overlayLineHeight || undefined }}>{prefixText}</span>
                {/* 竖线后的普通文本按原样展示（不高亮）*/}
                {hasDelimiter && postRaw ? <>{renderMentions(postRaw)}</> : null}
              </div>
            </div>
          );
        })()}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="开始对话吧… 输入 / 可快速调用提示词 输入 @ 可指定MCP服务"
          className={cn(
            "relative z-[1] w-full pl-14 pr-16 py-[10px] pb-10 resize-none rounded-md border border-gray-300/70 dark:border-gray-600 bg-transparent focus:outline-none focus:border-slate-400/60 dark:focus:border-slate-500/60 transition-all text-sm min-h-[66px] placeholder:text-[13px] placeholder:text-gray-400/90 dark:placeholder:text-gray-400",
            (hasSlashOverlay || hasMentionOverlay) ? "text-transparent caret-gray-900 dark:caret-gray-100 tabular-nums" : "text-gray-900 dark:text-gray-100 tabular-nums"
          )}
          style={undefined}
          rows={3}
          disabled={disabled || isParsingDocument}
        />
        <McpMentionPanel
          open={mentionOpen}
          anchorRef={textareaRef as any}
          filterQuery={(inputValue.match(/@([a-zA-Z0-9_-]*)$/)?.[1] || '')}
          onSelect={(name)=>{
            const el = textareaRef.current; if (!el) return;
            const next = inputValue.replace(/@([a-zA-Z0-9_-]*)$/, `@${name} `);
            setInputValue(next);
            setTimeout(()=>{ el.selectionStart = el.selectionEnd = next.length; el.focus(); },0);
            setMentionOpen(false);
          }}
          onClose={()=>setMentionOpen(false)}
        />
        <div className="absolute left-2 bottom-4 z-[2] flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={disabled || isLoading}
                  className="h-7 w-7 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <Image className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上传图片</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isLoading || !!attachedDocument}
                  className="h-7 w-7 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {isParsingDocument ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>附加文档</TooltipContent>
            </Tooltip>
            <KnowledgeBaseSelector 
               onSelect={setSelectedKnowledgeBase}
               selectedKnowledgeBase={selectedKnowledgeBase}
            />
            {/* 会话参数设置按钮 */}
            <McpQuickToggle onInsertMention={(name)=>{
              // 在光标处插入 @name，并使用淡绿色高亮
              const el = textareaRef.current;
              if (!el) return;
              const start = el.selectionStart || 0;
              const end = el.selectionEnd || 0;
              const mention = `@${name} `; // 末尾加空格，避免粘连
              const next = inputValue.slice(0, start) + mention + inputValue.slice(end);
              setInputValue(next);
              // 将光标移到插入后
              setTimeout(() => { el.selectionStart = el.selectionEnd = start + mention.length; el.focus(); }, 0);
            }} />
            {providerName && modelId && conversationId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSessionParametersDialogOpen(true)}
                    disabled={disabled || isLoading}
                    className={cn(
                      "h-7 w-7 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600",
                      currentSessionParameters && "text-blue-500 hover:text-blue-600"
                    )}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {currentSessionParameters ? "会话参数已自定义" : "会话参数设置"}
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/*"
            disabled={disabled}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf, .docx, .md, .markdown, .txt, .json, .csv, .xlsx, .xls, .html, .htm, .rtf, .epub"
            disabled={disabled}
          />
        </div>
        <div className="absolute right-3 bottom-3 z-[2] flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-0.5 text-gray-400">
                  <CornerDownLeft className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Shift+Enter 换行</TooltipContent>
            </Tooltip>
            {/* Token 指示：放在按钮左侧，等宽数字 + 最小宽度，样式 T: 277 */}
            {tokenCount > 0 && (
              <span className="text-xs text-gray-500 mr-2 select-none font-mono tabular-nums inline-flex items-center justify-end min-w-[64px]">
                T: {tokenCount}
              </span>
            )}
            {isLoading ? (
             <Button
                variant="ghost"
                size="icon"
                onClick={onStopGeneration}
                className="h-8 w-8 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                title="停止生成"
             >
                <StopCircle className="w-5 h-5" />
             </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSend}
                disabled={disabled || isLoading || (!inputValue.trim() && !attachedDocument)}
                className={cn(
                  "h-8 w-8 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity",
                  (disabled || isLoading || (!inputValue.trim() && !attachedDocument)) && 'opacity-0 pointer-events-none'
                )}
              >
                <Send className="w-5 h-5" />
              </Button>
            </>
          )}
          </TooltipProvider>
        </div>
      </div>

      {/* 会话参数设置弹窗 */}
      {providerName && modelId && conversationId && (
        <SessionParametersDialog
          open={sessionParametersDialogOpen}
          onOpenChange={setSessionParametersDialogOpen}
          providerName={providerName}
          modelId={modelId}
          modelLabel={modelLabel}
          conversationId={conversationId}
          onParametersChange={onSessionParametersChange || (() => {})}
          currentParameters={currentSessionParameters}
        />
      )}
      {/* 已移除“应用范围”弹窗，选择即应用 */}
    </div>
  );
} 