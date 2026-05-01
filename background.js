// filepath: background.js

/**
 * Background Script - 下载模块（优化版）
 * 支持下载队列、暂停/继续、取消、重试机制
 */

'use strict';

// ==================== 配置常量 ====================

const DEFAULT_CONFIG = {
  maxConcurrentDownloads: 3,
  maxRetryCount: 3,
  retryDelayMs: 1000,
  downloadTimeoutMs: 30000,
  defaultDirectory: 'Downloaded_Images',
  fileNamePattern: 'image_{date}_{time}_{index}',
  conflictAction: 'uniquify'
};

// ==================== 任务状态枚举 ====================

const DownloadStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// ==================== 错误类型枚举 ====================

const ErrorType = {
  NETWORK_ERROR: 'network_error',
  CORS_ERROR: 'cors_error',
  TIMEOUT_ERROR: 'timeout_error',
  FILE_SYSTEM_ERROR: 'file_system_error',
  UNKNOWN_ERROR: 'unknown_error',
  DOWNLOAD_BLOCKED: 'download_blocked',
  INVALID_URL: 'invalid_url'
};

// ==================== 下载任务类 ====================

class DownloadTask {
  constructor(options = {}) {
    this.id = options.id || this._generateId();
    this.url = options.url;
    this.filename = options.filename;
    this.tabId = options.tabId;
    this.directory = options.directory || DEFAULT_CONFIG.defaultDirectory;
    
    this.status = DownloadStatus.PENDING;
    this.downloadId = null;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || DEFAULT_CONFIG.maxRetryCount;
    this.error = null;
    this.errorType = null;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.progress = 0;
    this.bytesReceived = 0;
    this.totalBytes = 0;
    this.metadata = options.metadata || {};
  }

  _generateId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  toJSON() {
    return {
      id: this.id,
      url: this.url,
      filename: this.filename,
      status: this.status,
      downloadId: this.downloadId,
      retryCount: this.retryCount,
      error: this.error,
      errorType: this.errorType,
      progress: this.progress,
      bytesReceived: this.bytesReceived,
      totalBytes: this.totalBytes,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      metadata: this.metadata
    };
  }
}

// ==================== 下载管理器类 ====================

class DownloadManager {
  constructor() {
    this.tasks = new Map();
    this.taskIdToDownloadId = new Map();
    this.downloadIdToTaskId = new Map();
    
    this.isPaused = false;
    this.activeDownloads = 0;
    this.maxConcurrent = DEFAULT_CONFIG.maxConcurrentDownloads;
    
    this.config = { ...DEFAULT_CONFIG };
    
    this._initListeners();
  }

  _initListeners() {
    chrome.downloads.onChanged.addListener((delta) => {
      this._handleDownloadChange(delta);
    });

    chrome.downloads.onCreated.addListener((downloadItem) => {
      this._handleDownloadCreated(downloadItem);
    });

    chrome.downloads.onErased.addListener((downloadId) => {
      this._handleDownloadErased(downloadId);
    });
  }

  _handleDownloadCreated(downloadItem) {
    const taskId = this.downloadIdToTaskId.get(downloadItem.id);
    if (!taskId) return;
    
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    if (downloadItem.totalBytes > 0) {
      task.totalBytes = downloadItem.totalBytes;
    }
    
    this._notifyTaskUpdate(task);
  }

  _handleDownloadChange(delta) {
    const downloadId = delta.id;
    const taskId = this.downloadIdToTaskId.get(downloadId);
    
    if (!taskId) return;
    
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (delta.state) {
      const state = delta.state.current;
      
      if (state === 'in_progress') {
        task.status = DownloadStatus.DOWNLOADING;
        if (!task.startedAt) {
          task.startedAt = Date.now();
        }
      } else if (state === 'complete') {
        task.status = DownloadStatus.COMPLETED;
        task.completedAt = Date.now();
        task.progress = 100;
        this.activeDownloads--;
        this._notifyTaskComplete(task);
        this._processNext();
      }
    }

    if (delta.error) {
      const error = delta.error.current;
      task.status = DownloadStatus.FAILED;
      task.error = this._getErrorMessage(error);
      task.errorType = this._getErrorType(error);
      this.activeDownloads--;
      
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        setTimeout(() => {
          this._retryTask(task);
        }, DEFAULT_CONFIG.retryDelayMs * task.retryCount);
      } else {
        this._notifyTaskFailed(task);
        this._processNext();
      }
    }

