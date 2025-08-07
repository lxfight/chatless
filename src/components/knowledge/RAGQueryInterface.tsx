"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, AlertCircle, CheckCircle, Loader2, Bot, Settings } from 'lucide-react';
import { RAGService } from '@/lib/rag/RAGService';
import { createDefaultRAGConfig } from '@/lib/rag/RAGService';
import { initializeLLM } from '@/lib/llm';
import type { RAGQueryResult, RAGQueryProgress, RetrievedChunk } from '@/lib/rag/types';
import { metadataService } from '@/lib/metadata/MetadataService';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
}

export function RAGQueryInterface() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RAGQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RAGQueryProgress | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  
  // LLM配置状态
  const [llmProviders, setLlmProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [llmInitialized, setLlmInitialized] = useState(false);
  
  const ragServiceRef = useRef<RAGService | null>(null);

  // 初始化
  useEffect(() => {
    initializeComponents();
  }, []);

  const initializeComponents = async () => {
    try {
      // 初始化LLM
      const llmReady = await initializeLLM();
      setLlmInitialized(llmReady);
      
      // 获取LLM提供商
      const metadata = await metadataService.get();
      setLlmProviders(metadata);
      
      // 设置默认提供商和模型
      if (metadata.length > 0) {
        const defaultProvider = metadata[0];
        setSelectedProvider(defaultProvider.name);
        if (defaultProvider.models.length > 0) {
          setSelectedModel(defaultProvider.models[0].name);
        }
      }

      // 模拟知识库数据（替代knowledgeService）
      setKnowledgeBases([
        { id: '1', name: '技术文档', description: '技术相关文档' },
        { id: '2', name: '产品手册', description: '产品使用手册' },
        { id: '3', name: '研究资料', description: '研究相关资料' }
      ]);

      // 初始化RAG服务
      const config = createDefaultRAGConfig();
      
      // 配置LLM设置
      if (metadata.length > 0) {
        config.llm = {
          provider: metadata[0].name,
          model: metadata[0].models[0]?.name || '',
          maxTokens: 2048,
          temperature: 0.7
        };
      }
      
      ragServiceRef.current = new RAGService(config);
      await ragServiceRef.current.initialize();
      
    } catch (err) {
      console.error('初始化失败:', err);
      setError('初始化失败，请刷新页面重试');
    }
  };

  const updateLLMConfig = async () => {
    if (!ragServiceRef.current || !selectedProvider || !selectedModel) return;
    
    try {
      await ragServiceRef.current.updateConfig({
        llm: {
          provider: selectedProvider,
          model: selectedModel,
          maxTokens: 2048,
          temperature: 0.7
        }
      });
    } catch (err) {
      console.error('更新LLM配置失败:', err);
    }
  };

  // 当LLM选择改变时更新配置
  useEffect(() => {
    updateLLMConfig();
  }, [selectedProvider, selectedModel]);

  const handleQuery = async () => {
    if (!query.trim() || !ragServiceRef.current) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setStreamingAnswer('');

    try {
      const ragService = ragServiceRef.current;
      
      // 使用流式查询
      const queryParams = {
        query: query.trim(),
        knowledgeBaseIds: selectedKbIds.length > 0 ? selectedKbIds : undefined,
        topK: 5,
        similarityThreshold: 0.3,
        stream: true
      };

      for await (const response of ragService.queryStream(queryParams)) {
        switch (response.type) {
          case 'progress':
            setProgress(response.data as RAGQueryProgress);
            break;
            
          case 'chunk':
            // 检索到的片段，可以实时显示
            console.log('检索到片段:', response.data);
            break;
            
          case 'answer':
            // 流式回答token
            setStreamingAnswer(prev => prev + (response.data as string));
            break;
            
          case 'complete':
            // 查询完成
            const finalResult = response.data as RAGQueryResult;
            setResult(finalResult);
            setProgress(null);
            break;
            
          case 'error':
            throw response.data as Error;
        }
      }
      
    } catch (err) {
      console.error('查询失败:', err);
      setError(err instanceof Error ? err.message : '查询失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedModels = () => {
    const provider = llmProviders.find(p => p.name === selectedProvider);
    return provider?.models || [];
  };

  return (
    <div className="space-y-6">
      {/* LLM配置区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <CardTitle>AI模型配置</CardTitle>
            <Badge variant={llmInitialized ? "default" : "secondary"}>
              {llmInitialized ? "已连接" : "未连接"}
            </Badge>
          </div>
          <CardDescription>
            选择用于生成回答的AI模型
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">AI提供商</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="选择AI提供商" />
                </SelectTrigger>
                <SelectContent>
                  {llmProviders.map((provider) => (
                    <SelectItem key={provider.name} value={provider.name}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">模型</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {getSelectedModels().map((model: any) => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 查询区域 */}
      <Card>
        <CardHeader>
          <CardTitle>智能问答</CardTitle>
          <CardDescription>
            基于知识库内容进行智能问答，支持多知识库联合检索
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 知识库选择 */}
          <div>
            <label className="text-sm font-medium mb-2 block">知识库选择</label>
            <Select value={selectedKbIds.join(',')} onValueChange={(value) => setSelectedKbIds(value ? value.split(',') : [])}>
              <SelectTrigger>
                <SelectValue placeholder="选择知识库（留空则搜索所有）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">所有知识库</SelectItem>
                {knowledgeBases.map((kb) => (
                  <SelectItem key={kb.id} value={kb.id}>
                    {kb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 查询输入 */}
          <div className="flex gap-2">
            <Input
              placeholder="输入您的问题..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleQuery()}
              disabled={isLoading}
            />
            <Button 
              onClick={handleQuery} 
              disabled={!query.trim() || isLoading || !llmInitialized}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              查询
            </Button>
          </div>

          {/* 进度显示 */}
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.message}</span>
                <span>{progress.completedSteps}/{progress.totalSteps}</span>
              </div>
              {/* 简单的进度条实现 */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 错误显示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 结果显示 */}
      {(streamingAnswer || result) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <CardTitle>AI回答</CardTitle>
              {result && (
                <Badge variant="outline">
                  {result.metadata.duration}ms
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {streamingAnswer && (
                <div className="whitespace-pre-wrap">{streamingAnswer}</div>
              )}
              {result && !streamingAnswer && (
                <div className="whitespace-pre-wrap">{result.answer}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 来源片段显示 */}
      {result && result.chunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>相关来源</CardTitle>
            <CardDescription>
              找到 {result.chunks.length} 个相关片段，来自 {result.metadata.knowledgeBaseCount} 个知识库
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.chunks.map((chunk, index) => (
                <div key={chunk.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <span className="text-sm font-medium">{chunk.knowledgeBaseName}</span>
                      {chunk.documentName && (
                        <span className="text-sm text-muted-foreground">/ {chunk.documentName}</span>
                      )}
                    </div>
                    <Badge variant="outline">
                      相似度: {(chunk.score * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 