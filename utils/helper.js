// filepath: utils/helper.js

/**
 * 图片工具函数
 */

/**
 * 获取图片扩展名
 * @param {string} url - 图片 URL
 * @returns {string} 扩展名（不含点）
 */
function getImageExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match) {
      return match[1].toLowerCase();
    }
    // 根据 MIME 类型判断
    return 'jpg';
  } catch (error) {
    return 'jpg';
  }
}

/**
 * 获取文件名
 * @param {string} url - 图片 URL
 * @param {number} index - 序号
 * @returns {string} 文件名
 */
function getFileName(url, index) {
  const extension = getImageExtension(url);
  const timestamp = Date.now();
  return `image_${timestamp}_${String(index).padStart(3, '0')}.${extension}`;
}

/**
 * 检查是否是图片 URL
 * @param {string} url - URL
 * @returns {boolean}
 */
function isImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 检查 URL 格式
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
    return false;
  }

  // 检查扩展名
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
  const extension = getImageExtension(url);
  
  return imageExtensions.includes(extension) || url.startsWith('data:image/');
}

/**
 * 去除 URL 中的查询参数
 * @param {string} url - 原始 URL
 * @returns {string} 清理后的 URL
 */
function cleanUrl(url) {
  if (!url) return url;
  
  // 处理 data URL
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

/**
 * 去除重复的 URL
 * @param {string[]} urls - URL 数组
 * @returns {string[]} 去重后的 URL 数组
 */
function uniqueUrls(urls) {
  const seen = new Set();
  const result = [];
  
  for (const url of urls) {
    const cleanUrlStr = cleanUrl(url);
    if (!seen.has(cleanUrlStr)) {
      seen.add(cleanUrlStr);
      result.push(url);
    }
  }
  
  return result;
}

/**
 * 过滤图片 URL
 * @param {string[]} urls - URL 数组
 * @param {string[]} allowedExtensions - 允许的扩展名
 * @returns {string[]} 过滤后的 URL 数组
 */
function filterByExtensions(urls, allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
  return urls.filter(url => {
    const extension = getImageExtension(url);
    return allowedExtensions.includes(extension.toLowerCase());
  });
}

/**
 * 限制 URL 数量
 * @param {string[]} urls - URL 数组
 * @param {number} maxCount - 最大数量
 * @returns {string[]} 截取后的 URL 数组
 */
function limitUrls(urls, maxCount) {
  return urls.slice(0, maxCount);
}

// 导出函数（支持 ESM 和 CommonJS）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getImageExtension,
    getFileName,
    isImageUrl,
    cleanUrl,
    uniqueUrls,
    filterByExtensions,
    limitUrls
  };
}