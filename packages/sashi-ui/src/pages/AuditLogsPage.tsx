import { AuditLogDetailsModal } from '@/components/AuditLogDetailsModal';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useAppStore from '@/store/chat-store';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import React, { useEffect, useState } from 'react';

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

interface AuditLogResponse {
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    status: 'all',
    search: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const apiUrl = useAppStore((state) => state.apiUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get<AuditLogResponse>(`${apiUrl}/audit/workflow`, {
          headers: {
            'x-sashi-session-token': sessionToken,
          },
        });
        setLogs(response.data.logs);
        setError(null);
      } catch (err) {
        setError('Failed to fetch audit logs');
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [apiUrl, sessionToken]);

  const filteredLogs = logs.filter((log) => {
    const matchesStatus = filter.status === 'all' || log.status === filter.status;
    const matchesSearch =
      filter.search === '' ||
      log.workflowId.toLowerCase().includes(filter.search.toLowerCase()) ||
      log.metadata.tools.some((tool) => tool.toLowerCase().includes(filter.search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline' | null | undefined> = {
      pending: 'default',
      success: 'default',
      error: 'destructive',
    } as const;

    return (
      <Badge  variant={variants[status as keyof typeof variants] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Input
                placeholder="Search by workflow ID or tool..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="max-w-sm"
              />
              <Select value={filter.status} onValueChange={(value) => setFilter({ ...filter, status: value })}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setFilter({ status: 'all', search: '' })}>
                Clear Filters
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Workflow ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Tools</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.workflowId}>
                      <TableCell>{formatDistanceToNow(new Date(log.startTime), { addSuffix: true })}</TableCell>
                      <TableCell className="font-mono text-sm">{log.workflowId}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>{log.duration}ms</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {log.metadata.tools.map((tool) => (
                            <Badge key={tool} variant="secondary" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AuditLogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </Layout>
  );
}
