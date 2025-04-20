import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';
import axios from 'axios';
import { Check, Copy, GripVertical, Pin, PinOff, X } from 'lucide-react';
import React, { useState } from 'react';
import { UIWorkflowDefinition, WorkflowResult } from '../../models/payload';
import { WorkflowResultViewer } from './WorkflowResultViewer';

interface WorkflowUICardProps {
  workflow: UIWorkflowDefinition;
  apiUrl: string;
  onClose?: () => void;
  onSave?: (workflowId: string) => void;
  onPin?: (isPinned: boolean) => void;
  isDraggable?: boolean;
  isInChat?: boolean;
}

export const WorkflowUICard: React.FC<WorkflowUICardProps> = ({
  workflow,
  apiUrl,
  onClose,
  onSave,
  onPin,
  isDraggable = false,
  isInChat = true,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [results, setResults] = useState<WorkflowResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeTab, setActiveTab] = useState('workflow');
  const [isCopied, setIsCopied] = useState(false);

  // Form field validation
  const isFormValid = () => {
    if (!workflow.entry.fields) return true;

    return workflow.entry.fields.every((field) => {
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
    if (onSave) {
      const workflowId = `workflow-${Date.now()}`;
      onSave(workflowId);
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
              {workflow.workflow.actions.length} action{workflow.workflow.actions.length !== 1 ? 's' : ''}
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
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
                className="space-y-4"
              >
                {workflow.entry.fields?.map((field) => (
                  <div key={field.key} className="space-y-2">
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
            ) : (
              <div className="text-center py-4">Unknown UI type: {workflow.entry.entryType}</div>
            )}
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

      <CardFooter className="flex justify-between pt-0">
        {onSave && (
          <Button variant="outline" size="sm" onClick={saveWorkflow} className="ml-auto">
            Save to Dashboard
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
