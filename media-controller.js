const PAGE_MUTE_MEDIA_DEFAULT_SETTINGS =
  typeof PAGE_MUTE_DEFAULT_SETTINGS !== 'undefined'
    ? PAGE_MUTE_DEFAULT_SETTINGS
    : {
        blockAudio: true,
        blockVideo: true,
        blockIframe: true
      };

class MediaController {
  constructor(settings = {}) {
    this.settings = {
      ...PAGE_MUTE_MEDIA_DEFAULT_SETTINGS,
      ...(settings || {})
    };
    this.hasUserInteracted = false;
    this.lastTrustedInteractionAt = 0;
    this.blockedCount = 0;
    this.observer = null;
    this.processedElements = new WeakSet();
    this.managedElements = new Set();
    this.elementState = new WeakMap();
    this.cleanupTasks = [];
    this.pendingNodes = new Set();
    this.flushPendingNodes = this.createMutationFlusher();
    this.originalPrototypePlay = null;
  }

  async init() {
    this.installGlobalMediaHooks();
    this.setupEventListeners();
    this.scanExistingMedia();
    this.setupMutationObserver();
  }

  resetInteraction() {
    this.hasUserInteracted = false;
    this.lastTrustedInteractionAt = 0;
    this.scanExistingMedia();
  }

  updateSettings(settings = {}) {
    this.settings = {
      ...this.settings,
      ...(settings || {})
    };
  }

  createBlockedPlayResult() {
    return Promise.resolve();
  }

