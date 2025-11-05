// ============================================================================
// THEME TOGGLE
// ============================================================================
// ============================================================================
// THEME TOGGLE
// ============================================================================

const themeToggle = document.getElementById('themeToggle');

function loadTheme() {
  // 1. Use chrome.storage.local (the correct API for extensions)
  chrome.storage.local.get(['theme'], (result) => {

    // 2. Check if the user has explicitly saved 'light'
    if (result.theme === 'light') {
      document.body.classList.remove('dark-mode');
      themeToggle.textContent = '🌙 Dark';
    } else {
      // 3. If theme is 'dark' OR 'undefined' (new install),
      //    default to showing dark mode.
      document.body.classList.add('dark-mode');
      themeToggle.textContent = '☀️ Light';
    }
    // We do NOT save any default here, respecting the user's first choice.
  });
}

function toggleTheme() {
  // Toggle the class on the body
  const isDark = document.body.classList.toggle('dark-mode');

  // Determine the new theme name
  const newTheme = isDark ? 'dark' : 'light';

  // Save the user's choice to storage
  chrome.storage.local.set({ theme: newTheme });

  // Update the button text
  themeToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
}

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const infoBtn = document.getElementById('infoBtn');
const infoPanel = document.getElementById('infoPanel');

const configBtn = document.getElementById('configBtn');
const configPanel = document.getElementById('configPanel');
const concurrencySlider = document.getElementById('concurrencySlider');
const concurrencyValue = document.getElementById('concurrencyValue');

const folderSettingsToggle = document.getElementById('folderSettingsToggle');
const folderSettingsContent = document.getElementById('folderSettingsContent');

const semesterInput = document.getElementById('semester');
const subjectInput = document.getElementById('subject');
const semesterSaved = document.getElementById('semesterSaved');
const subjectSaved = document.getElementById('subjectSaved');

const additionalFoldersContainer = document.getElementById('additionalFoldersContainer');
const addFolderBtn = document.getElementById('addFolderBtn');

const downloadBtn = document.getElementById('downloadBtn');
const pageStatus = document.getElementById('pageStatus');

const activeDownloadsSection = document.getElementById('activeDownloadsSection');
const downloadsList = document.getElementById('downloadsList');

const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const copyAllHistoryBtn = document.getElementById('copyAllHistoryBtn');

// Global toggle buttons
const globalRmToggle = document.getElementById('globalRmToggle');
const globalOsLinux = document.getElementById('globalOsLinux');
const globalOsWindows = document.getElementById('globalOsWindows');

// --- NEW --- Inline Confirm Elements
const commandOptions = document.getElementById('commandOptions');
const historyButtonsContainer = document.getElementById('historyButtonsContainer');
const clearHistoryConfirm = document.getElementById('clearHistoryConfirm');
const confirmClearHistoryBtn = document.getElementById('confirmClearHistoryBtn');
const cancelClearHistoryBtn = document.getElementById('cancelClearHistoryBtn');
// --- END NEW ---

// Concurrency settings elements
const concurrencyToggle = document.getElementById('concurrencyToggle');
const concurrencyContent = document.getElementById('concurrencyContent');
const videoConcurrencyInput = document.getElementById('videoConcurrency');
const audioConcurrencyInput = document.getElementById('audioConcurrency');
const concurrencyBtns = document.querySelectorAll('.concurrency-btn');


// ============================================================================
// STATE
// ============================================================================

let currentTab = null;
let saveTimeout = null;
let additionalFolders = [];

let globalSettings = {
  rm: false,
  os: 'linux'
};

let concurrencySettings = {
  videoConcurrency: 66,
  audioConcurrency: 66
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Popup loaded - Checking DOM elements...');
  
  if (!concurrencySlider) {
    console.error('❌ concurrencySlider NOT FOUND in DOM');
  } else {
    console.log('✅ concurrencySlider found:', concurrencySlider);
  }
  
  if (!concurrencyValue) {
    console.error('❌ concurrencyValue NOT FOUND in DOM');
  } else {
    console.log('✅ concurrencyValue found:', concurrencyValue);
  }
  
  if (!configBtn) {
    console.error('❌ configBtn NOT FOUND in DOM');
  } else {
    console.log('✅ configBtn found:', configBtn);
  }
  
  if (!configPanel) {
    console.error('❌ configPanel NOT FOUND in DOM');
  } else {
    console.log('✅ configPanel found:', configPanel);
  }
  
  loadTheme();
  loadFolderSettingsState();
  loadFolderSettings();
  loadAdditionalFolders();
  loadGlobalSettings();
  loadConcurrencySettings();
  // loadConcurrencySettingsState(); // REMOVED - not needed, concurrency uses slider now
  if (concurrencySlider) {
    loadConcurrencyValue();
  }
  await checkCurrentTab();
  await loadActiveDownloads();
  await loadDownloadHistory();
  setupEventListeners();
  listenForDownloadUpdates();
  setupHelpButtons();
  
  console.log('✅ All initialization complete');
});

// ============================================================================
// FOLDER SETTINGS
// ============================================================================

function loadFolderSettingsState() {
  chrome.storage.local.get({ folderSettingsCollapsed: false }, (items) => {
    if (items.folderSettingsCollapsed) {
      folderSettingsContent.classList.add('collapsed');
      folderSettingsToggle.textContent = '►';
    } else {
      folderSettingsContent.classList.remove('collapsed');
      folderSettingsToggle.textContent = '▼';
    }
  });
}

function toggleFolderSettings() {
  const isCollapsed = folderSettingsContent.classList.toggle('collapsed');
  folderSettingsToggle.textContent = isCollapsed ? '►' : '▼';
  chrome.storage.local.set({ folderSettingsCollapsed: isCollapsed });
}

function loadFolderSettings() {
  chrome.storage.local.get({
    semester: '',
    subject: ''
  }, (items) => {
    semesterInput.value = items.semester;
    subjectInput.value = items.subject;
  });
}

