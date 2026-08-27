# 洛谷 Markdown Editor - VSCode 扩展 v1.0.1

> 左侧编辑，右侧预览，侧边栏工具箱 — 无缝集成洛谷 Markdown 编辑体验

## ✨ v1.0.1 新架构

```
┌─────────────────────────────────────────────────┐
│  活动栏   │  VSCode 编辑器  │   预览面板         │
│  (洛谷     │  (Markdown     │   (渲染后的        │
│   图标)    │   源码编辑)    │    HTML 预览)      │
│           │                │                    │
│ 📝 文本格式│  # 标题        │   标题             │
│  ├ 加粗    │  **粗体**      │   粗体             │
│  ├ 斜体    │  $E=mc^2$     │   E=mc²           │
│  └ 删除线  │                │                    │
│ 💻 代码    │                │                    │
│ 📐 公式    │                │                    │
│ 📦 折叠框  │                │                    │
│ 📊 表格    │                │                    │
│ 🔗 链接    │                │                    │
│           │                │                    │
│ 📚 模板    │                │                    │
│ 🛠️ 工具    │                │                    │
└─────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 安装
1. 从 [Release](https://github.com/wudream813/LuoguMarkdownEditor-in-vscode/releases) 下载 `.vsix` 文件
2. VSCode 中 `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

### 使用
1. 打开任意 `.md` 文件
2. 点击编辑器标题栏的 **预览图标** (👁) 打开右侧预览面板
3. 点击左侧活动栏的 **洛谷 Markdown 图标** 打开格式工具箱
4. 在编辑器中编写 Markdown，右侧实时预览
5. 点击侧边栏工具箱中的项目快速插入洛谷语法

## 📦 侧边栏工具箱

### 📝 文本格式
| 工具 | 快捷键 | 语法 |
|------|--------|------|
| 加粗 | Ctrl+B | `**text**` |
| 斜体 | Ctrl+I | `*text*` |
| 删除线 | - | `~~text~~` |
| H1-H4 标题 | - | `# ` ~ `#### ` |

### 💻 代码与引用
| 工具 | 语法 |
|------|------|
| 行内代码 | `` `code` `` |
| 代码块 | ` ```lang line-numbers` |
| 引用 | `> text` |

### 📐 数学公式
| 工具 | 语法 |
|------|------|
| 行内公式 | `$x$` |
| 行间公式 | `$$\sum$$` |

### 📦 洛谷折叠框
| 工具 | 语法 |
|------|------|
| 📘 info | `:::info[标题]` |
| 📗 success | `:::success[标题]` |
| 📙 warning | `:::warning[标题]` |
| 📕 error | `:::error[标题]` |

### 📊 表格与排版
| 工具 | 语法 |
|------|------|
| 表格 | `::cute-table{tuack}` + 表格 |
| 引言 | `:::epigraph[落款]` |
| 居中 | `:::align{center}` |
| 居右 | `:::align{right}` |

### 🔗 多媒体与链接
| 工具 | 语法 |
|------|------|
| 链接 | `[text](url)` |
| 图片 | `![alt](url)` |
| Bilibili | `![](bilibili:BV号)` |
| 任务列表 | `- [ ] task` |
| 分割线 | `---` |

## 🔧 开发

```bash
git clone https://github.com/wudream813/LuoguMarkdownEditor-in-vscode.git
cd LuoguMarkdownEditor-in-vscode
# 在 VSCode 中打开，按 F5 调试运行
```

## 📝 许可证

MIT License
