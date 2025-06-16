import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

interface AuditLog {
  sessionId: string;
  userId: string;
  workflowId: string;
  input: {
    workflow: any;
    debug: boolean;
  };
  startTime: string;
  endTime: string;
  duration: number;
  status: 'pending' | 'success' | 'error';
  result: any;
  error: any;
  metadata: {
    actionCount: number;
    tools: string[];
  };
}

interface AuditLogDetailsModalProps {
  log: AuditLog | null;
  onClose: () => void;
}

export function AuditLogDetailsModal({ log, onClose }: AuditLogDetailsModalProps) {
  if (!log) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline' | null | undefined> = {
      pending: 'default',
      success: 'default',
      error: 'destructive',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open={!!log} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Workflow Execution Details</DialogTitle>
          <DialogDescription>Execution ID: {log.workflowId}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">{getStatusBadge(log.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <div className="mt-1">{log.duration}ms</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Start Time:</span>
                  <div className="mt-1">{formatDistanceToNow(new Date(log.startTime), { addSuffix: true })}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">End Time:</span>
                  <div className="mt-1">{formatDistanceToNow(new Date(log.endTime), { addSuffix: true })}</div>
                </div>
              </div>
            </div>

            {/* Workflow Actions */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Workflow Actions</h3>
              <div className="space-y-2">
                {log.input.workflow.actions.map((action: any, index: number) => (
                  <div key={action.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Action {index + 1}</div>
                      <Badge variant="secondary">{action.tool}</Badge>
                    </div>
                    {action.description && <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>}
                    {action.parameters && Object.keys(action.parameters).length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium">Parameters:</div>
                        <pre className="mt-1 rounded bg-muted p-2 text-xs">
                          {JSON.stringify(action.parameters, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Result or Error */}
            {log.status === 'success' && log.result && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Result</h3>
                <pre className="rounded bg-muted p-3 text-sm overflow-auto">{JSON.stringify(log.result, null, 2)}</pre>
              </div>
            )}

            {log.status === 'error' && log.error && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Error</h3>
                <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="font-medium">{log.error.message}</div>
                  {log.error.details && <div className="mt-1">{log.error.details}</div>}
                  {log.error.stepErrors && log.error.stepErrors.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Step Errors:</div>
                      <ul className="mt-1 list-disc list-inside">
                        {log.error.stepErrors.map((stepError: any, index: number) => (
                          <li key={index}>
                            {stepError.actionId}: {stepError.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Metadata</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Action Count:</span>
                  <div className="mt-1">{log.metadata.actionCount}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tools Used:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {log.metadata.tools.map((tool) => (
                      <Badge key={tool} variant="secondary" className="text-xs">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
