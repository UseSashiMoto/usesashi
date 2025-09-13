import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { UserPreferences } from './components/ThemeSwitcher';
import { Toaster } from './components/ui/toaster';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { SettingPage } from './pages/SettingPage';
import useAppStore from './store/chat-store';
import { HEADER_SESSION_TOKEN } from './utils/contants';

// Debug overlay component
const DebugOverlay = () => {
  const apiUrl = useAppStore((state) => state.apiUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const connectedToHub = useAppStore((state) => state.connectedToHub);
  const hubStatus = useAppStore((state) => state.hubStatus);
  const rehydrated = useAppStore((state) => state.rehydrated);

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50">
      <div className="space-y-1">
        <div>API URL: {apiUrl || 'Not set'}</div>
        <div>Session: {sessionToken ? '✓' : '✗'}</div>
        <div>
          Hub: {connectedToHub ? '✓' : '✗'}{' '}
          {hubStatus.authenticated ? '(Auth ✓)' : hubStatus.connected ? '(Auth ✗)' : ''}
        </div>
        <div>Rehydrated: {rehydrated ? '✓' : '✗'}</div>
      </div>
    </div>
  );
};

type PagesProps = {
  // Path name
  baseName?: string;
  // URL to the API
  apiUrl: string;

  // Session token
  sessionToken: string;
};
export const App = ({ apiUrl: oldApiUrl, sessionToken: initialSessionToken, baseName }: PagesProps) => {
  const pathName = baseName || oldApiUrl.replace(/^https?:\/\/[^\/]+/, '').replace(/^[^\/]+/, '');
  const apiUrl = useAppStore((state) => state.apiUrl);
  const setAPIUrl = useAppStore((state) => state.setAPIUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const setSessionToken = useAppStore((state) => state.setSessionToken);
  const rehydrated = useAppStore((state) => state.rehydrated);
  const [ready, setReady] = useState(false);

  // More robust debug mode detection that works in npm package context
  const debugMode =
    process.env.NODE_ENV !== 'production' ||
    (typeof window !== 'undefined' && window.location.search.includes('debug=true'));

  const setHubStatus = useAppStore((state: { setHubStatus: any }) => state.setHubStatus);

  useEffect(() => {
    const checkConnectedToHub = async () => {
      console.log('checking hub connection', apiUrl, sessionToken);

      try {
        const response = await fetch(`${apiUrl}/check_hub_connection`, {
          method: 'GET',
          headers: {
            [HEADER_SESSION_TOKEN]: sessionToken ?? '',
          },
        });
        const data = await response.json();
        console.log('hub connection data', data);

        setHubStatus({
          connected: data.connected || false,
          authenticated: data.authenticated || false,
          userId: data.userId,
          hasApiKey: data.hasApiKey || false,
          error: data.error,
        });
      } catch (error) {
        console.error('Error checking hub connection', error);
        setHubStatus({
          connected: false,
          authenticated: false,
          hasApiKey: false,
          error: 'Connection check failed',
        });
      }
    };
    checkConnectedToHub();
  }, [apiUrl, sessionToken]);

  useEffect(() => {
    if (rehydrated) {
      if (!apiUrl && oldApiUrl) {
        setAPIUrl(oldApiUrl);
      }
      if (!sessionToken && initialSessionToken) {
        setSessionToken(initialSessionToken);
      }
      setReady(true);
    }
  }, [rehydrated]);

  useEffect(() => {
    console.log('Setting session token', sessionToken);

    // Add the request interceptor
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        // Set headers for every request made within this middleware
        config.headers['x-sashi-session-token'] = sessionToken;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add the response interceptor
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle errors globally
        console.error('Axios request failed:', error);

        if (debugMode) {
          // Show toast notification in debug mode using shadcn toast
          const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
          import('@/hooks/use-toast').then(({ toast }) => {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: errorMessage,
            });
          });
        }

        // Return a rejected promise to handle errors locally if needed
        return Promise.reject(error);
      }
    );

    // Cleanup: Remove the interceptors when the component unmounts
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [sessionToken]);

  useEffect(() => {
    const userPreferences: UserPreferences | null = JSON.parse(localStorage.getItem('user-preferences') || 'null');

    if (userPreferences) {
      if (
        userPreferences.theme === 'dark' ||
        (userPreferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      if (window && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    setReady(true);
  }, []);

  if (!ready) {
    return null;
  }

  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/setting',
        element: <SettingPage />,
      },
      {
        path: '/audit-logs',
        element: <AuditLogsPage />,
      },
    ],
    {
      basename: `${pathName}/bot`,
    }
  );

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
      {debugMode && <DebugOverlay />}
    </>
  );
};
