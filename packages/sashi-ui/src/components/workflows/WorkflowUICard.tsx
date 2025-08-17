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
import { sendExecuteWorkflow } from '@/services/workflow.service';
import useAppStore from '@/store/chat-store';
import { HEADER_API_TOKEN } from '@/utils/contants';
import { WorkflowStorage } from '@/utils/workflowStorage';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';
import axios from 'axios';
import { Check, Code, Copy, GripVertical, Heart, Trash2, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import {
  FormPayload,
  LabelPayload,
  SavedWorkflow,
  UIWorkflowDefinition,
  WorkflowResponse,
  WorkflowResult,
  WorkflowUIComponent,
} from '../../models/payload';
import { WorkflowResultViewer } from './WorkflowResultViewer';

interface WorkflowUICardProps {
  workflow: UIWorkflowDefinition;
  apiUrl: string;
  onSave?: (workflowId: string) => void; // Optional callback for external save handling
  onSaveComplete?: (success: boolean, message: string, workflowId?: string) => void; // Callback with save result
  onClose?: () => void; // Optional callback to close/dismiss the card (mainly for chat mode)
  isDraggable?: boolean;
  isInChat?: boolean;
  // Dashboard-specific props
  savedWorkflow?: SavedWorkflow; // The full saved workflow for dashboard operations
  onWorkflowChange?: () => void; // Callback to refresh dashboard when workflow changes
}

export const WorkflowUICard: React.FC<WorkflowUICardProps> = ({
  workflow,
  apiUrl,
  onSave,
  onSaveComplete,
  onClose,
  isDraggable = false,
  isInChat = true,
  savedWorkflow,
  onWorkflowChange,
}) => {
  console.log('workflow ui card inspect: ', workflow);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [results, setResults] = useState<WorkflowResult[]>(() => {
    // Initialize with existing results if available
    return workflow.workflow.executionResults || [];
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPinned, setIsPinned] = useState(savedWorkflow?.favorited || false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    // Default to results tab if results are available
    return workflow.workflow.executionResults && workflow.workflow.executionResults.length > 0 ? 'results' : 'workflow';
  });
  const [isCopied, setIsCopied] = useState(false);
  const connectedToHub = useAppStore((state) => state.connectedToHub);
  const formRef = useRef<HTMLFormElement>(null);

  // CSV parsing function
  const parseCSV = (csvText: string): Array<Record<string, any>> => {
    if (!csvText.trim()) return [];

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header + 1 data row

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      if (values.length === headers.length) {
        const row: Record<string, any> = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return data;
  };

  // CSV field validation
  const validateCSVColumns = (
    csvData: Array<Record<string, any>>,
    expectedColumns: string[]
  ): {
    isValid: boolean;
    missingColumns: string[];
    extraColumns: string[];
  } => {
    if (csvData.length === 0) return { isValid: false, missingColumns: expectedColumns, extraColumns: [] };

    const actualColumns = Object.keys(csvData[0]);
    const missingColumns = expectedColumns.filter((col) => !actualColumns.includes(col));
    const extraColumns = actualColumns.filter((col) => !expectedColumns.includes(col));

    return {
      isValid: missingColumns.length === 0,
      missingColumns,
      extraColumns,
    };
  };

  // Form field validation
  const isFormValid = () => {
    // Check if we have the new UI format with inputComponents
    if (workflow.workflow.ui?.inputComponents) {
      return workflow.workflow.ui.inputComponents.every((field) => {
        if (field.required) {
          // Extract the key from userInput.* format (e.g., "userInput.userId" -> "userId")
          const fieldKey = field.key.startsWith('userInput.') ? field.key.substring('userInput.'.length) : field.key;
          const value = formData[fieldKey];

          // Handle CSV fields specifically
          if (field.type === 'csv') {
            // For CSV fields, the value should always be a string (raw CSV text)
            if (!value || typeof value !== 'string') return false;

            // Try to parse the CSV and validate
            const parsedData = parseCSV(value);
            if (parsedData.length === 0) return false;

            // Check if expected columns are present
            if ((field as any).expectedColumns && (field as any).expectedColumns.length > 0) {
              const validation = validateCSVColumns(parsedData, (field as any).expectedColumns);
              return validation.isValid;
            }

            return true;
          }

          // Handle other field types
          return value !== undefined && value !== '';
        }
        return true;
      });
    }

    // Fallback to old format
    const formPayload = workflow.entry.payload as FormPayload;
    if (!formPayload?.fields) return true;

    return formPayload.fields.every((field) => {
      if (field.required) {
        const value = formData[field.key];
        const fieldAny = field as any;

        // Handle CSV fields specifically
        if (fieldAny.type === 'csv') {
          // For CSV fields, the value should always be a string (raw CSV text)
          if (!value || typeof value !== 'string') return false;

          // Try to parse the CSV and validate
          const parsedData = parseCSV(value);
          if (parsedData.length === 0) return false;

          // Check if expected columns are present
          if (fieldAny.expectedColumns && fieldAny.expectedColumns.length > 0) {
            const validation = validateCSVColumns(parsedData, fieldAny.expectedColumns);
            return validation.isValid;
          }

          return true;
        }

        // Handle other field types
        return value !== undefined && value !== '';
      }
      return true;
    });
  };

  // Handle different input types
  const handleInputChange = (key: string, value: any) => {
    console.log(`🔍 [CSV Debug] Setting form data - key: "${key}", value:`, value);
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      console.log(`🔍 [CSV Debug] Updated form data:`, updated);
      return updated;
    });
  };

  // Render CSV field with validation and preview
  const renderCSVField = (field: WorkflowUIComponent | any) => {
    // Extract the form data key from userInput.* format for new UI, or use key directly for old UI
    const formDataKey = field.key.startsWith('userInput.') ? field.key.substring('userInput.'.length) : field.key;

    // Ensure csvText is always a string - if it's an array, convert back to empty string for display
    const rawValue = formData[formDataKey];
    const csvText = typeof rawValue === 'string' ? rawValue : '';
    const expectedColumns = (field as any).expectedColumns || [];
    const parsedData = parseCSV(csvText);
    const validation = validateCSVColumns(parsedData, expectedColumns);

    return (
      <div className="space-y-3">
        {/* Expected columns display */}
        {expectedColumns.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Expected columns:</div>
            <div className="flex flex-wrap gap-1">
              {expectedColumns.map((col: string) => (
                <Badge key={col} variant="outline" className="text-xs">
                  {col}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* CSV input textarea */}
        <Textarea
          placeholder={`Paste CSV data here...\nExample:\n${expectedColumns.join(',')}\nvalue1,value2,value3`}
          value={csvText}
          onChange={(e) => {
            // Always store the raw CSV text as a string
            handleInputChange(formDataKey, e.target.value);
          }}
          required={field.required}
          className="min-h-[120px] font-mono text-sm"
        />

        {/* Validation messages */}
        {csvText && (
          <div className="space-y-2">
            {validation.missingColumns.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 rounded-md">
                <div className="text-sm font-medium text-red-800 dark:text-red-200">Missing required columns:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {validation.missingColumns.map((col) => (
                    <Badge key={col} variant="destructive" className="text-xs">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {validation.extraColumns.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md">
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Extra columns (will be ignored):
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {validation.extraColumns.map((col) => (
                    <Badge key={col} variant="secondary" className="text-xs">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {validation.isValid && parsedData.length > 0 && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 rounded-md">
                <div className="text-sm font-medium text-green-800 dark:text-green-200">
                  ✅ CSV data is valid ({parsedData.length} row{parsedData.length !== 1 ? 's' : ''})
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data preview */}
        {parsedData.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Preview (first 3 rows):</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {Object.keys(parsedData[0]).map((header) => (
                      <th key={header} className="text-left py-1 px-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 3).map((row, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                      {Object.values(row).map((value, colIndex) => (
                        <td key={colIndex} className="py-1 px-2 text-gray-600 dark:text-gray-400">
                          {String(value).length > 20 ? String(value).substring(0, 20) + '...' : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ... and {parsedData.length - 3} more row{parsedData.length - 3 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Execute workflow with form data
  const handleExecute = async () => {
    // Otherwise, use internal execution logic for chat workflows
    setIsExecuting(true);
    setExecutionError(null); // Clear any previous errors

    try {
      console.log('🔍 [CSV Debug] Form data before execution:', formData);
      console.log(
        '🔍 [CSV Debug] Original workflow parameters:',
        workflow.workflow.actions?.map((a) => ({
          id: a.id,
          tool: a.tool,
          parameters: a.parameters,
          parameterMetadata: (a as any).parameterMetadata,
        }))
      );

      // Create a copy of the workflow with form data
      const workflowWithFormData: WorkflowResponse = { ...workflow.workflow };

      // Update actions to include form data
      if (workflowWithFormData.actions) {
        workflowWithFormData.actions = workflowWithFormData.actions.map((action) => {
          const updatedParams = { ...action.parameters };

          // Replace userInput.* parameters with form data (new UI format)
          for (const key in updatedParams) {
            const value = updatedParams[key];
            if (typeof value === 'string' && value.startsWith('userInput.')) {
              // Handle array operations like userInput.csvData[*].fieldName
              if (value.includes('[*]')) {
                const [baseParam, fieldName] = value.split('[*].');
                const formFieldKey = baseParam.substring('userInput.'.length);

                console.log(
                  `🔍 [CSV Debug] Processing array parameter "${key}" with value "${value}" -> baseParam: "${baseParam}", field: "${fieldName}", formFieldKey: "${formFieldKey}"`
                );

                if (formData[formFieldKey] !== undefined) {
                  // For array operations, check if the base field (csvData) has CSV type metadata
                  // Look for the corresponding UI input component to determine if it's CSV
                  let isCSVField = false;
                  if (workflow.workflow.ui?.inputComponents) {
                    const csvComponent = workflow.workflow.ui.inputComponents.find(
                      (comp) => comp.key === `userInput.${formFieldKey}` && comp.type === 'csv'
                    );
                    isCSVField = !!csvComponent;
                  }

                  console.log(`🔍 [CSV Debug] Is "${formFieldKey}" a CSV field:`, isCSVField);

                  if (isCSVField && typeof formData[formFieldKey] === 'string') {
                    // Parse CSV text into array of objects, then extract the field
                    const parsedData = parseCSV(formData[formFieldKey]);
                    console.log(`🔍 [CSV Debug] Parsed CSV data for "${key}":`, parsedData);

                    // Extract the specific field from each row
                    const extractedValues = parsedData.map((row) => row[fieldName]);
                    console.log(`🔍 [CSV Debug] Extracted values for field "${fieldName}":`, extractedValues);
                    updatedParams[key] = extractedValues;
                  } else {
                    console.log(`🔍 [CSV Debug] Not a CSV field or not string type for "${formFieldKey}"`);
                  }
                } else {
                  console.log(`🔍 [CSV Debug] No form data found for "${formFieldKey}"`);
                }
              } else {
                // Handle simple userInput.field parameters
                const formFieldKey = value.substring('userInput.'.length);
                console.log(
                  `🔍 [CSV Debug] Processing simple parameter "${key}" with value "${value}" -> formFieldKey: "${formFieldKey}"`
                );
                console.log(
                  `🔍 [CSV Debug] FormData has key "${formFieldKey}":`,
                  formData[formFieldKey] !== undefined,
                  'Value:',
                  formData[formFieldKey]
                );

                if (formData[formFieldKey] !== undefined) {
                  // Check if this is a CSV field that needs to be parsed
                  const paramMetadata = (action as any).parameterMetadata?.[key];
                  console.log(`🔍 [CSV Debug] Parameter metadata for "${key}":`, paramMetadata);

                  if (paramMetadata?.type === 'csv' && typeof formData[formFieldKey] === 'string') {
                    // Parse CSV text into array of objects for execution
                    const parsedData = parseCSV(formData[formFieldKey]);
                    console.log(`🔍 [CSV Debug] Parsed CSV data for "${key}":`, parsedData);
                    updatedParams[key] = parsedData;
                  } else {
                    console.log(`🔍 [CSV Debug] Using raw form data for "${key}":`, formData[formFieldKey]);
                    updatedParams[key] = formData[formFieldKey];
                  }
                } else {
                  console.log(`🔍 [CSV Debug] No form data found for "${formFieldKey}"`);
                }
              }
            }
          }

          // Replace parameter values with form data where appropriate (old format)
          for (const key in updatedParams) {
            // Check if field exists in our form data
            if (formData[key] !== undefined) {
              // Check if this is a CSV field that needs to be parsed
              const paramMetadata = (action as any).parameterMetadata?.[key];
              if (paramMetadata?.type === 'csv' && typeof formData[key] === 'string') {
                // Parse CSV text into array of objects for execution
                const parsedData = parseCSV(formData[key]);
                updatedParams[key] = parsedData;
              } else {
                updatedParams[key] = formData[key];
              }
            }
          }

          return {
            ...action,
            parameters: updatedParams,
          };
        });
      }

      console.log('🔍 [CSV Debug] Final workflow being sent to server:', JSON.stringify(workflowWithFormData, null, 2));

      const response = await sendExecuteWorkflow(apiUrl, workflowWithFormData);

      if (response.data.success) {
        // Cast the results to UI WorkflowResult type to handle type differences
        const uiResults = (response.data.results || []) as WorkflowResult[];
        setResults(uiResults);
        // Switch to results tab after successful execution
        setActiveTab('results');
      } else {
        // Handle case where API responds with success: false
        const errorMessage = response.data.error || (response.data as any).details || 'Workflow execution failed';
        setExecutionError(errorMessage);
        setActiveTab('results'); // Show results tab to display the error
      }
    } catch (error: any) {
      console.error('Error executing workflow:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.details ||
        error.message ||
        'An unexpected error occurred while executing the workflow';
      setExecutionError(errorMessage);
      setActiveTab('results'); // Show results tab to display the error
    } finally {
      setIsExecuting(false);
    }
  };

  // Copy workflow to clipboard
  const copyWorkflow = () => {
    navigator.clipboard.writeText(JSON.stringify(workflow, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Save workflow
  const saveWorkflow = async () => {
    if (!connectedToHub) {
      const message = 'Cannot save workflow: Hub connection required';
      setSaveError(message);
      if (onSaveComplete) {
        onSaveComplete(false, message);
      } else {
        alert(message);
      }
      return;
    }

    setSaveError(null); // Clear any previous save errors

    try {
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

      let savedSuccessfully = false;
      let saveMessage = '';

      // Save to server using WorkflowStorage
      try {
        const workflowStorage = new WorkflowStorage({
          serverUrl: apiUrl,
        });
        await workflowStorage.saveWorkflow(savedWorkflow);
        console.log('Workflow saved to server');
        savedSuccessfully = true;
        saveMessage = `Workflow "${savedWorkflow.name}" has been saved to your dashboard successfully!`;
      } catch (apiError: any) {
        console.error('Error saving to server:', apiError);
        const errorMessage = apiError.response?.data?.error || apiError.message || 'Failed to save workflow to server';
        setSaveError(errorMessage);

        if (onSaveComplete) {
          onSaveComplete(false, errorMessage);
          return; // Don't proceed with callbacks if using onSaveComplete
        } else {
          // Show error but don't throw - let user see the error in UI
          return;
        }
      }

      // Call external onSave callback if provided (for backward compatibility)
      if (onSave) {
        onSave(workflowId);
      }

      // If this is being used in the dashboard context, refresh the dashboard
      if (onWorkflowChange) {
        onWorkflowChange();
      }

      // Call onSaveComplete callback with save result
      if (onSaveComplete) {
        onSaveComplete(true, saveMessage, workflowId);
      } else {
        alert(saveMessage);
      }
    } catch (error: any) {
      console.error('Error saving workflow:', error);
      const errorMessage = error.message || 'Failed to save workflow. Please try again.';
      setSaveError(errorMessage);

      // Call onSaveComplete callback with save result
      if (onSaveComplete) {
        onSaveComplete(false, errorMessage);
      }
    }
  };

  // Delete workflow (only for dashboard workflows)
  const deleteWorkflow = async () => {
    if (!savedWorkflow) return;

    const apiToken = useAppStore.getState().apiToken;

    try {
      if (apiUrl && apiToken) {
        // Delete from API
        await axios.delete(`${apiUrl}/workflows/${savedWorkflow.id}`, {
          headers: {
            [HEADER_API_TOKEN]: apiToken,
          },
        });
        console.log('Workflow deleted from API');
      }

      // Notify dashboard to refresh
      if (onWorkflowChange) {
        onWorkflowChange();
      }
    } catch (error: any) {
      console.error('Error deleting from API:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete workflow';
      setSaveError(`Delete Error: ${errorMessage}`);
    }
  };

  // Toggle favorite status (only for dashboard workflows)
  const toggleFavorite = async () => {
    if (!savedWorkflow) return;

    const apiToken = useAppStore.getState().apiToken;
    const updatedWorkflow = {
      ...savedWorkflow,
      favorited: !savedWorkflow.favorited,
    };

    try {
      if (apiUrl && apiToken) {
        // Update on API
        await axios.put(`${apiUrl}/workflows/${savedWorkflow.id}`, updatedWorkflow, {
          headers: {
            [HEADER_API_TOKEN]: apiToken,
          },
        });
        console.log('Workflow favorite status updated on API');
      }

      // Update local state
      setIsPinned(!isPinned);

      // Notify dashboard to refresh
      if (onWorkflowChange) {
        onWorkflowChange();
      }
    } catch (error: any) {
      console.error('Error updating favorite status on API:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update favorite status';
      setSaveError(`Favorite Error: ${errorMessage}`);
    }
  };

  // Render form fields based on type
  const renderFormField = (field: WorkflowUIComponent) => {
    // Handle new UI format with inputComponents
    const fieldType = field.type;
    const fieldKey: string | undefined = field?.key;
    const fieldLabel = field.label;
    const fieldRequired = field.required || false;
    const fieldEnumValues = field.enumValues || [];

    // Extract the form data key from userInput.* format
    const formDataKey = fieldKey?.startsWith('userInput.') ? fieldKey?.substring('userInput.'.length) : fieldKey;
    const fieldValue = formData[formDataKey] || '';

    switch (fieldType) {
      case 'string':
        return (
          <Input
            placeholder={fieldLabel}
            value={fieldValue}
            onChange={(e) => handleInputChange(formDataKey, e.target.value)}
            required={fieldRequired}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder={fieldLabel}
            value={fieldValue}
            onChange={(e) => handleInputChange(formDataKey, parseFloat(e.target.value))}
            required={fieldRequired}
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={!!fieldValue}
              onCheckedChange={(checked) => handleInputChange(formDataKey, checked)}
              id={`switch-${formDataKey}`}
            />
            <Label htmlFor={`switch-${formDataKey}`}>{fieldValue ? 'Enabled' : 'Disabled'}</Label>
          </div>
        );
      case 'enum':
        return (
          <div className="relative overflow-visible">
            <Select value={fieldValue} onValueChange={(value) => handleInputChange(formDataKey, value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={fieldLabel} />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                sideOffset={4}
                className="z-[9999] max-h-[200px] overflow-y-auto"
              >
                {fieldEnumValues.map((value: string) => (
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
            placeholder={fieldLabel}
            value={fieldValue}
            onChange={(e) => handleInputChange(formDataKey, e.target.value)}
            required={fieldRequired}
          />
        );
      case 'csv':
        return renderCSVField(field);
      default:
        return (
          <Input
            placeholder={fieldLabel}
            value={fieldValue}
            onChange={(e) => handleInputChange(formDataKey, e.target.value)}
            required={fieldRequired}
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

          {savedWorkflow && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleFavorite}>
                    {isPinned ? <Heart className="h-4 w-4 fill-red-500 text-red-500" /> : <Heart className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPinned ? 'Remove from favorites' : 'Add to favorites'}</p>
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

          {savedWorkflow && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={deleteWorkflow}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete workflow</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {onClose && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger
            value="results"
            className={`${
              isExecuting
                ? 'text-blue-600'
                : executionError
                ? 'text-red-600'
                : results.length > 0
                ? 'text-green-600'
                : ''
            }`}
          >
            Results
            {isExecuting && <div className="ml-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>}
            {executionError && <div className="ml-1 h-2 w-2 rounded-full bg-red-500"></div>}
            {!isExecuting && !executionError && results.length > 0 && (
              <div className="ml-1 h-2 w-2 rounded-full bg-green-500"></div>
            )}
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
                {/* New UI format */}
                {workflow.workflow.ui?.inputComponents?.map((field: WorkflowUIComponent) => (
                  <div key={field.key} className="space-y-2 overflow-visible">
                    <Label htmlFor={field.key}>
                      {field.label || field.key}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderFormField(field)}
                  </div>
                ))}

                {/* Fallback to old format */}
                {!workflow.workflow.ui?.inputComponents &&
                  (workflow.entry.payload as FormPayload)?.fields?.map((field) => (
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
            {isExecuting ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <div className="text-sm text-muted-foreground">Executing workflow...</div>
              </div>
            ) : executionError ? (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <X className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Workflow Execution Failed</h3>
                      <div className="mt-2 text-sm text-red-700 dark:text-red-300">{executionError}</div>
                    </div>
                    <button
                      onClick={() => setExecutionError(null)}
                      className="ml-3 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExecutionError(null);
                      setActiveTab('workflow');
                    }}
                    className="flex-1"
                  >
                    Try Again
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setExecutionError(null)} className="flex-1">
                    Clear Error
                  </Button>
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Workflow executed successfully
                    </span>
                  </div>
                </div>
                <WorkflowResultViewer results={results.map((result) => result.uiElement)} />
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <div className="space-y-2">
                  <div className="text-sm">No results to display yet</div>
                  <div className="text-xs">Execute the workflow to see results here</div>
                </div>
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>

      {isInChat && (
        <CardFooter className="flex flex-col gap-2 pt-0">
          {saveError && (
            <div className="w-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
              <div className="flex items-start">
                <X className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-800 dark:text-red-200">Save Failed</div>
                  <div className="text-sm text-red-700 dark:text-red-300 mt-1">{saveError}</div>
                </div>
                <button
                  onClick={() => setSaveError(null)}
                  className="ml-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end w-full">
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
          </div>
        </CardFooter>
      )}
    </Card>
  );
};
