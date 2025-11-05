// This script runs in isolated world and listens for download trigger
console.log('  Mahe organizer Downloader');

// CRITICAL: Only run on actual Vimeo player pages
function isValidVimeoPlayer() {
  const isVimeoPlayerUrl = /player\.vimeo\.com\/video\/\d+/.test(window.location.href);

  if (!isVimeoPlayerUrl) {
    console.log('❗  Not a Vimeo player URL, skipping injection');
    return false;
  }

  if (document.querySelector('embed[type="application/pdf"]') ||
    document.querySelector('object[type="application/pdf"]') ||
    document.contentType === 'application/pdf') {
    console.log('   PDF viewer detected, skipping injection');
    return false;
  }

  if (window.location.href.includes('/embed/') &&
    !window.location.href.includes('player.vimeo.com')) {
    console.log('   Non-Vimeo embed detected, skipping');
    return false;
  }

  return true;
}

// Store validation result
const isValidContext = isValidVimeoPlayer();

if (!isValidContext) {
  console.log('  Validation failed: Not running in Vimeo player context');
} else {
  console.log('  Valid Vimeo player context detected');

  // Set up message relay from content.js to background.js
  setupMessageRelay();
}

// Message relay: Listen for messages from content.js (MAIN world)
function setupMessageRelay() {
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    // Relay messages from content.js to background.js
    if (event.data.type && event.data.type.startsWith('VIMEO_DOWNLOADER_')) {
      console.log('  Relaying to background:', event.data.type);

      chrome.runtime.sendMessage(event.data).catch(err => {
        console.error('Failed to relay message to background:', err);
      });
    }
  });
}

// Listen for trigger from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerDownload') {
    if (!isValidContext) {
      console.log('â Œ Cannot inject: Invalid context');
      sendResponse({ status: 'invalid_context', error: 'Not a Vimeo player page' });
      return true;
    }

    const hasPlayerElement = document.querySelector('div[data-player-id]') ||
      document.querySelector('.vp-player') ||
      document.querySelector('[data-vimeo-initialized]') ||
      document.querySelector('video');

    if (!hasPlayerElement) {
      console.log(' ¸  Warning: Vimeo player element not found yet');
    }

    console.log('ðŸ”¥ Download triggered from extension icon');

    // Get ALL settings (concurrency + folder structure)
    chrome.storage.local.get({
      videoConcurrency: 66,
      audioConcurrency: 66,
      semester: '',
      subject: '',
      additionalFolders: []
    }, (settings) => {
      // Get the status from injectMainScript
      const injectionStatus = injectMainScript(settings);

      // Send a response based on the injection status
      if (injectionStatus === 'already_injected') {
        sendResponse({ status: 'already_injected', context: 'vimeo_player' });
      } else {
        sendResponse({ status: injectionStatus, context: 'vimeo_player' });
      }
    });

    return true;
  }

  // Relay cancellation from background to content.js
  if (message.action === 'CANCEL_DOWNLOAD') {
    console.log('ðŸ“¥ Relaying cancellation to content.js:', message.sessionId);

    // Post message to window for content.js to receive
    window.postMessage({
      type: 'VIMEO_DOWNLOADER_CANCEL',
      sessionId: message.sessionId
    }, '*');

    sendResponse({ status: 'relayed' });
    return true;
  }

  return false;
});

// Auto-detect context
if (window.location.href.includes('player.vimeo.com')) {
  console.log('ðŸŽ¬ Vimeo player iframe detected - waiting for extension trigger');
}

function injectMainScript(settings) {
  if (window.__vimeoDownloaderInjected) {
    console.log('âš ï¸  Script already injected, skipping...');
    // --- MODIFICATION START ---
    return 'already_injected';
    // --- MODIFICATION END ---
  }
  window.__vimeoDownloaderInjected = true;

  // Inject script into MAIN world
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content.js');
  script.onload = function () {
    // ✅ Send settings AFTER script loads
    window.postMessage({
      type: 'VIMEO_DOWNLOADER_SETTINGS',
      settings: settings
    }, '*');
    console.log('✅ Main script injected and settings sent');
    this.remove();
  };
  script.onerror = function () {
    console.error('â Œ Failed to inject main script');
    window.__vimeoDownloaderInjected = false;
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  return 'injected';
}