  sendRuntimeMessage(message) {
    try {
      const bridgeId = 'page-mute-bridge';
      window.postMessage({
        bridge: bridgeId,
        direction: 'to-extension',
        messageId: `mc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: message.type,
        data: message
      }, '*');
    } catch (error) {
    }
  }

  createMutationFlusher() {
    const flush = () => {
      const nodes = Array.from(this.pendingNodes);
      this.pendingNodes.clear();
      nodes.forEach((node) => this.scanNode(node));
    };
    return flush;
  }

  setupEventListeners() {
    const userEvents = ['pointerdown', 'click', 'touchstart', 'keydown'];
    userEvents.forEach((eventType) => {
      const useCapture = eventType === 'pointerdown' || eventType === 'keydown';
      document.addEventListener(
        eventType,
        (event) => this.handleUserInteraction(event),
        useCapture ? { capture: true, passive: true } : { once: true, passive: true }
      );
    });
  }

  handleUserInteraction(event) {
    if (event && event.isTrusted) {
      this.lastTrustedInteractionAt = Date.now();
    }

    if (this.hasUserInteracted) {
      return;
    }

    this.hasUserInteracted = true;
    this.restoreManagedMediaState();
    this.sendRuntimeMessage({
      type: 'USER_INTERACTED',
      timestamp: Date.now()
    });
  }

  scanExistingMedia() {
    this.scanNode(document);
  }

  scanNode(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    this.scanMediaElements(root);
    this.scanShadowDOM(root);
  }

  scanMediaElements(root) {
    root.querySelectorAll('video, audio').forEach((element) => {
      if (this.shouldManageElement(element)) {
        this.blockMediaAutoplay(element);
      }
    });

    if (this.settings.blockIframe) {
      root.querySelectorAll('iframe').forEach((iframe) => {
        this.handleIframe(iframe);
      });
    }
  }

  shouldManageElement(mediaElement) {
    if (mediaElement.tagName === 'AUDIO') {
      return this.settings.blockAudio;
    }
    if (mediaElement.tagName === 'VIDEO') {
      return this.settings.blockVideo;
    }
    return true;
  }

  scanShadowDOM(root) {
    root.querySelectorAll('*').forEach((element) => {
      if (element.shadowRoot) {
        this.scanMediaElements(element.shadowRoot);
        this.scanShadowDOM(element.shadowRoot);
      }
    });
  }

  setupMutationObserver() {
    const target = document.documentElement || document;
    if (!target) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.pendingNodes.add(node);
          }
        });
      });

      if (this.pendingNodes.size > 0) {
        this.flushPendingNodes();
      }
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  blockMediaAutoplay(mediaElement) {
    if (this.processedElements.has(mediaElement)) {
      return;
    }
    this.processedElements.add(mediaElement);

    const originalMuted = mediaElement.muted;
    const originalDefaultMuted = mediaElement.defaultMuted;
    const originalVolume = mediaElement.volume;
    const state = {
      originalMuted,
      originalDefaultMuted,
      originalVolume,
      preferredVolume: originalVolume > 0 ? originalVolume : 1
    };

    this.managedElements.add(mediaElement);
    this.elementState.set(mediaElement, state);

    mediaElement.dataset.pageMuteManaged = 'true';
    mediaElement.removeAttribute('autoplay');
    mediaElement.autoplay = false;

    this.enforcePreInteractionSilence(mediaElement);

    const onPlay = () => {
      this.enforcePreInteractionSilence(mediaElement);
      if (!this.hasUserInteracted && this.shouldManageElement(mediaElement)) {
        mediaElement.pause();
      }
    };
    const onVolumeChange = () => {
      this.enforcePreInteractionSilence(mediaElement);
    };
    const onMediaStateChange = () => {
      this.enforcePreInteractionSilence(mediaElement);
    };

    mediaElement.addEventListener('play', onPlay, true);
    mediaElement.addEventListener('volumechange', onVolumeChange, true);
    mediaElement.addEventListener('loadstart', onMediaStateChange, true);
    mediaElement.addEventListener('loadedmetadata', onMediaStateChange, true);
    mediaElement.addEventListener('canplay', onMediaStateChange, true);
    mediaElement.addEventListener('emptied', onMediaStateChange, true);
    this.cleanupTasks.push(() => {
      mediaElement.removeEventListener('play', onPlay, true);
      mediaElement.removeEventListener('volumechange', onVolumeChange, true);
      mediaElement.removeEventListener('loadstart', onMediaStateChange, true);
      mediaElement.removeEventListener('loadedmetadata', onMediaStateChange, true);
      mediaElement.removeEventListener('canplay', onMediaStateChange, true);
      mediaElement.removeEventListener('emptied', onMediaStateChange, true);
      this.restoreOriginalState(mediaElement);
      this.managedElements.delete(mediaElement);
      this.elementState.delete(mediaElement);
    });

    if (mediaElement.readyState > 0) {
      mediaElement.pause();
    }
  }

  restoreOriginalState(mediaElement) {
    const state = this.elementState.get(mediaElement);
    if (!state) {
      return;
    }

    mediaElement.muted = state.originalMuted;
    mediaElement.defaultMuted = state.originalDefaultMuted;
    mediaElement.volume = state.originalVolume;
    mediaElement.removeAttribute('muted');
  }

  restoreManagedMediaState() {
    this.managedElements.forEach((mediaElement) => {
      const state = this.elementState.get(mediaElement);
      if (!state) {
        return;
      }

      mediaElement.removeAttribute('muted');
      mediaElement.defaultMuted = false;
      mediaElement.muted = false;
      mediaElement.volume = state.preferredVolume;
    });
  }

  enforcePreInteractionSilence(mediaElement) {
    if (this.isPlaybackAllowedByUserGesture() || !this.shouldManageElement(mediaElement)) {
      return;
    }

    mediaElement.defaultMuted = true;
    mediaElement.setAttribute('muted', '');
    mediaElement.muted = true;
  }

  handlePlayAttempt(mediaElement, originalPlay, args) {
    if (!this.shouldManageElement(mediaElement) || this.isPlaybackAllowedByUserGesture()) {
      this.releasePreInteractionSilence(mediaElement);
      mediaElement.removeAttribute('muted');
      return originalPlay(...args);
    }

    mediaElement.pause();
    this.reportBlockedPlay();
    return this.createBlockedPlayResult();
  }

  installGlobalMediaHooks() {
    if (!window.HTMLMediaElement || window.HTMLMediaElement.prototype.__pageMutePlayWrapped) {
      return;
    }

    const controller = this;
    const prototype = window.HTMLMediaElement.prototype;
    const originalPlay = prototype.play;

    this.originalPrototypePlay = originalPlay;

    prototype.play = function pageMutePlayWrapper(...args) {
      return controller.handlePlayAttempt(this, originalPlay.bind(this), args);
    };
    prototype.__pageMutePlayWrapped = true;

    this.cleanupTasks.push(() => {
      if (controller.originalPrototypePlay && prototype.__pageMutePlayWrapped) {
        prototype.play = controller.originalPrototypePlay;
        delete prototype.__pageMutePlayWrapped;
      }
    });
  }

  releasePreInteractionSilence(mediaElement) {
    const state = this.elementState.get(mediaElement);
    const preferredVolume = state?.preferredVolume || 1;

    mediaElement.removeAttribute('muted');
    mediaElement.defaultMuted = false;
    mediaElement.muted = false;
    if (mediaElement.volume === 0 || mediaElement.volume !== preferredVolume) {
      mediaElement.volume = preferredVolume;
    }
  }

  reportBlockedPlay() {
    this.blockedCount += 1;
    this.sendRuntimeMessage({
      type: 'INCREMENT_BLOCK_COUNT'
    });
  }

  isPlaybackAllowedByUserGesture() {
    if (this.hasUserInteracted) {
      return true;
    }

    if (document.userActivation && document.userActivation.isActive) {
      return true;
    }

    return Date.now() - this.lastTrustedInteractionAt < 1500;
  }

  handleIframe(iframe) {
    try {
      if (Utils.isSameOrigin(iframe)) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        this.scanNode(iframeDoc);
      }
    } catch (error) {
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.cleanupTasks.forEach((task) => task());
    this.cleanupTasks = [];
    this.pendingNodes.clear();
    this.managedElements.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaController;
} else {
  globalThis.MediaController = MediaController;
}
