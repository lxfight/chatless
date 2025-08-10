"use client";

import React, { useRef, useState, useEffect } from "react";
import { Send, Image, Code, Paperclip, Square, FileText, Loader2, Database, X, StopCircle, CornerDownLeft, Settings } from "lucide-react";
import { DocumentParser } from '@/lib/documentParser';
import { DocumentParseResult } from '@/types/document';
import { KnowledgeService, KnowledgeBase } from '@/lib/knowledgeService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { KnowledgeBaseSelector } from "./input/KnowledgeBaseSelector";
import { AttachedDocumentView } from "./input/AttachedDocumentView";
import { SelectedKnowledgeBaseView } from "./input/SelectedKnowledgeBaseView";
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BrainCircuit } from 'lucide-react';
import { SessionParametersDialog } from './SessionParametersDialog';
import type { ModelParameters } from '@/types/model-params';
import { createSafePreview } from '@/lib/utils/tokenBudget';
import { getCurrentKnowledgeBaseConfig } from '@/lib/knowledgeBaseConfig';

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

    const userMessage = inputValue.trim();
    
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
    <div className="input-area bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg rounded-xl mx-0 mb-4 p-3">
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
        <div className="max-w-full overflow-hidden px-1">
          <AttachedDocumentView
            document={attachedDocument}
            onRemove={removeAttachedDocument}
            onIndexed={(kbId) => setSelectedKnowledgeBase(prev => prev || { id: kbId, name: '临时收纳箱' } as any)}
          />
        </div>
      )}

      <div className="relative mt-1">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="w-full pl-14 pr-14 py-3 resize-none rounded-md border border-gray-300/70 dark:border-gray-600 bg-white/60 dark:bg-gray-800/30 focus:outline-none focus:border-slate-400/60 dark:focus:border-slate-500/60 transition-all text-sm min-h-[52px] placeholder:text-gray-400 dark:placeholder:text-gray-500"
          rows={3}
          disabled={disabled || isParsingDocument}
        />
        <div className="absolute left-2 bottom-4 flex items-center gap-1">
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
        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-0.5 text-gray-400">
                  <CornerDownLeft className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Shift+Enter 换行</TooltipContent>
            </Tooltip>
            {tokenCount > 0 && (
              <span className="text-xs text-gray-500 mr-2 select-none">Tokens: {tokenCount}</span>
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
    </div>
  );
} 