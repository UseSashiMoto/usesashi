import { MessageItem } from '@/store/models';
import { ArrowDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { MessageComponent } from './MessageComponent';

interface MessageListProps {
  messages: MessageItem[];
  isLoading?: boolean;
  loadingContent?: string;
  onRetry?: (originalText?: string) => void;
}

/**
 * Completely rewritten message list with proper scroll handling
 * Features:
 * - Isolated scroll container
 * - Smart auto-scroll (only when at bottom)
 * - "Scroll to bottom" button when not at bottom
 * - No interference with form inputs
 * - Proper height calculations
 */
export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading = false, loadingContent, onRetry }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomMarkerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  // Check if user is near bottom of scroll container
  const checkIfNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const threshold = 150; // pixels from bottom
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    return distanceFromBottom < threshold;
  };

  // Scroll to bottom smoothly
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomMarkerRef.current?.scrollIntoView({
      behavior,
      block: 'end',
      inline: 'nearest',
    });
    setUserHasScrolled(false);
    setIsNearBottom(true);
  };

  // Handle scroll events
  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);

    // Mark that user has scrolled (if scrolling up)
    if (!nearBottom && !userHasScrolled) {
      setUserHasScrolled(true);
    }
  };

  // Auto-scroll on new messages (only if user was at bottom)
  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messageCountChanged) {
      // If user is near bottom or hasn't scrolled yet, auto-scroll
      if (isNearBottom || !userHasScrolled) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 50);
      }
    }
  }, [messages.length, isNearBottom, userHasScrolled]);

  // Auto-scroll on loading state change
  useEffect(() => {
    if (isLoading && isNearBottom) {
      setTimeout(() => {
        scrollToBottom('smooth');
      }, 50);
    }
  }, [isLoading, isNearBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    // Scroll immediately on mount
    setTimeout(() => {
      scrollToBottom('auto');
    }, 100);
  }, []);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Scrollable message container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Inner content wrapper */}
        <div className="flex flex-col gap-3 px-4 md:px-0 pt-20 pb-4 items-center">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="w-full md:w-[500px]">
              <div className="border rounded-lg p-6 flex flex-col gap-4 text-zinc-500 text-sm dark:text-zinc-400 dark:border-zinc-700">
                <p className="text-zinc-900 dark:text-zinc-50 font-semibold">Welcome to Sashi Bot 👋</p>
                <p>
                  Sashi is a platform that can be used to do administrative tasks on your application. It can be
                  integrated with your application using the Sashi SDK.
                </p>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message, index) => (
            <MessageComponent
              key={message.id}
              role={message.role}
              content={message.content}
              isError={message.isError}
              retryData={message.retryData}
              onRetry={onRetry}
              isLatestMessage={index === messages.length - 1}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && <MessageComponent role="assistant" isThinking={true} content={loadingContent} />}

          {/* Bottom marker for scrollIntoView */}
          <div ref={bottomMarkerRef} className="h-1" />
        </div>
      </div>

      {/* Scroll to bottom button (FAB style) */}
      {!isNearBottom && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <Button
            onClick={() => scrollToBottom('smooth')}
            className="rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 flex items-center gap-2"
            size="sm"
          >
            <ArrowDown className="h-4 w-4" />
            <span className="text-sm">New messages</span>
          </Button>
        </div>
      )}
    </div>
  );
};
