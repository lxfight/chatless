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
        <div className="p-2 text-center bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          LLM 服务正在初始化...
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