function saveFolderSettings() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const settings = {
      semester: semesterInput.value.trim(),
      subject: subjectInput.value.trim()
    };
    chrome.storage.local.set(settings, () => {
      showSavedIndicator();
    });
  }, 500);
}

function showSavedIndicator() {
  semesterSaved.classList.add('show');
  subjectSaved.classList.add('show');
  setTimeout(() => {
    semesterSaved.classList.remove('show');
    subjectSaved.classList.remove('show');
  }, 2000);
}

// ============================================================================
// DYNAMIC FOLDERS
// ============================================================================

function loadAdditionalFolders() {
  chrome.storage.local.get({ additionalFolders: [] }, (items) => {
    additionalFolders = items.additionalFolders || [];
    renderAdditionalFolders();
  });
}

function renderAdditionalFolders() {
  additionalFoldersContainer.innerHTML = '';

  additionalFolders.forEach((folder, index) => {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'input-group';
    folderDiv.style.marginTop = '12px';
    folderDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="flex: 1;">
          <label>Folder ${index + 1}</label>
          <input type="text" 
                 class="additional-folder-input" 
                 data-index="${index}" 
                 value="${escapeHtml(folder)}" 
                 placeholder="e.g., Week_1">
        </div>
        <button class="remove-folder-btn" 
                data-index="${index}" 
                style="padding: 8px 12px; background: #d93025; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 18px;">
          ➖
        </button>
      </div>
    `;
    additionalFoldersContainer.appendChild(folderDiv);
  });

  document.querySelectorAll('.additional-folder-input').forEach(input => {
    input.addEventListener('input', handleFolderInputChange);
    input.addEventListener('blur', handleFolderInputChange);
  });

  document.querySelectorAll('.remove-folder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'));
      removeFolder(index);
    });
  });

  addFolderBtn.disabled = additionalFolders.length >= 9;
  addFolderBtn.style.opacity = additionalFolders.length >= 9 ? '0.5' : '1';
  addFolderBtn.style.cursor = additionalFolders.length >= 9 ? 'not-allowed' : 'pointer';
}

function addFolder() {
  if (additionalFolders.length >= 9) return;
  additionalFolders.push('');
  saveAdditionalFolders();
  renderAdditionalFolders();
}

function removeFolder(index) {
  additionalFolders.splice(index, 1);
  saveAdditionalFolders();
  renderAdditionalFolders();
}

function handleFolderInputChange(event) {
  const index = parseInt(event.target.getAttribute('data-index'));
  const value = event.target.value.trim();
  additionalFolders[index] = value;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveAdditionalFolders();
  }, 500);
}

function saveAdditionalFolders() {
  chrome.storage.local.set({ additionalFolders }, () => {
    console.log('Additional folders saved');
  });
}

// ============================================================================
// CURRENT TAB DETECTION
// ============================================================================

async function checkCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      currentTab = tabs[0];

      if (!currentTab || !currentTab.url) {
        downloadBtn.disabled = true;
        pageStatus.textContent = '⚠️ Cannot detect current page';
        pageStatus.classList.add('error');
        resolve();
        return;
      }

      // --- MODIFICATION START ---
      // Changed this check to be more specific as requested
      const isLMSPage = currentTab.url.includes('learner-mahe.onlinemanipal.com/d2l/');
      // --- MODIFICATION END ---

      downloadBtn.disabled = !isLMSPage;

      if (isLMSPage) {
        pageStatus.textContent = '✔️ LMS page detected. Click to find video.';
        pageStatus.classList.remove('error');
      } else {
        pageStatus.textContent = '⚠️ Navigate to an LMS page first';
        pageStatus.classList.add('error');
      }

      resolve();
    });
  });
}

// ============================================================================
// DOWNLOAD TRIGGER
// ============================================================================

function setupHelpButtons() {
  // "Full Guide" button
  const openFullGuideBtn = document.getElementById('openFullGuideBtn');
  if (openFullGuideBtn) {
    openFullGuideBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://forestily.com/lms-downloader/how-it-works.html' });
    });
  }

  // "Download FFmpeg" button
  const openFFmpegBtn = document.getElementById('openFFmpegBtn');
  if (openFFmpegBtn) {
    openFFmpegBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://ffmpeg.org/download.html'
      });
    });
  }
}

function triggerDownload() {
  if (!currentTab) {
    console.error('Cannot detect current tab. Please try again.');
    pageStatus.textContent = '❌ Cannot detect current tab.';
    pageStatus.classList.add('error');
    return;
  }

  // Show loading state
  downloadBtn.disabled = true;
  pageStatus.textContent = '🔎 Searching for video...';
  pageStatus.classList.remove('error', 'success');

  chrome.runtime.sendMessage({
    type: 'triggerDownloadFromPopup',
    tabId: currentTab.id
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to trigger download:', chrome.runtime.lastError);
      pageStatus.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
      pageStatus.classList.add('error');
      downloadBtn.disabled = false; // Re-enable on error
      return;
    }

    // Handle detailed responses from background.js
    if (response) {
      switch (response.status) {
        case 'triggered':
          pageStatus.textContent = '🚀 Download started!';
          pageStatus.classList.add('success');
          pageStatus.classList.remove('error');

          document.getElementById('activeDownloadsSection').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          setTimeout(() => {
            loadActiveDownloads();
          }, 1000);
          break;

        // --- 👇 NEW CODE BLOCK TO ADD ---
        case 'already_injected':
          pageStatus.textContent = ' seems like Download already Done, Manually referesh the tab please';
          pageStatus.classList.add('success');
          pageStatus.classList.remove('error');
          // Keep the button disabled, as the download is active or complete
          downloadBtn.disabled = true;
          break;
        // --- 👆 END OF NEW CODE BLOCK ---

        case 'no_video_found':
          pageStatus.textContent = '⚠️ No video found. Please open the video player page, not a PDF.';
          pageStatus.classList.add('error');
          downloadBtn.disabled = false; // Re-enable
          break;

        case 'no_frames':
          pageStatus.textContent = '⚠️ Could not find content. Please refresh the page.';
          pageStatus.classList.add('error');
          downloadBtn.disabled = false; // Re-enable
          break;

        case 'error':
        default:
          pageStatus.textContent = `❌ Error: ${response.message || 'Unknown error'}`;
          pageStatus.classList.add('error');
          downloadBtn.disabled = false; // Re-enable
          break;
      }
    } else {
      pageStatus.textContent = '❌ Unknown error. No response from extension.';
      pageStatus.classList.add('error');
      downloadBtn.disabled = false; // Re-enable
    }
  });
}
// ============================================================================
// ACTIVE DOWNLOADS
// ============================================================================

async function loadActiveDownloads() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_ALL_DOWNLOADS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.warn('Error loading active downloads:', chrome.runtime.lastError);
        resolve();
        return;
      }
      renderActiveDownloads(response.downloads || []);
      resolve();
    });
  });
}

// --- MODIFICATION START ---
// Replaced the entire renderActiveDownloads function with this optimized version
// to prevent UI jitter.
function renderActiveDownloads(downloads) {
  if (!downloadsList) return; // Guard clause

  // 1. Handle Empty State
  if (!downloads || downloads.length === 0) {
    downloadsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div>No active downloads</div>
      </div>
    `;
    return;
  }

  // 1b. Clear empty state if it's there and we have downloads
  const emptyState = downloadsList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const existingIds = new Set();

  // 2. Update existing items and add new ones
  downloads.forEach(download => {
    existingIds.add(download.sessionId);
    let item = downloadsList.querySelector(`.download-item[data-session-id="${download.sessionId}"]`);

    if (item) {
      // --- ITEM EXISTS, JUST UPDATE IT ---
      // This is the optimization to prevent jitter.

      // Update Status
      const statusBadge = item.querySelector('.status-badge');
      if (statusBadge && statusBadge.textContent !== download.status) {
        statusBadge.textContent = download.status;
        statusBadge.className = 'status-badge'; // Reset classes
        if (download.status === 'completed') statusBadge.classList.add('completed');
        if (download.status === 'error') statusBadge.classList.add('error');
        if (download.status === 'cancelled') statusBadge.classList.add('cancelled');
      }

      // Update Video Progress
      const videoProgress = item.querySelector('.video-progress-container');
      if (videoProgress && download.status === 'downloading' && download.video.total > 0) {
        const videoFill = videoProgress.querySelector('.progress-fill');
        const videoText = videoProgress.querySelector('.progress-label span:last-child');
        // Check if update is needed to avoid unnecessary DOM writes
        if (videoFill && videoFill.style.width !== `${download.video.progress}%`) {
          videoFill.style.width = `${download.video.progress}%`;
        }
        const newVideoText = `${download.video.completed}/${download.video.total} (${download.video.progress}%)`;
        if (videoText && videoText.textContent !== newVideoText) {
          videoText.textContent = newVideoText;
        }
      } else if (videoProgress && download.status !== 'downloading') {
        videoProgress.remove(); // Remove progress if status is no longer downloading
      }

      // Update Audio Progress
      const audioProgress = item.querySelector('.audio-progress-container');
      if (audioProgress && download.status === 'downloading' && download.audio.total > 0) {
        const audioFill = audioProgress.querySelector('.progress-fill');
        const audioText = audioProgress.querySelector('.progress-label span:last-child');
        if (audioFill && audioFill.style.width !== `${download.audio.progress}%`) {
          audioFill.style.width = `${download.audio.progress}%`;
        }
        const newAudioText = `${download.audio.completed}/${download.audio.total} (${download.audio.progress}%)`;
        if (audioText && audioText.textContent !== newAudioText) {
          audioText.textContent = newAudioText;
        }
      } else if (audioProgress && download.status !== 'downloading') {
        audioProgress.remove(); // Remove progress if status is no longer downloading
      }

      // Update ETA
      const etaEl = item.querySelector('.eta');
      const newEtaText = `⏳ ETA: ${download.eta}`;
      if (download.status === 'downloading' && download.eta) {
        if (etaEl) {
          if (etaEl.textContent !== newEtaText) {
            etaEl.textContent = newEtaText;
          }
        } else {
          const newEta = document.createElement('div');
          newEta.className = 'eta';
          newEta.textContent = newEtaText;
          item.appendChild(newEta);
        }
      } else if (etaEl) {
        etaEl.remove(); // Remove ETA if not downloading
      }

      // Update Error
      const errorEl = item.querySelector('.download-error');
      if (download.error) {
        const newErrorText = `❌ ${escapeHtml(download.error)}`;
        if (errorEl) {
          if (errorEl.textContent !== newErrorText) {
            errorEl.textContent = newErrorText;
          }
        } else {
          const newError = document.createElement('div');
          newError.className = 'download-meta download-error';
          newError.style.color = '#d93025';
          newError.style.marginTop = '4px';
          newError.textContent = newErrorText;
          item.appendChild(newError);
        }
      } else if (errorEl) {
        errorEl.remove();
      }

      // Update Completed Message
      const completedEl = item.querySelector('.download-completed');
      if (download.status === 'completed') {
        if (!completedEl) {
          const newCompleted = document.createElement('div');
          newCompleted.className = 'download-meta download-completed';
          newCompleted.style.color = 'var(--green)';
          newCompleted.style.marginTop = '4px';
          newCompleted.textContent = ` Completed. Will move to history shortly.`;
          item.appendChild(newCompleted);
        }
      } else if (completedEl) {
        completedEl.remove();
      }

      // Update Cancel Button
      const cancelBtn = item.querySelector('.cancel-btn');
      if (download.status === 'downloading' && !cancelBtn) {
        const newCancelBtn = document.createElement('button');
        newCancelBtn.className = 'cancel-btn';
        newCancelBtn.dataset.sessionId = download.sessionId;
        newCancelBtn.textContent = 'Cancel';
        newCancelBtn.addEventListener('click', () => cancelDownload(download.sessionId));
        item.querySelector('.download-header').appendChild(newCancelBtn);
      } else if (download.status !== 'downloading' && cancelBtn) {
        cancelBtn.remove();
      }

    } else {
      // --- ITEM DOESN'T EXIST, CREATE AND APPEND IT ---
      const newItem = document.createElement('div');
      newItem.className = 'download-item';
      newItem.dataset.sessionId = download.sessionId;

      let statusClass = 'status-badge';
      if (download.status === 'completed') statusClass = 'status-badge completed';
      if (download.status === 'error') statusClass = 'status-badge error';
      if (download.status === 'cancelled') statusClass = 'status-badge cancelled';

      // Added specific classes like 'video-progress-container'
      newItem.innerHTML = `
        <div class="download-header">
          <div class="download-title">${escapeHtml(download.videoTitle)}</div>
          ${download.status === 'downloading' ? `
            <button class="cancel-btn" data-session-id="${download.sessionId}">Cancel</button>
          ` : ''}
        </div>
        
        <div class="download-meta">
          ${download.quality} | <span class="${statusClass}" style="display: inline-block; padding: 2px 4px; border-radius: 3px;">${download.status}</span>
        </div>
        
        ${(download.status === 'downloading' && download.video.total > 0) ? `
          <div class="progress-container video-progress-container">
            <div class="progress-label">
              <span>Video</span>
              <span>${download.video.completed}/${download.video.total} (${download.video.progress}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${download.video.progress}%"></div>
            </div>
          </div>
        ` : ''}
        
        ${(download.status === 'downloading' && download.audio.total > 0) ? `
          <div class="progress-container audio-progress-container">
            <div class="progress-label">
              <span>Audio</span>
              <span>${download.audio.completed}/${download.audio.total} (${download.audio.progress}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${download.audio.progress}%"></div>
            </div>
          </div>
        ` : ''}
        
        ${(download.status === 'downloading' && download.eta) ? `
          <div class="eta">⏳ ETA: ${download.eta}</div>
        ` : ''}
        
        ${download.status === 'completed' ? `
          <div class="download-meta download-completed" style="color: var(--green); margin-top: 4px;">
             Completed. Will move to history shortly.
          </div>
        ` : ''}

        ${download.error ? `
          <div class="download-meta download-error" style="color: #d93025; margin-top: 4px;">
            ❌ ${escapeHtml(download.error)}
          </div>
        ` : ''}
      `;

      // Add cancel button listener for new item
      const cancelBtn = newItem.querySelector('.cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          cancelDownload(download.sessionId);
        });
      }

      downloadsList.appendChild(newItem);
    }
  });

  // 3. Remove items that are no longer in the active list
  downloadsList.querySelectorAll('.download-item').forEach(item => {
    const sessionId = item.dataset.sessionId;
    if (!existingIds.has(sessionId)) {
      item.remove();
    }
  });
}
// --- MODIFICATION END ---


function cancelDownload(sessionId) {
  chrome.runtime.sendMessage({
    type: 'CANCEL_DOWNLOAD',
    sessionId: sessionId
  }, (response) => {
    if (response && response.status === 'cancelled') {
      console.log('Download cancelled:', sessionId);
    }
  });
}

// ============================================================================
// DOWNLOAD HISTORY
// ============================================================================

async function loadDownloadHistory() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_DOWNLOAD_HISTORY' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.warn('Error loading download history:', chrome.runtime.lastError);
        resolve();
        return;
      }
      renderDownloadHistory(response.history || []);
      resolve();
    });
  });
}

