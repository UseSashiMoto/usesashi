export function sendMessageToBackgroundScript(message: string | Record<string, any>) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      console.log('Sending message to background script:', message);
      chrome.runtime.sendMessage(message, (response: Record<string, any>) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background script:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Response from background script:', response);
          resolve(response);
        }
      });
    } else {
      const error = new Error('chrome.runtime.sendMessage is not available');
      console.error(error);
      reject(error);
    }
  });
}
