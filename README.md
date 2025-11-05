# Semester Stacker for MAHE 🎓

**High-Speed Content Organizer for MAHE Brightspace**

Download, organize, and access your MAHE lectures offline with blazing speed and intelligent auto-organization. Never lose access to your lectures again.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-blue)](https://chromewebstore.google.com/detail/semester-stacker-for-mahe/fjlejoilmhkihjbfgdcghfjjddlflapi)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen)](.)

---

## ☕ Support This Project

If Semester Stacker has helped you ace your exams or saved you hours of study time, consider supporting the development:

**[☕ Buy Me a Coffee](https://buymeacoffee.com/jaybuddyjay)** — Your support helps maintain and improve this tool for all MAHE students!

---

## ⚡ Why Semester Stacker?

| Feature | Semester Stacker | Screen Recording |
|---------|-----------------|------------------|
| **Speed** | 5-120x faster | Real-time (1x) |
| **File Size** | 200-500MB/hr | 2-5GB/hr |
| **Quality** | Original/Lossless | Lossy compression |
| **Sync Issues** | None | Audio/video lag |
| **Automation** | Auto-organize & merge | Manual everything |

---

## 🚀 Core Features

### ⚡ 5-120x Faster Downloads
Uses intelligent concurrent segment downloading to maximize bandwidth utilization and download speeds.

### 📂 Intelligent Auto-Organization
Automatically saves files in a structured hierarchy:
```
LMS/
├── [Semester]/
│   ├── [Subject]/
│   │   ├── [Week/Module]/
│   │   │   └── lecture_video.ts
│   │   │   └── lecture_audio.ts
│   │   │   └── lecture.vtt (subtitles)
```

### 🔄 Concurrent Downloads
Download multiple lectures at once. Start videos in separate tabs and the extension handles them all simultaneously.

### ❌ Real-Time Cancel Option
Stop any download mid-process without data loss or errors.

### 📋 Instant Merge Commands
The extension auto-copies the exact FFmpeg command needed to combine your video, audio, and subtitle files.

### 🔒 100% Private & Local
- **Zero servers involved** – no cloud uploads
- **No tracking** – no analytics or telemetry
- **No accounts required** – works locally on your device
- **Your data stays on your device** – always

### 📊 Download Management
- Real-time progress tracking (video/audio segments, ETA)
- Complete download history with timestamps
- One-click copy of FFmpeg merge commands
- Delete individual history entries
- Clear all history at once

### 🌓 Theme Support
Light and dark mode for comfortable viewing in any environment.

---

## 🔧 How It Works (3 Simple Steps)

### Step 1: Configure Your Folder Structure
Open the extension settings and define your folder hierarchy:
- **Semester** (e.g., "Fall_2024")
- **Subject** (e.g., "Physics_101")
- **Additional Folders** (e.g., "Week_1", "Module_1", etc.)

This is a one-time setup! All future downloads auto-organize themselves.

### Step 2: Download Your Lecture
1. Navigate to a lecture video on MAHE Brightspace
2. Click the extension icon
3. Hit the "Download" button
4. The extension searches for the video player and begins concurrent segment downloading
5. **Important:** Do not refresh or navigate the tab while downloading!

**Multi-Lecture Tip:** Open each lecture in a separate tab to download multiple videos concurrently.

### Step 3: Merge with FFmpeg
The extension automatically copies an FFmpeg command to your clipboard. Paste it into your terminal:

```bash
# Example command (auto-generated)
mkdir -p "LMS/Fall_2024/Physics_101/Week_1"

ffmpeg -i "Fall_2024_Physics_101_Week_1_video.ts" \
       -i "Fall_2024_Physics_101_Week_1_audio.ts" \
       -i "Fall_2024_Physics_101_Week_1_en.vtt" \
       -c:v copy -c:a copy -c:s mov_text \
       -metadata:s:s:0 language=en \
       "LMS/Fall_2024/Physics_101/Week_1/lecture.mp4"
```

The command is ready to paste—just run it!

---

## 📋 Requirements

### FFmpeg Installation Required ✅
You must install FFmpeg to merge the downloaded segments into a final video file.

- **Download FFmpeg:** https://ffmpeg.org/download.html
- **Installation Guide:** https://www.forestily.com/lms-downloader/how-it-works.html

### Authorized Use Only ⚠️
This tool is for MAHE students to back up content they have legitimate access to:
- ✅ Personal, educational use only
- ✅ Lectures you're enrolled in
- ✅ Offline study and exam prep
- ❌ Redistribution or sharing
- ❌ Commercial use
- ❌ Content you don't have access to

Respect copyright and institutional policies.

---

## 🛠️ Installation

### From Chrome Web Store (Recommended)
1. Visit: https://chromewebstore.google.com/detail/semester-stacker-for-mahe/fjlejoilmhkihjbfgdcghfjjddlflapi
2. Click **"Add to Chrome"**
3. Confirm permissions
4. Done! 🎉

### From Source (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/JayJay-101/semester-stacker-mahe.git
   cd semester-stacker-mahe
   ```

2. Open Chrome Extensions:
   - Go to `chrome://extensions/`
   - Enable **"Developer mode"** (top right)
   - Click **"Load unpacked"**
   - Select the cloned repository folder

3. Verify installation:
   - The extension icon should appear in your Chrome toolbar
   - Visit a MAHE Brightspace lecture page
   - The extension should be ready to use

---

## 📁 Project Structure

```
semester-stacker-for-mahe/
├── background.js          # Main background worker (download state, history management)
├── content.js             # Content script (HLS playlist parsing, concurrent downloads)
├── injector.js            # Injector script (Vimeo player detection & relay)
├── popup.js               # Popup UI logic (settings, history, controls)
├── popup.html             # Popup interface
├── styles.css             # Styling
├── manifest.json          # Extension configuration
├── icons/                 # Extension icons (16, 48, 128px)
└── README.md              # This file
```

### Key Components

**background.js**
- Manages global download state across all tabs
- Persists download history to Chrome storage
- Broadcasts real-time download updates to the popup
- Handles cancellation requests and confirmations

**content.js**
- Runs in the Vimeo player's isolated world
- Extracts HLS playlist URLs from player config
- Downloads video and audio segments concurrently
- Generates FFmpeg merge commands
- Handles user cancellations gracefully

**injector.js**
- Detects valid Vimeo player contexts
- Relays messages between background and content scripts
- Prevents injection into PDFs or invalid frames

**popup.js**
- UI for download triggers, settings, and history
- Theme toggle (light/dark mode)
- Real-time download progress display
- FFmpeg command copying and customization
- Windows/Linux command conversion

---

## ⚙️ Configuration Options

### Concurrency Settings
Adjust download concurrency (5-120 segments/second):
- **Video Concurrency:** Number of video segments to download simultaneously
- **Audio Concurrency:** Number of audio segments to download simultaneously
- Higher values = faster downloads (if bandwidth allows)
- Default: 66 segments/second

### Folder Organization
Define your personal folder structure:
- **Semester:** Academic term (e.g., "Fall_2024", "Spring_2025")
- **Subject:** Course/class name (e.g., "Physics_101", "Calculus_II")
- **Additional Folders:** Up to 9 custom folders (weeks, modules, topics, etc.)

### Command Generation
Customize the FFmpeg commands to your needs:
- **Auto-remove segments:** Uncomment the cleanup line
- **OS-specific formatting:** Toggle between Linux and Windows syntax
- **Copy all commands:** Generate batch commands for multiple lectures

---

## 🔒 Privacy & Security

**Semester Stacker is 100% private by design:**

- **Zero Network Requests:** All processing happens locally on your device
- **No Analytics:** We don't track your usage or behavior
- **No Telemetry:** No data is sent to any servers
- **No Ads:** The extension is completely ad-free
- **Open Source:** You can inspect the code yourself
- **Minimal Permissions:** Only accesses MAHE Brightspace and your local downloads

All data is stored exclusively in your browser's local storage, never transmitted or shared.

---

## 🐛 Troubleshooting

### "No video found" Error
- ✅ Make sure you're on a lecture page with an embedded Vimeo video
- ✅ The extension only works on pages with video players
- ✅ Refresh the page and try again

### Download Fails or Stalls
- ✅ Check your internet connection
- ✅ Ensure you don't refresh or navigate the tab during download
- ✅ Reduce concurrency settings if segments keep failing
- ✅ Try downloading a shorter lecture first

### FFmpeg Command Not Generated
- ✅ Wait for the download to complete fully
- ✅ Check that both video and audio segments downloaded successfully
- ✅ Look in your browser's downloads folder for the `.ts` files

### FFmpeg: "Segment files not found"
- ✅ Run the command in the same directory where your `.ts` files are saved
- ✅ Check the file paths in the generated command match your downloads
- ✅ Use the full paths or ensure files are in the correct folder

### Extension Not Appearing on Page
- ✅ Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- ✅ Check that you're on a valid MAHE Brightspace lecture page
- ✅ Verify the extension is enabled in `chrome://extensions/`

---

## 📚 Additional Resources

- **Full Installation & Usage Guide:** https://www.forestily.com/lms-downloader/how-it-works.html
- **FFmpeg Installation:** https://ffmpeg.org/download.html
- **Chrome Extension Docs:** https://developer.chrome.com/docs/extensions/

---

## 🤝 Contributing

We welcome contributions from the community! Here's how to help:

### Reporting Issues
Found a bug? Have a feature request? Please open an issue on GitHub with:
- A clear description of the problem
- Steps to reproduce it
- Your browser and OS version
- Screenshots (if applicable)

### Submitting Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request with a clear description

### Development Setup
```bash
# Clone the repo
git clone https://github.com/jayjay-101/semester-stacker-mahe.git

# Make your changes to the source files

# Load unpacked extension in Chrome:
# 1. chrome://extensions/
# 2. Enable "Developer mode"
# 3. "Load unpacked" → select the repo folder

# Test your changes and submit a PR!
```

---

## 🎓 Other Projects

Check out our other open-source extensions for students:

- **Educational Course Organizer** (for Coursera)
  https://chromewebstore.google.com/detail/educational-course-organi/ppklghfeimkkbaehkecidamheemanfjm

- **AutoReviewer** (for Coursera)
  https://chromewebstore.google.com/detail/autoreviewer/cmgmpafakddcjhpfadpojafmnipgholj

---

## 📄 License

This project is open source and available under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

**Semester Stacker for MAHE** is an educational tool designed to help students manage their lecture materials offline. Users are solely responsible for:
- Ensuring they have legitimate access to the content they download
- Complying with MAHE's terms of service and institutional policies
- Respecting copyright and intellectual property rights
- Using the tool only for personal, educational purposes

The developer is not responsible for misuse of this tool. Always verify that your use complies with your institution's policies.

---

## 🙏 Acknowledgments

Built with ❤️ for MAHE students. Thanks to everyone who has tested, provided feedback, and contributed improvements!

---

**Happy studying! Your lectures, your schedule, your success. 🚀**

If you find this tool helpful, please consider:
- ⭐ Starring the repository
- 📤 Sharing with fellow MAHE students
- 💬 Providing feedback and suggestions
- ☕ Supporting development on Buy Me a Coffee