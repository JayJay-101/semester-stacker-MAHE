// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

// Download state: Map<sessionId, DownloadState>
const downloadState = new Map();

// Download history (persisted to chrome.storage)
let downloadHistory = [];

// Promise that resolves when history is loaded from storage
let historyLoadedPromise = null;

// Broadcast interval ID
let broadcastIntervalId = null;

// State checksum for change detection
let lastStateChecksum = '';

// ============================================================================
// DOWNLOAD STATE SCHEMA
// ============================================================================
/*
DownloadState {
  sessionId: string,
  tabId: number,
  videoTitle: string,
  quality: string,
  status: 'initializing' | 'downloading' | 'completed' | 'cancelled' | 'error',
  startTime: number,
  endTime: number | null,
  
  video: {
    total: number | null,
    completed: number,
    lastUpdateTime: number,
    downloadRate: number (segments/sec, EWMA)
  },
  
  audio: {
    total: number | null,
    completed: number,
    lastUpdateTime: number,
    downloadRate: number (segments/sec, EWMA)
  },
  
  folder: {
    semester: string,
    subject: string,
    additionalFolders: string[]
  },
  
  ffmpegCommand: string | null,
  error: string | null
}
*/

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load download history on startup and wrap in a promise
historyLoadedPromise = new Promise((resolve) => {
  chrome.storage.local.get({ downloadHistory: [] }, (result) => {
    downloadHistory = result.downloadHistory || [];
    console.log('📚 Loaded download history:', downloadHistory.length, 'entries');
    resolve();
  });
});

// Start broadcast loop
startBroadcastLoop();

// ============================================================================
// POPUP-INITIATED DOWNLOAD HANDLER
// ============================================================================

// --- MODIFICATION START: This function is updated ---
async function handleTriggerDownloadFromPopup(tabId, sendResponse) {
  console.log('Triggering download for tab:', tabId);

  let frames;
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });
  } catch (e) {
    console.error("Failed to get frames:", e);
    sendResponse({ status: 'error', message: 'Could not get frames for tab.' });
    return;
  }

  if (!frames) {
    sendResponse({ status: 'error', message: 'Could not get frames for tab.' });
    return;
  }

  const frameResponses = frames.map(frame => {
    // Send message to a specific frame
    return chrome.tabs.sendMessage(tabId, { action: 'triggerDownload' }, { frameId: frame.frameId })
      .catch(err => ({ status: 'error', error: `Frame did not respond: ${err.message}` })); // Catch errors (e.g., frame not listening)
  });

  // Wait for all frames to reply
  const results = await Promise.allSettled(frameResponses);

  let injected = false;
  let alreadyInjected = false; // <-- ADDED THIS
  let validFramesFound = 0;
  let invalidFramesFound = 0;

  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      const response = result.value;

      if (response.status === 'injected') {
        injected = true;
        validFramesFound++;
      } else if (response.status === 'already_injected') { // <-- ADDED THIS CHECK
        alreadyInjected = true;
        validFramesFound++; // It's still a "valid" frame
      } else if (response.status === 'invalid_context') {
        invalidFramesFound++;
      }

    } else if (result.status === 'rejected') {
      console.warn('Frame message rejected:', result.reason);
    }
  });

  console.log(`Frame scan complete: ${validFramesFound} valid, ${invalidFramesFound} invalid. Injected: ${injected}, AlreadyInjected: ${alreadyInjected}`);

  // Updated logic block to prioritize 'injected' and 'already_injected'
  if (injected) {
    // Found at least one valid video player
    sendResponse({ status: 'triggered' });
    console.log(' Download trigger sent to valid frame(s).');
  } else if (alreadyInjected) { // <-- ADDED THIS BLOCK
    // A download is already running on this page
    sendResponse({ status: 'already_injected' });
    console.log(' Download already active on this page.');
  } else if (invalidFramesFound > 0 && validFramesFound === 0) {
    // We found frames, but none were valid video players (e.g., only PDF frames)
    sendResponse({ status: 'no_video_found', message: 'No valid video player found. Are you on a PDF page?' });
    console.log('⚠️ No valid video player found. Found invalid frames (PDFs?).');
  } else {
    // No frames responded at all or no frames with content scripts
    sendResponse({ status: 'no_frames', message: 'Could not find any content to download. Please refresh.' });
    console.log('❌ No frames responded to trigger.');
  }
}
// --- MODIFICATION END ---