function renderDownloadHistory(history) {
  if (!history || history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <div>No download history</div>
      </div>
    `;
    clearHistoryBtn.style.display = 'none';
    copyAllHistoryBtn.style.display = 'none';
    return;
  }

  clearHistoryBtn.style.display = 'inline-flex';
  copyAllHistoryBtn.style.display = 'inline-flex';

  // --- MODIFICATION ---
  // No longer slice. We want to show all history if we are deleting.
  // const recentHistory = history.slice(0, 20); 
  // --- END MODIFICATION ---


  historyList.innerHTML = history.map(entry => { // Use 'history' directly
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const folderParts = [entry.semester, entry.subject];
    if (entry.additionalFolders && entry.additionalFolders.length > 0) {
      folderParts.push(...entry.additionalFolders);
    }
    const folder = folderParts.filter(Boolean).join(' / ') || 'LMS';

    const entryJson = escapeHtml(JSON.stringify(entry));

    return `
      <!-- MODIFIED: Added data-entry-json to the item -->
      <div class="history-item" data-entry-json='${entryJson}'>
      
        <!-- NEW: Delete Button -->
        <button class="delete-history-btn" data-timestamp="${entry.timestamp}" title="Delete entry">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <!-- END NEW -->

        <div class="history-header">
          <div class="history-title">${escapeHtml(entry.filename)}</div>
          <span class="status-badge ${entry.status}">${entry.status}</span>
        </div>
        <div class="history-meta">
          ${dateStr} at ${timeStr} | ${entry.quality || 'N/A'} | ${folder}
        </div>
        
        <div class="history-item-footer">
          ${entry.error ? `
            <div class="history-meta" style="color: var(--accent-light); flex: 1; margin-right: 8px;">
              ❌ ${escapeHtml(entry.error)}
            </div>
          ` : '<div></div>'}
          
          ${entry.status === 'completed' ? `
            <button class="copy-history-btn">
              📋 Copy
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // --- MODIFIED: Setup separate listeners for item and button ---
  historyList.querySelectorAll('.history-item').forEach(item => {
    // Listener for the whole item (copy)
    item.addEventListener('click', () => {
      handleHistoryCopy(item);
    });

    // Listener for the copy button
    const copyBtn = item.querySelector('.copy-history-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop click from bubbling to the item
        handleHistoryCopy(item);
      });
    }

    // --- NEW: Listener for the delete button ---
    const deleteBtn = item.querySelector('.delete-history-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // VERY IMPORTANT
        handleDeleteHistoryEntry(deleteBtn);
      });
    }
    // --- END NEW ---
  });
}

// --- NEW --- Function to handle individual history item deletion
function handleDeleteHistoryEntry(buttonElement) {
  const timestamp = parseInt(buttonElement.dataset.timestamp, 10);
  if (!timestamp) {
    console.error('Could not find timestamp for history deletion');
    return;
  }

  // Optimistically remove from UI to feel faster
  const item = buttonElement.closest('.history-item');
  if (item) {
    item.style.opacity = '0';
    item.style.transform = 'scale(0.95)';
    setTimeout(() => {
      item.remove();
      // Check if history is now empty
      if (historyList.children.length === 0) {
        renderDownloadHistory([]); // Show empty state
      }
    }, 300);
  }

  // Send message to background to permanently delete
  chrome.runtime.sendMessage({
    type: 'DELETE_HISTORY_ENTRY',
    timestamp: timestamp
  }, (response) => {
    if (response && response.status === 'deleted') {
      console.log('History entry deleted from storage');
      // Background script should send a HISTORY_STATE_UPDATE
      // which will re-render, but our optimistic removal handles the UI.
    } else if (response && response.status === 'error') {
      console.error('Error deleting history entry:', response.message);
      // If deletion failed, reload history to restore the item
      loadDownloadHistory();
    } else if (chrome.runtime.lastError) {
      console.error('Error sending delete message:', chrome.runtime.lastError.message);
      loadDownloadHistory();
    }
  });
}
// --- END NEW ---


// --- NEW --- Central function to handle copy logic
function handleHistoryCopy(itemElement) {
  try {
    const entry = JSON.parse(itemElement.getAttribute('data-entry-json'));
    if (entry.status === 'completed') {
      const command = buildCommand(entry); // Already formatted inside buildCommand
      copyToClipboard(command);
      showCopyNotification(itemElement); // Pass the item
    }
  } catch (e) {
    console.error("Failed to parse history entry:", e);
  }
}

function buildCommand(entry) {
  let command = rebuildFFmpegCommand(entry);

  if (globalSettings.rm) {
    command = uncommentOptionalRm(command);
  }

  // Format with line breaks FIRST (in Linux format)
  command = formatCommandForTerminal(command, 'linux');
  command = normalizeCommandText(command);

  // THEN convert to Windows if needed
  if (globalSettings.os === 'windows') {
    command = convertLinuxToWindows(command);
  }

  return command;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('FFmpeg command copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy:', err);
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = 0;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('Fallback copy successful');
    } catch (e) {
      console.error('Fallback copy failed:', e);
    }
  });
}

// --- MODIFIED --- Accepts the history item, finds the button
function showCopyNotification(itemElement) {
  const buttonElement = itemElement.querySelector('.copy-history-btn');
  if (!buttonElement) return; // Only run if there's a copy button

  const originalText = buttonElement.textContent;

  buttonElement.textContent = '✔️ Copied!';
  buttonElement.classList.add('copied');

  // Flash item background
  const originalStyle = itemElement.style.cssText;
  // itemElement.style.background = 'var(--green)';
  itemElement.style.color = 'white';

  setTimeout(() => {
    buttonElement.textContent = originalText;
    buttonElement.classList.remove('copied');
    itemElement.style.cssText = originalStyle; // Reset item style
  }, 2000);
}
// --- END MODIFIED ---

// ============================================================================
// CLUB AND COPY HISTORY
// ============================================================================

function clubAndCopyHistory() {
  const historyItems = historyList.querySelectorAll('.history-item');
  if (historyItems.length === 0) {
    console.log('No history items to copy.');
    return;
  }

  const commands = [];

  historyItems.forEach(item => {
    try {
      const entry = JSON.parse(item.getAttribute('data-entry-json'));
      if (entry.status === 'completed') {
        const command = buildCommand(entry); // Already formatted inside buildCommand
        commands.push(command);
      }
    } catch (e) {
      console.error("Failed to parse history entry during club copy:", e);
    }
  });

  if (commands.length === 0) {
    console.log('No completed commands in history to copy.');
    copyAllHistoryBtn.textContent = '❌ No Commands';
    setTimeout(() => {
      copyAllHistoryBtn.textContent = '📋 Copy All';
    }, 2000);
    return;
  }

  const allCommands = commands.reverse().join('\n\n');
  copyToClipboard(allCommands);

  const originalText = copyAllHistoryBtn.textContent;
  copyAllHistoryBtn.textContent = `✔️ Copied ${commands.length}!`;
  copyAllHistoryBtn.style.background = 'var(--green)';
  copyAllHistoryBtn.style.color = 'white';

  setTimeout(() => {
    copyAllHistoryBtn.textContent = originalText;
    copyAllHistoryBtn.style.background = '';
    copyAllHistoryBtn.style.color = '';
    copyAllHistoryBtn.style.background = 'var(--accent)';
    copyAllHistoryBtn.style.color = 'white';
    copyAllHistoryBtn.style.borderColor = 'var(--accent)';
  }, 2000);
}

// ============================================================================
// REBUILD FFMPEG COMMAND
// ============================================================================

function rebuildFFmpegCommand(entry) {
  if (entry.folderPath && entry.filePrefix) {
    return entry.ffmpegCommand;
  }

  let folderPath = 'LMS';
  if (entry.semester) {
    folderPath += '/' + sanitizeFilename(entry.semester);
  }
  if (entry.subject) {
    folderPath += '/' + sanitizeFilename(entry.subject);
  }
  if (entry.additionalFolders && entry.additionalFolders.length > 0) {
    entry.additionalFolders.forEach(folder => {
      if (folder) {
        folderPath += '/' + sanitizeFilename(folder);
      }
    });
  }

  let command = entry.ffmpegCommand || '';

  command = command.replace(/mkdir -p "[^"]*"/gm, `mkdir -p "${folderPath}"`);
  command = command.replace(/language=en "[^"]*\/([^"\/]+\.mp4)"/g,
    `language=en "${folderPath}/$1"`);

  return command;
}

// ============================================================================
// COMMAND FORMATTING FOR TERMINAL
// ============================================================================

/**
 * Formats command text for better readability in terminals
 * Handles line breaks, continuations, and platform-specific syntax
 */
function formatCommandForTerminal(commandText, os = 'linux') {
  const isWindows = os === 'windows';
  const lineContinuation = isWindows ? '^' : '\\';
  const indent = '  '; // 2 spaces for continuation lines
  
  // Split by newlines to process each command separately
  const lines = commandText.split('\n');
  const formattedLines = [];
  
  for (let line of lines) {
    const trimmed = line.trim();
    
    // Keep comments as-is
    if (trimmed.startsWith('#') || trimmed === '') {
      formattedLines.push(line);
      continue;
    }
    
    // Handle mkdir commands (usually short, keep on one line)
    if (trimmed.startsWith('mkdir')) {
      formattedLines.push(trimmed);
      continue;
    }
    
    // Handle rm/del commands (can be long)
    if (trimmed.startsWith('rm ') || trimmed.startsWith('del ')) {
      formattedLines.push(...formatRemoveCommand(trimmed, isWindows, lineContinuation, indent));
      continue;
    }
    
    // Handle ffmpeg commands (typically very long)
    if (trimmed.startsWith('ffmpeg')) {
      formattedLines.push(...formatFfmpegCommand(trimmed, isWindows, lineContinuation, indent));
      continue;
    }
    
    // Fallback: keep line as-is
    formattedLines.push(line);
  }
  
  return formattedLines.join('\n');
}

/**
 * Format ffmpeg commands with proper line breaks
 */
function formatFfmpegCommand(command, isWindows, lineContinuation, indent) {
  const lines = [];
  
  // Remove 'ffmpeg' and process arguments
  let remaining = command.replace(/^ffmpeg\s+/, '').trim();
  
  // Start with 'ffmpeg'
  let currentLine = 'ffmpeg';
  
  // Split into tokens, preserving quoted strings
  const tokens = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < remaining.length; i++) {
    const char = remaining[i];
    
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  
  // Process tokens and add line breaks at logical points
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLastToken = i === tokens.length - 1;
    
    // Check if this is a flag that should start a new line
    const shouldBreakBefore = [
      '-i',           // Input files
      '-c:v', '-c:a', '-c:s',  // Codec specs
      '-metadata:s:s:0',       // Metadata
    ].includes(token);
    
    // Check if this is the output file (last token and doesn't start with -)
    const isOutputFile = isLastToken && !token.startsWith('-');
    
    if (shouldBreakBefore && currentLine !== 'ffmpeg') {
      // Flush current line with continuation
      lines.push(currentLine + ' ' + lineContinuation);
      currentLine = indent + token;
    } else if (isOutputFile) {
      // Output file gets its own line - add continuation to previous line
      lines.push(currentLine + ' ' + lineContinuation);
      currentLine = indent + token;
    } else {
      // Add to current line
      currentLine += ' ' + token;
    }
  }
  
  // Add final line (output file, no continuation)
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Format rm/del commands with proper line breaks
 */
function formatRemoveCommand(command, isWindows, lineContinuation, indent) {
  const lines = [];
  
  // Extract command and files
  const parts = command.match(/^(rm|del)\s+(.+)$/);
  if (!parts) return [command];
  
  const cmd = parts[1];
  const filesString = parts[2];
  
  // Split files by quotes (handles quoted filenames)
  const files = [];
  let current = '';
  let inQuotes = false;
  
  for (let char of filesString) {
    if (char === '"') {
      if (inQuotes) {
        files.push(current);
        current = '';
        inQuotes = false;
      } else {
        inQuotes = true;
      }
    } else if (char === ' ' && !inQuotes) {
      // Skip spaces outside quotes
      continue;
    } else if (inQuotes) {
      current += char;
    }
  }
  
  // If we have multiple files, format nicely
  if (files.length > 1) {
    lines.push(cmd + ' ' + lineContinuation);
    files.forEach((file, idx) => {
      const isLast = idx === files.length - 1;
      const line = indent + '"' + file + '"' + (isLast ? '' : ' ' + lineContinuation);
      lines.push(line);
    });
  } else {
    // Single file, keep on one line
    lines.push(command);
  }
  
  return lines;
}

/**
 * Clean up excessive whitespace and normalize line endings
 */
function normalizeCommandText(text) {
  return text
    .split('\n')
    .map(line => line.trimEnd()) // Remove trailing spaces
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function uncommentOptionalRm(script) {
  return script
    .split('\n')
    .map(line => {
      if (line.trim().startsWith('# rm')) {
        return line.replace(/^(\s*)#\s*/, '$1');
      }
      return line;
    })
    .join('\n');
}

function convertLinuxToWindows(script) {
  return script
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      const leadingSpaces = line.match(/^\s*/)[0]; // Preserve indentation

      // Convert Linux comments to Windows REM
      if (trimmed.startsWith('#')) {
        return leadingSpaces + line.trim().replace(/^\s*#\s*/, 'REM ');
      }
      
      if (trimmed === '') return line;

      // CRITICAL: Check line continuation FIRST before any command processing
      const hasLineContinuation = trimmed.endsWith('\\');
      
      // Remove the backslash temporarily for processing
      const trimmedWithoutContinuation = hasLineContinuation 
        ? trimmed.slice(0, -1).trim() 
        : trimmed;

      let converted = '';

      // Handle mkdir command
      if (/^mkdir\s+-p\b/.test(trimmedWithoutContinuation)) {
        converted = trimmedWithoutContinuation
          .replace(/^mkdir\s+-p\s+/, 'mkdir ')
          .replace(/\//g, '\\');
        
        // Remove quotes only if path has no spaces
        if (!/\s/.test(converted.replace(/^mkdir\s+/, ''))) {
          converted = converted.replace(/"/g, '');
        }
      }
      // Handle rm/del command
      else if (/^(rm|del)\s*/.test(trimmedWithoutContinuation)) {
        converted = trimmedWithoutContinuation
          .replace(/^rm\s*/, 'del')
          .replace(/\//g, '\\');
      }
      // Handle any line with file paths (ffmpeg args, standalone filenames, etc.)
      else if (trimmedWithoutContinuation.startsWith('ffmpeg') || 
               trimmedWithoutContinuation.startsWith('-') || 
               /\.(ts|vtt|mp4)"?\s*$/.test(trimmedWithoutContinuation) ||
               /^"[^"]+\.(ts|vtt|mp4)"$/.test(trimmedWithoutContinuation)) {
        converted = trimmedWithoutContinuation.replace(/\//g, '\\');
        
        // Remove all quotes for cleaner Windows output
        converted = converted.replace(/"/g, '');
      }
      else {
        converted = trimmedWithoutContinuation;
      }

      // Add line continuation character if needed
      if (hasLineContinuation) {
        converted = converted + ' ^';
      }

      return leadingSpaces + converted;
    })
    .join('\n');
}

// --- MODIFIED --- Inline confirmation logic
function showClearHistoryConfirm() {
  clearHistoryConfirm.classList.remove('hidden');
  commandOptions.classList.add('hidden');
  historyButtonsContainer.classList.add('hidden');
}

function hideClearHistoryConfirm() {
  clearHistoryConfirm.classList.add('hidden');
  commandOptions.classList.remove('hidden');
  historyButtonsContainer.classList.remove('hidden');
}

function executeClearHistory() {
  chrome.runtime.sendMessage({ type: 'CLEAR_DOWNLOAD_HISTORY' }, (response) => {
    if (response && response.status === 'cleared') {
      renderDownloadHistory([]);
    }
  });
  hideClearHistoryConfirm();
}
// --- END MODIFIED ---

// ============================================================================
// REAL-TIME UPDATES
// ============================================================================

function listenForDownloadUpdates() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // MODIFICATION: Only call renderActiveDownloads if the message
    // actually contains new download data.
    if (message.type === 'DOWNLOAD_STATE_UPDATE' && message.downloads) {
      renderActiveDownloads(message.downloads);
    }

    // MODIFICATION: Only call renderDownloadHistory if the message
    // actually contains new history data.
    if (message.type === 'HISTORY_STATE_UPDATE' && message.history) {
      renderDownloadHistory(message.history);
    }
  });
}

// ============================================================================
// FOLDER SETUP COMMAND
// ============================================================================

function copyFolderSetup() {
  const semester = semesterInput.value.trim();
  const subject = subjectInput.value.trim();

  if (!semester && !subject && additionalFolders.filter(f => f).length === 0) {
    pageStatus.textContent = '❌ Please set at least one folder first';
    pageStatus.classList.add('error');
    return;
  }

  let folderPath = 'LMS';
  if (semester) folderPath += '/' + sanitizeFilename(semester);
  if (subject) folderPath += '/' + sanitizeFilename(subject);

  additionalFolders.forEach(folder => {
    if (folder) {
      folderPath += '/' + sanitizeFilename(folder);
    }
  });

  let command = `mkdir -p "${folderPath}"`;

  if (globalSettings.os === 'windows') {
    command = `mkdir ${folderPath.replace(/\//g, '\\')}`;
  }

  // Format command before copying (though mkdir is usually short)
  command = normalizeCommandText(command);

  copyToClipboard(command);

  const btn = document.getElementById('copySetupBtn');
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '✔️ Copied!';
    // btn.style.background = 'var(--green)';
    btn.style.color = 'white';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  }
}

// ============================================================================
// GLOBAL TOGGLE CONTROLS
// ============================================================================

function loadGlobalSettings() {
  chrome.storage.local.get({ globalRm: false, globalOs: 'linux' }, (items) => {
    globalSettings.rm = items.globalRm;
    globalSettings.os = items.globalOs;

    globalRmToggle.checked = globalSettings.rm;

    if (globalSettings.os === 'windows') {
      globalOsWindows.classList.add('active');
      globalOsLinux.classList.remove('active');
    } else {
      globalOsWindows.classList.remove('active');
      globalOsLinux.classList.add('active');
    }
  });
}

function saveGlobalSettings() {
  chrome.storage.local.set({
    globalRm: globalSettings.rm,
    globalOs: globalSettings.os
  });
}

function setupGlobalToggles() {
  globalRmToggle.addEventListener('change', () => {
    globalSettings.rm = globalRmToggle.checked;
    saveGlobalSettings();
  });

  globalOsLinux.addEventListener('click', () => {
    globalSettings.os = 'linux';
    globalOsLinux.classList.add('active');
    globalOsWindows.classList.remove('active');
    saveGlobalSettings();
  });

  globalOsWindows.addEventListener('click', () => {
    globalSettings.os = 'windows';
    globalOsWindows.classList.add('active');
    globalOsLinux.classList.remove('active');
    saveGlobalSettings();
  });
}

// ============================================================================
// CONCURRENCY SETTINGS
// ============================================================================

function loadConcurrencySettings() {
  chrome.storage.local.get({
    videoConcurrency: 66,
    audioConcurrency: 66
  }, (items) => {
    concurrencySettings.videoConcurrency = items.videoConcurrency;
    concurrencySettings.audioConcurrency = items.audioConcurrency;
    console.log('✅ Loaded concurrency settings:', items);
  });
}

function saveConcurrencySettings() {
  chrome.storage.local.set({
    videoConcurrency: concurrencySettings.videoConcurrency,
    audioConcurrency: concurrencySettings.audioConcurrency
  }, () => {
    console.log('Concurrency settings saved:', concurrencySettings);
  });
}

function updateConcurrency(type, action) {
  const key = type === 'video' ? 'videoConcurrency' : 'audioConcurrency';
  const input = type === 'video' ? videoConcurrencyInput : audioConcurrencyInput;
  
  let value = parseInt(concurrencySettings[key]);
  
  if (action === 'increase') {
    value = Math.min(value + 1, 100);
  } else if (action === 'decrease') {
    value = Math.max(value - 1, 1);
  }
  
  concurrencySettings[key] = value;
  input.value = value;
  saveConcurrencySettings();
}

function toggleConcurrencySettings() {
  const isCollapsed = concurrencyContent.classList.toggle('collapsed');
  concurrencyToggle.textContent = isCollapsed ? '▶' : '▼';
  chrome.storage.local.set({ concurrencySettingsCollapsed: isCollapsed });
}

function setupConcurrencyListeners() {
  concurrencyToggle.addEventListener('click', toggleConcurrencySettings);
  
  concurrencyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const action = btn.dataset.action;
      updateConcurrency(type, action);
    });
  });
  
  videoConcurrencyInput.addEventListener('change', () => {
    let value = parseInt(videoConcurrencyInput.value);
    value = Math.max(1, Math.min(value, 100));
    concurrencySettings.videoConcurrency = value;
    videoConcurrencyInput.value = value;
    saveConcurrencySettings();
  });
  
  audioConcurrencyInput.addEventListener('change', () => {
    let value = parseInt(audioConcurrencyInput.value);
    value = Math.max(1, Math.min(value, 100));
    concurrencySettings.audioConcurrency = value;
    audioConcurrencyInput.value = value;
    saveConcurrencySettings();
  });
}

