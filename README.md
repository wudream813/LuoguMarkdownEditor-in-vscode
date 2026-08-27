# 洛谷 Markdown Editor - VSCode 扩展

> 将洛谷 Markdown & KaTeX 实时预览编辑器集成到 Visual Studio Code 中

## ✨ 功能特性

### 核心编辑器
- **100% 洛谷 Markdown 语法支持**：完整支持洛谷帮助中心的全部扩展语法
- **KaTeX 数学公式**：行内公式 `$x$` 与行间公式 `$$\sum$$`
- **Prism.js 代码高亮**：支持 C++, Python, Java, Pascal 等多种语言
- **双向同步滚动**：编辑区与预览区智能同步
- **实时预览**：所见即所得的 Markdown 渲染

### 洛谷扩展语法
- **折叠框**：`:::info` / `:::success` / `:::warning` / `:::error`
- **表格合并**：`^` 向上合并，`<` 向左合并
- **Tuack 竞赛风格表格**：`::cute-table{tuack}`
- **引言块**：`:::epigraph[落款]`
- **居中/居右排版**：`:::align{center}` / `:::align{right}`
- **Bilibili 视频嵌入**：`![](bilibili:BV号)`
- **代码块行号与高亮**：` ```cpp line-numbers lines=5-6`

### VSCode 集成
- **与 VSCode 编辑器双向同步**：在 VSCode 中编辑 .md 文件，预览面板实时更新
- **一键保存**：Ctrl+S 直接保存到 VSCode 工作区
- **多种打开方式**：
  - 在编辑器标题栏点击预览按钮
  - 右键菜单 → "洛谷 Markdown: 在侧边打开预览"
  - 命令面板搜索 "洛谷 Markdown"
- **排版规范检查**：内置洛谷排版 Linter，一键修复中英文空格
- **洛谷官方模板**：题解模板、题面模板、学术文章模板

### 辅助功能
- **LaTeX 公式面板**：速查希腊字母、运算符、矩阵等
- **可视化表格生成器**：支持单元格合并的表格设计器
- **多主题**：亮色 / 暗色主题切换
- **文档统计**：行数、字数、公式数、阅读时间
- **一键复制**：复制洛谷标准 Markdown，直接粘贴发布

## 📦 安装

### 从 VSIX 安装
1. 下载 `.vsix` 文件
2. 在 VSCode 中：`Ctrl+Shift+P` → "Extensions: Install from VSIX..."
3. 选择下载的 `.vsix` 文件

### 手动安装（开发）
```bash
git clone https://github.com/wudream813/LuoguMarkdownEditor-in-vscode.git
cd LuoguMarkdownEditor-in-vscode
# 在 VSCode 中打开此文件夹，按 F5 调试运行
```

## 🚀 使用方法

### 方式一：侧边预览（推荐）
1. 在 VSCode 中打开任意 `.md` 文件
2. 点击编辑器右上角的预览图标，或使用命令 `洛谷 Markdown: 在侧边打开预览`
3. 编辑 Markdown 源码，右侧面板实时渲染

### 方式二：自定义编辑器
1. 右键点击 `.md` 文件 → "打开方式..." → "洛谷 Markdown 预览"
2. 将以洛谷编辑器的方式打开文件

### 方式三：命令面板
- `Ctrl+Shift+P` → 输入 `洛谷 Markdown` 查看所有可用命令

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存到 VSCode 文件 |
| `Ctrl + B` | 加粗文本 |
| `Ctrl + I` | 斜体文本 |
| `Ctrl + K` | 插入链接 |
| `Ctrl + Shift + K` | 插入行内公式 |
| `Ctrl + Shift + M` | 插入行间公式 |
| `Ctrl + Z / Y` | 撤销 / 重做 |
| `Tab / Shift+Tab` | 增加 / 减少缩进 |

## ⚙️ 配置项

在 VSCode 设置中搜索 `luogu-editor`：

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `luogu-editor.theme` | `light` | 预览主题（亮色/暗色） |
| `luogu-editor.autoSync` | `true` | 编辑时自动同步到预览 |
| `luogu-editor.autoFixSpacing` | `false` | 保存时自动修复排版空格 |

## 📂 项目结构

```
LuoguMarkdownEditor-in-vscode/
├── package.json              # 扩展清单
├── extension.js              # 扩展入口 (命令、编辑器提供者)
├── media/                    # Webview 资源
│   ├── katex/                # KaTeX 数学渲染库
│   ├── prism/                # Prism.js 代码高亮
│   ├── luogu-parser.js       # 洛谷 Markdown 解析引擎
│   ├── luogu-linter.js       # 排版规范检查器
│   ├── luogu-math-cheatsheet.js # LaTeX 公式速查
│   ├── luogu-templates.js    # 洛谷官方模板
│   ├── editor.js             # 编辑器核心逻辑
│   ├── styles.css            # 洛谷风格样式
│   ├── vscode.css            # VSCode 适配样式
│   └── vscode-bridge.js      # VSCode 通信桥接
├── .vscodeignore
├── CHANGELOG.md
└── README.md
```

## 🔧 开发

```bash
# 克隆仓库
git clone https://github.com/wudream813/LuoguMarkdownEditor-in-vscode.git

# 在 VSCode 中打开
code LuoguMarkdownEditor-in-vscode

# 按 F5 启动扩展开发宿主
# 在新打开的 VSCode 窗口中打开一个 .md 文件测试
```

## 📝 许可证

MIT License

## 🔗 相关链接

- [原始项目：洛谷 Markdown 编辑器](https://github.com/wudream813/luogu-markdown-editor)
- [洛谷帮助中心](https://www.luogu.com.cn/help)
- [KaTeX 文档](https://katex.org/)
