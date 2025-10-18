import { Button } from '@/components/Button';
import { Card, CardContent } from '@/components/ui/card';
import { SavedWorkflow } from '@/models/payload';
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
                    workflow={workflow.workflow.workflow}
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
                        workflow={workflow.workflow.workflow}
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
