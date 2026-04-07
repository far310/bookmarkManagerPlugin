# Release v1.7.0 - Distribution Packages

**Release Date:** April 7, 2026  
**Version:** 1.7.0

---

## 📦 Available Packages

### 1. **bookmark-manager-chrome-v1.7.0.zip** (243 KB)
**For Chrome Web Store Upload**
- Contains: Compiled Chrome extension ready for upload
- Use this if: You're uploading to Chrome Web Store
- Extract and use the inner `dist_chrome` folder for local installation

### 2. **bookmark-manager-firefox-v1.7.0.zip** (243 KB)
**For Firefox Add-ons Upload**
- Contains: Compiled Firefox extension ready for upload
- Use this if: You're uploading to Firefox Add-ons
- Extract and use the inner `dist_firefox` folder for local installation

### 3. **bookmark-manager-source-v1.7.0.tar.gz** (533 KB)
**Complete Source Code**
- Contains: Source code + both Chrome & Firefox builds
- Use this if: You want to fork/modify the project
- Includes: `src/`, `dist_chrome/`, `dist_firefox/`, `manifest.json`, `README.md`, `package.json`

### 4. **bookmark-manager-v1.7.0.tar.gz** (476 KB)
**Original Distribution Package**
- Legacy package format combining all builds

---

## 🚀 Installation Instructions

### Chrome Extension (unpacked mode)

```bash
# Method 1: Using ZIP from this release
unzip bookmark-manager-chrome-v1.7.0.zip
# Then load dist_chrome/ as unpacked extension

# Method 2: Using source package
tar -xzf bookmark-manager-source-v1.7.0.tar.gz
cd dist_chrome
# Then load unpacked in Chrome
```

**Steps:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist_chrome` folder

### Firefox Extension (unpacked mode)

```bash
# Extract Firefox build
unzip bookmark-manager-firefox-v1.7.0.zip
# Then load dist_firefox/manifest.json as temporary addon
```

**Steps:**
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `dist_firefox/manifest.json`

### For Store Submissions

**Chrome Web Store:**
- Upload `bookmark-manager-chrome-v1.7.0.zip`
- Version: 1.7.0
- Category: Productivity

**Firefox Add-ons:**
- Upload `bookmark-manager-firefox-v1.7.0.zip`
- Version: 1.7.0
- Category: Bookmarks

---

## ✨ What's New in v1.7.0

🔍 **Browser History Search**
- Search browser visit history alongside bookmarks
- Results organized in two sections: Bookmarks & History

🎨 **UI Optimization**
- Redesigned with shadcn/ui components
- Better responsive design
- Improved accessibility

🖱️ **Enhanced Context Menus**
- Right-click to: open, copy, rename, move, delete
- Hover quick actions (rename, delete icons)

📱 **Cross-Platform**
- Works on Chrome & Firefox
- Same feature set on both browsers

---

## 📋 File Checksums (SHA256)

```
Chrome ZIP:   bookmark-manager-chrome-v1.7.0.zip
Firefox ZIP:  bookmark-manager-firefox-v1.7.0.zip
Source:       bookmark-manager-source-v1.7.0.tar.gz
Full Package: bookmark-manager-v1.7.0.tar.gz
```

Generate checksums:
```bash
sha256sum *.zip *.tar.gz
```

---

## 💡 Troubleshooting

**Extension not loading?**
- Ensure you extracted the ZIP and selected the correct folder
- Refresh the extension (F5 or reload button in extensions page)
- Check console for errors (open extension popup + press F12)

**Browser history search not working?**
- Grant "History" permission when prompted
- Reload the extension

**404 errors on pages?**
- This is normal for content script context limitations
- Does not affect bookmark/history functionality

---

## 🔗 Links

- Source Repository: https://github.com/far310/bookmarkManagerPlugin
- GitHub Release: https://github.com/far310/bookmarkManagerPlugin/releases/tag/v1.7.0
- Changelog: See `v1.7.0-CHANGELOG.md`

---

For development and contributing, see the main README.md
