// filepath: utils/helper.js

/**
 * PicGrabber 工具函数库（优化版）
 * 提供图片处理、URL 解析、筛选等通用功能
 */

'use strict';

(function() {
  const helper = {
    // ==================== URL 处理 ====================
    
    /**
     * 解析相对 URL 为绝对路径
     * @param {string} url - 原始 URL
     * @param {string} [baseUrl] - 基础 URL
     * @returns {string|null} 解析后的绝对 URL
     */
    resolveUrl: function(url, baseUrl) {
      if (!url) return null;
      
      url = url.trim();
      
      if (url.startsWith('data:')) {
        return url;
      }
      
      if (url.startsWith('blob:')) {
        return url;
      }
      
      try {
        const base = baseUrl || window.location.href;
        return new URL(url, base).href;
      } catch (e) {
        return url;
      }
    },

    /**
     * 标准化 URL（去除查询参数和哈希，用于去重）
     * @param {string} url - 原始 URL
     * @returns {string} 标准化后的 URL
     */
    normalizeUrl: function(url) {
      if (!url) return url;
      
      if (url.startsWith('data:')) {
        return url;
      }
      
      try {
        const urlObj = new URL(url);
        urlObj.search = '';
        urlObj.hash = '';
        return urlObj.toString();
      } catch (error) {
        return url.split('?')[0].split('#')[0];
      }
    },

    /**
     * 清理 URL（去除多余参数）
     * @param {string} url - 原始 URL
     * @returns {string} 清理后的 URL
     */
    cleanUrl: function(url) {
      if (!url) return url;
      
      if (url.startsWith('data:')) {
        return url;
      }
      
      try {
        const urlObj = new URL(url);
        urlObj.search = '';
        urlObj.hash = '';
        return urlObj.toString();
      } catch (error) {
        return url.split('?')[0].split('#')[0];
      }
    },

    /**
     * 获取 URL 的域名
     * @param {string} url - URL
     * @returns {string|null} 域名
     */
    getDomain: function(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch (e) {
        return null;
      }
    },

    // ==================== 图片格式检测 ====================
    
    /**
     * 获取图片扩展名
     * @param {string} url - 图片 URL
     * @returns {string} 扩展名（不含点）
     */
    getImageExtension: function(url) {
      if (!url) return 'jpg';
      
      if (url.startsWith('data:image/')) {
        const match = url.match(/^data:image\/([a-zA-Z0-9]+);/);
        if (match) return match[1].toLowerCase();
        return 'jpg';
      }
      
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        
        const extMatch = pathname.match(/\.([a-z0-9]+)(?:\?|$)/);
        if (extMatch) return extMatch[1];
        
        const queryMatch = urlObj.search.match(/format=([a-z0-9]+)/i);
        if (queryMatch) return queryMatch[1].toLowerCase();
        
        return 'jpg';
      } catch (e) {
        return 'jpg';
      }
    },

    /**
     * 检查是否为有效图片格式
     * @param {string} url - URL
     * @param {boolean} [includeDataUrl=true] - 是否包含 Data URL
     * @returns {boolean}
     */
    isValidImageFormat: function(url, includeDataUrl = true) {
      const ext = this.getImageExtension(url);
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
      
      if (url.startsWith('data:')) {
        return includeDataUrl && url.startsWith('data:image/');
      }
      
      if (url.startsWith('blob:')) {
        return true;
      }
      
      return validExtensions.includes(ext);
    },

    /**
     * 获取 MIME 类型
     * @param {string} extension - 扩展名
     * @returns {string} MIME 类型
     */
    getMimeType: function(extension) {
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon'
      };
      return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
    },

    // ==================== 文件名处理 ====================
    
    /**
     * 从 URL 获取原始文件名
     * @param {string} url - URL
     * @returns {string} 文件名（不含扩展名）
     */
    getFilenameFromUrl: function(url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const parts = pathname.split('/');
        const filename = parts[parts.length - 1] || 'image';
        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0) {
          return filename.substring(0, dotIndex);
        }
        return filename;
      } catch (e) {
        return 'image';
      }
    },

    /**
     * 生成文件名
     * @param {string} url - 图片 URL
     * @param {number} index - 序号
     * @param {string} pattern - 命名模板
     * @param {Object} metadata - 元数据
     * @returns {string} 文件名（含扩展名）
     */
    generateFileName: function(url, index, pattern, metadata = {}) {
      const extension = this.getImageExtension(url);
      const now = new Date();
      
      const date = now.toISOString().slice(0, 10).replace(/-/g, '');
      const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const timestamp = Date.now();
      const indexStr = String(index + 1).padStart(3, '0');
      
      let filename = metadata.originalName || this.getFilenameFromUrl(url);
      
      let result = pattern || 'image_{date}_{time}_{index}';
      
      result = result.replace(/\{date\}/g, date);
      result = result.replace(/\{time\}/g, time);
      result = result.replace(/\{timestamp\}/g, timestamp);
      result = result.replace(/\{index\}/g, indexStr);
      result = result.replace(/\{filename\}/g, filename || 'image');
      result = result.replace(/\{title\}/g, metadata.title || 'page');
      
      return `${result}.${extension}`;
    },

    // ==================== 图片筛选 ====================
    
    /**
     * 按格式筛选图片
     * @param {Array} images - 图片数组
     * @param {Array} allowedFormats - 允许的格式
     * @returns {Array} 筛选后的图片数组
     */
    filterByFormat: function(images, allowedFormats) {
      if (!allowedFormats || allowedFormats.length === 0) {
        return images;
      }
      
      const formats = allowedFormats.map(f => f.toLowerCase());
      
      return images.filter(img => {
        const url = typeof img === 'string' ? img : img.url;
        const ext = this.getImageExtension(url);
        return formats.includes(ext);
      });
    },

    /**
     * 按尺寸筛选图片
     * @param {Array} images - 图片数组
     * @param {Object} options - 尺寸选项
     * @param {number} options.minWidth - 最小宽度
     * @param {number} options.minHeight - 最小高度
     * @param {number} options.maxWidth - 最大宽度
     * @param {number} options.maxHeight - 最大高度
     * @param {boolean} options.excludeUnknown - 是否排除尺寸未知的图片
     * @returns {Array} 筛选后的图片数组
     */
    filterBySize: function(images, options = {}) {
      const {
        minWidth = 0,
        minHeight = 0,
        maxWidth = 0,
        maxHeight = 0,
        excludeUnknown = false
      } = options;
      
      if (minWidth === 0 && minHeight === 0 && maxWidth === 0 && maxHeight === 0 && !excludeUnknown) {
        return images;
      }
      
      return images.filter(img => {
        const width = img.width || 0;
        const height = img.height || 0;
        
        if (width === 0 && height === 0) {
          return !excludeUnknown;
        }
        
        if (minWidth > 0 && width < minWidth) return false;
        if (minHeight > 0 && height < minHeight) return false;
        if (maxWidth > 0 && width > maxWidth) return false;
        if (maxHeight > 0 && height > maxHeight) return false;
        
        return true;
      });
    },

    /**
     * 按关键词筛选图片
     * @param {Array} images - 图片数组
     * @param {string} includeKeywords - 包含关键词（逗号分隔）
     * @param {string} excludeKeywords - 排除关键词（逗号分隔）
     * @returns {Array} 筛选后的图片数组
     */
    filterByKeywords: function(images, includeKeywords, excludeKeywords) {
      let result = images;
      
      if (includeKeywords && includeKeywords.trim()) {
        const keywords = includeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (keywords.length > 0) {
          result = result.filter(img => {
            const url = (typeof img === 'string' ? img : img.url).toLowerCase();
            return keywords.some(kw => url.includes(kw));
          });
        }
      }
      
      if (excludeKeywords && excludeKeywords.trim()) {
        const keywords = excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (keywords.length > 0) {
          result = result.filter(img => {
            const url = (typeof img === 'string' ? img : img.url).toLowerCase();
            return !keywords.some(kw => url.includes(kw));
          });
        }
      }
      
      return result;
    },

    /**
     * 按域名筛选图片
     * @param {Array} images - 图片数组
     * @param {string} includeDomains - 包含域名（逗号分隔）
     * @param {string} excludeDomains - 排除域名（逗号分隔）
     * @returns {Array} 筛选后的图片数组
     */
    filterByDomain: function(images, includeDomains, excludeDomains) {
      let result = images;
      
      if (includeDomains && includeDomains.trim()) {
        const domains = includeDomains.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
        if (domains.length > 0) {
          result = result.filter(img => {
            const url = typeof img === 'string' ? img : img.url;
            try {
              const hostname = new URL(url).hostname.toLowerCase();
              return domains.some(domain => hostname.includes(domain));
            } catch (e) {
              return true;
            }
          });
        }
      }
      
      if (excludeDomains && excludeDomains.trim()) {
        const domains = excludeDomains.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
        if (domains.length > 0) {
          result = result.filter(img => {
            const url = typeof img === 'string' ? img : img.url;
            try {
              const hostname = new URL(url).hostname.toLowerCase();
              return !domains.some(domain => hostname.includes(domain));
            } catch (e) {
              return true;
            }
          });
        }
      }
      
      return result;
    },

    // ==================== 数组操作 ====================
    
    /**
     * 去重 URL 数组
     * @param {Array} urls - URL 数组
     * @returns {Array} 去重后的数组
     */
    uniqueUrls: function(urls) {
      const seen = new Set();
      const result = [];
      
      for (const item of urls) {
        const url = typeof item === 'string' ? item : item.url;
        const normalized = this.normalizeUrl(url);
        
        if (!seen.has(normalized)) {
          seen.add(normalized);
          result.push(item);
        }
      }
      
      return result;
    },

    /**
     * 限制数组数量
     * @param {Array} array - 数组
     * @param {number} maxCount - 最大数量
     * @returns {Array} 截取后的数组
     */
    limitCount: function(array, maxCount) {
      if (!maxCount || maxCount <= 0) {
        return array;
      }
      return array.slice(0, maxCount);
    },

    // ==================== 页面检测 ====================
    
    /**
     * 检测页面是否使用懒加载
     * @returns {boolean}
     */
    detectLazyLoad: function() {
      const lazyIndicators = [
        '[data-src]',
        '[data-lazy-src]',
        '[data-original]',
        '.lazy',
        '.lazyload',
        '[loading="lazy"]'
      ];
      
      for (const selector of lazyIndicators) {
        if (document.querySelector(selector)) {
          return true;
        }
      }
      
      return typeof IntersectionObserver !== 'undefined';
    },

    /**
     * 检测页面是否使用无限滚动
     * @returns {boolean}
     */
    detectInfiniteScroll: function() {
      const infiniteIndicators = [
        '.infinite-scroll',
        '.infinite-scroller',
        '.infinite-list',
        '[data-infinite-scroll]',
        '.virtual-scroll',
        '[data-virtualized]',
        '.loading-spinner',
        '.infinite-loader'
      ];
      
      for (const selector of infiniteIndicators) {
        if (document.querySelector(selector)) {
          return true;
        }
      }
      
      return false;
    },

    /**
     * 检测页面是否有"加载更多"按钮
     * @returns {boolean}
     */
    detectLoadMore: function() {
      const loadMoreIndicators = [
        '.load-more',
        '.loadMore',
        '.btn-load-more',
        '[class*="load-more"]',
        '[id*="load-more"]'
      ];
      
      for (const selector of loadMoreIndicators) {
        if (document.querySelector(selector)) {
          return true;
        }
      }
      
      return false;
    },

    // ==================== 格式化输出 ====================
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize: function(bytes) {
      if (bytes === 0) return '0 B';
      
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 格式化尺寸显示
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {string} 格式化后的尺寸
     */
    formatDimensions: function(width, height) {
      if (width === 0 && height === 0) {
        return '尺寸未知';
      }
      return `${width} × ${height}`;
    },

    /**
     * 获取错误提示信息
     * @param {string} errorType - 错误类型
     * @param {string} originalError - 原始错误信息
     * @returns {string} 友好的错误提示
     */
    getErrorMessage: function(errorType, originalError) {
      const errorMessages = {
        'network_error': '网络连接失败，请检查网络连接后重试',
        'cors_error': '跨域限制，无法访问该图片资源',
        'timeout_error': '下载超时，请稍后重试',
        'file_system_error': '文件系统错误，请检查磁盘空间和权限',
        'download_blocked': '下载被浏览器或安全软件拦截',
        'invalid_url': '无效的图片 URL',
        'unknown_error': '下载失败：' + (originalError || '未知错误')
      };
      
      return errorMessages[errorType] || errorMessages['unknown_error'];
    }
  };

  // 导出函数
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = helper;
  }
  
  if (typeof window !== 'undefined') {
    window.PicGrabberHelper = helper;
  }
})();
