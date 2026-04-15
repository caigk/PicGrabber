// filepath: content.js

/**
 * Content Script - 图片抓取模块
 * 注入到网页中抓取页面上的图片元素
 * 支持下拉刷新和懒加载页面
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__picgrabberInjected) {
    return;
  }
  window.__picgrabberInjected = true;

  // 配置
  const CONFIG = {
    scrollDelay: 1500,         // 滚动后等待时间（毫秒）
    maxScrollCount: 50,       // 最大滚动次数
    stableThreshold: 3000,    // 页面稳定等待时间（毫秒）
    bottomRetryCount: 3,      // 到底检测重试次数
    bottomRetryDelay: 500      // 到底检测重试间隔（毫秒）
  };

  /**
   * 扫描页面上的所有图片
   * @returns {Array} 图片对象数组 [{url, width, height}]
   */
  function scanImages() {
    const images = [];
    const seen = new Set();

    // 1. 获取所有 <img> 标签（包括懒加载）
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original;
      if (src && !seen.has(src)) {
        seen.add(src);
        images.push({
          url: src,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        });
      }
    });

    // 2. 获取背景图片（无法获取实际尺寸）
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle ? window.getComputedStyle(el) : el.style;
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none' && bgImage !== 'initial' && bgImage !== 'unset') {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1]) {
          const url = match[1];
          if (!seen.has(url)) {
            seen.add(url);
            images.push({
              url: url,
              width: 0,  // 背景图片无法获取尺寸
              height: 0
            });
          }
        }
      }
    });

    // 3. 获取 picture 标签中的 source
    document.querySelectorAll('picture source').forEach(source => {
      const srcset = source.srcset || source.dataset.srcset;
      if (srcset) {
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach(url => {
          if (url && !seen.has(url)) {
            seen.add(url);
            images.push({
              url: url,
              width: 0,
              height: 0
            });
          }
        });
      }
    });

    // 4. 获取 data-src、data-original 等懒加载属性
    document.querySelectorAll('[data-src], [data-original], [data-lazy-src]').forEach(el => {
      const src = el.dataset.src || el.dataset.original || el.dataset.lazySrc;
      if (src && !seen.has(src)) {
        seen.add(src);
        const img = el.tagName === 'IMG' ? el : null;
        images.push({
          url: src,
          width: img ? (img.naturalWidth || img.width || 0) : 0,
          height: img ? (img.naturalHeight || img.height || 0) : 0
        });
      }
    });

    // 5. 获取 srcset 属性中的图片
    document.querySelectorAll('img[srcset]').forEach(img => {
      const srcset = img.srcset;
      if (srcset) {
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach(url => {
          if (url && !seen.has(url)) {
            seen.add(url);
            images.push({
              url: url,
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            });
          }
        });
      }
    });

    return images;
  }

  /**
   * 监听动态加载的图片
   * @param {Function} callback - 回调函数
   */
  function observeNewImages(callback) {
    const observer = new MutationObserver((mutations) => {
      const newImages = [];

      mutations.forEach(mutation => {
        // 处理新增节点
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
            const src = node.src || node.dataset.src || node.dataset.lazySrc || node.dataset.original;
            if (src && !newImages.some(img => img.url === src)) {
              newImages.push({
                url: src,
                width: node.naturalWidth || node.width || 0,
                height: node.naturalHeight || node.height || 0
              });
            }
          }

          // 检查子节点中的 img
          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original;
              if (src && !newImages.some(img => img.url === src)) {
                newImages.push({
                  url: src,
                  width: img.naturalWidth || img.width || 0,
                  height: img.naturalHeight || img.height || 0
                });
              }
            });
          }
        });

        // 处理属性变化（懒加载图片）
        if (mutation.type === 'attributes') {
          const attributeName = mutation.attributeName;
          if (['src', 'data-src', 'data-original', 'data-lazy-src', 'srcset'].includes(attributeName)) {
            const img = mutation.target;
            if (img.tagName === 'IMG') {
              if (attributeName === 'srcset') {
                // 解析 srcset
                const srcset = img.srcset || img.dataset.srcset;
                if (srcset) {
                  const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
                  urls.forEach(url => {
                    if (url && !newImages.some(img => img.url === url)) {
                      newImages.push({
                        url: url,
                        width: img.naturalWidth || img.width || 0,
                        height: img.naturalHeight || img.height || 0
                      });
                    }
                  });
                }
              } else {
                const src = img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original;
                if (src && !newImages.some(img => img.url === src)) {
                  newImages.push({
                    url: src,
                    width: img.naturalWidth || img.width || 0,
                    height: img.naturalHeight || img.height || 0
                  });
                }
              }
            }
          }
        }
      });

      if (newImages.length > 0) {
        console.log('[PicGrabber] Observer detected new images:', newImages.length);
        newImages.forEach(img => {
          console.log('[PicGrabber] Observer found:', img.url);
        });
        callback(newImages);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-original', 'data-lazy-src', 'srcset']
    });

    return observer;
  }

  /**
   * 自动滚动页面以触发懒加载
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 滚动结果
   */
  async function autoScroll(options = {}) {
    const {
      scrollDelay = CONFIG.scrollDelay,
      maxScrollCount = CONFIG.maxScrollCount,
      stableThreshold = CONFIG.stableThreshold,
      bottomRetryCount = CONFIG.bottomRetryCount,
      bottomRetryDelay = CONFIG.bottomRetryDelay
    } = options;

    return new Promise((resolve, reject) => {
      const allImages = [];
      let lastScrollTop = 0;
      let lastPageHeight = 0;
      let scrollCount = 0;

      // 扫描当前可见区域的图片
      function scanVisibleImages() {
        const images = scanImages();
        let newCount = 0;

        console.log('[PicGrabber] Scanning, found', images.length, 'images in DOM');

        images.forEach(img => {
          if (!allImages.some(existing => existing.url === img.url)) {
            allImages.push(img);
            newCount++;
            console.log('[PicGrabber] New image found:', img.url);
          }
        });

        console.log('[PicGrabber] Total images collected:', allImages.length, 'New this scan:', newCount);

        // 发送进度消息
        chrome.runtime.sendMessage({
          action: 'scrollProgress',
          data: {
            scrollCount,
            currentImageCount: allImages.length,
            isComplete: false
          }
        }).catch(() => {});

        return newCount;
      }

      // 启动观察器监听新图片（懒加载）
      const observer = observeNewImages((newImages) => {
        newImages.forEach(img => {
          if (!allImages.some(existing => existing.url === img.url)) {
            allImages.push(img);
          }
        });
      });

      // 执行滚动扫描
      function startScrolling() {
        // 先滚动到顶部开始
        window.scrollTo({ top: 0, behavior: 'instant' });

        setTimeout(() => {
          lastPageHeight = document.documentElement.scrollHeight;
          lastScrollTop = 0;

          // 扫描初始位置
          scanVisibleImages();

          // 开始滚动循环
          scrollLoop();
        }, 500);
      }

      function scrollLoop() {
        scrollCount++;

        // 获取当前页面状态
        const currentPageHeight = document.documentElement.scrollHeight;
        const maxScrollTop = currentPageHeight - window.innerHeight;

        console.log('[PicGrabber] Scroll', scrollCount, '| lastScrollTop:', lastScrollTop, '| maxScrollTop:', maxScrollTop, '| pageHeight:', currentPageHeight);

        // 检查是否已经滚到底部
        if (lastScrollTop >= maxScrollTop - 10) {
          console.log('[PicGrabber] Reached bottom, finishing');
          // 已经到底了，停止
          finishScrolling();
          return;
        }

        // 检查是否达到最大滚动次数
        if (scrollCount >= maxScrollCount) {
          console.log('[PicGrabber] Max scroll count reached');
          finishScrolling();
          return;
        }

        // 计算下一个滚动位置（增量滚动）
        const nextScrollTop = Math.min(lastScrollTop + window.innerHeight, maxScrollTop);

        console.log('[PicGrabber] Scrolling to:', nextScrollTop);

        // 滚动到新位置
        window.scrollTo({
          top: nextScrollTop,
          behavior: 'smooth'
        });

        // 等待滚动动画完成
        setTimeout(() => {
          // 更新滚动位置
          lastScrollTop = window.scrollY || document.documentElement.scrollTop;

          // 检查页面高度是否变化（新内容加载）
          const newPageHeight = document.documentElement.scrollHeight;
          if (newPageHeight > currentPageHeight) {
            console.log('[PicGrabber] Page height changed:', currentPageHeight, '->', newPageHeight);
            // 页面高度增加了，更新最大滚动位置
            const newMaxScrollTop = newPageHeight - window.innerHeight;
            lastScrollTop = Math.min(lastScrollTop, newMaxScrollTop);
          }

          // 扫描当前位置的图片
          scanVisibleImages();

          // 继续滚动
          scrollLoop();
        }, scrollDelay);
      }

      function finishScrolling() {
        // 回到顶部
        window.scrollTo({ top: 0, behavior: 'instant' });

        setTimeout(() => {
          observer.disconnect();

          resolve({
            success: true,
            scrollCount,
            totalImages: allImages,
            newImages: allImages.map(img => img.url)
          });
        }, 500);
      }

      startScrolling();
    });
  }

  /**
   * 检测页面类型
   * @returns {Object} 页面信息
   */
  function detectPageType() {
    return {
      infiniteScroll: !!document.querySelector('.infinite-scroll, .infinite-scroller'),
      lazyLoad: !!(document.querySelector('[data-src], [data-lazy-src]') || window.IntersectionObserver),
      hasLoadMore: !!document.querySelector('.load-more, .loadMore, .btn-load-more'),
      hasInfiniteLoader: !!document.querySelector('.loading-spinner, .infinite-loader')
    };
  }

  /**
   * 发送消息给 background script
   * @param {string} action - 操作类型
   * @param {Object} data - 数据
   */
  function sendMessage(action, data) {
    chrome.runtime.sendMessage({ action, data }).catch(error => {
      console.error(`[PicGrabber] Failed to send message ${action}:`, error);
    });
  }

  // 初始化
  console.log('[PicGrabber] Content script loaded');

  // 监听来自 popup/background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'scanImages': {
        try {
          const images = scanImages();
          sendResponse({ success: true, totalImages: images });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }

      case 'autoScroll': {
        try {
          autoScroll(message.options)
            .then(result => {
              sendMessage('scrollComplete', result);
              sendResponse({ success: true, ...result });
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message });
            });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true; // 保持消息通道开放
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
              totalImages: allImgs,
              pageType
            }
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message
          });
        }
        break;
      }
    }
    return true; // 保持消息通道开放
  });

  // 导出函数供测试使用
  if (typeof window !== 'undefined') {
    window.__picgrabber = {
      scanImages,
      observeNewImages,
      autoScroll,
      detectPageType,
      sendMessage
    };
  }
})();
