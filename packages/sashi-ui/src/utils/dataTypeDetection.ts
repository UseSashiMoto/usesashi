import { WorkflowResult } from '../models/payload';

type DataType = 'numeric' | 'categorical' | 'temporal' | 'boolean' | 'unknown' | 'object' | 'array';
type VisualizationType = 'line' | 'bar' | 'pie' | 'area' | 'table' | 'scatter' | 'heatmap' | 'tree' | 'network';

interface DataField {
    name: string;
    type: DataType;
    uniqueValues?: number;
    hasNull?: boolean;
    isNested?: boolean;
    nestedFields?: DataField[];
    min?: number;
    max?: number;
    avg?: number;
}

interface DataAnalysis {
    fields: DataField[];
    rowCount: number;
    suggestedVisualizations: VisualizationType[];
    isTimeSeries: boolean;
    isHierarchical: boolean;
    isNetwork: boolean;
}

function calculateNumericStats(values: number[]): { min: number; max: number; avg: number } {
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    const validNumbers = values.filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (validNumbers.length === 0) return { min: 0, max: 0, avg: 0 };
    const sum = validNumbers.reduce((a, b) => a + b, 0);
    return {
        min: Math.min(...validNumbers),
        max: Math.max(...validNumbers),
        avg: sum / validNumbers.length
    };
}

function detectDataType(value: any): DataType {
    if (value === null || value === undefined) return 'unknown';

    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') return 'numeric';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
        // Check if it's a date
        if (!isNaN(Date.parse(value))) return 'temporal';
        // Check if it's a categorical value (limited unique values)
        return 'categorical';
    }
    if (typeof value === 'object') {
        // Check if it's a date object
        if (value instanceof Date) return 'temporal';
        // Check if it has common network graph properties
        if (value.from || value.to || value.source || value.target) return 'object';
        return 'object';
    }

    return 'unknown';
}

function analyzeNestedObject(obj: any, prefix: string = ''): DataField[] {
    const fields: DataField[] = [];

    Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const type = detectDataType(value);

        if (type === 'object' && value !== null) {
            fields.push({
                name: fullKey,
                type: 'object',
                isNested: true,
                nestedFields: analyzeNestedObject(value, fullKey)
            });
        } else if (type === 'array' && Array.isArray(value) && value.length > 0) {
            // Analyze first item in array to determine structure
            const firstItem = value[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
                fields.push({
                    name: fullKey,
                    type: 'array',
                    isNested: true,
                    nestedFields: analyzeNestedObject(firstItem, fullKey)
                });
            } else {
                const uniqueValues = new Set(value).size;
                const field: DataField = {
                    name: fullKey,
                    type: detectDataType(firstItem),
                    uniqueValues
                };

                // Add numeric statistics if applicable
                if (field.type === 'numeric') {
                    const numericValues = value.filter((v: any) => typeof v === 'number') as number[];
                    Object.assign(field, calculateNumericStats(numericValues));
                }

                fields.push(field);
            }
        } else {
            const field: DataField = {
                name: fullKey,
                type,
                uniqueValues: type === 'categorical' ? new Set([value]).size : undefined
            };

            // Add numeric statistics if applicable
            if (type === 'numeric' && typeof value === 'number') {
                Object.assign(field, calculateNumericStats([value]));
            }

            fields.push(field);
        }
    });

    return fields;
}

