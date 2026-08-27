/**
 * Luogu Markdown Editor v1.0.7 - VSCode Extension
 */

const vscode = require('vscode');
const path = require('path');

// ────────────────────────────────────────────────────────────────
// Sidebar
// ────────────────────────────────────────────────────────────────

class ToolboxItem extends vscode.TreeItem {
  constructor(label, command, icon, description) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = command ? { command, title: label } : undefined;
    this.iconPath = icon ? new vscode.ThemeIcon(icon) : undefined;
    this.description = description || '';
    this.tooltip = description ? `${label} -> ${description}` : label;
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
  getTreeItem(el) { return el; }
  getChildren(element) {
    if (!element) {
      return [
        new ToolboxSection('文本格式', 'symbol-text'),
        new ToolboxSection('代码与引用', 'code'),
        new ToolboxSection('数学公式', 'symbol-math'),
        new ToolboxSection('洛谷折叠框', 'package'),
        new ToolboxSection('表格与排版', 'table'),
        new ToolboxSection('多媒体与链接', 'link'),
      ];
    }
    const l = element.label;
    if (l === '文本格式') return [
      new ToolboxItem('加粗', 'luogu-editor.insertBold', 'bold', '**text**'),
      new ToolboxItem('斜体', 'luogu-editor.insertItalic', 'italic', '*text*'),
      new ToolboxItem('删除线', 'luogu-editor.insertStrikethrough', 'close', '~~text~~'),
      new ToolboxItem('H1 标题', 'luogu-editor.insertHeading1', 'symbol-keyword', '# '),
      new ToolboxItem('H2 标题', 'luogu-editor.insertHeading2', 'symbol-keyword', '## '),
      new ToolboxItem('H3 标题', 'luogu-editor.insertHeading3', 'symbol-keyword', '### '),
      new ToolboxItem('H4 标题', 'luogu-editor.insertHeading4', 'symbol-keyword', '#### '),
    ];
    if (l === '代码与引用') return [
      new ToolboxItem('行内代码', 'luogu-editor.insertInlineCode', 'symbol-misc', '`code`'),
      new ToolboxItem('代码块', 'luogu-editor.insertCodeBlock', 'file-code', '```lang'),
      new ToolboxItem('引用区块', 'luogu-editor.insertQuote', 'quote', '> text'),
    ];
    if (l === '数学公式') return [
      new ToolboxItem('行内公式 $x$', 'luogu-editor.insertMathInline', 'symbol-number', '$...$'),
      new ToolboxItem('行间公式 $$ $$', 'luogu-editor.insertMathBlock', 'symbol-numeric', '$$...$$'),
    ];
    if (l === '洛谷折叠框') return [
      new ToolboxItem('info 提示框', 'luogu-editor.insertCalloutInfo', 'info', ':::info'),
      new ToolboxItem('success 成功框', 'luogu-editor.insertCalloutSuccess', 'pass', ':::success'),
      new ToolboxItem('warning 警告框', 'luogu-editor.insertCalloutWarning', 'warning', ':::warning'),
      new ToolboxItem('error 错误框', 'luogu-editor.insertCalloutError', 'error', ':::error'),
    ];
    if (l === '表格与排版') return [
      new ToolboxItem('插入表格', 'luogu-editor.insertTable', 'table', '|...|'),
      new ToolboxItem('引言块', 'luogu-editor.insertEpigraph', 'book', ':::epigraph'),
      new ToolboxItem('居中对齐', 'luogu-editor.insertAlignCenter', 'arrow-both', ':::align{center}'),
      new ToolboxItem('居右对齐', 'luogu-editor.insertAlignRight', 'arrow-right', ':::align{right}'),
    ];
    if (l === '多媒体与链接') return [
      new ToolboxItem('超链接', 'luogu-editor.insertLink', 'link', '[text](url)'),
      new ToolboxItem('图片', 'luogu-editor.insertImage', 'file-media', '![alt](url)'),
      new ToolboxItem('Bilibili 视频', 'luogu-editor.insertBilibili', 'device-camera-video', 'bilibili:BV'),
      new ToolboxItem('任务列表', 'luogu-editor.insertTaskList', 'checklist', '- [ ] task'),
      new ToolboxItem('分割线', 'luogu-editor.insertHR', 'dash', '---'),
    ];
    return [];
  }
}

class TemplatesProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }
  getTreeItem(el) { return el; }
  getChildren(element) {
    if (!element) {
      return [
        new ToolboxSection('洛谷模板', 'file-text'),
        new ToolboxSection('工具', 'tools'),
      ];
    }
    if (element.label === '洛谷模板') return [
      new ToolboxItem('语法全特性演示', 'luogu-editor.insertTemplateDemo', 'star-full'),
      new ToolboxItem('标准题解模板', 'luogu-editor.insertTemplateSolution', 'trophy'),
      new ToolboxItem('题目题面模板', 'luogu-editor.insertTemplateProblem', 'edit'),
      new ToolboxItem('学术/文章专栏', 'luogu-editor.insertTemplateArticle', 'library'),
    ];
    if (element.label === '工具') return [
      new ToolboxItem('一键排版修复', 'luogu-editor.autoFixSpacing', 'zap'),
      new ToolboxItem('复制 Markdown 源码', 'luogu-editor.copyMarkdown', 'copy'),
      new ToolboxItem('切换亮/暗主题', 'luogu-editor.toggleTheme', 'color-mode'),
    ];
    return [];
  }
}

// ────────────────────────────────────────────────────────────────
// Preview Panel
// ────────────────────────────────────────────────────────────────

class PreviewPanel {
  static instance = null;

