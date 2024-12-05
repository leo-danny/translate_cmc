import { getFromIndexedDB, initDB, saveToIndexedDB } from "./initDB";

let originalTexts = [];
let translateTexts = [];
let textNodes;
let lastUrl = window.location.pathname;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslate(request.language);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  await transferNode();
  transferNode();
  startObserving();
});

const observer = new MutationObserver(() => {
  const currentUrl = window.location.pathname;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    transferNode();
  }
}).observe(document.documentElement, { subtree: true, childList: true });


function startObserving() {
  const observerConfig = {
    childList: true,      // Watch for changes in child elements
    subtree: true,        // Watch all descendants, not just direct children
    characterData: true   // Watch for text content changes
  };

  // Start observing the document body
  observer.observe(document.body, observerConfig);

  // Disconnect observer when page is unloaded to prevent memory leaks
  window.addEventListener('unload', () => {
    observer.disconnect();
  });
}

function getTextNodes() {
  let textNodes = [];

  function traverse(node) {
    if (node.id === 'languageSelect') {
      return;
    }

    // Check for text content in SCRIPT, STYLE, NOSCRIPT tags
    if (node.nodeType === Node.ELEMENT_NODE &&
      ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.nodeValue.trim();
      // Include text that's not just whitespace and numbers
      if (textContent && !/^\s*$/.test(textContent) && !/^\d+$/.test(textContent)) {
        textNodes.push(node);
      }
    }

    for (let child of node.childNodes) {
      traverse(child);
    }
  }

  traverse(document.body);
  return textNodes;
}

// Initialize text nodes and original texts
async function transferNode() {
  const currentUrl = window.location.pathname;
  const currentLanguage = localStorage.getItem('language') || 'vi';

  textNodes = getTextNodes();
  originalTexts = [];
  translateTexts = [];

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const originalText = node.nodeValue.trim();
    originalTexts.push(originalText);
  }

  // Check IndexedDB for cached translations
  const cached = await getFromIndexedDB(currentUrl);
  if (cached && cached.textNodesLength === textNodes.length) {
    translateTexts = cached.translations;
    if (currentLanguage === 'en') {
      textNodes.forEach((node, index) => {
        node.nodeValue = translateTexts[index];
      });
    }
  } else if (currentLanguage === 'en') {
    await translateVisibleTextFirst();
    await saveToIndexedDB({
      url: currentUrl,
      textNodesLength: textNodes.length,
      translations: translateTexts
    });
  }
}

// Handle language translation
async function handleTranslate(language) {
  if (language === 'vi') {
    if (originalTexts.length === 0) return;
    textNodes.forEach((node, index) => {
      node.nodeValue = originalTexts[index];
    });
  } else if (language === 'en') {
    if (translateTexts.length === originalTexts.length) {
      textNodes.forEach((node, index) => {
        node.nodeValue = translateTexts[index];
      });
      return;
    }
    await translateVisibleTextFirst();
  }
}

async function translateVisibleTextFirst() {
  const visibleNodes = [];
  const remainingNodes = [];

  textNodes.forEach((node, index) => {
    const rect = node.parentNode.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      // Check cache for visible nodes
      if (translateTexts[index]) {
        node.nodeValue = translateTexts[index];
      } else {
        visibleNodes.push({ node, index });
      }
    } else if (!translateTexts[index]) {
      remainingNodes.push({ node, index });
    }
  });

  // Only translate uncached visible nodes
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

  // Process remaining uncached nodes
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

      console.log(`Translated ${Math.min(i + batchSize, remainingNodes.length)} of ${remainingNodes.length} nodes`);
    }
  }
}

// Translate text using API
async function translateText(textArray) {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch('http://52.21.75.168:8000/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textArray),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("🚀 ~ translateText ~ data:", data)

      // Verify we got translations for all texts
      if (data.length !== textArray.length) {
        throw new Error('Translation response incomplete');
      }

      return data;
    } catch (error) {
      console.error(`Translation attempt ${retryCount + 1} failed:`, error);
      retryCount++;

      if (retryCount === maxRetries) {
        console.error('Max retries reached, returning original texts');
        return textArray;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return textArray;
}
