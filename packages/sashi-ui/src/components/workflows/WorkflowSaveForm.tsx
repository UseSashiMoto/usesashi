import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowResponse } from "@/models/payload";
import React, { useState } from "react";
import { Textarea } from "../ui/textarea";

interface WorkflowSaveFormProps {
  workflow: WorkflowResponse;
  onSave: (encoded: string) => void;
}

export const WorkflowSaveForm = ({ workflow, onSave }: WorkflowSaveFormProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = () => {
    const payload = {
      id: `workflow-${Date.now()}`,
      name,
      description,
      workflow,
      createdAt: new Date().toISOString(),
    };

    const encoded = btoa(JSON.stringify(payload));
    onSave(encoded);
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Workflow name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Textarea
        placeholder="Describe what this workflow does..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button onClick={handleSave} disabled={!name.trim()}>
        Save Workflow
      </Button>
    </div>
  );
};