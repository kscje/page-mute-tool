const PAGE_MUTE_BRIDGE_ID = 'page-mute-bridge';
let pageMuteBridgeActive = true;

function isExtensionContextError(error) {
  return /Extension context invalidated|context invalidated/i.test(error?.message || '');
}

function deactivateBridge(error) {
  if (isExtensionContextError(error)) {
    pageMuteBridgeActive = false;
  }
}

function getRuntime() {
  try {
    if (!pageMuteBridgeActive || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return null;
    }
    return chrome.runtime;
  } catch (error) {
    deactivateBridge(error);
    return null;
  }
}

function postToPage(payload) {
  window.postMessage({
    bridge: PAGE_MUTE_BRIDGE_ID,
    direction: 'to-page',
    ...payload
  }, '*');
}

function sendRuntimeMessage(message, messageId, pageType) {
  const runtime = getRuntime();
  if (!runtime) {
    postToPage({
      messageId,
      type: pageType,
      response: { success: false }
    });
    return;
  }

  try {
    runtime.sendMessage(message, (response) => {
      let lastError = null;
      try {
        lastError = chrome.runtime.lastError;
      } catch (error) {
        deactivateBridge(error);
        lastError = error;
      }

      if (lastError) {
        deactivateBridge(lastError);
      }

      postToPage({
        messageId,
        type: pageType,
        response: response || { success: false, message: lastError?.message }
      });
    });
  } catch (error) {
    deactivateBridge(error);
    postToPage({
      messageId,
      type: pageType,
      response: { success: false, message: error.message }
    });
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data && event.data.bridge === PAGE_MUTE_BRIDGE_ID && event.data.direction === 'to-extension') {
    const { messageId, type, data } = event.data;
    sendRuntimeMessage({ type, data }, messageId);
  }
});

const runtime = getRuntime();
if (runtime) {
  try {
    runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PAGE_MUTE_REFRESH') {
        postToPage({ type: 'PAGE_MUTE_REFRESH' });
        sendResponse({ success: true });
      }
    });
  } catch (error) {
    deactivateBridge(error);
  }
}

sendRuntimeMessage(
  { type: 'GET_PAGE_STATE', data: { url: window.location.href, ancestorOrigins: getAncestorOrigins() } },
  undefined,
  'INIT_PAGE_STATE'
);

function getAncestorOrigins() {
  try {
    if (!window.location.ancestorOrigins) {
      return [];
    }
    return Array.from(window.location.ancestorOrigins);
  } catch (error) {
    return [];
  }
}
