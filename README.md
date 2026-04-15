# 一键存图 (PicGrabber)

一个 Chrome 浏览器扩展，用于一键下载网页上的所有图片，支持懒加载和无限滚动页面。

## 功能特性

- 🔍 **智能扫描** - 自动扫描页面上的所有图片，包括 `<img>` 标签、背景图片、`srcset`、`picture` 标签等
- 📜 **自动滚动** - 自动滚动页面以加载懒加载图片和无限滚动内容
- ⬇️ **批量下载** - 支持同时下载多张图片，可设置并发数量
- 🖼️ **格式过滤** - 支持按图片格式过滤（JPG、PNG、GIF、WebP 等）
- 📐 **尺寸过滤** - 可设置最小图片宽高，过滤小图标和缩略图
- 📊 **数量限制** - 可设置最大下载数量
- ⚙️ **自定义设置** - 支持自定义文件名格式、最大并发数等
- 🔒 **安全隐私** - 本地处理，不上传任何数据

## 安装方法

### 方法一：加载未打包扩展（开发模式）

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `picgrabber` 目录
5. 扩展图标会出现在工具栏上

### 方法二：打包发布

1. 压缩 `picgrabber` 目录为 ZIP 文件
2. 访问 [Chrome 开发者控制台](https://chrome.google.com/webstore/devconsole)
3. 上传并发布扩展

## 使用方法

1. 打开需要下载图片的网页
2. 点击扩展图标
3. （可选）启用「自动滚动」以扫描懒加载和无限滚动页面
4. 点击「扫描图片」按钮
5. 查看扫描结果，UI 实时显示已发现的图片数量
6. 点击「下载全部」开始下载

## 项目结构

```
picgrabber/
├── manifest.json          # 扩展配置文件 (Manifest V3)
├── background.js          # 后台脚本（处理下载）
├── content.js             # 内容脚本（抓取图片）
├── popup.html             # 弹出窗口界面
├── popup.js               # 弹出窗口逻辑
├── options.html           # 设置页面界面
├── options.js             # 设置页面逻辑
├── icons/                 # 图标目录
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── styles/                # 样式文件
│   ├── popup.css
│   └── options.css
├── utils/                 # 工具函数
│   └── helper.js
└── tests/                 # 测试文件
    ├── helper.test.js
    └── popup.test.js
```

## 设置说明

| 设置项 | 说明 |
|--------|------|
| 图片格式 | 过滤特定格式的图片，支持 jpg,png,gif,webp 等 |
| 最大数量 | 限制下载的图片数量 |
| 最小宽度 | 过滤宽度小于此值的图片（像素） |
| 最小高度 | 过滤高度小于此值的图片（像素） |
| 自动滚动 | 滚动页面以加载懒加载和无限滚动内容 |

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 运行覆盖率报告
npm run test:coverage
```

### 调试方法

1. **调试 Content Script**
   - 打开目标网页
   - 右键 -> 检查
   - 切换到 Sources 面板
   - 找到 content.js 文件设置断点
   - 查看控制台日志 `[PicGrabber]`

2. **调试 Background Script**
   - 打开 `chrome://extensions/`
   - 找到扩展，点击 "service worker" 链接

3. **调试 Popup**
   - 右键扩展图标 -> 检查弹出窗口

### 测试

```bash
# 运行所有测试
npm test

# 运行覆盖率报告
npm run test:coverage
```

## 技术栈

- **Chrome Extension API** - Manifest V3
- **JavaScript (ES6+)** - 原生 JS 开发
- **HTML/CSS** - 界面样式
- **Jest** - 单元测试

## 权限说明

本扩展申请以下权限：

| 权限 | 用途 |
|------|------|
| `downloads` | 下载图片到本地 |
| `activeTab` | 获取当前标签页信息 |
| `storage` | 保存用户设置 |
| `tabs` | 管理标签页 |
| `<all_urls>` | 访问所有网页的图片 |

## 版本历史

### v1.1.0 (2025-04-15)
- 添加自动滚动功能，支持懒加载和无限滚动页面
- 添加最小图片尺寸过滤功能
- 优化图片扫描速度
- UI 实时显示扫描进度

### v1.0.0 (2024-01-01)
- 初始版本发布
- 图片扫描和下载功能
- 基本设置选项

## 许可证

MIT License