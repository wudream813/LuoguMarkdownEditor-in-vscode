/**
 * Luogu Markdown Editor v1.0.1 - VSCode Extension
 * 
 * Architecture:
 * - Left: VSCode native text editor (Markdown source)
 * - Right: Webview preview panel (rendered HTML)
 * - Sidebar: Formatting toolbox (TreeView)
 */

const vscode = require('vscode');
const path = require('path');

// ────────────────────────────────────────────────────────────────
// Sidebar: Toolbox TreeDataProvider
// ────────────────────────────────────────────────────────────────

class ToolboxItem extends vscode.TreeItem {
  constructor(label, command, icon, description) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = command
      ? {
          command: command,
          title: label,
        }
      : undefined;
    this.iconPath = icon ? new vscode.ThemeIcon(icon) : undefined;
    this.description = description || '';
    this.tooltip = description ? `${label} → ${description}` : label;
  }
}

class ToolboxSection extends vscode.TreeItem {
  constructor(label, icon) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = icon ? new vscode.ThemeIcon(icon) : undefined;
    this.contextValue = 'section';
  }
}

class ToolboxProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      // Root sections
      return [
        new ToolboxSection('文本格式', 'symbol-text'),
        new ToolboxSection('代码与引用', 'code'),
        new ToolboxSection('数学公式', 'symbol-math'),
        new ToolboxSection('洛谷折叠框', 'package'),
        new ToolboxSection('表格与排版', 'table'),
        new ToolboxSection('多媒体与链接', 'link'),
      ];
    }

    const label = element.label;
    if (label === '文本格式') {
      return [
        new ToolboxItem('加粗 (Ctrl+B)', 'luogu-editor.insertBold', 'bold', '**text**'),
        new ToolboxItem('斜体 (Ctrl+I)', 'luogu-editor.insertItalic', 'italic', '*text*'),
        new ToolboxItem('删除线', 'luogu-editor.insertStrikethrough', 'close', '~~text~~'),
        new ToolboxItem('H1 一级标题', 'luogu-editor.insertHeading1', 'symbol-keyword', '# '),
        new ToolboxItem('H2 二级标题', 'luogu-editor.insertHeading2', 'symbol-keyword', '## '),
        new ToolboxItem('H3 三级标题', 'luogu-editor.insertHeading3', 'symbol-keyword', '### '),
        new ToolboxItem('H4 四级标题', 'luogu-editor.insertHeading4', 'symbol-keyword', '#### '),
      ];
    }
    if (label === '代码与引用') {
      return [
        new ToolboxItem('行内代码', 'luogu-editor.insertInlineCode', 'symbol-misc', '`code`'),
        new ToolboxItem('代码块', 'luogu-editor.insertCodeBlock', 'file-code', '```lang'),
        new ToolboxItem('引用区块', 'luogu-editor.insertQuote', 'quote', '> text'),
      ];
    }
    if (label === '数学公式') {
      return [
        new ToolboxItem('行内公式 $x$', 'luogu-editor.insertMathInline', 'symbol-number', '$...$'),
        new ToolboxItem('行间公式 $$ $$', 'luogu-editor.insertMathBlock', 'symbol-numeric', '$$...$$'),
      ];
    }
    if (label === '洛谷折叠框') {
      return [
        new ToolboxItem('📘 info 提示框', 'luogu-editor.insertCalloutInfo', 'info', ':::info'),
        new ToolboxItem('📗 success 成功框', 'luogu-editor.insertCalloutSuccess', 'pass', ':::success'),
        new ToolboxItem('📙 warning 警告框', 'luogu-editor.insertCalloutWarning', 'warning', ':::warning'),
        new ToolboxItem('📕 error 错误框', 'luogu-editor.insertCalloutError', 'error', ':::error'),
      ];
    }
    if (label === '表格与排版') {
      return [
        new ToolboxItem('插入表格', 'luogu-editor.insertTable', 'table', '|...|'),
        new ToolboxItem('引言块', 'luogu-editor.insertEpigraph', 'book', ':::epigraph'),
        new ToolboxItem('居中对齐', 'luogu-editor.insertAlignCenter', 'arrow-both', ':::align{center}'),
        new ToolboxItem('居右对齐', 'luogu-editor.insertAlignRight', 'arrow-right', ':::align{right}'),
      ];
    }
    if (label === '多媒体与链接') {
      return [
        new ToolboxItem('超链接', 'luogu-editor.insertLink', 'link', '[text](url)'),
        new ToolboxItem('图片', 'luogu-editor.insertImage', 'file-media', '![alt](url)'),
        new ToolboxItem('Bilibili 视频', 'luogu-editor.insertBilibili', 'device-camera-video', 'bilibili:BV'),
        new ToolboxItem('任务列表', 'luogu-editor.insertTaskList', 'checklist', '- [ ] task'),
        new ToolboxItem('分割线', 'luogu-editor.insertHR', 'dash', '---'),
      ];
    }
    return [];
  }
}

