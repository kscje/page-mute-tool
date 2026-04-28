# Page Mute Tool - Chrome 浏览器插件功能规划文档

## 一、插件核心工作原理和技术实现路径

### 1.1 核心工作原理

本插件的核心工作原理基于**内容脚本（Content Script）注入 + 媒体元素属性拦截**的双层控制机制：

```
用户访问网页
    ↓
Chrome Extension 检测URL域名
    ↓
匹配域名列表（如已添加）
    ↓
注入内容脚本到目标页面
    ↓
脚本拦截所有 <audio> 和 <video> 元素
    ↓
设置 autoplay = false，强制静音
    ↓
用户点击播放按钮
    ↓
正常播放（如用户主动触发）
```

### 1.2 技术实现路径

#### 路径一：属性拦截方案（主方案）
- **实现方式**：监听 DOM 树变化，拦截所有新增的 `<audio>` 和 `<video>` 元素
- **技术手段**：使用 MutationObserver API 监听 DOM 变化
- **控制策略**：将 `autoplay` 属性移除，设置 `muted = true`，并拦截 `play()` 方法调用

#### 路径二：事件拦截方案（辅助方案）
- 拦截媒体元素的 `play()` 事件
- 在用户首次交互前，阻止自动播放的 `play()` 调用
- 维护一个"用户已交互"标志位

#### 路径三：CSS 覆盖方案（兜底方案）
- 对于某些无法通过 JS 控制的嵌入播放器（如 Flash 或特殊框架）
- 使用 CSS 覆盖播放按钮，阻止用户误触自动播放

### 1.3 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Background │  │   Popup     │  │  Content Script │  │
│  │   Script    │  │    UI       │  │   (注入到页面)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│        ↑                ↑                  ↑           │
│        │                │                  │           │
│  ┌─────────────────────────────────────────────┐       │
│  │              Storage (chrome.storage)       │       │
│  │           存储域名列表和用户设置              │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 二、域名管理机制设计

### 2.1 数据模型

```javascript
// 域名列表存储结构
{
  domains: [
    {
      id: "uuid-string",
      pattern: "*.example.com",  // 支持通配符
      enabled: true,
      createdAt: "2024-01-01T00:00:00Z",
      description: "示例域名"
    }
  ],
  globalEnabled: true,  // 全局开关
  defaultBehavior: "block"  // 默认行为：block / allow
}
```

### 2.2 域名管理功能

#### 2.2.1 添加域名
- **输入验证**：
  - 支持精确域名：`example.com`
  - 支持子域名：`*.example.com`
  - 支持多级子域名：`*.sub.example.com`
  - 自动验证格式合法性
- **去重检查**：避免重复添加相同域名
- **即时生效**：添加后立即对匹配域名生效

#### 2.2.2 删除域名
- **支持单条删除**：点击删除按钮移除特定域名
- **支持批量删除**：勾选多个域名后批量删除
- **确认机制**：删除前弹出确认对话框
- **快捷操作**：支持左滑删除或快捷键删除

#### 2.2.3 查看域名
- **列表展示**：分页展示所有已添加的域名
- **搜索过滤**：支持按域名关键词搜索
- **状态筛选**：按启用/禁用状态筛选
- **排序功能**：按添加时间、域名名称排序

#### 2.2.4 编辑域名
- **修改域名模式**：调整匹配规则
- **修改描述**：添加备注信息
- **启用/禁用切换**：临时关闭某个域名的控制

### 2.3 匹配逻辑

```javascript
// 域名匹配算法
function matchesDomain(pageUrl, pattern) {
  // 1. 精确匹配：example.com 匹配 example.com
  // 2. 通配符匹配：*.example.com 匹配 sub.example.com, sub.sub.example.com
  // 3. 特殊域名：localhost 特殊处理
  // 4. URL验证：自动提取主机名部分进行匹配
}
```

---

## 三、用户界面组件规划

### 3.1 插件图标设计

