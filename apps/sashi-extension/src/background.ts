import axios from 'axios';
import { PayloadObject } from './models/PayloadObject';

function isObject(value: any): value is PayloadObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    console.log('Tab activated', activeInfo, tab);

    if (tab.url) {
      chrome.tabs.sendMessage(activeInfo.tabId, { action: 'activate' });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { action: 'activate' });
  }
});

chrome.runtime.onMessage.addListener(
  (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    console.log('Message received', message);

    if (message.type === 'GET_TAB_INFO') {
      chrome.tabs.get(_sender?.tab?.id ?? 0, (tab) => {
        sendResponse({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          index: tab.index,
        });
      });
      return true; // Indicates that sendResponse will be called asynchronously
    }

    if (isObject(message) && message.action === 'validate-key') {
      console.log('validate-key', message);
      const { serverAddress } = message.payload;

      const validating = async () => {
        const response = await axios.post(
          `${serverAddress}/s-controls/validate-key`,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer your_token_here',
              'account-key': message.payload.key,
              'account-signature': message.payload.signature,
            },
          }
        );
        console.log('valid response.data', response.data);

        if (response.status !== 200) {
          console.error('Non-200 response status:', response.status);
          sendResponse({ valid: false });
        } else {
          const isValid = response.data;
          sendResponse({ valid: isValid });
        }

        return true;
      };
      validating();

      return true;
    }
    if (isObject(message) && message.action === 'get-config') {
      const fetchConfigs = async () => {
        try {
          const { serverAddress } = message.payload;

          const response = await axios.get(`${serverAddress}/s-controls/configs`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer your_token_here',
              'account-key': message.payload.key,
              'account-signature': message.payload.signature,
              'account-id': message.payload.accountId,
            },
          });

          if (response.status !== 200) {
            console.error('Non-200 response status:', response.status);
            sendResponse({ error: 'Failed to retrieve configs' });
          } else {
            const configs = response.data;
            sendResponse({ action: 'set-config', payload: { configs: configs } });
            chrome.runtime.sendMessage({ action: 'set-config', payload: { configs: configs } });
          }
        } catch (error) {
          sendResponse({ error: 'Error fetching configs' });
        }
      };

      fetchConfigs();

      return true; // Indicates that sendResponse will be called asynchronously
    }

    if (isObject(message) && message.action === 'send-message') {
      const { serverAddress } = message.payload;

      axios
        .post(`${serverAddress}/s-controls/chat`, message.payload)
        .then((response) => {
          console.log('response', response.data);
          sendResponse(response.data);
        })
        .catch((error) => {
          console.error('Error sending message:', error);
          sendResponse({ error: 'Error sending message' });
        });

      return true;
    }

    return false; // Return false if the message is not handled
  }
);
