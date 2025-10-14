'use client';

import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import useAppStore from '../store/chat-store';
import { detectWorkflowEntryType } from '../utils/workflowClassification';
import { Button } from './Button';
import { DataCardComponent } from './DataCardComponent';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { WorkflowUICard } from './workflows/WorkflowUICard';

import { WorkflowResponse } from '@/models/payload';
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
  isLatestMessage?: boolean; // New prop to identify if this is the latest message
}

interface MessagePart {
  type: 'text' | 'workflow';
  content: string;
  workflow?: WorkflowResponse;
}

// Global state for managing which workflow is expanded
let expandedWorkflowId: string | null = null;

export const parseMessageContent = (content: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  const workflowRegex = /```workflow\s*\n([\s\S]*?)\n```/gi;

  let lastIndex = 0;
  let match;

  while ((match = workflowRegex.exec(content)) !== null) {
    // Add text before workflow
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add workflow
    try {
      const workflowJson = match[1]?.trim();
      if (!workflowJson) {
        throw new Error('Empty workflow block');
      }

      // Remove single-line comments before parsing
      const jsonWithoutComments = workflowJson
        .split('\n')
        .map((line) => {
          const commentIndex = line.indexOf('//');
          return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
        })
        .join('\n');

      const workflow = JSON.parse(jsonWithoutComments);

      // Final validation of the parsed object structure
      if (workflow && workflow.type === 'workflow' && Array.isArray(workflow.actions)) {
        parts.push({
          type: 'workflow',
          content: match[0],
          workflow: workflow,
        });
      } else {
        // If the structure is not what we expect, treat it as text
        throw new Error('Parsed JSON is not a valid workflow object');
      }
    } catch (error) {
      console.warn('Failed to parse embedded workflow JSON:', (error as Error).message);
      // If parsing or validation fails, treat it as text
      parts.push({
        type: 'text',
        content: match[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last workflow
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex).trim();
    if (remainingContent) {
      parts.push({
        type: 'text',
        content: remainingContent,
      });
    }
  }

  // If no workflows found, return the original content as text
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: content,
    });
  }

  return parts;
};

const WorkflowCard: React.FC<{
  workflow: WorkflowResponse;
  isLatest: boolean;
  messageId: string;
  workflowIndex: number;
}> = ({ workflow, isLatest, messageId, workflowIndex }) => {
  const apiUrl = useAppStore((state) => state.apiUrl);
  const workflowId = `${messageId}_${workflowIndex}`;
  const isExpanded = expandedWorkflowId === workflowId;

  const toggleExpanded = () => {
    if (isExpanded) {
      expandedWorkflowId = null;
    } else {
      expandedWorkflowId = workflowId;
    }
    // Force re-render by updating a dummy state in the parent
    window.dispatchEvent(new CustomEvent('workflowToggle'));
  };

  if (isLatest) {
    // Show full interactive workflow for the latest message
    if (!apiUrl) return null;

    const workflowResponse = workflow;

    const entryType = detectWorkflowEntryType(workflowResponse);

    const uiWorkflowDefinition = {
      workflow: workflowResponse,
      entry: {
        entryType: entryType.entryType,
        description: workflow.description,
        payload: entryType.payload,
      },
    };

    return (
      <div className="my-4">
        <WorkflowUICard workflow={workflowResponse} apiUrl={apiUrl} isInChat={true} isDraggable={false} />
      </div>
    );
  }

  // Show collapsed/expandable card for previous workflows
  return (
    <div className="my-4">
      <Card className="border-l-4 border-blue-500">
        <CardHeader
          className="pb-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={toggleExpanded}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                📋 Previous Workflow
              </CardTitle>
              <CardDescription className="text-xs">
                {workflow.description || 'Workflow'} • {workflow.actions?.length || 0} action
                {workflow.actions?.length === 1 ? '' : 's'}
              </CardDescription>
            </div>
            <div className="flex items-center text-gray-400">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </div>
        </CardHeader>

        {isExpanded && apiUrl && (
          <CardContent className="pt-0">
            <div className="border-t pt-4">
              <WorkflowUICard workflow={workflow} apiUrl={apiUrl} isInChat={true} isDraggable={false} />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

// Memoized MessageComponent to prevent unnecessary re-renders
const MessageComponent = React.memo<MessageProps>(
  ({ role, content, isThinking, isError, retryData, onRetry, isLatestMessage = false }) => {
    const [, forceUpdate] = useState(0);

    // Listen for workflow toggle events to force re-render
    React.useEffect(() => {
      const handleWorkflowToggle = () => {
        forceUpdate((prev) => prev + 1);
      };

      window.addEventListener('workflowToggle', handleWorkflowToggle);
      return () => window.removeEventListener('workflowToggle', handleWorkflowToggle);
    }, []);

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
      // Parse message content for embedded workflows
      const messageParts = parseMessageContent(content);
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      visualizationComponent = (
        <div>
          {messageParts.map((part, index) => {
            if (part.type === 'workflow' && part.workflow) {
              return (
                <WorkflowCard
                  key={`${messageId}_workflow_${index}`}
                  workflow={part.workflow}
                  isLatest={isLatestMessage}
                  messageId={messageId}
                  workflowIndex={index}
                />
              );
            } else {
              // Render text content with proper markdown processing
              return (
                <MarkdownRenderer
                  key={`${messageId}_text_${index}`}
                  content={part.content}
                  className={isError ? 'text-red-600 dark:text-red-400' : ''}
                />
              );
            }
          })}
        </div>
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
  }
);

MessageComponent.displayName = 'MessageComponent';

export { MessageComponent };

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
