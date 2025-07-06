import {
    AIFunction,
    registerFunctionIntoAI
} from './ai-function-loader';

// ============================================================================
// GENERIC DATA PROCESSING FUNCTIONS
// ============================================================================

// Parse CSV to structured data
const ParseCSVFunction = new AIFunction(
    "parseCSV",
    "Parse CSV text into structured array of objects",
    undefined, false, true
)
    .args({
        name: "csvText",
        description: "CSV text to parse",
        type: "string",
        required: true
    })
    .args({
        name: "delimiter",
        description: "Column delimiter (default: comma)",
        type: "string",
        required: false
    })
    .implement(async (csvText: string, delimiter: string = ',') => {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0]?.split(delimiter).map(h => h.trim()) || [];
        const data = lines.slice(1).map((line, index) => {
            const values = line.split(delimiter);
            const row = headers.reduce((obj, header, i) => {
                obj[header] = values[i]?.trim() || '';
                return obj;
            }, {} as any);
            row._index = index;
            return row;
        });

        return data;
    });

// Convert array to CSV
const ToCSVFunction = new AIFunction(
    "toCSV",
    "Convert array of objects to CSV text",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Array of objects to convert",
        type: "array",
        required: true
    })
    .args({
        name: "columns",
        description: "Specific columns to include (optional)",
        type: "array",
        required: false
    })
    .implement(async (data: any[], columns?: string[]) => {
        if (!data || data.length === 0) return '';

        const keys = columns || Object.keys(data[0] || {});
        const header = keys.join(',');
        const rows = data.map(row =>
            keys.map(key => {
                const value = row[key] || '';
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            }).join(',')
        );

        return [header, ...rows].join('\n');
    });

// ============================================================================
// DATA TRANSFORMATION FUNCTIONS
// ============================================================================

// Map/transform data
const MapDataFunction = new AIFunction(
    "mapData",
    "Transform each item in an array using field mappings",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Array to transform",
        type: "array",
        required: true
    })
    .args({
        name: "mapping",
        description: "Field mapping object (oldField: newField)",
        type: "object",
        required: true
    })
    .implement(async (data: any[], mapping: Record<string, string>) => {
        return data.map(item => {
            const mapped: Record<string, any> = {};
            for (const [oldKey, newKey] of Object.entries(mapping)) {
                if (item.hasOwnProperty(oldKey)) {
                    mapped[newKey] = item[oldKey];
                }
            }
            return mapped;
        });
    });

// Group data by field
const GroupByFunction = new AIFunction(
    "groupBy",
    "Group array items by a specific field value",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Array to group",
        type: "array",
        required: true
    })
    .args({
        name: "field",
        description: "Field name to group by",
        type: "string",
        required: true
    })
    .implement(async (data: any[], field: string) => {
        const groups: Record<string, any[]> = {};
        data.forEach(item => {
            const key = item[field] || 'undefined';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    });

// Aggregate data
const AggregateFunction = new AIFunction(
    "aggregate",
    "Calculate aggregate statistics (count, sum, avg, min, max) for numeric fields",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Array to aggregate",
        type: "array",
        required: true
    })
    .args({
        name: "field",
        description: "Numeric field to aggregate",
        type: "string",
        required: false
    })
    .implement(async (data: any[], field?: string) => {
        if (!field) {
            return {
                count: data.length,
                operation: 'count'
            };
        }

        const values = data
            .map(item => Number(item[field]))
            .filter(val => !isNaN(val));

        if (values.length === 0) {
            return { count: 0, field };
        }

        return {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            field
        };
    });

// ============================================================================
// DATA ENCODING/VALIDATION FUNCTIONS  
// ============================================================================

// Base64 encode/decode
const Base64EncodeFunction = new AIFunction(
    "base64Encode",
    "Encode text or data as base64",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Data to encode (string or object)",
        type: "string",
        required: true
    })
    .implement(async (data: any) => {
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        return Buffer.from(text).toString('base64');
    });

const Base64DecodeFunction = new AIFunction(
    "base64Decode",
    "Decode base64 text back to original",
    undefined, false, true
)
    .args({
        name: "encoded",
        description: "Base64 encoded text",
        type: "string",
        required: true
    })
    .implement(async (encoded: string) => {
        return Buffer.from(encoded, 'base64').toString('utf-8');
    });

