class Utils {
  static validateDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      return { valid: false, messageKey: 'errorNoDomain' };
    }

    // Strip protocol and path before validating user-entered domains.
    domain = domain.replace(/^https?:\/\//, '').split('/')[0];
    
    const wildcardRegex = /^\*\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    const localhostRegex = /^localhost(:\d+)?$/;

    if (wildcardRegex.test(domain) || domainRegex.test(domain) || localhostRegex.test(domain)) {
      return { valid: true };
    }

    return { valid: false, messageKey: 'errorInvalidDomain' };
  }

  static matchesDomain(pageUrl, pattern) {
    try {
      const url = new URL(pageUrl);
      const hostname = url.hostname;

      if (pattern === 'localhost') {
        return hostname === 'localhost';
      }

      if (pattern.startsWith('*.')) {
        const baseDomain = pattern.substring(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }

      return hostname === pattern;
    } catch (error) {
      console.error('URL parse error:', error);
      return false;
    }
  }

  static formatMessage(type, data = {}) {
    return {
      type: type,
      timestamp: Date.now(),
      data: data
    };
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static isSameOrigin(iframe) {
    try {
      const iframeOrigin = new URL(iframe.src).origin;
      const pageOrigin = window.location.origin;
      return iframeOrigin === pageOrigin || !iframe.src;
    } catch (error) {
      return false;
    }
  }

  static getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return '';
    }
  }

  static storageAvailable(type) {
    try {
      const storage = window[type];
      const x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return false;
    }
  }

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static unescapeHtml(text) {
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent;
  }

  static copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise((resolve, reject) => {
        document.execCommand('copy') ? resolve() : reject();
        textArea.remove();
      });
    }
  }

  static downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static parseQueryString(query) {
    const params = {};
    const pairs = query.split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
  }

  static buildQueryString(params) {
    return Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
} else {
  globalThis.Utils = Utils;
}
