# Page Mute Tool

A Chrome browser extension that blocks media autoplay on specified domains, forcing manual play.

## Features

- **Domain Management** — Add, remove, enable/disable, import/export target domain rules
- **Media Autoplay Blocking** — Block audio, video, and iframe-based media autoplay independently
- **Wildcard Domain Support** — Use `*.example.com` to cover all subdomains
- **Real-Time Status** — Toolbar icon switches between active/inactive states per tab
- **Quick Add** — Add the current domain to the managed list with one click from the popup
- **Statistics** — Track blocked autoplay counts (total and per-session)
- **Data Import/Export** — Back up and restore domain rules and settings as JSON
- **i18n** — Built-in Simplified Chinese and English, auto-detected from browser language

## Installation

### From Chrome Web Store

*(Coming soon)*

### Local Development Mode

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the repository root directory
6. The extension icon will appear in the toolbar

## Usage

### Popup (Toolbar Icon)

1. Click the extension icon in the Chrome toolbar
2. View the **current domain** status — active or inactive
3. Click **Add Current Domain** to quickly add it to the managed list
4. Manually type a domain pattern and click **Add**
5. Manage the domain list: toggle on/off, delete entries
6. Use **Import / Export** to back up or restore your domain rules
7. Click the **⚙️** icon to open the settings page

### Domain Patterns

| Pattern | Matches |
|---------|---------|
| `example.com` | `example.com` only |
| `*.example.com` | All subdomains such as `www.example.com`, `cdn.example.com` |
| `localhost` | Local development with optional port |

### Settings Page (Options)

Right-click the toolbar icon → **Options**, or click **⚙️** in the popup.

**General Settings tab:**
- Block audio autoplay
- Block video autoplay
- Block media autoplay in iframes
- **Save Settings** — persist current checkbox selections
- **Restore Defaults** — reset all settings to their original values

**Domain Management tab:**
- Add domain patterns with optional descriptions
- Toggle individual domains on/off
- Delete domains
- Import / Export domain rules as JSON
- Clear all domains at once

**About tab:**
- Version, author, license, and changelog information

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store domain rules, settings, and statistics locally |
| `activeTab` | Access the current tab for URL detection and icon updates |
| `<all_urls>` | Inject content scripts on all sites to block media autoplay |

No data is ever collected or transmitted. All data stays in your browser.

## Privacy Policy

This extension does **not** collect, store, or transmit any personal browsing data. All configuration and statistics are stored locally in Chrome's built-in storage. The source code is open and available for audit.

- [中文隐私政策](docs/privacy-policy-zh.md)
- [Privacy Policy (English)](docs/privacy-policy-en.md)

## Project Structure

```
page-mute-tool/
├── manifest.json             # Extension manifest (Manifest V3)
├── _locales/                 # Chrome i18n message catalogs
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── background.js             # Service worker — message routing, icon state
├── content-bridge.js         # Content script proxy (ISOLATED world)
├── page-hook.js              # Main-world script — DOM mutation observation
├── media-controller.js       # Media autoplay interception (MAIN world)
├── content.js                # Orchestrates bridging and messaging
├── popup.html / popup.js / popup.css     # Toolbar popup UI
├── options.html / options.js / options.css # Settings page UI
├── storage.js                # chrome.storage persistence layer
├── utils.js                  # Shared utility functions
├── i18n.js                   # Internationalization helper
├── icons/                    # Extension and state icons (PNG)
├── store-assets/             # Chrome Web Store listing assets (not packaged)
├── docs/                     # Privacy policy documents
├── dist/                     # Release packages (ZIP)
├── README.md                 # This file
├── CHANGELOG.md              # Release changelog
└── LICENSE                   # MIT License
```

## Technical Architecture

- **Manifest V3** — Latest Chrome extension platform
- **Service Worker** — Lightweight background process for message routing
- **Content Scripts** — Two-world approach:
  - `MAIN` world: `media-controller.js` + `page-hook.js` for direct DOM/media interception
  - `ISOLATED` world: `content-bridge.js` for chrome.runtime communication
- **MutationObserver** — Dynamically detect and handle media elements added after page load
- **chrome.storage.sync** — Persistent domain rules and settings
- **chrome.i18n** — Built-in Chrome internationalization API
- **No external dependencies** — Pure vanilla JavaScript, HTML, and CSS

## Browser Support

- Chrome 88+ (minimum required)
- Edge 88+ (Chromium-based)

## Build & Package

This project has no build step. To create a Chrome Web Store package:

```bash
zip -r dist/page-mute-tool-vX.Y.Z-cws.zip \
  manifest.json \
  background.js \
  content.js content-bridge.js media-controller.js page-hook.js \
  popup.html popup.js popup.css \
  options.html options.js options.css \
  storage.js utils.js i18n.js \
  LICENSE \
  _locales/ \
  icons/icon*.png
```

## Contributing

Issues and pull requests are welcome. Please see [AGENTS.md](AGENTS.md) for repository conventions.

## License

MIT License — see [LICENSE](LICENSE) for details.
