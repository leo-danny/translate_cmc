chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptReady') {
    console.log('Content script ready in tab:', sender.tab.id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getLanguage") {
    chrome.storage.local.get(['language'], function (result) {
      const language = result.language || 'vi';
      console.log("🚀 ~ Getting language from storage:", language);
      sendResponse({ language });
    });
    return true;
  }
});