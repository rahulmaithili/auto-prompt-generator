document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('api-url-input');
  const urlStatus = document.getElementById('api-url-status');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');

  const DEFAULT_URL = 'http://localhost:3000';

  // Load saved settings on popup load
  chrome.storage.local.get(['backendUrl'], (result) => {
    if (result.backendUrl) {
      urlInput.value = result.backendUrl;
      urlStatus.textContent = result.backendUrl;
    } else {
      urlStatus.textContent = DEFAULT_URL;
    }
  });

  // Save settings on button click
  saveBtn.addEventListener('click', () => {
    let inputUrl = urlInput.value.trim();

    // Strip trailing slash if present
    if (inputUrl.endsWith('/')) {
      inputUrl = inputUrl.slice(0, -1);
    }

    // Basic URL validation
    if (inputUrl && !inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
      alert('Please enter a valid URL starting with http:// or https://');
      return;
    }

    // Save to storage
    chrome.storage.local.set({ backendUrl: inputUrl }, () => {
      // Update UI status
      urlStatus.textContent = inputUrl || DEFAULT_URL;
      
      // Show saved feedback
      saveStatus.style.display = 'block';
      setTimeout(() => {
        saveStatus.style.display = 'none';
      }, 1500);
    });
  });
});
