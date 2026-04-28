importScripts('utils.js', 'storage.js');

const storageManager = globalThis.pageMuteStorageManager;
const ACTION_ICON_PATHS = {
  active: {
    16: 'icons/icon-active-16.png',
    32: 'icons/icon-active-32.png',
    48: 'icons/icon-active-48.png',
    128: 'icons/icon-active-128.png'
  },
  inactive: {
    16: 'icons/icon-inactive-16.png',
    32: 'icons/icon-inactive-32.png',
    48: 'icons/icon-inactive-48.png',
    128: 'icons/icon-inactive-128.png'
  }
};
let initializationPromise = null;

function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = storageManager.init();
  }
  return initializationPromise;
}

function getLocalizedMessage(messageKey) {
  if (!messageKey) {
    return '';
  }

  try {
    return chrome.i18n.getMessage(messageKey) || messageKey;
  } catch (error) {
    return messageKey;
  }
}

function localizeResponse(response) {
  if (!response || response.success || response.message || !response.messageKey) {
    return response;
  }

  return {
    ...response,
    message: getLocalizedMessage(response.messageKey)
  };
}

async function initBackground() {
  await ensureInitialized();
  await storageManager.resetSessionStats();
  await refreshAllActionIcons();
  console.log('Page Mute Tool initialized');
}

chrome.runtime.onInstalled.addListener(() => {
  initBackground();
});

chrome.runtime.onStartup.addListener(() => {
  initBackground();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateActionIconForTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateActionIcon(tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

async function getTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch (error) {
    return null;
  }
}

async function getAllTabs() {
  try {
    return await chrome.tabs.query({});
  } catch (error) {
    return [];
  }
}

async function updateActionIcon(tabId, url, ancestorOrigins = [], pageState = null) {
  if (!tabId) {
    return;
  }

  try {
    const state = pageState || (url
      ? await storageManager.getPageState(url, ancestorOrigins)
      : { active: false });
    await chrome.action.setIcon({
      tabId,
      path: state.active ? ACTION_ICON_PATHS.active : ACTION_ICON_PATHS.inactive
    });
  } catch (error) {
  }
}

async function updateActionIconForTab(tabId) {
  const tab = await getTab(tabId);
  if (!tab) {
    return;
  }
  await updateActionIcon(tabId, tab.url);
}

async function refreshAllActionIcons() {
  const tabs = await getAllTabs();
  await Promise.all(tabs.map((tab) => updateActionIcon(tab.id, tab.url)));
}

async function refreshIconsAfterRuleChange(response) {
  if (response.success) {
    await refreshAllActionIcons();
  }
  return localizeResponse(response);
}

async function handleMessage(message, sender, sendResponse) {
  await ensureInitialized();
  const data = message.data || {};

  switch (message.type) {
    case 'GET_DOMAINS':
      sendResponse({ success: true, domains: await storageManager.getDomains() });
      break;

    case 'ADD_DOMAIN': {
      const validation = Utils.validateDomain(data.pattern);
      if (!validation.valid) {
        sendResponse(localizeResponse({ success: false, messageKey: validation.messageKey }));
        return;
      }
      sendResponse(await refreshIconsAfterRuleChange(
        await storageManager.addDomain(data.pattern, data.description)
      ));
      break;
    }

    case 'REMOVE_DOMAIN':
      sendResponse(await refreshIconsAfterRuleChange(await storageManager.removeDomain(data.id)));
      break;

    case 'UPDATE_DOMAIN':
      sendResponse(await refreshIconsAfterRuleChange(await storageManager.updateDomain(data.id, data.updates)));
      break;

    case 'TOGGLE_DOMAIN':
      sendResponse(await refreshIconsAfterRuleChange(await storageManager.toggleDomain(data.id)));
      break;

    case 'CLEAR_DOMAINS':
      sendResponse(await refreshIconsAfterRuleChange(await storageManager.clearDomains()));
      break;

    case 'SET_GLOBAL_ENABLED':
      sendResponse(await refreshIconsAfterRuleChange(await storageManager.setGlobalEnabled(data.enabled)));
      break;

    case 'GET_GLOBAL_ENABLED':
      sendResponse({ success: true, enabled: await storageManager.getGlobalEnabled() });
      break;

    case 'GET_PAGE_STATE': {
      const pageState = await storageManager.getPageState(data.url, data.ancestorOrigins);
      const tabIdForIcon = data.tabId || (sender.frameId === 0 ? sender.tab?.id : null);
      await updateActionIcon(tabIdForIcon, data.url, data.ancestorOrigins, pageState);
      sendResponse({
        success: true,
        ...pageState
      });
      break;
    }

    case 'GET_SETTINGS':
      sendResponse({ success: true, settings: await storageManager.getSettings() });
      break;

    case 'SET_SETTINGS':
      sendResponse({ success: true, settings: await storageManager.setSettings(data.settings) });
      break;

    case 'INCREMENT_BLOCK_COUNT':
      sendResponse({ success: true, stats: await storageManager.incrementBlockCount() });
      break;

    case 'GET_STATS':
      sendResponse({ success: true, stats: await storageManager.getStats() });
      break;

    case 'EXPORT_DATA':
      sendResponse({ success: true, data: await storageManager.exportData() });
      break;

    case 'IMPORT_DATA':
      sendResponse(await refreshIconsAfterRuleChange(await storageManager.importData(data.jsonData)));
      break;

    case 'CHECK_DOMAIN_MATCH': {
      const matched = (data.domains || []).some((domain) =>
        domain.enabled && Utils.matchesDomain(data.url, domain.pattern)
      );
      sendResponse({ success: true, matched });
      break;
    }

    case 'USER_INTERACTED':
      console.log('User interacted with page:', sender.tab?.url);
      sendResponse({ success: true });
      break;

    default:
      sendResponse(localizeResponse({ success: false, messageKey: 'errorUnknownMessageType' }));
  }
}

ensureInitialized();
