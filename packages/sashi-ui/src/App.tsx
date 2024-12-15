import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { UserPreferences } from './components/ThemeSwitcher';
import { Toaster } from './components/ui/toaster';
import { HomePage } from './pages/HomePage';
import { SettingPage } from './pages/SettingPage';
import useAppStore from './store/chat-store';

type PagesProps = {
  // URL to the API
  apiUrl: string;

  // Session token
  sessionToken: string;
};
export const App = ({ apiUrl: oldApiUrl, sessionToken: initialSessionToken }: PagesProps) => {
  const pathName = oldApiUrl.replace(/^https?:\/\/[^\/]+/, '').replace(/^[^\/]+/, '');
  const apiUrl = useAppStore((state) => state.apiUrl);
  const setAPIUrl = useAppStore((state) => state.setAPIUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const setSessionToken = useAppStore((state) => state.setSessionToken);
  const rehydrated = useAppStore((state) => state.rehydrated);
  const [ready, setReady] = useState(false);

  const debugMode = process.env.NODE_ENV !== 'production';

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
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
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
        path: '/setting',
        element: <SettingPage />,
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
    </>
  );
};
