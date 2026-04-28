# Repository Guidelines

## Project Structure & Module Organization
This repository is a plain Chrome Extension (Manifest V3) with no build step. Core runtime files live at the repo root:

- `manifest.json`: extension entrypoint and permissions
- `background.js`: service worker, message routing, storage bootstrap
- `content.js` and `media-controller.js`: page-level autoplay blocking logic
- `popup.html` / `popup.js` / `popup.css`: toolbar popup UI
- `options.html` / `options.js` / `options.css`: settings UI
- `storage.js` and `utils.js`: shared persistence and helper logic
- `icons/`: extension icons and state assets

Keep related HTML, CSS, and JS changes together when updating popup or options behavior.

## Build, Test, and Development Commands
There is no bundler or package script in this project. Use Chrome’s extension loader directly:

- `open chrome://extensions/`: open the Extensions page
- Enable `Developer mode`, then choose `Load unpacked`
- Select this repository root: `Page Mute Tool/`
- Use `Reload` in Chrome after code changes

For quick inspection from the terminal:

- `cat manifest.json`: verify extension metadata
- `rg "sendMessage|onMessage"`: trace runtime message flow

## Coding Style & Naming Conventions
Use vanilla JavaScript, HTML, and CSS only. Follow the existing style:

- 2-space indentation
- Semicolons enabled
- `camelCase` for variables, methods, and message payload fields
- `PascalCase` for classes such as `PopupManager`
- kebab-case for asset filenames like `icon-active.svg`

Prefer small, focused methods and reuse shared logic from `utils.js` or `storage.js` before adding duplicate helpers.

## Testing Guidelines
Automated tests are not set up yet. Validate changes manually in Chrome:

- reload the unpacked extension
- test a matching domain and a non-matching domain
- verify popup actions, options page changes, and persisted `chrome.storage` data
- check the service worker and page console for errors

When adding features, include a short manual test note in the PR.

## Commit & Pull Request Guidelines
This repository currently has no commit history, so use a simple imperative style for commits, for example: `Add wildcard domain validation`.

Pull requests should include:

- a short summary of behavior changes
- manual test steps and results
- linked issue, if any
- screenshots or screen recordings for popup/options UI changes

## Security & Configuration Tips
This extension runs on `<all_urls>`. Keep permissions minimal, avoid adding remote dependencies, and do not introduce any network collection of browsing data. Treat storage schema changes carefully so existing user settings remain readable.
