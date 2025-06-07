import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import useAppStore from '@/store/chat-store';
import { WorkflowStorage } from '@/utils/workflowStorage';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';
import axios from 'axios';
import { Check, Code, Copy, GripVertical, Pin, PinOff, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { FormPayload, LabelPayload, SavedWorkflow, UIWorkflowDefinition, WorkflowResult } from '../../models/payload';
import { WorkflowResultViewer } from './WorkflowResultViewer';

interface WorkflowUICardProps {
  workflow: UIWorkflowDefinition;
  apiUrl: string;
  onClose?: () => void;
  onSave?: (workflowId: string) => void;
  onPin?: (isPinned: boolean) => void;
  onExecute?: () => void;
  isDraggable?: boolean;
  isInChat?: boolean;
}

export const WorkflowUICard: React.FC<WorkflowUICardProps> = ({
  workflow,
  apiUrl,
  onClose,
  onSave,
  onPin,
  onExecute,
  isDraggable = false,
  isInChat = true,
}) => {
  console.log('workflow inspect: ', workflow);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [results, setResults] = useState<WorkflowResult[]>(() => {
    // Initialize with existing results if available
    return workflow.workflow.executionResults || [];
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Default to results tab if results are available
    return workflow.workflow.executionResults && workflow.workflow.executionResults.length > 0 ? 'results' : 'workflow';
  });
  const [isCopied, setIsCopied] = useState(false);
  const connectedToHub = useAppStore((state) => state.connectedToHub);
  const formRef = useRef<HTMLFormElement>(null);

  // Form field validation
  const isFormValid = () => {
    const formPayload = workflow.entry.payload as FormPayload;
    if (!formPayload?.fields) return true;

    return formPayload.fields.every((field) => {
      if (field.required) {
        return formData[field.key] !== undefined && formData[field.key] !== '';
      }
      return true;
    });
  };

  // Handle different input types
  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Execute workflow with form data
  const handleExecute = async () => {
    // If external execution handler is provided, use that
    if (onExecute) {
      onExecute();
      return;
    }

    // Otherwise, use internal execution logic
    setIsExecuting(true);

    try {
      // Create a copy of the workflow with form data
      const workflowWithFormData = { ...workflow.workflow };

      // Update actions to include form data
      if (workflowWithFormData.actions) {
        workflowWithFormData.actions = workflowWithFormData.actions.map((action) => {
          const updatedParams = { ...action.parameters };

          // Replace parameter values with form data where appropriate
          for (const key in updatedParams) {
            // Check if field exists in our form data
            if (formData[key] !== undefined) {
              updatedParams[key] = formData[key];
            }
          }

          return {
            ...action,
            parameters: updatedParams,
          };
        });
      }

      const response = await axios.post(`${apiUrl}/workflow/execute`, {
        workflow: workflowWithFormData,
      });

      setResults(response.data.results || []);
      // Switch to results tab after execution
      setActiveTab('results');
    } catch (error) {
      console.error('Error executing workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  // Toggle pinned state
  const togglePin = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);
    if (onPin) onPin(newPinnedState);
  };

  // Copy workflow to clipboard
  const copyWorkflow = () => {
    navigator.clipboard.writeText(JSON.stringify(workflow, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Save workflow
  const saveWorkflow = () => {
    if (!connectedToHub) {
      return;
    }

    try {
      const workflowStorage = new WorkflowStorage();
      const sessionToken = useAppStore.getState().sessionToken;

      // Create a SavedWorkflow object with a unique ID based on timestamp
      const workflowId = `workflow-${Date.now()}`;
      const savedWorkflow: SavedWorkflow = {
        id: workflowId,
        name: workflow.entry.description || 'Unnamed Workflow',
        description: `Saved from ${workflow.entry.entryType} workflow`,
        timestamp: Date.now(), // Use number timestamp instead of string
        userId: sessionToken || 'anonymous', // Use session token as user identifier
        workflow: workflow, // This is already a UIWorkflowDefinition
        results: results.length > 0 ? results : undefined, // Keep full WorkflowResult objects
        favorited: false,
      };

      // Save to storage
      workflowStorage.saveWorkflow(savedWorkflow);

      // Call onSave callback if provided
      if (onSave) {
        onSave(workflowId);
      }
    } catch (error) {
      console.error('Error saving workflow to dashboard:', error);
      alert('Failed to save workflow to dashboard');
    }
  };

  // Render form fields based on type
  const renderFormField = (field: any) => {
    switch (field.type) {
      case 'string':
        return (
          <Input
            placeholder={field.label || field.key}
            value={formData[field.key] || ''}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            required={field.required}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.label || field.key}
            value={formData[field.key] || ''}
            onChange={(e) => handleInputChange(field.key, parseFloat(e.target.value))}
            required={field.required}
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={!!formData[field.key]}
              onCheckedChange={(checked) => handleInputChange(field.key, checked)}
              id={`switch-${field.key}`}
            />
            <Label htmlFor={`switch-${field.key}`}>{formData[field.key] ? 'Enabled' : 'Disabled'}</Label>
          </div>
        );
      case 'enum':
        return (
          <div className="relative overflow-visible">
            <Select value={formData[field.key] || ''} onValueChange={(value) => handleInputChange(field.key, value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={field.label || field.key} />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                sideOffset={4}
                className="z-[9999] max-h-[200px] overflow-y-auto"
              >
                {field.enumValues?.map((value: string) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'text':
        return (
          <Textarea
            placeholder={field.label || field.key}
            value={formData[field.key] || ''}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            required={field.required}
          />
        );
      default:
        return (
          <Input
            placeholder={field.label || field.key}
            value={formData[field.key] || ''}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            required={field.required}
          />
        );
    }
  };

  return (
    <Card className={`w-full md:w-[500px] ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {workflow.entry.description || 'Workflow'}
            <Badge variant="outline" className="ml-2">
              {workflow.entry.entryType}
            </Badge>
          </CardTitle>
          {workflow.workflow.actions && (
            <CardDescription>
              {workflow.workflow.actions.length} action{workflow?.workflow?.actions?.length !== 1 ? 's' : ''}
            </CardDescription>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isDraggable && (
            <Button variant="ghost" size="icon" className="cursor-grab">
              <GripVertical className="h-4 w-4" />
            </Button>
          )}

          {onPin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={togglePin}>
                    {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPinned ? 'Unpin' : 'Pin to dashboard'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={copyWorkflow}>
                  {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy workflow</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="results" disabled={results.length === 0}>
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow">
          <CardContent className="pt-4 pb-2">
            {workflow.entry.entryType === 'button' ? (
              <Button onClick={handleExecute} disabled={isExecuting} className="w-full">
                {isExecuting ? 'Running...' : workflow.entry.description || 'Execute'}
              </Button>
            ) : workflow.entry.entryType === 'form' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecute();
                }}
                className="space-y-4 overflow-visible"
              >
                {(workflow.entry.payload as FormPayload)?.fields?.map((field) => (
                  <div key={field.key} className="space-y-2 overflow-visible">
                    <Label htmlFor={field.key}>
                      {field.label || field.key}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderFormField(field)}
                  </div>
                ))}

                <Button type="submit" disabled={isExecuting || !isFormValid()} className="w-full mt-4">
                  {isExecuting ? 'Running...' : 'Execute'}
                </Button>
              </form>
            ) : workflow.entry.entryType === 'label' ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-md ${
                    (workflow.entry.payload as LabelPayload)?.isError
                      ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  <div className="font-medium mb-1">{workflow.entry.description || 'Message'}</div>
                  {(workflow.entry.payload as LabelPayload)?.message && (
                    <div className="text-sm">{(workflow.entry.payload as LabelPayload).message}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">Unknown UI type: {workflow.entry.entryType}</div>
            )}
          </CardContent>
        </TabsContent>

        <TabsContent value="steps">
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">About this workflow</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Review the steps that will be executed when you run this workflow. This helps you understand exactly
                  what will happen.
                </p>
              </div>

              <h3 className="text-sm font-medium mb-2">This workflow will execute these steps:</h3>

              <div className="border rounded-md divide-y">
                {workflow.workflow?.actions?.map((action, index) => (
                  <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-start">
                      <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 mr-2 flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center">
                          <span className="mr-1">{action.tool.replace(/^functions\./, '')}</span>
                          <Badge variant="outline" className="ml-1 text-xs">
                            Function
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{action.description}</div>

                        {Object.keys(action.parameters).length > 0 && (
                          <div className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-hidden">
                            <div className="font-mono flex items-center text-xs mb-1">
                              <Code className="h-3 w-3 mr-1" /> Parameters:
                            </div>
                            {Object.entries(action.parameters).map(([key, value]) => (
                              <div key={key} className="pl-3 font-mono break-all">
                                {key}:{' '}
                                {typeof value === 'string'
                                  ? `"${value.length > 30 ? value.substring(0, 30) + '...' : value}"`
                                  : JSON.stringify(value)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {workflow?.workflow?.actions?.length === 0 && (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                  This workflow doesn't have any steps defined.
                </div>
              )}

              <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={() => setActiveTab('workflow')} className="w-full">
                  Continue to Execution
                </Button>
              </div>
            </div>
          </CardContent>
        </TabsContent>

        <TabsContent value="results">
          <CardContent>
            {results.length > 0 ? (
              <WorkflowResultViewer results={results.map((result) => result.uiElement)} />
            ) : (
              <div className="text-center text-muted-foreground py-4">No results to display yet</div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>

      {isInChat && (
        <CardFooter className="flex justify-end pt-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button variant="outline" size="sm" onClick={saveWorkflow} disabled={!connectedToHub}>
                    Save to Dashboard
                  </Button>
                </div>
              </TooltipTrigger>
              {!connectedToHub && (
                <TooltipContent>
                  <p>Cannot save workflow: Hub connection required</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </CardFooter>
      )}
    </Card>
  );
};
