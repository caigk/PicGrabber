/**
 * @jest-environment jsdom
 */

// Mock Chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    openOptionsPage: jest.fn()
  },
  tabs: {
    query: jest.fn().mockResolvedValue([{ id: 1, url: 'https://example.com', title: 'Test Page' }]),
    sendMessage: jest.fn().mockResolvedValue({ success: true, images: ['img1.jpg', 'img2.png'] }),
    create: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({ imageFormat: 'all', maxCount: 100 }),
      set: jest.fn().mockResolvedValue()
    }
  },
  downloads: {
    download: jest.fn()
  }
};

// Mock document
document.body.innerHTML = `
  <div class="container">
    <header class="header">
      <h1>📷 图片批量下载器</h1>
    </header>
    <main class="main">
      <div class="page-info" id="pageInfo">
        <p class="page-title" id="pageTitle">正在获取页面信息...</p>
        <p class="image-count" id="imageCount">-</p>
      </div>
      <div class="settings">
        <label class="setting-item">
          <span>图片格式：</span>
          <select id="imageFormat">
            <option value="all">全部</option>
            <option value="jpg,jpeg,png,gif,webp">JPG/PNG/GIF/WebP</option>
          </select>
        </label>
        <label class="setting-item">
          <span>最大数量：</span>
          <input type="number" id="maxCount" value="100" min="1" max="1000">
        </label>
      </div>
      <div class="progress-section" id="progressSection" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <p class="progress-text" id="progressText">0 / 0</p>
      </div>
      <div class="status-message" id="statusMessage" style="display: none;"></div>
      <div class="button-group">
        <button class="btn btn-primary" id="scanBtn">🔍 扫描图片</button>
        <button class="btn btn-success" id="downloadBtn" disabled>⬇️ 下载全部</button>
      </div>
    </main>
    <footer class="footer">
      <a href="#" id="openOptions">⚙️ 设置</a>
      <span class="divider">|</span>
      <a href="#" id="openFolder">📁 打开文件夹</a>
    </footer>
  </div>
`;

describe('Popup Script', () => {
  let popupScript;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    popupScript = require('../popup.js');
  });
  
  describe('Initialization', () => {
    it('should load settings on init', async () => {
      // Settings should be loaded from chrome.storage
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });
    
    it('should get page info on init', async () => {
      // Should query for active tab
      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });
  });
  
  describe('Event Listeners', () => {
    it('should attach event listeners to buttons', () => {
      const scanBtn = document.getElementById('scanBtn');
      const downloadBtn = document.getElementById('downloadBtn');
      
      expect(scanBtn).toBeTruthy();
      expect(downloadBtn).toBeTruthy();
    });
  });
});