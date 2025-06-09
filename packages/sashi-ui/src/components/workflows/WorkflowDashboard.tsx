import { Button } from '@/components/Button';
import { Card, CardContent } from '@/components/ui/card';
import { SavedWorkflow, UIWorkflowDefinition, WorkflowEntryMetadata } from '@/models/payload';
import { motion, Reorder } from 'framer-motion';
import { Grid2X2, List } from 'lucide-react';
import React, { useState } from 'react';
import { WorkflowUICard } from './WorkflowUICard';

interface WorkflowDashboardProps {
  workflows: SavedWorkflow[];
  apiUrl: string;
  onWorkflowsChange: () => void; // Simplified to just refresh callback
}

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({ workflows, apiUrl, onWorkflowsChange }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [items, setItems] = useState(workflows);

  // Update items when workflows change
  React.useEffect(() => {
    setItems(workflows);
  }, [workflows]);

  // Helper function to create UI workflow definition from saved workflow
  const createUIWorkflowDefinition = (workflow: SavedWorkflow): UIWorkflowDefinition => {
    // Since workflow.workflow is already a UIWorkflowDefinition, we can return it directly
    // But we might want to update the entry description with the saved workflow name
    const updatedEntry: WorkflowEntryMetadata = {
      ...workflow.workflow.entry,
      description: workflow.name,
    };

    // Create the UI workflow definition with updated entry
    const uiWorkflowDefinition: UIWorkflowDefinition = {
      ...workflow.workflow,
      entry: updatedEntry,
    };

    // If there are saved results, add them to the workflow response
    if (workflow.results && workflow.results.length > 0) {
      uiWorkflowDefinition.workflow = {
        ...workflow.workflow.workflow,
        executionResults: workflow.results,
      };
    }

    return uiWorkflowDefinition;
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
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground mb-3">No workflows found</p>
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
                    savedWorkflow={workflow}
                    onWorkflowChange={onWorkflowsChange}
                  />
                ) : (
                  <Card className="w-full">
                    <CardContent className="p-4">
                      <WorkflowUICard
                        workflow={createUIWorkflowDefinition(workflow)}
                        apiUrl={apiUrl}
                        isDraggable={true}
                        isInChat={false}
                        savedWorkflow={workflow}
                        onWorkflowChange={onWorkflowsChange}
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
