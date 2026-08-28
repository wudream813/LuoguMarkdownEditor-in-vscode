/**
 * Luogu Markdown Editor v1.0.12 - VSCode Extension
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { buildStandaloneHtml } = require('./export-render');
const { lintLuoguMarkdown } = require('./lint');
const { lintLuoguStyle } = require('./style-lint');

// Full preset template library (exported for both web and Node — shared file).
// Previously dead code: the sidebar inserted the tiny hard-coded fallbacks below
// instead of the rich templates the author actually wrote in this file.
let LuoguTemplates = {};
try {
  LuoguTemplates = require('./media/luogu-templates.js').LuoguTemplates || {};
} catch (e) {
  // File missing/corrupt — fall through to the built-in minimal fallbacks.
}

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
      new ToolboxItem('导出 HTML', 'luogu-editor.exportHtml', 'export'),
      new ToolboxItem('导出 PDF', 'luogu-editor.exportPdf', 'file-pdf'),
    ];
    return [];
  }
}

// ────────────────────────────────────────────────────────────────
// Preview Panel
// ────────────────────────────────────────────────────────────────

class PreviewPanel {
  static instance = null;

  // Theme to hand to the webview in its 'ready' handshake. postMessage calls made
  // BEFORE the webview's scripts run are silently dropped — the previous code sent
  // setTheme immediately after creating the panel, lost it, and a dark-theme user
  // got a light preview until they toggled manually.
  static initialTheme = 'light';

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
    // URI of the document this preview is showing. Without this, an edit to ANY
    // markdown file in the workspace pushed itself into the preview, and task
    // toggles were applied to whatever editor happened to be active.
    this.boundUri = null;
    this.panel.webview.html = this._getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'ready') {
        // Webview finished loading. Apply the pending theme FIRST (this is the
        // only reliable point — earlier posts are dropped), then content+scroll.
        this.setTheme(PreviewPanel.initialTheme);
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
          this.boundUri = editor.document.uri.toString();
          this.update(editor.document.getText());
          setTimeout(() => {
            const topRange = editor.visibleRanges[0];
            // instant: the very first positioning must JUMP, not smooth-scroll —
            // a smooth animation on open looks like the preview drifting by itself.
            if (topRange) this.scrollSync(topRange.start.line, true);
          }, 300);
        }
      } else if (msg.type === 'toggle-task') {
        // Toggle task checkbox in the document the preview is BOUND to — not the
        // active editor, which may have moved to a different (e.g. non-markdown) file.
        const editor = this._findBoundEditor();
        if (editor) {
          toggleTaskInEditor(editor, msg.taskLine, msg.checked);
        }
      } else if (msg.type === 'preview-scrolled') {
        // Reverse scroll sync: user scrolled the PREVIEW pane → follow in editor.
        this._scrollEditorToLine(msg.topLine);
      }
    }, null, this.disposables);
  }

  // The editor currently displaying the bound document; falls back to the active
  // markdown editor if the bound one was closed.
  _findBoundEditor() {
    if (this.boundUri) {
      const match = vscode.window.visibleTextEditors.find(
        (ed) => ed.document.uri.toString() === this.boundUri
      );
      if (match) return match;
    }
    const active = vscode.window.activeTextEditor;
    return active && active.document.languageId === 'markdown' ? active : undefined;
  }

  update(content) {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: 'update', content });
  }

  scrollSync(topLine, instant = false) {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: 'scroll-sync', topLine, instant });
  }

  // Echo-guard for preview→editor sync: the revealRange below fires
  // onDidChangeTextEditorVisibleRanges, which would sync RIGHT BACK into the
  // preview and fight the user's scroll. The guard must be a PURE TIME WINDOW —
  // matching by line number (an earlier version) failed under continuous
  // preview scrolling: relays arrive every ~80ms, each overwriting the expected
  // echo line, so STALE echoes from earlier reveals never matched, got sent
  // back into the preview, and rubber-banded it ("滚动回弹"). Echoes land within
  // a few ms of their reveal; 150ms is safely longer and far shorter than any
  // human's inter-pane scroll switch.
  _suppressEchoUntil = 0;

  _scrollEditorToLine(topLine) {
    if (!this.boundUri || typeof topLine !== 'number' || !isFinite(topLine)) return;
    // Only follow into an editor that is visibly showing the BOUND document —
    // never hijack an unrelated active editor.
    const editor = vscode.window.visibleTextEditors.find(
      (ed) => ed.document.uri.toString() === this.boundUri
    );
    if (!editor) return;
    const line = Math.max(0, Math.min(editor.document.lineCount - 1, Math.floor(topLine)));
    const cur = editor.visibleRanges[0];
    if (cur && cur.start.line === line) return; // already at top; reveal would no-op
    this._suppressEchoUntil = Date.now() + 150;
    editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.AtTop);
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
  <script src="${u('prism/prism-bash.min.js')}"></script>
  <script src="${u('prism/prism-rust.min.js')}"></script>
  <script src="${u('prism/prism-go.min.js')}"></script>
  <script src="${u('prism/prism-json.min.js')}"></script>
  <script src="${u('prism/prism-latex.min.js')}"></script>
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

  // ── 语法检查 → VSCode 问题面板（v1.1.1）──
  // luogu-parser 本身永不报错（宽容渲染），结构性错误只能由独立的 lint 层提示。
  const diagnostics = vscode.languages.createDiagnosticCollection('luogu-markdown');
  context.subscriptions.push(diagnostics);
  let lintTimer = null;

  function lintDocument(doc) {
    if (!doc || doc.languageId !== 'markdown') return;
    const text = doc.getText();
    const diags = [];
    // 语法检查 → Error/Warning（v1.1.1）
    for (const it of lintLuoguMarkdown(text)) {
      const line = Math.min(Math.max(0, it.line), doc.lineCount - 1);
      const d = new vscode.Diagnostic(
        doc.lineAt(line).range,
        it.message,
        it.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
      );
      d.source = 'luogu-语法';
      diags.push(d);
    }
    // 洛谷排版规范检查 → Hint（v1.2.2，最轻量级别，带精确列范围）
    for (const it of lintLuoguStyle(text)) {
      const line = Math.min(Math.max(0, it.line), doc.lineCount - 1);
      const lineLen = doc.lineAt(line).text.length;
      const start = Math.min(it.col, lineLen);
      const end = Math.max(Math.min(start + (it.length || 1), lineLen), start + (start < lineLen ? 1 : 0));
      const d = new vscode.Diagnostic(
        new vscode.Range(line, start, line, end),
        it.message,
        vscode.DiagnosticSeverity.Hint
      );
      d.source = 'luogu-排版';
      diags.push(d);
    }
    diagnostics.set(doc.uri, diags);
  }

  const scheduleLint = (doc) => {
    if (!doc || doc.languageId !== 'markdown') return;
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => lintDocument(doc), 400);
  };

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(lintDocument));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => scheduleLint(e.document)));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)));
  // 激活时已打开的所有 markdown 文档先过一遍
  for (const doc of vscode.workspace.textDocuments) lintDocument(doc);

  // Scroll sync helper
  let scrollTimeout = null;
  function doScrollSync(editor, instant = false) {
    if (!PreviewPanel.instance || !editor) return;
    const r = editor.visibleRanges[0];
    if (r) PreviewPanel.instance.scrollSync(r.start.line, instant);
  }

  // Open preview
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.openPreview', () => {
      const preview = PreviewPanel.createOrShow(context);
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'markdown') {
        // Bind the preview to THIS document; later edits to other markdown
        // files must not push themselves into this preview.
        preview.boundUri = editor.document.uri.toString();
        preview.update(editor.document.getText());
        // If the panel is FRESH this post is dropped (webview not ready yet) and
        // the 'ready' handshake sends its own sync. If the panel is being REUSED
        // (createOrShow just revealed it), 'ready' fired long ago and NOTHING
        // would ever re-sync: the revealed preview kept its old scroll position
        // — "打开预览时滚动没有同步". Send the initial sync here too.
        setTimeout(() => doScrollSync(editor, true), 350);
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
      const preview = PreviewPanel.instance;
      if (!preview || e.document.languageId !== 'markdown') return;
      // Respect the luogu-editor.autoSync setting (was declared in package.json
      // but never read by code — setting it to false did nothing).
      if (!vscode.workspace.getConfiguration('luogu-editor').get('autoSync', true)) return;
      // Only refresh for the document the preview actually shows.
      if (preview.boundUri && e.document.uri.toString() !== preview.boundUri) return;
      if (!preview.boundUri) preview.boundUri = e.document.uri.toString();
      preview.update(e.document.getText());
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === e.document) {
        setTimeout(() => doScrollSync(editor), 150);
      }
    })
  );

  // Active editor change -> rebind preview to the newly shown document
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === 'markdown' && PreviewPanel.instance) {
        PreviewPanel.instance.boundUri = editor.document.uri.toString();
        PreviewPanel.instance.update(editor.document.getText());
        // Also re-anchor the scroll: the re-render swaps innerHTML while body
        // keeps its old (now-clamped) scrollTop, so switching to a file freshly
        // opened mid-document left the preview stranded. ("切换文件后没同步")
        setTimeout(() => doScrollSync(editor, true), 150);
      }
    })
  );

  // Editor scroll -> preview scroll.
  // NOTE: the selection-change listener that used to live here was removed —
  // merely moving the cursor re-scrolled the preview even though the visible
  // range had not changed.
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      const preview = PreviewPanel.instance;
      if (!preview || e.textEditor.document.languageId !== 'markdown') return;
      // Echo guard: a visibleRanges change WE caused by following a preview
      // scroll must not be synced BACK into the preview — that bounce is the
      // rubber-banding this guard exists to prevent. Pure time window (see the
      // field comment for the stale-echo race that ruled out line matching).
      if (preview._suppressEchoUntil > Date.now()) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => doScrollSync(e.textEditor), 16);
    })
  );

  // Theme state. HighContrast is a DARK theme (kind 3); HighContrastLight is light
  // (kind 4) — the old strict === Dark check rendered HighContrast users in light.
  const isDarkKind = (kind) =>
    kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
  let currentTheme = isDarkKind(vscode.window.activeColorTheme.kind) ? 'dark' : 'light';
  // The panel picks this up in its 'ready' handshake (no monkey-patching).
  PreviewPanel.initialTheme = currentTheme;

  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.toggleTheme', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      PreviewPanel.initialTheme = currentTheme;
      if (PreviewPanel.instance) PreviewPanel.instance.setTheme(currentTheme);
      vscode.window.showInformationMessage(`预览主题: ${currentTheme === 'light' ? '亮色' : '暗色'}`);
    })
  );
  // Follow VSCode theme changes automatically
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      currentTheme = isDarkKind(theme.kind) ? 'dark' : 'light';
      PreviewPanel.initialTheme = currentTheme;
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
    if (lang) {
      // Comment marker must match the language — `// code` is a syntax error in Python.
      const comment = lang === 'python' ? '# code' : (lang === 'plain' ? 'code' : '// code');
      insertTextAtCursor(`\n\`\`\`${lang} line-numbers\n${comment}\n\`\`\`\n`);
    }
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
  reg('luogu-editor.exportHtml', () => exportDocument('html'));
  reg('luogu-editor.exportPdf', () => exportDocument('pdf'));
}

/**
 * 导出当前 Markdown 为自包含 HTML（v1.1.1）。
 * mode='html'：直接导出 .html；mode='pdf'：导出带打印样式 + 自动唤起打印对话框的
 * HTML 并在默认浏览器打开（VSCode 扩展无头打印 API 缺失，浏览器「打印 → 另存为 PDF」
 * 是唯一不引入数百 MB Chromium 依赖的可行路径）。
 */
