chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptReady') {
    console.log('Content script ready in tab:', sender.tab.id);
  }
});