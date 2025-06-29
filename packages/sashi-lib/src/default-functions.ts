import {
    AIArray,
    AIFunction,
    AIObject,
    registerFunctionIntoAI
} from './ai-function-loader';

// ============================================================================
// MATH FUNCTIONS
// ============================================================================

const MathResult = new AIObject("MathResult", "result of a mathematical operation", true)
    .field({
        name: "result",
        description: "the calculated result",
        type: "number",
        required: true
    })
    .field({
        name: "operation",
        description: "the operation that was performed",
        type: "string",
        required: true
    });

// Add function
const AddFunction = new AIFunction("add", "add two or more numbers together", undefined, false, true)
    .args({
        name: "numbers",
        description: "array of numbers to add together",
        type: "array",
        required: true
    })
    .returns(MathResult)
    .implement(async (numbers: number[]) => {
        const result = numbers.reduce((sum, num) => sum + num, 0);
        return {
            result,
            operation: `add(${numbers.join(', ')})`
        };
    });

// Subtract function
const SubtractFunction = new AIFunction("subtract", "subtract numbers from left to right", undefined, false, true)
    .args({
        name: "numbers",
        description: "array of numbers to subtract (first number minus the rest)",
        type: "array",
        required: true
    })
    .returns(MathResult)
    .implement(async (numbers: number[]) => {
        if (numbers.length < 2) {
            throw new Error("At least 2 numbers are required for subtraction");
        }
        const result = numbers.reduce((diff, num, index) =>
            index === 0 ? num : diff - num, 0);
        return {
            result,
            operation: `subtract(${numbers.join(', ')})`
        };
    });

// Multiply function
const MultiplyFunction = new AIFunction("multiply", "multiply two or more numbers together", undefined, false, true)
    .args({
        name: "numbers",
        description: "array of numbers to multiply together",
        type: "array",
        required: true
    })
    .returns(MathResult)
    .implement(async (numbers: number[]) => {
        const result = numbers.reduce((product, num) => product * num, 1);
        return {
            result,
            operation: `multiply(${numbers.join(', ')})`
        };
    });

// Divide function
const DivideFunction = new AIFunction("divide", "divide numbers from left to right", undefined, false, true)
    .args({
        name: "numbers",
        description: "array of numbers to divide (first number divided by the rest)",
        type: "array",
        required: true
    })
    .returns(MathResult)
    .implement(async (numbers: number[]) => {
        if (numbers.length < 2) {
            throw new Error("At least 2 numbers are required for division");
        }
        const result = numbers.reduce((quotient, num, index) => {
            if (index === 0) return num;
            if (num === 0) throw new Error("Cannot divide by zero");
            return quotient / num;
        }, 0);
        return {
            result,
            operation: `divide(${numbers.join(', ')})`
        };
    });

// Round function
const RoundFunction = new AIFunction("round", "round a number to the nearest integer or specified decimal places", undefined, false, true)
    .args({
        name: "number",
        description: "the number to round",
        type: "number",
        required: true
    })
    .args({
        name: "decimals",
        description: "number of decimal places (default: 0)",
        type: "number",
        required: false
    })
    .returns(MathResult)
    .implement(async (number: number, decimals: number = 0) => {
        const result = Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
        return {
            result,
            operation: `round(${number}, ${decimals})`
        };
    });

// ============================================================================
// DATA UTILITY FUNCTIONS
// ============================================================================

const DataResult = new AIObject("DataResult", "result of a data operation", true)
    .field({
        name: "result",
        description: "the operation result",
        type: "string",
        required: true
    })
    .field({
        name: "operation",
        description: "the operation that was performed",
        type: "string",
        required: true
    });

// Extract function
const ExtractFunction = new AIFunction("extract", "extract a substring from text using start and end positions", undefined, false, true)
    .args({
        name: "text",
        description: "the text to extract from",
        type: "string",
        required: true
    })
    .args({
        name: "start",
        description: "starting position (0-based)",
        type: "number",
        required: true
    })
    .args({
        name: "end",
        description: "ending position (optional, defaults to end of string)",
        type: "number",
        required: false
    })
    .returns(DataResult)
    .implement(async (text: string, start: number, end?: number) => {
        const result = text.substring(start, end);
        return {
            result,
            operation: `extract("${text}", ${start}, ${end || 'end'})`
        };
    });

// Replace function
const ReplaceFunction = new AIFunction("replace", "replace text in a string", undefined, false, true)
    .args({
        name: "text",
        description: "the original text",
        type: "string",
        required: true
    })
    .args({
        name: "search",
        description: "text to search for",
        type: "string",
        required: true
    })
    .args({
        name: "replace",
        description: "text to replace with",
        type: "string",
        required: true
    })
    .returns(DataResult)
    .implement(async (text: string, search: string, replace: string) => {
        const result = text.replace(new RegExp(search, 'g'), replace);
        return {
            result,
            operation: `replace("${text}", "${search}", "${replace}")`
        };
    });