// ============================================================================
// MESSAGE ROUTER
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📬 Received message:', message.type, 'from tab', sender.tab?.id);

  switch (message.type) {
    case 'DELETE_HISTORY_ENTRY':
      handleDeleteHistory(message, sendResponse);
      return true; // <-- MOVED HERE! This is the fix.
      
    case 'VIMEO_DOWNLOADER_START':
      handleDownloadStart(message, sender.tab?.id);
      break;

    case 'VIMEO_DOWNLOADER_SEGMENT_COUNT':
      handleSegmentCount(message);
      break;

    case 'VIMEO_DOWNLOADER_PROGRESS':
      handleProgress(message);
      break;

    case 'VIMEO_DOWNLOADER_COMPLETE':
      handleDownloadComplete(message);
      break;

    case 'VIMEO_DOWNLOADER_ERROR':
      handleDownloadError(message);
      break;

    // --- NEW HANDLER ---
    case 'VIMEO_DOWNLOADER_CANCELLED_CONFIRM':
      handleDownloadCancelledConfirm(message);
      break;
    // --- END NEW HANDLER ---

    case 'GET_ALL_DOWNLOADS':
      sendResponse({ downloads: getDownloadSnapshot() });
      return true;

    case 'CANCEL_DOWNLOAD':
      handleCancelDownload(message.sessionId);
      sendResponse({ status: 'cancelled' });
      return true;

    case 'triggerDownloadFromPopup':
      // MODIFICATION: Make this async and pass sendResponse
      handleTriggerDownloadFromPopup(message.tabId, sendResponse);
      return true; // Keep message channel open for async response

    case 'GET_DOWNLOAD_HISTORY':
      // Wait for history to be loaded from storage first
      historyLoadedPromise.then(() => {
        sendResponse({ history: downloadHistory });
      });
      return true; // Keep message channel open for async response

    case 'CLEAR_DOWNLOAD_HISTORY':
      // Wait for history to be loaded first
      historyLoadedPromise.then(() => {
        downloadHistory = [];
        chrome.storage.local.set({ downloadHistory: [] }, () => {
          sendResponse({ status: 'cleared' });
          broadcastHistoryUpdate(); // Broadcast the clear
        });
      });
      return true; // Keep message channel open for async response

    default:
      console.warn('Unknown message type:', message.type);
  }

  return false;
});

// ============================================================================
// DOWNLOAD LIFECYCLE HANDLERS
// ============================================================================
function handleDeleteHistory(message, sendResponse) {
  // The 'if' check is redundant since this is only called by the switch, but it's harmless
  if (message.type === 'DELETE_HISTORY_ENTRY') { 
    (async () => {
      try {
        const history = await getFromStorage('downloadHistory', []);
        // Filter out the item with the matching timestamp
        const newHistory = history.filter(entry => entry.timestamp !== message.timestamp);
        
        // Update the in-memory history
        downloadHistory = newHistory; 
        
        // Save the new, filtered history
        await saveToStorage('downloadHistory', newHistory);
        
        // Send a success response back to popup.js
        sendResponse({ status: 'deleted' });
        
        // Also, update all popups with the new history state
        broadcastHistoryUpdate(); // Use the dedicated history broadcast
        
      } catch (e) {
        console.error('Error deleting history entry:', e);
        // Send an error response back to popup.js
        sendResponse({ status: 'error', message: e.message });
      }
    })();
    // --- 'return true;' WAS REMOVED FROM HERE ---
  }
}
async function getFromStorage(key, defaultValue) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] || defaultValue);
    });
  });
}