    if (delta.bytesReceived) {
      task.bytesReceived = delta.bytesReceived.current;
      if (task.totalBytes > 0) {
        task.progress = Math.round((task.bytesReceived / task.totalBytes) * 100);
      }
    }

    if (delta.totalBytes && delta.totalBytes.current > 0) {
      task.totalBytes = delta.totalBytes.current;
    }

    this._notifyTaskUpdate(task);
  }

  _handleDownloadErased(downloadId) {
    const taskId = this.downloadIdToTaskId.get(downloadId);
    if (taskId) {
      this.downloadIdToTaskId.delete(downloadId);
      this.taskIdToDownloadId.delete(taskId);
    }
  }

  _getErrorMessage(error) {
    const errorMessages = {
      'NETWORK_FAILED': '网络连接失败，请检查网络连接',
      'NETWORK_TIMEOUT': '下载超时，请重试',
      'NETWORK_DISCONNECTED': '网络已断开',
      'SERVER_FAILED': '服务器响应错误',
      'SERVER_BAD_CONTENT': '服务器返回无效内容',
      'USER_CANCELLED': '用户取消了下载',
      'USER_SHUTDOWN': '浏览器关闭导致下载中断',
      'FILE_FAILED': '文件系统错误',
      'FILE_ACCESS_DENIED': '无法访问下载目录',
      'FILE_NO_SPACE': '磁盘空间不足',
      'FILE_TOO_LARGE': '文件过大',
      'FILE_VIRUS_INFECTED': '文件包含病毒，已被拦截',
      'SECURITY_CHECK_FAILED': '安全检查失败',
      'DOWNLOAD_INTERRUPTED': '下载被中断'
    };
    return errorMessages[error] || `下载失败: ${error}`;
  }

  _getErrorType(error) {
    if (error.includes('NETWORK') || error.includes('SERVER')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (error.includes('FILE')) {
      return ErrorType.FILE_SYSTEM_ERROR;
    }
    if (error.includes('USER')) {
      return ErrorType.DOWNLOAD_BLOCKED;
    }
    if (error.includes('TIMEOUT')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    return ErrorType.UNKNOWN_ERROR;
  }

  async _retryTask(task) {
    if (this.isPaused) {
      task.status = DownloadStatus.PAUSED;
      this._notifyTaskUpdate(task);
      return;
    }

    try {
      const downloadId = await this._startChromeDownload(task);
      task.downloadId = downloadId;
      task.status = DownloadStatus.DOWNLOADING;
      this.taskIdToDownloadId.set(task.id, downloadId);
      this.downloadIdToTaskId.set(downloadId, task.id);
      this._notifyTaskUpdate(task);
    } catch (error) {
      task.error = error.message;
      task.errorType = ErrorType.UNKNOWN_ERROR;
      
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        setTimeout(() => {
          this._retryTask(task);
        }, DEFAULT_CONFIG.retryDelayMs * task.retryCount);
      } else {
        task.status = DownloadStatus.FAILED;
        this.activeDownloads--;
        this._notifyTaskFailed(task);
        this._processNext();
      }
    }
  }

  async _startChromeDownload(task) {
    return new Promise((resolve, reject) => {
      const filename = task.directory 
        ? `${task.directory}/${task.filename}` 
        : task.filename;

      const downloadOptions = {
        url: task.url,
        filename: filename,
        saveAs: false,
        conflictAction: this.config.conflictAction || 'uniquify'
      };

      chrome.downloads.download(downloadOptions, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      });
    });
  }

  async _processNext() {
    if (this.isPaused) return;
    if (this.activeDownloads >= this.maxConcurrent) return;

    const pendingTasks = Array.from(this.tasks.values())
      .filter(t => t.status === DownloadStatus.PENDING);

    if (pendingTasks.length === 0) {
      const activeTasks = Array.from(this.tasks.values())
        .filter(t => t.status === DownloadStatus.DOWNLOADING);
      
      if (activeTasks.length === 0) {
        this._notifyAllComplete();
      }
      return;
    }

    const task = pendingTasks[0];
    
    try {
      this.activeDownloads++;
      task.status = DownloadStatus.DOWNLOADING;
      task.startedAt = Date.now();
      
      const downloadId = await this._startChromeDownload(task);
      task.downloadId = downloadId;
      
      this.taskIdToDownloadId.set(task.id, downloadId);
      this.downloadIdToTaskId.set(downloadId, task.id);
      
      this._notifyTaskUpdate(task);
    } catch (error) {
      console.error('[DownloadManager] Failed to start download:', error);
      task.error = error.message;
      task.errorType = this._classifyError(error.message);
      
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = DownloadStatus.PENDING;
        this.activeDownloads--;
        setTimeout(() => this._processNext(), DEFAULT_CONFIG.retryDelayMs);
      } else {
        task.status = DownloadStatus.FAILED;
        this.activeDownloads--;
        this._notifyTaskFailed(task);
        setTimeout(() => this._processNext(), 100);
      }
    }
  }

  _classifyError(message) {
    if (message.includes('CORS') || message.includes('cross-origin')) {
      return ErrorType.CORS_ERROR;
    }
    if (message.includes('network') || message.includes('NETWORK')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (message.includes('block') || message.includes('intercept')) {
      return ErrorType.DOWNLOAD_BLOCKED;
    }
    return ErrorType.UNKNOWN_ERROR;
  }

  _notifyTaskUpdate(task) {
    this._broadcastMessage({
      action: 'downloadTaskUpdate',
      data: task.toJSON()
    });
  }

  _notifyTaskComplete(task) {
    this._broadcastMessage({
      action: 'downloadTaskComplete',
      data: task.toJSON()
    });
  }

  _notifyTaskFailed(task) {
    this._broadcastMessage({
      action: 'downloadTaskFailed',
      data: task.toJSON()
    });
  }

  _notifyAllComplete() {
    const stats = this.getStats();
    this._broadcastMessage({
      action: 'downloadBatchComplete',
      data: stats
    });
  }

  _broadcastMessage(message) {
    chrome.runtime.sendMessage(message).catch(() => {
    });
  }

  addTask(options) {
    const task = new DownloadTask(options);
    this.tasks.set(task.id, task);
    this._notifyTaskUpdate(task);
    
    setTimeout(() => this._processNext(), 0);
    
    return task.id;
  }

  addBatch(tasks) {
    const taskIds = [];
    for (const taskOptions of tasks) {
      const taskId = this.addTask(taskOptions);
      taskIds.push(taskId);
    }
    return taskIds;
  }

  pauseAll() {
    this.isPaused = true;
    
    const activeTasks = Array.from(this.tasks.values())
      .filter(t => t.status === DownloadStatus.DOWNLOADING);
    
    for (const task of activeTasks) {
      if (task.downloadId) {
        chrome.downloads.pause(task.downloadId).catch(() => {});
      }
      task.status = DownloadStatus.PAUSED;
      this._notifyTaskUpdate(task);
    }
    
    const pendingTasks = Array.from(this.tasks.values())
      .filter(t => t.status === DownloadStatus.PENDING);
    
    for (const task of pendingTasks) {
      task.status = DownloadStatus.PAUSED;
      this._notifyTaskUpdate(task);
    }
    
    this._broadcastMessage({
      action: 'downloadPaused',
      data: { pausedCount: activeTasks.length + pendingTasks.length }
    });
  }

  resumeAll() {
    this.isPaused = false;
    
    const pausedTasks = Array.from(this.tasks.values())
      .filter(t => t.status === DownloadStatus.PAUSED);
    
    for (const task of pausedTasks) {
      if (task.downloadId) {
        chrome.downloads.resume(task.downloadId).catch(() => {
          task.status = DownloadStatus.PENDING;
        });
      } else {
        task.status = DownloadStatus.PENDING;
      }
      this._notifyTaskUpdate(task);
    }
    
    this._broadcastMessage({
      action: 'downloadResumed',
      data: { resumedCount: pausedTasks.length }
    });
    
    setTimeout(() => this._processNext(), 0);
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.downloadId) {
      chrome.downloads.cancel(task.downloadId).catch(() => {});
    }
    
    task.status = DownloadStatus.CANCELLED;
    this.activeDownloads = Math.max(0, this.activeDownloads - 1);
    
    this._notifyTaskUpdate(task);
    setTimeout(() => this._processNext(), 0);
    
    return true;
  }

  cancelAll() {
    const allTasks = Array.from(this.tasks.values());
    let cancelledCount = 0;
    
    for (const task of allTasks) {
      if (task.status === DownloadStatus.PENDING || 
          task.status === DownloadStatus.DOWNLOADING ||
          task.status === DownloadStatus.PAUSED) {
        if (task.downloadId) {
          chrome.downloads.cancel(task.downloadId).catch(() => {});
        }
        task.status = DownloadStatus.CANCELLED;
        cancelledCount++;
      }
    }
    
    this.activeDownloads = 0;
    this.isPaused = false;
    
    this._broadcastMessage({
      action: 'downloadCancelled',
      data: { cancelledCount }
    });
    
    return cancelledCount;
  }

  retryTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status !== DownloadStatus.FAILED && 
        task.status !== DownloadStatus.CANCELLED) {
      return false;
    }
    
    task.status = DownloadStatus.PENDING;
    task.error = null;
    task.errorType = null;
    task.retryCount = 0;
    task.progress = 0;
    task.downloadId = null;
    
    this._notifyTaskUpdate(task);
    setTimeout(() => this._processNext(), 0);
    
    return true;
  }

  clearCompleted() {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => 
        task.status === DownloadStatus.COMPLETED || 
        task.status === DownloadStatus.FAILED ||
        task.status === DownloadStatus.CANCELLED
      );
    
    for (const [taskId, task] of completedTasks) {
      if (task.downloadId) {
        this.downloadIdToTaskId.delete(task.downloadId);
      }
      this.taskIdToDownloadId.delete(taskId);
      this.tasks.delete(taskId);
    }
    
    return completedTasks.length;
  }

  getTask(taskId) {
    const task = this.tasks.get(taskId);
    return task ? task.toJSON() : null;
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).map(t => t.toJSON());
  }

  getStats() {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === DownloadStatus.PENDING).length,
      downloading: tasks.filter(t => t.status === DownloadStatus.DOWNLOADING).length,
      paused: tasks.filter(t => t.status === DownloadStatus.PAUSED).length,
      completed: tasks.filter(t => t.status === DownloadStatus.COMPLETED).length,
      failed: tasks.filter(t => t.status === DownloadStatus.FAILED).length,
      cancelled: tasks.filter(t => t.status === DownloadStatus.CANCELLED).length,
      isPaused: this.isPaused,
      activeDownloads: this.activeDownloads
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.maxConcurrentDownloads) {
      this.maxConcurrent = newConfig.maxConcurrentDownloads;
    }
  }

  getConfig() {
    return { ...this.config };
  }
}