// Split function
const SplitFunction = new AIFunction("split", "split a string into an array", undefined, false, true)
    .args({
        name: "text",
        description: "the text to split",
        type: "string",
        required: true
    })
    .args({
        name: "separator",
        description: "the separator to split on",
        type: "string",
        required: true
    })
    .returns(new AIArray("SplitResult", "array of split strings", {
        name: "item",
        description: "a split string",
        type: "string"
    }))
    .implement(async (text: string, separator: string) => {
        return text.split(separator);
    });

// Join function
const JoinFunction = new AIFunction("join", "join an array of strings into a single string", undefined, false, true)
    .args({
        name: "array",
        description: "array of strings to join",
        type: "array",
        required: true
    })
    .args({
        name: "separator",
        description: "separator to use between items",
        type: "string",
        required: false
    })
    .returns(DataResult)
    .implement(async (array: string[], separator: string = '') => {
        const result = array.join(separator);
        return {
            result,
            operation: `join(${array.length} items, "${separator}")`
        };
    });

// Filter function
const FilterFunction = new AIFunction("filter", "filter an array based on a condition", undefined, false, true)
    .args({
        name: "array",
        description: "array to filter",
        type: "array",
        required: true
    })
    .args({
        name: "condition",
        description: "condition to filter by (e.g., '> 5', 'contains \"text\"', 'is not null')",
        type: "string",
        required: true
    })
    .implement(async (array: any[], condition: string) => {
        // Simple condition parsing - this could be enhanced
        const result = array.filter(item => {
            if (condition.includes('>')) {
                const parts = condition.split('>');
                const value = parseFloat(parts[1]?.trim() || '0');
                return Number(item) > value;
            }
            if (condition.includes('<')) {
                const parts = condition.split('<');
                const value = parseFloat(parts[1]?.trim() || '0');
                return Number(item) < value;
            }
            if (condition.includes('contains')) {
                const parts = condition.split('"');
                const searchText = parts[1] || '';
                return String(item).includes(searchText);
            }
            if (condition.includes('is not null')) {
                return item !== null && item !== undefined;
            }
            return true;
        });
        return result;
    });

// ============================================================================
// DATE/TIME FUNCTIONS
// ============================================================================

const DateResult = new AIObject("DateResult", "result of a date operation", true)
    .field({
        name: "result",
        description: "the date result",
        type: "string",
        required: true
    })
    .field({
        name: "operation",
        description: "the operation that was performed",
        type: "string",
        required: true
    });

// Format date function
const FormatDateFunction = new AIFunction("format_date", "format a date string", undefined, false, true)
    .args({
        name: "date",
        description: "date string or timestamp",
        type: "string",
        required: true
    })
    .args({
        name: "format",
        description: "format string (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY', 'ISO')",
        type: "string",
        required: false
    })
    .returns(DateResult)
    .implement(async (date: string, format: string = 'ISO') => {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            throw new Error("Invalid date format");
        }

        let result: string;
        switch (format.toLowerCase()) {
            case 'yyyy-mm-dd':
                result = dateObj.toISOString().split('T')[0] || '';
                break;
            case 'mm/dd/yyyy':
                result = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
                break;
            case 'iso':
            default:
                result = dateObj.toISOString();
                break;
        }

        return {
            result,
            operation: `format_date("${date}", "${format}")`
        };
    });

// Add days function
const AddDaysFunction = new AIFunction("add_days", "add or subtract days from a date", undefined, false, true)
    .args({
        name: "date",
        description: "date string or timestamp",
        type: "string",
        required: true
    })
    .args({
        name: "days",
        description: "number of days to add (negative to subtract)",
        type: "number",
        required: true
    })
    .returns(DateResult)
    .implement(async (date: string, days: number) => {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            throw new Error("Invalid date format");
        }

        dateObj.setDate(dateObj.getDate() + days);
        const result = dateObj.toISOString();

        return {
            result,
            operation: `add_days("${date}", ${days})`
        };
    });

// ============================================================================
// SYSTEM UTILITY FUNCTIONS
// ============================================================================

const SystemResult = new AIObject("SystemResult", "result of a system operation", true)
    .field({
        name: "result",
        description: "the operation result",
        type: "string",
        required: true
    })
    .field({
        name: "operation",
        description: "the operation that was performed",
        type: "string",
        required: true
    })
    .field({
        name: "timestamp",
        description: "when the operation was performed",
        type: "string",
        required: true
    });

// Get current time function
const GetCurrentTimeFunction = new AIFunction("get_current_time", "get the current date and time", undefined, false, true)
    .returns(SystemResult)
    .implement(async () => {
        const now = new Date();
        return {
            result: now.toISOString(),
            operation: "get_current_time",
            timestamp: now.toISOString()
        };
    });

