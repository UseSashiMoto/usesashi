'use client';

import { motion } from 'framer-motion';
import React from 'react';
import { Button } from './Button';
import { DataCardComponent } from './DataCardComponent';

import { BotIcon, UserIcon } from './message-icons';
import { TableComponent } from './TableComponent';

interface VisualizationContent {
  type: string;
  data: any;
}

interface RetryData {
  originalText?: string;
  retryText: string;
  canRetry: boolean;
}

interface MessageProps {
  role: 'assistant' | 'user';
  content?: string | VisualizationContent;
  isThinking?: boolean;
  isError?: boolean;
  retryData?: RetryData;
  onRetry?: (originalText?: string) => void;
}

export const Message = ({ role, content, isThinking, isError, retryData, onRetry }: MessageProps) => {
  let visualizationComponent: React.ReactNode | string | undefined;

  // Handle different visualization types dynamically
  if (typeof content === 'object' && content.type) {
    switch (content.type) {
      case 'table':
        visualizationComponent = <TableComponent data={content.data} />;
        break;
      case 'dataCard':
        visualizationComponent = <DataCardComponent {...content.data} />;
        break;
      default:
        visualizationComponent = <p>Unsupported visualization type.</p>;
    }
  } else if (typeof content === 'string') {
    // Enhanced markdown-style rendering for error messages
    const processedContent = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(
        /```json\n([\s\S]*?)\n```/g,
        '<pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto"><code>$1</code></pre>'
      ) // JSON code blocks
      .replace(
        /```([\s\S]*?)```/g,
        '<pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto"><code>$1</code></pre>'
      ) // Regular code blocks
      .replace(/\n/g, '<br>'); // Line breaks

    visualizationComponent = (
      <div
        className={`${isError ? 'text-red-600 dark:text-red-400' : ''}`}
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  } else {
    visualizationComponent = <p>Invalid content type</p>;
  }

  return (
    <motion.div
      className="flex flex-row gap-4 px-4 w-full md:w-[500px] md:px-0 first-of-type:pt-20"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] flex flex-col justify-center items-center flex-shrink-0 text-zinc-400">
        {role === 'assistant' ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-1 w-full">
        <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
          {isThinking ? <ThinkingIndicator /> : visualizationComponent}

          {/* Retry button for error messages */}
          {isError && retryData?.canRetry && onRetry && (
            <div className="flex gap-2 mt-2">
              <Button onClick={() => onRetry(retryData.originalText)} variant="outline" size="sm" className="text-sm">
                🔄 {retryData.retryText}
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

function ThinkingIndicator() {
  return (
    <div className="flex items-center space-x-2" aria-live="polite" aria-label="Bot is thinking">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">Thinking</span>
      <div className="flex items-center space-x-1">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
            initial={{ scale: 0.5, opacity: 0.5 }}
            animate={{ scale: [0.5, 1, 0.5], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}
