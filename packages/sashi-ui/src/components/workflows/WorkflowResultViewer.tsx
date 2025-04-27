import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { WorkflowUIElement } from '@/models/payload';
import { CopyIcon, ExpandIcon, MinusIcon } from 'lucide-react';
import React, { useState } from 'react';

// Default color palette
const DEFAULT_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#ca8a04', // yellow-600
  '#dc2626', // red-600
  '#9333ea', // purple-600
  '#2dd4bf', // teal-500
  '#f97316', // orange-600
  '#8b5cf6', // violet-500
  '#ec4899', // pink-600
  '#0ea5e9', // sky-600
];

interface WorkflowResultViewerProps {
  results: WorkflowUIElement[];
}

export const WorkflowResultViewer = ({ results }: WorkflowResultViewerProps) => {
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedResults((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Function to prepare data for charts - simplified
  const prepareChartData = (data: any): any[] => {
    // If already an array, use it directly
    if (Array.isArray(data)) {
      return data;
    }

    // If it has a data property that's an array, use that
    if (data && typeof data === 'object' && Array.isArray(data.data)) {
      return data.data;
    }

    // If it has a datasets property that's an array, process each dataset
    if (data && typeof data === 'object' && Array.isArray(data.datasets)) {
      // Combine dataset items into a unified data structure
      const result: any[] = [];
      const labels = data.labels || [];

      data.datasets.forEach((dataset: any, datasetIndex: number) => {
        if (Array.isArray(dataset.data)) {
          dataset.data.forEach((value: any, index: number) => {
            if (!result[index]) {
              result[index] = { name: labels[index] || `Item ${index + 1}` };
            }
            result[index][dataset.label || `Series ${datasetIndex + 1}`] = value;
          });
        }
      });

      return result;
    }

    // If it's an object but not in a recognized format, convert to array of {name, value} pairs
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return Object.entries(data).map(([name, value]) => ({ name, value }));
    }

    // Fallback: return empty array
    return [];
  };

  // Simplified chart rendering - display data as a table or JSON
  const renderChart = (data: any, config: any = {}) => {
    const chartData = prepareChartData(data);
    if (!chartData.length) return <div className="text-muted-foreground">No data available for chart</div>;

    const chartType = config.chartType || 'table';

    return (
      <div className="w-full space-y-4">
        <div className="bg-muted p-4 rounded-md">
          <p className="text-center mb-4">
            Chart visualization ({chartType}) - To view an interactive chart, please install a charting library.
          </p>

          {/* Display the data as a table */}
          {chartData.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(chartData[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((item, index) => (
                    <TableRow key={index}>
                      {Object.entries(item).map(([key, value]) => (
                        <TableCell key={`${index}-${key}`}>
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4">
            <details>
              <summary className="cursor-pointer font-medium">Chart Configuration</summary>
              <pre className="mt-2 text-xs bg-gray-800 text-white p-2 rounded-md overflow-auto">
                {JSON.stringify(config, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  };

  // Function to check if a value is a JSON string
  const isJsonString = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    try {
      const result = JSON.parse(value);
      return typeof result === 'object' && result !== null;
    } catch (e) {
      return false;
    }
  };

  // Function to render appropriate content based on the content type
  const renderContent = (ui: WorkflowUIElement) => {
    // Generate a unique ID for this result
    const resultId = `result-${ui.actionId}`;
    const isExpanded = expandedResults[resultId] || false;

    // Check if content is a JSON string and try to parse it
    let parsedContent: any;
    try {
      if (typeof ui.content.content === 'string') {
        parsedContent = JSON.parse(ui.content.content);
      }
    } catch (e) {
      // If parsing fails, use the content as is (string)
      parsedContent = null;
    }

    // Function to safely stringify any value
    const safeStringify = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    };

    // Function to render a JSON value with proper formatting in a textarea
    const renderJsonValue = (value: any, isExpanded: boolean = false) => {
      const jsonStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      const uniqueId = `json-${Math.random().toString(36).substring(2, 9)}`;

      return (
        <div className="relative">
          <div className="flex justify-end gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(jsonStr)} className="h-7 px-2 text-xs">
              <CopyIcon className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggleExpand(uniqueId)} className="h-7 px-2 text-xs">
              {expandedResults[uniqueId] ? (
                <MinusIcon className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ExpandIcon className="h-3.5 w-3.5 mr-1" />
              )}
              {expandedResults[uniqueId] ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          {expandedResults[uniqueId] ? (
            <Textarea value={jsonStr} readOnly className="min-h-[150px] max-h-[300px] w-full font-mono text-sm" />
          ) : (
            <ScrollArea className="h-[100px] w-full rounded-md border p-2">
              <pre className="whitespace-pre-wrap text-xs font-mono">{jsonStr}</pre>
            </ScrollArea>
          )}
        </div>
      );
    };

    // Handle large text content
    if (typeof ui.content.content === 'string' && !parsedContent && ui.content.content.length > 300) {
      return (
        <div className="relative">
          <div className="flex justify-end gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(ui.content.content)}
              className="h-7 px-2 text-xs"
            >
              <CopyIcon className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggleExpand(resultId)} className="h-7 px-2 text-xs">
              {isExpanded ? <MinusIcon className="h-3.5 w-3.5 mr-1" /> : <ExpandIcon className="h-3.5 w-3.5 mr-1" />}
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          {isExpanded ? (
            <Textarea value={ui.content.content} readOnly className="min-h-[300px] w-full font-mono text-sm" />
          ) : (
            <ScrollArea className="h-[150px] w-full rounded-md border p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono">{ui.content.content}</pre>
            </ScrollArea>
          )}
        </div>
      );
    }

    // Render according to content type
    switch (ui.content.type) {
      case 'graph':
        // If we have a graph type, render the simplified chart view
        return <div className="pt-2">{renderChart(parsedContent, ui.content.config)}</div>;

      case 'textarea':
        // Dedicated type for complex JSON structures or large text blocks
        return (
          <div className="p-2">
            <div className="flex justify-end gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(ui.content.content)}
                className="h-7 px-2 text-xs"
              >
                <CopyIcon className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleExpand(resultId)} className="h-7 px-2 text-xs">
                {isExpanded ? <MinusIcon className="h-3.5 w-3.5 mr-1" /> : <ExpandIcon className="h-3.5 w-3.5 mr-1" />}
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>

            {isExpanded ? (
              <Textarea value={ui.content.content} readOnly className="min-h-[300px] w-full font-mono text-sm" />
            ) : (
              <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {typeof parsedContent === 'object' ? JSON.stringify(parsedContent, null, 2) : ui.content.content}
                </pre>
              </ScrollArea>
            )}
          </div>
        );

      case 'table':
        // Render a table if the content is an array of objects
        if (Array.isArray(parsedContent) && parsedContent.length > 0) {
          // Get all possible keys from all objects in the array
          const allKeys = new Set<string>();
          parsedContent.forEach((item: any) => {
            if (item && typeof item === 'object') {
              Object.keys(item).forEach((key) => allKeys.add(key));
            }
          });

          return (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Array.from(allKeys).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedContent.map((item: any, index: number) => (
                    <TableRow key={index}>
                      {Array.from(allKeys).map((key) => (
                        <TableCell key={`${index}-${key}`}>
                          {typeof item[key] === 'object' || isJsonString(item[key]) ? (
                            <div className="max-w-[300px]">{renderJsonValue(item[key])}</div>
                          ) : (
                            <span>{safeStringify(item[key])}</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        }
        break;

      case 'card':
        // Render card-specific content
        if (parsedContent && typeof parsedContent === 'object') {
          return (
            <div className="space-y-3">
              {Object.entries(parsedContent).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="text-sm font-medium">{key}</div>
                  <div className="rounded-md bg-muted p-2">
                    {typeof value === 'object' || isJsonString(value) ? (
                      renderJsonValue(value)
                    ) : (
                      <div className="text-sm break-words">{String(value)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        break;

      case 'badge':
        // Render badge content (simple key-value pairs)
        if (parsedContent && typeof parsedContent === 'object') {
          // If the entire parsed content is an object or array, render it as a textarea
          if (Array.isArray(parsedContent) || Object.keys(parsedContent).length > 3) {
            return (
              <div className="p-2">
                <div className="flex justify-end gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(parsedContent, null, 2))}
                    className="h-7 px-2 text-xs"
                  >
                    <CopyIcon className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpand(resultId)}
                    className="h-7 px-2 text-xs"
                  >
                    {isExpanded ? (
                      <MinusIcon className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ExpandIcon className="h-3.5 w-3.5 mr-1" />
                    )}
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </div>

                {isExpanded ? (
                  <Textarea
                    value={JSON.stringify(parsedContent, null, 2)}
                    readOnly
                    className="min-h-[200px] w-full font-mono text-sm"
                  />
                ) : (
                  <ScrollArea className="h-[150px] w-full rounded-md border p-4">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {JSON.stringify(parsedContent, null, 2)}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            );
          }

          // For simple key-value pairs only (3 or fewer items), show as badges
          return (
            <div className="flex flex-wrap gap-2">
              {Object.entries(parsedContent).map(([key, value]) => {
                // Only display as badge if the value is a simple type (not an object)
                if (typeof value === 'object' && value !== null) {
                  return (
                    <div key={key} className="w-full space-y-1 mb-2">
                      <div className="text-sm font-medium">{key}</div>
                      {renderJsonValue(value)}
                    </div>
                  );
                }

                // Simple values can be badges
                const displayValue =
                  safeStringify(value).length > 20
                    ? safeStringify(value).substring(0, 17) + '...'
                    : safeStringify(value);

                return (
                  <Badge
                    key={key}
                    variant="outline"
                    className="flex gap-1 hover:bg-muted cursor-default"
                    title={safeStringify(value)}
                  >
                    <span className="font-semibold">{key}:</span>
                    <span>{displayValue}</span>
                  </Badge>
                );
              })}
            </div>
          );
        }
        break;

      default:
        // Default to showing the content as preformatted text
        if (parsedContent) {
          const contentStr = JSON.stringify(parsedContent, null, 2);
          const isLarge = contentStr.length > 500;

          return (
            <div className="relative">
              {isLarge && (
                <div className="flex justify-end gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(contentStr)}
                    className="h-7 px-2 text-xs"
                  >
                    <CopyIcon className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpand(resultId)}
                    className="h-7 px-2 text-xs"
                  >
                    {isExpanded ? (
                      <MinusIcon className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ExpandIcon className="h-3.5 w-3.5 mr-1" />
                    )}
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
              )}

              <ScrollArea className={isExpanded ? 'max-h-[500px]' : 'max-h-[200px]'}>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-md overflow-auto">
                  {contentStr}
                </pre>
              </ScrollArea>
            </div>
          );
        } else {
          return <pre className="whitespace-pre-wrap text-sm">{ui.content.content}</pre>;
        }
    }

    // Fallback to the original content display
    return <pre className="whitespace-pre-wrap text-sm">{ui.content.content}</pre>;
  };

  if (results.length === 0) {
    return <div className="text-center text-muted-foreground">No results available</div>;
  }

  return (
    <div className="space-y-4">
      {results.map((ui) => (
        <Card key={ui.actionId} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{ui.content.title}</CardTitle>
            <CardDescription>
              {ui.tool} • {new Date(ui.content.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderContent(ui)}</CardContent>
        </Card>
      ))}
    </div>
  );
};