// Validate data format
const ValidateFormatFunction = new AIFunction(
    "validateFormat",
    "Validate if data matches expected format (email, phone, url, etc.)",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Data to validate",
        type: "string",
        required: true
    })
    .args({
        name: "format",
        description: "Format type: email, phone, url, number, date",
        type: "string",
        required: true
    })
    .implement(async (data: string, format: string) => {
        const patterns: Record<string, RegExp> = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^\+?[\d\s\-\(\)]{10,}$/,
            url: /^https?:\/\/.+/,
            number: /^\d+(\.\d+)?$/,
            date: /^\d{4}-\d{2}-\d{2}/
        };

        const pattern = patterns[format.toLowerCase()];
        const isValid = pattern ? pattern.test(data) : false;

        return {
            data,
            format,
            isValid,
            checked: !!pattern
        };
    });

// ============================================================================
// VISUALIZATION DATA PREP FUNCTIONS
// ============================================================================

// Prepare data for charts/graphs
const PrepareChartDataFunction = new AIFunction(
    "prepareChartData",
    "Transform data into chart-ready format with labels and values",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Array of data objects",
        type: "array",
        required: true
    })
    .args({
        name: "labelField",
        description: "Field to use as chart labels",
        type: "string",
        required: true
    })
    .args({
        name: "valueField",
        description: "Field to use as chart values",
        type: "string",
        required: true
    })
    .implement(async (data: any[], labelField: string, valueField: string) => {
        return data.map(item => ({
            label: item[labelField],
            value: Number(item[valueField]) || 0,
            original: item
        })).filter(item => item.label !== undefined);
    });

// Create data summary for display
const SummarizeDataFunction = new AIFunction(
    "summarizeData",
    "Create a summary overview of dataset with key statistics",
    undefined, false, true
)
    .args({
        name: "data",
        description: "Array to summarize",
        type: "array",
        required: true
    })
    .implement(async (data: any[]) => {
        if (!data || data.length === 0) {
            return {
                totalRecords: 0,
                fields: [],
                summary: 'No data provided'
            };
        }

        const fields = Object.keys(data[0] || {});
        const fieldTypes: Record<string, any> = {};

        fields.forEach(field => {
            const values = data.map(item => item[field]).filter(v => v !== undefined && v !== null);
            const hasNumbers = values.some(v => !isNaN(Number(v)));
            const hasStrings = values.some(v => typeof v === 'string');

            fieldTypes[field] = {
                type: hasNumbers && !hasStrings ? 'numeric' : 'text',
                uniqueValues: new Set(values).size,
                nullCount: data.length - values.length
            };
        });

        return {
            totalRecords: data.length,
            fields,
            fieldTypes,
            summary: `Dataset with ${data.length} records and ${fields.length} fields`
        };
    });

// ============================================================================
// REGISTRATION FUNCTION
// ============================================================================

export function registerGenericWorkflowFunctions() {
    registerFunctionIntoAI("parseCSV", ParseCSVFunction);
    registerFunctionIntoAI("toCSV", ToCSVFunction);
    registerFunctionIntoAI("mapData", MapDataFunction);
    registerFunctionIntoAI("groupBy", GroupByFunction);
    registerFunctionIntoAI("aggregate", AggregateFunction);
    registerFunctionIntoAI("base64Encode", Base64EncodeFunction);
    registerFunctionIntoAI("base64Decode", Base64DecodeFunction);
    registerFunctionIntoAI("validateFormat", ValidateFormatFunction);
    registerFunctionIntoAI("prepareChartData", PrepareChartDataFunction);
    registerFunctionIntoAI("summarizeData", SummarizeDataFunction);
}

export const genericWorkflowFunctions = {
    parseCSV: ParseCSVFunction,
    toCSV: ToCSVFunction,
    mapData: MapDataFunction,
    groupBy: GroupByFunction,
    aggregate: AggregateFunction,
    base64Encode: Base64EncodeFunction,
    base64Decode: Base64DecodeFunction,
    validateFormat: ValidateFormatFunction,
    prepareChartData: PrepareChartDataFunction,
    summarizeData: SummarizeDataFunction
};