#### 3.1.1 图标规格
| 类型 | 尺寸 | 用途 |
|------|------|------|
| 16x16 | 16px | 工具栏小图标 |
| 32x32 | 32px | 普通分辨率 |
| 48x48 | 48px | 高分辨率显示 |
| 128x128 | 128px | 应用商店图标 |

#### 3.1.2 图标设计概念
- **主图标**：带静音符号的播放按钮，清晰传达"阻止自动播放"功能
- **激活状态**：图标显示为彩色/实心，表示插件正在工作
- **未激活状态**：图标显示为灰色/空心，表示插件已禁用
- **有媒体播放**：图标显示播放中的波纹动画

### 3.2 弹出配置面板（Popup UI）

#### 3.2.1 布局结构

```
┌────────────────────────────────────┐
│  Page Mute Tool           [⚙️]    │  ← 标题栏 + 设置按钮
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │   🔴 当前页面: example.com   │  │  ← 状态指示器
│  │   媒体控制: 已启用            │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  [🔍 输入域名...        ] [添加]   │  ← 快速添加栏
├────────────────────────────────────┤
│  受管控域名列表                   │
│  ┌──────────────────────────────┐  │
│  │ ☑ example.com         [🗑️]  │  │
│  │ ☑ youtube.com        [🗑️]  │  │
│  │ ☐ twitch.tv          [🗑️]  │  │
│  └──────────────────────────────┘  │
│           < 1 / 3 >               │  ← 分页器
├────────────────────────────────────┤
│  [导入] [导出] [全部删除]          │  ← 批量操作
├────────────────────────────────────┤
│  总开关: [●○○○○] 关闭  ←→  开启    │  ← 全局控制
│  提示: 已阻止 0 个自动播放        │  ← 统计信息
└────────────────────────────────────┘
```

#### 3.2.2 组件详细说明

**状态指示器组件**
- 显示当前访问的域名
- 指示当前页面的媒体控制状态（已启用/已禁用/未匹配）
- 用不同颜色区分状态（绿色=启用，灰色=未匹配，红色=已阻止）

**快速添加栏**
- 输入框支持域名自动补全
- 智能提示（根据剪贴板内容、历史记录）
- 添加按钮：点击或回车添加

**域名列表组件**
- 复选框选择
- 域名显示（支持过长域名省略）
- 启用/禁用切换开关
- 删除按钮（悬停显示）
- 支持拖拽排序

**分页器**
- 显示当前页/总页数
- 上一页/下一页按钮
- 每页显示数量选择（10/20/50）

**批量操作栏**
- 导入：从文件导入域名列表（JSON/CSV）
- 导出：导出域名列表到文件
- 全部删除：清空所有域名（需确认）

**全局开关**
- 滑块式开关
- 控制插件整体启用/禁用
- 状态实时同步到图标

**统计面板**
- 显示本次会话阻止的自动播放次数
- 累计阻止总数
- 重置统计按钮

### 3.3 选项页面（Options Page）

用于更详细的配置：

```
┌──────────────────────────────────────────────┐
│  Page Mute Tool - 设置                     │
├──────────────────────────────────────────────┤
│  [常规设置] [域名管理] [高级选项] [关于]     │
├──────────────────────────────────────────────┤
│  常规设置                                  │
│  ┌────────────────────────────────────────┐ │
│  │ □ 开机自动启动 Chrome 时启用插件       │ │
│  │ □ 在新标签页显示插件状态               │ │
│  │ □ 阻止音频自动播放                     │ │
│  │ □ 阻止视频自动播放                     │ │
│  │ □ 阻止 iframe 中的媒体自动播放         │ │
│  │                                        │ │
│  │ 自动播放策略: [下拉选择 ▼]            │ │
│  │   - 完全阻止（静音播放也不允许）       │ │
│  │   - 允许静音自动播放                   │ │
│  │   - 允许，但延迟播放                   │ │
│  │                                        │ │
│  │ 页面加载延迟: [0] ms (0-5000)         │ │
│  └────────────────────────────────────────┘ │
│                                            │
│  [保存设置]  [恢复默认]                    │
└──────────────────────────────────────────────┘
```