// Generate UUID function
const GenerateUUIDFunction = new AIFunction("generate_uuid", "generate a random UUID", undefined, false, true)
    .returns(SystemResult)
    .implement(async () => {
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        return {
            result: uuid,
            operation: "generate_uuid",
            timestamp: new Date().toISOString()
        };
    });

// ============================================================================
// TEXT PROCESSING FUNCTIONS
// ============================================================================

// Convert case functions
const ToUpperCaseFunction = new AIFunction("to_uppercase", "convert text to uppercase", undefined, false, true)
    .args({
        name: "text",
        description: "text to convert",
        type: "string",
        required: true
    })
    .returns(DataResult)
    .implement(async (text: string) => {
        const result = text.toUpperCase();
        return {
            result,
            operation: `to_uppercase("${text}")`
        };
    });

const ToLowerCaseFunction = new AIFunction("to_lowercase", "convert text to lowercase", undefined, false, true)
    .args({
        name: "text",
        description: "text to convert",
        type: "string",
        required: true
    })
    .returns(DataResult)
    .implement(async (text: string) => {
        const result = text.toLowerCase();
        return {
            result,
            operation: `to_lowercase("${text}")`
        };
    });

// Trim function
const TrimFunction = new AIFunction("trim", "remove whitespace from beginning and end of text", undefined, false, true)
    .args({
        name: "text",
        description: "text to trim",
        type: "string",
        required: true
    })
    .returns(DataResult)
    .implement(async (text: string) => {
        const result = text.trim();
        return {
            result,
            operation: `trim("${text}")`
        };
    });

// ============================================================================
// REGISTRATION FUNCTIONS
// ============================================================================

// Individual category registration functions for selective loading
export function registerMathFunctions() {
    registerFunctionIntoAI("add", AddFunction);
    registerFunctionIntoAI("subtract", SubtractFunction);
    registerFunctionIntoAI("multiply", MultiplyFunction);
    registerFunctionIntoAI("divide", DivideFunction);
    registerFunctionIntoAI("round", RoundFunction);
}

export function registerDataUtilityFunctions() {
    registerFunctionIntoAI("extract", ExtractFunction);
    registerFunctionIntoAI("replace", ReplaceFunction);
    registerFunctionIntoAI("split", SplitFunction);
    registerFunctionIntoAI("join", JoinFunction);
    registerFunctionIntoAI("filter", FilterFunction);
}

export function registerDateTimeFunctions() {
    registerFunctionIntoAI("format_date", FormatDateFunction);
    registerFunctionIntoAI("add_days", AddDaysFunction);
}

export function registerSystemUtilityFunctions() {
    registerFunctionIntoAI("get_current_time", GetCurrentTimeFunction);
    registerFunctionIntoAI("generate_uuid", GenerateUUIDFunction);
}

export function registerTextProcessingFunctions() {
    registerFunctionIntoAI("to_uppercase", ToUpperCaseFunction);
    registerFunctionIntoAI("to_lowercase", ToLowerCaseFunction);
    registerFunctionIntoAI("trim", TrimFunction);
}

// Main registration function that loads all functions
export function registerDefaultFunctions() {
    registerMathFunctions();
    registerDataUtilityFunctions();
    registerDateTimeFunctions();
    registerSystemUtilityFunctions();
    registerTextProcessingFunctions();
}

// Lazy loading function that only loads functions when requested
export function loadDefaultFunctionsOnDemand(categories?: string[]) {
    const availableCategories = {
        'math': registerMathFunctions,
        'data': registerDataUtilityFunctions,
        'datetime': registerDateTimeFunctions,
        'system': registerSystemUtilityFunctions,
        'text': registerTextProcessingFunctions
    };

    if (!categories || categories.length === 0) {
        // Load all categories if none specified
        Object.values(availableCategories).forEach(registerFn => registerFn());
        return;
    }

    // Load only specified categories
    categories.forEach(category => {
        const registerFn = availableCategories[category as keyof typeof availableCategories];
        if (registerFn) {
            registerFn();
        }
    });
}

// Export individual functions for testing or selective registration
export const defaultFunctions = {
    // Math
    add: AddFunction,
    subtract: SubtractFunction,
    multiply: MultiplyFunction,
    divide: DivideFunction,
    round: RoundFunction,

    // Data utilities
    extract: ExtractFunction,
    replace: ReplaceFunction,
    split: SplitFunction,
    join: JoinFunction,
    filter: FilterFunction,

    // Date/time
    format_date: FormatDateFunction,
    add_days: AddDaysFunction,

    // System utilities
    get_current_time: GetCurrentTimeFunction,
    generate_uuid: GenerateUUIDFunction,

    // Text processing
    to_uppercase: ToUpperCaseFunction,
    to_lowercase: ToLowerCaseFunction,
    trim: TrimFunction
}; 