import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowResult } from '@/models/payload';
import { analyzeWorkflowResult, getSuggestedVisualizationConfig } from '@/utils/dataTypeDetection';
import { BarChart, LineChart, PieChart, ScatterChart, Table, Timer } from 'lucide-react';
import React, { useState } from 'react';

interface VisualizationPickerProps {
  result: WorkflowResult;
  onVisualizationSelect: (type: string, config: any) => void;
}

const REFRESH_INTERVALS = [
  { value: '0', label: 'No auto-refresh' },
  { value: '10000', label: 'Every 10 seconds' },
  { value: '30000', label: 'Every 30 seconds' },
  { value: '60000', label: 'Every minute' },
  { value: '300000', label: 'Every 5 minutes' },
  { value: '600000', label: 'Every 10 minutes' },
];

const VISUALIZATION_ICONS = {
  line: LineChart,
  bar: BarChart,
  pie: PieChart,
  area: LineChart,
  scatter: ScatterChart,
  table: Table,
};

export const VisualizationPicker: React.FC<VisualizationPickerProps> = ({ result, onVisualizationSelect }) => {
  const [selectedType, setSelectedType] = useState<string>('table');
  const [config, setConfig] = useState<any>({});
  const analysis = analyzeWorkflowResult(result);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setConfig(getSuggestedVisualizationConfig(result, type as any));
  };

  const handleConfigChange = (key: string, value: string | string[]) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    const suggestedConfig = getSuggestedVisualizationConfig(result, selectedType as any);
    onVisualizationSelect(selectedType, { ...suggestedConfig, ...config });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visualization Options</CardTitle>
        <CardDescription>Choose how to visualize your data</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedType} onValueChange={handleTypeChange}>
          <TabsList className="grid grid-cols-4 gap-2">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="line" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Line
            </TabsTrigger>
            <TabsTrigger value="bar" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Bar
            </TabsTrigger>
            <TabsTrigger value="pie" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Pie
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedType} className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={config.refreshInterval?.toString() || '30000'}
                  onValueChange={(value) => handleConfigChange('refreshInterval', value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select refresh interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_INTERVALS.map((interval) => (
                      <SelectItem key={interval.value} value={interval.value}>
                        {interval.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedType !== 'table' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">X Axis</label>
                      <Select value={config.xAxis} onValueChange={(value) => handleConfigChange('xAxis', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select X axis" />
                        </SelectTrigger>
                        <SelectContent>
                          {analysis.fields.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Y Axis</label>
                      <Select value={config.yAxis} onValueChange={(value) => handleConfigChange('yAxis', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Y axis" />
                        </SelectTrigger>
                        <SelectContent>
                          {analysis.fields.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Color Field</label>
                      <Select
                        value={config.colorField}
                        onValueChange={(value) => handleConfigChange('colorField', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select color field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {analysis.fields.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Size Field</label>
                      <Select
                        value={config.sizeField}
                        onValueChange={(value) => handleConfigChange('sizeField', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {analysis.fields
                            .filter((field) => field.type === 'numeric')
                            .map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                {field.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {selectedType === 'table' && (
                <div>
                  <label className="text-sm font-medium">Columns</label>
                  <div className="mt-2 space-y-2">
                    {analysis.fields.map((field) => (
                      <div key={field.name} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={field.name}
                          checked={config.columns?.includes(field.name) ?? true}
                          onChange={(e) => {
                            const currentColumns = config.columns || analysis.fields.map((f) => f.name);
                            const newColumns = e.target.checked
                              ? [...currentColumns, field.name]
                              : currentColumns.filter((col: string) => col !== field.name);
                            handleConfigChange('columns', newColumns);
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor={field.name} className="text-sm">
                          {field.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleApply}>Apply Visualization</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
