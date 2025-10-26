import { useEffect, useState } from 'react';

/**
 * Debounces a value to prevent excessive updates
 * Useful for search inputs, form validation, API calls, etc.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 * 
 * @example
 * const [searchText, setSearchText] = useState('');
 * const debouncedSearch = useDebouncedValue(searchText, 500);
 * 
 * useEffect(() => {
 *   // API call with debounced value
 *   searchAPI(debouncedSearch);
 * }, [debouncedSearch]);
 */
export const useDebouncedValue = <T>(value: T, delay: number = 300): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set up the timeout
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clean up the timeout if value changes or component unmounts
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Returns both the immediate value and debounced value
 * Useful when you need both for different purposes
 */
export const useDebouncedState = <T>(
    initialValue: T,
    delay: number = 300
): [T, T, (value: T) => void] => {
    const [value, setValue] = useState<T>(initialValue);
    const debouncedValue = useDebouncedValue(value, delay);

    return [value, debouncedValue, setValue];
};

