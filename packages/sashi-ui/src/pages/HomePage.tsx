import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowResultViewer } from '@/components/workflows/WorkflowResultViewer';
import { WorkflowSaveForm } from '@/components/workflows/WorkflowSaveForm';
import { WorkflowUICard } from '@/components/workflows/WorkflowUICard';
import { WorkflowVisualizer } from '@/components/WorkflowVisualizer';
import { sendExecuteWorkflow } from '@/services/workflow.service';
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
  isWorkflowExecutionSuccess,
  PayloadObject,
  UIWorkflowDefinition,
  WorkflowExecutionSuccess,
  WorkflowResponse,
  WorkflowResult,
} from '../models/payload';
import { detectWorkflowEntryType, extractWorkflowFromNested } from '../utils/workflowClassification';

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

    const finalWorkflow = { ...workflow, actions: updatedActions } as WorkflowResponse;
    const response = await sendExecuteWorkflow(apiUrl, finalWorkflow);
    if (isWorkflowExecutionSuccess(response.data)) {
      setResults((response.data as WorkflowExecutionSuccess).results || []);
    }
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
      <WorkflowSaveForm workflow={workflow} onSave={(encoded) => {}} />
    </div>
  );
};

export interface WorkflowConfirmationCardProps {
  workflow: WorkflowResponse;
  onExecute: () => void;
  onGenerateUI: () => void;
  onCancel: () => void;
}

