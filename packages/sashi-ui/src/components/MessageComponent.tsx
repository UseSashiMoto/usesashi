'use client';

import { motion } from 'framer-motion';
import React from 'react';
import { DataCardComponent } from './DataCardComponent';

import { BotIcon, UserIcon } from './message-icons';
import { TableComponent } from './TableComponent';

interface VisualizationContent {
  type: string;
  data: any;
}
interface MessageProps {
  role: 'assistant' | 'user';
  content?: string | VisualizationContent;
  isThinking?: boolean;
}

export const Message = ({ role, content, isThinking }: MessageProps) => {
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
    visualizationComponent = content;
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