async function saveToStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}
function handleDownloadStart(message, tabId) {
  const { sessionId, data } = message;

  const state = {
    sessionId,
    tabId,
    videoTitle: data.videoTitle,
    quality: data.quality,
    status: 'initializing',
    startTime: data.startTime,
    endTime: null,

    video: {
      total: null,
      completed: 0,
      lastUpdateTime: Date.now(),
      downloadRate: 0
    },

    audio: {
      total: null,
      completed: 0,
      lastUpdateTime: Date.now(),
      downloadRate: 0
    },

    folder: data.folder || { semester: '', subject: '', additionalFolders: [] },
    ffmpegCommand: null,
    error: null
  };

  downloadState.set(sessionId, state);
  console.log('🚀 Download started:', sessionId, state.videoTitle);

  updateBadge();
}

function handleSegmentCount(message) {
  const { sessionId, data } = message;
  const state = downloadState.get(sessionId);

  if (!state) {
    console.warn('Session not found:', sessionId);
    return;
  }

  const streamType = data.streamType; // 'video' or 'audio'
  state[streamType].total = data.total;
  state.status = 'downloading';

  console.log(`📊 ${streamType} segments:`, data.total, 'for', state.videoTitle);
}

function handleProgress(message) {
  const { sessionId, data } = message;
  const state = downloadState.get(sessionId);

  if (!state) return;

  const streamType = data.streamType;
  const stream = state[streamType];
  const now = data.timestamp || Date.now();

  // Calculate download rate (EWMA with alpha=0.3)
  const timeDelta = (now - stream.lastUpdateTime) / 1000; // seconds
  const segmentsDelta = data.completed - stream.completed;

  if (timeDelta > 0 && segmentsDelta > 0) {
    const instantRate = segmentsDelta / timeDelta;
    stream.downloadRate = stream.downloadRate === 0
      ? instantRate
      : 0.3 * instantRate + 0.7 * stream.downloadRate;
  }

  stream.completed = data.completed;
  stream.lastUpdateTime = now;

  // Update status
  if (state.status === 'initializing') {
    state.status = 'downloading';
  }
}

function handleDownloadComplete(message) {
  const { sessionId, data } = message;
  const state = downloadState.get(sessionId);

  if (!state) return;

  state.status = 'completed';
  state.endTime = Date.now();
  state.ffmpegCommand = data.ffmpegCommand;

  console.log(' Download completed:', state.videoTitle);

  // Generate exact folder path at download completion time
  const folderPath = generateFolderPath(state.folder);
  const filePrefix = generateFilePrefix(state.folder);

  // Add to history with EXACT folder settings used at download time
  addToHistory({
    timestamp: state.endTime,
    filename: state.videoTitle,
    semester: state.folder.semester,
    subject: state.folder.subject,
    additionalFolders: state.folder.additionalFolders || [],
    quality: state.quality,
    ffmpegCommand: data.ffmpegCommand,
    status: 'completed',
    folderPath: folderPath,
    filePrefix: filePrefix
  });

  updateBadge();

  // Remove from active state after a delay and broadcast history update
  broadcastHistoryUpdate();
  // Keep the completed item in the active list for 10 seconds
  setTimeout(() => {
    downloadState.delete(sessionId);
  }, 10000);
}

function handleDownloadError(message) {
  const { sessionId, data } = message;
  const state = downloadState.get(sessionId);

  if (!state) return;

  state.status = 'error';
  state.endTime = Date.now();
  state.error = data.error;

  console.error('❌ Download error:', state.videoTitle, data.error);

  // Add to history
  addToHistory({
    timestamp: state.endTime,
    filename: state.videoTitle,
    semester: state.folder.semester,
    subject: state.folder.subject,
    additionalFolders: state.folder.additionalFolders || [],
    quality: state.quality,
    error: data.error,
    status: 'error'
  });

  updateBadge();

  // Remove from active state after a delay and broadcast history update
  broadcastHistoryUpdate();
  // Keep the error item in the active list for 10 seconds
  setTimeout(() => {
    downloadState.delete(sessionId);
  }, 10000);
  // ----- MODIFICATION END -----
}

