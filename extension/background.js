/**
 * Auto Prompt Generator - Background Service Worker
 * Handles API fetch operations to bypass webpage CSP/CORS restrictions.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'improvePrompt') {
    // Run the async fetch and send the response back
    fetchImprovedPrompt(request.prompt, request.tone)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keeps the message channel open for asynchronous sendResponse
  }
});

/**
 * Performs the actual fetch request in the background extension context.
 */
async function fetchImprovedPrompt(prompt, tone) {
  // Retrieve saved URL from storage, fallback to production Vercel
  const result = await chrome.storage.local.get(['backendUrl']);
  const baseUrl = result.backendUrl || 'https://auto-prompt-generator-ds9jhmwfr.vercel.app';
  const url = `${baseUrl}/api/improve`;

  // Create a 20-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, tone }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Server returned an error response' }));
      throw new Error(errData.error || 'Server error occurred');
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Background API Fetch Error:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The server or AI API is taking too long to respond. Please try again!');
    }
    throw error;
  }
}
