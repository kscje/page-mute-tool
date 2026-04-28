# Chrome Web Store Listing Draft

## Basic

Name:
Page Mute Tool

Short description:
Block media autoplay on selected domains and keep playback under your control.

Detailed description:
Page Mute Tool helps you prevent unwanted media autoplay on websites you choose. Add the current domain from the toolbar popup, manage domain rules in the options page, and keep audio and video playback quiet until you interact with the page.

Key features:
- Add the current website domain from the toolbar popup.
- Manage exact and wildcard domains from the options page.
- Block audio, video, and iframe media autoplay before user interaction.
- Import, export, and clear domain rules from settings.
- Show active/inactive toolbar icons based on whether the current domain is enabled.
- Store settings locally with Chrome storage. No remote tracking or analytics.

## Category

Productivity

## Language

Chinese (Simplified) and English are supported in the extension UI.

## Privacy Practices

Purpose:
The extension uses the current page URL only to determine whether the user-added domain rules should apply.

Data handling:
- Domain rules and settings are stored using `chrome.storage`.
- The extension does not collect, sell, transmit, or share browsing data with any remote server.
- The extension does not use analytics, ads, or external network requests.

Host permission justification:
`<all_urls>` is required so the content script can detect and block media autoplay on any website the user adds to the managed domain list.

Storage permission justification:
`storage` is required to save domain rules, settings, and local block statistics.

Active tab permission justification:
`activeTab` is used to read the current tab context for popup actions such as adding the current domain and refreshing the current page state.

## Assets

Upload package:
`dist/page-mute-tool-v1.0.0-cws.zip`

Small promotional tile:
`store-assets/small-promo-440x280.png`

Screenshots:
`store-assets/screenshot-popup-1280x800.png`
`store-assets/screenshot-options-1280x800.png`

Icon:
`icons/icon128.png`

## Recommended Manual Test Notes

- Load the unpacked extension in Chrome.
- Add a matching domain and confirm autoplay is blocked before user interaction.
- Test a non-matching domain and confirm the extension remains inactive.
- Confirm toolbar icon changes between active and inactive states.
- Confirm popup add/delete domain behavior.
- Confirm options page import, export, clear, and domain toggle behavior.
