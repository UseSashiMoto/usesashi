import axios from 'axios';
import React, { useEffect, useState } from 'react';
import type { UserPreferences } from './components/ThemeSwitcher';
import { HomePage } from './pages/HomePage';

type PagesProps = {
  // URL to the API
  apiUrl: string;
  // Base path for the app
  basename: string;
  // Session token
  sessionToken: string;
};
export const App = ({ apiUrl, basename, sessionToken }: PagesProps) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('Setting session token', sessionToken);

    // Add the interceptor and store its ID to remove it later
    const interceptor = axios.interceptors.request.use(
      (config) => {
        // Set headers for every request made within this middleware
        config.headers['x-sashi-session-token'] = sessionToken;
        return config;
      },
      (error) => {
        // Handle the error if the request fails
        return Promise.reject(error);
      }
    );

    // Cleanup: Remove the interceptor when the component unmounts or sessionToken changes
    return () => {
      axios.interceptors.request.eject(interceptor);
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

  return (
    <>
      <HomePage sessionToken={sessionToken} apiUrl={apiUrl} />
    </>
  );
};