---

## 四、媒体检测和播放控制技术方案

### 4.1 媒体检测方案

#### 4.1.1 检测目标元素

| 元素类型 | HTML标签 | 检测优先级 |
|----------|----------|------------|
| 直接音频 | `<audio>` | 高 |
| 直接视频 | `<video>` | 高 |
| 嵌入iframe | `<iframe src="...">` | 中 |
| JavaScript创建 | `document.createElement('video')` | 高 |
| Web Audio API | AudioContext | 中 |
| Flash对象 | `<object>` / `<embed>` | 低 |

#### 4.1.2 检测实现

```javascript
// 1. 初始扫描：页面加载完成后扫描现有媒体元素
function scanExistingMedia() {
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  const iframes = document.querySelectorAll('iframe');

  // 处理找到的元素
  [...videos, ...audios].forEach(blockMediaAutoplay);
}

// 2. 动态监控：使用 MutationObserver 监听新增元素
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
        blockMediaAutoplay(node);
      }
      // 检查通过 JS 创建的新元素
      if (node.querySelectorAll) {
        node.querySelectorAll('video, audio').forEach(blockMediaAutoplay);
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### 4.2 播放控制方案

#### 4.2.1 控制策略矩阵

| 策略 | autoplay属性 | play()调用 | muted状态 | 结果 |
|------|-------------|-----------|----------|------|
| 严格阻止 | 移除/忽略 | 拦截 | - | 阻止播放 |
| 宽松模式 | 保留 | 允许 | true时放行 | 仅静音播放 |
| 延迟播放 | 保留 | 延迟执行 | - | 等待用户交互 |

#### 4.2.2 核心控制代码

```javascript
// 拦截媒体元素
function blockMediaAutoplay(mediaElement) {
  if (mediaElement.dataset.autoplayBlocked) return;

  // 1. 标记已处理
  mediaElement.dataset.autoplayBlocked = 'true';

  // 2. 移除 autoplay 属性
  mediaElement.removeAttribute('autoplay');
  mediaElement.autoplay = false;

  // 3. 强制静音（确保不会发出声音）
  mediaElement.muted = true;

  // 4. 拦截 play() 方法
  const originalPlay = mediaElement.play;
  mediaElement.play = function() {
    // 如果用户尚未交互，阻止播放
    if (!hasUserInteracted) {
      console.log('[Page Mute] 已阻止自动播放');
      return Promise.reject(new Error('Autoplay blocked'));
    }
    return originalPlay.apply(this, arguments);
  };

  // 5. 监听用户首次交互
  if (!hasUserInteracted) {
    const enablePlayback = () => {
      hasUserInteracted = true;
      // 恢复原始 play 方法
      mediaElement.play = originalPlay;
      // 移除监听
      document.removeEventListener('click', enablePlayback);
      document.removeEventListener('keydown', enablePlayback);
    };
    document.addEventListener('click', enablePlayback, { once: true });
    document.addEventListener('keydown', enablePlayback, { once: true });
  }
}
```

### 4.3 iframe 处理

```javascript
// 处理 iframe 中的媒体
function handleIframe(iframe) {
  try {
    // 同源 iframe：直接处理
    if (isSameOrigin(iframe)) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      scanAndBlockMedia(iframeDoc);
    }
  } catch (e) {
    // 跨域 iframe：无法直接访问内容
    // 通过 postMessage 与 iframe 通信（如果 iframe 支持）
    iframe.contentWindow.postMessage({
      type: 'BLOCK_AUTOPLAY',
      settings: getSettings()
    }, '*');
  }
}
```

### 4.4 用户交互跟踪

```javascript
let hasUserInteracted = false;

