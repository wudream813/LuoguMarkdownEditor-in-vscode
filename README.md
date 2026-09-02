# 洛谷 Markdown Editor（VSCode 扩展）

[![GitHub release](https://img.shields.io/github/v/release/wudream813/LuoguMarkdownEditor-in-vscode?display_name=tag)](https://github.com/wudream813/LuoguMarkdownEditor-in-vscode/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rendering parity](https://img.shields.io/badge/%E4%B8%8E%E6%B4%9B%E8%B0%B7%E6%B8%B2%E6%9F%93%E5%AF%B9%E9%BD%90-57%2F57%20%E4%BE%8B-brightgreen)](#%E4%B8%8E%E6%B4%9B%E8%B0%B7%E6%B8%B2%E6%9F%93%E7%9A%84%E5%B7%AE%E5%88%86%E5%AF%B9%E8%B4%A6)

> 左侧编辑，右侧实时预览，侧边栏洛谷语法工具箱 + 官方规范一键排版修复 —— 在 VSCode 里无缝获得洛谷 Markdown 编辑体验。

```
┌─────────────────────────────────────────────────┐
│  活动栏    │  VSCode 编辑器   │   预览面板       │
│  (洛谷      │  (Markdown       │   (渲染后的      │
│   图标)     │   源码编辑)      │    HTML 预览)    │
│            │                 │                  │
│  文本格式   │  # 标题         │   标题           │
│  代码       │  **粗体**       │   粗体           │
│  公式       │  $E=mc^2$       │   E=mc²         │
│  折叠框     │  :::info[标题]  │   渲染折叠框      │
│  表格       │  | a | b |      │   对齐表格        │
│  链接       │  [text](url)    │   可点击链接      │
│  模板       │                 │                  │
│  工具       │                 │                  │
└─────────────────────────────────────────────────┘
```

## 特性

### 渲染对齐洛谷（差分语料级对账）

- 自研渲染器严格对账洛谷现行编辑器（remark/rehype + remark-gfm + remark-math + remark-directive 管线，见[编辑器手册](https://www.luogu.com.cn/article/70w8j2pj)），57 例差分语料 **57/57 一致**
- KaTeX 公式三级匹配：块级 `$$`、整行 `$$x$$`、段内 `$$x$$`（行内），与洛谷语义一致
- GFM 全集：脚注 `[^n]`、裸 URL 自动链接（`https://…` / `www.…`）、单/双波浪删除线、任务列表、表格对齐、硬换行
- 洛谷扩展：`:::info|success|warning|error` 折叠框、`:::align{}`、`:::epigraph[落款]`、`::cute-table{tuack|three}`、Prism 代码高亮（未标注语言默认按 C++）
- 滚动同步、行号锚点、`data-src-line` 双向定位

### 排版修复与风格 lint

- 对照洛谷题解排版建议：句末补「。」（**逐行判定**）、行尾空格剥除（两空格硬换行除外）、ASCII 括号转全角、半角标点规范化、中英文间空格
- 题解正文「一句一行」时每行末尾都补「。」，延续标点结尾的行自动跳过
- 完整 CRLF 兼容：修复后文档原有的换行风格保持不动

### 编辑器端

- 侧边栏工具箱：插入洛谷语法、模板与片段
- 编辑区与预览区滚动同步（watchdog 防抖，用户滚动不被打断）
- 主题自适应（亮色/暗色）

## 安装

1. VSCode 扩展面板搜 `洛谷` 或 `wudream.luogu-markdown-editor`
2. 命令行：`code --install-extension wudream.luogu-markdown-editor`
3. 手动：[GitHub Releases](https://github.com/wudream813/LuoguMarkdownEditor-in-vscode/releases/latest) 下载 `.vsix` → `Extensions: Install from VSIX...`

## 侧边栏工具箱

左侧活动栏点洛谷图标打开：

| 分类 | 内容 |
|------|------|
| 文本格式 | 加粗 `Ctrl+B`、斜体 `Ctrl+I`、删除线 `~~x~~`，H1–H4 标题 |
| 代码 | 行内代码、代码块（可选行号、行高亮 `lines=…`） |
| 公式 | `$x$`、`$$…$$`（块级） |
| 折叠框 | `:::info[标题]` 等四色 |
| 表格对齐 | `::cute-table{tuack}`、`:::align{center}` |
| 链接/媒体 | `[text](url)`、`![](bilibili:BV号)`、任务列表 |
| 工具 | 一键排版修复、备份恢复 |

## 快捷键

编辑 Markdown 时可用与洛谷现行编辑器完全一致的快捷键（Mod = 非 mac `Ctrl` / macOS `⌘`）：

| 操作 | 快捷键 |
|------|--------|
| 提升/降低标题等级 | `Mod+Shift+↑` / `Mod+Shift+↓` |
| 加粗 / 斜体 / 删除线 | `Mod+B` / `Mod+I` / `Mod+D` |
| 数学公式（inline） | `Mod+M` |
| 水平线 | `Mod+Shift+H` |
| 插入链接 / 图片 | `Mod+Shift+L` / `Mod+Shift+I` |
| 插入引用 / 行内代码 / 表格 | `Mod+Shift+Q` / `Mod+Shift+1` / `Mod+Shift+2` |
| 无序 / 有序 / 任务列表 | `Mod+Shift+7` / `Mod+Shift+8` / `Mod+Shift+9` |

选中文本时，引用/列表/任务列表命令会把每一行转为对应行，而不是插入模板。

## 从源码开发

```bash
git clone https://github.com/wudream813/LuoguMarkdownEditor-in-vscode.git
cd LuoguMarkdownEditor-in-vscode
code .   # F5 调试
```

打包（生成 `luogu-markdown-editor-<ver>.vsix`）：

```bash
npx @vscode/vsce package --no-dependencies
```

### 仓库结构

```
├── extension.js / lint.js / style-lint.js   ← 扩展主进程（编辑/修复/lint/命令）
├── export-render.js                          ← vsce 打包时展开 media/**/* 供 webview 加载
├── media/
│   ├── luogu-parser.js                       ← 自研 markdown renderer（行号锚点 + 洛谷扩展语法）
│   ├── preview.js / preview.css / styles.css ← webview 预览渲染与主题
│   ├── sidebar-icon.svg / icon.png           ← 活动栏与缩略图
│   ├── katex/                                ← 静态打包的 KaTeX（离线可用）
│   └── prism/                                ← 静态打包的 Prism（默认 C++ 主题 + 行号/行高亮）
└── test-harness/                             ← 差分对账与回归（不进 vsix）
    ├── ref-render.js                         ← 洛谷基准渲染链（unified+remark 全家桶+rehype-katex）
    ├── test-diff.js                          ← 57 例语料对账（我们 vs 洛谷基准）
    ├── test-bugsweep.js                      ← 45 项对抗测试（泄漏/URL/CJK/CRLF/ReDoS/XSS/幂等）
    ├── test-fix.js / test-style.js / test-v111.js  ← 40+58+特性回归
    └── test-scroll*.js                        ← 滚动同步 watchdog 契约
```

### 开源自检

```bash
cd test-harness && npm install
node test-diff.js                 # 与洛谷基准对账：目标 57/57
node test-bugsweep.js             # 对抗性自检：45 项
node test-fix.js                  # 排版修复回归：42 项
node test-style.js                # 风格 lint 回归：58 项
node test-v111.js                 # v1.1.1 特性传承
node test-scroll.js && node test-scroll-reverse.js
```

## 与洛谷渲染的差异（已知超集，非差异）

未标注语言的代码块默认按 **C++ 高亮**：手册明确要求，超出裸 remark 行为。细节见差分语料中的 ACK 注释。

## 贡献

Issue / PR 欢迎。提交前请跑 `test-harness/` 全部测试；渲染层 PR 需保持差分回到 0 分叉（或写明 ACK）。

## 许可证

MIT © 2026 wudream
