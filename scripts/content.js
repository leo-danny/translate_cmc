
let originalTexts = [];
let translateTexts = [];
let textNodes = [];
let db = null;
let language;
let loadUrlChange = false;
const DB_NAME = 'translationDB';
const STORE_NAME = 'pageTranslations';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    if (db) {
      resolve(db);
    }
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;  // Removed type assertion
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });
};

// Function to save data to IndexedDB
const saveToIndexedDB = async (data) => {
  if (!db) {
    await initDB();
  }
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  // Ensure the object has the required key property
  if (!data.id) {
    data.id = data.url; // or any other unique identifier generation
  }

  return new Promise((resolve, reject) => {
    const request = store.put(data); // Store the object, not the string
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Function to get data from IndexedDB
const getFromIndexedDB = async (url) => {
  if (!db) {
    await initDB();
  }
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(url);
    request.onsuccess = () => {
      // Check if result exists first
      if (!request.result) {
        resolve(null); // or reject(new Error('Data not found'))
        return;
      }

      try {
        // Only parse if result exists and is a string
        const data = typeof request.result === 'string'
          ? JSON.parse(request.result)
          : request.result;
        resolve(data);
      } catch (error) {
        reject(new Error('Failed to parse data'));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

const removeFromIndexedDB = async (url) => {
  if (!db) {
    await initDB();
  }
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise(async (resolve, reject) => {
    const request = await store.delete(url);
    console.log("🚀 ~ returnnewPromise ~ request:", request)
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const resetState = async (cleanCache_url = '') => {
  if (cleanCache_url) {
    await removeFromIndexedDB(cleanCache_url);
  }
  originalTexts = [];
  textNodes = [];
  translateTexts = []
};

function getTextNodes() {
  // resetState()
  function traverse(node) {
    // Check for text content in SCRIPT, STYLE, NOSCRIPT tags
    if (node.nodeType === Node.ELEMENT_NODE &&
      ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.nodeValue.trim();
      // Include text that's not just whitespace and numbers
      if (textContent && !/^\s*$/.test(textContent) && !/^\d+$/.test(textContent) && textContent.length > 1 && !node._textNode) {
        node._textNode = "translated"
        textNodes.push(node);
        originalTexts.push(textContent);
      }
    }

    for (let child of node.childNodes) {
      traverse(child);
    }
  }

  traverse(document.body);
  return textNodes;
}


async function handlePageLoad() {
  const currentLanguage = language
  if (currentLanguage === 'vi') return

  try {
    const cachedData = await getFromIndexedDB(window.location.href);
    if (cachedData && cachedData.textNodes_length === textNodes.length) {
      originalTexts = cachedData.originalTexts;
      translateTexts = cachedData.translations;
      textNodes.forEach((node, index) => {
        node.nodeValue = translateTexts[index];
      });

    } else if (currentLanguage === 'en') {
      await handleTranslate('en');
    }
  } catch (error) {
    console.error('Error loading cached translations:', error);
  }
}

async function handleTranslate(language) {
  if (textNodes.length <= 0) {
    await getTextNodes();
  };

  try {
    await translateVisibleTextFirst();
    if (document.readyState === 'complete') {
      console.log("🚀 ~ handleTranslate ~ document.readyState:", document.readyState, {
        textNodes_length: textNodes.length,
        originalTexts: originalTexts,
        translations: translateTexts
      })
      await saveToIndexedDB({
        url: window.location.href,
        textNodes_length: textNodes.length,
        originalTexts: originalTexts,
        translations: translateTexts
      });
    }

  } catch (error) {
    console.error('Error handling translation:', error);
  }
}


async function translateVisibleTextFirst() {
  const visibleNodes = [];
  const remainingNodes = [];

  // Categorize nodes as visible or remaining
  textNodes.forEach((node, index) => {
    const rect = node.parentNode.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      visibleNodes.push({ node, index });
    } else {
      remainingNodes.push({ node, index });
    }
  });

  // Translate visible nodes first
  if (visibleNodes.length > 0) {
    const visibleTexts = visibleNodes.map(item => originalTexts[item.index]);
    const translatedVisible = await translateText(visibleTexts);
    visibleNodes.forEach((nodeInfo, i) => {
      if (translatedVisible[i]) {
        translateTexts[nodeInfo.index] = translatedVisible[i];
        nodeInfo.node.nodeValue = translatedVisible[i];
      }
    });
  }

  // Then translate remaining nodes in batches
  if (remainingNodes.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < remainingNodes.length; i += batchSize) {
      const batch = remainingNodes.slice(i, i + batchSize);
      const batchTexts = batch.map(item => originalTexts[item.index]);
      const translatedBatch = await translateText(batchTexts);
      batch.forEach((nodeInfo, batchIndex) => {
        if (translatedBatch[batchIndex]) {
          translateTexts[nodeInfo.index] = translatedBatch[batchIndex];
          nodeInfo.node.nodeValue = translatedBatch[batchIndex];
        }
      });
    }
  }
}

// Translate text using API
async function translateText(textArray) {
  try {
    // const response = await fetch('http://52.21.75.168:8000/translate', {
    const response = await fetch('https://d3jycxme3wp0xo.cloudfront.net/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(textArray),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response}`);
    }

    const data = await response.json();
    // Verify we got translations for all texts
    if (data.length !== textArray.length) {
      throw new Error('Translation response incomplete');
    }
    return data;

  } catch (error) {
    console.error(`Translation failed:`, error)
    return [];
  }

}

const handleNavigation = async (url = '') => {
  await resetState(url);
  getTextNodes();
  await handlePageLoad();
};

const observeUrlChanges = () => {
  if (loadUrlChange === true) return;
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      handleNavigation();
    }
  });

  observer.observe(document, {
    subtree: true,
    childList: true
  });
  loadUrlChange = true;
};

// Initialize when extension loads
const init = async () => {
  if (!db) {
    await initDB();
  }
  await handlePageLoad();
  observeUrlChanges();
};

const myIntervalFunc = () => {
  const myInterval = setInterval(async () => {
    console.log(language, 'language');
    if (language === 'vi') {
      await initDB();
      clearInterval(myInterval);
    }
    if (language) {
      const lastTextNote_length = textNodes.length
      console.log("🚀 ~ myInterval ~ textNodes:", lastTextNote_length)
      if (document.readyState === 'interactive') {
        getTextNodes()
        console.log("🚀 ~ myInterval ~ textNodes.length:", textNodes.length, lastTextNote_length, {
          url: window.location.href,
          textNodes_length: textNodes.length,
          originalTexts: originalTexts,
          translations: translateTexts
        }, document.readyState)
        if (lastTextNote_length === textNodes.length && translateTexts.length > 0) return
        console.log("🚀 ~ handleTranslate ~ language:1111111111111", language)

        await init();
      }
      if (document.readyState === 'complete') {
        getTextNodes()
        console.log("🚀 ~ myInterval ~ textNodes.length:", textNodes.length, lastTextNote_length, {
          url: window.location.href,
          textNodes_length: textNodes.length,
          originalTexts: originalTexts,
          translations: translateTexts
        })
        if (lastTextNote_length === textNodes.length && translateTexts.length > 0) {
          await saveToIndexedDB({
            url: window.location.href,
            textNodes_length: textNodes.length,
            originalTexts: originalTexts,
            translations: translateTexts
          }, document.readyState);
        } else {
          await init()
        }
        clearInterval(myInterval);
      }
    }
  }, 1000)
  return myInterval
};

myIntervalFunc()

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'translate') {
    language = request.language
    console.log("🚀 ~ chrome.runtime.onMessage.addListener ~ language:", language)
    if (!language) return
    sendResponse({ status: 'success' });

    if (language === 'vi') {
      const cachedData = await getFromIndexedDB(window.location.href);
      console.log("🚀 ~ chrome.runtime.onMessage.addListener ~ cachedData:", cachedData)
      // if (cachedData && cachedData.textNodes_length === textNodes.length) {
      //   originalTexts = cachedData.originalTexts;
      //   translateTexts = cachedData.translations;
      //   textNodes.forEach((node, index) => {
      //     node.nodeValue = originalTexts[index];
      //   });
      // } else {
      textNodes.forEach((node, index) => {
        node.nodeValue = originalTexts[index];
      });
      // }
      return true
    }
    if (document.readyState === 'complete') {
      const cachedData = await getFromIndexedDB(window.location.href);
      if (cachedData && cachedData.textNodes_length === textNodes.length) {
        originalTexts = cachedData.originalTexts;
        translateTexts = cachedData.translations;
        textNodes.forEach((node, index) => {
          node.nodeValue = translateTexts[index];
        });
      }
    } else {
      textNodes.forEach((node, index) => {
        node.nodeValue = translateTexts[index];
      });
      myIntervalFunc()
    }

    return true;
  }
});

chrome.runtime.sendMessage({
  type: "getLanguage",
  payload: "getLanguage"
}, response => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }
  console.log("🚀 ~ response:", response);
  const foundLanguage = response.language;
  language = foundLanguage
});

document.addEventListener('click', (e) => {
  if (e.target.tagName === 'A' &&
    /^[0-9]+$/.test(e.target.textContent.trim()) &&
    e.target.classList.contains('nav-link')) {
    setTimeout(() => {
      handleNavigation(window.location.href);
    }, 1000);
  }
});

console.log('🚀 Application initialized');