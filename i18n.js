const PAGE_MUTE_DEFAULT_LOCALE = 'en';
const PAGE_MUTE_CHINESE_LOCALE = 'zh_CN';

class I18n {
  constructor() {
    this.locale = this.detectLocale();
  }

  detectLocale() {
    let detectedLocale = '';
    try {
      detectedLocale = chrome.i18n.getUILanguage();
    } catch (error) {
    }

    if (!detectedLocale && typeof navigator !== 'undefined') {
      detectedLocale = navigator.language || navigator.userLanguage || PAGE_MUTE_DEFAULT_LOCALE;
    }

    return this.normalizeLocale(detectedLocale);
  }

  normalizeLocale(locale) {
    const normalizedLocale = String(locale || PAGE_MUTE_DEFAULT_LOCALE).replace('-', '_');
    const language = normalizedLocale.split('_')[0].toLowerCase();
    const supportedLocales = this.getSupportedLocales();

    if (language === 'zh' && supportedLocales.includes(PAGE_MUTE_CHINESE_LOCALE)) {
      return PAGE_MUTE_CHINESE_LOCALE;
    }

    const exactMatch = supportedLocales.find((supportedLocale) =>
      supportedLocale.toLowerCase() === normalizedLocale.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch;
    }

    const languageMatch = supportedLocales.find((supportedLocale) =>
      supportedLocale.split('_')[0].toLowerCase() === language
    );
    if (languageMatch) {
      return languageMatch;
    }

    return PAGE_MUTE_DEFAULT_LOCALE;
  }

  getSupportedLocales() {
    return Object.keys(this.fallbackMessages || {});
  }

  getMessage(key, substitutions) {
    try {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    } catch (error) {
    }

    return this.getFallbackMessage(key, substitutions);
  }

  getFallbackMessage(key, substitutions) {
    const messages = this.fallbackMessages[this.locale] || this.fallbackMessages[PAGE_MUTE_DEFAULT_LOCALE] || {};
    const entry = messages[key];
    if (!entry) {
      return key;
    }

    let message = entry.message || '';
    if (substitutions !== undefined) {
      if (Array.isArray(substitutions)) {
        substitutions.forEach((sub, index) => {
          message = message.replace(`$${index + 1}`, sub);
        });
      } else {
        message = message.replace(/\$\w+\$/g, (match) => {
          const placeholderName = match.replace(/\$/g, '').toLowerCase();
          if (typeof substitutions === 'object' && substitutions[placeholderName] !== undefined) {
            return substitutions[placeholderName];
          }
          return match;
        });
      }
    }

    return message;
  }

  applyToDocument(root) {
    const element = root || document;

    element.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.textContent = message;
      }
    });

    element.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.setAttribute('placeholder', message);
      }
    });

    element.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.setAttribute('title', message);
      }
    });

    element.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.setAttribute('aria-label', message);
      }
    });
  }

  getLocale() {
    return this.locale;
  }

  isChinese() {
    return this.locale.split('_')[0].toLowerCase() === 'zh';
  }
}

