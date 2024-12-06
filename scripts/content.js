
let originalTexts = [];
let translateTexts = [];
let textNodes = [];
let db = null;
const DB_NAME = 'translationDB';
const STORE_NAME = 'pageTranslations';

const resetState = () => {
  originalTexts = [];
  translateTexts = [];
  textNodes = [];
};

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

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
  if (!db) throw new Error('Database not initialized');
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
  if (!db) throw new Error('Database not initialized');
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(url);
    request.onsuccess = () => {
      // Check if result exists first
      console.log("🚀 ~ returnnewPromise ~ request.result:", request.result)

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

function getTextNodes() {

  function traverse(node) {

    // Check for text content in SCRIPT, STYLE, NOSCRIPT tags
    if (node.nodeType === Node.ELEMENT_NODE &&
      ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.nodeValue.trim();
      // Include text that's not just whitespace and numbers
      if (textContent && !/^\s*$/.test(textContent) && !/^\d+$/.test(textContent) && textContent.length > 1) {
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
  await getTextNodes();
  console.log('textNodes', textNodes);
  const currentUrl = window.location.pathname;
  console.log("🚀 ~ handlePageLoad ~ currentUrl:", currentUrl)
  const currentLanguage = localStorage.getItem('language') || 'vi';

  if (currentLanguage === 'vi') return

  try {
    const cachedData = await getFromIndexedDB(currentUrl);
    console.log("🚀 ~ handlePageLoad ~ cachedData:", cachedData)

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
  if (!textNodes?.length) {
    await getTextNodes();
  };

  const currentUrl = window.location.pathname;

  if (language === 'vi') {
    textNodes.forEach((node, index) => {
      node.nodeValue = originalTexts[index];
    });
    return;
  }

  try {
    const cachedData = await getFromIndexedDB(currentUrl);

    if (cachedData && cachedData.textNodes_length === textNodes.length) {
      originalTexts = cachedData.originalTexts;
      translateTexts = cachedData.translations;

      textNodes.forEach((node, index) => {
        node.nodeValue = translateTexts[index];
      });
    } else {
      await translateVisibleTextFirst();
      console.log({
        url: currentUrl,
        textNodes_length: textNodes.length,
        originalTexts: originalTexts,
        translations: translateTexts
      });
      if (translateTexts && translateTexts?.length > 0) {
        await saveToIndexedDB({
          url: currentUrl,
          textNodes_length: textNodes.length,
          originalTexts: originalTexts,
          translations: translateTexts
        });
      }

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
    // const batchSize = 100;

    // for (let i = 0; i < visibleNodes.length; i += batchSize) {
    //   const batch = visibleNodes.slice(i, i + batchSize);
    //   const batchTexts = batch.map(item => originalTexts[item.index]);
    //   const translatedBatch = await translateText(batchTexts);

    //   batch.forEach((nodeInfo, batchIndex) => {
    //     if (translatedBatch[batchIndex]) {
    //       translateTexts[nodeInfo.index] = translatedBatch[batchIndex];
    //       nodeInfo.node.nodeValue = translatedBatch[batchIndex];
    //     }
    //   });
    // }

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

const handleNavigation = async () => {
  resetState();
  await handlePageLoad();
};

const observeUrlChanges = () => {
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
};

const waitForPageLoad = () => {
  return new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
};

const waitForNetworkIdle = () => {
  return new Promise(resolve => {
    let timer;
    const observer = new PerformanceObserver(list => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 300); // Đợi 500ms sau request cuối cùng
    });

    observer.observe({ entryTypes: ['resource'] });
  });
};


// Initialize when extension loads
const init = async () => {
  // await waitForPageLoad();
  // await waitForNetworkIdle();
  await initDB();
  observeUrlChanges();

  // setTimeout(async () => {
  await handlePageLoad();
  // }, 3000);
};

const myInterval = setInterval(async () => {
  if (document.readyState === 'complete') {
    console.log("🚀 ~ myInterval ~ document.readyState:", document.readyState)
    clearInterval(myInterval);
    await init();
  }
}, 1000);


// window.addEventListener('popstate', handleNavigation);
// window.addEventListener('state', handleNavigation);

// // Intercept history methods
// const originalPushState = history.pushState;
// history.pushState = function () {
//   originalPushState.apply(this, arguments);
//   handleNavigation();
// };

// const originalReplaceState = history.replaceState;
// history.replaceState = function () {
//   originalReplaceState.apply(this, arguments);
//   handleNavigation();
// };

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslate(request.language);
    localStorage.setItem('language', request.language);
    sendResponse({ status: 'success' });
    return true;
  } else if (request.action === 'getLanguage') {
    const language = localStorage.getItem('language')
    sendResponse({ language: language || 'vi' });
    return true;
  }
});
