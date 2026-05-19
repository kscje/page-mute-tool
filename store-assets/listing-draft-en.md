# Chrome Web Store Listing Draft

## Basic Information

Name:
Autoplay Blocker

Short description:
Block media autoplay by domain and keep audio and video playback under your control.

Detailed description:
Autoplay Blocker helps you block unwanted media autoplay on websites you choose. You can quickly add the current domain from the toolbar popup, or manage all domain rules from the settings page. The extension keeps audio and video quiet before you interact with the page, reducing interruptions caused by automatic playback.

Key features:
- Add the current website domain from the toolbar popup.
- Manage exact and wildcard domain rules from the settings page.
- Block audio, video, and iframe media autoplay before user interaction.
- Import, export, and clear domain rules from the settings page.
- Automatically switch the toolbar icon based on whether the current domain is enabled.
- Store settings locally with Chrome storage; no remote tracking or analytics.

## Category

Productivity

## Language

The extension UI supports Simplified Chinese and English.

## Privacy Practices

Purpose:
The extension uses the current page URL/domain only to determine whether user-added domain rules should apply to the current website.

Data handling:
- Domain rules and settings are stored using `chrome.storage`.
- The extension does not collect, sell, transmit, or share browsing data with any remote server.
- The extension does not use analytics, advertising, or external network requests.

Host permission justification:
`<all_urls>` is required so the content script can detect and block media autoplay on websites the user adds to the managed domain list.

Storage permission justification:
`storage` is required to save domain rules, settings, and local block statistics.

Active tab permission justification:
`activeTab` is used to read the current tab context for popup actions such as adding the current domain and refreshing the current page state.

## Assets

Upload package:
`dist/autoplay-blocker-v1.0.3-cws.zip`

Small promotional tile:
`store-assets/small-promo-440x280.png`

Screenshots:
`store-assets/intro-popup-1280x800.png`
`store-assets/intro-options-1280x800.png`

Icon:
`icons/icon128.png`

## Recommended Manual Test Notes

- Load the unpacked extension in Chrome.
- Add a matching domain and confirm autoplay is blocked before user interaction.
- Test a non-matching domain and confirm the extension remains inactive.
- Confirm the toolbar icon changes between active and inactive states.
- Confirm popup add/delete domain behavior.
- Confirm settings page import, export, clear, and domain enable/disable behavior.