// --- MODIFICATION: This function now REQUESTS a cancel, not finalizes it ---
function handleCancelDownload(sessionId) {
  const state = downloadState.get(sessionId);

  if (!state) {
    console.warn('Cannot cancel: session not found', sessionId);
    return;
  }

  // Guard against multiple clicks or cancelling a finished download
  if (state.status !== 'downloading' && state.status !== 'initializing') {
    console.warn('Cannot cancel: download is not in a cancellable state', state.status);
    return;
  }

  state.status = 'cancelling'; // New temporary state

  console.log('🚫 Sending cancellation request for:', state.videoTitle);

  // Send cancellation to the content script via injector
  chrome.tabs.sendMessage(state.tabId, {
    action: 'CANCEL_DOWNLOAD',
    sessionId: sessionId
  }).catch(err => {
    console.warn('Could not send cancel message to tab:', err);
    // If message fails, force-cancel from here
    handleDownloadError({ sessionId, data: { error: "Failed to send cancel signal." } });
  });

  updateBadge();
  // DO NOT add to history here.
  // DO NOT broadcast history update here.
  // DO NOT set a timeout to delete. Wait for content.js to confirm.
}

// --- NEW FUNCTION: Handles the confirmation from content.js ---
function handleDownloadCancelledConfirm(message) {
  const { sessionId, data } = message;
  const state = downloadState.get(sessionId);

  if (!state) return;

  // Prevent duplicate history entries
  if (state.status === 'cancelled') return;

  state.status = 'cancelled';
  state.endTime = Date.now();
  state.error = data.message || 'Cancelled by user.';

  console.log(' Cancellation confirmed by content script:', state.videoTitle);

  // Add to history
  addToHistory({
    timestamp: state.endTime,
    filename: state.videoTitle,
    semester: state.folder.semester,
    subject: state.folder.subject,
    additionalFolders: state.folder.additionalFolders || [],
    quality: state.quality,
    status: 'cancelled'
  });

  updateBadge();

  broadcastHistoryUpdate();

  // Remove from active state after delay
  setTimeout(() => {
    downloadState.delete(sessionId);
  }, 10000);
}


// ============================================================================
// BROADCAST SYSTEM
// ============================================================================

function startBroadcastLoop() {
  if (broadcastIntervalId) return;

  broadcastIntervalId = setInterval(() => {
    const snapshot = getDownloadSnapshot();
    const checksum = JSON.stringify(snapshot);

    // Only broadcast if state changed
    if (checksum !== lastStateChecksum) {
      lastStateChecksum = checksum;
      broadcastStateUpdate(snapshot);
    }
  }, 1000);

  console.log('📡 Broadcast loop started');
}

// This sends to all extension parts, including the popup
function broadcastStateUpdate(snapshot) {
  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_STATE_UPDATE',
    downloads: snapshot
  }).catch((error) => {
    // This error is expected if the popup isn't open.
    // We can safely ignore the "receiving end does not exist" error.
    if (error.message.includes("receiving end does not exist")) {
      // Popup is closed, this is fine.
    } else {
      console.warn("Extension broadcast error:", error.message);
    }
  });
}

function getDownloadSnapshot() {
  const downloads = [];

  for (const [sessionId, state] of downloadState.entries()) {
    const videoTotal = state.video.total || 0;
    const audioTotal = state.audio.total || 0;
    const videoCompleted = state.video.completed;
    const audioCompleted = state.audio.completed;

    const totalSegments = videoTotal + audioTotal;
    const completedSegments = videoCompleted + audioCompleted;

    const overallProgress = totalSegments > 0
      ? (completedSegments / totalSegments) * 100
      : 0;

    // Calculate ETA
    const eta = calculateETA(state);

    downloads.push({
      sessionId,
      tabId: state.tabId,
      videoTitle: state.videoTitle,
      quality: state.quality,
      status: state.status,

      overallProgress: Math.round(overallProgress * 10) / 10,

      video: {
        completed: videoCompleted,
        total: videoTotal,
        progress: videoTotal > 0 ? Math.round((videoCompleted / videoTotal) * 100) : 0
      },

      audio: {
        completed: audioCompleted,
        total: audioTotal,
        progress: audioTotal > 0 ? Math.round((audioCompleted / audioTotal) * 100) : 0
      },

      eta,
      startTime: state.startTime,
      error: state.error
    });
  }

  return downloads;
}

