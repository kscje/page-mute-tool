# Changelog

All notable changes to Autoplay Blocker are documented here.

## v1.0.5 - 2026-09-19

### Fixed
- Fixed manual playback being blocked on YouTube's updated watch page player, where the `<video>` element is positioned outside the visible player area so play-button clicks never matched the media-element hit test.
- Trusted user gestures anywhere on the page now open a short (1.5s) playback grace window, so `play()` calls issued within the same interaction are honored. The window is non-sticky: unrelated page clicks still do not permanently release blocked media (v1.0.4 behavior preserved).
- Redundant `play()` calls on media that is already playing no longer pause active playback.
- Playback started with a user gesture is no longer re-muted by later media events (e.g. `volumechange`, `canplay`).

## v1.0.4 - 2026-07-07

### Fixed
- Fixed X.com videos being released by unrelated page clicks after autoplay was blocked.
- Return a `NotAllowedError` when autoplay `play()` calls are blocked, matching browser autoplay blocking semantics.

## v1.0.3 - 2026-05-19

### Changed
- Renamed the English extension name to `Autoplay Blocker`.
- Renamed the Simplified Chinese extension name to `网站自动播放拦截器`.
- Updated localized manifest messages, popup/settings titles, store listing drafts, privacy policy drafts, and release package references for the Chrome Web Store submission.

## v1.0.2 - 2026-05-12

### Fixed
- Fixed the "Restore Defaults" button on the options page, which was completely non-functional due to a parameter-passing bug. The button now correctly resets all settings (blockAudio, blockVideo, blockIframe) to their default values and provides user-facing success/error feedback.
- Added missing `content.js` to the Chrome Web Store distribution package.
- Cleaned up the distribution ZIP to exclude development-only files (SVG source icons, candidate/preview PNGs, .DS_Store).

### Added
- Success and error toast messages for Save Settings and Restore Defaults operations.
- New i18n keys: `successRestoreDefaults`, `errorSaveFailed`, `errorRestoreDefaultsFailed` (Chinese and English).
- Updated `_locales/en/messages.json` and `_locales/zh_CN/messages.json` with the new message keys.

### Changed
- Updated `README.md` to accurately reflect the current project structure, features, permissions, and settings UI.
- Updated `_locales` Chrome i18n message catalogs with new keys.
- Improved `saveSettings()` to accept optional `newSettings` and `silent` parameters for flexible invocation.

## v1.0.0 - 2026-04-28

### Added
- Domain-based media autoplay blocking for audio, video, and iframe media.
- Popup UI for viewing the current domain and quickly adding it to the managed domain list.
- Options page with domain management, import/export, and settings controls.
- Exact and wildcard (`*.example.com`) domain pattern support.
- Toolbar icon state switching between active and inactive based on the current tab's domain.
- Simplified Chinese and English localization with automatic browser-language detection.
- Domain rule import/export as JSON, clear all, delete, and enable/disable controls.
- Local-only storage for rules, settings, and blocking statistics (total + per-session).
- Chrome Web Store package and listing assets.
- Two-world content script architecture (MAIN + ISOLATED) for robust media interception.
