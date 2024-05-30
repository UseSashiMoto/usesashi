import axios from "axios";
import { PayloadObject } from "./models/PayloadObject";
import { serverAddress } from "./configs/configs";



function isObject(value: any): value is PayloadObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

chrome.runtime.onMessage.addListener(
  async (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  console.log('Extension Installed', message)


  if(isObject(message)) {

    if (message.action === 'get-config') {
     
      console.log("Getting configs", message.payload)
      console.log("headers",{
        'Content-Type': 'application/json', // Example header
        'Authorization': 'Bearer your_token_here', // Example header
        'account-key':message.payload.key,
        'account-signature':message.payload.signature
      })
      const response = await axios.get(`${serverAddress}/s-controls/configs`,{
        headers: {
          'Content-Type': 'application/json', // Example header
          'Authorization': 'Bearer your_token_here', // Example header
          'account-key':message.payload.key,
          'account-signature':message.payload.signature,
          'account-id': 'test_account_id_header',
        }
      })
      console.log("config response", response)
      if(response.status !== 200) {
        return
      }

      const configs = response.data
      console.log("Configs", configs)
      // Perform the necessary actions, such as waking up or handling headers
      sendResponse({ action:'set-config', payload: {configs: configs} });
    }
  }
});