import { AutoExpandingTextarea } from '@/components/AutoExpandingTextarea';
import { Button } from '@/components/Button';
import { Layout } from '@/components/Layout';
import { MessageList } from '@/components/MessageList';
import { GeneralResponse, PayloadObject } from '@/models/payload';
import useAppStore from '@/store/chat-store';
import { MessageItem } from '@/store/models';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

function getUniqueId() {
  return Math.random().toString(36).substring(2) + new Date().getTime().toString(36);
}

export const HomePage = () => {
  // Store
  const storedMessages = useAppStore((state) => state.messages);
  const clearMessages = useAppStore((state) => state.clearMessages);
  const addMessage = useAppStore((state) => state.addMessage);
  const connectedToHub = useAppStore((state) => state.connectedToHub);
  const apiUrl = useAppStore((state) => state.apiUrl);

  // Local state
  const [messageItems, setMessageItems] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [isMounted, setMounted] = useState(false);

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debug mode
  const [debug] = useState(process.env.NODE_ENV === 'development');

  // Initialize messages from store
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      setMessageItems(storedMessages);
    }
  }, [isMounted, storedMessages]);

  // Clear messages handler
  const handleClearMessages = useCallback(() => {
    setMessageItems([]);
    clearMessages();
  }, [clearMessages]);

  // Send message to API
  const sendMessage = async (payload: { tools?: any[]; inquiry?: string; previous: any; type: string }) => {
    console.log('🚀 [DEBUG] Sending request to:', `${apiUrl}/chat`);
    console.log('📦 [DEBUG] Payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(`${apiUrl}/chat`, payload, {
        timeout: 65000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ [DEBUG] Response received:', response.status);

      if (!response.data || !response.data.output) {
        throw new Error('Invalid response structure from server');
      }

      return response.data.output as GeneralResponse;
    } catch (error: any) {
      console.error('💥 [DEBUG] Request failed:', error);
      throw error;
    }
  };

  // Process chat message
  const processChat = async ({ text }: { text?: string }) => {
    console.log('🎯 [DEBUG] processChat called with:', { text });

    const previous = messageItems.map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const payload: PayloadObject = {
      inquiry: text,
      previous,
      type: '/chat/message',
    };

    // Set up timeout warning
    const timeoutWarning = setTimeout(() => {
      setLoadingTimeout(true);
    }, 30000);

    try {
      const result = await sendMessage(payload);

      clearTimeout(timeoutWarning);
      setLoadingTimeout(false);

      // Handle response
      let processedResult: GeneralResponse;

      if (result && typeof result === 'object' && 'type' in result && result.type === 'general') {
        processedResult = result as GeneralResponse;
      } else if (result && typeof result === 'object' && 'content' in result) {
        processedResult = {
          type: 'general',
          content: (result as any).content,
        } as GeneralResponse;
      } else if (typeof result === 'string') {
        processedResult = {
          type: 'general',
          content: result,
        } as GeneralResponse;
      } else {
        throw new Error('Unexpected response format from server');
      }

      // Add assistant response
      const newAssistantMessage: MessageItem = {
        id: getUniqueId(),
        created_at: new Date().toISOString(),
        role: 'assistant',
        content: processedResult.content,
      };

      setMessageItems((prev) => [...prev, newAssistantMessage]);
      addMessage(newAssistantMessage);
    } catch (error: any) {
      clearTimeout(timeoutWarning);
      setLoadingTimeout(false);

      console.error('💥 [DEBUG] processChat error:', error);

      // Handle errors with user-friendly messages
      const statusCode = error.response?.status;
      let errorContent = '❌ **Something went wrong**\n\nAn unexpected error occurred while processing your request.';

      if (statusCode === 408) {
        errorContent = '⏱️ **Request Timeout**\n\nYour request took too long to process.';
      } else if (statusCode === 429) {
        errorContent = '🚦 **Too Many Requests**\n\nPlease wait a moment before trying again.';
      } else if (statusCode === 503) {
        errorContent = '🔧 **Service Unavailable**\n\nThe AI service is currently experiencing issues.';
      }

      const errorMessage: MessageItem = {
        id: getUniqueId(),
        created_at: new Date().toISOString(),
        role: 'assistant',
        content: errorContent,
        isError: true,
        retryData: {
          originalText: text,
          retryText: 'Try again',
          canRetry: true,
        },
      };

      setMessageItems((prev) => [...prev, errorMessage]);
      addMessage(errorMessage);
    } finally {
      setLoading(false);
      setLoadingTimeout(false);
    }
  };

  // Submit chat completion
  const submitChatCompletion = useCallback(async () => {
    if (inputText.trim().length === 0) return;

    setLoading(true);

    const text = inputText.trim();
    setInputText('');

    // Add user message
    const newUserMessage: MessageItem = {
      id: getUniqueId(),
      created_at: new Date().toISOString(),
      role: 'user',
      content: text,
    };

    setMessageItems((prev) => [...prev, newUserMessage]);
    addMessage(newUserMessage);

    // Process the message
    await processChat({ text });
  }, [inputText, messageItems]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitChatCompletion();
  };

  // Handle retry
  const handleRetry = useCallback((originalText?: string) => {
    if (originalText) {
      setInputText(originalText);
      inputRef.current?.focus();
    }
  }, []);

  return (
    <Layout>
      {/* Main container - full height with flexbox */}
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 relative">
        {/* Content area - takes remaining space with scrolling */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Message list - handles its own scrolling */}
          <MessageList
            messages={messageItems}
            isLoading={loading}
            loadingContent={loadingTimeout ? '⏱️ This is taking longer than usual...' : undefined}
            onRetry={handleRetry}
          />
        </div>

        {/* Debug panel - absolutely positioned above form, doesn't affect form height */}
        {debug && (
          <div className="absolute bottom-[72px] left-0 right-0 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-xs border-t dark:border-zinc-700 z-20">
            <div className="max-w-[500px] mx-auto">
              <div className="font-bold mb-1">🐛 Debug Panel</div>
              <div>API: {apiUrl || 'Not configured'}</div>
              <div>Connected: {connectedToHub ? 'Yes' : 'No'}</div>
              <div>Messages: {messageItems.length}</div>
            </div>
          </div>
        )}

        {/* Fixed input area at bottom - only form, no debug panel */}
        <div className="flex-shrink-0 border-t dark:border-zinc-800 bg-white dark:bg-zinc-900 relative z-10">
          {/* Input form - only this affects the bottom container height */}
          <form onSubmit={handleSubmit} className="px-4 py-4">
            <div className="max-w-[500px] mx-auto flex gap-2 items-end">
              {/* Textarea */}
              <AutoExpandingTextarea
                ref={inputRef}
                value={inputText}
                onChange={setInputText}
                onSubmit={submitChatCompletion}
                placeholder="Send a message... (Shift+Enter for new line)"
                disabled={loading}
                className="flex-1 bg-zinc-100 dark:bg-zinc-700 rounded-md px-3 py-2 outline-none text-zinc-800 dark:text-zinc-300"
                minRows={1}
                maxRows={6}
              />

              {/* Send button */}
              <Button type="submit" disabled={loading || !inputText.trim()} className="flex-shrink-0" size="sm">
                <PaperPlaneIcon width={20} height={20} />
              </Button>

              {/* Clear button */}
              <Button type="button" onClick={handleClearMessages} variant="ghost" className="flex-shrink-0" size="sm">
                <X width={20} height={20} />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