function calculateETA(state) {
  if (state.status !== 'downloading') return null;

  const videoRemaining = (state.video.total || 0) - state.video.completed;
  const audioRemaining = (state.audio.total || 0) - state.audio.completed;

  const videoRate = state.video.downloadRate;
  const audioRate = state.audio.downloadRate;

  if (videoRate === 0 && audioRate === 0) return null;

  // Time remaining for each stream
  const videoTime = videoRate > 0 ? videoRemaining / videoRate : 0;
  const audioTime = audioRate > 0 ? audioRemaining / audioRate : 0;

  // Since they download concurrently, ETA is the maximum
  const etaSeconds = Math.max(videoTime, audioTime);

  return formatETA(etaSeconds);
}

function formatETA(seconds) {
  if (!seconds || seconds <= 0) return null;

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// ADDED new broadcast function for history updates
function broadcastHistoryUpdate() {
  // Wait for history promise to resolve before broadcasting
  // This ensures we don't broadcast an un-initialized history array
  historyLoadedPromise.then(() => {
    chrome.runtime.sendMessage({
      type: 'HISTORY_STATE_UPDATE',
      history: downloadHistory
    }).catch((error) => {
      // This error is expected if the popup isn't open.
      if (!error.message.includes("receiving end does not exist")) {
        console.warn("Extension history broadcast error:", error.message);
      }
    });
  });
}

// ============================================================================
// BADGE MANAGEMENT
// ============================================================================

function updateBadge() {
  const activeCount = Array.from(downloadState.values())
    .filter(s => s.status === 'downloading' || s.status === 'initializing' || s.status === 'cancelling') // --- ADDED 'cancelling'
    .length;

  if (activeCount > 0) {
    chrome.action.setBadgeText({ text: String(activeCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#c5221f' }); // Use accent color
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ============================================================================
// DOWNLOAD HISTORY
// ============================================================================

function addToHistory(entry) {
  // This function might be called before history is loaded.
  // We chain it to the promise to be safe.
  historyLoadedPromise.then(() => {
    // Add to front of array
    downloadHistory.unshift(entry);

    // Keep only last 50 entries
    if (downloadHistory.length > 50) {
      downloadHistory = downloadHistory.slice(0, 50);
    }
    
    // Update the in-memory history variable
    // (This line was implicitly done by the unshift/slice, but good to be clear)
    // downloadHistory = downloadHistory; 

    // Persist to storage
    chrome.storage.local.set({ downloadHistory });
  });
}

// ============================================================================
// HELPER FUNCTIONS - FOLDER PATH GENERATION
// ============================================================================

// Generate exact folder path from folder settings
function generateFolderPath(folderSettings) {
  let path = 'LMS';
  if (folderSettings.semester) {
    path += '/' + sanitizeFilename(folderSettings.semester);
  }
  if (folderSettings.subject) {
    path += '/' + sanitizeFilename(folderSettings.subject);
  }
  if (folderSettings.additionalFolders && folderSettings.additionalFolders.length > 0) {
    folderSettings.additionalFolders.forEach(folder => {
      if (folder) {
        path += '/' + sanitizeFilename(folder);
      }
    });
  }
  return path;
}

// Generate exact file prefix from folder settings
function generateFilePrefix(folderSettings) {
  let prefix = '';
  if (folderSettings.semester) {
    prefix += sanitizeFilename(folderSettings.semester) + '_';
  }
  if (folderSettings.subject) {
    prefix += sanitizeFilename(folderSettings.subject) + '_';
  }
  if (folderSettings.additionalFolders && folderSettings.additionalFolders.length > 0) {
    folderSettings.additionalFolders.forEach(folder => {
      if (folder) {
        prefix += sanitizeFilename(folder) + '_';
      }
    });
  }
  return prefix;
}

// Sanitize filename
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// ============================================================================
// CLEANUP ON EXTENSION UNLOAD
// ============================================================================

chrome.runtime.onSuspend.addListener(() => {
  if (broadcastIntervalId) {
    clearInterval(broadcastIntervalId);
  }
  console.log('🛑 Background script suspending');
});