  static createOrShow(context) {
    if (PreviewPanel.instance) {
      PreviewPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return PreviewPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      'luogu-preview', 'Luogu Markdown 预览', vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] }
    );
    PreviewPanel.instance = new PreviewPanel(panel, context);
    return PreviewPanel.instance;
  }

  constructor(panel, context) {
    this.panel = panel;
    this.context = context;
    this.disposables = [];
    this.currentTheme = 'light';
    this.panel.webview.html = this._getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'ready') {
        // Webview finished loading, send initial content + scroll
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
          this.update(editor.document.getText());
          setTimeout(() => {
            const topRange = editor.visibleRanges[0];
            if (topRange) this.scrollSync(topRange.start.line);
          }, 300);
        }
      }
    }, null, this.disposables);
  }

  update(content) {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: 'update', content });
  }

  scrollSync(topLine) {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: 'scroll-sync', topLine });
  }

  setTheme(theme) {
    this.currentTheme = theme;
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: 'set-theme', theme });
  }

  dispose() {
    PreviewPanel.instance = null;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop().dispose();
  }

  _getHtml() {
    const wv = this.panel.webview;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const u = (f) => wv.asWebviewUri(vscode.Uri.joinPath(media, f));
    const csp = wv.cspSource;

    return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src ${csp} 'unsafe-inline'; font-src ${csp}; img-src ${csp} https: data:; frame-src https://player.bilibili.com https: http:; media-src https: http:;">
  <title>Luogu Preview</title>
  <link rel="stylesheet" href="${u('katex/katex.min.css')}">
  <link rel="stylesheet" href="${u('prism/prism-tomorrow.min.css')}">
  <link rel="stylesheet" href="${u('styles.css')}">
  <link rel="stylesheet" href="${u('preview.css')}">
</head>
<body>
  <div id="previewContent" class="preview-content luogu-preview-root"></div>
  <script src="${u('katex/katex.min.js')}"></script>
  <script src="${u('prism/prism.js')}"></script>
  <script src="${u('prism/prism-c.min.js')}"></script>
  <script src="${u('prism/prism-cpp.min.js')}"></script>
  <script src="${u('prism/prism-python.min.js')}"></script>
  <script src="${u('prism/prism-java.min.js')}"></script>
  <script src="${u('prism/prism-pascal.min.js')}"></script>
  <script src="${u('luogu-parser.js')}"></script>
  <script src="${u('preview.js')}"></script>
</body>
</html>`;
  }
}

// ────────────────────────────────────────────────────────────────
// Text helpers
// ────────────────────────────────────────────────────────────────

async function insertTextAtCursor(text) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage('请先打开一个 Markdown 文件'); return; }
  await editor.edit((eb) => eb.insert(editor.selection.active, text));
}

async function wrapSelectionOrInsert(prefix, suffix, placeholder) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage('请先打开一个 Markdown 文件'); return; }
  await editor.edit((eb) => {
    const sel = editor.selection;
    const selected = editor.document.getText(sel);
    eb.replace(sel, prefix + (selected || placeholder) + suffix);
  });
}

async function replaceAllContent(text) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  await editor.edit((eb) => eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), text));
}

// ────────────────────────────────────────────────────────────────
// Activate
// ────────────────────────────────────────────────────────────────

function activate(context) {
  // Sidebar
  vscode.window.registerTreeDataProvider('luogu-editor.toolbox', new ToolboxProvider());
  vscode.window.registerTreeDataProvider('luogu-editor.templates', new TemplatesProvider());

  // Scroll sync helper
  let scrollTimeout = null;
  function doScrollSync(editor) {
    if (!PreviewPanel.instance || !editor) return;
    const r = editor.visibleRanges[0];
    if (r) PreviewPanel.instance.scrollSync(r.start.line);
  }

  // Open preview
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.openPreview', () => {
      const preview = PreviewPanel.createOrShow(context);
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'markdown') {
        preview.update(editor.document.getText());
      }
    })
  );

  // Close preview
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.closePreview', () => {
      if (PreviewPanel.instance) PreviewPanel.instance.dispose();
    })
  );

  // Text changes -> update preview + re-sync scroll
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'markdown' && PreviewPanel.instance) {
        PreviewPanel.instance.update(e.document.getText());
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === e.document) {
          setTimeout(() => doScrollSync(editor), 150);
        }
      }
    })
  );

  // Active editor change -> update preview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === 'markdown' && PreviewPanel.instance) {
        PreviewPanel.instance.update(editor.document.getText());
      }
    })
  );

  // Editor scroll -> preview scroll
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (e.textEditor.document.languageId === 'markdown' && PreviewPanel.instance) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => doScrollSync(e.textEditor), 16);
      }
    })
  );

  // Cursor movement -> also sync scroll (backup trigger)
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor.document.languageId === 'markdown' && PreviewPanel.instance) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => doScrollSync(e.textEditor), 16);
      }
    })
  );

  // Theme toggle
  let currentTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
  // Send initial theme to preview when it opens
  const origCreateOrShow = PreviewPanel.createOrShow;
  PreviewPanel.createOrShow = function(ctx) {
    const p = origCreateOrShow.call(this, ctx);
    p.setTheme(currentTheme);
    return p;
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.toggleTheme', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      if (PreviewPanel.instance) PreviewPanel.instance.setTheme(currentTheme);
      vscode.window.showInformationMessage(`预览主题: ${currentTheme === 'light' ? '亮色' : '暗色'}`);
    })
  );
  // Follow VSCode theme changes automatically
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      currentTheme = theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
      if (PreviewPanel.instance) PreviewPanel.instance.setTheme(currentTheme);
    })
  );

  // Register commands
  const reg = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('luogu-editor.insertBold', () => wrapSelectionOrInsert('**', '**', '加粗文本'));
  reg('luogu-editor.insertItalic', () => wrapSelectionOrInsert('*', '*', '斜体文本'));
  reg('luogu-editor.insertStrikethrough', () => wrapSelectionOrInsert('~~', '~~', '删除线'));
  reg('luogu-editor.insertHeading1', () => insertTextAtCursor('\n# 标题\n'));
  reg('luogu-editor.insertHeading2', () => insertTextAtCursor('\n## 标题\n'));
  reg('luogu-editor.insertHeading3', () => insertTextAtCursor('\n### 标题\n'));
  reg('luogu-editor.insertHeading4', () => insertTextAtCursor('\n#### 标题\n'));
  reg('luogu-editor.insertInlineCode', () => wrapSelectionOrInsert('`', '`', 'code'));
  reg('luogu-editor.insertCodeBlock', async () => {
    const lang = await vscode.window.showQuickPick(['cpp','c','python','java','pascal','rust','go','plain'], { placeHolder: '选择语言' });
    if (lang) insertTextAtCursor(`\n\`\`\`${lang} line-numbers\n// code\n\`\`\`\n`);
  });
  reg('luogu-editor.insertQuote', () => insertTextAtCursor('\n> 引用内容\n'));
  reg('luogu-editor.insertMathInline', () => wrapSelectionOrInsert('$', '$', 'x'));
  reg('luogu-editor.insertMathBlock', () => insertTextAtCursor('\n$$\n\\sum_{i=1}^n a_i\n$$\n'));
  reg('luogu-editor.insertCalloutInfo', () => insertCallout('info'));
  reg('luogu-editor.insertCalloutSuccess', () => insertCallout('success'));
  reg('luogu-editor.insertCalloutWarning', () => insertCallout('warning'));
  reg('luogu-editor.insertCalloutError', () => insertCallout('error'));
  reg('luogu-editor.insertTable', () => insertTextAtCursor('\n::cute-table{tuack}\n\n| 标题 1 | 标题 2 | 标题 3 |\n| :---: | :---: | :---: |\n| 数据 | 数据 | 数据 |\n'));
  reg('luogu-editor.insertEpigraph', () => insertTextAtCursor('\n:::epigraph[——作者]\n千里之行，始于足下。\n:::\n'));
  reg('luogu-editor.insertAlignCenter', () => insertTextAtCursor('\n:::align{center}\n居中内容\n:::\n'));
  reg('luogu-editor.insertAlignRight', () => insertTextAtCursor('\n:::align{right}\n居右内容\n:::\n'));
  reg('luogu-editor.insertLink', async () => {
    const url = await vscode.window.showInputBox({ prompt: 'URL', value: 'https://' });
    if (url) wrapSelectionOrInsert('[', `](${url})`, '链接');
  });
  reg('luogu-editor.insertImage', async () => {
    const url = await vscode.window.showInputBox({ prompt: '图片 URL' });
    if (url) insertTextAtCursor(`![图片](${url})`);
  });
  reg('luogu-editor.insertBilibili', async () => {
    const bv = await vscode.window.showInputBox({ prompt: 'BV/AV 号', placeHolder: 'BV1GJ411x7h7' });
    if (bv) insertTextAtCursor(`\n![](bilibili:${bv})\n`);
  });
  reg('luogu-editor.insertTaskList', () => insertTextAtCursor('\n- [ ] 任务\n- [x] 已完成\n'));
  reg('luogu-editor.insertHR', () => insertTextAtCursor('\n---\n'));
  reg('luogu-editor.insertTemplateDemo', () => insertTemplateFromFile('demo'));
  reg('luogu-editor.insertTemplateSolution', () => insertTemplateFromFile('solution'));
  reg('luogu-editor.insertTemplateProblem', () => insertTemplateFromFile('problem'));
  reg('luogu-editor.insertTemplateArticle', () => insertTemplateFromFile('article'));
  reg('luogu-editor.copyMarkdown', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      vscode.env.clipboard.writeText(editor.document.getText());
      vscode.window.showInformationMessage('已复制 Markdown 源码');
    }
  });
  reg('luogu-editor.autoFixSpacing', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') return;
    const text = editor.document.getText();
    const fixed = fixSpacing(text);
    if (text !== fixed) { replaceAllContent(fixed); vscode.window.showInformationMessage('排版修复完成'); }
    else vscode.window.showInformationMessage('排版已符合规范');
  });
}

