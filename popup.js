// filepath: popup.js

/**
 * Popup Script - 用户界面交互
 * 支持自动滚动加载懒加载图片
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // 获取 DOM 元素
  const pageTitle = document.getElementById('pageTitle');
  const imageCount = document.getElementById('imageCount');
  const scanBtn = document.getElementById('scanBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const imageFormat = document.getElementById('imageFormat');
  const maxCount = document.getElementById('maxCount');
  const autoScroll = document.getElementById('autoScroll');
  const progressSection = document.getElementById('progressSection');
  const progressStatus = document.getElementById('progressStatus');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const statusMessage = document.getElementById('statusMessage');
  const openOptions = document.getElementById('openOptions');
  const openFolder = document.getElementById('openFolder');

  let currentImages = [];

  // 初始化
  init();

  async function init() {
    await loadSettings();
    await getPageInfo();
    setupEventListeners();
  }

  /**
   * 加载设置
   */
  async function loadSettings() {
    const settings = await chrome.storage.sync.get({
      imageFormat: 'all',
      maxCount: 100,
      autoScroll: true,
      minWidth: 0,
      minHeight: 0
    });

    imageFormat.value = settings.imageFormat;
    maxCount.value = settings.maxCount;
    autoScroll.checked = settings.autoScroll;

    // 保存尺寸限制到全局变量供 filterImages 使用
    window.minWidth = settings.minWidth;
    window.minHeight = settings.minHeight;
  }

  /**
   * 获取页面信息
   */
  async function getPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        pageTitle.textContent = '无法获取页面信息';
        return;
      }

      // 发送消息给 content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });

      if (response && response.success) {
        const { title, imageCount: count, pageType } = response.data;

        // 截断过长的标题
        const displayTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
        pageTitle.textContent = displayTitle;

        // 显示页面类型提示
        let typeHint = '';
        if (pageType) {
          if (pageType.infiniteScroll) {
            typeHint = ' (检测到无限滚动页面)';
          } else if (pageType.lazyLoad) {
            typeHint = ' (检测到懒加载)';
          }
        }

        imageCount.textContent = `检测到 ${count || 0} 张图片${typeHint}`;
      } else {
        pageTitle.textContent = '请刷新页面后重试';
        imageCount.textContent = '-';
      }
    } catch (error) {
      console.error('Failed to get page info:', error);
      pageTitle.textContent = '请刷新页面后重试';
      imageCount.textContent = '-';
    }
  }

  /**
   * 设置事件监听
   */
  function setupEventListeners() {
    // 扫描按钮
    scanBtn.addEventListener('click', scanImages);

    // 下载按钮
    downloadBtn.addEventListener('click', downloadImages);

    // 打开设置
    openOptions.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    // 打开文件夹
    openFolder.addEventListener('click', (e) => {
      e.preventDefault();
      openDownloadFolder();
    });

    // 设置变更时保存
    imageFormat.addEventListener('change', saveSettings);
    maxCount.addEventListener('change', saveSettings);
    autoScroll.addEventListener('change', saveSettings);

    // 监听滚动进度消息
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (message.action === 'scrollProgress') {
        const { scrollCount, currentImageCount } = message.data;
        progressStatus.textContent = `滚动中... 第 ${scrollCount} 次`;
        imageCount.textContent = `已发现 ${currentImageCount} 张图片`;
      }
      return true;
    });
  }

  /**
   * 保存设置
   */
  async function saveSettings() {
    await chrome.storage.sync.set({
      imageFormat: imageFormat.value,
      maxCount: parseInt(maxCount.value, 10),
      autoScroll: autoScroll.checked
    });
  }

  /**
   * 扫描图片
   */
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

      // 检查是否需要自动滚动
      if (autoScroll.checked) {
        const response = await autoScrollAndScan(tab);
        if (response && response.success) {
          await processScanResult(response.totalImages);
        } else {
          showStatus('扫描失败，请刷新页面后重试', 'error');
          setButtonState('idle');
        }
      } else {
        // 直接扫描
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanImages' });

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

  /**
   * 自动滚动并扫描
   */
  async function autoScrollAndScan(tab) {
    // 显示滚动进度
    progressSection.style.display = 'block';
    progressStatus.textContent = '正在滚动加载更多图片...';
    progressFill.style.width = '0%';
    progressText.textContent = '准备中...';

    // 禁用按钮
    scanBtn.disabled = true;
    downloadBtn.disabled = true;

    try {
      // 发送自动滚动消息
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'autoScroll',
        options: {
          scrollDelay: 1500,
          maxScrollCount: 50,
          stableThreshold: 3000
        }
      });

      if (response && response.success) {
        progressStatus.textContent = `滚动完成！共加载 ${response.scrollCount} 次，共 ${response.totalImages?.length || 0} 张图片`;
        await processScanResult(response.totalImages);
        return response;
      } else {
        showStatus('自动滚动失败，尝试普通扫描...', 'warning');
      }
    } catch (error) {
      console.error('Auto scroll failed:', error);
      showStatus('自动滚动失败：' + error.message, 'error');
    } finally {
      progressSection.style.display = 'none';
    }

    // 回退到普通扫描
    const fallbackResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scanImages' });
    if (fallbackResponse && fallbackResponse.success) {
      await processScanResult(fallbackResponse.images);
    }

    return fallbackResponse || {};
  }

  /**
   * 处理扫描结果
   */
  async function processScanResult(images) {
    // 应用过滤
    currentImages = filterImages(images);

    const total = images.length;
    const filtered = currentImages.length;

    if (filtered === 0 && total > 0) {
      showStatus(`扫描完成，但没有符合条件${getFormatText()}的图片`, 'warning');
    } else if (filtered === 0) {
      showStatus('页面中没有检测到图片', 'warning');
    } else {
      showStatus(`扫描完成！找到 ${filtered} 张图片`, 'success');
    }

    imageCount.textContent = `检测到 ${total} 张（${filtered} 张符合条件）`;

    // 启用下载按钮
    downloadBtn.disabled = false;
  }

  /**
   * 下载图片
   */
  async function downloadImages() {
    if (currentImages.length === 0) {
      showStatus('没有可下载的图片', 'warning');
      return;
    }

    try {
      setButtonState('downloading');

      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 发送消息给 background script
      const response = await chrome.runtime.sendMessage({
        action: 'startDownload',
        data: {
          images: currentImages,
          tabId: tab?.id
        }
      });

      if (response && response.success) {
        showStatus(`已开始下载 ${response.data.queued} 张图片`, 'success');

        // 显示进度
        progressSection.style.display = 'block';
        progressStatus.textContent = '正在下载...';
        updateProgress(0, response.data.queued);

        // 监听下载进度
        listenDownloadProgress(response.data.queued);
      } else {
        showStatus('下载失败：' + (response.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('Download failed:', error);
      showStatus('下载失败：' + error.message, 'error');
    } finally {
      setButtonState('idle');
    }
  }

  /**
   * 监听下载进度
   */
  function listenDownloadProgress(total) {
    let completed = 0;

    const listener = (message) => {
      if (message.action === 'downloadComplete') {
        completed = message.data.completed;
        updateProgress(completed, total);

        if (completed + message.data.failed >= total) {
          const failed = message.data.failed;
          if (failed > 0) {
            showStatus(`下载完成！成功 ${completed} 张，失败 ${failed} 张`, failed > 0 ? 'warning' : 'success');
          } else {
            showStatus(`下载完成！共 ${completed} 张图片`, 'success');
          }

          // 移除监听器
          chrome.runtime.onMessage.removeListener(listener);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
  }

  /**
   * 打开下载文件夹
   */
  async function openDownloadFolder() {
    try {
      await chrome.runtime.sendMessage({ action: 'openDownloadFolder' });
    } catch (error) {
      console.error('Failed to open folder:', error);
      // 如果无法通过扩展打开，直接打开下载页面
      await chrome.tabs.create({ url: 'chrome://downloads/' });
    }
  }

  /**
   * 过滤图片
   */
  function filterImages(images) {
    const format = imageFormat.value;
    const max = parseInt(maxCount.value, 10);
    const minWidth = parseInt(window.minWidth, 10) || 0;
    const minHeight = parseInt(window.minHeight, 10) || 0;

    // 转换为统一格式（兼容字符串 URL 和对象格式）
    const normalizedImages = images.map(img => {
      if (typeof img === 'string') {
        return { url: img, width: 0, height: 0 };
      }
      return img;
    });

    let filtered = normalizedImages;

    // 按格式过滤
    if (format !== 'all') {
      const allowedFormats = format.split(',');
      filtered = filtered.filter(img => {
        const extension = getExtension(img.url);
        return allowedFormats.includes(extension.toLowerCase());
      });
    }

    // 按尺寸过滤
    if (minWidth > 0 || minHeight > 0) {
      filtered = filtered.filter(img => {
        // 宽高都为 0 表示无法获取尺寸（背景图片等），保留
        if (img.width === 0 && img.height === 0) {
          return true;
        }
        // 至少有一个维度满足要求就保留
        const widthOk = minWidth === 0 || img.width >= minWidth;
        const heightOk = minHeight === 0 || img.height >= minHeight;
        return widthOk && heightOk;
      });
    }

    // 限制数量
    return filtered.slice(0, max).map(img => img.url);
  }

  /**
   * 获取扩展名
   */
  function getExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      if (match) {
        return match[1].toLowerCase();
      }
      return 'jpg';
    } catch (error) {
      return 'jpg';
    }
  }

  /**
   * 获取格式文本
   */
  function getFormatText() {
    const format = imageFormat.value;
    if (format === 'all') return '';
    return format.replace(/,/g, '/');
  }

  /**
   * 更新进度
   */
  function updateProgress(completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    progressFill.style.width = percent + '%';
    progressText.textContent = `${completed} / ${total}`;
  }

  /**
   * 显示状态消息
   */
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message status-' + type;
    statusMessage.style.display = 'block';

    // 3 秒后隐藏
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }

  /**
   * 设置按钮状态
   */
  function setButtonState(state) {
    switch (state) {
      case 'scanning':
        scanBtn.disabled = true;
        scanBtn.textContent = '扫描中...';
        downloadBtn.disabled = true;
        break;
      case 'downloading':
        scanBtn.disabled = true;
        downloadBtn.disabled = true;
        downloadBtn.textContent = '下载中...';
        break;
      case 'idle':
      default:
        scanBtn.disabled = false;
        scanBtn.textContent = '扫描图片';
        downloadBtn.disabled = currentImages.length === 0;
        downloadBtn.textContent = '下载全部';
        break;
    }
  }
});