// 监听用户交互事件
const userEvents = ['click', 'touchstart', 'keydown'];
userEvents.forEach(eventType => {
  document.addEventListener(eventType, () => {
    hasUserInteracted = true;
    // 可以向 background script 报告统计
    chrome.runtime.sendMessage({
      action: 'userInteracted',
      timestamp: Date.now()
    });
  }, { once: true, passive: true });
});
```

---

## 五、浏览器兼容性和权限申请策略

### 5.1 Chrome 扩展 Manifest V3 要求

```json
{
  "manifest_version": 3,
  "name": "Page Mute Tool",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 5.2 权限说明

| 权限 | 用途 | 必要性 |
|------|------|--------|
| `storage` | 存储域名列表和设置 | 必需 |
| `activeTab` | 仅在当前活动标签页执行脚本 | 必需 |
| `scripting` | 动态注入脚本 | 必需 |
| `<all_urls>` | 访问所有网站 | 必需（可通过主动授权优化） |
| `tabs` | 获取当前标签页信息 | 可选 |
| `webNavigation` | 监听导航事件 | 可选 |

### 5.3 权限优化策略

#### 激进模式（首次安装）
- 申请 `<all_urls>` 权限
- 一目了然，用户明确授权

#### 渐进模式（推荐）
- 仅在需要时申请域名权限
- 用户添加域名时逐步授权
- 使用 `chrome.permissions.request()` API

```javascript
// 渐进式权限申请
async function requestDomainPermission(domain) {
  const origin = `*://${domain}/*`;

  const result = await chrome.permissions.request({
    origins: [origin]
  });

  if (result) {
    console.log('权限已授予:', domain);
    // 启用该域名的控制
  } else {
    console.log('权限被拒绝');
  }
}
```

### 5.4 浏览器兼容性矩阵

| 功能 | Chrome 88+ | Chrome 100+ | Chrome 120+ | 说明 |
|------|-----------|-------------|-------------|------|
| Manifest V3 | ✅ | ✅ | ✅ | 最低要求 Chrome 88 |
| Content Script | ✅ | ✅ | ✅ | 完全支持 |
| MutationObserver | ✅ | ✅ | ✅ | 完全支持 |
| Service Worker | ✅ | ✅ | ✅ | 使用 esModule 支持 |
| declarativeNetRequest | ✅ | ✅ | ✅ | 可用于高级过滤 |
| User Agent | - | - | ✅ | 120+ 新增 |

---

## 六、关键技术点和潜在挑战

### 6.1 关键技术点

#### 6.1.1 DOM 变化监听
- **技术**：MutationObserver API
- **要点**：
  - 监听 `childList` 和 `subtree` 变化
  - 避免重复处理已处理的元素
  - 性能优化：批量处理变化
  - 及时断开观察者避免内存泄漏

#### 6.1.2 媒体元素拦截
- **技术**：重写 `play()` 方法，拦截 `autoplay` 属性
- **要点**：
  - 保存原始 `play` 方法引用
  - 处理 Promise 返回值
  - 兼容媒体元素的多种创建方式

#### 6.1.3 跨域 iframe 处理
- **技术**：postMessage 通信
- **要点**：
  - 检测 iframe 是否加载完成
  - 处理消息握手协议
  - 超时处理和错误恢复

#### 6.1.4 状态同步
- **技术**：chrome.runtime 消息传递
- **要点**：
  - 维护内容脚本和背景脚本的通信
  - 处理连接断开情况
  - 实现状态变更的实时同步

#### 6.1.5 数据持久化
- **技术**：chrome.storage API
- **要点**：
  - 使用 `chrome.storage.sync` 同步用户数据
  - 合理设置存储配额（~100KB）
  - 实现数据的导入/导出功能

### 6.2 潜在挑战

#### 6.2.1 挑战一：Shadow DOM 隔离

**问题**：Web Components 使用的 Shadow DOM 会隔离内容脚本的访问。

**解决方案**：
```javascript
// 递归遍历 Shadow DOM
function processShadowDOM(root) {
  const elements = root.querySelectorAll('video, audio');
  elements.forEach(blockMediaAutoplay);

  // 遍历所有 Shadow Root
  root.querySelectorAll('*').forEach(element => {
    if (element.shadowRoot) {
      processShadowDOM(element.shadowRoot);
    }
  });
}
```

#### 6.2.2 挑战二：动态加载的媒体框架

**问题**：React/Vue 等框架动态创建的媒体元素可能错过初始监听。

**解决方案**：
- 与框架的生命周期集成（如果可检测到框架）
- 增强 MutationObserver 的灵敏度
- 提供手动刷新按钮让用户触发重新扫描

#### 6.2.3 挑战三：HLS/DASH 流媒体

**问题**：HLS (.m3u8) 和 DASH (.mpd) 流媒体使用专用的播放引擎。

**解决方案**：
- 检测 `<video>` 元素的 `src` 属性
- 检查 `.m3u8` 和 `.mpd` URL 模式
- 对流媒体采用特殊的控制策略

#### 6.2.4 挑战四：音频 API 滥用

**问题**：Web Audio API 可以创建无关联音频源的音频节点。

**解决方案**：
- 限制 AudioContext 的创建（通过拦截 `AudioContext` 构造函数）
- 监控 `createMediaElementSource()` 调用
- 提供警告提示（完全阻止可能影响正常功能）

#### 6.2.5 挑战五：用户隐私顾虑

**问题**：用户可能担心插件访问所有网页内容。

**解决方案**：
- 最小化权限申请（按需申请域名权限）
- 清晰的隐私政策说明
- 不收集、不上传任何用户浏览数据
- 代码开源供审计

### 6.3 性能优化策略

| 优化点 | 策略 | 预期效果 |
|--------|------|----------|
| DOM 监听 | 使用 ` passive: true` | 减少滚动性能影响 |
| 批量处理 | 合并多次 DOM 变化 | 减少重排次数 |
| 选择器 | 使用 `querySelectorAll` | 一次性获取所有元素 |
| 缓存 | 缓存已处理的元素 | 避免重复处理 |
| 懒加载 | 内容脚本延迟加载 | 加快页面启动 |
| 节流 | 对频繁事件节流 | 控制计算量 |

---

## 七、功能模块划分

### 7.1 模块架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Page Mute Tool                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │   Popup Module  │  │ Options Module  │  │ Background   │  │
│  │   (弹出界面)    │  │  (选项设置)     │  │   Module     │  │
│  │                 │  │                 │  │  (后台服务)   │  │
│  │ - 域名管理UI    │  │ - 常规设置      │  │              │  │
│  │ - 状态显示      │  │ - 域名管理      │  │ - 消息转发   │  │
│  │ - 快速操作      │  │ - 高级选项      │  │ - 权限管理   │  │
│  │ - 统计信息      │  │ - 数据导入/导出 │  │ - 统计收集   │  │
│  └─────────────────┘  └─────────────────┘  └──────────────┘  │
│                              │                               │
│  ┌─────────────────┐  ┌──────┴─────────────────┐            │
│  │  Content Module │  │   Media Controller     │            │
│  │   (内容脚本)    │  │     (媒体控制器)        │            │
│  │                 │  │                        │            │
│  │ - DOM 扫描      │  │ - 元素拦截器            │            │
│  │ - Mutation 监听 │  │ - 播放方法拦截         │            │
│  │ - iframe 处理   │  │ - 用户交互跟踪         │            │
│  │ - 通信桥接      │  │ - 策略执行器           │            │
│  └─────────────────┘  └─────────────────────────┘            │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │  Storage Module │  │      Utils Module               │   │
│  │   (存储模块)    │  │        (工具模块)                │   │
│  │                 │  │                                 │   │
│  │ - 域名存储      │  │ - 域名验证/匹配                  │   │
│  │ - 设置存储      │  │ - 消息格式标准化                 │   │
│  │ - 统计数据      │  │ - 杂项工具函数                   │   │
│  └─────────────────┘  └─────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 模块依赖关系

```
Storage Module
      ↑
      │
