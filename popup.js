class PopupManager {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 10;
    this.domains = [];
    this.currentDomain = '';
    this.currentTabId = null;
    this.currentPageState = null;
  }

  async init() {
    i18n.applyToDocument();
    await this.loadCurrentPageInfo();
    await this.loadDomains();
    await this.loadGlobalStatus();
    await this.loadStats();
    this.setupEventListeners();
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      this.currentTabId = tab.id;
    }
    return tab;
  }

  async loadCurrentPageInfo() {
    const tab = await this.getCurrentTab();
    if (!tab || !tab.url) {
      this.currentPageState = null;
      this.updateQuickAddState({ success: false });
      return;
    }

    this.currentDomain = Utils.getHostname(tab.url) || i18n.getMessage('pageUnavailable');
    const state = await this.getPageState(tab.url);
    this.currentPageState = state.success ? state : null;
    this.updateQuickAddState(state);
  }

  async loadDomains() {
    this.domains = await this.getDomains();
    const totalPages = Math.max(1, Math.ceil(this.domains.length / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    this.renderDomainList();
    this.updateQuickAddState(this.currentPageState);
  }

  async getDomains() {
    const response = await this.sendMessage('GET_DOMAINS');
    return response.success ? response.domains : [];
  }

  async getPageState(url) {
    return this.sendMessage('GET_PAGE_STATE', { url, tabId: this.currentTabId });
  }

  getMessageFromResult(result, fallbackKey) {
    if (result?.message) {
      return result.message;
    }
    if (result?.messageKey) {
      return i18n.getMessage(result.messageKey);
    }
    return i18n.getMessage(fallbackKey);
  }

  async loadGlobalStatus() {
    const response = await this.sendMessage('GET_GLOBAL_ENABLED');
    const globalToggle = document.getElementById('global-toggle');
    if (globalToggle) {
      globalToggle.checked = response.success ? response.enabled : true;
    }
  }

  async loadStats() {
    const response = await this.sendMessage('GET_STATS');
    document.getElementById('blocked-count').textContent =
      response.success ? response.stats.sessionBlocked : 0;
  }

  setupEventListeners() {
    document.getElementById('add-domain-btn').addEventListener('click', () => this.addDomain());
    document.getElementById('quick-add-btn').addEventListener('click', () => this.addCurrentDomain());
    document.getElementById('domain-input').addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.addDomain();
      }
    });

    const globalToggle = document.getElementById('global-toggle');
    if (globalToggle) {
      globalToggle.addEventListener('change', async (event) => {
        await this.setGlobalEnabled(event.target.checked);
      });
    }

    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    const importButton = document.getElementById('import-btn');
    const exportButton = document.getElementById('export-btn');
    const clearButton = document.getElementById('clear-btn');
    if (importButton) {
      importButton.addEventListener('click', () => this.importData());
    }
    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportData());
    }
    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearDomains());
    }

    document.getElementById('prev-page').addEventListener('click', () => this.prevPage());
    document.getElementById('next-page').addEventListener('click', () => this.nextPage());
  }

  getCurrentDomainPattern() {
    return typeof this.currentDomain === 'string' ? this.currentDomain.trim() : '';
  }

  getQuickAddStatus(state) {
    if (!state || !state.success) {
      return { text: i18n.getMessage('statusUnknown'), color: '#9E9E9E' };
    }

    if (!state.globalEnabled) {
      return { text: i18n.getMessage('statusGlobalDisabled'), color: '#F44336' };
    }

    if (state.matched) {
      return { text: i18n.getMessage('statusEnabled'), color: '#4CAF50' };
    }

    return { text: i18n.getMessage('statusNotEnabled'), color: '#9E9E9E' };
  }

  hasCurrentDomainAdded(pattern) {
    return this.domains.some((domain) => domain.pattern === pattern);
  }

  updateQuickAddState(state = null) {
    const pattern = this.getCurrentDomainPattern();
    const validation = Utils.validateDomain(pattern);
    const status = this.getQuickAddStatus(state);
    const isAdded = validation.valid && this.hasCurrentDomainAdded(pattern);
    const quickAddButton = document.getElementById('quick-add-btn');
    const quickAddStatus = document.getElementById('quick-add-status');

    document.getElementById('quick-add-domain').textContent = pattern || i18n.getMessage('pageUnavailable');
    quickAddStatus.textContent = status.text;
    quickAddStatus.style.color = status.color;
    quickAddButton.disabled = !validation.valid;
    quickAddButton.classList.toggle('is-hidden', isAdded || !validation.valid);
  }

  async addCurrentDomain() {
    const pattern = this.getCurrentDomainPattern();
    if (!pattern) {
      alert(i18n.getMessage('domainUnavailable'));
      return;
    }

    await this.addDomain(pattern, true);
  }

  async addDomain(patternOverride = '', keepInputValue = false) {
    const input = document.getElementById('domain-input');
    const pattern = (patternOverride || input.value).trim();

    if (!pattern) {
      alert(i18n.getMessage('errorNoDomain'));
      return;
    }

    const validation = Utils.validateDomain(pattern);
    if (!validation.valid) {
      alert(this.getMessageFromResult(validation, 'errorInvalidDomain'));
      return;
    }

    const response = await this.sendMessage('ADD_DOMAIN', { pattern });
    if (!response.success) {
      alert(this.getMessageFromResult(response, 'errorAddFailed'));
      return;
    }

    if (!keepInputValue) {
      input.value = '';
    }
    await this.refreshAfterRulesChanged();
    alert(patternOverride ? i18n.getMessage('successAddCurrentDomain') : i18n.getMessage('successAddDomain'));
  }

  async removeDomain(id) {
    if (!confirm(i18n.getMessage('confirmRemoveDomain'))) {
      return;
    }

    const response = await this.sendMessage('REMOVE_DOMAIN', { id });
    if (!response.success) {
      alert(this.getMessageFromResult(response, 'errorDeleteFailed'));
      return;
    }

    await this.refreshAfterRulesChanged();
  }

  async setGlobalEnabled(enabled) {
    const response = await this.sendMessage('SET_GLOBAL_ENABLED', { enabled });
    if (response.success) {
      await this.refreshCurrentTab();
      await this.loadCurrentPageInfo();
    }
  }

  async clearDomains() {
    if (!confirm(i18n.getMessage('confirmClearDomains'))) {
      return;
    }

    const response = await this.sendMessage('CLEAR_DOMAINS');
    if (!response.success) {
      return;
    }

    await this.refreshAfterRulesChanged();
    alert(i18n.getMessage('successClearDomains'));
  }

  async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = async (loadEvent) => {
        try {
          const jsonData = loadEvent.target.result;
          const response = await this.sendMessage('IMPORT_DATA', { jsonData });
          if (!response.success) {
            alert(this.getMessageFromResult(response, 'errorImportFailed'));
            return;
          }
          await this.refreshAfterRulesChanged();
          alert(i18n.getMessage('successImportData'));
        } catch (error) {
          alert(i18n.getMessage('errorImportInvalidJson'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async exportData() {
    const response = await this.sendMessage('EXPORT_DATA');
    if (!response.success) {
      return;
    }

    Utils.downloadFile(response.data, 'page-mute-tool-backup.json', 'application/json');
  }

  renderDomainList() {
    const listContainer = document.getElementById('domain-list');
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paginatedDomains = this.domains.slice(startIndex, startIndex + this.pageSize);

    if (paginatedDomains.length === 0) {
      listContainer.innerHTML = `<div class="empty">${i18n.getMessage('emptyDomains')}</div>`;
    } else {
      listContainer.innerHTML = paginatedDomains.map((domain) => `
        <div class="domain-item">
          <div class="domain-info">
            <span class="domain-pattern">${Utils.escapeHtml(domain.pattern)}</span>
          </div>
          <button class="delete-btn" data-id="${domain.id}">🗑️</button>
        </div>
      `).join('');

      document.querySelectorAll('.delete-btn').forEach((button) => {
        button.addEventListener('click', () => this.removeDomain(button.dataset.id));
      });
    }

    this.updatePagination();
  }

  updatePagination() {
    const totalPages = Math.max(1, Math.ceil(this.domains.length / this.pageSize));
    document.getElementById('page-info').textContent = `${this.currentPage} / ${totalPages}`;
    document.getElementById('prev-page').disabled = this.currentPage === 1;
    document.getElementById('next-page').disabled = this.currentPage >= totalPages;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
      this.renderDomainList();
    }
  }

  nextPage() {
    const totalPages = Math.max(1, Math.ceil(this.domains.length / this.pageSize));
    if (this.currentPage < totalPages) {
      this.currentPage += 1;
      this.renderDomainList();
    }
  }

  async refreshCurrentTab() {
    const tab = await this.getCurrentTab();
    if (!tab || !this.currentTabId) {
      return;
    }

    try {
      await chrome.tabs.sendMessage(this.currentTabId, { type: 'PAGE_MUTE_REFRESH' });
    } catch (error) {
    }
  }

  async refreshAfterRulesChanged() {
    await this.loadDomains();
    await this.loadStats();
    await this.refreshCurrentTab();
    await this.loadCurrentPageInfo();
  }

  sendMessage(type, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        resolve(response || { success: false, message: i18n.getMessage('errorNoResponse') });
      });
    });
  }
}

const popupManager = new PopupManager();
popupManager.init();
