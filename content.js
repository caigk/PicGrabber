// filepath: content.js

/**
 * Content Script - 图片抓取模块（优化版）
 * 注入到网页中抓取页面上的图片元素
 * 支持懒加载、长页面、无限滚动场景
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__picgrabberInjected) {
    return;
  }
  window.__picgrabberInjected = true;

  // ==================== 配置 ====================
  const CONFIG = {
    scrollDelay: 800,
    maxScrollCount: 100,
    stableThreshold: 2000,
    bottomRetryCount: 5,
    bottomRetryDelay: 300,
    mutationDebounceMs: 200,
    visibleThreshold: 0.1,
    lazyLoadAttributes: [
      'data-src', 'data-lazy-src', 'data-original',
      'data-lazy', 'data-srcset', 'data-lazy-srcset',
      'data-bg', 'data-background', 'src'
    ]
  };

  // ==================== 全局状态 ====================
  let scanState = {
    isScanning: false,
    isScrolling: false,
    shouldStopScroll: false,
    collectedImages: new Map(),
    observer: null,
    intersectionObserver: null
  };

  // ==================== 工具函数 ====================

  /**
   * 解析 URL 为绝对路径
   */
  function resolveUrl(url) {
    if (!url) return null;
    
    url = url.trim();
    
    if (url.startsWith('data:')) {
      return url;
    }
    
    if (url.startsWith('blob:')) {
      return url;
    }
    
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  /**
   * 标准化 URL（用于去重）
   */
  function normalizeUrl(url) {
    if (!url) return url;
    
    if (url.startsWith('data:')) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      urlObj.search = '';
      urlObj.hash = '';
      return urlObj.toString();
    } catch (e) {
      return url.split('?')[0].split('#')[0];
    }
  }

  /**
   * 获取图片扩展名
   */
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

  /**
   * 检查是否为有效图片格式
   */
  function isValidImageFormat(url, includeDataUrl = true) {
    const ext = getExtension(url);
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
    
    if (url.startsWith('data:')) {
      return includeDataUrl && url.startsWith('data:image/');
    }
    
    if (url.startsWith('blob:')) {
      return true;
    }
    
    return validExtensions.includes(ext);
  }

  /**
   * 解析 srcset 属性
   */
  function parseSrcset(srcset) {
    if (!srcset) return [];
    
    const urls = [];
    const entries = srcset.split(/,\s+/);
    
    for (const entry of entries) {
      const parts = entry.trim().split(/\s+/);
      if (parts.length > 0 && parts[0]) {
        urls.push(parts[0]);
      }
    }
    
    return urls;
  }

  /**
   * 解析 CSS image-set()
   */
  function parseImageSet(value) {
    if (!value || !value.includes('image-set')) return [];
    
    const urls = [];
    const regex = /url\(["']?([^"')\s]+)["']?\)/g;
    let match;
    
    while ((match = regex.exec(value)) !== null) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
    
    return urls;
  }

  // ==================== 图片提取函数 ====================

  /**
   * 从 img 标签提取图片
   */
  function extractFromImgTag(img) {
    const images = [];
    
    const primarySources = [
      img.src,
      img.dataset.src,
      img.dataset.lazySrc,
      img.dataset.original,
      img.dataset.lazy,
      img.getAttribute('data-src'),
      img.getAttribute('data-lazy-src'),
      img.getAttribute('data-original')
    ];
    
    for (const src of primarySources) {
      if (src && src !== 'about:blank' && !src.startsWith('javascript:')) {
        const resolved = resolveUrl(src);
        if (resolved) {
          images.push({
            url: resolved,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            element: img,
            sourceType: 'img'
          });
        }
      }
    }
    
    const srcsetValues = [
      img.srcset,
      img.dataset.srcset,
      img.dataset.lazySrcset
    ];
    
    for (const srcset of srcsetValues) {
      if (srcset) {
        const urls = parseSrcset(srcset);
        for (const url of urls) {
          const resolved = resolveUrl(url);
          if (resolved) {
            images.push({
              url: resolved,
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
              element: img,
              sourceType: 'srcset'
            });
          }
        }
      }
    }
    
    return images;
  }

  /**
   * 从 picture 标签提取图片
   */
  function extractFromPictureTag(picture) {
    const images = [];
    const sources = picture.querySelectorAll('source');
    
    for (const source of sources) {
      const srcsetValues = [
        source.srcset,
        source.dataset.srcset,
        source.dataset.lazySrcset
      ];
      
      for (const srcset of srcsetValues) {
        if (srcset) {
          const urls = parseSrcset(srcset);
          for (const url of urls) {
            const resolved = resolveUrl(url);
            if (resolved) {
              images.push({
                url: resolved,
                width: 0,
                height: 0,
                element: source,
                sourceType: 'picture-source'
              });
            }
          }
        }
      }
    }
    
    return images;
  }

  /**
   * 从背景图提取图片
   */
  function extractFromBackground(el) {
    const images = [];
    
    try {
      const style = window.getComputedStyle ? window.getComputedStyle(el) : el.style;
      const bgImage = style.backgroundImage;
      
      if (!bgImage || bgImage === 'none' || bgImage === 'initial' || bgImage === 'unset') {
        return images;
      }
      
      if (bgImage.includes('image-set') || bgImage.includes('-webkit-image-set')) {
        const imageSetUrls = parseImageSet(bgImage);
        for (const url of imageSetUrls) {
          const resolved = resolveUrl(url);
          if (resolved) {
            images.push({
              url: resolved,
              width: el.offsetWidth || 0,
              height: el.offsetHeight || 0,
              element: el,
              sourceType: 'background-image-set'
            });
          }
        }
      }
      
      const urlRegex = /url\(["']?([^"')]+)["']?\)/g;
      let match;
      
      while ((match = urlRegex.exec(bgImage)) !== null) {
        const url = match[1];
        if (url && !url.includes('image-set') && !url.includes('linear-gradient')) {
          const resolved = resolveUrl(url);
          if (resolved) {
            images.push({
              url: resolved,
              width: el.offsetWidth || 0,
              height: el.offsetHeight || 0,
              element: el,
              sourceType: 'background'
            });
          }
        }
      }
    } catch (e) {
      console.error('[PicGrabber] Error extracting background image:', e);
    }
    
    return images;
  }

  /**
   * 从 data 属性提取图片
   */
  function extractFromDataAttributes(el) {
    const images = [];
    const dataAttrs = [
      'data-bg', 'data-background', 'data-bg-image',
      'data-lazy-bg', 'data-lazy-background'
    ];
    
    for (const attr of dataAttrs) {
      const value = el.getAttribute(attr);
      if (value) {
        if (value.includes('url(')) {
          const match = value.match(/url\(["']?([^"')]+)["']?\)/);
          if (match && match[1]) {
            const resolved = resolveUrl(match[1]);
            if (resolved) {
              images.push({
                url: resolved,
                width: el.offsetWidth || 0,
                height: el.offsetHeight || 0,
                element: el,
                sourceType: 'data-attr'
              });
            }
          }
        } else {
          const resolved = resolveUrl(value);
          if (resolved) {
            images.push({
              url: resolved,
              width: el.offsetWidth || 0,
              height: el.offsetHeight || 0,
              element: el,
              sourceType: 'data-attr'
            });
          }
        }
      }
    }
    
    return images;
  }

  /**
   * 从链接中提取图片
   */
  function extractFromLinks() {
    const images = [];
    const links = document.querySelectorAll('a[href]');
    
    for (const link of links) {
      const href = link.href;
      if (href && isValidImageFormat(href, false)) {
        const resolved = resolveUrl(href);
        if (resolved) {
          images.push({
            url: resolved,
            width: 0,
            height: 0,
            element: link,
            sourceType: 'link'
          });
        }
      }
    }
    
    return images;
  }

  /**
   * 从 meta 标签提取图片（Open Graph, Twitter Cards）
   */
  function extractFromMetaTags() {
    const images = [];
    const metaSelectors = [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[property="og:image:secure_url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'meta[itemprop="image"]'
    ];
    
    for (const selector of metaSelectors) {
      const metas = document.querySelectorAll(selector);
      for (const meta of metas) {
        const content = meta.content || meta.getAttribute('content');
        if (content) {
          const resolved = resolveUrl(content);
          if (resolved) {
            images.push({
              url: resolved,
              width: 0,
              height: 0,
              element: meta,
              sourceType: 'meta'
            });
          }
        }
      }
    }
    
    return images;
  }

  // ==================== 核心扫描函数 ====================

  /**
   * 扫描页面上的所有图片
   */
  function scanImages(options = {}) {
    const {
      includeDataUrl = true,
      includeLinks = false,
      includeMeta = true
    } = options;
    
    const images = [];
    const seen = new Set();
    
    document.querySelectorAll('img').forEach(img => {
      const extracted = extractFromImgTag(img);
      for (const imgData of extracted) {
        const normalized = normalizeUrl(imgData.url);
        if (!seen.has(normalized) && isValidImageFormat(imgData.url, includeDataUrl)) {
          seen.add(normalized);
          images.push(imgData);
        }
      }
    });
    
    document.querySelectorAll('picture').forEach(picture => {
      const extracted = extractFromPictureTag(picture);
      for (const imgData of extracted) {
        const normalized = normalizeUrl(imgData.url);
        if (!seen.has(normalized) && isValidImageFormat(imgData.url, includeDataUrl)) {
          seen.add(normalized);
          images.push(imgData);
        }
      }
    });
    
    document.querySelectorAll('*').forEach(el => {
      const extracted = extractFromBackground(el);
      for (const imgData of extracted) {
        const normalized = normalizeUrl(imgData.url);
        if (!seen.has(normalized) && isValidImageFormat(imgData.url, includeDataUrl)) {
          seen.add(normalized);
          images.push(imgData);
        }
      }
    });
    
    document.querySelectorAll('[data-bg], [data-background], [data-bg-image]').forEach(el => {
      const extracted = extractFromDataAttributes(el);
      for (const imgData of extracted) {
        const normalized = normalizeUrl(imgData.url);
        if (!seen.has(normalized) && isValidImageFormat(imgData.url, includeDataUrl)) {
          seen.add(normalized);
          images.push(imgData);
        }
      }
    });
    
    if (includeMeta) {
      const metaImages = extractFromMetaTags();
      for (const imgData of metaImages) {
        const normalized = normalizeUrl(imgData.url);
        if (!seen.has(normalized) && isValidImageFormat(imgData.url, includeDataUrl)) {
          seen.add(normalized);
          images.push(imgData);
        }
      }
    }
    
    if (includeLinks) {
      const linkImages = extractFromLinks();
      for (const imgData of linkImages) {
        const normalized = normalizeUrl(imgData.url);
        if (!seen.has(normalized) && isValidImageFormat(imgData.url, includeDataUrl)) {
          seen.add(normalized);
          images.push(imgData);
        }
      }
    }
    
    return images;
  }

  // ==================== MutationObserver 监听动态内容 ====================

  /**
   * 创建 MutationObserver 监听新图片
   */
  function createImageObserver(callback) {
    let debounceTimer = null;
    let pendingImages = [];
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'IMG') {
                const extracted = extractFromImgTag(node);
                pendingImages.push(...extracted);
              }
              
              if (node.querySelectorAll) {
                node.querySelectorAll('img').forEach(img => {
                  const extracted = extractFromImgTag(img);
                  pendingImages.push(...extracted);
                });
                
                node.querySelectorAll('picture').forEach(picture => {
                  const extracted = extractFromPictureTag(picture);
                  pendingImages.push(...extracted);
                });
              }
            }
          }
        }
        
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.tagName === 'IMG') {
            const extracted = extractFromImgTag(target);
            pendingImages.push(...extracted);
          }
          
          const style = window.getComputedStyle ? window.getComputedStyle(target) : target.style;
          if (style && style.backgroundImage && style.backgroundImage !== 'none') {
            const extracted = extractFromBackground(target);
            pendingImages.push(...extracted);
          }
        }
      }
      
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(() => {
        if (pendingImages.length > 0) {
          const uniqueImages = [];
          const seen = new Set();
          
          for (const img of pendingImages) {
            const normalized = normalizeUrl(img.url);
            if (!seen.has(normalized)) {
              seen.add(normalized);
              uniqueImages.push(img);
            }
          }
          
          callback(uniqueImages);
          pendingImages = [];
        }
      }, CONFIG.mutationDebounceMs);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-lazy-src', 'data-original', 'srcset', 'style', 'data-bg', 'data-background']
    });
    
    return observer;
  }

  // ==================== IntersectionObserver 检测可见图片 ====================

  /**
   * 创建 IntersectionObserver 检测可见图片
   */
  function createVisibilityObserver(callback) {
    const observer = new IntersectionObserver((entries) => {
      const newlyVisible = [];
      
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const target = entry.target;
          
          if (target.tagName === 'IMG') {
            const extracted = extractFromImgTag(target);
            newlyVisible.push(...extracted);
          }
          
          const style = window.getComputedStyle ? window.getComputedStyle(target) : target.style;
          if (style && style.backgroundImage && style.backgroundImage !== 'none') {
            const extracted = extractFromBackground(target);
            newlyVisible.push(...extracted);
          }
        }
      }
      
      if (newlyVisible.length > 0) {
        callback(newlyVisible);
      }
    }, {
      root: null,
      rootMargin: '200px',
      threshold: CONFIG.visibleThreshold
    });
    
    document.querySelectorAll('img, [style*="background"]').forEach(el => {
      observer.observe(el);
    });
    
    return observer;
  }

  // ==================== 自动滚动函数 ====================

  /**
   * 自动滚动页面以触发懒加载
   */
  async function autoScroll(options = {}) {
    const {
      scrollDelay = CONFIG.scrollDelay,
      maxScrollCount = CONFIG.maxScrollCount,
      stableThreshold = CONFIG.stableThreshold,
      bottomRetryCount = CONFIG.bottomRetryCount,
      bottomRetryDelay = CONFIG.bottomRetryDelay,
      onProgress = null
    } = options;
    
    scanState.isScrolling = true;
    scanState.shouldStopScroll = false;
    scanState.collectedImages = new Map();
    
    const initialImages = scanImages();
    for (const img of initialImages) {
      const normalized = normalizeUrl(img.url);
      scanState.collectedImages.set(normalized, img);
    }
    
    const observer = createImageObserver((newImages) => {
      for (const img of newImages) {
        const normalized = normalizeUrl(img.url);
        if (!scanState.collectedImages.has(normalized)) {
          scanState.collectedImages.set(normalized, img);
        }
      }
    });
    
    let lastScrollTop = 0;
    let lastPageHeight = document.documentElement.scrollHeight;
    let scrollCount = 0;
    let bottomCount = 0;
    let stableCount = 0;
    
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    async function scrollLoop() {
      while (!scanState.shouldStopScroll && scrollCount < maxScrollCount) {
        scrollCount++;
        
        const currentPageHeight = document.documentElement.scrollHeight;
        const maxScrollTop = currentPageHeight - window.innerHeight;
        
        const nextScrollTop = Math.min(
          lastScrollTop + window.innerHeight * 0.8,
          maxScrollTop
        );
        
        window.scrollTo({
          top: nextScrollTop,
          behavior: 'smooth'
        });
        
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        lastScrollTop = window.scrollY || document.documentElement.scrollTop;
        const newPageHeight = document.documentElement.scrollHeight;
        
        const scanResult = scanImages();
        let newFound = 0;
        
        for (const img of scanResult) {
          const normalized = normalizeUrl(img.url);
          if (!scanState.collectedImages.has(normalized)) {
            scanState.collectedImages.set(normalized, img);
            newFound++;
          }
        }
        
        if (onProgress) {
          onProgress({
            scrollCount,
            currentImageCount: scanState.collectedImages.size,
            isComplete: false
          });
        }
        
        if (lastScrollTop >= maxScrollTop - 50) {
          bottomCount++;
          
          if (newPageHeight > lastPageHeight) {
            bottomCount = 0;
            stableCount = 0;
          } else {
            stableCount++;
          }
          
          if (bottomCount >= bottomRetryCount || stableCount >= 3) {
            break;
          }
        } else {
          bottomCount = 0;
        }
        
        lastPageHeight = newPageHeight;
      }
    }
    
    await scrollLoop();
    
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise(resolve => setTimeout(resolve, 200));
    
    observer.disconnect();
    scanState.isScrolling = false;
    
    const allImages = Array.from(scanState.collectedImages.values());
    
    return {
      success: true,
      scrollCount,
      totalImages: allImages,
      newImages: allImages.map(img => img.url)
    };
  }

  // ==================== 页面类型检测 ====================

  /**
   * 检测页面类型
   */
  function detectPageType() {
    const indicators = {
      infiniteScrollSelectors: [
        '.infinite-scroll', '.infinite-scroller', '.infinite-list',
        '[data-infinite-scroll]', '.virtual-scroll', '[data-virtualized]'
      ],
      lazyLoadSelectors: [
        '[data-src]', '[data-lazy-src]', '[data-original]',
        '.lazy', '.lazyload', '.lazy-load', '[loading="lazy"]'
      ],
      loadMoreSelectors: [
        '.load-more', '.loadMore', '.btn-load-more',
        '[class*="load-more"]', '[id*="load-more"]'
      ],
      loaderSelectors: [
        '.loading-spinner', '.infinite-loader', '.spinner',
        '[class*="spinner"]', '[class*="loader"]'
      ]
    };
    
    const result = {
      infiniteScroll: false,
      lazyLoad: false,
      hasLoadMore: false,
      hasInfiniteLoader: false,
      usesIntersectionObserver: typeof IntersectionObserver !== 'undefined',
      estimatedImageCount: 0
    };
    
    for (const selector of indicators.infiniteScrollSelectors) {
      if (document.querySelector(selector)) {
        result.infiniteScroll = true;
        break;
      }
    }
    
    for (const selector of indicators.lazyLoadSelectors) {
      if (document.querySelector(selector)) {
        result.lazyLoad = true;
        break;
      }
    }
    
    for (const selector of indicators.loadMoreSelectors) {
      if (document.querySelector(selector)) {
        result.hasLoadMore = true;
        break;
      }
    }
    
    for (const selector of indicators.loaderSelectors) {
      if (document.querySelector(selector)) {
        result.hasInfiniteLoader = true;
        break;
      }
    }
    
    const imgCount = document.querySelectorAll('img').length;
    result.estimatedImageCount = imgCount;
    
    return result;
  }

  // ==================== 消息处理 ====================

  /**
   * 发送消息给 background script
   */
  function sendMessage(action, data) {
    chrome.runtime.sendMessage({ action, data }).catch(error => {
      console.error(`[PicGrabber] Failed to send message ${action}:`, error);
    });
  }

  /**
   * 格式化图片数据用于返回
   */
  function formatImageResult(images) {
    return images.map(img => ({
      url: img.url,
      width: img.width || 0,
      height: img.height || 0,
      sourceType: img.sourceType || 'unknown',
      extension: getExtension(img.url)
    }));
  }

  // ==================== 初始化 ====================

  console.log('[PicGrabber] Content script loaded (optimized version)');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'scanImages': {
        try {
          const options = message.options || {};
          const images = scanImages(options);
          sendResponse({ 
            success: true, 
            totalImages: formatImageResult(images),
            count: images.length
          });
        } catch (error) {
          console.error('[PicGrabber] Scan error:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
      }

      case 'autoScroll': {
        try {
          const options = message.options || {};
          
          autoScroll({
            ...options,
            onProgress: (progress) => {
              sendMessage('scrollProgress', progress);
            }
          })
            .then(result => {
              sendMessage('scrollComplete', {
                ...result,
                totalImages: formatImageResult(result.totalImages)
              });
              sendResponse({ 
                success: true, 
                scrollCount: result.scrollCount,
                totalImages: formatImageResult(result.totalImages),
                newImages: result.newImages
              });
            })
            .catch(error => {
              console.error('[PicGrabber] Auto scroll error:', error);
              sendResponse({ success: false, error: error.message });
            });
        } catch (error) {
          console.error('[PicGrabber] Auto scroll error:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }

      case 'stopScroll': {
        scanState.shouldStopScroll = true;
        sendResponse({ success: true, message: 'Scroll stopped' });
        break;
      }

      case 'getPageInfo': {
        try {
          const allImgs = scanImages();
          const pageType = detectPageType();
          sendResponse({
            success: true,
            data: {
              url: window.location.href,
              title: document.title,
              imageCount: allImgs.length,
              totalImages: formatImageResult(allImgs),
              pageType
            }
          });
        } catch (error) {
          console.error('[PicGrabber] Get page info error:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
        break;
      }
      
      case 'ping': {
        sendResponse({ success: true, message: 'pong' });
        break;
      }
    }
    return true;
  });

  if (typeof window !== 'undefined') {
    window.__picgrabber = {
      scanImages,
      extractFromImgTag,
      extractFromPictureTag,
      extractFromBackground,
      autoScroll,
      detectPageType,
      resolveUrl,
      normalizeUrl,
      getExtension,
      isValidImageFormat,
      parseSrcset,
      sendMessage,
      formatImageResult
    };
  }
})();
