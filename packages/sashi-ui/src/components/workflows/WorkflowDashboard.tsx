import { Button } from '@/components/Button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, Reorder } from 'framer-motion';
import { Grid2X2, List, Plus, Save } from 'lucide-react';
import React, { useState } from 'react';
import { UIWorkflowDefinition } from '../../models/payload';
import { WorkflowUICard } from './WorkflowUICard';

interface WorkflowDashboardProps {
  workflows: UIWorkflowDefinition[];
  apiUrl: string;
  onSaveLayout?: (layout: any) => void;
  onAddWorkflow?: () => void;
  onRemoveWorkflow?: (workflowId: string) => void;
}

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  workflows,
  apiUrl,
  onSaveLayout,
  onAddWorkflow,
  onRemoveWorkflow,
}) => {
  const [savedWorkflows, setSavedWorkflows] = useState<UIWorkflowDefinition[]>(workflows);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isEditing, setIsEditing] = useState(false);

  // Add a workflow to dashboard
  const handleAddWorkflow = (workflow: UIWorkflowDefinition) => {
    setSavedWorkflows((prev) => [...prev, workflow]);
  };

  // Remove a workflow from dashboard
  const handleRemoveWorkflow = (index: number) => {
    const newWorkflows = [...savedWorkflows];
    newWorkflows.splice(index, 1);
    setSavedWorkflows(newWorkflows);

    if (onRemoveWorkflow) {
      onRemoveWorkflow(`workflow-${index}`);
    }
  };

  // Save dashboard layout
  const saveLayout = () => {
    if (onSaveLayout) {
      onSaveLayout({
        workflows: savedWorkflows,
        layout: viewMode,
      });
    }
    setIsEditing(false);
  };

  if (savedWorkflows.length === 0) {
    return (
      <Card className="w-full h-64 flex flex-col items-center justify-center">
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">No workflows saved to dashboard yet</p>
          {onAddWorkflow && (
            <Button onClick={onAddWorkflow} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Workflow
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Workflow Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-muted' : ''}
          >
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-muted' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button variant={isEditing ? 'default' : 'outline'} size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Done' : 'Edit'}
          </Button>
          {isEditing && (
            <Button variant="default" size="sm" onClick={saveLayout}>
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
          )}
          {onAddWorkflow && (
            <Button variant="outline" size="sm" onClick={onAddWorkflow}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <Reorder.Group
          as="div"
          axis="y"
          values={savedWorkflows}
          onReorder={setSavedWorkflows}
          className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 gap-4' : 'grid-cols-1 gap-2'}`}
        >
          {savedWorkflows.map((workflow, index) => (
            <Reorder.Item
              key={`workflow-${index}`}
              value={workflow}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <WorkflowUICard
                workflow={workflow}
                apiUrl={apiUrl}
                isDraggable={true}
                isInChat={false}
                onClose={() => handleRemoveWorkflow(index)}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 gap-4' : 'grid-cols-1 gap-2'}`}>
          {savedWorkflows.map((workflow, index) => (
            <motion.div
              key={`workflow-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <WorkflowUICard workflow={workflow} apiUrl={apiUrl} isInChat={false} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
