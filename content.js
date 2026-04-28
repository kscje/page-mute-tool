let currentPageState = null;
const PAGE_MUTE_STATE_EVENT = 'page-mute-state';
const PAGE_MUTE_RESET_EVENT = 'page-mute-reset-interaction';
let pageMuteContentActive = true;

function isExtensionContextError(error) {
  return /Extension context invalidated|context invalidated/i.test(error?.message || '');
}

function deactivateContent(error) {
  if (isExtensionContextError(error)) {
    pageMuteContentActive = false;
  }
}

function getRuntime() {
  try {
    if (!pageMuteContentActive || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return null;
    }
    return chrome.runtime;
  } catch (error) {
    deactivateContent(error);
    return null;
  }
}

async function sendRuntimeMessage(type, data = {}) {
  return new Promise((resolve) => {
    const runtime = getRuntime();
    if (!runtime) {
      resolve({ success: false });
      return;
    }

    try {
      runtime.sendMessage({ type, data }, (response) => {
        let lastError = null;
        try {
          lastError = chrome.runtime.lastError;
        } catch (error) {
          deactivateContent(error);
          lastError = error;
        }

        if (lastError) {
          deactivateContent(lastError);
        }

        resolve(response || { success: false, message: lastError?.message });
      });
    } catch (error) {
      deactivateContent(error);
      resolve({ success: false, message: error.message });
    }
  });
}

async function fetchPageState() {
  const response = await sendRuntimeMessage('GET_PAGE_STATE', {
    url: window.location.href,
    ancestorOrigins: getAncestorOrigins()
  });

  if (!response.success) {
    return null;
  }

  return response;
}

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

async function applyPageState(force = false) {
  const nextState = await fetchPageState();
  if (!nextState) {
    return;
  }

  currentPageState = nextState;
  broadcastPageState({
    active: nextState.active,
    settings: nextState.settings,
    force
  });
}

function broadcastPageState(detail) {
  window.dispatchEvent(
    new CustomEvent(PAGE_MUTE_STATE_EVENT, {
      detail
    })
  );
}

function resetPageControllerState() {
  window.dispatchEvent(new CustomEvent(PAGE_MUTE_RESET_EVENT));
}

const runtime = getRuntime();
if (runtime) {
  try {
    runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PAGE_MUTE_REFRESH') {
        applyPageState(true);
        sendResponse({ success: true });
      }
    });
  } catch (error) {
    deactivateContent(error);
  }
}

applyPageState(true);

window.addEventListener('pageshow', () => {
  applyPageState(true);
  resetPageControllerState();
});

window.addEventListener('pagehide', () => {
  resetPageControllerState();
});
