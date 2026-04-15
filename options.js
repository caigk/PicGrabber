// filepath: options.js

/**
 * Options Script - 设置页面
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 获取 DOM 元素
  const downloadPath = document.getElementById('downloadPath');
  const fileNamePattern = document.getElementById('fileNamePattern');
  const maxConcurrent = document.getElementById('maxConcurrent');
  const minWidth = document.getElementById('minWidth');
  const minHeight = document.getElementById('minHeight');
  const showNotifications = document.getElementById('showNotifications');
  const autoRename = document.getElementById('autoRename');
  const includeDataUrl = document.getElementById('includeDataUrl');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');

  // 默认设置
  const defaultSettings = {
    downloadPath: 'Downloaded_Images',
    fileNamePattern: 'image_{date}_{time}_{index}',
    maxConcurrent: 3,
    formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    minWidth: 0,
    minHeight: 0,
    showNotifications: true,
    autoRename: true,
    includeDataUrl: false
  };

  // 初始化
  init();

  function init() {
    loadSettings();
    setupEventListeners();
  }

  /**
   * 加载设置
   */
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(defaultSettings);
      
      // 填充表单
      downloadPath.value = settings.downloadPath;
      fileNamePattern.value = settings.fileNamePattern;
      maxConcurrent.value = settings.maxConcurrent;
      minWidth.value = settings.minWidth;
      minHeight.value = settings.minHeight;
      showNotifications.checked = settings.showNotifications;
      autoRename.checked = settings.autoRename;
      includeDataUrl.checked = settings.includeDataUrl;

      // 填充复选框
      document.querySelectorAll('input[name="formats"]').forEach(checkbox => {
        checkbox.checked = settings.formats.includes(checkbox.value);
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * 保存设置
   */
  async function saveSettings() {
    try {
      // 获取复选框值
      const formats = [];
      document.querySelectorAll('input[name="formats"]:checked').forEach(checkbox => {
        formats.push(checkbox.value);
      });

      const settings = {
        downloadPath: downloadPath.value.trim() || defaultSettings.downloadPath,
        fileNamePattern: fileNamePattern.value.trim() || defaultSettings.fileNamePattern,
        maxConcurrent: parseInt(maxConcurrent.value, 10) || defaultSettings.maxConcurrent,
        formats: formats,
        minWidth: parseInt(minWidth.value, 10) || 0,
        minHeight: parseInt(minHeight.value, 10) || 0,
        showNotifications: showNotifications.checked,
        autoRename: autoRename.checked,
        includeDataUrl: includeDataUrl.checked
      };

      await chrome.storage.sync.set(settings);
      
      // 显示保存成功提示
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('保存设置失败：' + error.message);
    }
  }

  /**
   * 重置设置
   */
  async function resetSettings() {
    if (confirm('确定要恢复默认设置吗？')) {
      // 重置表单
      downloadPath.value = defaultSettings.downloadPath;
      fileNamePattern.value = defaultSettings.fileNamePattern;
      maxConcurrent.value = defaultSettings.maxConcurrent;
      minWidth.value = defaultSettings.minWidth;
      minHeight.value = defaultSettings.minHeight;
      showNotifications.checked = defaultSettings.showNotifications;
      autoRename.checked = defaultSettings.autoRename;
      includeDataUrl.checked = defaultSettings.includeDataUrl;

      // 重置复选框
      document.querySelectorAll('input[name="formats"]').forEach(checkbox => {
        checkbox.checked = defaultSettings.formats.includes(checkbox.value);
      });

      // 保存默认设置
      await chrome.storage.sync.set(defaultSettings);
      
      showSaveSuccess();
    }
  }

  /**
   * 显示保存成功提示
   */
  function showSaveSuccess() {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✅ 已保存';
    saveBtn.disabled = true;

    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 2000);
  }

  /**
   * 设置事件监听
   */
  function setupEventListeners() {
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);

    // 自动保存（可选）
    // const inputs = [downloadPath, fileNamePattern, maxConcurrent, minWidth, minHeight];
    // inputs.forEach(input => {
    //   input.addEventListener('change', saveSettings);
    // });
  }
});