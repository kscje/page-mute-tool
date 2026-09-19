# E2E 网站回归测试手册（E2E Testing Playbook）

本文档把 2026-09-19 对 v1.0.5 的全量实测（YouTube / Bilibili / 凤凰网 / X / 微博 / 知乎 / 小红书 / Reddit）沉淀为可重复执行的测试清单与自动化方案。任何涉及 `media-controller.js`、`page-hook.js`、`content-bridge.js`、`background.js` 或域名匹配逻辑的改动，都应按本手册跑一遍回归。

- 自动化驱动脚本：`docs/e2e/cdp-driver.js`（无依赖，Node ≥ 22）
- 测试证据目录：`gui-test-screenshots/`（截图按 `user_<站点>_t<阶段>_<结论>.jpg` 命名）

---

## 1. 测试矩阵（每个站点固定五步）

| 阶段 | 操作 | 预期（通过标准） |
|---|---|---|
| T0 基线 | 域名列表中**不含**该站点，打开/刷新观测页，等待 8–14s | 站点自身行为正常：有自动播放场景的站点视频处于播放/缓冲态（`paused:false`、`currentTime` 前进）；`HTMLMediaElement.prototype.play.name === "play"`（未被包裹）、视频无 `data-page-mute-managed` |
| T1 加域名 | 加入站点域名 → 刷新观测页 → **期间不做任何点击**，等待 8–14s | 自动播放被拦：主观测视频 `paused:true`、`currentTime` 不前进（或为 0）、`play.name === "pageMutePlayWrapper"`、视频带 `data-page-mute-managed="true"`（注意：Shadow DOM 里的视频也能看到该标记） |
| T2 手动播放 | GUI 点击播放按钮/视频本体 | 一次或两次点击内开始播放：`paused:false`、`currentTime` 持续前进、非静音（`muted:false`）；扩展拦截计数不因此增加（GET_STATS） |
| T3 刷新复核 | 刷新页面，同样不做点击 | 与 T1 相同：仍被拦截 |
| T4 移除域名 | 移除该站点域名 → 刷新 | 恢复站点原生行为：自动播放恢复（对比 T0），`play.name === "play"`、无 managed 标记 |

**判定原则**：每一步都要有 DOM 只读读数 + 至少一张截图（T3 可与 T1 同观感时复用 DOM 证据）；页面控制台不得出现扩展相关报错。

**已知例外**：微博（网页版为点击/悬停播放型）与知乎（Web 端无视频场景）没有自动播放可拦——这两站只验证「加域名后无异常播放、手动播放正常、移除后行为一致」。

---

## 2. 站点清单与观测要点

| 站点 | 观测页 | 建议域名 pattern | 自动播放类型 | 观测要点 / 已知坑 |
|---|---|---|---|---|
| YouTube | `watch?v=aqz-KE-bpKQ`（Big Buck Bunny，10 分钟） | `www.youtube.com` | 页面加载即自动播放 | 新播放器把 `<video>` 停在可视区外，**点击播放按钮时手势不会命中媒体元素**，依赖 1.5s 宽限窗；用 `movie_player.getPlayerState()`：-1=未启动（被拦）、1=播放、3=缓冲 |
| Bilibili | `video/BV1GJ411x7h7` | `www.bilibili.com` | 页面加载即自动播放（有声音） | 主框架直接 `<video>`；T1 时可能短暂播 0.2s 后被暂停，属正常 |
| 凤凰网视频 | 打开 `v.ifeng.com` 首页 → 点击海报跳转的视频详情页（`v.ifeng.com/c/...`） | `v.ifeng.com` | 详情页加载即自动播放（有声） | 首页是点击后跳转型；`/feed`、`/live` 等路径可能 404 |
| X (Twitter) | 登录态 `x.com/home` 信息流 | `x.com` | 滚动入视口后静音自动播放 | 时间线需滚动找视频帖；被拦时视频帖显示“播放此视频”海报按钮 |
| 小红书 | 登录态 `xiaohongshu.com/explore` → 点“视频”频道 → 点开任一笔记 | `www.xiaohongshu.com` | 打开笔记（整页跳转）后自动播放（有声） | 瀑布流卡片不内嵌 `<video>`，必须点开笔记观测 |
| Reddit | 免登录 `reddit.com/r/popular/` | `www.reddit.com` | 滚动入视口后静音自动播放 | 视频在 **Shadow DOM** 内：观测必须穿透 shadowRoot 递归扫描（见 §6.2） |
| 微博 | 登录态 `weibo.com` 首页信息流 | `weibo.com` | **无**（点击播放型，悬停也不播） | 只验证：加域名后无误播、点击播放正常（一次点击播完整段）、移除后行为一致 |
| 知乎 | 登录态 `www.zhihu.com` 问答页 | `www.zhihu.com` | **无**（Web 端信息流为纯图文） | 只验证：加域名后页面正常、无误伤；无视频可播则跳过 T2 |
| Twitch | 免登录 `twitch.tv` 首页轮播 | — | 轮播流 | 2026-09 观测：播放器报网络错误 #2000，无法构成观测场景，暂跳过 |
| Facebook | 免登录首页 | — | — | 免登录无信息流，需登录，暂跳过 |

