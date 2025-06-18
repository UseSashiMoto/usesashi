import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableBody, TableCell, TableHead, TableHeader, TableRow, Table as UITable } from '@/components/ui/table';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface TableProps {
  data: any[];
  columns: string[];
  title: string;
}

export const Table: React.FC<TableProps> = ({ data, columns, title }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleExport = () => {
    const csvContent = [
      // Headers
      columns.join(','),
      // Data rows
      ...filteredData.map((row) =>
        columns
          .map((col) => {
            const value = row[col];
            // Handle values that might contain commas
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-data.csv`;
    link.click();
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply filtering
    if (filterText) {
      const searchText = filterText.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col];
          return value != null && value.toString().toLowerCase().includes(searchText);
        })
      );
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === bValue) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, columns, filterText, sortConfig]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="outline" size="icon" onClick={handleExport}>
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <UITable>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>
                    <Button variant="ghost" onClick={() => handleSort(column)} className="flex items-center gap-1">
                      {column}
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell key={column}>{row[column] != null ? row[column].toString() : ''}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </UITable>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredData.length} of {data.length} rows
        </div>
      </CardContent>
    </Card>
  );
};