I18n.prototype.fallbackMessages = {
  zh_CN: {
    extensionName: { message: '网页静音工具' },
    extensionDescription: { message: '阻止指定域名网页中的媒体自动播放，强制用户手动点击播放' },
    popupTitle: { message: '网页静音工具' },
    currentDomain: { message: '当前域名' },
    quickAddButton: { message: '一键添加当前域名' },
    checking: { message: '检查中...' },
    loading: { message: '加载中...' },
    domainPlaceholder: { message: '输入域名 (如: example.com 或 *.example.com)' },
    addDomain: { message: '添加' },
    domainListTitle: { message: '受管控域名列表' },
    importBtn: { message: '导入' },
    exportBtn: { message: '导出' },
    clearAllBtn: { message: '全部删除' },
    globalToggle: { message: '总开关:' },
    statsInfo: { message: '提示: 已阻止' },
    statsUnit: { message: '个自动播放' },
    statusUnknown: { message: '状态未知' },
    statusGlobalDisabled: { message: '总开关关闭' },
    statusEnabled: { message: '已启用' },
    statusNotEnabled: { message: '未启用' },
    pageUnavailable: { message: '当前页面不可用' },
    domainUnavailable: { message: '当前页面域名不可用' },
    emptyDomains: { message: '暂无域名，请添加' },
    confirmRemoveDomain: { message: '确定要删除这个域名吗？' },
    confirmClearDomains: { message: '确定要清空所有域名吗？' },
    confirmRestoreDefaults: { message: '确定要恢复默认设置吗？' },
    errorNoDomain: { message: '请输入域名' },
    errorInvalidDomain: { message: '域名格式不正确' },
    errorDomainExists: { message: '域名已存在' },
    errorDomainNotFound: { message: '域名不存在' },
    errorAddFailed: { message: '添加失败' },
    errorDeleteFailed: { message: '删除失败' },
    errorNoResponse: { message: '无响应' },
    errorImportInvalidJson: { message: '导入失败: 无效的JSON文件' },
    successAddDomain: { message: '域名添加成功' },
    successAddCurrentDomain: { message: '当前域名添加成功' },
    successClearDomains: { message: '所有域名已清空' },
    successImportData: { message: '数据导入成功' },
    errorImportFailed: { message: '导入失败' },
    errorUnknownMessageType: { message: '未知消息类型' },
    optionsTitle: { message: '网页静音工具 - 设置' },
    generalSettings: { message: '常规设置' },
    domainManagement: { message: '域名管理' },
    about: { message: '关于' },
    blockAudio: { message: '阻止音频自动播放' },
    blockVideo: { message: '阻止视频自动播放' },
    blockIframe: { message: '阻止 iframe 中的媒体自动播放' },
    saveSettings: { message: '保存设置' },
    restoreDefaults: { message: '恢复默认' },
    domainDescription: { message: '可选描述' },
    addedDomains: { message: '已添加域名' },
    importDomains: { message: '导入域名' },
    exportDomains: { message: '导出域名' },
    clearDomains: { message: '清空域名' },
    deleteBtn: { message: '删除' },
    version: { message: '版本：' },
    author: { message: '作者：' },
    descriptionLabel: { message: '描述：' },
    license: { message: '许可证：' },
    support: { message: '支持：' },
    changelog: { message: '更新日志：' },
    initialVersion: { message: '初始版本' },
    successSaveSettings: { message: '设置已保存' },
    successRemoveDomain: { message: '域名已删除' },
    successExportData: { message: '数据已导出' }
  },
  en: {
    extensionName: { message: 'Page Mute Tool' },
    extensionDescription: { message: 'Block media autoplay on specified domains, forcing manual play' },
    popupTitle: { message: 'Page Mute Tool' },
    currentDomain: { message: 'Current Domain' },
    quickAddButton: { message: 'Add Current Domain' },
    checking: { message: 'Checking...' },
    loading: { message: 'Loading...' },
    domainPlaceholder: { message: 'Enter domain (e.g: example.com or *.example.com)' },
    addDomain: { message: 'Add' },
    domainListTitle: { message: 'Managed Domains' },
    importBtn: { message: 'Import' },
    exportBtn: { message: 'Export' },
    clearAllBtn: { message: 'Clear All' },
    globalToggle: { message: 'Global:' },
    statsInfo: { message: 'Blocked' },
    statsUnit: { message: 'autoplay attempts' },
    statusUnknown: { message: 'Unknown' },
    statusGlobalDisabled: { message: 'Global Disabled' },
    statusEnabled: { message: 'Enabled' },
    statusNotEnabled: { message: 'Not Enabled' },
    pageUnavailable: { message: 'Page unavailable' },
    domainUnavailable: { message: 'Current page domain unavailable' },
    emptyDomains: { message: 'No domains yet, please add' },
    confirmRemoveDomain: { message: 'Are you sure you want to delete this domain?' },
    confirmClearDomains: { message: 'Are you sure you want to clear all domains?' },
    confirmRestoreDefaults: { message: 'Are you sure you want to restore default settings?' },
    errorNoDomain: { message: 'Please enter a domain' },
    errorInvalidDomain: { message: 'Invalid domain format' },
    errorDomainExists: { message: 'Domain already exists' },
    errorDomainNotFound: { message: 'Domain not found' },
    errorAddFailed: { message: 'Add failed' },
    errorDeleteFailed: { message: 'Delete failed' },
    errorNoResponse: { message: 'No response' },
    errorImportInvalidJson: { message: 'Import failed: Invalid JSON file' },
    successAddDomain: { message: 'Domain added successfully' },
    successAddCurrentDomain: { message: 'Current domain added successfully' },
    successClearDomains: { message: 'All domains cleared' },
    successImportData: { message: 'Data imported successfully' },
    errorImportFailed: { message: 'Import failed' },
    errorUnknownMessageType: { message: 'Unknown message type' },
    optionsTitle: { message: 'Page Mute Tool - Settings' },
    generalSettings: { message: 'General Settings' },
    domainManagement: { message: 'Domain Management' },
    about: { message: 'About' },
    blockAudio: { message: 'Block audio autoplay' },
    blockVideo: { message: 'Block video autoplay' },
    blockIframe: { message: 'Block media autoplay in iframes' },
    saveSettings: { message: 'Save Settings' },
    restoreDefaults: { message: 'Restore Defaults' },
    domainDescription: { message: 'Optional description' },
    addedDomains: { message: 'Added Domains' },
    importDomains: { message: 'Import Domains' },
    exportDomains: { message: 'Export Domains' },
    clearDomains: { message: 'Clear Domains' },
    deleteBtn: { message: 'Delete' },
    version: { message: 'Version: ' },
    author: { message: 'Author: ' },
    descriptionLabel: { message: 'Description: ' },
    license: { message: 'License: ' },
    support: { message: 'Support: ' },
    changelog: { message: 'Changelog: ' },
    initialVersion: { message: 'Initial release' },
    successSaveSettings: { message: 'Settings saved' },
    successRemoveDomain: { message: 'Domain deleted' },
    successExportData: { message: 'Data exported' }
  }
};

const i18n = new I18n();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18n, i18n };
} else {
  globalThis.I18n = I18n;
  globalThis.i18n = i18n;
}
