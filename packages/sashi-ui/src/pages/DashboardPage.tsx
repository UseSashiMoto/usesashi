import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowDashboard } from '@/components/workflows/WorkflowDashboard';
import { SavedWorkflow } from '@/models/payload';
import { WorkflowStorage } from '@/utils/workflowStorage';
import axios from 'axios';
import { AlertCircle, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import useAppStore from 'src/store/chat-store';
import { Layout } from '../components/Layout';
import { HEADER_API_TOKEN } from '../utils/contants';

export const DashboardPage = () => {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = useAppStore((state) => state.apiUrl);
  const apiToken = useAppStore((state) => state.apiToken);
  const connectedToHub = useAppStore((state) => state.connectedToHub);

  // Reload workflows from API and local storage
  const reloadWorkflows = async () => {
    const loadWorkflows = async () => {
      setLoading(true);
      setError(null);

      console.log('loading workflows');

      try {
        if (apiUrl) {
          // Try to load from API first
          console.log('Loading workflows from API...');
          const response = await axios.get(`${apiUrl}/workflows`, {
            headers: {
              [HEADER_API_TOKEN]: apiToken,
            },
          });

          console.log('workflow loading response', response.data);

          if (response.data && Array.isArray(response.data)) {
            // Transform API response to match SavedWorkflow interface
            const workflows: SavedWorkflow[] = response.data.map((item: any) => ({
              id: item.id,
              name: item.name || 'Unnamed Workflow',
              userId: item.userId || '',
              description: item.description || '',
              timestamp: item.createdAt || item.timestamp || new Date().toISOString(),
              workflow: item.workflow,
              results: item.results || [],
              favorited: item.favorited || false,
              executing: false,
              lastExecutionError: null,
            }));

            setSavedWorkflows(workflows);
            console.log(`Loaded ${workflows.length} workflows from API`);
          } else {
            console.log('No workflows returned from API, using local storage as fallback');
            await loadFromLocalStorage();
          }
        } else {
          console.log('No API URL or session token, loading from local storage');
          await loadFromLocalStorage();
        }
      } catch (apiError: any) {
        console.error('Error loading workflows from API:', apiError);
        setError(`Failed to load workflows: ${apiError.response?.data?.error || apiError.message}`);

        // Fallback to local storage
        console.log('Falling back to local storage');
        await loadFromLocalStorage();
      } finally {
        setLoading(false);
      }
    };

    const loadFromLocalStorage = async () => {
      try {
        const workflowStorage = new WorkflowStorage();
        const localWorkflows = await workflowStorage.getAllWorkflowsAsync();
        console.log('workflow loading response local', localWorkflows);

        setSavedWorkflows(localWorkflows);
        console.log(`Loaded ${localWorkflows.length} workflows from local storage`);
      } catch (storageError) {
        console.error('Error loading from local storage:', storageError);
        setSavedWorkflows([]);
      }
    };

    await loadWorkflows();
  };

  // Load workflows on component mount and when API URL or token changes
  useEffect(() => {
    reloadWorkflows();
  }, [apiUrl, apiToken]);

  // Filter workflows based on search term and active tab
  const filteredWorkflows = savedWorkflows.filter((workflow) => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.description?.toLowerCase().includes(searchTerm.toLowerCase());

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

  return (
    <Layout>
      <div className="flex flex-col items-center py-6 h-dvh bg-white dark:bg-zinc-900 overflow-auto">
        <div className="w-full max-w-6xl px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h1 className="text-2xl font-bold mb-4 md:mb-0">Workflow Dashboard</h1>
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
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted-foreground">Loading workflows...</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Error Loading Workflows</h3>
                    <p className="text-muted-foreground max-w-md mb-4">{error}</p>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                      Retry
                    </Button>
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
                        </div>
                      ) : apiUrl ? (
                        <WorkflowDashboard
                          workflows={filteredWorkflows}
                          apiUrl={apiUrl}
                          onWorkflowsChange={reloadWorkflows}
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