选择 pattern 时注意 `matchesDomain` 是**精确主机名**匹配（`weibo.com` 不匹配 `www.weibo.com`），通配符 `*.example.com` 才覆盖子域；生产上用户用弹窗“一键添加当前域名”得到的正是当前主机名。

---

## 3. 环境 A（首选）：隔离 Chrome for Testing 实例

用于无需登录态的全自动回归（YouTube / Bilibili / 凤凰网 / Reddit）。独立 profile + 独立调试端口，不影响日常浏览器。

**为什么是 Chrome for Testing**：Chrome 137+ 的正式版 Chrome 忽略 `--load-extension`（`--disable-features=DisableLoadExtensionCommandLineSwitch` 在 153 上也已失效）。CfT 构建保留该能力。

### 3.1 准备（一次性）

```bash
# 1. 下载 Chrome for Testing（mac-arm64，约 180MB）
curl -s https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json \
  | python3 -c "import json,sys;[print(d['url']) for d in json.load(sys.stdin)['channels']['Stable']['downloads']['chrome'] if d['platform']=='mac-arm64']"
curl -L -o /tmp/cft.zip <上面的URL> && cd /tmp && unzip -q cft.zip
# 得到 /tmp/chrome-mac-arm64/Google Chrome for Testing.app

# 2. 启动隔离实例（关键参数见下）
rm -rf /tmp/pgmute-test-profile
"/tmp/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  --user-data-dir=/tmp/pgmute-test-profile \
  --load-extension="<仓库绝对路径>" \
  --no-proxy-server \
  --remote-debugging-port=9223 \
  --no-first-run --no-default-browser-check \
  --window-size=1440,900 "about:blank" &
```

必踩坑说明：
- `--no-proxy-server` **必须加**：系统代理（本机 127.0.0.1:7892）会让 CfT 的所有 https 导航挂起；直连则 YouTube/Bilibili/凤凰全部可达。
- `--load-extension` 加载后扩展 ID = 仓库路径的 SHA256 前 32 位映射 a-p（`/Users/gemingming/AI_Program/Page Mute Tool` → `kamfopldbgmookkgdglkdbflcgkgkjmd`）。验证：`curl http://127.0.0.1:9223/json/list` 应出现 `chrome-extension://<ID>/background.js` 的 service_worker。
- CfT 下 `chrome-extension://` 页面可以正常打开（真实 Chrome 的 chrome-devtools MCP 会拦截），所以 options/popup 管理页可用真实 GUI 操作。

### 3.2 驱动用法（`docs/e2e/cdp-driver.js`）

```bash
node docs/e2e/cdp-driver.js list
node docs/e2e/cdp-driver.js nav "https://www.bilibili.com/video/BV1GJ411x7h7" "about:blank"
node docs/e2e/cdp-driver.js eval "<js表达式>" "bilibili"          # awaitPromise，返回 JSON
node docs/e2e/cdp-driver.js clickel ".bpx-player-video-wrap video" "bilibili"  # 可信点击元素中心
node docs/e2e/cdp-driver.js shot "gui-test-screenshots/bili_t1.jpg" "bilibili"
node docs/e2e/cdp-driver.js reload "bilibili"
node docs/e2e/cdp-driver.js close "bilibili"
```

- `[urlmatch]` 按 URL 子串选页；`click/clickel` 走 `Input.dispatchMouseEvent`，产生 **isTrusted 事件**（已实测可信，且 PointerEvent 会正常派发）。
- 打开新标签用 `new about:blank` + `nav <url>`：CfT 153 的 `/json/new?url=` 参数会被忽略。
- 站点重载期（YouTube 等重页面）CDP 会话可能短时无响应，脚本有 45s 看门狗（`CDP_TIMEOUT` 可调），重试即可。

### 3.3 CfT 环境的域名管理

CfT 里可以打开 `chrome-extension://<ID>/options.html` 作为普通标签页，用**真实 GUI** 管理域名（推荐，置信度最高）：

