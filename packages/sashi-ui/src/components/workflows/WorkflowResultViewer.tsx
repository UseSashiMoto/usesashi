import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowUIElement } from "@/models/payload";
import React from "react";



interface WorkflowResultViewerProps {
  results: WorkflowUIElement[];
}

export const WorkflowResultViewer = ({ results }: WorkflowResultViewerProps) => {
  console.log("workflow results viewer", results);
  return (
    <div className="space-y-4">
      {results.map((ui) => (
        <Card key={ui.actionId}>
          <CardHeader>
            <CardTitle>{ui.content.title}</CardTitle>
            <CardDescription>{ui.tool} • {new Date(ui.content.timestamp).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">{ui.content.content}</pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};