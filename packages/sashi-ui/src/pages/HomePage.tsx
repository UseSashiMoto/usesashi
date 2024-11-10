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
import { MessageItem, RepoMetadata, VisualizationContent } from 'src/store/models';
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

export const HomePage = ({ apiUrl, sessionToken }: { apiUrl: string; sessionToken: string }) => {
  const storedMessages = useAppStore((state: { messages: any }) => state.messages);

  const clearMessages = useAppStore((state) => state.clearMessages);

  const addMessage = useAppStore((state: { addMessage: any }) => state.addMessage);

  const setMetadata = useAppStore((state: { setMetadata: any }) => state.setMetadata);
  const setConnectedToHub = useAppStore((state: { setConnectedToHub: any }) => state.setConnectedToHub);
  const metadata: Metadata | undefined = useAppStore((state: { metadata: any }) => state.metadata);

  const setSubscribedRepos = useAppStore((state: { setSubscribedRepos: any }) => state.setSubscribedRepos);

  const messageRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isMounted, setMounted] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [messageItems, setMessageItems] = React.useState<MessageItem[]>([]);

  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  const [confirmationData, setConfirmationData] = useState<ConfirmationData>();
  const connectedToHub: boolean = useAppStore((state: { connectedToHub: any }) => state.connectedToHub);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      setMessageItems(storedMessages);
    }
  }, [isMounted]);

  useEffect(() => {
    const checkConnectedToHub = async () => {
      try {
        const response = await fetch(`${apiUrl}/check_hub_connection`, {
          method: 'GET',
        });
        const data = await response.json();
        setConnectedToHub(data.connected);
      } catch (error) {
        setConnectedToHub(false);
      }
    };
    checkConnectedToHub();
  }, []);

  const getMetadata = async () => {
    const response = await axios.get(`${apiUrl}/metadata`);

    setMetadata(response.data);
  };
  useEffect(() => {
    getMetadata();
  }, []);

  const getSubscribedRepos = async () => {
    const response = await axios.get(`${apiUrl}/repos`);
    return response.data.repos;
  };

  useEffect(() => {
    getSubscribedRepos().then((repos) => {
      setSubscribedRepos(repos);
      console.log(repos);
    });
  }, []);

  const prepareMessageForPayload = (messages: MessageItem[]) => {
    return messages.map((message) => ({
      ...message,
      content: typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
    }));
  };
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
    const sanitizedPayload = {
      ...payload,
      previous: payload.previous ? prepareMessageForPayload(payload.previous) : undefined,
    };
    const response = await axios.post(`${apiUrl}/chat`, sanitizedPayload);

    return response.data as {
      output: ChatCompletionMessage | undefined;
      visualization?: { name: string; type: string; parameters: any }[];
    };
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
    const sanitizedMessages = previous.map((message) => ({
      ...message,
      content: typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
    }));
    try {
      do {
        const payload: PayloadObject = continuation
          ? { ...continuation }
          : result_tools.length > 0
          ? {
              tools: result_tools,
              previous: sanitizedMessages,
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

        if (result.visualization) {
          result.visualization.forEach((viz) => {
            const newVisualizationMessage: MessageItem = {
              id: getUniqueId(),
              created_at: new Date().toISOString(),
              role: 'assistant',
              content: {
                type: viz.type,
                data: viz.parameters,
              },
            };
            setMessageItems((prev) => [...prev, newVisualizationMessage]);
            addMessage(newVisualizationMessage);
          });
        }
        if (result.output?.tool_calls) {
          result.output.tool_calls.forEach((toolCall) => {
            if (toolCall.function.name.toLowerCase().includes('visualization')) {
              const visualizationContent: VisualizationContent = {
                type: toolCall.function.name.replace(/visualization/i, '').toLowerCase(),
                data: JSON.parse(toolCall.function.arguments),
              };

              const newVisualizationMessage: MessageItem = {
                id: getUniqueId(),
                created_at: new Date().toISOString(),
                role: 'assistant',
                content: visualizationContent,
              };

              setMessageItems((prev) => [...prev, newVisualizationMessage]);
              addMessage(newVisualizationMessage);
            }
          });

          resetScroll();
        } else if (result.output?.content) {
          // Only add text content if there were no visualizations
          const newAssistantMessage: MessageItem = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: 'assistant',
            content: result.output.content,
          };
          setMessageItems((prev) => [...prev, newAssistantMessage]);
          addMessage(newAssistantMessage);

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

  const subscribedRepos: RepoMetadata[] | undefined = useAppStore(
    (state: { subscribedRepos: any }) => state.subscribedRepos
  );

  return (
    <Layout
      connectedToHub={connectedToHub}
      onFunctionSwitch={(id: string) => {
        axios.get(`${apiUrl}/functions/${id}/toggle_active`).then(() => {
          getMetadata();
        });
      }}
      repos={
        subscribedRepos?.map((repo) => ({
          id: repo.id,
          name: repo.name,
          url: repo.url,
        })) ?? []
      }
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
