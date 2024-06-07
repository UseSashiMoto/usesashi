import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import Panel from './Panel';

const ShadowRootWrapper = ({ sashiKey, sashiSignature, initialEnabled, onSidePanelWidthChange }:{ onSidePanelWidthChange: (value: number) => void, initialEnabled: boolean, sashiSignature: string, sashiKey:string }) => {
  const shadowRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shadowRootRef.current) {
      const shadowRoot = shadowRootRef.current.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        /* Include any additional styles you want here */
        @import url("path/to/@park-ui/tailwind-plugin/preset.css");
      `;
      shadowRoot.appendChild(style);
      ReactDOM.render(
        <Panel sashiKey={sashiKey} sashiSignature={sashiSignature} initialEnabled={initialEnabled} onWidthChange={onSidePanelWidthChange} />,
        shadowRoot
      );
    }
  }, []);

  return <div ref={shadowRootRef}></div>;
};

export default ShadowRootWrapper;