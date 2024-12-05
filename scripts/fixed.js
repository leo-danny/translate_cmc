const languageSelect = document.createElement('select');
languageSelect.id = 'languageSelect';

const languages = [
  { code: 'Tiếng việt', name: 'Tiếng việt' },
  { code: 'English', name: 'English' },
];

languages.forEach(lang => {
  const option = document.createElement('option');
  option.value = lang.code;
  option.textContent = lang.name;
  languageSelect.appendChild(option);
});

document.body.insertBefore(languageSelect, document.body.firstChild);

languageSelect.addEventListener('change', (e) => handleTranslate(e.target.value));

let originalTexts = [];
let translateTexts = [];
let textNodes;

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

// Function to get visible text nodes in the viewport
function getVisibleTextInViewport() {
  const visibleText = [];
  const textNodes = getTextNodes();
  for (let node of textNodes) {
    const rect = node.parentNode.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      visibleText.push(node.nodeValue.trim());
    }
  }
  return visibleText;
}

// Initialize text nodes and original texts
async function transferNode() {
  textNodes = getTextNodes();
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const originalText = node.nodeValue.trim();
    originalTexts.push(originalText);
  }
}

transferNode();
console.log('Original texts:', textNodes.length);
// Handle language translation
async function handleTranslate(language) {
  if (language === 'Tiếng việt') {
    if (originalTexts.length === 0) return;
    textNodes.forEach((node, index) => {
      node.nodeValue = originalTexts[index];
    });
  } else if (language === 'English') {
    // Check cache first
    if (translateTexts.length === originalTexts.length) {
      // Use cached translations
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



// Translate all text nodes
// async function translateAllText() {
//   const visibleText = getVisibleTextInViewport();
//   const untranslatedTexts = originalTexts.filter((text, index) => !translateTexts[index]);

//   if (untranslatedTexts.length === 0) {
//     console.log("All text has been translated previously.");
//     return;
//   }

//   const arrays = splitArray(untranslatedTexts, 100);
//   let startIndex = 0;

//   for (const batch of arrays) {
//     const translatedBatch = await translateText(batch);
//     translatedBatch.forEach((item, index) => {
//       const globalIndex = startIndex + index;
//       translateTexts[globalIndex] = item;
//       textNodes[globalIndex].nodeValue = item;
//     });
//     startIndex += batch.length;
//   }
// }

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


// Split array into chunks
function splitArray(array, chunkSize) {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}