function analyzeData(data: any[]): DataAnalysis {
    if (!Array.isArray(data) || data.length === 0) {
        return {
            fields: [],
            rowCount: 0,
            suggestedVisualizations: ['table'],
            isTimeSeries: false,
            isHierarchical: false,
            isNetwork: false
        };
    }

    const fields: DataField[] = [];
    const firstRow = data[0];

    // Analyze each field
    Object.keys(firstRow).forEach(key => {
        const values = data.map(row => row[key]);
        const type = detectDataType(values[0]);

        if (type === 'object' || type === 'array') {
            const nestedFields = analyzeNestedObject(firstRow[key]);
            fields.push({
                name: key,
                type,
                isNested: true,
                nestedFields
            });
        } else {
            const uniqueValues = new Set(values).size;
            const field: DataField = {
                name: key,
                type,
                uniqueValues,
                hasNull: values.some(v => v === null || v === undefined)
            };

            // Add numeric statistics if applicable
            if (type === 'numeric') {
                const numericValues = values.filter(v => typeof v === 'number') as number[];
                Object.assign(field, calculateNumericStats(numericValues));
            }

            fields.push(field);
        }
    });

    // Determine data characteristics
    const numericFields = fields.filter(f => f.type === 'numeric');
    const categoricalFields = fields.filter(f => f.type === 'categorical');
    const temporalFields = fields.filter(f => f.type === 'temporal');
    const hasNestedObjects = fields.some(f => f.isNested);

    // Check for hierarchical data
    const isHierarchical = hasNestedObjects && fields.some(f =>
        f.nestedFields?.some(nf => nf.type === 'object' || nf.type === 'array')
    );

    // Check for network data (objects with relationships)
    const isNetwork = hasNestedObjects && fields.some(f =>
        f.nestedFields?.some(nf =>
            nf.name.includes('from') ||
            nf.name.includes('to') ||
            nf.name.includes('source') ||
            nf.name.includes('target') ||
            nf.name.includes('node') ||
            nf.name.includes('edge')
        )
    );

    // Check for time series data
    const isTimeSeries = temporalFields.length > 0 && numericFields.length > 0;

    // Suggest visualizations based on data characteristics
    const suggestedVisualizations: VisualizationType[] = ['table']; // Table is always an option

    if (isTimeSeries) {
        suggestedVisualizations.push('line', 'area');
    }

    if (categoricalFields.length > 0 && numericFields.length > 0) {
        suggestedVisualizations.push('bar');
    }

    if (categoricalFields.some(f => f.uniqueValues && f.uniqueValues <= 10)) {
        suggestedVisualizations.push('pie');
    }

    if (numericFields.length >= 2) {
        suggestedVisualizations.push('scatter');
    }

    if (isHierarchical) {
        suggestedVisualizations.push('tree');
    }

    if (isNetwork) {
        suggestedVisualizations.push('network');
    }

    if (numericFields.length >= 2 && categoricalFields.length > 0) {
        suggestedVisualizations.push('heatmap');
    }

    return {
        fields,
        rowCount: data.length,
        suggestedVisualizations: Array.from(new Set(suggestedVisualizations)),
        isTimeSeries,
        isHierarchical,
        isNetwork
    };
}

export function analyzeWorkflowResult(result: WorkflowResult): DataAnalysis {
    // Extract data from the result
    const data = Array.isArray(result.result)
        ? result.result
        : typeof result.result === 'object'
            ? [result.result]
            : [];

    return analyzeData(data);
}

export function getSuggestedVisualizationConfig(
    result: WorkflowResult,
    visualizationType: VisualizationType
): { xAxis?: string; yAxis?: string; columns?: string[]; colorField?: string; sizeField?: string } {
    const analysis = analyzeWorkflowResult(result);
    const data = Array.isArray(result.result)
        ? result.result
        : typeof result.result === 'object'
            ? [result.result]
            : [];

    if (data.length === 0) return {};

    const numericFields = analysis.fields.filter(f => f.type === 'numeric');
    const categoricalFields = analysis.fields.filter(f => f.type === 'categorical');
    const temporalFields = analysis.fields.filter(f => f.type === 'temporal');

    switch (visualizationType) {
        case 'line':
        case 'area':
            return {
                xAxis: temporalFields[0]?.name || categoricalFields[0]?.name,
                yAxis: numericFields[0]?.name,
                colorField: categoricalFields[0]?.name
            };
        case 'bar':
            return {
                xAxis: categoricalFields[0]?.name,
                yAxis: numericFields[0]?.name,
                colorField: categoricalFields[1]?.name
            };
        case 'pie':
            return {
                xAxis: categoricalFields[0]?.name,
                yAxis: numericFields[0]?.name
            };
        case 'scatter':
            return {
                xAxis: numericFields[0]?.name,
                yAxis: numericFields[1]?.name,
                colorField: categoricalFields[0]?.name,
                sizeField: numericFields[2]?.name
            };
        case 'heatmap':
            return {
                xAxis: categoricalFields[0]?.name,
                yAxis: categoricalFields[1]?.name,
                colorField: numericFields[0]?.name
            };
        case 'table':
            return {
                columns: analysis.fields.map(f => f.name)
            };
        default:
            return {};
    }
} 