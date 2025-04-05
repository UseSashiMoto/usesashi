import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowStep } from '@/models/workflow';
import React from 'react';
import { WorkflowVisualization } from './WorkflowVisualization';

interface WorkflowPreviewProps {
  steps: WorkflowStep[];
  onExecute: () => void;
  onCreateUI: () => void;
}

export function WorkflowPreview({ steps, onExecute, onCreateUI }: WorkflowPreviewProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Workflow Preview</CardTitle>
        <CardDescription>Review the workflow before execution</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Workflow Visualization */}
          <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-lg">
            <h3 className="text-sm font-medium mb-4">Workflow Sequence</h3>
            <WorkflowVisualization steps={steps} />
          </div>

          {/* Detailed Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold">
                  Step {index + 1}: {step.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                {step.inputs && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium">Inputs:</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400">
                      {Object.entries(step.inputs).map(([key, value]) => (
                        <li key={key}>
                          {key}: {value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {step.outputs && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium">Outputs:</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400">
                      {Object.entries(step.outputs).map(([key, value]) => (
                        <li key={key}>
                          {key}: {value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCreateUI}>
          Create Permanent UI
        </Button>
        <Button onClick={onExecute}>Execute Workflow</Button>
      </CardFooter>
    </Card>
  );
}
