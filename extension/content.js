/**
 * Auto Prompt Generator - Content Script
 * Injected into ChatGPT, Claude, and Gemini.
 */

(function () {
  // Prevent duplicate injection
  if (window.APG_INITIALIZED) return;
  window.APG_INITIALIZED = true;

  let activeInputEl = null;
  let shadowRoot = null;
  let sidebarEl = null;
  let lastRawPrompt = '';
  let currentTone = 'advanced'; // Default tone

  // Helper to fetch the saved backend URL from storage, falling back to localhost
  function getBackendUrl() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['backendUrl'], (result) => {
        const baseUrl = result.backendUrl || 'https://auto-prompt-generator-ds9jhmwfr.vercel.app';
        resolve(`${baseUrl}/api/improve`);
      });
    });
  }

  // Initialize the extension
  function init() {
    setupMutationObserver();
    checkForInputs();
    createShadowDOM();
  }

  // Create Shadow DOM to isolate sidebar styling
  function createShadowDOM() {
    const host = document.createElement('div');
    host.id = 'apg-shadow-host';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    // Link the extension's external content.css
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    shadowRoot.appendChild(link);

    // Create the sidebar container
    sidebarEl = document.createElement('div');
    sidebarEl.className = 'apg-sidebar';
    shadowRoot.appendChild(sidebarEl);
  }

  // Set up MutationObserver to watch for dynamically loaded textareas
  function setupMutationObserver() {
    const observer = new MutationObserver(() => {
      checkForInputs();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Detect chat textareas and inject "Improve" button
  function checkForInputs() {
    const hostname = window.location.hostname;
    let inputEl = null;
    let platformClass = '';

    if (hostname.includes('chatgpt.com')) {
      inputEl = document.querySelector('#prompt-textarea');
    } else if (hostname.includes('claude.ai')) {
      // Find the editable div used by Claude
      inputEl = document.querySelector('div[contenteditable="true"]');
      platformClass = 'apg-improve-badge-claude';
    } else if (hostname.includes('gemini.google.com')) {
      // Find Gemini's textarea or rich editor
      inputEl = document.querySelector('#id-textarea') || document.querySelector('textarea') || document.querySelector('div[contenteditable="true"]');
      platformClass = 'apg-improve-badge-gemini';
    }

    if (inputEl) {
      activeInputEl = inputEl;
      
      // Inject button if not already present
      const parent = inputEl.parentElement;
      if (parent && !parent.querySelector('.apg-improve-badge')) {
        // Ensure parent container is relative so absolute positioning works
        const computedStyle = window.getComputedStyle(parent);
        if (computedStyle.position === 'static') {
          parent.style.position = 'relative';
        }

        const button = document.createElement('button');
        button.className = `apg-improve-badge ${platformClass}`;
        button.innerHTML = `✨ Improve`;
        button.type = 'button';
        
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleImproveClick();
        });

        parent.appendChild(button);
      }
    }
  }

  // Handle clicking the "Improve" button
  function handleImproveClick() {
    if (!activeInputEl) return;

    // Extract raw prompt text
    let rawText = '';
    if (activeInputEl.tagName === 'TEXTAREA' || activeInputEl.tagName === 'INPUT') {
      rawText = activeInputEl.value;
    } else {
      // For contenteditable divs
      rawText = activeInputEl.innerText || activeInputEl.textContent;
    }

    rawText = rawText.trim();
    if (!rawText) {
      alert('Please type a prompt first before improving!');
      return;
    }

    lastRawPrompt = rawText;
    openSidebar();
    fetchImprovedPrompt(rawText, currentTone);
  }

  // Open sidebar with slide-in animation
  function openSidebar() {
    if (sidebarEl) {
      sidebarEl.classList.add('open');
    }
  }

  // Close sidebar
  function closeSidebar() {
    if (sidebarEl) {
      sidebarEl.classList.remove('open');
    }
  }

  // Call backend API to fetch optimized prompt (delegated to background.js to bypass page CSP)
  function fetchImprovedPrompt(prompt, tone) {
    renderLoadingState();

    chrome.runtime.sendMessage({
      action: 'improvePrompt',
      prompt: prompt,
      tone: tone
    }, (response) => {
      // Check if connection is lost (happens when extension reloads but page isn't refreshed)
      if (chrome.runtime.lastError) {
        console.error('Runtime Error:', chrome.runtime.lastError);
        renderErrorState('Extension connection lost. Please refresh the page and try again.');
        return;
      }

      if (response && response.success) {
        renderSidebarData(response.data);
      } else {
        renderErrorState(response ? response.error : 'Unknown error occurred during prompt improvement.');
      }
    });
  }

  // Render the loading spinner view
  function renderLoadingState() {
    sidebarEl.innerHTML = `
      <div class="apg-header">
        <div class="apg-header-title">
          <span class="apg-logo-spark">✨</span>
          <h2 class="apg-title-text">Prompt Intelligence</h2>
        </div>
        <button class="apg-close-btn" id="apg-close-x">✕</button>
      </div>
      <div class="apg-loader-container">
        <div class="apg-spinner"></div>
        <div class="apg-loader-text">Analyzing & Enhancing...</div>
      </div>
    `;

    sidebarEl.querySelector('#apg-close-x').addEventListener('click', closeSidebar);
  }

  // Render the error view
  function renderErrorState(message) {
    chrome.storage.local.get(['backendUrl'], (result) => {
      const baseUrl = result.backendUrl || 'https://auto-prompt-generator-ds9jhmwfr.vercel.app';
      sidebarEl.innerHTML = `
        <div class="apg-header">
          <div class="apg-header-title">
            <span class="apg-logo-spark">✨</span>
            <h2 class="apg-title-text">Prompt Intelligence</h2>
          </div>
          <button class="apg-close-btn" id="apg-close-x">✕</button>
        </div>
        <div class="apg-error-container">
          <div class="apg-error-icon">⚠️</div>
          <h3 class="apg-error-title">Connection Failed</h3>
          <p class="apg-error-desc">${message || `Could not connect to the API server. Make sure your server is running on ${baseUrl}.`}</p>
          <button class="apg-btn apg-btn-primary" id="apg-retry-btn" style="margin-top: 10px;">Retry Connect</button>
        </div>
      `;

      sidebarEl.querySelector('#apg-close-x').addEventListener('click', closeSidebar);
      sidebarEl.querySelector('#apg-retry-btn').addEventListener('click', () => {
        fetchImprovedPrompt(lastRawPrompt, currentTone);
      });
    });
  }

  // Render the dashboard with Gemini-optimized prompt details
  function renderSidebarData(data) {
    const gapsHtml = data.gaps && data.gaps.length > 0 
      ? data.gaps.map(gap => `
          <div class="apg-gap-item">
            <span class="apg-gap-icon">✕</span>
            <span>${gap}</span>
          </div>
        `).join('')
      : `<div class="apg-gap-item" style="color: #10b981;">
          <span class="apg-gap-icon" style="color: #10b981;">✓</span>
          <span>No critical gaps detected! Perfect raw template.</span>
         </div>`;

    sidebarEl.innerHTML = `
      <div class="apg-header">
        <div class="apg-header-title">
          <span class="apg-logo-spark">✨</span>
          <h2 class="apg-title-text">Prompt Intelligence</h2>
        </div>
        <button class="apg-close-btn" id="apg-close-x">✕</button>
      </div>
      <div class="apg-body">
        
        <!-- Score and Category Badge -->
        <div class="apg-meta-row">
          <span class="apg-category-badge">${data.category || 'General'}</span>
          <div class="apg-score-container">
            <div class="apg-score-box before">
              <span class="apg-score-val">${data.score_before}/10</span>
              <span class="apg-score-label">Original</span>
            </div>
            <span class="apg-score-arrow">➔</span>
            <div class="apg-score-box after">
              <span class="apg-score-val">${data.score_after}/10</span>
              <span class="apg-score-label">Optimized</span>
            </div>
          </div>
        </div>

        <!-- Tone Selector Group -->
        <div class="apg-tone-selector">
          <div class="apg-tone-labels">
            <button class="apg-tone-btn ${data.tone === 'simple' ? 'active' : ''}" data-tone="simple">Simple</button>
            <button class="apg-tone-btn ${data.tone === 'advanced' ? 'active' : ''}" data-tone="advanced">Advanced</button>
            <button class="apg-tone-btn ${data.tone === 'expert' ? 'active' : ''}" data-tone="expert">Expert</button>
          </div>
          <input type="range" min="1" max="3" step="1" value="${data.tone === 'simple' ? 1 : data.tone === 'advanced' ? 2 : 3}" class="apg-slider" id="apg-tone-slider">
        </div>

        <!-- Gap Detection List -->
        <div>
          <h3 class="apg-section-title">Gaps Detected</h3>
          <div class="apg-gaps-list">
            ${gapsHtml}
          </div>
        </div>

        <!-- Why It's Better Explanation -->
        <div class="apg-explanation-card">
          <h3 class="apg-section-title" style="margin-bottom: 8px;">Analysis & Improvements</h3>
          <p class="apg-explanation-text">${data.explanation}</p>
        </div>

        <!-- Improved Output -->
        <div class="apg-output-container">
          <h3 class="apg-section-title" style="margin-bottom: 0;">Optimized Master Prompt</h3>
          <textarea class="apg-output-textarea" id="apg-output-text">${data.improved_prompt}</textarea>
        </div>

        <!-- Actions -->
        <div class="apg-actions">
          <button class="apg-btn apg-btn-secondary" id="apg-copy-btn">
            📋 Copy Prompt
          </button>
          <button class="apg-btn apg-btn-primary" id="apg-insert-btn">
            🚀 Replace & Insert
          </button>
        </div>

      </div>
    `;

    // Add event listeners for the rendered elements
    sidebarEl.querySelector('#apg-close-x').addEventListener('click', closeSidebar);

    // Copy to clipboard event
    const copyBtn = sidebarEl.querySelector('#apg-copy-btn');
    copyBtn.addEventListener('click', () => {
      const outputText = sidebarEl.querySelector('#apg-output-text').value;
      navigator.clipboard.writeText(outputText).then(() => {
        copyBtn.innerText = '✓ Copied!';
        setTimeout(() => {
          copyBtn.innerText = '📋 Copy Prompt';
        }, 1500);
      });
    });

    // Replace and Insert back into host page textarea
    const insertBtn = sidebarEl.querySelector('#apg-insert-btn');
    insertBtn.addEventListener('click', () => {
      const outputText = sidebarEl.querySelector('#apg-output-text').value;
      insertTextIntoChat(outputText);
      insertBtn.innerText = '✓ Inserted!';
      setTimeout(() => {
        closeSidebar();
        insertBtn.innerText = '🚀 Replace & Insert';
      }, 1000);
    });

    // Tone slider change handling
    const toneSlider = sidebarEl.querySelector('#apg-tone-slider');
    const toneBtns = sidebarEl.querySelectorAll('.apg-tone-btn');
    const tones = ['simple', 'advanced', 'expert'];

    function handleToneChange(newTone) {
      if (newTone !== currentTone) {
        currentTone = newTone;
        fetchImprovedPrompt(lastRawPrompt, currentTone);
      }
    }

    toneSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      const newTone = tones[val - 1];
      
      // Update active button UI immediately
      toneBtns.forEach((btn, idx) => {
        if (idx === val - 1) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    });

    toneSlider.addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      const newTone = tones[val - 1];
      handleToneChange(newTone);
    });

    toneBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newTone = btn.getAttribute('data-tone');
        handleToneChange(newTone);
      });
    });
  }

  // Inject text back into page inputs (supports Textarea and ContentEditable)
  function insertTextIntoChat(text) {
    if (!activeInputEl) return;

    activeInputEl.focus();

    if (activeInputEl.tagName === 'TEXTAREA' || activeInputEl.tagName === 'INPUT') {
      activeInputEl.value = text;
      // Dispatch standard DOM events so site code (React/Vue/etc.) notices the change
      activeInputEl.dispatchEvent(new Event('input', { bubbles: true }));
      activeInputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Contenteditable (like Claude or rich text inputs in ChatGPT/Gemini)
      // We use standard selection and document.execCommand to safely update the framework state
      try {
        // Select all text to overwrite it
        document.execCommand('selectAll', false, null);
        // Insert our optimized prompt text
        document.execCommand('insertText', false, text);
      } catch (err) {
        console.warn('execCommand failed, falling back to direct textContent assignment', err);
        activeInputEl.textContent = text;
        activeInputEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeInputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  // Start the extension logic
  init();
})();
