import React from 'react';
import { WorkflowStep } from '../models/workflow';

interface WorkflowVisualizationProps {
  steps: WorkflowStep[];
}

export function WorkflowVisualization({ steps }: WorkflowVisualizationProps) {
  return (
    <div className="relative">
      {/* Vertical line connecting all steps */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-200 dark:bg-blue-800" />

      <div className="space-y-8">
        {steps.map((step, index) => (
          <div key={index} className="relative">
            {/* Step circle */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 dark:bg-blue-400" />

            {/* Step content */}
            <div className="ml-8 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step {index + 1}</span>
                <span className="text-sm font-semibold">{step.name}</span>
              </div>

              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{step.description}</p>

              {/* Function name badge */}
              <div className="mt-2 inline-block px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-zinc-700 rounded">
                {step.functionName}
              </div>

              {/* Inputs and Outputs */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                {step.inputs && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Inputs</h4>
                    <ul className="mt-1 space-y-1">
                      {Object.entries(step.inputs).map(([key, value]) => (
                        <li key={key} className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.outputs && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Outputs</h4>
                    <ul className="mt-1 space-y-1">
                      {Object.entries(step.outputs).map(([key, value]) => (
                        <li key={key} className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Arrow between steps */}
            {index < steps.length - 1 && (
              <div className="absolute left-4 top-full w-0.5 h-8 bg-blue-200 dark:bg-blue-800" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
