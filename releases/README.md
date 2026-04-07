# Bookmark Manager Plugin - Releases

## Latest Release: v1.7.0

**Released:** April 7, 2026

### What's New

✨ **Browser History Search** - Search your browser visit history alongside bookmarks
🎨 **UI Redesign** - Optimized with shadcn components for better UX
🖱️ **Context Menu** - Right-click any bookmark for quick actions
📱 **Cross-browser** - Works on Chrome and Firefox

### Files

- `bookmark-manager-v1.7.0.tar.gz` - Complete distribution (476 KB)
- `v1.7.0-CHANGELOG.md` - Detailed changelog

### Quick Start

```bash
# Extract the package
tar -xzf bookmark-manager-v1.7.0.tar.gz

# For Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select dist_chrome/ folder

# For Firefox:
# 1. Go to about:debugging
# 2. Click "Load Temporary Add-on"
# 3. Select dist_firefox/manifest.json
```

### Features

- **Dual Search**: Search bookmarks + browser history in one place
- **Smart Results**: Results grouped by type with highlighting
- **Right-Click Actions**: 
  - Open in new tab
  - Copy link
  - Rename
  - Move to folder
  - Delete
- **Hover Quick Actions**: Pencil and trash icons on hover
- **Responsive UI**: Clean, modern interface with Tailwind CSS

### Permissions Required

- `bookmarks` - Access to browser bookmarks
- `history` - Access to browser visit history
- `activeTab` - Open links in new tabs

### Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.7.0 | Apr 7, 2026 | Browser history search, shadcn UI, context menus |
| v1.6.0 | Before | Previous release |

---

For detailed changelog, see `v1.7.0-CHANGELOG.md`
