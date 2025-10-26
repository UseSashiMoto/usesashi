import axios from 'axios';
import { useEffect, useState } from 'react';

export interface ConnectionHealth {
    isHealthy: boolean;
    latency: number;
    status: 'excellent' | 'good' | 'poor' | 'offline';
    lastChecked: Date | null;
}

/**
 * Monitors the health of the API connection
 * Provides latency information and connection status
 * 
 * @param apiUrl - The API base URL to monitor
 * @param checkInterval - How often to check (in ms, default: 30000 = 30 seconds)
 * @returns Connection health information
 */
export const useConnectionHealth = (
    apiUrl: string | undefined,
    checkInterval: number = 30000
): ConnectionHealth => {
    const [health, setHealth] = useState<ConnectionHealth>({
        isHealthy: true,
        latency: 0,
        status: 'excellent',
        lastChecked: null,
    });

    useEffect(() => {
        if (!apiUrl) {
            setHealth({
                isHealthy: false,
                latency: 0,
                status: 'offline',
                lastChecked: null,
            });
            return;
        }

        const checkHealth = async () => {
            const start = Date.now();

            try {
                await axios.get(`${apiUrl}/health`, {
                    timeout: 5000,
                    // Don't retry health checks
                    validateStatus: (status) => status < 500,
                });

                const latency = Date.now() - start;

                // Determine status based on latency
                let status: ConnectionHealth['status'];
                if (latency < 200) {
                    status = 'excellent';
                } else if (latency < 500) {
                    status = 'good';
                } else {
                    status = 'poor';
                }

                setHealth({
                    isHealthy: true,
                    latency,
                    status,
                    lastChecked: new Date(),
                });
            } catch (error) {
                setHealth({
                    isHealthy: false,
                    latency: Date.now() - start,
                    status: 'offline',
                    lastChecked: new Date(),
                });
            }
        };

        // Check immediately
        checkHealth();

        // Then check periodically
        const interval = setInterval(checkHealth, checkInterval);

        return () => clearInterval(interval);
    }, [apiUrl, checkInterval]);

    return health;
};

/**
 * Hook to display connection status as a user-friendly message
 */
export const useConnectionStatus = (apiUrl: string | undefined) => {
    const health = useConnectionHealth(apiUrl);

    const getMessage = () => {
        switch (health.status) {
            case 'excellent':
                return null; // Don't show message for excellent connection
            case 'good':
                return `Connection: ${health.latency}ms`;
            case 'poor':
                return `⚠️ Slow connection (${health.latency}ms)`;
            case 'offline':
                return '❌ Connection lost';
            default:
                return null;
        }
    };

    const getColor = () => {
        switch (health.status) {
            case 'excellent':
                return 'green';
            case 'good':
                return 'blue';
            case 'poor':
                return 'yellow';
            case 'offline':
                return 'red';
            default:
                return 'gray';
        }
    };

    return {
        health,
        message: getMessage(),
        color: getColor(),
    };
};

