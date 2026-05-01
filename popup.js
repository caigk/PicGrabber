// filepath: popup.js

/**
 * Popup Script - 用户界面交互（优化版）
 * 支持图片预览、精细化筛选、下载控制
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // ==================== DOM 元素引用 ====================
  
  const elements = {
    pageTitle: document.getElementById('pageTitle'),
    imageCount: document.getElementById('imageCount'),
    
    toggleSettings: document.getElementById('toggleSettings'),
    settingsPanel: document.getElementById('settingsPanel'),
    
    imageFormat: document.getElementById('imageFormat'),
    maxCount: document.getElementById('maxCount'),
    minWidth: document.getElementById('minWidth'),
    minHeight: document.getElementById('minHeight'),
    maxWidth: document.getElementById('maxWidth'),
    maxHeight: document.getElementById('maxHeight'),
    excludeUnknownSize: document.getElementById('excludeUnknownSize'),
    includeKeywords: document.getElementById('includeKeywords'),
    excludeKeywords: document.getElementById('excludeKeywords'),
    includeDomains: document.getElementById('includeDomains'),
    excludeDomains: document.getElementById('excludeDomains'),
    autoScroll: document.getElementById('autoScroll'),
    includeBackground: document.getElementById('includeBackground'),
    includeMeta: document.getElementById('includeMeta'),
    includeDataUrl: document.getElementById('includeDataUrl'),
    includeLinks: document.getElementById('includeLinks'),
    
    scanBtn: document.getElementById('scanBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    
    downloadControls: document.getElementById('downloadControls'),
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    
    progressSection: document.getElementById('progressSection'),
    progressStatus: document.getElementById('progressStatus'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressDetails: document.getElementById('progressDetails'),
    detailSuccess: document.getElementById('detailSuccess'),
    detailFailed: document.getElementById('detailFailed'),
    detailPending: document.getElementById('detailPending'),
    
    statusMessage: document.getElementById('statusMessage'),
    
    imagePreviewSection: document.getElementById('imagePreviewSection'),
    imageGrid: document.getElementById('imageGrid'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    selectedCount: document.getElementById('selectedCount'),
    
    taskListSection: document.getElementById('taskListSection'),
    taskList: document.getElementById('taskList'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    
    openOptions: document.getElementById('openOptions'),
    openFolder: document.getElementById('openFolder'),
    
    imageModal: document.getElementById('imageModal'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalClose: document.getElementById('modalClose'),
    modalImage: document.getElementById('modalImage'),
    modalFilename: document.getElementById('modalFilename'),
    modalSize: document.getElementById('modalSize'),
    downloadSingleBtn: document.getElementById('downloadSingleBtn'),
    openImageBtn: document.getElementById('openImageBtn')
  };

  // ==================== 全局状态 ====================
  
  let state = {
    allImages: [],
    filteredImages: [],
    selectedImages: new Set(),
    currentTabId: null,
    isDownloading: false,
    isPaused: false,
    currentModalImage: null,
    settingsExpanded: false
  };

  // ==================== 初始化 ====================
  
  await init();

  async function init() {
    await loadSettings();
    await getPageInfo();
    setupEventListeners();
    setupMessageListeners();
    
    elements.settingsPanel.style.display = 'none';
  }

  // ==================== 设置管理 ====================

  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        imageFormat: 'all',
        maxCount: 100,
        minWidth: 0,
        minHeight: 0,
        maxWidth: 0,
        maxHeight: 0,
        excludeUnknownSize: false,
        includeKeywords: '',
        excludeKeywords: '',
        includeDomains: '',
        excludeDomains: '',
        autoScroll: true,
        includeBackground: false,
        includeMeta: true,
        includeDataUrl: false,
        includeLinks: false
      });

      elements.imageFormat.value = settings.imageFormat;
      elements.maxCount.value = settings.maxCount;
      elements.minWidth.value = settings.minWidth;
      elements.minHeight.value = settings.minHeight;
      elements.maxWidth.value = settings.maxWidth;
      elements.maxHeight.value = settings.maxHeight;
      elements.excludeUnknownSize.checked = settings.excludeUnknownSize;
      elements.includeKeywords.value = settings.includeKeywords;
      elements.excludeKeywords.value = settings.excludeKeywords;
      elements.includeDomains.value = settings.includeDomains;
      elements.excludeDomains.value = settings.excludeDomains;
      elements.autoScroll.checked = settings.autoScroll;
      elements.includeBackground.checked = settings.includeBackground;
      elements.includeMeta.checked = settings.includeMeta;
      elements.includeDataUrl.checked = settings.includeDataUrl;
      elements.includeLinks.checked = settings.includeLinks;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveSettings() {
    try {
      const settings = {
        imageFormat: elements.imageFormat.value,
        maxCount: parseInt(elements.maxCount.value, 10) || 100,
        minWidth: parseInt(elements.minWidth.value, 10) || 0,
        minHeight: parseInt(elements.minHeight.value, 10) || 0,
        maxWidth: parseInt(elements.maxWidth.value, 10) || 0,
        maxHeight: parseInt(elements.maxHeight.value, 10) || 0,
        excludeUnknownSize: elements.excludeUnknownSize.checked,
        includeKeywords: elements.includeKeywords.value.trim(),
        excludeKeywords: elements.excludeKeywords.value.trim(),
        includeDomains: elements.includeDomains.value.trim(),
        excludeDomains: elements.excludeDomains.value.trim(),
        autoScroll: elements.autoScroll.checked,
        includeBackground: elements.includeBackground.checked,
        includeMeta: elements.includeMeta.checked,
        includeDataUrl: elements.includeDataUrl.checked,
        includeLinks: elements.includeLinks.checked
      };

      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  // ==================== 页面信息获取 ====================

  async function getPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        elements.pageTitle.textContent = '无法获取页面信息';
        return;
      }

      state.currentTabId = tab.id;

      if (isChromeInternalPage(tab.url)) {
        elements.pageTitle.textContent = 'Chrome 内部页面';
        elements.imageCount.textContent = '扩展无法访问此页面';
        showStatus('Chrome 内部页面无法被扩展访问', 'warning');
        return;
      }

      const response = await safeSendMessage(tab.id, { action: 'getPageInfo' });

      if (response && response.success) {
        const { title, imageCount: count, pageType, totalImages } = response.data;

        const displayTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;
        elements.pageTitle.textContent = displayTitle;

        let typeHint = '';
        if (pageType) {
          if (pageType.infiniteScroll) {
            typeHint = ' (无限滚动页面)';
          } else if (pageType.lazyLoad) {
            typeHint = ' (检测到懒加载)';
          } else if (pageType.hasLoadMore) {
            typeHint = ' (检测到加载更多)';
          }
        }

        elements.imageCount.textContent = `检测到 ${count || 0} 张图片${typeHint}`;
      } else {
        elements.pageTitle.textContent = '请刷新页面后重试';
        elements.imageCount.textContent = '-';
      }
    } catch (error) {
      console.error('Failed to get page info:', error);
      
      const errorMessage = analyzeConnectionError(error);
      elements.pageTitle.textContent = errorMessage.title;
      elements.imageCount.textContent = errorMessage.subtitle;
      showStatus(errorMessage.hint, 'warning');
    }
  }

  function isChromeInternalPage(url) {
    if (!url) return false;
    const internalPatterns = [
      'chrome://',
      'chrome-extension://',
      'about:',
      'chrome-search://',
      'chrome-devtools://'
    ];
    return internalPatterns.some(pattern => url.startsWith(pattern));
  }

  function analyzeConnectionError(error) {
    const errorStr = error.message || String(error);
    
    if (errorStr.includes('Receiving end does not exist') || 
        errorStr.includes('Could not establish connection')) {
      return {
        title: 'Content Script 未加载',
        subtitle: '请刷新页面后重试',
        hint: '页面在扩展安装/更新前已打开，请刷新页面使扩展生效'
      };
    }
    
    if (errorStr.includes('Cannot access contents of url')) {
      return {
        title: '无法访问此页面',
        subtitle: '权限不足',
        hint: '扩展无法访问 Chrome 内部页面或受保护的页面'
      };
    }
    
    return {
      title: '连接失败',
      subtitle: '请刷新页面后重试',
      hint: '与页面通信失败：' + errorStr
    };
  }

  async function safeSendMessage(tabId, message, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 500;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // ==================== 图片扫描 ====================

  async function scanImages() {
    try {
      setButtonState('scanning');
      showStatus('正在扫描页面图片...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        showStatus('无法获取当前标签页', 'error');
        setButtonState('idle');
        return;
      }

      state.currentTabId = tab.id;

      if (elements.autoScroll.checked) {
        await autoScrollAndScan(tab);
      } else {
        const response = await safeSendMessage(tab.id, {
          action: 'scanImages',
          options: {
            includeDataUrl: elements.includeDataUrl.checked,
            includeLinks: elements.includeLinks.checked,
            includeMeta: elements.includeMeta.checked
          }
        });

        if (response && response.success) {
          await processScanResult(response.totalImages);
        } else {
          showStatus('扫描失败，请刷新页面后重试', 'error');
          setButtonState('idle');
        }
      }
    } catch (error) {
      console.error('Scan failed:', error);
      showStatus('扫描失败：' + error.message, 'error');
      setButtonState('idle');
    }
  }

  async function autoScrollAndScan(tab) {
    elements.progressSection.style.display = 'block';
    elements.progressStatus.textContent = '正在滚动加载更多图片...';
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '准备中...';

    elements.scanBtn.disabled = true;
    elements.downloadBtn.disabled = true;

    try {
      const response = await safeSendMessage(tab.id, {
        action: 'autoScroll',
        options: {
          scrollDelay: 800,
          maxScrollCount: 100,
          stableThreshold: 2000
        }
      });

      if (response && response.success) {
        elements.progressStatus.textContent = `滚动完成！共加载 ${response.scrollCount} 次`;
        await processScanResult(response.totalImages);
        return;
      } else {
        showStatus('自动滚动失败，尝试普通扫描...', 'warning');
      }
    } catch (error) {
      console.error('Auto scroll failed:', error);
      showStatus('自动滚动失败：' + error.message, 'error');
    } finally {
      elements.progressSection.style.display = 'none';
    }

    const fallbackResponse = await safeSendMessage(tab.id, { action: 'scanImages' });
    if (fallbackResponse && fallbackResponse.success) {
      await processScanResult(fallbackResponse.totalImages);
    }
  }

  async function processScanResult(images) {
    state.allImages = images || [];
    state.selectedImages.clear();

    state.filteredImages = applyFilters(state.allImages);

    const total = state.allImages.length;
    const filtered = state.filteredImages.length;

    if (filtered === 0 && total > 0) {
      showStatus(`扫描完成，但没有符合条件的图片`, 'warning');
    } else if (filtered === 0) {
      showStatus('页面中没有检测到图片', 'warning');
    } else {
      showStatus(`扫描完成！找到 ${filtered} 张图片`, 'success');
    }

    elements.imageCount.textContent = `检测到 ${total} 张（${filtered} 张符合条件）`;

    state.filteredImages.forEach((_, index) => {
      state.selectedImages.add(index);
    });

    renderImageGrid();
    updateSelectedCount();

    elements.imagePreviewSection.style.display = 'block';
    elements.downloadBtn.disabled = state.selectedImages.size === 0;

    setButtonState('idle');
  }

  // ==================== 图片筛选 ====================

  function applyFilters(images) {
    if (!images || images.length === 0) return [];

    let filtered = [...images];

    const format = elements.imageFormat.value;
    if (format !== 'all') {
      const allowedFormats = format.split(',').map(f => f.trim().toLowerCase());
      filtered = filtered.filter(img => {
        const ext = getExtension(img.url);
        return allowedFormats.includes(ext.toLowerCase());
      });
    }

    const minW = parseInt(elements.minWidth.value, 10) || 0;
    const minH = parseInt(elements.minHeight.value, 10) || 0;
    const maxW = parseInt(elements.maxWidth.value, 10) || 0;
    const maxH = parseInt(elements.maxHeight.value, 10) || 0;
    const excludeUnknown = elements.excludeUnknownSize.checked;

    if (minW > 0 || minH > 0 || maxW > 0 || maxH > 0 || excludeUnknown) {
      filtered = filtered.filter(img => {
        const width = img.width || 0;
        const height = img.height || 0;

        if (width === 0 && height === 0) {
          return !excludeUnknown;
        }

        if (minW > 0 && width < minW) return false;
        if (minH > 0 && height < minH) return false;
        if (maxW > 0 && width > maxW) return false;
        if (maxH > 0 && height > maxH) return false;

        return true;
      });
    }

    const includeKw = elements.includeKeywords.value.trim();
    if (includeKw) {
      const keywords = includeKw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
      if (keywords.length > 0) {
        filtered = filtered.filter(img => {
          const url = img.url.toLowerCase();
          return keywords.some(kw => url.includes(kw));
        });
      }
    }

    const excludeKw = elements.excludeKeywords.value.trim();
    if (excludeKw) {
      const keywords = excludeKw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
      if (keywords.length > 0) {
        filtered = filtered.filter(img => {
          const url = img.url.toLowerCase();
          return !keywords.some(kw => url.includes(kw));
        });
      }
    }

    const includeDomains = elements.includeDomains.value.trim();
    if (includeDomains) {
      const domains = includeDomains.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
      if (domains.length > 0) {
        filtered = filtered.filter(img => {
          try {
            const url = new URL(img.url);
            return domains.some(domain => url.hostname.includes(domain));
          } catch (e) {
            return true;
          }
        });
      }
    }

    const excludeDomains = elements.excludeDomains.value.trim();
    if (excludeDomains) {
      const domains = excludeDomains.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
      if (domains.length > 0) {
        filtered = filtered.filter(img => {
          try {
            const url = new URL(img.url);
            return !domains.some(domain => url.hostname.includes(domain));
          } catch (e) {
            return true;
          }
        });
      }
    }

    const maxCount = parseInt(elements.maxCount.value, 10) || 100;
    return filtered.slice(0, maxCount);
  }

  // ==================== 图片预览网格 ====================

  function renderImageGrid() {
    elements.imageGrid.innerHTML = '';

    state.filteredImages.forEach((img, index) => {
      const item = createImageItem(img, index);
      elements.imageGrid.appendChild(item);
    });
  }

  function createImageItem(img, index) {
    const div = document.createElement('div');
    div.className = 'image-item' + (state.selectedImages.has(index) ? ' selected' : '');
    div.dataset.index = index;

    const thumbnail = document.createElement('div');
    thumbnail.className = 'image-thumbnail';
    
    const imgEl = document.createElement('img');
    imgEl.src = img.url;
    imgEl.alt = `图片 ${index + 1}`;
    imgEl.loading = 'lazy';
    
    imgEl.onerror = function() {
      this.style.display = 'none';
      thumbnail.classList.add('no-preview');
      thumbnail.innerHTML = `
        <div class="no-preview-icon">🖼️</div>
        <div class="no-preview-text">无法预览</div>
      `;
    };

    thumbnail.appendChild(imgEl);

    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';
    
    const checkbox = document.createElement('div');
    checkbox.className = 'image-checkbox' + (state.selectedImages.has(index) ? ' checked' : '');
    checkbox.innerHTML = state.selectedImages.has(index) ? '✓' : '';

    const info = document.createElement('div');
    info.className = 'image-info';
    
    const size = document.createElement('span');
    size.className = 'image-size';
    if (img.width > 0 && img.height > 0) {
      size.textContent = `${img.width} × ${img.height}`;
    } else {
      size.textContent = '尺寸未知';
    }
    
    const ext = document.createElement('span');
    ext.className = 'image-ext';
    ext.textContent = (img.extension || getExtension(img.url)).toUpperCase();

    info.appendChild(ext);
    info.appendChild(size);
    overlay.appendChild(checkbox);
    overlay.appendChild(info);

    div.appendChild(thumbnail);
    div.appendChild(overlay);

    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleImageSelection(index);
    });

    div.addEventListener('click', (e) => {
      if (e.target === checkbox || checkbox.contains(e.target)) return;
      openImageModal(img, index);
    });

    div.addEventListener('dblclick', (e) => {
      toggleImageSelection(index);
    });

    return div;
  }

  function toggleImageSelection(index) {
    if (state.selectedImages.has(index)) {
      state.selectedImages.delete(index);
    } else {
      state.selectedImages.add(index);
    }
    
    updateSelectedCount();
    updateImageItemSelection(index);
    elements.downloadBtn.disabled = state.selectedImages.size === 0;
  }

  function updateImageItemSelection(index) {
    const item = elements.imageGrid.querySelector(`[data-index="${index}"]`);
    if (item) {
      const checkbox = item.querySelector('.image-checkbox');
      if (state.selectedImages.has(index)) {
        item.classList.add('selected');
        checkbox.classList.add('checked');
        checkbox.innerHTML = '✓';
      } else {
        item.classList.remove('selected');
        checkbox.classList.remove('checked');
        checkbox.innerHTML = '';
      }
    }
  }

  function updateSelectedCount() {
    elements.selectedCount.textContent = `已选择: ${state.selectedImages.size}`;
  }

  function selectAll() {
    state.filteredImages.forEach((_, index) => {
      state.selectedImages.add(index);
    });
    updateSelectedCount();
    renderImageGrid();
    elements.downloadBtn.disabled = false;
  }

  function deselectAll() {
    state.selectedImages.clear();
    updateSelectedCount();
    renderImageGrid();
    elements.downloadBtn.disabled = true;
  }

  // ==================== 图片模态框 ====================

  function openImageModal(img, index) {
    state.currentModalImage = { img, index };
    
    elements.modalImage.src = img.url;
    elements.modalFilename.textContent = getFilenameFromUrl(img.url);
    
    if (img.width > 0 && img.height > 0) {
      elements.modalSize.textContent = `${img.width} × ${img.height} px`;
    } else {
      elements.modalSize.textContent = '尺寸未知';
    }
    
    elements.imageModal.style.display = 'flex';
  }

  function closeImageModal() {
    elements.imageModal.style.display = 'none';
    state.currentModalImage = null;
  }

  function getFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1] || 'image';
    } catch (e) {
      return 'image';
    }
  }

  // ==================== 下载功能 ====================

  async function downloadImages() {
    if (state.selectedImages.size === 0) {
      showStatus('没有选择要下载的图片', 'warning');
      return;
    }

    try {
      const selectedIndices = Array.from(state.selectedImages).sort((a, b) => a - b);
      const imagesToDownload = selectedIndices.map(i => state.filteredImages[i]);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      state.isDownloading = true;
      setButtonState('downloading');

      const response = await chrome.runtime.sendMessage({
        action: 'startDownload',
        data: {
          images: imagesToDownload,
          tabId: tab?.id,
          options: {
            metadata: {
              title: document.title
            }
          }
        }
      });

      if (response && response.success) {
        showStatus(`已开始下载 ${response.data.queued} 张图片`, 'success');

        elements.progressSection.style.display = 'block';
        elements.progressDetails.style.display = 'block';
        elements.downloadControls.style.display = 'block';
        elements.taskListSection.style.display = 'block';
        
        updateProgress(0, response.data.queued);
        updateDownloadControls(false);
      } else {
        showStatus('下载失败：' + (response?.error || '未知错误'), 'error');
        setButtonState('idle');
      }
    } catch (error) {
      console.error('Download failed:', error);
      showStatus('下载失败：' + error.message, 'error');
      setButtonState('idle');
    }
  }

  async function pauseDownloads() {
    try {
      await chrome.runtime.sendMessage({ action: 'pauseDownloads' });
      state.isPaused = true;
      updateDownloadControls(true);
      showStatus('下载已暂停', 'info');
    } catch (error) {
      console.error('Pause failed:', error);
      showStatus('暂停失败：' + error.message, 'error');
    }
  }

  async function resumeDownloads() {
    try {
      await chrome.runtime.sendMessage({ action: 'resumeDownloads' });
      state.isPaused = false;
      updateDownloadControls(false);
      showStatus('下载已继续', 'info');
    } catch (error) {
      console.error('Resume failed:', error);
      showStatus('继续失败：' + error.message, 'error');
    }
  }

  async function cancelDownloads() {
    try {
      await chrome.runtime.sendMessage({ action: 'cancelDownloads' });
      state.isDownloading = false;
      state.isPaused = false;
      
      elements.downloadControls.style.display = 'none';
      elements.progressSection.style.display = 'none';
      setButtonState('idle');
      showStatus('下载已取消', 'info');
    } catch (error) {
      console.error('Cancel failed:', error);
      showStatus('取消失败：' + error.message, 'error');
    }
  }

  function updateDownloadControls(isPaused) {
    if (isPaused) {
      elements.pauseBtn.style.display = 'none';
      elements.resumeBtn.style.display = 'inline-flex';
    } else {
      elements.pauseBtn.style.display = 'inline-flex';
      elements.resumeBtn.style.display = 'none';
    }
  }

  // ==================== 消息监听 ====================

  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      switch (message.action) {
        case 'scrollProgress':
          handleScrollProgress(message.data);
          break;
        case 'downloadTaskUpdate':
          handleTaskUpdate(message.data);
          break;
        case 'downloadTaskComplete':
          handleTaskComplete(message.data);
          break;
        case 'downloadTaskFailed':
          handleTaskFailed(message.data);
          break;
        case 'downloadBatchComplete':
          handleBatchComplete(message.data);
          break;
        case 'downloadPaused':
          state.isPaused = true;
          updateDownloadControls(true);
          break;
        case 'downloadResumed':
          state.isPaused = false;
          updateDownloadControls(false);
          break;
      }
      return true;
    });
  }

  function handleScrollProgress(data) {
    const { scrollCount, currentImageCount } = data;
    elements.progressStatus.textContent = `滚动中... 第 ${scrollCount} 次`;
    elements.imageCount.textContent = `已发现 ${currentImageCount} 张图片`;
  }

  function handleTaskUpdate(task) {
    renderTaskList();
    
    const stats = getCurrentStats();
    updateProgress(stats.completed + stats.failed, stats.total);
    updateProgressDetails(stats);
  }

  function handleTaskComplete(task) {
    renderTaskList();
    
    const stats = getCurrentStats();
    updateProgress(stats.completed + stats.failed, stats.total);
    updateProgressDetails(stats);
  }

  function handleTaskFailed(task) {
    renderTaskList();
    
    const stats = getCurrentStats();
    updateProgress(stats.completed + stats.failed, stats.total);
    updateProgressDetails(stats);
  }

  function handleBatchComplete(stats) {
    state.isDownloading = false;
    elements.downloadControls.style.display = 'none';
    
    const completed = stats.completed;
    const failed = stats.failed;
    
    if (failed > 0) {
      showStatus(`下载完成！成功 ${completed} 张，失败 ${failed} 张`, 'warning');
    } else {
      showStatus(`下载完成！共 ${completed} 张图片`, 'success');
    }
  }

  async function getCurrentStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDownloadStatus' });
      if (response && response.success) {
        return response.data;
      }
    } catch (e) {
      console.error('Failed to get stats:', e);
    }
    return { total: 0, completed: 0, failed: 0, pending: 0 };
  }

  async function renderTaskList() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllTasks' });
      if (response && response.success) {
        const tasks = response.data;
        
        elements.taskList.innerHTML = '';
        
        tasks.forEach(task => {
          const item = createTaskItem(task);
          elements.taskList.appendChild(item);
        });
      }
    } catch (e) {
      console.error('Failed to render task list:', e);
    }
  }

  function createTaskItem(task) {
    const div = document.createElement('div');
    div.className = 'task-item';
    
    const statusClass = getStatusClass(task.status);
    const statusText = getStatusText(task.status);
    
    div.innerHTML = `
      <div class="task-info">
        <span class="task-filename">${task.filename}</span>
        <span class="task-status ${statusClass}">${statusText}</span>
      </div>
      <div class="task-progress">
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${task.progress}%"></div>
        </div>
        <span class="task-progress-text">${task.progress}%</span>
      </div>
      ${task.error ? `<div class="task-error">${task.error}</div>` : ''}
      <div class="task-actions">
        ${task.status === 'failed' ? `<button class="btn-text task-retry" data-id="${task.id}">重试</button>` : ''}
        ${task.status === 'pending' || task.status === 'downloading' || task.status === 'paused' 
          ? `<button class="btn-text task-cancel" data-id="${task.id}">取消</button>` : ''}
      </div>
    `;
    
    const retryBtn = div.querySelector('.task-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ 
          action: 'retryTask', 
          taskId: task.id 
        });
      });
    }
    
    const cancelBtn = div.querySelector('.task-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ 
          action: 'cancelTask', 
          taskId: task.id 
        });
      });
    }
    
    return div;
  }

  function getStatusClass(status) {
    const map = {
      'pending': 'status-pending',
      'downloading': 'status-downloading',
      'paused': 'status-paused',
      'completed': 'status-completed',
      'failed': 'status-failed',
      'cancelled': 'status-cancelled'
    };
    return map[status] || '';
  }

  function getStatusText(status) {
    const map = {
      'pending': '等待中',
      'downloading': '下载中',
      'paused': '已暂停',
      'completed': '已完成',
      'failed': '失败',
      'cancelled': '已取消'
    };
    return map[status] || status;
  }

  // ==================== UI 辅助函数 ====================

  function updateProgress(completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    elements.progressFill.style.width = percent + '%';
    elements.progressText.textContent = `${completed} / ${total}`;
  }

  function updateProgressDetails(stats) {
    elements.detailSuccess.textContent = stats.completed || 0;
    elements.detailFailed.textContent = stats.failed || 0;
    elements.detailPending.textContent = stats.pending || 0;
  }

  function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = 'status-message status-' + type;
    elements.statusMessage.style.display = 'block';

    setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 4000);
  }

  function setButtonState(state) {
    switch (state) {
      case 'scanning':
        elements.scanBtn.disabled = true;
        elements.scanBtn.innerHTML = '<span class="btn-icon">⏳</span><span>扫描中...</span>';
        elements.downloadBtn.disabled = true;
        break;
      case 'downloading':
        elements.scanBtn.disabled = true;
        elements.downloadBtn.disabled = true;
        elements.downloadBtn.innerHTML = '<span class="btn-icon">⏳</span><span>下载中...</span>';
        break;
      case 'idle':
      default:
        elements.scanBtn.disabled = false;
        elements.scanBtn.innerHTML = '<span class="btn-icon">🔍</span><span>扫描图片</span>';
        elements.downloadBtn.disabled = state.selectedImages?.size === 0;
        elements.downloadBtn.innerHTML = '<span class="btn-icon">⬇️</span><span>下载选中</span>';
        break;
    }
  }

  // ==================== 工具函数 ====================

  function getExtension(url) {
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
  }

  function toggleSettingsPanel() {
    state.settingsExpanded = !state.settingsExpanded;
    
    if (state.settingsExpanded) {
      elements.settingsPanel.style.display = 'block';
      elements.toggleSettings.textContent = '▼';
      elements.toggleSettings.title = '收起设置';
    } else {
      elements.settingsPanel.style.display = 'none';
      elements.toggleSettings.textContent = '⚙️';
      elements.toggleSettings.title = '展开设置';
    }
  }

  // ==================== 事件监听 ====================

  function setupEventListeners() {
    elements.scanBtn.addEventListener('click', scanImages);
    elements.downloadBtn.addEventListener('click', downloadImages);
    
    elements.pauseBtn.addEventListener('click', pauseDownloads);
    elements.resumeBtn.addEventListener('click', resumeDownloads);
    elements.cancelBtn.addEventListener('click', cancelDownloads);
    
    elements.selectAllBtn.addEventListener('click', selectAll);
    elements.deselectAllBtn.addEventListener('click', deselectAll);
    
    elements.clearCompletedBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'clearCompleted' });
      renderTaskList();
    });
    
    elements.toggleSettings.addEventListener('click', toggleSettingsPanel);
    
    elements.openOptions.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    
    elements.openFolder.addEventListener('click', (e) => {
      e.preventDefault();
      openDownloadFolder();
    });
    
    elements.modalClose.addEventListener('click', closeImageModal);
    elements.modalOverlay.addEventListener('click', closeImageModal);
    
    elements.downloadSingleBtn.addEventListener('click', async () => {
      if (state.currentModalImage) {
        const { img, index } = state.currentModalImage;
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        await chrome.runtime.sendMessage({
          action: 'startDownload',
          data: {
            images: [img],
            tabId: tab?.id
          }
        });
        
        showStatus('已添加到下载队列', 'success');
        closeImageModal();
      }
    });
    
    elements.openImageBtn.addEventListener('click', () => {
      if (state.currentModalImage) {
        chrome.tabs.create({ url: state.currentModalImage.img.url });
        closeImageModal();
      }
    });
    
    const filterInputs = [
      elements.imageFormat, elements.maxCount,
      elements.minWidth, elements.minHeight,
      elements.maxWidth, elements.maxHeight,
      elements.excludeUnknownSize,
      elements.includeKeywords, elements.excludeKeywords,
      elements.includeDomains, elements.excludeDomains,
      elements.autoScroll,
      elements.includeBackground, elements.includeMeta,
      elements.includeDataUrl, elements.includeLinks
    ];
    
    filterInputs.forEach(input => {
      const eventType = input.type === 'checkbox' ? 'change' : 'input';
      input.addEventListener(eventType, () => {
        saveSettings();
        
        if (state.allImages.length > 0) {
          state.filteredImages = applyFilters(state.allImages);
          state.selectedImages.clear();
          state.filteredImages.forEach((_, index) => {
            state.selectedImages.add(index);
          });
          renderImageGrid();
          updateSelectedCount();
          
          const total = state.allImages.length;
          const filtered = state.filteredImages.length;
          elements.imageCount.textContent = `检测到 ${total} 张（${filtered} 张符合条件）`;
          elements.downloadBtn.disabled = state.selectedImages.size === 0;
        }
      });
    });
  }

  async function openDownloadFolder() {
    try {
      await chrome.runtime.sendMessage({ action: 'openDownloadFolder' });
    } catch (error) {
      console.error('Failed to open folder:', error);
      await chrome.tabs.create({ url: 'chrome://downloads/' });
    }
  }
});
