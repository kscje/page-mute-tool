# Release Checklist

Use this checklist before publishing a new Chrome Web Store version.

## Version

- [ ] Update `manifest.json` version.
- [ ] Update `CHANGELOG.md`.
- [ ] Confirm release package name, for example `dist/autoplay-blocker-v1.0.4-cws.zip`.

## Code Validation

- [ ] Run `node --check background.js`.
- [ ] Run `node --check popup.js`.
- [ ] Run `node --check options.js`.
- [ ] Run `node --check i18n.js`.
- [ ] Run `node --check storage.js`.
- [ ] Run `node --check utils.js`.

## Manual Chrome Testing

- [ ] Load the unpacked extension in Chrome.
- [ ] Test a matching domain and confirm autoplay is blocked.
- [ ] Test a non-matching domain and confirm the extension remains inactive.
- [ ] Confirm the toolbar icon switches between active and inactive states.
- [ ] Confirm popup current-domain display, add, delete, pagination, and statistics.
- [ ] Confirm options page settings save/restore behavior.
- [ ] Confirm options page domain add, delete, toggle, import, export, and clear behavior.
- [ ] Confirm Chinese UI in a Chinese browser language environment.
- [ ] Confirm English UI in a non-Chinese browser language environment.
- [ ] Check the extension service worker console for errors.
- [ ] Check the tested page console for extension-related errors.

## Store Assets

- [ ] Confirm Chinese screenshots are up to date.
- [ ] Confirm English screenshots are up to date.
- [ ] Confirm small promotional tile is up to date.
- [ ] Confirm Chinese and English listing drafts are up to date.
- [ ] Confirm Chinese and English privacy policies are up to date.

## Package

- [ ] Rebuild the Chrome Web Store ZIP package.
- [ ] Run `unzip -t <package-path>`.
- [ ] Confirm the ZIP excludes drafts, candidate images, development notes, and unrelated files.
- [ ] Upload the ZIP to Chrome Web Store Developer Dashboard.
- [ ] Submit for review.

## Post-Release

- [ ] Create a Git tag for the released version.
- [ ] Record Chrome Web Store submission date.
- [ ] Monitor review feedback and user reports.
