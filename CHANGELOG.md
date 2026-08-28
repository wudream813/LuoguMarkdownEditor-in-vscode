# Changelog

## [1.0.17] - 2026-08-28

### 修复

- **Bilibili 视频画面加载不出（终极根因）**：经查证（microsoft/vscode#180780 + 播放器源码 + 实测），VSCode 的 Electron **不带 AAC 音频解码器**，而 B 站桌面播放器的 `createPlayer()` 起手探测 H.264+AAC 组合格式，探测失败就**根本不创建播放器实例**。现改用 **B 站移动端播放器端点**（无组合探测门槛，渐进式 MP4 + 原生 video 播放）
- **已知平台限制**：VSCode 缺 AAC 解码，视频将**有画面、无声音**（facade 已加提示）；需要声音请点击视频卡右上角链接到 B 站观看

## [1.0.16] - 2026-08-28

### 修复

- **Bilibili 视频画面仍加载不出（v1.0.15 未根治）**：将 iframe Referer 策略从「依赖默认继承」改为显式 `referrerpolicy="origin"`。curl 实测证实：视频 CDN 要求 Referer 为 bilibili.com 域（`player.bilibili.com` → 206 放行，空 Referer → 403），而 webview 外层页面的 referrer policy 不受扩展控制，继承结果可能是空 Referer。显式 `origin` 无论外层如何都把 Referer 锁定为 `https://player.bilibili.com`

## [1.0.15] - 2026-08-28

### 修复

- **Bilibili 视频能加载播放器但出不来画面**：移除 iframe 的 `referrerpolicy="no-referrer"`。该属性会传播给播放器内部的所有请求，使视频流请求（`upos-*.bilivideo.com`）Referer 为空，被 CDN 防盗链 403 拒绝——元信息（标题/时长）能加载但画面加载不出。移除后播放器以自身源 `player.bilibili.com` 作为 Referer，CDN 放行视频流

## [1.0.14] - 2026-08-28

### 修复

- **Bilibili 视频无法加载（黑屏）**：iframe 的 `sandbox` 缺少 `allow-same-origin` 与 `allow-forms`，播放器在 opaque origin 下运行导致 localStorage/cookies 被禁用、播放器初始化崩溃。现为 `allow-scripts allow-same-origin allow-forms allow-popups allow-presentation`（仍不授予 `allow-top-navigation`，防止播放器劫持面板跳转）

## [1.0.13] - 2026-08-27

### 修复

- **任务勾选改错行（根治）**：复选框现在携带 parser 渲染时标注的真实源行号（`data-task-line`），扩展按行号修改文档并做防御校验（行内容必须是任务、状态幂等、越界拒绝）。彻底解决两套任务计数实现在「不规范围栏代码块 / 引用 / 嵌套容器」等场景下分叉导致的「点任务 A 却勾了任务 B」
- 引用块、居中/引言块内任务的行号现在正确追溯（此前这些容器递归解析时丢失了行偏移）

## [1.0.12] - 2026-08-27

### 修复

