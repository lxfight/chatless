"use client";

import { useState, memo } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string | null;
  code: string;
}

const CodeBlock = memo(({ language, code }: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      void err;
    }
  };

  const detectedLanguage = language || 'bash';

  return (
    <div className="relative group my-4 rounded-md bg-[#282c34] text-slate-100 w-full max-w-full min-w-0 overflow-x-auto">
      {/* 复制按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { void copyToClipboard(); }}
        className={cn(
          "absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          isCopied
            ? "text-emerald-500"
            : "text-[#7D7C78] hover:bg-[#ECEBE8]"
        )}
        title={isCopied ? "已复制" : "复制代码"}
      >
        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>

      <div className="w-full max-w-full min-w-0">
        <SyntaxHighlighter
          language={detectedLanguage}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            backgroundColor: '#282c34',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            width: '100%',
            maxWidth: '100%',
          }}
          codeTagProps={{
            style: {
              fontFamily: '"Fira Code", "Courier New", monospace',
              whiteSpace: 'pre',
              display: 'block',
              minWidth: 0,
              maxWidth: '100%',
            },
          }}
          wrapLongLines={false}
          showLineNumbers={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

export { CodeBlock }; 