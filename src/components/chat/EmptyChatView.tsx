import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { ProviderMetadata } from '@/lib/metadata/types';

interface EmptyChatViewProps {
  allMetadata: ProviderMetadata[];
  selectedModelId: string | null;
  onModelChange: (modelId: string) => void;
  isLoading: boolean;
  llmInitialized: boolean;
  onSendMessage: (content: string, documentData?: any, knowledgeBase?: any) => Promise<void>;
  onStopGeneration: () => void;
  tokenCount?: number;
  onPromptClick: (prompt: string) => void;
  selectedKnowledgeBaseId?: string;
  onImageUpload: (file: File) => void;
  onFileUpload: (file: File) => void;
}

export const EmptyChatView: React.FC<EmptyChatViewProps> = ({
  allMetadata,
  selectedModelId,
  onModelChange,
  isLoading,
  llmInitialized,
  onSendMessage,
  onStopGeneration,
  onPromptClick,
  selectedKnowledgeBaseId,
  onImageUpload,
  onFileUpload,
  tokenCount = 0
}) => {
  const handleShare = () => console.log('Share clicked');
  const handleDownload = () => console.log('Download clicked');

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 min-w-0">
      <ChatHeader
        title="AI Chat"
        allMetadata={allMetadata}
        currentModelId={selectedModelId}
        onModelChange={onModelChange}
        isModelSelectorDisabled={isLoading || !llmInitialized}
        onTitleChange={() => {}} 
        onDelete={() => {}} 
        onShare={handleShare}
        onDownload={handleDownload}
        tokenCount={tokenCount}
      />

      {!llmInitialized && (
        <div className="p-2 text-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200 shadow-sm">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
              <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            LLM 服务正在初始化，请稍候…
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
        <div className="max-w-full w-full min-w-0 flex items-center justify-center h-full">
          <ChatEmptyState onPromptClick={onPromptClick} />
        </div>
      </div>

      <ChatInput
        onSendMessage={onSendMessage}
        onImageUpload={onImageUpload}
        onFileUpload={onFileUpload}
        isLoading={isLoading}
        disabled={!llmInitialized || !selectedModelId}
        onStopGeneration={onStopGeneration}
        selectedKnowledgeBaseId={selectedKnowledgeBaseId}
        tokenCount={tokenCount}
      />
    </div>
  );
}; 