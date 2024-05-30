
export function sendMessageToBackgroundScript(message:string | Record<string, any>) {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, (response) => {
        console.log("Response from background script:", response);
       return response
      });
    } else {
      console.error("chrome.runtime.sendMessage is not available");
    }
  }