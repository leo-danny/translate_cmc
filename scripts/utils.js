let debounceTimer;


function splitArray(array, chunkSize) {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

function handleDOMChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await transferNode();
    // If currently in English mode, translate new content
    const currentLanguage = document.documentElement.getAttribute('data-language');
    if (currentLanguage === 'en') {
      await handleTranslate('en');
    }
  }, 500); // Debounce time of 500ms
}