// ────────────────────────────────────────────────────────────────
// Sidebar: Templates TreeDataProvider
// ────────────────────────────────────────────────────────────────

class TemplatesProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      return [
        new ToolboxSection('洛谷模板', 'file-text'),
        new ToolboxSection('工具', 'tools'),
      ];
    }

    if (element.label === '洛谷模板') {
      return [
        new ToolboxItem('🌟 语法全特性演示', 'luogu-editor.insertTemplateDemo', 'star-full'),
        new ToolboxItem('🏆 标准题解模板', 'luogu-editor.insertTemplateSolution', 'trophy'),
        new ToolboxItem('📝 题目题面模板', 'luogu-editor.insertTemplateProblem', 'edit'),
        new ToolboxItem('📚 学术/文章专栏', 'luogu-editor.insertTemplateArticle', 'library'),
      ];
    }
    if (element.label === '工具') {
      return [
        new ToolboxItem('⚡ 一键排版修复', 'luogu-editor.autoFixSpacing', 'zap'),
        new ToolboxItem('📋 复制 Markdown 源码', 'luogu-editor.copyMarkdown', 'copy'),
      ];
    }
    return [];
  }
}

// ────────────────────────────────────────────────────────────────
// Preview Panel (Webview - right side, preview only)
// ────────────────────────────────────────────────────────────────

class PreviewPanel {
  static instance = null;

  static createOrShow(context) {
    const column = vscode.ViewColumn.Beside;

    if (PreviewPanel.instance) {
      PreviewPanel.instance.panel.reveal(column);
      return PreviewPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      'luogu-preview',
      '洛谷 Markdown 预览',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
      }
    );

