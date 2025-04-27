import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowResultViewer } from '@/components/workflows/WorkflowResultViewer';
import { WorkflowSaveForm } from '@/components/workflows/WorkflowSaveForm';
import { WorkflowUICard } from '@/components/workflows/WorkflowUICard';
import { WorkflowVisualizer } from '@/components/WorkflowVisualizer';
import { HEADER_SESSION_TOKEN } from '@/utils/contants';
import { Label } from '@radix-ui/react-dropdown-menu';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MasonryIcon, VercelIcon } from 'src/components/message-icons';
import { Message } from 'src/components/MessageComponent';
import { useScrollToBottom } from 'src/components/use-scroll-to-bottom';
import useAppStore from 'src/store/chat-store';
import { MessageItem } from 'src/store/models';
import { Layout } from '../components/Layout';
import {
  GeneralResponse,
  LabelPayload,
  PayloadObject,
  UIWorkflowDefinition,
  WorkflowResponse,
  WorkflowResult,
} from '../models/payload';

// Custom event type for workflow execution
interface WorkflowExecutedEvent extends CustomEvent {
  detail: {
    results: WorkflowResult[];
  };
}

function getUniqueId() {
  return Math.random().toString(36).substring(2) + new Date().getTime().toString(36);
}

interface WorkflowFormProps {
  workflow: WorkflowResponse;
  apiUrl: string;
}

