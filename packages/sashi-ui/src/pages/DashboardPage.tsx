import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowDashboard } from '@/components/workflows/WorkflowDashboard';
import { WorkflowResponse, WorkflowUIElement } from '@/models/payload';
import { WorkflowStorage } from '@/utils/workflowStorage';
import axios from 'axios';
import { AlertCircle, Plus, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import useAppStore from 'src/store/chat-store';
import { Layout } from '../components/Layout';

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  workflow: WorkflowResponse;
  results?: WorkflowUIElement[];
  tags?: string[];
  favorited?: boolean;
  executing?: boolean;
  lastExecutionError?: string | null;
}

export const DashboardPage = () => {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const apiUrl = useAppStore((state) => state.apiUrl);
  const connectedToHub = useAppStore((state) => state.connectedToHub);

  // Load saved workflows from storage
  useEffect(() => {
    const workflowStorage = new WorkflowStorage();
    const workflows = workflowStorage.getAllWorkflows();
    setSavedWorkflows(workflows);
  }, []);

  // Filter workflows based on search term and active tab
  const filteredWorkflows = savedWorkflows.filter((workflow) => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (workflow.tags && workflow.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())));

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'favorites') return matchesSearch && workflow.favorited;
    if (activeTab === 'recent') {
      // Show workflows from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return matchesSearch && new Date(workflow.timestamp) >= sevenDaysAgo;
    }
    return matchesSearch;
  });

  // Re-run a workflow
  const rerunWorkflow = async (workflow: SavedWorkflow) => {
    try {
      if (!apiUrl) {
        console.error('API URL is not available');
        return;
      }

      // Show executing state in the UI
      const updatingWorkflow = {
        ...workflow,
        executing: true,
      };
      setSavedWorkflows((prev) => prev.map((wf) => (wf.id === workflow.id ? updatingWorkflow : wf)));

      const response = await axios.post(`${apiUrl}/workflow/execute`, {
        workflow: workflow.workflow,
        debug: true,
      });

      if (response.data.success && response.data.results) {
        // Update the saved workflow with new results
        const workflowStorage = new WorkflowStorage();
        const updatedWorkflow = {
          ...workflow,
          results: response.data.results.map((result: any) => result.uiElement),
          timestamp: new Date().toISOString(),
          executing: false,
          lastExecutionError: null,
        };
        workflowStorage.updateWorkflow(updatedWorkflow);

        // Update state
        setSavedWorkflows((prev) => prev.map((wf) => (wf.id === workflow.id ? updatedWorkflow : wf)));

        console.log(`Workflow "${workflow.name}" executed successfully:`, response.data.results);
      } else {
        // Handle case where response is successful but no results
        const updatedWorkflow = {
          ...workflow,
          executing: false,
          lastExecutionError: 'Workflow executed but returned no results',
        };
        setSavedWorkflows((prev) => prev.map((wf) => (wf.id === workflow.id ? updatedWorkflow : wf)));
        console.warn('Workflow executed but returned no results:', response.data);
      }
    } catch (error: any) {
      // Update workflow with error state
      const errorMessage = error.response?.data?.details || error.message || 'Unknown error';
      const updatedWorkflow = {
        ...workflow,
        executing: false,
        lastExecutionError: errorMessage,
      };

      setSavedWorkflows((prev) => prev.map((wf) => (wf.id === workflow.id ? updatedWorkflow : wf)));

      console.error('Error re-running workflow:', errorMessage, error);
    }
  };

  // Delete a workflow
  const deleteWorkflow = (workflowId: string) => {
    const workflowStorage = new WorkflowStorage();
    workflowStorage.deleteWorkflow(workflowId);
    setSavedWorkflows((prev) => prev.filter((wf) => wf.id !== workflowId));
  };

  // Toggle favorite status
  const toggleFavorite = (workflowId: string) => {
    const workflowStorage = new WorkflowStorage();
    const workflow = savedWorkflows.find((wf) => wf.id === workflowId);
    if (workflow) {
      const updatedWorkflow = {
        ...workflow,
        favorited: !workflow.favorited,
      };
      workflowStorage.updateWorkflow(updatedWorkflow);
      setSavedWorkflows((prev) => prev.map((wf) => (wf.id === workflowId ? updatedWorkflow : wf)));
    }
  };

  // Create a new workflow (placeholder for now)
  const createNewWorkflow = () => {
    alert('Create a new workflow feature coming soon!');
  };

  return (
    <Layout>
      <div className="flex flex-col items-center py-6 h-dvh bg-white dark:bg-zinc-900 overflow-auto">
        <div className="w-full max-w-6xl px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h1 className="text-2xl font-bold mb-4 md:mb-0">Workflow Dashboard</h1>
            <Button disabled={!connectedToHub} onClick={createNewWorkflow}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Saved Workflows</CardTitle>
                    <CardDescription>
                      {connectedToHub
                        ? `${filteredWorkflows.length} workflow${filteredWorkflows.length !== 1 ? 's' : ''} available`
                        : 'Hub connection required'}
                    </CardDescription>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search workflows..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={!connectedToHub}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!connectedToHub ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Hub Connection Required</h3>
                    <p className="text-muted-foreground max-w-md mb-4">
                      Workflows are stored and managed through the Hub. Please ensure you're connected to access your
                      workflows.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                      Currently Disconnected
                    </div>
                  </div>
                ) : (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">All Workflows</TabsTrigger>
                      <TabsTrigger value="favorites">Favorites</TabsTrigger>
                      <TabsTrigger value="recent">Recent</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="mt-4">
                      {filteredWorkflows.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-muted-foreground mb-4">No workflows found.</p>
                          <Button variant="outline" onClick={createNewWorkflow}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Workflow
                          </Button>
                        </div>
                      ) : apiUrl ? (
                        <WorkflowDashboard
                          workflows={filteredWorkflows}
                          apiUrl={apiUrl}
                          onRerunWorkflow={rerunWorkflow}
                          onDeleteWorkflow={deleteWorkflow}
                          onToggleFavorite={toggleFavorite}
                          onAddWorkflow={createNewWorkflow}
                        />
                      ) : (
                        <div className="text-center py-10">
                          <p className="text-muted-foreground mb-4">
                            API URL is not available. Please check your server connection.
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};