async function exportDocument(mode) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
    return;
  }
  if (editor.document.isUntitled) {
    vscode.window.showWarningMessage('请先保存文件再导出');
    return;
  }
  const srcPath = editor.document.uri.fsPath;
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath).replace(/\.[^.]+$/, '');
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(dir, mode === 'html' ? `${base}.html` : `${base}-print.html`)),
    filters: { 'HTML 文件': ['html'] },
    // 导出 PDF 的流程备注：先导出为 HTML（打印优化版），再在浏览器里打印导出 PDF
    title: mode === 'html' ? '导出 HTML' : '导出 PDF — 第 1 步：先导出为 HTML（第 2 步在浏览器中打印导出）',
  });
  if (!target) return;

  try {
    const assetsRoot = path.join(__dirname, 'media');
    const html = buildStandaloneHtml(editor.document.getText(), {
      title: base,
      assetsRoot,
      forPrint: mode === 'pdf',
    });
    fs.writeFileSync(target.fsPath, html, 'utf8');

    // katex.min.css 以相对路径引用 fonts/ —— 把字体目录复制到导出目录，
    // 否则数学公式会退化为默认衬线字体（内容仍可读）。
    let fontsNote = '';
    const fontsSrc = path.join(assetsRoot, 'katex', 'fonts');
    if (fs.existsSync(fontsSrc)) {
      const fontsDst = path.join(path.dirname(target.fsPath), 'fonts');
      if (!fs.existsSync(fontsDst)) {
        fs.cpSync(fontsSrc, fontsDst, { recursive: true });
        fontsNote = '（已附带 fonts/ 字体目录，移动 HTML 时请一起移动）';
      } else {
        fontsNote = '（复用已有 fonts/ 字体目录）';
      }
    }

    if (mode === 'html') {
      const pick = await vscode.window.showInformationMessage(
        `已导出 HTML${fontsNote}`, '在文件夹中显示', '直接打开'
      );
      if (pick === '在文件夹中显示') {
        vscode.commands.executeCommand('revealFileInOS', target);
      } else if (pick === '直接打开') {
        vscode.env.openExternal(target);
      }
    } else {
      await vscode.env.openExternal(target);
      vscode.window.showInformationMessage('第 2 步：浏览器已打开该 HTML，使用浏览器「打印 → 另存为 PDF」完成导出');
    }
  } catch (e) {
    vscode.window.showErrorMessage(`导出失败：${e.message}`);
  }
}