function loadConcurrencySettingsState() {
  chrome.storage.local.get({ concurrencySettingsCollapsed: false }, (items) => {
    if (items.concurrencySettingsCollapsed) {
      concurrencyContent.classList.add('collapsed');
      concurrencyToggle.textContent = '▶';
    } else {
      concurrencyContent.classList.remove('collapsed');
      concurrencyToggle.textContent = '▼';
    }
  });
}

// ============================================================================
// END CONCURRENCY SETTINGS
// ============================================================================

// ============================================================================
// CONFIG PANEL
// ============================================================================

function loadConcurrencyValue() {
  if (!concurrencySlider) {
    console.warn('⚠️ concurrencySlider element not found');
    return;
  }
  
  chrome.storage.local.get({ 
    videoConcurrency: 66,
    audioConcurrency: 66
  }, (items) => {
    console.log('📊 Loaded from storage - Video:', items.videoConcurrency, 'Audio:', items.audioConcurrency);
    const value = items.videoConcurrency;
    concurrencySlider.value = value;
    concurrencyValue.textContent = value;
    console.log('🎚️ Slider set to:', value);
  });
}

function saveConcurrencyValue(value) {
  chrome.storage.local.set({ 
    videoConcurrency: value,
    audioConcurrency: value
  }, () => {
    console.log('💾 Saved to storage - Video:', value, 'Audio:', value);
  });
}

