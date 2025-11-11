export interface ContentAppender {
  append: (chunk: string) => void;
  flush: () => void;
}

/**
 * 负责将内容增量写入内存，并做轻量自动持久化节流。
 * - 每累计 ~200 字符触发一次 updateMessage 持久化
 */
export function createContentAppender(params: {
  assistantMessageId: string;
  updateMessageContentInMemory: (id: string, content: string) => void;
  updateMessage: (id: string, patch: any) => Promise<void>;
  getCurrentContent: () => string;
}): ContentAppender {
  let autosaveBuffer = '';
  return {
    append: (chunk: string) => {
      if (!chunk) return;
      const prev = params.getCurrentContent();
      const next = prev + chunk;
      params.updateMessageContentInMemory(params.assistantMessageId, next);
      autosaveBuffer += chunk;
      if (autosaveBuffer.length > 200) {
        autosaveBuffer = '';
        try { void params.updateMessage(params.assistantMessageId, { content: next }); } catch { /* noop */ }
      }
    },
    flush: () => {
      const latest = params.getCurrentContent();
      try { void params.updateMessage(params.assistantMessageId, { content: latest }); } catch { /* noop */ }
    }
  };
}


