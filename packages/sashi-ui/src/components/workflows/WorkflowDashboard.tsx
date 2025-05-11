import { Button } from '@/components/Button';
import { Card, CardContent } from '@/components/ui/card';
import { UIWorkflowDefinition, WorkflowEntryMetadata } from '@/models/payload';
import { SavedWorkflow } from '@/pages/DashboardPage';
import { motion, Reorder } from 'framer-motion';
import { Grid2X2, List, Plus } from 'lucide-react';
import React, { useState } from 'react';
import { WorkflowUICard } from './WorkflowUICard';

interface WorkflowDashboardProps {
  workflows: SavedWorkflow[];
  apiUrl: string;
  onRerunWorkflow: (workflow: SavedWorkflow) => Promise<void>;
  onDeleteWorkflow: (workflowId: string) => void;
  onToggleFavorite: (workflowId: string) => void;
  onAddWorkflow?: () => void;
}

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  workflows,
  apiUrl,
  onRerunWorkflow,
  onDeleteWorkflow,
  onToggleFavorite,
  onAddWorkflow,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [items, setItems] = useState(workflows);

  // Update items when workflows change
  React.useEffect(() => {
    setItems(workflows);
  }, [workflows]);

  const handleRerun = async (workflow: SavedWorkflow) => {
    await onRerunWorkflow(workflow);
  };

  // Helper function to create UI workflow definition from saved workflow
  const createUIWorkflowDefinition = (workflow: SavedWorkflow): UIWorkflowDefinition => {
    // If the workflow doesn't have an entry field, create one based on name and description
    const entryType = workflow.workflow.options?.generate_ui ? 'form' : 'button';

    // If there's an execution error, show a label entry type with the error message
    if (workflow.lastExecutionError) {
      const entry: WorkflowEntryMetadata = {
        entryType: 'label',
        description: `Error executing workflow: ${workflow.name}`,
        payload: {
          isError: true,
          message: workflow.lastExecutionError,
        },
      };

      return {
        workflow: workflow.workflow,
        entry,
      };
    }

    // If the workflow is currently executing, use a label to show the loading state
    if (workflow.executing) {
      const entry: WorkflowEntryMetadata = {
        entryType: 'label',
        description: `Executing: ${workflow.name}`,
        payload: {
          isError: false,
          message: 'This workflow is currently running. Please wait...',
        },
      };

      return {
        workflow: workflow.workflow,
        entry,
      };
    }

    // Default case - normal workflow entry
    const entry: WorkflowEntryMetadata = {
      entryType,
      description: workflow.name,
      payload: entryType === 'form' ? { fields: [] } : {},
    };

    // Create a copy of the workflow response and add the execution results if available
    const workflowCopy = {
      ...workflow.workflow,
    };

    // Set the execution results if they exist in the saved workflow
    if (workflow.results && workflow.results.length > 0) {
      // Map results to the format expected by WorkflowResult
      const executionResults = workflow.results.map((uiElement) => {
        return {
          actionId: uiElement.actionId,
          result: {}, // We don't have the raw result data, but the UI element has what we need
          uiElement,
        };
      });

      workflowCopy.executionResults = executionResults;
    }

    return {
      workflow: workflowCopy,
      entry,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')}>
            <Grid2X2 className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
        {onAddWorkflow && (
          <Button size="sm" onClick={onAddWorkflow}>
            <Plus className="h-4 w-4 mr-1" />
            Add Workflow
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground mb-3">No workflows found</p>
          {onAddWorkflow && (
            <Button onClick={onAddWorkflow} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add your first workflow
            </Button>
          )}
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={setItems}
          className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}
        >
          {items.map((workflow) => (
            <Reorder.Item key={workflow.id} value={workflow} className={viewMode === 'grid' ? '' : 'w-full'}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                {viewMode === 'grid' ? (
                  <WorkflowUICard
                    workflow={createUIWorkflowDefinition(workflow)}
                    apiUrl={apiUrl}
                    isDraggable={true}
                    isInChat={false}
                    onClose={() => onDeleteWorkflow(workflow.id)}
                    onPin={() => onToggleFavorite(workflow.id)}
                    onExecute={() => handleRerun(workflow)}
                  />
                ) : (
                  <Card className="w-full">
                    <CardContent className="p-4">
                      <WorkflowUICard
                        workflow={createUIWorkflowDefinition(workflow)}
                        apiUrl={apiUrl}
                        isDraggable={true}
                        isInChat={false}
                        onClose={() => onDeleteWorkflow(workflow.id)}
                        onPin={() => onToggleFavorite(workflow.id)}
                        onExecute={() => handleRerun(workflow)}
                      />
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
    </div>
  );
};