```bash
EXT=kamfopldbgmookkgdglkdbflcgkgkjmd
node docs/e2e/cdp-driver.js nav "chrome-extension://$EXT/options.html" "about:blank"
node docs/e2e/cdp-driver.js clickel "[data-tab='domains']" "options.html"   # 先切到“域名管理”标签
node docs/e2e/cdp-driver.js clickel "#domain-input" "options.html"
node docs/e2e/cdp-driver.js text "www.bilibili.com" "options.html"
node docs/e2e/cdp-driver.js clickel "#add-domain-btn" "options.html"
# 删除：找到目标 .domain-item 里的 .delete-btn 坐标后 click；confirm 对话框驱动会自动接受
```

注意：options 页的域名管理在“域名管理”标签页里，`#domain-input` 在“常规设置”页下是隐藏的（rect 为 0×0），必须先点标签。

---

## 4. 环境 B：用户真实浏览器（chrome-devtools MCP）

用于**需要登录态**的站点（X、小红书、微博、知乎）。前提：浏览器里加载的扩展已重载为最新代码。

- 先验证代码版本（任一页面）：
  ```js
  // 新版：时间戳在 isExplicitMediaInteraction 判断之前
  MediaController.prototype.handleUserInteraction.toString().includes('if (!this.isExplicitMediaInteraction(event)) {')
  ```
  若为旧版，先在 `chrome://extensions` 重载扩展（MCP 禁止导航 chrome://，需用户手动或 AppleScript 打开该页）。
- MCP 限制：不能导航 `chrome://` / `chrome-extension://`；`take_screenshot` 不接受 filePath，产物落在 `~/.zcode/cli/artifacts/`（结果里有 `Artifact:` 路径，cp 到 `gui-test-screenshots/` 后用 Read 查看）。
- 域名管理走 **bridge 消息**（见 §5）；每次会话先 `EXPORT_DATA` 留快照，结束后 `IMPORT_DATA` 恢复。
- **移除/重装未打包扩展会清空 chrome.storage**（域名、统计全部归零）——重装前务必先 EXPORT_DATA。
- 点击用 MCP 的 click(uid)，uid 必须来自**最新**快照（页面刷新/滚动后旧 uid 会失效或点错位置）。

---

## 5. 域名管理：bridge 消息协议

页面侧 `content-bridge.js` 提供 `window.postMessage` 双向通道，可在任意普通页面的 MAIN world 与后台通信（自动化管理域名的通用手段；正式发布验证仍建议优先用 options 页 GUI）。

```js
const call = (type, data) => new Promise((resolve) => {
  const id = 'op_' + Date.now() + Math.random().toString(36).slice(2, 6);
  const onMsg = (event) => {
    if (event.source === window && event.data && event.data.bridge === 'page-mute-bridge'
        && event.data.direction === 'to-page' && event.data.messageId === id) {
      window.removeEventListener('message', onMsg);
      resolve(event.data.response);
    }
  };
  window.addEventListener('message', onMsg);
  window.postMessage({ bridge: 'page-mute-bridge', direction: 'to-extension', messageId: id, type, data }, '*');
  setTimeout(() => { window.removeEventListener('message', onMsg); resolve({ timeout: true }); }, 5000);
});

await call('GET_DOMAINS', {});                                    // → {success, domains:[{id,pattern,enabled}]}
await call('ADD_DOMAIN', { pattern: 'www.reddit.com', description: '' });
await call('REMOVE_DOMAIN', { id: '<domain.id>' });
await call('GET_PAGE_STATE', { url: location.href, ancestorOrigins: [] });  // → {success,matched,active,domains,settings}
await call('GET_STATS', {});                                      // → {success,stats:{blockedCount,sessionBlocked}}
await call('EXPORT_DATA', {});                                    // → {success,data:"<json 字符串>"} 快照
await call('IMPORT_DATA', { jsonData: '<快照字符串>' });            // 整体恢复（含域名 id 与统计）
```

注意：桥接返回 `success:false` 且后续全部超时 ⇒ 扩展被重载过、该标签页的 content-bridge 已失效，刷新标签页即可。`REMOVE/IMPORT` 会触发 `refreshAllActionIcons`，不会主动通知已打开的页面——**改完域名必须刷新观测页**。

---

## 6. 观测辅助代码片段（只读，可直接 eval）

### 6.1 主框架视频状态 + 拦截标记

```js
JSON.stringify((() => {
  const vids = [...document.querySelectorAll('video')]
    .filter(v => v.getBoundingClientRect().width > 0)
    .map(v => ({ top: Math.round(v.getBoundingClientRect().top), paused: v.paused,
                 ct: +v.currentTime.toFixed(1), muted: v.muted, managed: !!v.dataset.pageMuteManaged }));
  return { vids, wrapped: HTMLMediaElement.prototype.play.name,
           n: vids.length, playing: vids.filter(v => !v.paused).length };
})())
```

