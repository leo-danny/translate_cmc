const languageSelect = document.querySelector('#language-select');

chrome.storage.local.get(['language'], function (result) {
  const language = result.language || 'vi';
  languageSelect.value = language
});

// Update the event listener
languageSelect.addEventListener('change', async (e) => {
  const newLang = e.target.value;

  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    const activeTab = tabs[0];
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }
    chrome.storage.local.set({ language: newLang });
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'translate', language: newLang },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
    console.log('Message sent successfully:', response);
  } catch (error) {
    console.error('Translation error:', error);
  }
});