function toggleConfigPanel() {
  infoPanel.classList.add('hidden');
  configPanel.classList.toggle('hidden');
  console.log('🔧 Config panel toggled');
}

// ============================================================================
// END CONFIG PANEL
// ============================================================================

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {

  themeToggle.addEventListener('click', toggleTheme);

  infoBtn.addEventListener('click', () => {
    infoPanel.classList.toggle('hidden');
    configPanel.classList.add('hidden');
  });

  configBtn.addEventListener('click', () => {
    console.log('🔧 Config button clicked');
    console.log('🔧 ConfigPanel exists:', !!configPanel);
    console.log('🔧 ConfigPanel classList:', configPanel?.className);
    toggleConfigPanel();
  });

  folderSettingsToggle.addEventListener('click', toggleFolderSettings);

  semesterInput.addEventListener('input', saveFolderSettings);
  semesterInput.addEventListener('blur', saveFolderSettings);

  subjectInput.addEventListener('input', saveFolderSettings);
  subjectInput.addEventListener('blur', saveFolderSettings);

  addFolderBtn.addEventListener('click', addFolder);
  downloadBtn.addEventListener('click', triggerDownload);

  // --- MODIFIED --- Point to new confirm functions
  clearHistoryBtn.addEventListener('click', showClearHistoryConfirm);
  confirmClearHistoryBtn.addEventListener('click', executeClearHistory);
  cancelClearHistoryBtn.addEventListener('click', hideClearHistoryConfirm);
  // --- END MODIFIED ---

  copyAllHistoryBtn.addEventListener('click', clubAndCopyHistory);

  const copySetupBtn = document.getElementById('copySetupBtn');
  if (copySetupBtn) {
    copySetupBtn.addEventListener('click', copyFolderSetup);
  }

  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://forestily.com/lms-downloader/how-it-works.html'
    });
  });

  setupGlobalToggles();
  // setupConcurrencyListeners(); // REMOVED - old +/- button system not in HTML anymore

  if (concurrencySlider) {
    concurrencySlider.addEventListener('input', (e) => {
      console.log('🎚️ Slider changed - Raw value:', e.target.value);
      
      let value = parseInt(e.target.value);
      value = Math.max(5, Math.min(value, 120));
      
      console.log('✅ Validated value:', value);
      
      concurrencySlider.value = value;
      concurrencyValue.textContent = value;
      
      concurrencySettings.videoConcurrency = value;
      concurrencySettings.audioConcurrency = value;
      console.log('📝 Settings updated to:', value);
      
      saveConcurrencyValue(value);
    });
  } else {
    console.warn('⚠️ Slider not found - skipping slider listener setup');
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeFilename(name) {
  if (typeof name !== 'string') {
    return '';
  }
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}