const WorkflowForm: React.FC<WorkflowFormProps> = ({ workflow, apiUrl }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [results, setResults] = useState<WorkflowResult[]>([]);

  const handleExecute = async () => {
    const updatedActions = workflow.actions.map((action) => {
      const updatedParams = { ...action.parameters };
      for (const key of Object.keys(updatedParams)) {
        const val = updatedParams[key];
        if (typeof val === 'string' && val.startsWith('userInput.')) {
          const inputKey = val.split('.')[1];
          updatedParams[key] = formData[inputKey];
        }
      }
      return { ...action, parameters: updatedParams };
    });

    const finalWorkflow = { ...workflow, actions: updatedActions };
    const response = await axios.post(`${apiUrl}/workflow/execute`, {
      workflow: finalWorkflow,
    });

    console.log('handleExecute response', response.data);

    setResults(response.data.results);
  };

  const userInputKeys = new Set<string>();
  workflow.actions.forEach((action) => {
    for (const val of Object.values(action.parameters)) {
      if (typeof val === 'string' && val.startsWith('userInput.')) {
        userInputKeys.add(val.split('.')[1]);
      }
    }
  });

  return (
    <div className="space-y-6 px-4 w-full md:w-[500px] md:px-0">
      {Array.from(userInputKeys).map((key) => (
        <Input
          key={key}
          placeholder={key}
          value={formData[key] ?? ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      ))}
      <Button onClick={handleExecute}>Run Workflow</Button>
      {results.length > 0 && <WorkflowResultViewer results={results.map((result) => result.uiElement)} />}
      <WorkflowSaveForm
        workflow={workflow}
        onSave={(encoded) => {
          console.log('Saved:', encoded); // store or log it
        }}
      />
    </div>
  );
};

export interface WorkflowConfirmationCardProps {
  workflow: WorkflowResponse;
  onExecute: () => void;
  onGenerateUI: () => void;
  onCancel: () => void;
  onSave?: (workflowId: string) => void;
}

// Component for displaying a workflow and its execution options
export function WorkflowConfirmationCard({
  workflow,
  onExecute,
  onGenerateUI,
  onCancel,
}: WorkflowConfirmationCardProps) {
  const [activeTab, setActiveTab] = useState('workflow');
  const [isSaving, setIsSaving] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // If workflow execution results are present, default to showing results tab
  useEffect(() => {
    if (workflow.executionResults && workflow.executionResults.length > 0) {
      setActiveTab('results');
    }
  }, [workflow.executionResults]);

  // Listen for workflow execution events
  useEffect(() => {
    const handleWorkflowExecuted = (event: WorkflowExecutedEvent) => {
      if (event.detail && event.detail.results) {
        setActiveTab('results');
      }
    };

    window.addEventListener('workflow-executed', handleWorkflowExecuted as EventListener);

    return () => {
      window.removeEventListener('workflow-executed', handleWorkflowExecuted as EventListener);
    };
  }, []);

  // Function to save workflow to dashboard

  // If workflow is undefined, don't render anything
  if (!workflow) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full md:w-[500px] p-4 rounded-lg bg-white dark:bg-slate-900 shadow-lg mx-auto mb-6"
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle>Workflow</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            This workflow has {workflow.actions.length} action{workflow.actions.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="steps">Steps</TabsTrigger>
              <TabsTrigger
                value="results"
                disabled={!workflow.executionResults || workflow.executionResults.length === 0}
              >
                Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="workflow">
              <div className="space-y-2 mt-2">
                <WorkflowVisualizer
                  workflow={workflow}
                  onExecute={onExecute}
                  onGenerateUI={onGenerateUI}
                  onCancel={onCancel}
                />
              </div>
            </TabsContent>

            <TabsContent value="steps">
              <div className="space-y-2 mt-2">
                <div className="text-sm p-2 bg-slate-100 dark:bg-slate-800 rounded-md space-y-3">
                  {workflow.actions.map((action, index) => (
                    <div key={index} className="border-l-2 border-slate-400 pl-3">
                      <div className="font-semibold">{action.tool}</div>
                      <div className="text-xs">{action.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results">
              <div className="mt-2">
                {workflow.executionResults && workflow.executionResults.length > 0 ? (
                  <WorkflowResultViewer results={workflow.executionResults.map((r) => r.uiElement)} />
                ) : (
                  <div className="text-center py-4 text-slate-500">No results to display</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
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

interface DynamicWorkflowUIProps {
  uiDef: UIWorkflowDefinition;
  apiEndpoint: string;
  onComplete?: () => void;
}

export const HomePage = () => {
  const storedMessages = useAppStore((state: { messages: any }) => state.messages);

  const clearMessages = useAppStore((state) => state.clearMessages);

  const addMessage = useAppStore((state: { addMessage: any }) => state.addMessage);

  const setConnectedToHub = useAppStore((state: { setConnectedToHub: any }) => state.setConnectedToHub);

  const messageRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isMounted, setMounted] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [messageItems, setMessageItems] = React.useState<MessageItem[]>([]);

  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  const [confirmationData, setConfirmationData] = useState<ConfirmationData>();
  const [workflowConfirmationCard, setWorkflowConfirmationCard] = useState<WorkflowResponse>();
  const [uiPreviewCard, setUiPreviewCards] = useState<WorkflowResponse>();
  const [uiWorkflowCard, setUiWorkflowCard] = useState<UIWorkflowDefinition>();
  const connectedToHub: boolean = useAppStore((state: { connectedToHub: any }) => state.connectedToHub);
  const apiUrl = useAppStore((state) => state.apiUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);

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
          headers: {
            [HEADER_SESSION_TOKEN]: sessionToken ?? '',
          },
        });
        const data = await response.json();
        setConnectedToHub(data.connected);
      } catch (error) {
        setConnectedToHub(false);
      }
    };
    checkConnectedToHub();
  }, [apiUrl, sessionToken]);

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
    return response.data.output as GeneralResponse | WorkflowResponse;
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
    console.log('processing chat', text, continuation);
    const previous = messageItems.map((item) => {
      return {
        role: item.role,
        content: item.content,
      };
    });
    let result_tools: any[] = [];
    const sanitizedMessages = previous.map((message) => ({
      ...message,
      content: typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
    }));

    const payload: PayloadObject = continuation
      ? { ...continuation }
      : result_tools.length > 0
      ? {
          tools: result_tools,
          previous: sanitizedMessages,
          type: '/chat/function',
        }
      : { inquiry: text, previous, type: '/chat/message' };

    try {
      const result = await sendMessage({ payload });

      console.log('result from server', result);
      if (result.type === 'general') {
        const generalResult: GeneralResponse = result;
        // Only add text content if there were no visualizations
        const newAssistantMessage: MessageItem = {
          id: getUniqueId(),
          created_at: new Date().toISOString(),
          role: 'assistant',
          content: generalResult.content,
        };
        setMessageItems((prev) => [...prev, newAssistantMessage]);
        addMessage(newAssistantMessage);

        resetScroll();
      }

      if (result.type === 'workflow') {
        const workflowResult: WorkflowResponse = result;
        console.log('workflowResult', workflowResult);
        // show confirmation card
        setWorkflowConfirmationCard(workflowResult);

        resetScroll();
      }
    } catch (error: any) {
      console.error('Error processing chat', error);
    } finally {
      setLoading(false);
    }
  }

  async function executeWorkflow(): Promise<void> {
    if (!workflowConfirmationCard) return;

    setLoading(true);

    try {
      const response = await axios.post(`${apiUrl}/workflow/execute`, {
        workflow: workflowConfirmationCard,
        debug: true, // Enable debug mode to get detailed logs
      });

      console.log('workflow execution response', response.data);

      // Store the results in the workflowConfirmationCard to be displayed
      if (response.data.success && response.data.results) {
        // Update the workflow confirmation card to include results
        setWorkflowConfirmationCard({
          ...workflowConfirmationCard,
          executionResults: response.data.results,
        } as WorkflowResponse);

        // Set the active tab to 'results' in the WorkflowUICard
        const event = new CustomEvent('workflow-executed', {
          detail: { results: response.data.results },
        }) as WorkflowExecutedEvent;
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateUI() {
    if (!workflowConfirmationCard) return;

    try {
      const response = await axios.post(`${apiUrl}/workflow/ui-entry-type`, {
        workflow: workflowConfirmationCard,
      });

      // Check if we have an error in the response, even with status 200
      if (response.data.error) {
        console.error('Error from API:', response.data.error);
        // Use default error label UI
        const defaultUI: UIWorkflowDefinition = {
          workflow: workflowConfirmationCard,
          entry: {
            entryType: 'label',
            description: 'Error Processing Workflow',
            payload: {
              isError: true,
              message: response.data.message || 'Unable to determine how to display this workflow',
            } as LabelPayload,
          },
        };
        setUiWorkflowCard(defaultUI);
        setWorkflowConfirmationCard(undefined);
        return;
      }

      const uiDef: UIWorkflowDefinition = {
        workflow: workflowConfirmationCard,
        entry: response.data.entry,
      };

      setUiWorkflowCard(uiDef);
      setWorkflowConfirmationCard(undefined);
    } catch (error: any) {
      console.error('Error generating UI', error);

      // If request fails completely, still show a label UI with error
      if (workflowConfirmationCard) {
        const defaultUI: UIWorkflowDefinition = {
          workflow: workflowConfirmationCard,
          entry: {
            entryType: 'label',
            description: 'Error Processing Workflow',
            payload: {
              isError: true,
              message: "We couldn't connect to the server to process this workflow",
            } as LabelPayload,
          },
        };
        setUiWorkflowCard(defaultUI);
        setWorkflowConfirmationCard(undefined);
      }
    }
  }

  // Function to provide feedback when a workflow is saved to dashboard
  const handleWorkflowSave = (workflowId: string) => {
    // Get a default name for the workflow
    let workflowName = 'Unnamed Workflow';

    // Try to get the workflow name from the current context
    if (uiWorkflowCard && uiWorkflowCard.entry.description) {
      workflowName = uiWorkflowCard.entry.description;
    }

    // Add a message to the chat to show feedback
    const newAssistantMessage: MessageItem = {
      id: getUniqueId(),
      created_at: new Date().toISOString(),
      role: 'assistant',
      content: `✅ Workflow "${workflowName}" has been saved to your dashboard with ID: ${workflowId}. You can access it anytime from the Workflows section.`,
    };
    setMessageItems((prev) => [...prev, newAssistantMessage]);
    addMessage(newAssistantMessage);
    setUiWorkflowCard(undefined);

    // Scroll to show the message
    resetScroll();
  };

  return (
    <Layout>
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

            {!!workflowConfirmationCard && (
              <WorkflowConfirmationCard
                workflow={workflowConfirmationCard!}
                onExecute={executeWorkflow}
                onGenerateUI={generateUI}
                onCancel={() => setWorkflowConfirmationCard(undefined)}
                onSave={handleWorkflowSave}
              />
            )}

            {uiWorkflowCard && apiUrl && (
              <WorkflowUICard
                workflow={uiWorkflowCard}
                apiUrl={apiUrl}
                onClose={() => setUiWorkflowCard(undefined)}
                isInChat={true}
                onSave={handleWorkflowSave}
              />
            )}

            {uiPreviewCard && apiUrl && <WorkflowForm workflow={uiPreviewCard} apiUrl={apiUrl} />}

            <div ref={messagesEndRef} />
          </div>

          <div className="grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[500px] mb-4"></div>

          <form
            className="flex w-full flex-row gap-2 relative justify-center items-center"
            onSubmit={async (event) => {
              event.preventDefault();
              handleSubmit(event);
              setInputText('');
              setWorkflowConfirmationCard(undefined);
              setUiWorkflowCard(undefined);
            }}
          >
            <input
              disabled={!!uiPreviewCard}
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
      <div style={{ display: 'none' }} data-testid="connected-status">
        {connectedToHub ? 'Connected' : 'Not Connected'}
      </div>
    </Layout>
  );
};