// ==================== 工具函数 ====================

function getImageExtension(url) {
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

function generateFileName(url, index, pattern, metadata = {}) {
  const extension = getImageExtension(url);
  const now = new Date();
  
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const timestamp = Date.now();
  const indexStr = String(index + 1).padStart(3, '0');
  
  let filename = metadata.originalName || '';
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    if (parts.length > 0) {
      filename = parts[parts.length - 1].split('?')[0];
      if (filename.lastIndexOf('.') > 0) {
        filename = filename.substring(0, filename.lastIndexOf('.'));
      }
    }
  } catch (e) {}
  
  let result = pattern || 'image_{date}_{time}_{index}';
  
  result = result.replace(/\{date\}/g, date);
  result = result.replace(/\{time\}/g, time);
  result = result.replace(/\{timestamp\}/g, timestamp);
  result = result.replace(/\{index\}/g, indexStr);
  result = result.replace(/\{filename\}/g, filename || 'image');
  result = result.replace(/\{title\}/g, metadata.title || 'page');
  
  return `${result}.${extension}`;
}

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

// ==================== 全局实例和消息处理 ====================

const downloadManager = new DownloadManager();

async function loadSavedConfig() {
  try {
    const saved = await chrome.storage.sync.get({
      maxConcurrentDownloads: DEFAULT_CONFIG.maxConcurrentDownloads,
      maxRetryCount: DEFAULT_CONFIG.maxRetryCount,
      downloadDirectory: DEFAULT_CONFIG.defaultDirectory,
      fileNamePattern: DEFAULT_CONFIG.fileNamePattern,
      conflictAction: DEFAULT_CONFIG.conflictAction
    });
    
    downloadManager.updateConfig({
      maxConcurrentDownloads: saved.maxConcurrentDownloads,
      maxRetryCount: saved.maxRetryCount,
      defaultDirectory: saved.downloadDirectory,
      fileNamePattern: saved.fileNamePattern,
      conflictAction: saved.conflictAction
    });
  } catch (error) {
    console.error('[Background] Failed to load config:', error);
  }
}

