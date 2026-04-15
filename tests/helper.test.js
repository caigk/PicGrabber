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
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    }
  },
  downloads: {
    download: jest.fn(),
    show: jest.fn(),
    onChanged: {
      addListener: jest.fn()
    }
  }
};

// 测试 helper.js
describe('Helper Functions', () => {
  const helper = require('../utils/helper.js');
  
  describe('getImageExtension', () => {
    it('should extract extension from URL', () => {
      expect(helper.getImageExtension('https://example.com/image.jpg')).toBe('jpg');
      expect(helper.getImageExtension('https://example.com/image.png')).toBe('png');
      expect(helper.getImageExtension('https://example.com/image.JPEG')).toBe('jpeg');
    });
    
    it('should handle URL without extension', () => {
      expect(helper.getImageExtension('https://example.com/image')).toBe('jpg');
    });
    
    it('should handle invalid URL', () => {
      expect(helper.getImageExtension('')).toBe('jpg');
      expect(helper.getImageExtension(null)).toBe('jpg');
    });
  });
  
  describe('isImageUrl', () => {
    it('should return true for valid image URLs', () => {
      expect(helper.isImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(helper.isImageUrl('https://example.com/image.png')).toBe(true);
      expect(helper.isImageUrl('data:image/png;base64,abc123')).toBe(true);
    });
    
    it('should return false for non-image URLs', () => {
      expect(helper.isImageUrl('https://example.com/page.html')).toBe(false);
      expect(helper.isImageUrl('https://example.com/script.js')).toBe(false);
      expect(helper.isImageUrl('')).toBe(false);
      expect(helper.isImageUrl(null)).toBe(false);
    });
  });
  
  describe('cleanUrl', () => {
    it('should remove query parameters and hash', () => {
      expect(helper.cleanUrl('https://example.com/image.jpg?size=large#section'))
        .toBe('https://example.com/image.jpg');
    });
    
    it('should handle data URLs', () => {
      const dataUrl = 'data:image/png;base64,abc123';
      expect(helper.cleanUrl(dataUrl)).toBe(dataUrl);
    });
  });
  
  describe('uniqueUrls', () => {
    it('should remove duplicate URLs', () => {
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image1.jpg?size=large',
        'https://example.com/image2.jpg'
      ];
      const result = helper.uniqueUrls(urls);
      expect(result).toHaveLength(2);
    });
  });
  
  describe('filterByExtensions', () => {
    it('should filter URLs by extension', () => {
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.png',
        'https://example.com/image3.gif'
      ];
      const result = helper.filterByExtensions(urls, ['jpg', 'png']);
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('image1.jpg');
      expect(result[1]).toContain('image2.png');
    });
  });
  
  describe('limitUrls', () => {
    it('should limit the number of URLs', () => {
      const urls = ['url1', 'url2', 'url3', 'url4', 'url5'];
      const result = helper.limitUrls(urls, 3);
      expect(result).toHaveLength(3);
      expect(result).toEqual(['url1', 'url2', 'url3']);
    });
  });
});