// Component for displaying a workflow and its execution options
export function WorkflowConfirmationCard({
  workflow,
  onExecute,
  onGenerateUI,
  onCancel,
}: WorkflowConfirmationCardProps) {
  const [activeTab, setActiveTab] = useState('workflow');

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

    if (!window) {
      return;
    }

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

  const addMessage = useAppStore((state) => state.addMessage);

  const messageRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isMounted, setMounted] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [messageItems, setMessageItems] = React.useState<MessageItem[]>([]);

  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  const [confirmationData, setConfirmationData] = useState<ConfirmationData>();
  const [uiPreviewCard, setUiPreviewCards] = useState<WorkflowResponse>();
  const [uiWorkflowCard, setUiWorkflowCard] = useState<UIWorkflowDefinition>();
  const connectedToHub: boolean = useAppStore((state: { connectedToHub: any }) => state.connectedToHub);
  const apiUrl = useAppStore((state) => state.apiUrl);
  const [debug] = useState(process.env.NODE_ENV === 'development');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      setMessageItems(storedMessages);
    }
  }, [isMounted]);

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

    console.log('🚀 [DEBUG] Sending request to:', `${apiUrl}/chat`);
    console.log('📦 [DEBUG] Payload:', JSON.stringify(sanitizedPayload, null, 2));
    console.log('⏰ [DEBUG] Request started at:', new Date().toISOString());

    try {
      const response = await axios.post(`${apiUrl}/chat`, sanitizedPayload, {
        timeout: 65000, // 65 second timeout (slightly longer than backend)
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ [DEBUG] Response received:', response.status, response.statusText);
      console.log('📄 [DEBUG] Response data:', JSON.stringify(response.data, null, 2));

      if (!response.data || !response.data.output) {
        console.error('❌ [DEBUG] Invalid response structure:', response.data);
        throw new Error('Invalid response structure from server');
      }

      return response.data.output as GeneralResponse | WorkflowResponse;
    } catch (error: any) {
      console.error('💥 [DEBUG] Request failed:', error);
      console.error('📊 [DEBUG] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        },
      });

      // Re-throw the error so it can be handled by processChat
      throw error;
    }
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
    console.log('🎯 [DEBUG] processChat called with:', { text, continuation });

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

    console.log('📋 [DEBUG] Final payload:', payload);

    // Set up timeout warning after 30 seconds
    const timeoutWarning = setTimeout(() => {
      console.log('⏰ [DEBUG] 30-second timeout warning triggered');
      setLoadingTimeout(true);
    }, 30000);

    try {
      console.log('📡 [DEBUG] Calling sendMessage...');
      const result = await sendMessage({ payload });

      // Clear timeout warning since we got a response
      clearTimeout(timeoutWarning);
      setLoadingTimeout(false);

      console.log('🎉 [DEBUG] sendMessage completed successfully:', result);

      // Handle different response formats
      let processedResult: GeneralResponse | WorkflowResponse;

      // Check if we have the expected wrapped format
      if (result && typeof result === 'object' && 'type' in result) {
        console.log('📋 [DEBUG] Response is in expected wrapped format');
        processedResult = result;
      }
      // Handle raw OpenAI response format
      else if (result && typeof result === 'object' && 'content' in result) {
        console.log('🔄 [DEBUG] Converting raw OpenAI response to expected format');
        processedResult = {
          type: 'general',
          content: (result as any).content,
        } as GeneralResponse;
      }
      // Handle string responses
      else if (typeof result === 'string') {
        console.log('📝 [DEBUG] Converting string response to expected format');
        processedResult = {
          type: 'general',
          content: result,
        } as GeneralResponse;
      } else {
        console.error('❌ [DEBUG] Unexpected response format:', result);
        throw new Error('Unexpected response format from server');
      }

      if (processedResult.type === 'general') {
        console.log('📝 [DEBUG] Processing general response');
        const generalResult: GeneralResponse = processedResult;
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

      if (processedResult.type === 'workflow') {
        console.log('⚙️ [DEBUG] Processing workflow response');
        const workflowResult: WorkflowResponse = processedResult;
        // automatically generate UI instead of showing confirmation card
        await generateUIFromWorkflow(workflowResult);

        resetScroll();
      }
    } catch (error: any) {
      // Clear timeout warning since we got an error response
      clearTimeout(timeoutWarning);
      setLoadingTimeout(false);

      console.error('💥 [DEBUG] processChat error caught:', error);

      // Extract error details from the response
      const errorResponse = error.response?.data;
      const statusCode = error.response?.status;

      console.log('📊 [DEBUG] Error analysis:', {
        hasResponse: !!error.response,
        statusCode,
        hasData: !!errorResponse,
        errorMessage: error.message,
        errorType: typeof error,
      });

      let errorContent = '';
      let showRetryButton = false;
      let retryText = '';

      // Handle different error types with specific user-friendly messages
      if (statusCode === 408) {
        // Timeout errors
        errorContent =
          '⏱️ **Request Timeout**\n\nYour request took too long to process. This can happen with complex requests or when the AI service is busy.';
        showRetryButton = true;
        retryText = 'Try again';

        if (errorResponse?.error?.includes('AI response timeout')) {
          errorContent += '\n\n💡 **Tip**: Try breaking your request into smaller, simpler parts.';
        }
      } else if (statusCode === 429) {
        // Rate limiting
        errorContent =
          "🚦 **Too Many Requests**\n\nYou're sending requests too quickly. Please wait a moment before trying again.";
        showRetryButton = true;
        retryText = 'Retry in 30 seconds';

        // Auto-retry after 30 seconds for rate limits
        setTimeout(() => {
          if (text) {
            processChat({ text });
          }
        }, 30000);
      } else if (statusCode === 503) {
        // Service unavailable
        errorContent =
          '🔧 **Service Temporarily Unavailable**\n\nThe AI service is currently experiencing issues. Please try again in a few minutes.';
        showRetryButton = true;
        retryText = 'Try again';

        if (errorResponse?.error?.includes('Quota exceeded')) {
          errorContent =
            '📊 **Service Quota Exceeded**\n\nThe AI service has reached its usage limit. Please contact support or try again later.';
          showRetryButton = false;
        } else if (errorResponse?.error?.includes('Network connectivity')) {
          errorContent += '\n\n🌐 **Check your internet connection** and make sure you can access the internet.';
        }
      } else if (statusCode === 400) {
        // Bad request - validation errors
        if (errorResponse?.error?.includes('Invalid input')) {
          errorContent =
            '📝 **Invalid Input**\n\nThere was an issue with your request format. Please try rephrasing your message.';
        } else if (errorResponse?.error?.includes('Invalid workflow')) {
          errorContent =
            '⚙️ **Workflow Error**\n\nThere was an issue with the workflow structure. Please try a different approach.';
        } else if (errorResponse?.error?.includes('Function not found')) {
          errorContent =
            '🔍 **Function Not Available**\n\nThe requested function is not currently available. Please try a different request.';
        } else {
          errorContent =
            '❌ **Request Error**\n\nThere was an issue with your request. Please check your input and try again.';
        }
        showRetryButton = true;
        retryText = 'Try again';
      } else if (statusCode >= 500) {
        // Server errors
        errorContent = "🛠️ **Server Error**\n\nSomething went wrong on our end. We're working to fix this issue.";
        showRetryButton = true;
        retryText = 'Try again';
      } else if (!statusCode && error.message.includes('timeout')) {
        // Network timeout (no status code)
        errorContent =
          '🌐 **Network Timeout**\n\nThe request timed out. This could be due to a slow connection or server overload.';
        showRetryButton = true;
        retryText = 'Try again';
      } else if (!statusCode && error.message.includes('Network Error')) {
        // Network error (no status code)
        errorContent =
          '🌐 **Network Error**\n\nUnable to connect to the server. Please check your internet connection.';
        showRetryButton = true;
        retryText = 'Try again';
      } else {
        // Generic error fallback
        errorContent = '❌ **Something went wrong**\n\nAn unexpected error occurred while processing your request.';
        showRetryButton = true;
        retryText = 'Try again';
      }

      // Add more specific error details if available
      if (errorResponse?.details) {
        errorContent += `\n\n**Details**: ${errorResponse.details}`;
      }

      // Add debug info in development mode
      if (debug && errorResponse?.debug_info) {
        errorContent += `\n\n**Debug Info** (dev mode):\n\`\`\`json\n${JSON.stringify(
          errorResponse.debug_info,
          null,
          2
        )}\n\`\`\``;
      }

      // Add raw error info for debugging
      if (debug) {
        errorContent += `\n\n**Raw Error** (dev mode):\n\`\`\`\nMessage: ${error.message}\nStatus: ${
          statusCode || 'No status'
        }\nType: ${typeof error}\n\`\`\``;
      }

      // Add retry button if applicable
      if (showRetryButton) {
        errorContent += `\n\n---\n🔄 **Want to try again?** Click the "${retryText}" button below.`;
      }

      const errorMessageItem: MessageItem = {
        id: getUniqueId(),
        created_at: new Date().toISOString(),
        role: 'assistant',
        content: errorContent,
        isError: true,
        retryData: showRetryButton
          ? {
              originalText: text,
              retryText: retryText,
              canRetry: true,
            }
          : undefined,
      };

      setMessageItems((prev) => [...prev, errorMessageItem]);
      addMessage(errorMessageItem);
      resetScroll();
    } finally {
      console.log('🏁 [DEBUG] processChat finally block executed');
      setLoading(false);
      setLoadingTimeout(false);
    }
  }

  // Helper function to analyze workflow characteristics
  const analyzeWorkflowCharacteristics = (workflow: WorkflowResponse) => {
    const actionNames = workflow.actions.map((action) => action.tool.toLowerCase());
    const actionDescriptions = workflow.actions.map((action) => action.description?.toLowerCase() || '');

    // Keywords that suggest data queries/display
    const queryKeywords = ['get', 'fetch', 'list', 'show', 'display', 'view', 'search', 'find', 'retrieve'];
    const mutationKeywords = ['create', 'update', 'delete', 'add', 'remove', 'modify', 'save', 'execute', 'run'];

    const hasQueryKeywords = [...actionNames, ...actionDescriptions].some((text) =>
      queryKeywords.some((keyword) => text.includes(keyword))
    );

    const hasMutationKeywords = [...actionNames, ...actionDescriptions].some((text) =>
      mutationKeywords.some((keyword) => text.includes(keyword))
    );

    // Check if all parameters are already set (no user input needed)
    const hasUnsetParameters = workflow.actions.some((action) =>
      Object.values(action.parameters || {}).some(
        (value) =>
          typeof value === 'string' && (value.includes('TODO') || value.includes('PLACEHOLDER') || value === '')
      )
    );

    return {
      isDataQuery: hasQueryKeywords && !hasMutationKeywords,
      isMutation: hasMutationKeywords,
      isDisplayOnly: workflow.executionResults && workflow.executionResults.length > 0 && hasQueryKeywords,
      requiresExecution: hasUnsetParameters || hasMutationKeywords,
      hasResults: !!(workflow.executionResults && workflow.executionResults.length > 0),
    };
  };

  // Alternative: Use the AI classification endpoint
  const classifyWorkflowWithAI = async (workflow: WorkflowResponse) => {
    try {
      const response = await axios.post(`${apiUrl}/workflow/ui-type`, { workflow });
      return response.data.entry;
    } catch (error) {
      console.warn('Failed to classify workflow with AI, falling back to local detection:', error);
      return detectWorkflowEntryType(workflow);
    }
  };

  // Utility function for testing workflow classification (useful for debugging)
  const testWorkflowClassification = (workflow: WorkflowResponse) => {
    const local = detectWorkflowEntryType(workflow);
    const characteristics = analyzeWorkflowCharacteristics(workflow);

    console.log('🧪 Test Classification Results:');
    console.log('  Local Detection:', local);
    console.log('  Characteristics:', characteristics);
    console.log('  Explanation:', getClassificationExplanation(local, characteristics));

    return { local, characteristics };
  };

  /*
   * 🎯 INTELLIGENT WORKFLOW CLASSIFICATION SYSTEM
   *
   * This system automatically determines how workflows should be presented to users:
   *
   * 📝 FORM workflows:
   *    - Require user input (parameters with 'userInput.' prefix)
   *    - Show form fields for data entry
   *    - Execute with submitted form data
   *
   * 📊 LABEL/DISPLAY workflows:
   *    - Display data without user interaction
   *    - Query/read operations (get, fetch, list, show, etc.)
   *    - Already executed with results to show
   *
   * ⚡ BUTTON workflows:
   *    - Simple execution with no input needed
   *    - Mutation operations (create, update, delete, etc.)
   *    - Parameters are pre-filled or don't require user input
   *
   * The system uses both AI classification and local analysis to make intelligent decisions.
   */

  async function generateUIFromWorkflow(workflowResponse: WorkflowResponse) {
    setLoading(true);
    try {
      // Execute the workflow and parse the UI elements
      let workflow = extractWorkflowFromNested(workflowResponse);

      if (!workflow) {
        console.error('❌ No valid workflow available for UI generation');
        return;
      }

      if (!apiUrl) {
        console.error('❌ API URL is not available');
        return;
      }

      console.log('🚀 Starting UI generation for workflow:', workflow);
      console.log(
        '📋 Workflow actions:',
        workflow.actions?.map((a) => ({
          id: a.id,
          tool: a.tool,
          parameters: a.parameters,
          parameterMetadata: (a as any).parameterMetadata,
        }))
      );

      // Pre-execution analysis (before sending to server)
      const preExecutionAnalysis = detectWorkflowEntryType(workflow);
      console.log('🔍 Pre-execution analysis:', preExecutionAnalysis);

      // If we already know this should be a form, don't execute - just create the UI
      if (preExecutionAnalysis.entryType === 'form') {
        console.log('✅ Workflow identified as form type, creating UI without execution');

        const uiWorkflowDefinition: UIWorkflowDefinition = {
          workflow: workflow,
          entry: {
            entryType: 'form',
            description: `📝 ${
              (workflow as any).description || workflow.actions?.[0]?.description || 'Fill in the form below'
            }`,
            payload: preExecutionAnalysis.payload,
          },
        };

        console.log('📝 Generated form UI definition:', uiWorkflowDefinition);
        setUiWorkflowCard(uiWorkflowDefinition);
        return;
      }

      // For non-form workflows, execute first then analyze
      console.log('⚡ Executing workflow before UI generation...');
      const response = await sendExecuteWorkflow(apiUrl!, workflow);

      console.log('📡 Execution response:', response.data);

      if (response.data.success && response.data.results) {
        // Update workflow with execution results
        const workflowWithResults = {
          ...workflow,
          executionResults: response.data.results,
        };

        // Debug: Log workflow analysis
        const localAnalysis = detectWorkflowEntryType(workflowWithResults);
        const workflowCharacteristics = analyzeWorkflowCharacteristics(workflowWithResults);

        console.log('🔍 Workflow Analysis Debug Info:');
        console.log('  📊 Workflow characteristics:', workflowCharacteristics);
        console.log('  🎯 Local classification:', localAnalysis);
        console.log(
          '  📋 Actions summary:',
          workflow.actions.map((a) => ({ tool: a.tool, description: a.description }))
        );

        // Classify the workflow intelligently
        const entryClassification = await classifyWorkflowWithAI(workflowWithResults);

        console.log('  🤖 AI classification result:', entryClassification);
        console.log('  ✅ Final entry type:', entryClassification.entryType);

        // Enhance description based on classification type
        let enhancedDescription =
          entryClassification.description || workflow.actions?.[0]?.description || 'Generated Workflow';

        if (entryClassification.entryType === 'form') {
          enhancedDescription = `📝 ${enhancedDescription} (Fill in the form below)`;
        } else if (entryClassification.entryType === 'label') {
          enhancedDescription = `📊 ${enhancedDescription} (Data display)`;
        } else if (entryClassification.entryType === 'button') {
          enhancedDescription = `⚡ ${enhancedDescription} (Click to execute)`;
        }

        // Create a UIWorkflowDefinition with intelligent entry type
        const uiWorkflowDefinition: UIWorkflowDefinition = {
          workflow: workflowWithResults,
          entry: {
            entryType: entryClassification.entryType,
            description: enhancedDescription,
            payload: entryClassification.payload,
          },
        };

        console.log('Generated UI workflow definition:', uiWorkflowDefinition);

        setUiWorkflowCard(uiWorkflowDefinition);

        // Add feedback message about the classification
        if (debug) {
          const classificationMessage =
            `🎯 **Workflow Classification Complete**\n\n` +
            `**Type**: ${entryClassification.entryType.toUpperCase()}\n` +
            `**Why**: ${getClassificationExplanation(entryClassification, workflowCharacteristics)}\n\n` +
            `**Actions**: ${workflow.actions.length} step${workflow.actions.length === 1 ? '' : 's'}\n` +
            `**Results**: ${response.data.results?.length || 0} result${
              response.data.results?.length === 1 ? '' : 's'
            }`;

          const debugMessage: MessageItem = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: 'assistant',
            content: classificationMessage,
          };

          setMessageItems((prev) => [...prev, debugMessage]);
          addMessage(debugMessage);
        }
      } else {
        console.error('❌ Failed to generate UI: No valid results returned');
        console.error('Response data:', response.data);

        // Try to create a form UI as fallback if possible
        if (workflow) {
          const fallbackAnalysis = detectWorkflowEntryType(workflow);
          if (fallbackAnalysis.entryType === 'form') {
            console.log('🚑 Creating fallback form UI after error');

            const fallbackUIDefinition: UIWorkflowDefinition = {
              workflow: workflow,
              entry: {
                entryType: 'form',
                description: `📝 ${(workflow as any).description || 'Please provide the required information'}`,
                payload: fallbackAnalysis.payload,
              },
            };

            setUiWorkflowCard(fallbackUIDefinition);
          }
        }
      }
    } catch (error) {
      console.error('💥 Error generating UI:', error);

      // Try to create a form UI as fallback if possible
      let workflow = extractWorkflowFromNested(workflowResponse);
      if (workflow) {
        const fallbackAnalysis = detectWorkflowEntryType(workflow);
        if (fallbackAnalysis.entryType === 'form') {
          console.log('🚑 Creating fallback form UI after error');

          const fallbackUIDefinition: UIWorkflowDefinition = {
            workflow: workflow,
            entry: {
              entryType: 'form',
              description: `📝 ${(workflow as any).description || 'Please provide the required information'}`,
              payload: fallbackAnalysis.payload,
            },
          };

          setUiWorkflowCard(fallbackUIDefinition);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function generateUI() {
    console.error('❌ generateUI() is deprecated. Use generateUIFromWorkflow() directly with a workflow response.');
  }

  // Helper function to explain why a workflow was classified a certain way
  const getClassificationExplanation = (classification: any, characteristics: any): string => {
    if (classification.entryType === 'form') {
      return 'This workflow requires user input parameters. Fill out the form to provide the necessary data.';
    } else if (classification.entryType === 'label') {
      if (characteristics.isDataQuery) {
        return 'This workflow fetches and displays data. It appears to be a query/read operation.';
      } else if (characteristics.hasResults) {
        return 'This workflow has been executed and contains results to display.';
      }
      return 'This workflow is designed to display information without requiring user interaction.';
    } else if (classification.entryType === 'button') {
      if (characteristics.isMutation) {
        return 'This workflow performs actions/mutations. Click the button to execute it.';
      } else if (characteristics.requiresExecution) {
        return 'This workflow needs to be executed to generate results.';
      }
      return 'This workflow can be executed with a simple button click.';
    }
    return 'Classification completed using AI analysis of workflow structure.';
  };

  // Handle workflow save completion for chat feedback
  const handleWorkflowSaveComplete = (success: boolean, message: string, workflowId?: string) => {
    const icon = success ? '✅' : '❌';
    const content = `${icon} ${message}${workflowId ? ` You can access it anytime from the Workflows section.` : ''}`;

    const saveResultMessage: MessageItem = {
      id: getUniqueId(),
      created_at: new Date().toISOString(),
      role: 'assistant',
      content: content,
      isError: !success,
    };

    setMessageItems((prev) => [...prev, saveResultMessage]);
    addMessage(saveResultMessage);

    // If save was successful, dismiss the workflow card
    if (success) {
      setUiWorkflowCard(undefined);
    }

    // Scroll to show the message
    resetScroll();
  };

  const handleRetry = (originalText?: string) => {
    if (originalText) {
      processChat({ text: originalText });
    }
  };

  // Debug function to test API connection
  const testConnection = async () => {
    console.log('🔗 [DEBUG] Testing API connection...');
    console.log('🌐 [DEBUG] API URL:', apiUrl);

    if (!apiUrl) {
      console.error('❌ [DEBUG] No API URL configured!');
      return;
    }

    try {
      const response = await axios.get(`${apiUrl}/health`, { timeout: 10000 });
      console.log('✅ [DEBUG] Health check successful:', response.data);
    } catch (error: any) {
      console.error('❌ [DEBUG] Health check failed:', error);
      console.error('📊 [DEBUG] Health check error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
      });
    }
  };

  // Global debugging helpers (available in browser console)
  useEffect(() => {
    if (debug && typeof window !== 'undefined') {
      // Make debugging functions globally available
      (window as any).sashiDebug = {
        testWorkflowClassification,
        detectWorkflowEntryType,
        analyzeWorkflowCharacteristics,
        getClassificationExplanation,
        testConnection,
        getCurrentWorkflow: () => null, // workflowConfirmationCard no longer used
        getCurrentUIWorkflow: () => uiWorkflowCard,
        // Helper to create test workflows
        createTestWorkflow: (type: 'form' | 'query' | 'mutation') => {
          const testWorkflows = {
            form: {
              type: 'workflow',
              actions: [
                {
                  id: 'test_form',
                  tool: 'create_user',
                  description: 'Create a new user with provided information',
                  parameters: {
                    name: 'userInput.name',
                    email: 'userInput.email',
                    role: 'userInput.role',
                  },
                },
              ],
              options: { execute_immediately: false, generate_ui: true },
            },
            query: {
              type: 'workflow',
              actions: [
                {
                  id: 'test_query',
                  tool: 'get_users',
                  description: 'Fetch all users from the database',
                  parameters: {},
                },
              ],
              options: { execute_immediately: true, generate_ui: false },
              executionResults: [{ actionId: 'test_query', result: { users: [] }, uiElement: { type: 'result' } }],
            },
            mutation: {
              type: 'workflow',
              actions: [
                {
                  id: 'test_mutation',
                  tool: 'delete_old_files',
                  description: 'Remove files older than 30 days',
                  parameters: { days: 30 },
                },
              ],
              options: { execute_immediately: false, generate_ui: false },
            },
          };
          return testWorkflows[type];
        },
        // Test the user's specific workflow structure
        testUserWorkflow: () => {
          const userWorkflow = {
            output: {
              type: 'workflow',
              description: 'Get user information and files for a user by user id',
              actions: [
                {
                  id: 'get_user_info',
                  tool: 'get_user_by_id',
                  description: 'Get user information by user id',
                  parameters: {
                    userId: '<user_id>',
                  },
                  parameterMetadata: {
                    userId: {
                      type: 'number',
                      description: 'a users id',
                      required: true,
                    },
                  },
                  map: false,
                },
                {
                  id: 'get_user_files',
                  tool: 'get_file_by_user_id',
                  description: 'Get files for the user',
                  parameters: {
                    userId: 'get_user_info.id',
                  },
                  parameterMetadata: {
                    userId: {
                      type: 'number',
                      description: 'a users id',
                      required: true,
                    },
                  },
                  map: false,
                },
              ],
            },
          };

          console.log('🧪 Testing user workflow structure...');
          console.log('Original structure:', userWorkflow);

          // Test extraction from output key
          const extractedWorkflow = userWorkflow.output;
          console.log('Extracted workflow:', extractedWorkflow);

          // Test classification
          const classification = (window as any).sashiDebug.detectWorkflowEntryType(extractedWorkflow);
          console.log('Classification result:', classification);

          return { userWorkflow, extractedWorkflow, classification };
        },
      };

      console.log('🛠️ Sashi Debug Tools Available:');
      console.log('  sashiDebug.testWorkflowClassification(workflow) - Test workflow classification');
      console.log('  sashiDebug.createTestWorkflow("form"|"query"|"mutation") - Create test workflows');
      console.log('  sashiDebug.testUserWorkflow() - Test your specific workflow structure');
      console.log('  sashiDebug.getCurrentWorkflow() - Get current workflow being processed');
      console.log('  sashiDebug.testConnection() - Test API connection');
      console.log('Example: sashiDebug.testWorkflowClassification(sashiDebug.createTestWorkflow("form"))');
      console.log('Your issue: sashiDebug.testUserWorkflow()');
    }
  }, [debug, uiWorkflowCard]);

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
              <Message
                key={item.id}
                role={item.role}
                content={item.content}
                isError={item.isError}
                retryData={item.retryData}
                onRetry={handleRetry}
              />
            ))}

            {loading && (
              <Message
                role="assistant"
                isThinking={true}
                content={
                  loadingTimeout ? '⏱️ This is taking longer than usual. The request might timeout soon...' : undefined
                }
              />
            )}

            {!!confirmationData && (
              <ConfirmationCard
                confirmationData={confirmationData!}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            )}

            {uiWorkflowCard && apiUrl && (
              <WorkflowUICard
                workflow={uiWorkflowCard}
                apiUrl={apiUrl}
                onClose={() => setUiWorkflowCard(undefined)}
                onSaveComplete={handleWorkflowSaveComplete}
                isInChat={true}
              />
            )}

            {uiPreviewCard && apiUrl && <WorkflowForm workflow={uiPreviewCard} apiUrl={apiUrl} />}

            <div ref={messagesEndRef} />
          </div>

          <div className="grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[500px] mb-4">
            {debug && (
              <div className="col-span-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs">
                <div className="font-bold mb-2">🐛 Debug Panel</div>
                <div>API URL: {apiUrl || 'Not configured'}</div>
                <div>Connected to Hub: {connectedToHub ? 'Yes' : 'No'}</div>
                <div>Loading: {loading ? 'Yes' : 'No'}</div>
                <div>Loading Timeout Warning: {loadingTimeout ? 'Yes' : 'No'}</div>
                <div>Messages Count: {messageItems.length}</div>
                <button
                  onClick={testConnection}
                  className="mt-2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Test Connection
                </button>
              </div>
            )}
          </div>

          <form
            className="flex w-full flex-row gap-2 relative justify-center items-center"
            onSubmit={async (event) => {
              event.preventDefault();
              handleSubmit(event);
              setInputText('');
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
