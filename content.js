(async function () {
    console.log('🎬 Vimeo HLS Concurrent Downloader - Injected');

    // Generate unique session ID
    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Abort controllers for cancellation
    const abortControllers = {
        video: new AbortController(),
        audio: new AbortController()
    };

    // --- FIX: Listen for cancellation immediately ---
    // The listener must be added *before* any async download code runs.
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        if (event.data.type === 'VIMEO_DOWNLOADER_CANCEL' &&
            event.data.sessionId === sessionId) {
            console.log('🚫 Download cancelled by user');
            abortControllers.video.abort();
            abortControllers.audio.abort();
        }
    });
    // --- END FIX ---

    // Progress batching state
    const progressBatchState = {
        video: { lastUpdate: 0, pendingUpdate: false },
        audio: { lastUpdate: 0, pendingUpdate: false }
    };
    const PROGRESS_BATCH_INTERVAL = 2000; // 2 seconds
    const PROGRESS_BATCH_COUNT = 5; // or every 5 segments

    // Wait for settings from injector (includes folder settings now)
    const settings = await new Promise((resolve) => {
        let settingsReceived = false;
        
        const handler = (event) => {
            if (event.data.type === 'VIMEO_DOWNLOADER_SETTINGS') {
                window.removeEventListener('message', handler);
                settingsReceived = true;
                console.log('✅ Settings received from injector:', event.data.settings);
                resolve(event.data.settings);
            }
        };
        window.addEventListener('message', handler);

        setTimeout(() => {
            if (!settingsReceived) {
                window.removeEventListener('message', handler);
                console.warn('⚠️ Settings timeout - using defaults');
                resolve({
                    videoConcurrency: 66,
                    audioConcurrency: 66,
                    semester: '',
                    subject: '',
                    additionalFolders: []
                });
            }
        }, 3000);
    });

    // Extract folder settings
    const folderSettings = {
        semester: settings.semester || '',
        subject: settings.subject || '',
        additionalFolders: settings.additionalFolders || []
    };

    // Wait for playerConfig
    async function waitForPlayerConfig(maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
            if (window.playerConfig) {
                return window.playerConfig;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return null;
    }

    const playerConfig = await waitForPlayerConfig();

    if (!playerConfig) {
        console.error('❌ playerConfig not found after waiting');
        return;
    }

    const config = window.playerConfig;
    const videoTitle = config.video.title || 'vimeo_video';
    const files = config.request.files;

    const hlsUrl = files.hls?.cdns?.akfire_interconnect_quic?.url ||
        files.hls?.cdns?.fastly_skyfire?.url;

    if (!hlsUrl) {
        console.error('❌ No HLS URL found');
        return;
    }

    console.log('📹 Starting download:', videoTitle);

    try {
        // Fetch master playlist
        const masterResponse = await fetch(hlsUrl);
        const masterPlaylist = await masterResponse.text();

        // Parse playlists
        const lines = masterPlaylist.split('\n');
        let bestVideoUrl = null;
        let bestBandwidth = 0;
        let bestQuality = null;
        let audioUrl = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
                const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);

                if (bandwidthMatch && i + 1 < lines.length) {
                    const bandwidth = parseInt(bandwidthMatch[1]);
                    if (bandwidth > bestBandwidth) {
                        bestBandwidth = bandwidth;
                        bestQuality = resolutionMatch ? resolutionMatch[1] : 'unknown';
                        bestVideoUrl = lines[i + 1].trim();
                    }
                }
            }

            if (line.startsWith('#EXT-X-MEDIA:') && line.includes('TYPE=AUDIO')) {
                const uriMatch = line.match(/URI="([^"]+)"/);
                if (uriMatch) {
                    audioUrl = uriMatch[1];
                }
            }
        }

        const baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/') + 1);

        if (bestVideoUrl && !bestVideoUrl.startsWith('http')) {
            bestVideoUrl = baseUrl + bestVideoUrl;
        }
        if (audioUrl && !audioUrl.startsWith('http')) {
            audioUrl = baseUrl + audioUrl;
        }

        // Notify background that download is starting (segment counts will be sent during download)
        sendMessageToBackground({
            type: 'VIMEO_DOWNLOADER_START',
            sessionId: sessionId,
            data: {
                videoTitle: videoTitle,
                quality: bestQuality,
                startTime: Date.now(),
                folder: folderSettings
            }
        });

        // Download video and audio concurrently
        const downloadPromises = [];

        if (bestVideoUrl) {
            downloadPromises.push(
                downloadSegmentsConcurrent(
                    bestVideoUrl,
                    'video',
                    settings.videoConcurrency,
                    sessionId,
                    abortControllers.video
                ).then(blob => {
                    if (blob) {
                        const filename = buildFilename(videoTitle, 'video.ts', folderSettings);
                        downloadFile(blob, filename);
                        console.log(' Video downloaded');
                    }
                })
            );
        }

        if (audioUrl) {
            downloadPromises.push(
                downloadSegmentsConcurrent(
                    audioUrl,
                    'audio',
                    settings.audioConcurrency,
                    sessionId,
                    abortControllers.audio
                ).then(blob => {
                    if (blob) {
                        const filename = buildFilename(videoTitle, 'audio.ts', folderSettings);
                        downloadFile(blob, filename);
                        console.log(' Audio downloaded');
                    }
                })
            );
        }

        // Wait for completion
        await Promise.all(downloadPromises);

        // --- ADDED CANCELLATION CHECK ---
        // Check if the download was cancelled *before* proceeding
        if (abortControllers.video.signal.aborted || abortControllers.audio.signal.aborted) {
            throw new Error("Download cancelled by user."); 
        }
        // --- END CANCELLATION CHECK ---

        // Download subtitles
        const textTracks = config.request.text_tracks;
        if (textTracks && textTracks.length > 0) {
            for (const track of textTracks) {
                // --- ADDED CANCELLATION CHECK ---
                if (abortControllers.video.signal.aborted) {
                    console.log('Subtitle download skipped due to cancellation.');
                    break; // Exit loop
                }
                // --- END CANCELLATION CHECK ---
                try {
                    const vttUrl = track.url.startsWith('http')
                        ? track.url
                        : `https://player.vimeo.com${track.url}`;

                    // --- ADDED ABORT SIGNAL TO SUBTITLE FETCH ---
                    const vttResponse = await fetch(vttUrl, { signal: abortControllers.video.signal });
                    const vttText = await vttResponse.text();
                    const vttBlob = new Blob([vttText], { type: 'text/vtt' });

                    const lang = track.lang || 'unknown';
                    const filename = buildFilename(videoTitle, `${lang}.vtt`, folderSettings);
                    downloadFile(vttBlob, filename);
                } catch (error) {
                    // --- ADDED AbortError CHECK ---
                    if (error.name !== 'AbortError') {
                        console.error(`Failed subtitle: ${track.label}`, error);
                    }
                    // --- END AbortError CHECK ---
                }
            }
        }

        // --- ADDED CANCELLATION CHECK ---
        // Final check before sending "COMPLETE"
        if (abortControllers.video.signal.aborted || abortControllers.audio.signal.aborted) {
            throw new Error("Download cancelled by user."); 
        }
        // --- END CANCELLATION CHECK ---

        console.log(' DOWNLOAD COMPLETE:', videoTitle);

        // Generate FFmpeg command
        const sanitized = sanitizeFilename(videoTitle);
        const semester = folderSettings.semester ? sanitizeFilename(folderSettings.semester) : '';
        const subject = folderSettings.subject ? sanitizeFilename(folderSettings.subject) : '';

        // Build folder path
        let folderPath = 'LMS';
        if (semester) folderPath += '/' + semester;
        if (subject) folderPath += '/' + subject;
        
        // Add additional folders to path
        if (folderSettings.additionalFolders && folderSettings.additionalFolders.length > 0) {
            folderSettings.additionalFolders.forEach(folder => {
                if (folder) {
                    folderPath += '/' + sanitizeFilename(folder);
                }
            });
        }

        // Build filename prefix
        let filePrefix = '';
        if (semester) filePrefix += semester + '_';
        if (subject) filePrefix += subject + '_';
        
        // Add additional folders to prefix
        if (folderSettings.additionalFolders && folderSettings.additionalFolders.length > 0) {
            folderSettings.additionalFolders.forEach(folder => {
                if (folder) {
                    filePrefix += sanitizeFilename(folder) + '_';
                }
            });
        }

        // Generate command
        let ffmpegCommand = `# Create folder structure\nmkdir -p "${folderPath}"\n\n`;

        if (textTracks && textTracks.length > 0) {
            const subtitleLang = textTracks[0].lang || 'en';
            ffmpegCommand += `# Merge video, audio, and subtitles\nffmpeg -i "${filePrefix}${sanitized}_video.ts" -i "${filePrefix}${sanitized}_audio.ts" -i "${filePrefix}${sanitized}_${subtitleLang}.vtt" -c:v copy -c:a copy -c:s mov_text -metadata:s:s:0 language=${subtitleLang} "${folderPath}/${sanitized}.mp4"\n`;
        } else {
            ffmpegCommand += `# Merge video and audio\nffmpeg -i "${filePrefix}${sanitized}_video.ts" -i "${filePrefix}${sanitized}_audio.ts" -c copy "${folderPath}/${sanitized}.mp4"\n`;
        }

        // Optional: Add cleanup
        ffmpegCommand += `\n# Optional: Clean up segment files\n# rm "${filePrefix}${sanitized}_video.ts" "${filePrefix}${sanitized}_audio.ts"`;

        console.log('🛠 FFmpeg:', ffmpegCommand);

        // Copy to clipboard
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(ffmpegCommand);
                console.log('📋 Copied to clipboard');
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = ffmpegCommand;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                console.log('📋 Copied to clipboard (fallback)');
            }
        } catch (e) {
            console.warn('Could not copy to clipboard');
        }

        // Notify completion
        sendMessageToBackground({
            type: 'VIMEO_DOWNLOADER_COMPLETE',
            sessionId: sessionId,
            data: {
                videoTitle: videoTitle,
                ffmpegCommand: ffmpegCommand,
                folder: folderSettings
            }
        });

    } catch (error) {
        // --- MODIFIED CATCH BLOCK ---
        if (error.name === 'AbortError' || error.message === 'Download cancelled by user.') {
            console.log('❌ Download officially cancelled. Notifying background.');
            sendMessageToBackground({
                type: 'VIMEO_DOWNLOADER_CANCELLED_CONFIRM', // New message type
                sessionId: sessionId,
                data: {
                    message: 'Download was cancelled by the user.'
                }
            });
        } else {
            console.error('❌ Download failed:', error.message);
            sendMessageToBackground({
                type: 'VIMEO_DOWNLOADER_ERROR',
                sessionId: sessionId,
                data: {
                    error: error.message
                }
            });
        }
        // --- END MODIFIED CATCH BLOCK ---
    }

    // Helper: Build filename with folder structure
    function buildFilename(videoTitle, suffix, folderSettings) {
        const sanitized = sanitizeFilename(videoTitle);
        let prefix = '';

        // Build prefix from folder settings
        if (folderSettings.semester) {
            prefix += sanitizeFilename(folderSettings.semester) + '_';
        }
        if (folderSettings.subject) {
            prefix += sanitizeFilename(folderSettings.subject) + '_';
        }
        
        // Add additional folders to prefix
        if (folderSettings.additionalFolders && folderSettings.additionalFolders.length > 0) {
            folderSettings.additionalFolders.forEach(folder => {
                if (folder) {
                    prefix += sanitizeFilename(folder) + '_';
                }
            });
        }

        // Result: semester_1_subject_y_week_1_video_title_video.ts
        return `${prefix}${sanitized}_${suffix}`;
    }

    // Helper: Send message to background via injector relay
    function sendMessageToBackground(message) {
        window.postMessage(message, '*');
    }

    // Helper: Send progress with batching
    function sendProgressUpdate(sessionId, streamType, completed, total, force = false) {
        const now = Date.now();
        const state = progressBatchState[streamType];

        // Check if we should send update
        const timeSinceLastUpdate = now - state.lastUpdate;
        const isLastSegment = completed === total;

        if (force || isLastSegment ||
            timeSinceLastUpdate >= PROGRESS_BATCH_INTERVAL ||
            completed % PROGRESS_BATCH_COUNT === 0) {

            sendMessageToBackground({
                type: 'VIMEO_DOWNLOADER_PROGRESS',
                sessionId: sessionId,
                data: {
                    streamType: streamType,
                    completed: completed,
                    total: total,
                    timestamp: now
                }
            });

            state.lastUpdate = now;
            state.pendingUpdate = false;
        } else {
            state.pendingUpdate = true;
        }
    }

    async function downloadSegmentsConcurrent(playlistUrl, type, concurrency, sessionId, abortController) {
        try {
            const response = await fetch(playlistUrl);
            const playlist = await response.text();

            const lines = playlist.split('\n');
            const segments = [];
            const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);

            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const segmentUrl = line.startsWith('http') ? line : baseUrl + line;
                    segments.push(segmentUrl);
                }
            }

            if (segments.length === 0) {
                console.error(`No ${type} segments found`);
                return null;
            }

            // Send total segment count now that we know it
            sendMessageToBackground({
                type: 'VIMEO_DOWNLOADER_SEGMENT_COUNT',
                sessionId: sessionId,
                data: {
                    streamType: type,
                    total: segments.length
                }
            });

            const segmentBlobs = new Array(segments.length);
            let completed = 0;

            // Download in batches
            for (let i = 0; i < segments.length; i += concurrency) {
                if (abortController.signal.aborted) {
                    // --- MODIFIED ---
                    // throw new Error instead of returning null
                    // This ensures the main catch block is triggered
                    throw new Error('Download cancelled by user.');
                    // --- END MODIFIED ---
                }

                const batch = segments.slice(i, i + concurrency);
                const batchPromises = batch.map((url, batchIndex) => {
                    const segmentIndex = i + batchIndex;
                    return downloadSegmentWithRetry(url, 3, abortController.signal).then(blob => {
                        segmentBlobs[segmentIndex] = blob;
                        completed++;

                        // Send batched progress update
                        sendProgressUpdate(sessionId, type, completed, segments.length);

                        return blob;
                    });
                });

                await Promise.all(batchPromises);
            }

            // Force final progress update
            sendProgressUpdate(sessionId, type, completed, segments.length, true);

            const combinedBlob = new Blob(segmentBlobs.filter(b => b), { type: 'video/mp2t' });
            const sizeMB = (combinedBlob.size / 1024 / 1024).toFixed(2);
            console.log(`${type}: ${sizeMB} MB`);

            return combinedBlob;

        } catch (error) {
            // --- MODIFIED ---
            // Propagate cancellation errors to the main try/catch block
            if (error.name === 'AbortError' || error.message === 'Download cancelled by user.') {
                console.log(`${type} download cancelled`);
                throw error; // Re-throw to be caught by main handler
            } else {
                console.error(`Failed to download ${type}:`, error.message);
                // CRITICAL FIX: Re-throw any error to stop the download.
                // Previously, this returned null, causing the download to "succeed".
                throw error;
            }
            // --- END MODIFIED ---
        }
    }

    async function downloadSegmentWithRetry(url, maxRetries, signal) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, { signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.blob();
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw error;
                }
                if (attempt === maxRetries) {
                    // --- MODIFIED ---
                    console.warn(`Segment failed after ${maxRetries} retries: ${url}`);
                    // CRITICAL FIX: Throw an error instead of returning null.
                    // This ensures Promise.all() will fail.
                    throw new Error(`Segment failed after ${maxRetries} retries: ${url}`);
                    // --- END MODIFIED ---
                }
                // Exponential backoff with jitter: 2^attempt * 500ms + random(0-500ms)
                const baseDelay = Math.pow(2, attempt) * 500;
                const jitter = Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
            }
        }
    }

    function downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function sanitizeFilename(name) {
        return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    // --- MOVED ---
    // The cancellation listener was moved to the top of the file.
    // --- END MOVED ---

})();