async function init() {
  console.log('[Background] Service worker initialized (optimized version)');
  await loadSavedConfig();
}

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'startDownload':
      return await handleStartDownload(message.data);
    
    case 'pauseDownloads':
      downloadManager.pauseAll();
      return { success: true };
    
    case 'resumeDownloads':
      downloadManager.resumeAll();
      return { success: true };
    
    case 'cancelDownloads':
      downloadManager.cancelAll();
      return { success: true };
    
    case 'cancelTask':
      const cancelled = downloadManager.cancelTask(message.taskId);
      return { success: cancelled };
    
    case 'retryTask':
      const retried = downloadManager.retryTask(message.taskId);
      return { success: retried };
    
    case 'clearCompleted':
      const cleared = downloadManager.clearCompleted();
      return { success: true, cleared };
    
    case 'getDownloadStatus':
      return { 
        success: true, 
        data: downloadManager.getStats() 
      };
    
    case 'getAllTasks':
      return { 
        success: true, 
        data: downloadManager.getAllTasks() 
      };
    
    case 'getTask':
      const task = downloadManager.getTask(message.taskId);
      return { 
        success: !!task, 
        data: task 
      };
    
    case 'updateConfig':
      downloadManager.updateConfig(message.config);
      return { success: true };
    
    case 'getConfig':
      return { 
        success: true, 
        data: downloadManager.getConfig() 
      };
    
    case 'openDownloadFolder':
      return await handleOpenDownloadFolder();
    
    default:
      return { success: false, error: 'Unknown action' };
  }
}

