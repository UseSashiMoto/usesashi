import React, { useEffect, useState } from 'react';

import Panel from "./Panel";

export const App = ({ sashiKey, sashiSignature, initialEnabled, onWidthChange }: { onWidthChange: (value: number) => void, initialEnabled: boolean, sashiSignature: string, sashiKey:string }) => {
    const [enabled, setEnabled] = useState(initialEnabled);
  
    useEffect(() => {
      const handleMessage = (message: any) => {
        console.log("Message received in App", message);
        if (message.action === 'disable') {
          setEnabled(false);
        }
      };
  
      chrome.runtime.onMessage.addListener(handleMessage);
  
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
      };
    }, []);
  
    console.log("Enabled", enabled)
    if (!enabled) {
      return null; // Or any other logic to stop rendering components
    }
  
    return (
      <Panel sashiKey={sashiKey} sashiSignature={sashiSignature} onWidthChange={onWidthChange} initialEnabled={initialEnabled} />
    );
  };