// filepath: background.js

/**
 * Background Script - 下载模块
 * 处理扩展的核心逻辑，包括下载管理
 */

'use strict';

const MAX_CONCURRENT_DOWNLOADS = 3;
const DOWNLOAD_DIRECTORY = 'Downloaded_Images';

/**
 * 下载队列类
 */
class DownloadQueue {
  constructor(maxConcurrent = MAX_CONCURRENT_DOWNLOADS) {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.completed = 0;
    this.failed = 0;
  }

  /**
   * 添加下载任务
   * @param {Object} task - 任务对象
   */
  add(task) {
    this.queue.push(task);
    this.process();
  }

  /**
   * 处理队列
   */
  async process() {
    if (this.active >= this.maxConcurrent) {
      return;
    }

    if (this.queue.length === 0) {
      if (this.active === 0) {
        this.notifyComplete();
      }
      return;
    }

    const task = this.queue.shift();
    this.active++;

    try {
      await this.download(task);
    } catch (error) {
      console.error('[DownloadQueue] Download failed:', error);
      this.failed++;
    }

    this.active--;
    this.completed++;
    this.process();
  }

  /**
   * 执行下载
   * @param {Object} task - 任务对象
   */
  async download(task) {
    const { url, filename, tabId } = task;

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: `${DOWNLOAD_DIRECTORY}/${filename}`,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log(`[DownloadQueue] Started download: ${filename}`);
          resolve(downloadId);
        }
      });
    });
  }

  /**
   * 通知下载完成
   */
  notifyComplete() {
    chrome.runtime.sendMessage({
      action: 'downloadComplete',
      data: {
        completed: this.completed,
        failed: this.failed,
        total: this.completed + this.failed
      }
    });
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      active: this.active,
      completed: this.completed,
      failed: this.failed
    };
  }
}

// 全局下载队列
const downloadQueue = new DownloadQueue();

/**
 * 初始化
 */
function init() {
  console.log('[Background] Service worker initialized');

  // 监听下载事件
  chrome.downloads.onChanged.addListener((downloadDelta) => {
    // 可以在这里处理下载进度更新
  });

  // 监听来自 content script 或 popup 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放
  });
}

/**
 * 处理消息
 * @param {Object} message - 消息对象
 * @param {Object} sender - 发送者信息
 */
async function handleMessage(message, sender) {
  switch (message.action) {
    case 'startDownload':
      return await handleStartDownload(message.data);
    
    case 'getDownloadStatus':
      return { success: true, data: downloadQueue.getStatus() };
    
    case 'openDownloadFolder':
      return await handleOpenDownloadFolder();
    
    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * 开始下载图片
 * @param {Object} data - 下载数据
 */
async function handleStartDownload(data) {
  const { images, tabId } = data;

  if (!images || images.length === 0) {
    return { success: false, error: 'No images to download' };
  }

  // 发送开始消息
  chrome.runtime.sendMessage({
    action: 'downloadStarted',
    data: { total: images.length }
  });

  // 添加到下载队列
  images.forEach((url, index) => {
    const extension = getExtension(url);
    const filename = `image_${Date.now()}_${String(index + 1).padStart(3, '0')}.${extension}`;
    
    downloadQueue.add({
      url: cleanUrl(url),
      filename,
      tabId
    });
  });

  return { success: true, data: { queued: images.length } };
}

/**
 * 打开下载文件夹
 */
async function handleOpenDownloadFolder() {
  // 打开 Chrome 下载页面
  await chrome.tabs.create({ url: 'chrome://downloads/' });
  return { success: true };
}

/**
 * 获取图片扩展名
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
 * 清理 URL
 */
function cleanUrl(url) {
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
}

// 初始化
init();