// filepath: options.js

/**
 * Options Script - 设置页面（优化版）
 * 支持所有配置选项、导入导出、标签页切换
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // ==================== DOM 元素引用 ====================
  
  const elements = {
    // 标签页
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // 下载设置
    downloadPath: document.getElementById('downloadPath'),
    fileNamePattern: document.getElementById('fileNamePattern'),
    patternPreview: document.getElementById('patternPreview'),
    maxConcurrent: document.getElementById('maxConcurrent'),
    maxCount: document.getElementById('maxCount'),
    showNotifications: document.getElementById('showNotifications'),
    autoRename: document.getElementById('autoRename'),
    autoStartDownload: document.getElementById('autoStartDownload'),
    
    // 图片格式
    formatCheckboxes: document.querySelectorAll('input[name="formats"]'),
    
    // 尺寸过滤
    minWidth: document.getElementById('minWidth'),
    minHeight: document.getElementById('minHeight'),
    maxWidth: document.getElementById('maxWidth'),
    maxHeight: document.getElementById('maxHeight'),
    excludeUnknownSize: document.getElementById('excludeUnknownSize'),
    
    // 关键词过滤
    includeKeywords: document.getElementById('includeKeywords'),
    excludeKeywords: document.getElementById('excludeKeywords'),
    
    // 域名过滤
    includeDomains: document.getElementById('includeDomains'),
    excludeDomains: document.getElementById('excludeDomains'),
    
    // 自动滚动
    autoScroll: document.getElementById('autoScroll'),
    scrollDelay: document.getElementById('scrollDelay'),
    maxScrollCount: document.getElementById('maxScrollCount'),
    stableThreshold: document.getElementById('stableThreshold'),
    
    // 图片来源
    includeBackground: document.getElementById('includeBackground'),
    includeMeta: document.getElementById('includeMeta'),
    includeDataUrl: document.getElementById('includeDataUrl'),
    includeLinks: document.getElementById('includeLinks'),
    
    // 懒加载属性
    lazyAttributes: document.getElementById('lazyAttributes'),
    
    // 重试策略
    maxRetries: document.getElementById('maxRetries'),
    retryDelay: document.getElementById('retryDelay'),
    
    // 网络设置
    downloadTimeout: document.getElementById('downloadTimeout'),
    messageTimeout: document.getElementById('messageTimeout'),
    
    // 性能优化
    enableThumbnailCache: document.getElementById('enableThumbnailCache'),
    deferImageLoading: document.getElementById('deferImageLoading'),
    
    // 调试模式
    debugMode: document.getElementById('debugMode'),
    
    // 按钮
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    openPopupBtn: document.getElementById('openPopupBtn'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMessage: document.getElementById('toastMessage')
  };

  // ==================== 默认设置 ====================
  
  const defaultSettings = {
    // 下载设置
    downloadPath: 'Downloaded_Images',
    fileNamePattern: 'image_{date}_{time}_{index}',
    maxConcurrent: 3,
    maxCount: 100,
    showNotifications: true,
    autoRename: true,
    autoStartDownload: false,
    
    // 图片格式
    formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    
    // 尺寸过滤
    minWidth: 0,
    minHeight: 0,
    maxWidth: 0,
    maxHeight: 0,
    excludeUnknownSize: false,
    
    // 关键词过滤
    includeKeywords: '',
    excludeKeywords: '',
    
    // 域名过滤
    includeDomains: '',
    excludeDomains: '',
    
    // 自动滚动
    autoScroll: true,
    scrollDelay: 800,
    maxScrollCount: 100,
    stableThreshold: 2000,
    
    // 图片来源
    includeBackground: false,
    includeMeta: true,
    includeDataUrl: false,
    includeLinks: false,
    
    // 懒加载属性
    lazyAttributes: 'data-src, data-lazy-src, data-original, data-lazy, data-srcset, data-lazy-srcset, data-bg, data-background',
    
    // 重试策略
    maxRetries: 3,
    retryDelay: 1000,
    
    // 网络设置
    downloadTimeout: 30000,
    messageTimeout: 5000,
    
    // 性能优化
    enableThumbnailCache: true,
    deferImageLoading: true,
    
    // 调试模式
    debugMode: false
  };

  // ==================== 初始化 ====================
  
  init();

  async function init() {
    await loadSettings();
    setupTabNavigation();
    setupEventListeners();
    updatePatternPreview();
  }

  // ==================== 设置管理 ====================

  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(defaultSettings);
      fillForm(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToast('加载设置失败', 'error');
    }
  }

  function fillForm(settings) {
    // 下载设置
    elements.downloadPath.value = settings.downloadPath || defaultSettings.downloadPath;
    elements.fileNamePattern.value = settings.fileNamePattern || defaultSettings.fileNamePattern;
    elements.maxConcurrent.value = settings.maxConcurrent ?? defaultSettings.maxConcurrent;
    elements.maxCount.value = settings.maxCount ?? defaultSettings.maxCount;
    elements.showNotifications.checked = settings.showNotifications ?? defaultSettings.showNotifications;
    elements.autoRename.checked = settings.autoRename ?? defaultSettings.autoRename;
    elements.autoStartDownload.checked = settings.autoStartDownload ?? defaultSettings.autoStartDownload;
    
    // 图片格式
    const formats = settings.formats || defaultSettings.formats;
    elements.formatCheckboxes.forEach(checkbox => {
      checkbox.checked = formats.includes(checkbox.value);
    });
    
    // 尺寸过滤
    elements.minWidth.value = settings.minWidth ?? defaultSettings.minWidth;
    elements.minHeight.value = settings.minHeight ?? defaultSettings.minHeight;
    elements.maxWidth.value = settings.maxWidth ?? defaultSettings.maxWidth;
    elements.maxHeight.value = settings.maxHeight ?? defaultSettings.maxHeight;
    elements.excludeUnknownSize.checked = settings.excludeUnknownSize ?? defaultSettings.excludeUnknownSize;
    
    // 关键词过滤
    elements.includeKeywords.value = settings.includeKeywords || defaultSettings.includeKeywords;
    elements.excludeKeywords.value = settings.excludeKeywords || defaultSettings.excludeKeywords;
    
    // 域名过滤
    elements.includeDomains.value = settings.includeDomains || defaultSettings.includeDomains;
    elements.excludeDomains.value = settings.excludeDomains || defaultSettings.excludeDomains;
    
    // 自动滚动
    elements.autoScroll.checked = settings.autoScroll ?? defaultSettings.autoScroll;
    elements.scrollDelay.value = settings.scrollDelay ?? defaultSettings.scrollDelay;
    elements.maxScrollCount.value = settings.maxScrollCount ?? defaultSettings.maxScrollCount;
    elements.stableThreshold.value = settings.stableThreshold ?? defaultSettings.stableThreshold;
    
    // 图片来源
    elements.includeBackground.checked = settings.includeBackground ?? defaultSettings.includeBackground;
    elements.includeMeta.checked = settings.includeMeta ?? defaultSettings.includeMeta;
    elements.includeDataUrl.checked = settings.includeDataUrl ?? defaultSettings.includeDataUrl;
    elements.includeLinks.checked = settings.includeLinks ?? defaultSettings.includeLinks;
    
    // 懒加载属性
    elements.lazyAttributes.value = settings.lazyAttributes || defaultSettings.lazyAttributes;
    
    // 重试策略
    elements.maxRetries.value = settings.maxRetries ?? defaultSettings.maxRetries;
    elements.retryDelay.value = settings.retryDelay ?? defaultSettings.retryDelay;
    
    // 网络设置
    elements.downloadTimeout.value = settings.downloadTimeout ?? defaultSettings.downloadTimeout;
    elements.messageTimeout.value = settings.messageTimeout ?? defaultSettings.messageTimeout;
    
    // 性能优化
    elements.enableThumbnailCache.checked = settings.enableThumbnailCache ?? defaultSettings.enableThumbnailCache;
    elements.deferImageLoading.checked = settings.deferImageLoading ?? defaultSettings.deferImageLoading;
    
    // 调试模式
    elements.debugMode.checked = settings.debugMode ?? defaultSettings.debugMode;
  }

  function collectSettings() {
    // 获取图片格式
    const formats = [];
    elements.formatCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        formats.push(checkbox.value);
      }
    });

    return {
      // 下载设置
      downloadPath: elements.downloadPath.value.trim() || defaultSettings.downloadPath,
      fileNamePattern: elements.fileNamePattern.value.trim() || defaultSettings.fileNamePattern,
      maxConcurrent: parseInt(elements.maxConcurrent.value, 10) || defaultSettings.maxConcurrent,
      maxCount: parseInt(elements.maxCount.value, 10) || defaultSettings.maxCount,
      showNotifications: elements.showNotifications.checked,
      autoRename: elements.autoRename.checked,
      autoStartDownload: elements.autoStartDownload.checked,
      
      // 图片格式
      formats: formats,
      
      // 尺寸过滤
      minWidth: parseInt(elements.minWidth.value, 10) || 0,
      minHeight: parseInt(elements.minHeight.value, 10) || 0,
      maxWidth: parseInt(elements.maxWidth.value, 10) || 0,
      maxHeight: parseInt(elements.maxHeight.value, 10) || 0,
      excludeUnknownSize: elements.excludeUnknownSize.checked,
      
      // 关键词过滤
      includeKeywords: elements.includeKeywords.value.trim(),
      excludeKeywords: elements.excludeKeywords.value.trim(),
      
      // 域名过滤
      includeDomains: elements.includeDomains.value.trim(),
      excludeDomains: elements.excludeDomains.value.trim(),
      
      // 自动滚动
      autoScroll: elements.autoScroll.checked,
      scrollDelay: parseInt(elements.scrollDelay.value, 10) || defaultSettings.scrollDelay,
      maxScrollCount: parseInt(elements.maxScrollCount.value, 10) || defaultSettings.maxScrollCount,
      stableThreshold: parseInt(elements.stableThreshold.value, 10) || defaultSettings.stableThreshold,
      
      // 图片来源
      includeBackground: elements.includeBackground.checked,
      includeMeta: elements.includeMeta.checked,
      includeDataUrl: elements.includeDataUrl.checked,
      includeLinks: elements.includeLinks.checked,
      
      // 懒加载属性
      lazyAttributes: elements.lazyAttributes.value.trim(),
      
      // 重试策略
      maxRetries: parseInt(elements.maxRetries.value, 10) || defaultSettings.maxRetries,
      retryDelay: parseInt(elements.retryDelay.value, 10) || defaultSettings.retryDelay,
      
      // 网络设置
      downloadTimeout: parseInt(elements.downloadTimeout.value, 10) || defaultSettings.downloadTimeout,
      messageTimeout: parseInt(elements.messageTimeout.value, 10) || defaultSettings.messageTimeout,
      
      // 性能优化
      enableThumbnailCache: elements.enableThumbnailCache.checked,
      deferImageLoading: elements.deferImageLoading.checked,
      
      // 调试模式
      debugMode: elements.debugMode.checked
    };
  }

  async function saveSettings() {
    try {
      const settings = collectSettings();
      await chrome.storage.sync.set(settings);
      showToast('设置已保存', 'success');
      
      // 通知 background 更新配置
      try {
        await chrome.runtime.sendMessage({
          action: 'updateSettings',
          data: settings
        });
      } catch (e) {
        // 忽略通信错误
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('保存设置失败：' + error.message, 'error');
    }
  }

  async function resetSettings() {
    if (!confirm('确定要恢复所有默认设置吗？此操作不可撤销。')) {
      return;
    }

    try {
      await chrome.storage.sync.set(defaultSettings);
      fillForm(defaultSettings);
      updatePatternPreview();
      showToast('已恢复默认设置', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      showToast('恢复默认设置失败', 'error');
    }
  }

  // ==================== 标签页导航 ====================

  function setupTabNavigation() {
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        switchToTab(tabId);
      });
    });
  }

  function switchToTab(tabId) {
    // 更新标签页状态
    elements.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // 更新内容显示
    elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
  }

  // ==================== 文件名模式预览 ====================

  function updatePatternPreview() {
    const pattern = elements.fileNamePattern.value || defaultSettings.fileNamePattern;
    const now = new Date();
    
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const timestamp = Date.now();
    const indexStr = '001';
    const filename = 'sample_image';
    const title = 'Example_Page';
    
    let preview = pattern;
    preview = preview.replace(/\{date\}/g, date);
    preview = preview.replace(/\{time\}/g, time);
    preview = preview.replace(/\{timestamp\}/g, timestamp);
    preview = preview.replace(/\{index\}/g, indexStr);
    preview = preview.replace(/\{filename\}/g, filename);
    preview = preview.replace(/\{title\}/g, title);
    
    elements.patternPreview.textContent = preview + '.jpg';
  }

  // ==================== 配置导入导出 ====================

  async function exportSettings() {
    try {
      const settings = collectSettings();
      const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        settings: settings
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `picgrabber-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('配置已导出', 'success');
    } catch (error) {
      console.error('Failed to export settings:', error);
      showToast('导出配置失败', 'error');
    }
  }

  function importSettings() {
    elements.importFile.click();
  }

  async function handleImportFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.settings) {
        throw new Error('无效的配置文件格式');
      }
      
      const settings = data.settings;
      await chrome.storage.sync.set(settings);
      fillForm(settings);
      updatePatternPreview();
      
      showToast('配置已导入', 'success');
    } catch (error) {
      console.error('Failed to import settings:', error);
      showToast('导入配置失败：' + error.message, 'error');
    }
  }

  // ==================== Toast 提示 ====================

  let toastTimeout = null;

  function showToast(message, type = 'success') {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    elements.toastIcon.textContent = icons[type] || icons.info;
    elements.toastMessage.textContent = message;
    
    elements.toast.className = 'toast toast-' + type;
    elements.toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 3000);
  }

  // ==================== 事件监听 ====================

  function setupEventListeners() {
    // 保存设置
    elements.saveBtn.addEventListener('click', saveSettings);
    
    // 恢复默认
    elements.resetBtn.addEventListener('click', resetSettings);
    
    // 导出配置
    elements.exportBtn.addEventListener('click', exportSettings);
    
    // 导入配置
    elements.importBtn.addEventListener('click', importSettings);
    elements.importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleImportFile(file);
      }
      e.target.value = '';
    });
    
    // 打开主面板
    elements.openPopupBtn.addEventListener('click', () => {
      chrome.action.openPopup();
    });
    
    // 文件名模式实时预览
    elements.fileNamePattern.addEventListener('input', updatePatternPreview);
    
    // 自动保存（输入变化后延迟保存）
    let autoSaveTimer = null;
    const autoSaveDelay = 2000;
    
    const inputs = [
      elements.downloadPath,
      elements.fileNamePattern,
      elements.maxConcurrent,
      elements.maxCount,
      elements.minWidth,
      elements.minHeight,
      elements.maxWidth,
      elements.maxHeight,
      elements.includeKeywords,
      elements.excludeKeywords,
      elements.includeDomains,
      elements.excludeDomains,
      elements.scrollDelay,
      elements.maxScrollCount,
      elements.stableThreshold,
      elements.lazyAttributes,
      elements.maxRetries,
      elements.retryDelay,
      elements.downloadTimeout,
      elements.messageTimeout
    ];
    
    const checkboxes = [
      elements.showNotifications,
      elements.autoRename,
      elements.autoStartDownload,
      elements.excludeUnknownSize,
      elements.autoScroll,
      elements.includeBackground,
      elements.includeMeta,
      elements.includeDataUrl,
      elements.includeLinks,
      elements.enableThumbnailCache,
      elements.deferImageLoading,
      elements.debugMode
    ];
    
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(saveSettings, autoSaveDelay);
      });
    });
    
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', saveSettings);
    });
    
    // 格式复选框
    elements.formatCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', saveSettings);
    });
  }
});