    PreviewPanel.instance = new PreviewPanel(panel, context);
    return PreviewPanel.instance;
  }

  constructor(panel, context) {
    this.panel = panel;
    this.context = context;
    this.disposables = [];

    this.panel.webview.html = this._getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Initial content from active editor
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      this.update(editor.document.getText());
    }
  }

  update(markdownContent) {
    if (!this.panel) return;
    this.panel.webview.postMessage({
      type: 'update',
      content: markdownContent,
    });
  }

  dispose() {
    PreviewPanel.instance = null;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop().dispose();
    }
  }

  _getHtml() {
    const webview = this.panel.webview;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const uri = (f) => webview.asWebviewUri(vscode.Uri.joinPath(media, f));
    const nonce = getNonce();
    const csp = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${csp}; img-src ${csp} https: data:;">
  <title>洛谷 Markdown 预览</title>
  <link rel="stylesheet" href="${uri('katex/katex.min.css')}">
  <link rel="stylesheet" href="${uri('prism/prism-tomorrow.min.css')}">
  <link rel="stylesheet" href="${uri('styles.css')}">
  <link rel="stylesheet" href="${uri('preview.css')}">
</head>
<body>
  <div id="previewContent" class="preview-content luogu-preview-root"></div>
  <div id="toastContainer" class="toast-container"></div>

  <script nonce="${nonce}" src="${uri('katex/katex.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-c.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-cpp.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-python.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-java.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-pascal.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('luogu-parser.js')}"></script>
  <script nonce="${nonce}" src="${uri('preview.js')}"></script>
</body>
</html>`;
  }
}

// ────────────────────────────────────────────────────────────────
// Text Insertion Helpers
// ────────────────────────────────────────────────────────────────

async function insertTextAtCursor(text) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
    return;
  }
  await editor.edit((editBuilder) => {
    editBuilder.insert(editor.selection.active, text);
  });
}

async function wrapSelectionOrInsert(prefix, suffix, placeholder) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
    return;
  }
  await editor.edit((editBuilder) => {
    const sel = editor.selection;
    const selected = editor.document.getText(sel);
    const text = selected || placeholder;
    editBuilder.replace(sel, prefix + text + suffix);
  });
}

async function replaceAllContent(text) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length)
  );
  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, text);
  });
}

// ────────────────────────────────────────────────────────────────
// Activation
// ────────────────────────────────────────────────────────────────

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('洛谷 Markdown 编辑器 v1.0.1 已激活');

  // ── Sidebar: Toolbox ──
  const toolboxProvider = new ToolboxProvider();
  vscode.window.registerTreeDataProvider('luogu-editor.toolbox', toolboxProvider);

  // ── Sidebar: Templates ──
  const templatesProvider = new TemplatesProvider();
  vscode.window.registerTreeDataProvider('luogu-editor.templates', templatesProvider);

  // ── Command: Open Preview ──
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.openPreview', () => {
      const preview = PreviewPanel.createOrShow(context);
      // Send current content
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'markdown') {
        preview.update(editor.document.getText());
      }
    })
  );

  // ── Command: Close Preview ──
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.closePreview', () => {
      if (PreviewPanel.instance) {
        PreviewPanel.instance.dispose();
      }
    })
  );

  // ── Auto-sync: text changes → preview ──
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (
        e.document.languageId === 'markdown' &&
        PreviewPanel.instance
      ) {
        PreviewPanel.instance.update(e.document.getText());
      }
    })
  );

  // ── Auto-open preview when opening a markdown file ──
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (
        editor &&
        editor.document.languageId === 'markdown' &&
        PreviewPanel.instance
      ) {
        PreviewPanel.instance.update(editor.document.getText());
      }
    })
  );

  // ── Formatting Commands ──
  const registerCmd = (id, fn) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  // Text formatting
  registerCmd('luogu-editor.insertBold', () => wrapSelectionOrInsert('**', '**', '加粗文本'));
  registerCmd('luogu-editor.insertItalic', () => wrapSelectionOrInsert('*', '*', '斜体文本'));
  registerCmd('luogu-editor.insertStrikethrough', () => wrapSelectionOrInsert('~~', '~~', '删除线文本'));
  registerCmd('luogu-editor.insertHeading1', () => insertTextAtCursor('\n# 一级标题\n'));
  registerCmd('luogu-editor.insertHeading2', () => insertTextAtCursor('\n## 二级标题\n'));
  registerCmd('luogu-editor.insertHeading3', () => insertTextAtCursor('\n### 三级标题\n'));
  registerCmd('luogu-editor.insertHeading4', () => insertTextAtCursor('\n#### 四级标题\n'));

  // Code & Quote
  registerCmd('luogu-editor.insertInlineCode', () => wrapSelectionOrInsert('`', '`', 'code'));
  registerCmd('luogu-editor.insertCodeBlock', async () => {
    const lang = await vscode.window.showQuickPick(
      ['cpp', 'c', 'python', 'java', 'pascal', 'rust', 'go', 'plain'],
      { placeHolder: '选择编程语言' }
    );
    if (lang) {
      insertTextAtCursor(`\n\`\`\`${lang} line-numbers\n// 在此编写代码\n\`\`\`\n`);
    }
  });
  registerCmd('luogu-editor.insertQuote', () => insertTextAtCursor('\n> 引用内容\n'));

  // Math
  registerCmd('luogu-editor.insertMathInline', () => wrapSelectionOrInsert('$', '$', 'x'));
  registerCmd('luogu-editor.insertMathBlock', () => insertTextAtCursor('\n$$\n\\sum_{i=1}^n a_i = S_n\n$$\n'));

  // Callouts
  registerCmd('luogu-editor.insertCalloutInfo', () => insertCallout('info'));
  registerCmd('luogu-editor.insertCalloutSuccess', () => insertCallout('success'));
  registerCmd('luogu-editor.insertCalloutWarning', () => insertCallout('warning'));
  registerCmd('luogu-editor.insertCalloutError', () => insertCallout('error'));

  // Table & Layout
  registerCmd('luogu-editor.insertTable', () => {
    insertTextAtCursor(
      '\n::cute-table{tuack}\n\n| 标题 1 | 标题 2 | 标题 3 |\n| :---: | :---: | :---: |\n| 数据 | 数据 | 数据 |\n| 数据 | 数据 | 数据 |\n'
    );
  });
  registerCmd('luogu-editor.insertEpigraph', () => {
    insertTextAtCursor('\n:::epigraph[——作者]\n千里之行，始于足下。\n:::\n');
  });
  registerCmd('luogu-editor.insertAlignCenter', () => {
    insertTextAtCursor('\n:::align{center}\n居中内容\n:::\n');
  });
  registerCmd('luogu-editor.insertAlignRight', () => {
    insertTextAtCursor('\n:::align{right}\n居右内容\n:::\n');
  });

  // Media & Links
  registerCmd('luogu-editor.insertLink', async () => {
    const url = await vscode.window.showInputBox({ prompt: '输入链接 URL', value: 'https://' });
    if (url) {
      wrapSelectionOrInsert('[', `](${url})`, '链接文本');
    }
  });
  registerCmd('luogu-editor.insertImage', async () => {
    const url = await vscode.window.showInputBox({ prompt: '输入图片 URL' });
    if (url) {
      const alt = await vscode.window.showInputBox({ prompt: '图片描述', value: '图片' });
      insertTextAtCursor(`![${alt || '图片'}](${url})`);
    }
  });
  registerCmd('luogu-editor.insertBilibili', async () => {
    const bv = await vscode.window.showInputBox({ prompt: '输入 BV 号或 AV 号', placeHolder: 'BV1GJ411x7h7' });
    if (bv) {
      insertTextAtCursor(`\n![](bilibili:${bv})\n`);
    }
  });
  registerCmd('luogu-editor.insertTaskList', () => {
    insertTextAtCursor('\n- [ ] 未完成任务\n- [x] 已完成任务\n');
  });
  registerCmd('luogu-editor.insertHR', () => insertTextAtCursor('\n---\n'));

  // Templates
  registerCmd('luogu-editor.insertTemplateDemo', () => {
    if (typeof LuoguTemplates !== 'undefined') {
      replaceAllContent(LuoguTemplates.demo);
    } else {
      insertTemplateFromFile('demo');
    }
  });
  registerCmd('luogu-editor.insertTemplateSolution', () => insertTemplateFromFile('solution'));
  registerCmd('luogu-editor.insertTemplateProblem', () => insertTemplateFromFile('problem'));
  registerCmd('luogu-editor.insertTemplateArticle', () => insertTemplateFromFile('article'));

  // Tools
  registerCmd('luogu-editor.copyMarkdown', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      vscode.env.clipboard.writeText(editor.document.getText());
      vscode.window.showInformationMessage('✅ 已复制洛谷 Markdown 源码！');
    }
  });

  registerCmd('luogu-editor.autoFixSpacing', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
      return;
    }
    // Load linter from media
    const linterPath = path.join(context.extensionUri.fsPath, 'media', 'luogu-linter.js');
    try {
      // Simple inline linter for spacing
      const text = editor.document.getText();
      const fixed = fixSpacing(text);
      if (text !== fixed) {
        replaceAllContent(fixed);
        vscode.window.showInformationMessage('✅ 已完成排版规范修复！');
      } else {
        vscode.window.showInformationMessage('✨ 排版已完全符合规范！');
      }
    } catch (e) {
      vscode.window.showErrorMessage('排版修复失败：' + e.message);
    }
  });
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function insertCallout(type) {
  const title = await vscode.window.showInputBox({
    prompt: `输入 ${type} 折叠框标题`,
    value: type === 'info' ? '提示' : type === 'success' ? '成功' : type === 'warning' ? '注意' : '错误',
  });
  const isOpen = await vscode.window.showQuickPick(
    [{ label: '默认折叠', value: false }, { label: '默认展开 {open}', value: true }],
    { placeHolder: '折叠框默认状态' }
  );
  const openStr = isOpen && isOpen.value ? '{open}' : '';
  const titleStr = title ? `[${title}]` : '';
  insertTextAtCursor(
    `\n::::${type}${titleStr}${openStr}\n这里是${type}折叠框的内容。\n::::\n`
  );
}

