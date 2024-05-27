import 'react-app-polyfill/ie11';

import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './Panel';
import { APP_COLLAPSE_WIDTH, APP_EXTEND_WIDTH } from './const';


console.log("WTF WHERE IS THIS")
/// <reference types="chrome" />

async function loadChromeStorage() {
  let initialEnabled = true;
  try {
    // Loading chrome local setting, can be replace with sync
    // for more information, see: https://developer.chrome.com/docs/extensions/reference/storage/
    const result = await window['chrome'].storage.local.get(['enabled']);
    initialEnabled = !!result.enabled;
  } catch (e) {
    // Demo propose
    initialEnabled = true;
  }

  return initialEnabled;
}


const secretKey = 'your-secret-key';

// Function to validate the signed key
function validateSignedKey(key: string, signature: string) {
  //@ts-ignore
  const crypto = window.crypto || window.msCrypto; // for IE11
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(cryptoKey => {
      const data = encoder.encode(key);
      return crypto.subtle.sign('HMAC', cryptoKey, data);
    })
    .then(signatureArrayBuffer => {
      const signatureHex = Array.from(new Uint8Array(signatureArrayBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      return signatureHex === signature;
    });
}



window.onload = async () => {
  console.log("Window onload event fired");
  const scriptTag = document.querySelector('script[src*="usesashi.com/start.js"]');
  console.log("scriptTag", scriptTag);
  if (scriptTag) {
    const url = new URL(scriptTag.src);
    console.log("Window onload url", url);

    const key = url.searchParams.get('key');
    const signature = url.searchParams.get('signature');
    console.log("Query parameter key:", key);
    console.log("Query parameter signature:", signature);
    if (key && signature) {

      const isValid = await validateSignedKey(key, signature)
      if(isValid) {
        init();

      }
    }
  }
};


async function init() {
  const initialEnabled = await loadChromeStorage();

  // Create html tag wrapper
  const htmlWrapper = document.querySelectorAll('html')[0];
  htmlWrapper.id = 'original-html-wrapper';
  htmlWrapper.style['margin-right'] = `${initialEnabled ? APP_EXTEND_WIDTH : APP_COLLAPSE_WIDTH}px`;
  htmlWrapper.className = 'ease-in-out duration-300';

  // Create div wrapper
  const body = document.body;
  const bodyWrapper = document.createElement('div');
  bodyWrapper.id = 'original-body-wrapper';
  bodyWrapper.className = 'h-full w-full overflow-auto relative ease-in-out duration-300';

  // Move the body's children into this wrapper
  while (body.firstChild) {
    bodyWrapper.appendChild(body.firstChild);
  }

  bodyWrapper.style.overflow = 'auto';
  bodyWrapper.style.height = '100vh';

  // Append the wrapper to the body
  body.style.overflow = 'hidden';
  body.style.margin = '0';
  body.appendChild(bodyWrapper);

  // create react app
  const app = document.createElement('div');
  app.id = 'side-bar-extension-root';
  app.className = 'z-max p-0 m-0 ease-in-out duration-300 fixed flex top-0 right-0 bottom-0 flex-1 overflow-hidden';
  app.style['max-width'] = `${initialEnabled ? APP_EXTEND_WIDTH : APP_COLLAPSE_WIDTH}px`;

  body.appendChild(app);
  const root = createRoot(app!);

  function onSidePanelWidthChange(value: number) {
    app.style['max-width'] = `${value}px`;
    htmlWrapper.style['margin-right'] = `${value}px`;
  }

  root.render(<Panel onWidthChange={onSidePanelWidthChange} initialEnabled={initialEnabled} />);
}

//init();
