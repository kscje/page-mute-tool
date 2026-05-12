class OptionsManager {
  constructor() {
    this.currentTab = 'general';
    this.settings = { ...PAGE_MUTE_DEFAULT_SETTINGS };
  }

  init() {
    i18n.applyToDocument();
    this.setupTabNavigation();
    this.loadSettings();
    this.loadDomains();
    this.setupEventListeners();
  }

  setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });
  }

  switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
    this.currentTab = tabId;
  }

  async loadSettings() {
    const response = await this.sendMessage('GET_SETTINGS');
    if (response.success) {
      this.settings = {
        ...PAGE_MUTE_DEFAULT_SETTINGS,
        ...response.settings
      };
    }
    this.updateFormFields();
  }

  updateFormFields() {
    document.getElementById('block-audio').checked = this.settings.blockAudio;
    document.getElementById('block-video').checked = this.settings.blockVideo;
    document.getElementById('block-iframe').checked = this.settings.blockIframe;
  }

  collectSettings() {
    return {
      blockAudio: document.getElementById('block-audio').checked,
      blockVideo: document.getElementById('block-video').checked,
      blockIframe: document.getElementById('block-iframe').checked
    };
  }

  async saveSettings(newSettings = null, silent = false) {
    if (newSettings) {
      this.settings = { ...newSettings };
    } else {
      this.settings = {
        ...this.settings,
        ...this.collectSettings()
      };
    }

    const response = await this.sendMessage('SET_SETTINGS', { settings: this.settings });
    if (response.success) {
      this.settings = response.settings;
      this.updateFormFields();
      if (!silent) {
        this.showMessage(i18n.getMessage('successSaveSettings'));
      }
    } else {
      this.showMessage(i18n.getMessage('errorSaveFailed') || '保存失败，请重试');
    }
  }

  async restoreDefaults() {
    if (!confirm(i18n.getMessage('confirmRestoreDefaults'))) {
      return;
    }

    try {
      await this.saveSettings({ ...PAGE_MUTE_DEFAULT_SETTINGS }, true);
      this.showMessage(i18n.getMessage('successRestoreDefaults'));
    } catch (error) {
      this.showMessage(i18n.getMessage('errorRestoreDefaultsFailed') || '恢复默认失败，请重试');
    }
  }

  async loadDomains() {
    const response = await this.sendMessage('GET_DOMAINS');
    this.renderDomainList(response.success ? response.domains : []);
  }

  renderDomainList(domains) {
    const container = document.getElementById('domain-items');

    if (domains.length === 0) {
      container.innerHTML = `<div class="empty">${i18n.getMessage('emptyDomains')}</div>`;
      return;
    }

    container.innerHTML = domains.map((domain) => `
      <div class="domain-item">
        <div class="domain-info">
          <input type="checkbox" class="domain-toggle" ${domain.enabled ? 'checked' : ''} data-id="${domain.id}">
          <span class="domain-pattern">${Utils.escapeHtml(domain.pattern)}</span>
          ${domain.description ? `<span class="domain-description">${Utils.escapeHtml(domain.description)}</span>` : ''}
          <span class="domain-date">${new Date(domain.createdAt).toLocaleString()}</span>
        </div>
        <button class="delete-btn" data-id="${domain.id}">${i18n.getMessage('deleteBtn')}</button>
      </div>
    `).join('');

    document.querySelectorAll('.delete-btn').forEach((button) => {
      button.addEventListener('click', () => this.removeDomain(button.dataset.id));
    });

    document.querySelectorAll('.domain-toggle').forEach((toggle) => {
      toggle.addEventListener('change', () => this.toggleDomain(toggle.dataset.id));
    });
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

  async addDomain() {
    const input = document.getElementById('domain-input');
    const descriptionInput = document.getElementById('domain-description');
    const pattern = input.value.trim();
    const description = descriptionInput.value.trim();

    if (!pattern) {
      this.showMessage(i18n.getMessage('errorNoDomain'));
      return;
    }

    const validation = Utils.validateDomain(pattern);
    if (!validation.valid) {
      this.showMessage(this.getMessageFromResult(validation, 'errorInvalidDomain'));
      return;
    }

    const response = await this.sendMessage('ADD_DOMAIN', { pattern, description });
    if (!response.success) {
      this.showMessage(this.getMessageFromResult(response, 'errorAddFailed'));
      return;
    }

    input.value = '';
    descriptionInput.value = '';
    await this.loadDomains();
    this.showMessage(i18n.getMessage('successAddDomain'));
  }

  async removeDomain(id) {
    if (!confirm(i18n.getMessage('confirmRemoveDomain'))) {
      return;
    }

    const response = await this.sendMessage('REMOVE_DOMAIN', { id });
    if (response.success) {
      await this.loadDomains();
      this.showMessage(i18n.getMessage('successRemoveDomain'));
    } else {
      this.showMessage(this.getMessageFromResult(response, 'errorDeleteFailed'));
    }
  }

  async toggleDomain(id) {
    const response = await this.sendMessage('TOGGLE_DOMAIN', { id });
    if (response.success) {
      await this.loadDomains();
    }
  }

  async importDomains() {
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
          const response = await this.sendMessage('IMPORT_DATA', {
            jsonData: loadEvent.target.result
          });
          if (response.success) {
            await this.loadDomains();
            this.showMessage(i18n.getMessage('successImportData'));
          } else {
            this.showMessage(this.getMessageFromResult(response, 'errorImportFailed'));
          }
        } catch (error) {
          this.showMessage(i18n.getMessage('errorImportInvalidJson'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async exportDomains() {
    const response = await this.sendMessage('EXPORT_DATA');
    if (response.success) {
      Utils.downloadFile(response.data, 'page-mute-tool-backup.json', 'application/json');
      this.showMessage(i18n.getMessage('successExportData'));
    }
  }

  async clearDomains() {
    if (!confirm(i18n.getMessage('confirmClearDomains'))) {
      return;
    }

    const response = await this.sendMessage('CLEAR_DOMAINS');
    if (response.success) {
      await this.loadDomains();
      this.showMessage(i18n.getMessage('successClearDomains'));
    }
  }

  sendMessage(type, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        resolve(response || { success: false, message: i18n.getMessage('errorNoResponse') });
      });
    });
  }

  showMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = message;
    document.body.appendChild(messageElement);

    window.setTimeout(() => {
      messageElement.classList.add('show');
    }, 100);

    window.setTimeout(() => {
      messageElement.classList.remove('show');
      window.setTimeout(() => {
        document.body.removeChild(messageElement);
      }, 300);
    }, 2000);
  }

  setupEventListeners() {
    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveSettings();
    });
    document.getElementById('restore-defaults').addEventListener('click', () => {
      this.restoreDefaults();
    });

    document.getElementById('add-domain-btn').addEventListener('click', () => this.addDomain());
    document.getElementById('domain-input').addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.addDomain();
      }
    });

    document.getElementById('import-domains').addEventListener('click', () => this.importDomains());
    document.getElementById('export-domains').addEventListener('click', () => this.exportDomains());
    document.getElementById('clear-domains').addEventListener('click', () => this.clearDomains());
  }
}

const optionsManager = new OptionsManager();
optionsManager.init();