async function insertTemplateFromFile(key) {
  // Try to load templates from the media file
  try {
    const fs = require('fs');
    const tplPath = path.join(
      vscode.extensions.getExtension('wudream813.luogu-markdown-editor')
        ? vscode.extensions.getExtension('wudream813.luogu-markdown-editor').extensionPath
        : __dirname,
      'media',
      'luogu-templates.js'
    );
    // Read and eval the templates (safe - our own file)
    const code = fs.readFileSync(tplPath, 'utf8');
    const module = { exports: {} };
    const fn = new Function('module', 'exports', code);
    fn(module, module.exports);
    const templates = module.exports.LuoguTemplates || module.exports;
    if (templates[key]) {
      const confirm = await vscode.window.showWarningMessage(
        '应用模板将替换当前文件全部内容，是否继续？',
        '确定',
        '取消'
      );
      if (confirm === '确定') {
        replaceAllContent(templates[key]);
        vscode.window.showInformationMessage('✅ 模板应用成功！');
      }
    }
  } catch (e) {
    // Fallback: insert a basic template
    const fallbacks = {
      solution: '# 题解标题\n\n## 思路分析\n\n在此描述解题思路……\n\n## 代码实现\n\n::::info[代码实现]{open}\n```cpp line-numbers\n#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n```\n::::\n\n## 复杂度分析\n\n- 时间复杂度：$\\mathcal{O}(n)$\n- 空间复杂度：$\\mathcal{O}(n)$\n',
      problem: '# 题目名称\n\n## 题目描述\n\n在此描述题目……\n\n## 输入格式\n\n第一行一个整数 $n$。\n\n## 输出格式\n\n输出一行一个整数。\n\n## 样例\n\n::cute-table{tuack}\n\n| 输入 | 输出 |\n| :---: | :---: |\n| `1` | `1` |\n\n## 数据范围\n\n::cute-table{tuack}\n\n| 测试点 | $n$ 范围 |\n| :---: | :---: |\n| $1 \\sim 5$ | $n \\le 10^5$ |\n',
      article: '# 文章标题\n\n:::epigraph[——作者]\n引言内容。\n:::\n\n## 引言\n\n在此编写文章内容……\n\n## 正文\n\n### 第一节\n\n内容……\n\n## 总结\n\n总结内容……\n',
      demo: '# 洛谷 Markdown 全特性演示\n\n这是一段包含 **粗体**、*斜体*、`行内代码` 和 $LaTeX$ 公式的文本。\n\n## 数学公式\n\n行内公式：$E = mc^2$\n\n行间公式：\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n\n## 代码块\n\n```cpp line-numbers\n#include <iostream>\nint main() {\n    std::cout << "Hello Luogu!" << std::endl;\n    return 0;\n}\n```\n',
    };
    const tpl = fallbacks[key] || '# 新文档\n\n在此开始编写……\n';
    const confirm = await vscode.window.showWarningMessage(
      '应用模板将替换当前文件全部内容，是否继续？',
      '确定',
      '取消'
    );
    if (confirm === '确定') {
      replaceAllContent(tpl);
      vscode.window.showInformationMessage('✅ 模板应用成功！');
    }
  }
}

