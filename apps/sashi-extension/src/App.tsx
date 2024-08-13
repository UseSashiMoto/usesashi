import React, { useEffect, useState } from 'react';

import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import Panel from './Panel';

// 2. Add your color mode config
const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// 3. extend the theme
const theme = extendTheme({ config });
export const App = ({
  sashiKey,
  sashiSignature,
  initialEnabled,
  onWidthChange,
}: {
  onWidthChange: (value: number) => void;
  initialEnabled: boolean;
  sashiSignature: string;
  sashiKey: string;
}) => {
  const [enabled, setEnabled] = useState(initialEnabled);

  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log('Message received in App', message);
      if (message.action === 'disable') {
        setEnabled(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, (response) => {
      console.log('Tab Info:', response);
    });
  }, []);

  console.log('Enabled', enabled);
  if (!enabled) {
    return null; // Or any other logic to stop rendering components
  }

  return (
    <Panel
      sashiKey={sashiKey}
      sashiSignature={sashiSignature}
      onWidthChange={onWidthChange}
      initialEnabled={initialEnabled}
    />
  );
};
