import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

interface ChartProps {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
  data: any[];
  xAxis: string;
  yAxis: string;
  title: string;
  colorField?: string;
  sizeField?: string;
}

interface DataPoint {
  [key: string]: any;
}

interface HeatmapDataPoint {
  x: any;
  y: any;
  value: number;
  count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1'];

export const Chart: React.FC<ChartProps> = ({ type, data, xAxis, yAxis, title, colorField, sizeField }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const chartRef = useRef<any>(null);

  // Validate data
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-4">{title}</h3>
          <div className="h-[300px] flex items-center justify-center text-red-500">
            No data available for visualization
          </div>
        </CardContent>
      </Card>
    );
  }

  // Validate required fields
  const hasRequiredFields = data.every((item) => item[xAxis] !== undefined && item[yAxis] !== undefined);

  if (!hasRequiredFields) {
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-4">{title}</h3>
          <div className="h-[300px] flex items-center justify-center text-red-500">
            Data is missing required fields: {xAxis} or {yAxis}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleReset = () => {
    setZoomLevel(1);
  };

  const handleExport = () => {
    const csvContent = [
      // Headers
      [xAxis, yAxis, ...(colorField ? [colorField] : []), ...(sizeField ? [sizeField] : [])].join(','),
      // Data rows
      ...data.map((row) =>
        [row[xAxis], row[yAxis], ...(colorField ? [row[colorField]] : []), ...(sizeField ? [row[sizeField]] : [])].join(
          ','
        )
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-data.csv`;
    link.click();
  };

  const renderChart = () => {
    try {
      const commonProps = {
        margin: { top: 20, right: 30, left: 20, bottom: 5 },
        style: { transform: `scale(${zoomLevel})`, transformOrigin: 'center' },
      };

      switch (type) {
        case 'line':
          return (
            <LineChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              {colorField ? (
                Object.entries(
                  data.reduce((acc, item: DataPoint) => {
                    const category = item[colorField];
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {} as Record<string, DataPoint[]>)
                ).map(([category, categoryData], index) => (
                  <Line
                    key={category}
                    type="monotone"
                    data={categoryData}
                    dataKey={yAxis}
                    name={category}
                    stroke={COLORS[index % COLORS.length]}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={yAxis}
                  stroke="hsl(var(--primary))"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          );

        case 'bar':
          return (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              {colorField ? (
                // Multiple bars for different categories
                Object.entries(
                  data.reduce((acc, item: DataPoint) => {
                    const category = item[colorField];
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {} as Record<string, DataPoint[]>)
                ).map(([category, categoryData], index) => (
                  <Bar
                    key={category}
                    data={categoryData as any}
                    dataKey={yAxis}
                    name={category}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))
              ) : (
                <Bar dataKey={yAxis} fill="hsl(var(--primary))" />
              )}
            </BarChart>
          );

        case 'area':
          return (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              {colorField ? (
                // Multiple areas for different categories
                Object.entries(
                  data.reduce((acc, item: DataPoint) => {
                    const category = item[colorField];
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {} as Record<string, DataPoint[]>)
                ).map(([category, categoryData], index) => (
                  <Area
                    key={category}
                    type="monotone"
                    data={categoryData as any}
                    dataKey={yAxis}
                    name={category}
                    stroke={COLORS[index % COLORS.length]}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey={yAxis}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
              )}
            </AreaChart>
          );

        case 'pie':
          return (
            <PieChart>
              <Pie data={data} dataKey={yAxis} nameKey={xAxis} cx="50%" cy="50%" outerRadius={80} label>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          );

        case 'scatter':
          return (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis dataKey={yAxis} />
              <ZAxis dataKey={sizeField} range={[50, 400]} />
              <Tooltip />
              {colorField ? (
                // Multiple scatter plots for different categories
                Object.entries(
                  data.reduce((acc, item: DataPoint) => {
                    const category = item[colorField];
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {} as Record<string, DataPoint[]>)
                ).map(([category, categoryData], index) => (
                  <Scatter
                    key={category}
                    data={categoryData as any}
                    name={category}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))
              ) : (
                <Scatter data={data} fill="hsl(var(--primary))" />
              )}
            </ScatterChart>
          );

        case 'heatmap':
          // Create a heatmap by grouping data by x and y axes
          const heatmapData = data.reduce((acc, item: DataPoint) => {
            const x = item[xAxis];
            const y = item[yAxis];
            const value = item[colorField || yAxis];
            const key = `${x}-${y}`;
            if (!acc[key]) {
              acc[key] = { x, y, value: 0, count: 0 };
            }
            acc[key].value += value;
            acc[key].count += 1;
            return acc;
          }, {} as Record<string, HeatmapDataPoint>);

          // Calculate averages
          const heatmapValues = Object.values(heatmapData).map((item) => ({
            x: (item as HeatmapDataPoint).x,
            y: (item as HeatmapDataPoint).y,
            value: (item as HeatmapDataPoint).value / (item as HeatmapDataPoint).count,
          }));

          return (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" type="category" />
              <YAxis dataKey="y" type="category" />
              <ZAxis dataKey="value" range={[50, 400]} />
              <Tooltip />
              <Scatter data={heatmapValues} fill="hsl(var(--primary))" fillOpacity={0.6} />
            </ScatterChart>
          );

        default:
          return <div>Unsupported chart type</div>;
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <div className="h-[300px] flex items-center justify-center text-red-500">
          Error rendering chart: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      );
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-[300px]" ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
