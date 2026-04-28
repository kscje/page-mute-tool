const PAGE_MUTE_DEFAULT_SETTINGS = {
  blockAudio: true,
  blockVideo: true,
  blockIframe: true
};

class StorageManager {
  constructor() {
    this.syncStorage = chrome.storage.sync;
    this.localStorage = chrome.storage.local;
    this.defaultData = {
      domains: [],
      globalEnabled: true,
      settings: { ...PAGE_MUTE_DEFAULT_SETTINGS }
    };
    this.defaultStats = {
      blockedCount: 0,
      sessionBlocked: 0
    };
  }

  async init() {
    const [data, stats] = await Promise.all([this.getData(), this.getStats()]);
    await Promise.all([
      this.syncStorage.set(data),
      this.localStorage.set({ stats })
    ]);
  }

  async getData() {
    return new Promise((resolve) => {
      this.syncStorage.get(null, (data) => {
        resolve(this.normalizeData(data));
      });
    });
  }

  normalizeData(data = {}) {
    return {
      ...this.defaultData,
      ...data,
      domains: Array.isArray(data.domains) ? data.domains : [],
      settings: {
        ...PAGE_MUTE_DEFAULT_SETTINGS,
        ...(data.settings || {})
      }
    };
  }

  async getDomains() {
    const data = await this.getData();
    return data.domains;
  }

  async addDomain(pattern, description = '') {
    const data = await this.getData();
    const existingDomain = data.domains.find((domain) => domain.pattern === pattern);

    if (existingDomain) {
      return { success: false, messageKey: 'errorDomainExists' };
    }

    const newDomain = {
      id: `${Date.now()}${Math.random().toString(36).slice(2, 11)}`,
      pattern,
      enabled: true,
      createdAt: new Date().toISOString(),
      description
    };

    data.domains.push(newDomain);
    await this.syncStorage.set(data);
    return { success: true, domain: newDomain };
  }

  async removeDomain(id) {
    const data = await this.getData();
    const originalLength = data.domains.length;
    data.domains = data.domains.filter((domain) => domain.id !== id);

    if (data.domains.length === originalLength) {
      return { success: false, messageKey: 'errorDomainNotFound' };
    }

    await this.syncStorage.set(data);
    return { success: true };
  }

  async updateDomain(id, updates) {
    const data = await this.getData();
    const domainIndex = data.domains.findIndex((domain) => domain.id === id);

    if (domainIndex === -1) {
      return { success: false, messageKey: 'errorDomainNotFound' };
    }

    data.domains[domainIndex] = {
      ...data.domains[domainIndex],
      ...updates
    };
    await this.syncStorage.set(data);
    return { success: true, domain: data.domains[domainIndex] };
  }

  async toggleDomain(id) {
    const data = await this.getData();
    const domain = data.domains.find((item) => item.id === id);

    if (!domain) {
      return { success: false, messageKey: 'errorDomainNotFound' };
    }

    domain.enabled = !domain.enabled;
    await this.syncStorage.set(data);
    return { success: true, domain };
  }

  async clearDomains() {
    const data = await this.getData();
    data.domains = [];
    await this.syncStorage.set(data);
    return { success: true };
  }

  async setGlobalEnabled(enabled) {
    const data = await this.getData();
    data.globalEnabled = Boolean(enabled);
    await this.syncStorage.set(data);
    return { success: true, enabled: data.globalEnabled };
  }

  async getGlobalEnabled() {
    const data = await this.getData();
    return data.globalEnabled;
  }

  async getSettings() {
    const data = await this.getData();
    return data.settings;
  }

  async setSettings(settings) {
    const data = await this.getData();
    data.settings = {
      ...PAGE_MUTE_DEFAULT_SETTINGS,
      ...(settings || {})
    };
    await this.syncStorage.set(data);
    return data.settings;
  }

  async getPageState(url, ancestorOrigins = []) {
    const [domains, globalEnabled, settings] = await Promise.all([
      this.getDomains(),
      this.getGlobalEnabled(),
      this.getSettings()
    ]);
    const candidateUrls = [url, ...ancestorOrigins]
      .filter(Boolean);
    const matched = domains.some((domain) =>
      domain.enabled && candidateUrls.some((candidateUrl) => Utils.matchesDomain(candidateUrl, domain.pattern))
    );

    return {
      globalEnabled,
      matched,
      active: globalEnabled && matched,
      domains,
      settings
    };
  }

  async getStats() {
    return new Promise((resolve) => {
      this.localStorage.get('stats', (result) => {
        resolve({
          ...this.defaultStats,
          ...(result.stats || {})
        });
      });
    });
  }

  async incrementBlockCount() {
    const stats = await this.getStats();
    stats.blockedCount += 1;
    stats.sessionBlocked += 1;
    await this.localStorage.set({ stats });
    return stats;
  }

  async resetSessionStats() {
    const stats = await this.getStats();
    stats.sessionBlocked = 0;
    await this.localStorage.set({ stats });
    return stats;
  }

  async exportData() {
    const [data, stats] = await Promise.all([this.getData(), this.getStats()]);
    return JSON.stringify({ ...data, stats }, null, 2);
  }

  async importData(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      if (!Array.isArray(imported.domains)) {
        throw new Error('Invalid data format');
      }

      const normalized = this.normalizeData(imported);
      const stats = {
        ...this.defaultStats,
        ...(imported.stats || {})
      };

      await Promise.all([
        this.syncStorage.set(normalized),
        this.localStorage.set({ stats })
      ]);

      return { success: true };
    } catch (error) {
      return { success: false, messageKey: 'errorImportInvalidJson' };
    }
  }
}

const pageMuteStorageManager = new StorageManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StorageManager,
    pageMuteStorageManager,
    PAGE_MUTE_DEFAULT_SETTINGS
  };
} else {
  globalThis.StorageManager = StorageManager;
  globalThis.pageMuteStorageManager = pageMuteStorageManager;
  globalThis.PAGE_MUTE_DEFAULT_SETTINGS = PAGE_MUTE_DEFAULT_SETTINGS;
}