Popup Module ←→ Background Module
      ↑               ↑
      │               │
      │         ┌─────┴─────┐
      │         │           │
      │    Content Module  ←→ Media Controller
      │         ↑
      │         │
      └─────────┘
      Utils Module
```

### 7.3 文件结构

```
page-mute-tool/
├── manifest.json           # 扩展配置文件
├── background.js          # 后台服务脚本
├── popup.html             # 弹出界面 HTML
├── popup.js               # 弹出界面逻辑
├── popup.css              # 弹出界面样式
├── options.html           # 选项页面 HTML
├── options.js             # 选项页面逻辑
├── options.css            # 选项页面样式
├── content.js             # 内容脚本（注入到页面）
├── media-controller.js    # 媒体控制核心逻辑
├── storage.js             # 存储管理模块
├── utils.js               # 工具函数模块
├── icons/                 # 图标资源目录
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── icon-active.svg    # 激活状态图标（源文件）
│   └── icon-inactive.svg  # 未激活状态图标
├── _locales/              # 国际化资源
│   └── zh_CN/
│       └── messages.json
├── LICENSE
└── README.md
```

---

## 八、技术实现方案总结

### 8.1 核心技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 配置文件 | Manifest V3 | Chrome 扩展最新规范 |
| 后台服务 | Service Worker | 替代后台页面，更轻量 |
| 页面脚本 | Content Script | 注入目标页面执行 |
| UI 框架 | 原生 HTML/CSS/JS | 无外部依赖，启动快 |
| 状态管理 | chrome.storage | 跨脚本同步状态 |
| 通信机制 | chrome.runtime | 脚本间消息传递 |

### 8.2 开发优先级

| 阶段 | 功能 | 优先级 | 预估工时 |
|------|------|--------|----------|
| P0 | 核心媒体拦截 | 必须 | 8h |
| P0 | 域名管理（增删改查） | 必须 | 6h |
| P0 | Popup 基础 UI | 必须 | 4h |
| P1 | 全局开关和状态指示 | 应该 | 2h |
| P1 | 统计数据展示 | 应该 | 2h |
| P1 | iframe 处理 | 应该 | 4h |
| P2 | Options 页面 | 可以 | 6h |
| P2 | 数据导入/导出 | 可以 | 4h |
| P3 | 国际化支持 | 延迟 | 4h |
| P3 | 高级策略配置 | 延迟 | 6h |

### 8.3 测试策略

| 测试类型 | 覆盖范围 | 测试方法 |
|----------|----------|----------|
| 单元测试 | 工具函数、域名匹配 | Jest |
| 集成测试 | 各模块间通信 | Puppeteer |
| E2E 测试 | 完整用户流程 | Cypress |
| 兼容性测试 | 不同 Chrome 版本 | LambdaTest |
| 性能测试 | 页面加载影响 | Lighthouse |

---

## 九、总结

本规划文档详细阐述了 **Page Mute Tool** Chrome 插件的完整设计方案，涵盖：

1. **核心原理**：基于内容脚本注入和媒体元素属性拦截的双层控制机制
2. **域名管理**：完整的增删改查功能，支持通配符匹配
3. **用户界面**：直观的 Popup UI 和功能丰富的 Options 页面
4. **媒体控制**：多层次、全覆盖的媒体自动播放阻止方案
5. **兼容性**：遵循 Manifest V3 规范，支持 Chrome 88+
6. **挑战应对**：提供了 Shadow DOM、动态框架、流媒体等场景的解决方案

该插件遵循 Chrome 扩展开发最佳实践，采用纯原生技术栈（无外部依赖），确保了：
- **轻量级**：不影响页面加载性能
- **安全可靠**：最小权限原则，不收集用户数据
- **易于维护**：模块化架构，代码清晰
- **用户友好**：直观的操作界面，即时反馈

---

**文档版本**：v1.0.0
**创建日期**：2026-04-21
**下次审核**：功能开发完成后
