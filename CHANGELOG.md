# Changelog

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