async function insertCallout(type) {
  const title = await vscode.window.showInputBox({ prompt: `${type} 标题`, value: type });
  if (title === undefined) return; // Esc — abort instead of inserting anyway
  const pick = await vscode.window.showQuickPick([{label:'默认折叠',value:false},{label:'默认展开',value:true}], { placeHolder: '默认状态' });
  if (pick === undefined) return;  // Esc — abort
  const openStr = pick.value ? '{open}' : '';
  insertTextAtCursor(`\n::::${type}[${title || type}]${openStr}\n内容\n::::\n`);
}

async function insertTemplateFromFile(key) {
  // Real template library lives in media/luogu-templates.js (loaded at the top of
  // this file); these are only emergency fallbacks if that file is missing.
  const fallbacks = {
    demo: '# 演示\n\n**粗体** *斜体* `代码` $LaTeX$\n\n$$\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n$$\n\n```cpp line-numbers\n#include <iostream>\nint main() { return 0; }\n```\n',
    solution: '# 题解\n\n## 思路\n\n## 代码\n\n::::info[代码]{open}\n```cpp line-numbers\n#include <iostream>\nint main() { return 0; }\n```\n::::\n\n## 复杂度\n\n时间 $\\mathcal{O}(n)$\n',
    problem: '# 题目\n\n## 描述\n\n## 输入格式\n\n## 输出格式\n\n## 数据范围\n\n$1 \\le n \\le 10^5$\n',
    article: '# 文章\n\n:::epigraph[——作者]\n引言\n:::\n\n## 正文\n',
  };
  const tpl = LuoguTemplates[key] || fallbacks[key] || '# 新文档\n';
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
  // A placeholder token is \x00 C <digits> \x00. The old rule omitted the TRAILING
  // \x00, so it could never match and no space was added AFTER a placeholder.
  text = text.replace(/([\u4e00-\u9fff])(\x00C\d*\x00)/g, '$1 $2');
  text = text.replace(/(\x00C\d*\x00)([\u4e00-\u9fff])/g, '$1 $2');
  // Collapse 2+ space runs to one — but NEVER touch end-of-line whitespace: two
  // trailing spaces are Luogu's hard line break; the old /  +/g collapsed them too,
  // silently deleting every hard break in the document.
  text = text.replace(/ {2,}/gm, (run, offset, str) => {
    const next = str[offset + run.length];
    return (next === '\n' || next === '\r' || next === undefined) ? run : ' ';
  });
  // Function-callback replacement: a plain string second argument interprets $&,
  // $', $` and $$ inside the ORIGINAL code/math as replacement patterns and
  // corrupts the user's code (bash/perl/sed snippets are full of them).
  for (const b of blocks) text = text.replace(b.k, () => b.v);
  return text;
}

