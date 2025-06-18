import { Layout } from '@/components/Layout';
import { SortableItem } from '@/components/SortableItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chart } from '@/components/visualizations/Chart';
import { Table } from '@/components/visualizations/Table';
import { VisualizationPicker } from '@/components/visualizations/VisualizationPicker';
import { useToast } from '@/hooks/use-toast';
import { WorkflowResult } from '@/models/payload';
import useAppStore from '@/store/chat-store';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import axios from 'axios';
import { Plus, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface VisualizationConfig {
  type: 'table' | 'chart' | 'card' | 'metric';
  data: any;
  config: {
    title: string;
    description?: string;
    refreshInterval?: number;
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
    xAxis?: string;
    yAxis?: string;
    colorField?: string;
    sizeField?: string;
    columns?: string[];
    layout?: 'horizontal' | 'vertical';
  };
}

interface GridItem {
  id: string;
  visualization: VisualizationConfig;
  workflowResult?: WorkflowResult;
  lastUpdated?: Date;
}

export const WorkflowVisualizationPage = () => {
  const [items, setItems] = useState<GridItem[]>([]);
  const [selectedResult, setSelectedResult] = useState<WorkflowResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const apiUrl = useAppStore((state) => state.apiUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleVisualizationSelect = (type: string, config: any) => {
    if (!selectedResult) return;

    const newItem: GridItem = {
      id: `viz_${Date.now()}`,
      visualization: {
        type: type === 'table' ? 'table' : 'chart',
        data: selectedResult.result,
        config: {
          title: selectedResult.uiElement.content.title,
          description: selectedResult.uiElement.content.content,
          chartType: type as any,
          refreshInterval: 30000, // Default 30 seconds refresh
          ...config,
        },
      },
      workflowResult: selectedResult,
      lastUpdated: new Date(),
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedResult(null);
  };

  const fetchWorkflowResults = useCallback(async () => {
    if (!apiUrl || !sessionToken) {
      setError('API URL or session token not set');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiUrl}/audit-logs`, {
        headers: {
          'x-sashi-session-token': sessionToken,
        },
      });

      if (response.data.success && response.data.results) {
        // Filter for successful workflow executions with results
        const workflowResults = response.data.results
          .filter((log: any) => log.status === 'success' && log.result?.results?.length > 0)
          .map((log: any) => log.result.results)
          .flat();

        // Update items with workflow results
        setItems((prev) => {
          const newItems = [...prev];
          workflowResults.forEach((result: WorkflowResult) => {
            if (!newItems.some((item) => item.workflowResult?.actionId === result.actionId)) {
              newItems.push({
                id: `viz_${result.actionId}`,
                visualization: {
                  type: 'table',
                  data: result.result,
                  config: {
                    title: result.uiElement.content.title,
                    description: result.uiElement.content.content,
                    columns: Object.keys(result.result),
                    refreshInterval: 30000,
                  },
                },
                workflowResult: result,
                lastUpdated: new Date(),
              });
            }
          });
          return newItems;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow results');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch workflow results',
      });
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, sessionToken, toast]);

  const refreshVisualization = useCallback(
    async (item: GridItem) => {
      if (!item.workflowResult?.actionId) return;

      try {
        const response = await axios.get(`${apiUrl}/audit-logs/${item.workflowResult.actionId}`, {
          headers: {
            'x-sashi-session-token': sessionToken,
          },
        });

        if (response.data.success && response.data.result) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    visualization: {
                      ...i.visualization,
                      data: response.data.result.result,
                    },
                    lastUpdated: new Date(),
                  }
                : i
            )
          );
        }
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to refresh visualization: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    },
    [apiUrl, sessionToken, toast]
  );

  // Set up auto-refresh for each visualization
  useEffect(() => {
    const refreshIntervals = items.map((item) => {
      if (item.visualization.config.refreshInterval) {
        return setInterval(() => {
          refreshVisualization(item);
        }, item.visualization.config.refreshInterval);
      }
      return null;
    });

    return () => {
      refreshIntervals.forEach((interval) => {
        if (interval) clearInterval(interval);
      });
    };
  }, [items, refreshVisualization]);

  // Initial fetch
  useEffect(() => {
    fetchWorkflowResults();
  }, [fetchWorkflowResults]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all(items.map((item) => refreshVisualization(item)));
      toast({
        title: 'Success',
        description: 'All visualizations refreshed',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to refresh some visualizations',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center py-6 h-dvh bg-white dark:bg-zinc-900 overflow-auto">
        <div className="w-full max-w-6xl px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h1 className="text-2xl font-bold mb-4 md:mb-0">Workflow Visualizations</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh All
              </Button>
              <Button variant="outline" onClick={() => setSelectedResult(null)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Visualization
              </Button>
            </div>
          </div>

          {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

          {selectedResult && (
            <div className="mb-8">
              <VisualizationPicker result={selectedResult} onVisualizationSelect={handleVisualizationSelect} />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>Visualize your workflow outputs in a customizable dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[600px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[600px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex items-center justify-center h-[600px] text-gray-500">
                    No visualizations available. Select a workflow result to create one.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SortableContext items={items} strategy={rectSortingStrategy}>
                        {items.map((item) => (
                          <SortableItem key={item.id} id={item.id}>
                            {item.visualization.type === 'chart' ? (
                              <Chart
                                type={item.visualization.config.chartType || 'line'}
                                data={item.visualization.data}
                                xAxis={item.visualization.config.xAxis || ''}
                                yAxis={item.visualization.config.yAxis || ''}
                                title={item.visualization.config.title}
                                colorField={item.visualization.config.colorField}
                                sizeField={item.visualization.config.sizeField}
                              />
                            ) : (
                              <Table
                                data={item.visualization.data}
                                columns={item.visualization.config.columns || []}
                                title={item.visualization.config.title}
                              />
                            )}
                          </SortableItem>
                        ))}
                      </SortableContext>
                    </div>
                  </DndContext>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
