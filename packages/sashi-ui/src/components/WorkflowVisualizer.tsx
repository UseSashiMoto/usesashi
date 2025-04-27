'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownIcon } from 'lucide-react';
import React, { useState } from 'react';
import type { WorkflowResponse } from '../models/payload';
import { Badge } from './ui/badge';

interface WorkflowVisualizerProps {
  workflow: WorkflowResponse;
  onExecute: () => void;
  onGenerateUI: () => void;
  onCancel: () => void;
}

export function WorkflowVisualizer({ workflow, onExecute, onGenerateUI, onCancel }: WorkflowVisualizerProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Ensure workflow.actions exists before using it
  const actions = workflow?.actions || [];

  return (
    <div className="workflow-visualizer px-4 w-full max-w-full md:px-0">
      <div className="flex flex-col space-y-3">
        {actions.map((action, index) => (
          <div key={action.id || `step-${index}`} className="workflow-step">
            <Card className="overflow-hidden border-l-4 border-l-brand-500">
              <div
                className="p-3 cursor-pointer"
                onClick={() => setExpandedStep(expandedStep === action.id ? null : action.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0 flex-1 mr-2">
                    <h3 className="font-medium truncate">{action.description}</h3>
                    <Badge variant="outline" className="ml-2 text-xs shrink-0">
                      Step {index + 1}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedStep(expandedStep === action.id ? null : action.id);
                    }}
                  >
                    <ArrowDownIcon
                      className={`h-4 w-4 transition-transform ${expandedStep === action.id ? 'rotate-180' : ''}`}
                    />
                  </Button>
                </div>
              </div>

              {expandedStep === action.id && (
                <CardContent className="p-3 pt-0 border-t bg-white dark:bg-zinc-900">
                  <div className="text-sm space-y-2 max-w-full overflow-hidden">
                    <h4 className="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase">Parameters</h4>
                    <div className="grid gap-2">
                      {Object.entries(action.parameters || {}).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                          <span className="font-medium text-xs truncate">{key}</span>
                          <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-xs overflow-hidden">
                            {typeof value === 'string' ? (
                              <div className="break-words whitespace-pre-wrap">{value}</div>
                            ) : typeof value === 'object' && value !== null ? (
                              <pre className="whitespace-pre-wrap break-words overflow-hidden">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            ) : (
                              <div className="break-words whitespace-pre-wrap">{String(value)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={onGenerateUI}>
            Generate UI
          </Button>
          <Button onClick={onExecute} className="bg-brand-600 hover:bg-brand-700">
            Execute
          </Button>
        </div>
      </div>
    </div>
  );
}