- **一键排版修复损坏代码**：占位符还原改用函数回调，代码中的 `$&`、`$'`、`$$` 不再被当作替换模式篡改
- **一键排版修复吃掉硬换行**：行尾双空格（洛谷硬换行）不再被压缩
- **一键排版修复**：行内代码/公式后紧跟中文现在会正确补空格（原正则永不命中）
- **安全**：KaTeX `trust: true` 改为谓词白名单，`\href{javascript:...}` 不再可执行，与链接 sanitizeUrl 行为一致
- **任务勾选改错行**：勾选框索引与渲染器对齐——跳过代码块内的任务示例、正确计数引用块内的任务、支持有序任务列表；且勾选始终作用于预览绑定的文档而非当前活动编辑器
- **暗色主题打开预览显示亮色**：主题改为在 webview `ready` 握手后下发（此前消息在加载完成前发送被丢弃）
- **Bilibili 视频每次按键重置进度**：已加载的 iframe 在重渲染前移至保留区、渲染后移回原位，播放状态不再丢失；删除视频后出现死引用会被清理
- **折叠框状态错位**：展开/收起状态按折叠框序号保存恢复，不再因行号变化张冠李戴
- **`luogu-editor.autoSync` 配置生效**：此前声明但从未被读取
- **预览绑定文档**：编辑其他 markdown 文件不再串改当前预览；切换到非 markdown 编辑器时预览保持
- **rust / go / bash / json / latex 代码高亮**：补加载对应 Prism 组件（文件一直在包内但未引入）
- **代码块占位注释匹配语言**：选择 python 时插入 `# code` 而非 `// code`
- **插入折叠框按 Esc 可取消**：不再强制插入
- **模板库接通**：侧边栏模板改用 `media/luogu-templates.js` 中的完整模板（此前该文件未被加载，插入的是精简 fallback）
- **下划线强调误伤 snake_case**：`_`/`__`/`___` 增加词边界守卫，`a_b_c` 不再渲染成斜体
- **表格单元格 `\|` 转义**：按未转义竖线切分单元格
- **链接/图片 URL 含括号被截断**：URL 支持一级平衡括号
- **其他**：移除光标移动触发的多余预览滚动；高对比主题正确识别为暗色

## [1.0.11] - 2026-08-27

### 新增

- **预览可滚动至空白区域**：底部 padding 增加到 80vh，允许将最后一行内容滚动到视口顶部
- **任务列表勾选框可交互**：点击预览中的任务勾选框会同步更新 Markdown 源码

### 修复

- **Bilibili 视频黑屏**：改为显式将 iframe 追加到 wrapper 容器（而非 replaceWith），确保 iframe 在正确位置

## [1.0.10] - 2026-08-27

### 修复

- **Bilibili 视频黑屏**：iframe 属性与原版保持一致（scrolling, frameborder, framespacing, allowfullscreen, referrerpolicy, sandbox），使用简单的 replaceWith 替换按钮
- **滚动同步僵硬**：使用 `scrollTo({ behavior: 'smooth' })` 实现平滑滚动；防抖时间从 30ms 降低到 16ms（一帧）；锁定超时从 80ms 增加到 150ms 以允许平滑滚动完成

## [1.0.9] - 2026-08-27

### 修复

- **Bilibili 视频加载**：iframe 使用正确的 sandbox 属性（allow-scripts allow-popups allow-presentation）；CSP 显式允许 player.bilibili.com；确保容器有 position:relative
- **设置项精简**：移除主题配置项（主题现在自动跟随 VSCode）

## [1.0.8] - 2026-08-27

### 修复

- **滚动同步**：修复滚动容器错误（使用 `document.body` 而非 `previewEl` 作为滚动容器）；新增 `onDidChangeTextEditorSelection` 作为备用触发器
- **主题切换**：自动跟随 VSCode 主题（亮/暗）；切换命令现在正确生效
- **Bilibili 持久化**：已加载的 Bilibili 视频在重新渲染后自动恢复，无需再次点击

## [1.0.7] - 2026-08-27

### 修复

- **滚动同步**：webview 加载完成后发送 `ready` 消息通知扩展主机，扩展主机收到后才开始发送滚动位置；使用 `requestAnimationFrame` 确保 DOM 渲染完毕后再滚动；增加 `scrollSyncLock` 防止反馈循环
- **Bilibili 黑屏**：移除 iframe 的 `sandbox` 属性（Bilibili 播放器需要同源访问其 API），添加 `allow="autoplay; fullscreen"`
- **主题切换**：新增 `luogu-editor.toggleTheme` 命令和侧边栏入口，通过 `set-theme` 消息切换预览面板的 `data-theme`

## [1.0.6] - 2026-08-27

### 修复

- **预览空白**：v1.0.5 的 CSP `script-src` 漏掉了 `${csp}`（webview 资源域名），导致解析器、KaTeX、Prism 等外部脚本全部被拦截。修复为 `script-src ${csp} 'unsafe-inline'`

## [1.0.5] - 2026-08-27

### 修复

