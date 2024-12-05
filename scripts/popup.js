const languageSelect = document.querySelector('#language-select');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup initialized');  // More descriptive log
  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    const activeTab = tabs[0];
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }

    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'getLanguage' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response?.language) {
      languageSelect.value = response.language;
    }
  } catch (error) {
    console.error('Error getting language:', error);
  }
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

    // Send message using Promise wrapper
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