/**
 * Simple spacing fixer: adds spaces between CJK and ASCII/LaTeX
 */
function fixSpacing(text) {
  // Protect code blocks and math blocks
  const blocks = [];
  let idx = 0;

  // Extract fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    const key = `\x00CODE${idx++}\x00`;
    blocks.push({ key, val: m });
    return key;
  });

  // Extract inline code
  text = text.replace(/`[^`]+`/g, (m) => {
    const key = `\x00CODE${idx++}\x00`;
    blocks.push({ key, val: m });
    return key;
  });

  // Extract display math
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (m) => {
    const key = `\x00CODE${idx++}\x00`;
    blocks.push({ key, val: m });
    return key;
  });

  // Extract inline math
  text = text.replace(/\$[^\$\n]+?\$/g, (m) => {
    const key = `\x00CODE${idx++}\x00`;
    blocks.push({ key, val: m });
    return key;
  });

  // Add space: CJK → ASCII/digit
  text = text.replace(/([\u4e00-\u9fff\u3400-\u4dbf])([A-Za-z0-9])/g, '$1 $2');
  // Add space: ASCII/digit → CJK
  text = text.replace(/([A-Za-z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1 $2');
  // Add space: CJK → LaTeX placeholder (starts with \x00CODE)
  text = text.replace(/([\u4e00-\u9fff\u3400-\u4dbf])(\x00CODE)/g, '$1 $2');
  // Add space: LaTeX placeholder end → CJK
  text = text.replace(/(\x00CODE0*)([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1 $2');

  // Remove double spaces introduced by the above
  text = text.replace(/  +/g, ' ');

  // Restore blocks
  for (const b of blocks) {
    text = text.replace(b.key, b.val);
  }

  return text;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function deactivate() {}

module.exports = { activate, deactivate };
