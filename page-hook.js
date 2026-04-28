const PAGE_MUTE_BRIDGE_ID = 'page-mute-bridge';
let mediaController = null;
let currentPageState = null;
let pendingRequests = new Map();
let requestIdCounter = 0;

function sendToExtension(type, data = {}) {
  const messageId = `req_${++requestIdCounter}`;
  return new Promise((resolve) => {
    pendingRequests.set(messageId, resolve);
    window.postMessage({
      bridge: PAGE_MUTE_BRIDGE_ID,
      direction: 'to-extension',
      messageId,
      type,
      data
    }, '*');

    setTimeout(() => {
      if (pendingRequests.has(messageId)) {
        pendingRequests.delete(messageId);
        resolve({ success: false });
      }
    }, 5000);
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }

  if (!event.data || event.data.bridge !== PAGE_MUTE_BRIDGE_ID) {
    return;
  }

  if (event.data.direction === 'to-page') {
    if (event.data.messageId && pendingRequests.has(event.data.messageId)) {
      const resolve = pendingRequests.get(event.data.messageId);
      pendingRequests.delete(event.data.messageId);
      resolve(event.data.response || { success: false });
    }

    if (event.data.type === 'PAGE_MUTE_REFRESH') {
      applyPageState(true);
    }

    if (event.data.type === 'INIT_PAGE_STATE') {
      handleInitPageState(event.data.response);
    }
  }
});

function handleInitPageState(response) {
  if (!response || !response.success) {
    return;
  }
  applyState(response);
}

async function fetchPageState() {
  const response = await sendToExtension('GET_PAGE_STATE', {
    url: window.location.href,
    ancestorOrigins: getAncestorOrigins()
  });

  if (!response || !response.success) {
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

function shouldRecreateController(nextState) {
  if (!mediaController || !currentPageState) {
    return true;
  }
  return JSON.stringify(currentPageState.settings) !== JSON.stringify(nextState.settings);
}

function applyState(state) {
  if (!state) {
    return;
  }

  currentPageState = state;

  if (!state.active) {
    teardownController();
    return;
  }

  const recreate = shouldRecreateController(state);

  if (recreate) {
    teardownController();
    mediaController = new MediaController(state.settings);
    mediaController.init();
    return;
  }

  mediaController.updateSettings(state.settings);
}

async function applyPageState(force = false) {
  const nextState = await fetchPageState();
  if (!nextState) {
    return;
  }
  applyState(nextState);
}

function teardownController() {
  if (!mediaController) {
    return;
  }
  mediaController.cleanup();
  mediaController = null;
}

function resetPageControllerState() {
  if (mediaController) {
    mediaController.resetInteraction();
  }
}

window.addEventListener('pageshow', () => {
  applyPageState(true);
  resetPageControllerState();
});

window.addEventListener('pagehide', () => {
  resetPageControllerState();
});