async function insertCallout(type) {
  const title = await vscode.window.showInputBox({ prompt: `${type} 标题`, value: type });
  const pick = await vscode.window.showQuickPick([{label:'默认折叠',value:false},{label:'默认展开',value:true}], { placeHolder: '默认状态' });
  const openStr = pick && pick.value ? '{open}' : '';
  insertTextAtCursor(`\n::::${type}[${title || type}]${openStr}\n内容\n::::\n`);
}

async function insertTemplateFromFile(key) {
  const fallbacks = {
    demo: '# 演示\n\n**粗体** *斜体* `代码` $LaTeX$\n\n$$\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n$$\n\n```cpp line-numbers\n#include <iostream>\nint main() { return 0; }\n```\n',
    solution: '# 题解\n\n## 思路\n\n## 代码\n\n::::info[代码]{open}\n```cpp line-numbers\n#include <iostream>\nint main() { return 0; }\n```\n::::\n\n## 复杂度\n\n时间 $\\mathcal{O}(n)$\n',
    problem: '# 题目\n\n## 描述\n\n## 输入格式\n\n## 输出格式\n\n## 数据范围\n\n$1 \\le n \\le 10^5$\n',
    article: '# 文章\n\n:::epigraph[——作者]\n引言\n:::\n\n## 正文\n',
  };
  const tpl = fallbacks[key] || '# 新文档\n';
  const ok = await vscode.window.showWarningMessage('替换全部内容?', '确定', '取消');
  if (ok === '确定') { replaceAllContent(tpl); vscode.window.showInformationMessage('模板已应用'); }
}

function fixSpacing(text) {
  const blocks = []; let idx = 0;
  text = text.replace(/```[\s\S]*?```/g, (m) => { const k = `\x00C${idx++}\x00`; blocks.push({k,v:m}); return k; });
  text = text.replace(/`[^`]+`/g, (m) => { const k = `\x00C${idx++}\x00`; blocks.push({k,v:m}); return k; });
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (m) => { const k = `\x00C${idx++}\x00`; blocks.push({k,v:m}); return k; });
  text = text.replace(/\$[^\$\n]+?\$/g, (m) => { const k = `\x00C${idx++}\x00`; blocks.push({k,v:m}); return k; });
  text = text.replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2');
  text = text.replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, '$1 $2');
  text = text.replace(/([\u4e00-\u9fff])(\x00C)/g, '$1 $2');
  text = text.replace(/(\x00C\d*)([\u4e00-\u9fff])/g, '$1 $2');
  text = text.replace(/  +/g, ' ');
  for (const b of blocks) text = text.replace(b.k, b.v);
  return text;
}

function deactivate() {}
module.exports = { activate, deactivate };