function deactivate() {}

/**
 * Toggle a task checkbox in the markdown source, addressed by DOCUMENT LINE.
 *
 * The webview sends the line the parser itself rendered (data-task-line), which
 * replaced the old "count tasks again on this side" approach: any divergence
 * between two task-counting implementations — e.g. the parser requires a closing
 * fence to occupy the whole line while a rescan accepts ```cpp, or vice versa —
 * silently flipped the wrong checkbox. A line number can never drift.
 *
 * Two defensive checks keep stale previews from writing garbage:
 *  - the line must still look like a task item, otherwise the edit is dropped;
 *  - if the checkbox already has the requested state, no edit is made at all.
 */
async function toggleTaskInEditor(editor, taskLine, checked) {
  if (taskLine === null || taskLine === undefined || Number.isNaN(taskLine)) return;
  const doc = editor.document;
  if (taskLine < 0 || taskLine >= doc.lineCount) return;

  const line = doc.lineAt(taskLine).text;
  // Bullet or ordered marker, any depth of blockquote prefix ('> ').
  const match = line.match(/^((?:\s*>\s?)*)(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](.*)$/);
  if (!match) return; // preview was stale; the line is no longer a task

  const isCurrentlyChecked = match[3].toLowerCase() === 'x';
  if (isCurrentlyChecked === Boolean(checked)) return; // already in the requested state

  const newLine = `${match[1]}${match[2]}[${checked ? 'x' : ' '}]${match[4]}`;
  await editor.edit(editBuilder => {
    editBuilder.replace(doc.lineAt(taskLine).range, newLine);
  });
}

module.exports = { activate, deactivate };