### 6.2 Shadow DOM 深扫（Reddit 等）

```js
(() => {
  const found = [];
  const walk = (root, depth) => {
    if (depth > 8 || !root) return;
    root.querySelectorAll('*').forEach(el => {
      if (el.tagName === 'VIDEO' && el.getBoundingClientRect().width > 100
          && el.getBoundingClientRect().top > -200 && el.getBoundingClientRect().top < innerHeight) {
        found.push({ paused: el.paused, ct: +el.currentTime.toFixed(1), muted: el.muted,
                     managed: !!el.dataset.pageMuteManaged });
      }
      if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
    });
  };
  walk(document, 0);
  return found;
})()
```

### 6.3 加载中的代码版本（区分新旧构建）

```js
// mediaController（let 全局词法绑定）仅在域名命中时实例化；类本身任何页面都在：
MediaController.prototype.handleUserInteraction.toString()
// 新版特征：isTrusted 判断后**立刻**写 lastTrustedInteractionAt，再判 isExplicitMediaInteraction
```

### 6.4 YouTube 播放器状态

```js
document.getElementById('movie_player').getPlayerState()
// -1 未启动（被拦） 1 播放 3 缓冲 5 已就绪
```

---

## 7. 单站点剧本（要点）

每站流程 = §1 矩阵；以下只列与通则不同的点。

- **YouTube**：T1/T3 观察期**绝不点击**（任何可信点击都会打开 1.5s 放行窗）；T2 点 `.ytp-large-play-button`。T0 截图要赶在视频播完前（换长视频）。
- **Bilibili**：T1 时视频可能先播 0.2s 再被 `onPlay` 暂停，属预期；T2 点播放器中心即可。
- **凤凰网**：先开 `v.ifeng.com` 首页点任一海报进详情页（`/c/...`），在详情页做矩阵（详情页才是自动播放场景）。注意 T4 恢复后站点的“自动连播”会把页面切到下一条视频。
- **X**：需登录。时间线滚动找视频帖；被拦时帖子显示“播放此视频”海报。点击海报会**先创建播放器再调 play()**，首次点击可能超窗被拦、需第二次点击（点击已存在的视频元素=显式媒体交互，永久放行）——这是已知边界，不算回归失败，但要在报告中记录首次点击是否成功。
- **小红书**：点“视频”频道 → 点开第一个笔记（整页跳转）→ 弹层视频即观测对象。T4 恢复后 XHS 会从上次进度恢复播放，`ct` 起点不为 0 属正常。
- **Reddit**：观测一律用 §6.2 深扫；T2 点播放器控制条的“切换播放”按钮（快照里 `button "切换播放" keyshortcuts="k"`）。
- **微博 / 知乎**：无自动播放场景（见 §2），验证「加域名后无异常播放 + 手动播放正常（微博）/页面无异常（知乎）+ 移除后行为一致」即可。
- **通用**：T1/T3 观察期不做任何点击；发现站点出现登录墙/验证码/资源加载失败（如 Twitch #2000），记录后跳过该站。

---

## 8. 证据、快照与收尾

1. 截图存 `gui-test-screenshots/`，命名 `user_<站点>_t<阶段>_<结论>.jpg`（如 `user_xhs_t1_blocked.jpg`）；MCP 内联返回无路径的截图，在报告中注明“已查看、无持久化路径”。
2. 动用户浏览器域名前：先 `EXPORT_DATA` 保存快照到 `gui-test-screenshots/storage-snapshot-restore-point.json`；测试结束 `IMPORT_DATA` 恢复，并用 `GET_PAGE_STATE` 核对域名列表与 `x.com` 等 pattern 的 `matched` 状态。
3. 测试结束清理：关闭自建测试标签页（用户自己的标签不动）、核对域名列表=测试前状态、CfT 实例 `pkill -f pgmute-test-profile` 并删除 `/tmp/pgmute-test-profile`。
4. 报告必含：每阶段的 DOM 读数、截图、控制台是否有扩展相关错误、以及与预期的任何偏差（含“首次点击失败需二次点击”这类 UX 边界的记录）。

---

## 9. 与 RELEASE_CHECKLIST 的关系

- 本手册的自动化（环境 A + 驱动）覆盖 RELEASE_CHECKLIST「Manual Chrome Testing」中：matching domain 拦截、非匹配域名不激活、页面控制台无扩展错误、以及域名增删对页面行为的影响。
- 仍需人工完成：工具栏图标 active/inactive 切换、弹窗 UI（当前域名显示/一键添加/分页/统计）、options 的导入导出与恢复默认、中英文界面、Chrome Web Store 上传与 Post-Release 的 Git tag。