- **代码块颜色**：修复 inline code 样式覆盖了 Prism.js 语法高亮颜色的问题，改为 `:not(pre) > code` 精确匹配
- **滚动同步**：重构同步逻辑，编辑器滚动后 20ms 防抖发送行号到预览，内容更新后 100ms 重新同步位置，打开预览时 200ms 发送初始位置
- **复制按钮**：CSP 添加 `script-src 'unsafe-inline'`，允许 onclick 事件处理器执行；preview.js 定义 `window.copyCodeBlock` 全局函数
- **Bilibili 加载按钮**：CSP 添加 `frame-src https:`，允许 Bilibili iframe 加载
- **折叠框状态保持**：预览面板在重新渲染前保存 `<details>` 的 open/closed 状态（按 `data-src-line` 匹配），渲染后恢复

## [1.0.4] - 2026-08-27

### 修复

- **预览面板可滚动**：修复 body 缺少 `overflow-y: auto` 导致预览内容无法滚动的问题
- **滚动同步**：编辑器滚动时预览面板自动跟随，以用户可见区域顶部为基准定位

### 改进

- **滚动同步算法**：基于 `data-src-line` 锚点的分段线性插值，源码行与渲染位置精准对应
- **去除 emoji**：侧边栏、消息通知中不再使用 emoji 字符

## [1.0.3] - 2026-08-27

### 🐛 修复

- **侧边栏图标**：替换为实心填充风格的 SVG 图标，确保在 VSCode 活动栏正确显示
- **侧边栏可见性**：添加 `visibility: visible` 确保面板始终展开

### 🎨 改进

- **命令前缀统一**：所有命令标题统一为 `Luogu Markdown:` 前缀，方便在命令面板中搜索

## [1.0.2] - 2026-08-27

### 🐛 修复

- **侧边栏始终可见**：移除了 `editorLangId == markdown` 限制条件，侧边栏不再需要先打开 .md 文件才能看到
- **激活事件增强**：新增 `onView` 激活事件，点击活动栏图标时自动激活扩展

## [1.0.1] - 2026-08-27

### 🔄 架构重构

- **左侧编辑，右侧预览**：使用 VSCode 原生编辑器编辑 Markdown，右侧 Webview 仅显示渲染预览
- **侧边栏工具箱**：所有格式化工具（加粗、折叠框、表格等）移至活动栏侧边栏
- **移除全页 Webview**：不再使用自定义编辑器替代 VSCode 原生编辑体验
- **精简 Webview**：预览面板只负责渲染，不包含编辑器 UI

### ✨ 新增

- 🎨 活动栏新增「洛谷 Markdown」图标，点击展开格式工具箱
- 📋 格式工具箱分为 6 大类：文本格式、代码与引用、数学公式、洛谷折叠框、表格与排版、多媒体与链接
- 📚 模板与工具侧边栏：快速插入洛谷模板、排版修复、复制源码
- 🎯 每个工具项显示语法提示（如 `**text**`、`:::info`）

### 🗑️ 移除

- 移除 v1.0.0 的全页 Webview 编辑器（textarea + 预览双栏）
- 移除自定义编辑器 `CustomTextEditorProvider`
- 移除 LaTeX 公式速查面板（将在后续版本以侧边栏形式回归）

## [1.0.0] - 2026-08-27

### 首次发布

- ✨ 完整的洛谷 Markdown 语法支持
- ✨ KaTeX 数学公式实时预览
- ✨ Prism.js 代码语法高亮
- ✨ 洛谷折叠框 (info/success/warning/error)
- ✨ 表格合并 (^ 和 <) 与 Tuack 竞赛风格
- ✨ 引言块 (:::epigraph)
- ✨ 居中/居右排版 (:::align)
- ✨ Bilibili 视频嵌入
- ✨ 代码块行号与高亮
- ✨ LaTeX 数学公式速查面板
- ✨ 可视化表格生成器
- ✨ 洛谷排版规范 Linter 与一键修复
- ✨ 洛谷官方模板库
- ✨ 双向同步滚动
- ✨ 亮色/暗色主题切换
- ✨ VSCode 双向编辑同步
- ✨ 自定义编辑器 (CustomTextEditorProvider)
- ✨ 侧边预览面板
- ✨ 多种命令与快捷键
