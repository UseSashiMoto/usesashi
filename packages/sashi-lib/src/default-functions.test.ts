import { callFunctionFromRegistry, getFunctionAttributes, getFunctionRegistry } from './ai-function-loader';
import { registerDefaultFunctions } from './default-functions';

describe('Default Functions', () => {
    beforeEach(() => {
        // Clear the function registry before each test
        const registry = getFunctionRegistry();
        registry.clear();
        const attributes = getFunctionAttributes();
        attributes.clear();
    });

    describe('Hidden Functions', () => {
        it('should mark default functions as hidden', () => {
            registerDefaultFunctions();
            const attributes = getFunctionAttributes();

            // Check that default functions are marked as hidden
            expect(attributes.get('add')?.isHidden).toBe(true);
            expect(attributes.get('subtract')?.isHidden).toBe(true);
            expect(attributes.get('multiply')?.isHidden).toBe(true);
            expect(attributes.get('divide')?.isHidden).toBe(true);
            expect(attributes.get('round')?.isHidden).toBe(true);
        });

        it('should still allow hidden functions to be executed', async () => {
            registerDefaultFunctions();

            // Hidden functions should still work
            const result = await callFunctionFromRegistry('add', [1, 2, 3]);
            expect(result.result).toBe(6);
            expect(result.operation).toBe('add(1, 2, 3)');
        });
    });

    describe('Registration', () => {
        it('should register all default functions', () => {
            registerDefaultFunctions();
            const registry = getFunctionRegistry();

            // Check that all expected functions are registered
            expect(registry.has('add')).toBe(true);
            expect(registry.has('subtract')).toBe(true);
            expect(registry.has('multiply')).toBe(true);
            expect(registry.has('divide')).toBe(true);
            expect(registry.has('round')).toBe(true);
            expect(registry.has('extract')).toBe(true);
            expect(registry.has('replace')).toBe(true);
            expect(registry.has('split')).toBe(true);
            expect(registry.has('join')).toBe(true);
            expect(registry.has('filter')).toBe(true);
            expect(registry.has('format_date')).toBe(true);
            expect(registry.has('add_days')).toBe(true);
            expect(registry.has('get_current_time')).toBe(true);
            expect(registry.has('generate_uuid')).toBe(true);
            expect(registry.has('to_uppercase')).toBe(true);
            expect(registry.has('to_lowercase')).toBe(true);
            expect(registry.has('trim')).toBe(true);
        });
    });

    describe('Math Functions', () => {
        beforeEach(() => {
            registerDefaultFunctions();
        });

        it('should add numbers correctly', async () => {
            const result = await callFunctionFromRegistry('add', [1, 2, 3, 4]);
            console.log('Add result:', result);
            expect(result.result).toBe(10);
            expect(result.operation).toBe('add(1, 2, 3, 4)');
        });

        it('should subtract numbers correctly', async () => {
            const result = await callFunctionFromRegistry('subtract', [10, 3, 2]);
            console.log('Subtract result:', result);
            expect(result.result).toBe(5);
            expect(result.operation).toBe('subtract(10, 3, 2)');
        });

        it('should multiply numbers correctly', async () => {
            const result = await callFunctionFromRegistry('multiply', [2, 3, 4]);
            console.log('Multiply result:', result);
            expect(result.result).toBe(24);
            expect(result.operation).toBe('multiply(2, 3, 4)');
        });

        it('should divide numbers correctly', async () => {
            const result = await callFunctionFromRegistry('divide', [20, 4, 2]);
            console.log('Divide result:', result);
            expect(result.result).toBe(2.5);
            expect(result.operation).toBe('divide(20, 4, 2)');
        });

        it('should round numbers correctly', async () => {
            const result = await callFunctionFromRegistry('round', 3.14159, 2);
            console.log('Round result:', result);
            expect(result.result).toBe(3.14);
            expect(result.operation).toBe('round(3.14159, 2)');
        });
    });

    describe('Data Utility Functions', () => {
        beforeEach(() => {
            registerDefaultFunctions();
        });

        it('should extract substring correctly', async () => {
            const result = await callFunctionFromRegistry('extract', 'Hello World', 0, 5);
            console.log('Extract result:', result);
            expect(result.result).toBe('Hello');
            expect(result.operation).toBe('extract("Hello World", 0, 5)');
        });

        it('should replace text correctly', async () => {
            const result = await callFunctionFromRegistry('replace', 'Hello World', 'World', 'Universe');
            console.log('Replace result:', result);
            expect(result.result).toBe('Hello Universe');
            expect(result.operation).toBe('replace("Hello World", "World", "Universe")');
        });

        it('should split text correctly', async () => {
            const result = await callFunctionFromRegistry('split', 'apple,banana,orange', ',');
            console.log('Split result:', result);
            expect(result).toEqual(['apple', 'banana', 'orange']);
        });

        it('should join arrays correctly', async () => {
            const result = await callFunctionFromRegistry('join', ['apple', 'banana', 'orange'], ', ');
            console.log('Join result:', result);
            expect(result.result).toBe('apple, banana, orange');
            expect(result.operation).toBe('join(3 items, ", ")');
        });

        it('should filter arrays correctly', async () => {
            const result = await callFunctionFromRegistry('filter', [1, 2, 3, 4, 5], '> 3');
            console.log('Filter result:', result);
            expect(result).toEqual([4, 5]);
        });
    });

    describe('Text Processing Functions', () => {
        beforeEach(() => {
            registerDefaultFunctions();
        });

        it('should convert to uppercase', async () => {
            const result = await callFunctionFromRegistry('to_uppercase', 'hello world');
            console.log('To uppercase result:', result);
            expect(result.result).toBe('HELLO WORLD');
            expect(result.operation).toBe('to_uppercase("hello world")');
        });

        it('should convert to lowercase', async () => {
            const result = await callFunctionFromRegistry('to_lowercase', 'HELLO WORLD');
            console.log('To lowercase result:', result);
            expect(result.result).toBe('hello world');
            expect(result.operation).toBe('to_lowercase("HELLO WORLD")');
        });

        it('should trim whitespace', async () => {
            const result = await callFunctionFromRegistry('trim', '  hello world  ');
            console.log('Trim result:', result);
            expect(result.result).toBe('hello world');
            expect(result.operation).toBe('trim("  hello world  ")');
        });
    });

    describe('System Utility Functions', () => {
        beforeEach(() => {
            registerDefaultFunctions();
        });

        it('should get current time', async () => {
            const result = await callFunctionFromRegistry('get_current_time');
            console.log('Get current time result:', result);
            expect(result.operation).toBe('get_current_time');
            expect(result.timestamp).toBeDefined();
            expect(new Date(result.result)).toBeInstanceOf(Date);
        });

        it('should generate UUID', async () => {
            const result = await callFunctionFromRegistry('generate_uuid');
            console.log('Generate UUID result:', result);
            expect(result.operation).toBe('generate_uuid');
            expect(result.timestamp).toBeDefined();
            expect(result.result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    describe('Date/Time Functions', () => {
        beforeEach(() => {
            registerDefaultFunctions();
        });

        it('should format date correctly', async () => {
            const testDate = '2023-12-25T10:30:00.000Z';
            const result = await callFunctionFromRegistry('format_date', testDate, 'YYYY-MM-DD');
            console.log('Format date result:', result);
            expect(result.result).toBe('2023-12-25');
            expect(result.operation).toBe('format_date("2023-12-25T10:30:00.000Z", "YYYY-MM-DD")');
        });

        it('should add days correctly', async () => {
            const testDate = '2023-12-25T10:30:00.000Z';
            const result = await callFunctionFromRegistry('add_days', testDate, 7);
            console.log('Add days result:', result);
            expect(result.operation).toBe('add_days("2023-12-25T10:30:00.000Z", 7)');
            expect(new Date(result.result)).toBeInstanceOf(Date);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            registerDefaultFunctions();
        });

        it('should handle division by zero', async () => {
            const result = await callFunctionFromRegistry('divide', [10, 0]);
            expect(typeof result).toBe('string');
            expect(result).toContain('An unexpected error occurred');
        });

        it('should handle insufficient numbers for subtraction', async () => {
            const result = await callFunctionFromRegistry('subtract', [5]);
            expect(typeof result).toBe('string');
            expect(result).toContain('An unexpected error occurred');
        });

        it('should handle invalid date format', async () => {
            const result = await callFunctionFromRegistry('format_date', 'invalid-date', 'YYYY-MM-DD');
            expect(typeof result).toBe('string');
            expect(result).toContain('An unexpected error occurred');
        });
    });
}); 