async function handleStartDownload(data) {
  const { images, tabId, options = {} } = data;

  if (!images || images.length === 0) {
    return { success: false, error: 'No images to download' };
  }

  const config = downloadManager.getConfig();
  const directory = options.directory || config.defaultDirectory;
  const pattern = options.fileNamePattern || config.fileNamePattern;
  const metadata = options.metadata || {};

  const tasks = images.map((img, index) => {
    const url = typeof img === 'string' ? img : (img.url || img);
    const filename = generateFileName(url, index, pattern, {
      ...metadata,
      originalName: img.filename || img.originalName
    });
    
    return {
      url: url,
      filename: filename,
      tabId: tabId,
      directory: directory,
      metadata: {
        width: img.width || 0,
        height: img.height || 0,
        sourceType: img.sourceType || 'unknown',
        extension: img.extension || getImageExtension(url),
        index: index
      }
    };
  });

  chrome.runtime.sendMessage({
    action: 'downloadBatchStarted',
    data: { total: tasks.length }
  });

  const taskIds = downloadManager.addBatch(tasks);

  return { 
    success: true, 
    data: { 
      queued: tasks.length,
      taskIds: taskIds
    } 
  };
}

async function handleOpenDownloadFolder() {
  try {
    await chrome.tabs.create({ url: 'chrome://downloads/' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => {
      sendResponse(response);
    })
    .catch(error => {
      console.error('[Background] Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    });
  return true;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    const newConfig = {};
    if (changes.maxConcurrentDownloads) {
      newConfig.maxConcurrentDownloads = changes.maxConcurrentDownloads.newValue;
    }
    if (changes.maxRetryCount) {
      newConfig.maxRetryCount = changes.maxRetryCount.newValue;
    }
    if (changes.downloadDirectory) {
      newConfig.defaultDirectory = changes.downloadDirectory.newValue;
    }
    if (changes.fileNamePattern) {
      newConfig.fileNamePattern = changes.fileNamePattern.newValue;
    }
    if (changes.conflictAction) {
      newConfig.conflictAction = changes.conflictAction.newValue;
    }
    
    if (Object.keys(newConfig).length > 0) {
      downloadManager.updateConfig(newConfig);
    }
  }
});

init();
