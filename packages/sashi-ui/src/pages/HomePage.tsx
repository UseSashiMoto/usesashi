import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FunctionSwitch } from '@/models/function-switch';
import { Label } from '@radix-ui/react-dropdown-menu';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MasonryIcon, VercelIcon } from 'src/components/message-icons';
import { Message } from 'src/components/MessageComponent';
import { useScrollToBottom } from 'src/components/use-scroll-to-bottom';
import { ChatCompletionMessage } from 'src/models/gpt';
import useAppStore from 'src/store/chat-store';
import { MessageItem } from 'src/store/models';
import { Layout } from '../components/Layout';
import { PayloadObject, ResultTool } from '../models/payload';
import { Metadata } from '../store/models';

function getUniqueId() {
  return Math.random().toString(36).substring(2) + new Date().getTime().toString(36);
}

interface ConfirmationData {
  name: string;
  description: string;
  args: Record<string, any>;
  payload: PayloadObject;
}

interface ConfirmationCardProps {
  confirmationData: ConfirmationData;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationCard({ confirmationData, onConfirm, onCancel }: ConfirmationCardProps) {
  return (
    <>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Are yoy sure you want to call this function?</CardTitle>
          <CardDescription>{confirmationData.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label>Description: {confirmationData.description}</Label>
              </div>
              {Object.entries(confirmationData.args).length > 0 && (
                <div className="flex flex-col space-y-1.5">
                  <Label>Arguments:</Label>
                  <ul className="text-sm text-zinc-600 dark:text-zinc-400">
                    {Object.entries(confirmationData.args).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-semibold">{key}: </span>
                        {JSON.stringify(value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <button onClick={onCancel}>No</button>

          <button onClick={onConfirm}>Yes</button>
        </CardFooter>
      </Card>
    </>
  );
}

export const HomePage = ({ apiUrl }: { apiUrl: string }) => {
  const queryString = window.location.search;

  const storedMessages = useAppStore((state: { messages: any }) => state.messages);

  const clearMessages = useAppStore((state) => state.clearMessages);

  const addMessage = useAppStore((state: { addMessage: any }) => state.addMessage);

  const setMetadata = useAppStore((state: { setMetadata: any }) => state.setMetadata);
  const metadata: Metadata | undefined = useAppStore((state: { metadata: any }) => state.metadata);

  const messageRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isMounted, setMounted] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [messageItems, setMessageItems] = React.useState<MessageItem[]>([]);

  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  const [confirmationData, setConfirmationData] = useState<ConfirmationData>();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      setMessageItems(storedMessages);
    }
  }, [isMounted]);

  const getMetadata = async () => {
    const response = await axios.get(`${apiUrl}/metadata${queryString}`);

    setMetadata(response.data);
  };
  useEffect(() => {
    getMetadata();
  }, []);

  const sendMessage = async ({
    payload,
  }: {
    payload: {
      tools?: any[];
      inquiry?: string;
      previous: any;
      type: string;
    };
  }) => {
    const response = await axios.post(`${apiUrl}/chat${queryString}`, payload);

    return response.data as { output: ChatCompletionMessage | undefined };
  };

  const handleClearMessages = async () => {
    setMessageItems([]);
    clearMessages();
  };

  const submitChatCompletion = async () => {
    if (inputText.length === 0) {
      return;
    }

    setLoading(true);

    const text = inputText;

    setInputText('');
    inputRef.current?.blur();

    const newUserMessage: MessageItem = {
      id: getUniqueId(),
      created_at: new Date().toISOString(),
      role: 'user',
      content: text,
    };
    setMessageItems((prev) => [...prev, ...[newUserMessage]]);
    addMessage(newUserMessage);

    resetScroll();

    await processChat({ text });
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    submitChatCompletion();
  };

  const resetScroll = () => {
    setTimeout(() => {
      if (!messageRef.current) return;
      messageRef.current.scrollTop = (messageRef.current?.scrollHeight ?? 0) + 24;
    }, 100);
  };
  const handleConfirm = () => {
    console.log('handleConfirm', confirmationData);
    if (!confirmationData) return;
    const tools =
      confirmationData.payload!.tools?.map((tool) => {
        if (tool.function.name === confirmationData!.name) {
          tool.confirmed = true;
        }
        return tool;
      }) ?? [];

    processChat({ continuation: { ...confirmationData!.payload, tools } });
    setConfirmationData(undefined);
  };

  const handleCancel = () => {
    console.log('handleCancel', confirmationData);
    if (!confirmationData) return;
    const tools = confirmationData.payload!.tools?.filter((tool) => {
      if (tool.function.name === confirmationData!.name) {
        return false;
      }
      return true;
    });
    processChat({ continuation: { ...confirmationData!.payload, tools } });
    setConfirmationData(undefined);
  };

  async function processChat({ text, continuation }: { text?: string; continuation?: PayloadObject }) {
    const previous = messageItems.map((item) => {
      return {
        role: item.role,
        content: item.content,
      };
    });
    let result_tools: any[] = [];
    let isCompleted = false;
    const MAX_LOOP_COUNT = 10; // Don't want to let it run loose
    let loopCount = 0;

    try {
      do {
        const payload: PayloadObject = continuation
          ? { ...continuation }
          : result_tools.length > 0
          ? {
              tools: result_tools,
              previous,
              type: '/chat/function',
            }
          : { inquiry: text, previous, type: '/chat/message' };

        // check for tools that need confirmation
        const toolsNeedingConfirmation: ResultTool[] | undefined = payload.tools
          ?.filter(
            (tool: { function: { name: string } }) =>
              metadata?.functions.find((func) => func.name === tool.function.name)?.needConfirmation ?? false
          )
          .filter((tool) => !tool.confirmed);

        if (!!toolsNeedingConfirmation && (toolsNeedingConfirmation?.length ?? 0 > 0)) {
          const description = metadata?.functions.find(
            (func) => func.name === toolsNeedingConfirmation[0].function.name
          )?.description;

          console.log('show confirmation card', payload.tools, metadata?.functions);
          //show confirmation card
          setConfirmationData({
            name: toolsNeedingConfirmation[0].function.name,
            description: description ?? '',
            args: JSON.parse(toolsNeedingConfirmation[0].function.arguments),
            payload: payload,
          });
          return;
        }

        const result = await sendMessage({ payload });

        if (result.output?.content) {
          const newAssistantMessage: MessageItem = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: 'assistant',
            content: result.output.content,
          };
          setMessageItems((prev) => [...prev, ...[newAssistantMessage]]);
          addMessage(newAssistantMessage);

          previous.push({
            role: 'assistant',
            content: result.output?.content,
          });

          resetScroll();
        }

        if (result.output?.tool_calls) {
          loopCount++;

          if (loopCount >= MAX_LOOP_COUNT) {
            isCompleted = true;
          } else {
            result_tools = result.output.tool_calls;
          }
        } else {
          isCompleted = true;
        }
      } while (!isCompleted);
    } catch (error: any) {
    } finally {
      setLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }

  return (
    <Layout
      onFunctionSwitch={(id: string) => {
        console.log('onFunctionSwitch', id);
        axios.get(`${apiUrl}/functions/${id}/toggle_active${queryString}`).then(() => {
          getMetadata();
        });
      }}
      functions={
        (metadata?.functions.map((func) => ({
          id: func.name,
          name: func.name,
          description: func.description,
          isActive: func.active,
          repo: '',
        })) ?? []) satisfies FunctionSwitch[]
      }
    >
      <div className="flex flex-row justify-center pb-20 h-dvh bg-white dark:bg-zinc-900">
        <div className="flex flex-col items-center justify-between gap-4">
          <div ref={messagesContainerRef} className="flex flex-col gap-3 h-full w-dvw items-center overflow-y-scroll">
            {messageItems.length === 0 && (
              <motion.div className="h-[350px] px-4 w-full md:w-[500px] md:px-0 pt-20">
                <div className="border rounded-lg p-6 flex flex-col gap-4 text-zinc-500 text-sm dark:text-zinc-400 dark:border-zinc-700">
                  <p className="flex flex-row justify-center gap-4 items-center text-zinc-900 dark:text-zinc-50">
                    <VercelIcon size={16} />
                    <span>+</span>
                    <MasonryIcon />
                  </p>
                  <p>
                    Sashi Bot is a chatbot that can be used to do administrative tasks on your application. It can be
                    integrated with your application using the Sashi SDK.
                  </p>
                  <p>
                    {' '}
                    Learn more about the{' '}
                    <a
                      className="text-blue-500 dark:text-blue-400"
                      href="https://sdk.vercel.ai/docs/ai-sdk-rsc/streaming-react-components"
                      target="_blank"
                    >
                      Sashi SDK
                    </a>{' '}
                    from our website.
                  </p>
                </div>
              </motion.div>
            )}
            {messageItems.map((item) => (
              <Message role={item.role} content={item.content} />
            ))}

            {loading && <Message role="assistant" isThinking={true} />}

            {!!confirmationData && (
              <ConfirmationCard
                confirmationData={confirmationData!}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[500px] mb-4"></div>

          <form
            className="flex w-full flex-row gap-2 relative justify-center items-center"
            onSubmit={async (event) => {
              event.preventDefault();
              handleSubmit(event);
              setInputText('');
            }}
          >
            <input
              ref={inputRef}
              className="bg-zinc-100 rounded-md px-2 py-1.5 w-full outline-none dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 md:max-w-[500px] max-w-[calc(100dvw-32px)]"
              placeholder="Send a message..."
              value={inputText}
              onChange={(event) => {
                setInputText(event.target.value);
              }}
            />

            <button tabIndex={-1} className="">
              <PaperPlaneIcon width={20} height={20} />
            </button>
            <button onClick={handleClearMessages} tabIndex={-1} className="">
              <X width={20} height={20} />
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};
