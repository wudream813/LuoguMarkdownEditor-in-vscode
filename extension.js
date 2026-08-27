/**
 * Luogu Markdown Editor - VSCode Extension
 * 洛谷 Markdown & KaTeX 实时预览编辑器 VSCode 扩展
 *
 * Architecture:
 * - Registers a CustomTextEditorProvider for .md files
 * - Provides WebviewPanel-based preview side-by-side
 * - Communicates with the webview via postMessage API
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('洛谷 Markdown 编辑器扩展已激活');

  // Register the custom editor provider
  const provider = new LuoguEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      LuoguEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Command: Open preview in a new tab
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.openPreview', () => {
      openPreviewPanel(context, vscode.ViewColumn.Active);
    })
  );

  // Command: Open preview side by side
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.openSideBySide', () => {
      openPreviewPanel(context, vscode.ViewColumn.Beside);
    })
  );

  // Command: Copy markdown source
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.copyMarkdown', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'markdown') {
        vscode.env.clipboard.writeText(editor.document.getText());
        vscode.window.showInformationMessage('已复制洛谷 Markdown 源码！');
      }
    })
  );

  // Command: Export HTML
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.exportHTML', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
        return;
      }
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          editor.document.fileName.replace(/\.md$/i, '.html')
        ),
        filters: { 'HTML 文件': ['html'] },
      });
      if (uri) {
        // Send export request to the preview webview
        LuoguPreviewPanel.sendToWebview({
          type: 'export-html',
          outputPath: uri.fsPath,
          content: editor.document.getText(),
        });
      }
    })
  );

  // Command: Auto fix spacing
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.autoFixSpacing', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
        return;
      }
      LuoguPreviewPanel.sendToWebview({
        type: 'fix-spacing',
        content: editor.document.getText(),
      });
    })
  );

  // Command: Insert template
  context.subscriptions.push(
    vscode.commands.registerCommand('luogu-editor.insertTemplate', async () => {
      const templates = [
        { label: '🌟 洛谷语法全特性演示文档', value: 'demo' },
        { label: '🏆 洛谷标准题解模板', value: 'solution' },
        { label: '📝 洛谷题目题面模板', value: 'problem' },
        { label: '📚 洛谷学术/文章专栏模板', value: 'article' },
      ];
      const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: '选择要插入的洛谷模板',
      });
      if (selected) {
        LuoguPreviewPanel.sendToWebview({
          type: 'get-template',
          templateKey: selected.value,
        });
      }
    })
  );

  // Auto-open preview when a markdown file is opened (if setting enabled)
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'markdown') {
        // Notify existing preview panels about the new document
        LuoguPreviewPanel.updateAllPanels(doc.getText());
      }
    })
  );

  // Sync text changes to preview
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'markdown') {
        LuoguPreviewPanel.updateAllPanels(e.document.getText());
      }
    })
  );
}

/**
 * Open a standalone preview panel
 */
function openPreviewPanel(context, column) {
  const editor = vscode.window.activeTextEditor;
  const content = editor ? editor.document.getText() : '';
  const fileName = editor
    ? path.basename(editor.document.fileName)
    : 'untitled.md';

  const panel = vscode.window.createWebviewPanel(
    'luogu-preview',
    `洛谷预览: ${fileName}`,
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
      ],
    }
  );

  new LuoguPreviewPanel(panel, context, content, fileName);
}

/**
 * Manages a standalone preview webview panel
 */
class LuoguPreviewPanel {
  static panels = new Set();
  static _instance = null;

  /**
   * Send message to all active preview panels
   */
  static updateAllPanels(content) {
    for (const panel of LuoguPreviewPanel.panels) {
      panel.panel.webview.postMessage({
        type: 'update-content',
        content: content,
      });
    }
  }

  /**
   * Send a message to the most recently active panel
   */
  static sendToWebview(message) {
    if (LuoguPreviewPanel._instance) {
      LuoguPreviewPanel._instance.panel.webview.postMessage(message);
    }
  }

  constructor(panel, context, content, fileName) {
    this.panel = panel;
    this.context = context;
    this.disposables = [];

    LuoguPreviewPanel.panels.add(this);
    LuoguPreviewPanel._instance = this;

    this.panel.webview.html = this.getWebviewContent(content, fileName);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  async handleMessage(message) {
    switch (message.type) {
      case 'save-file': {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            editor.document.uri,
            new vscode.Range(0, 0, editor.document.lineCount, 0),
            message.content
          );
          await vscode.workspace.applyEdit(edit);
          await editor.document.save();
          vscode.window.showInformationMessage('文件已保存！');
        }
        break;
      }
      case 'copy-clipboard': {
        await vscode.env.clipboard.writeText(message.content);
        vscode.window.showInformationMessage('已复制到剪贴板！');
        break;
      }
      case 'show-info': {
        vscode.window.showInformationMessage(message.text);
        break;
      }
      case 'show-error': {
        vscode.window.showErrorMessage(message.text);
        break;
      }
      case 'export-html-done': {
        try {
          fs.writeFileSync(message.outputPath, message.html, 'utf8');
          vscode.window.showInformationMessage(
            `HTML 已导出到: ${message.outputPath}`
          );
        } catch (err) {
          vscode.window.showErrorMessage(`导出失败: ${err.message}`);
        }
        break;
      }
      case 'insert-text': {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await editor.edit((editBuilder) => {
            const pos = editor.selection.active;
            editBuilder.insert(pos, message.text);
          });
        }
        break;
      }
      case 'replace-content': {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            editor.document.uri,
            new vscode.Range(0, 0, editor.document.lineCount, 0),
            message.content
          );
          await vscode.workspace.applyEdit(edit);
        }
        break;
      }
    }
  }

  getWebviewContent(content, fileName) {
    const webview = this.panel.webview;
    const mediaPath = vscode.Uri.joinPath(this.context.extensionUri, 'media');

    // Helper to create webview URIs
    const uri = (file) =>
      webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, file));

    const nonce = getNonce();
    const cspSource = webview.cspSource;

    // Encode initial content safely
    const encodedContent = Buffer.from(content || '', 'utf8').toString(
      'base64'
    );

    return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${cspSource}; img-src ${cspSource} https: data:; media-src https:;">
  <title>洛谷 Markdown 预览</title>
  <link rel="stylesheet" href="${uri('katex/katex.min.css')}">
  <link rel="stylesheet" href="${uri('prism/prism-tomorrow.min.css')}">
  <link rel="stylesheet" href="${uri('styles.css')}">
  <link rel="stylesheet" href="${uri('vscode.css')}">
</head>
<body>
  <div id="app">
    <!-- Top Navigation Header -->
    <header class="app-header">
      <div class="brand-section">
        <div class="app-title-group">
          <span class="app-title">
            洛谷 Markdown 编辑器
            <span class="app-badge">VSCode 扩展版</span>
          </span>
        </div>
      </div>

      <div class="header-center">
        <input type="text" id="docNameInput" class="docNameInput doc-name-input" value="${escapeHtml(fileName)}" title="文档名称" />
      </div>

      <div class="header-actions">
        <button class="btn btn-primary" onclick="LuoguEditor.copyLuoguMarkdown()" title="一键复制洛谷规范 Markdown">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>一键复制发布</span>
        </button>

        <button class="btn" onclick="LuoguEditor.saveToVscode()" title="保存文件 (Ctrl+S)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>保存</span>
        </button>

        <!-- Theme Switcher -->
        <div class="tool-dropdown">
          <button class="btn btn-icon-only" title="切换主题">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
          <div class="dropdown-menu dropdown-menu-right">
            <button class="dropdown-item" onclick="LuoguEditor.setTheme('light')">☀️ 亮色</button>
            <button class="dropdown-item" onclick="LuoguEditor.setTheme('dark')">🌙 暗色</button>
          </div>
        </div>
      </div>
    </header>

    <!-- Formatting Toolbar -->
    <div class="toolbar-container" role="toolbar" aria-label="编辑器工具栏">
      <!-- History -->
      <div class="toolbar-group">
        <button class="tool-btn" onclick="LuoguEditor.undo()" title="撤销 (Ctrl+Z)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.redo()" title="重做 (Ctrl+Y)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Headings & Text -->
      <div class="toolbar-group">
        <div class="tool-dropdown">
          <button class="tool-btn" title="标题">
            <span style="font-weight: bold; font-size: 13px;">H</span>
            <svg viewBox="0 0 24 24" style="width:8px;height:8px;" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-menu">
            <button class="dropdown-item" onclick="LuoguEditor.insertHeading(1)">H1 一级标题</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertHeading(2)">H2 二级标题</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertHeading(3)">H3 三级标题</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertHeading(4)">H4 四级标题</button>
          </div>
        </div>
        <button class="tool-btn" onclick="LuoguEditor.insertBold()" title="加粗 (Ctrl+B)">
          <strong style="font-size: 14px;">B</strong>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.insertItalic()" title="斜体 (Ctrl+I)">
          <em style="font-size: 14px; font-style: italic;">I</em>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.insertStrikethrough()" title="删除线">
          <s style="font-size: 14px;">S</s>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Code & Quote -->
      <div class="toolbar-group">
        <button class="tool-btn" onclick="LuoguEditor.insertInlineCode()" title="行内代码">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.openModal('codeModal')" title="插入代码块">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.insertQuote()" title="引用区块">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- KaTeX Formulas -->
      <div class="toolbar-group">
        <button class="tool-btn" onclick="LuoguEditor.insertMathInline()" title="行内公式 $x$ (Ctrl+Shift+K)">
          <span style="font-family: serif; font-size: 14px; font-weight: bold;">$</span>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.insertMathBlock()" title="独立公式 $$ (Ctrl+Shift+M)">
          <span style="font-family: serif; font-size: 13px; font-weight: bold;">$$</span>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.openModal('mathModal')" title="📐 LaTeX 数学公式面板">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Luogu Special Syntax -->
      <div class="toolbar-group">
        <div class="tool-dropdown">
          <button class="tool-btn" title="洛谷折叠框">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <svg viewBox="0 0 24 24" style="width:8px;height:8px;" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-menu">
            <button class="dropdown-item" onclick="LuoguEditor.insertCallout('info', '提示信息', false)">📘 :::info 提示框</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertCallout('success', '解题成功', false)">📗 :::success 成功框</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertCallout('warning', '警告注意', false)">📙 :::warning 警告框</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertCallout('error', '常见错误', false)">📕 :::error 错误框</button>
            <button class="dropdown-item" onclick="LuoguEditor.openModal('calloutModal')">⚙️ 自定义折叠框</button>
          </div>
        </div>

        <button class="tool-btn" onclick="LuoguEditor.initTableBuilder(3, 4)" title="表格生成器">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
        </button>

        <button class="tool-btn" onclick="LuoguEditor.openModal('epigraphModal')" title="引言">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>
        </button>

        <div class="tool-dropdown">
          <button class="tool-btn" title="居中与居右排版">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
            <svg viewBox="0 0 24 24" style="width:8px;height:8px;" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-menu">
            <button class="dropdown-item" onclick="LuoguEditor.insertAlign('center')">↔️ 居中排版</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertAlign('right')">➡️ 居右排版</button>
          </div>
        </div>

        <button class="tool-btn" onclick="LuoguEditor.openModal('bilibiliModal')" title="插入 Bilibili 视频">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="10.5" y2="5"/><line x1="17" y1="2" x2="13.5" y2="5"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/><path d="M9 16c1.5 1 4.5 1 6 0"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Common Inserts -->
      <div class="toolbar-group">
        <button class="tool-btn" onclick="LuoguEditor.openModal('linkModal')" title="插入链接">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.openModal('imageModal')" title="插入图片">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.insertTaskList()" title="任务列表">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </button>
        <button class="tool-btn" onclick="LuoguEditor.insertHR()" title="分割线">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Templates & Linter -->
      <div class="toolbar-group">
        <div class="tool-dropdown">
          <button class="tool-btn" title="洛谷模板">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style="font-size:11px; margin-left:3px; font-weight:600;">模板</span>
            <svg viewBox="0 0 24 24" style="width:8px;height:8px;" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-menu">
            <button class="dropdown-item" onclick="LuoguEditor.insertTemplate('demo')">🌟 语法全特性演示</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertTemplate('solution')">🏆 标准题解模板</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertTemplate('problem')">📝 题目题面模板</button>
            <button class="dropdown-item" onclick="LuoguEditor.insertTemplate('article')">📚 学术/文章专栏</button>
          </div>
        </div>

        <button class="btn btn-icon-only" onclick="LuoguEditor.autoFixSpacing()" title="⚡ 一键排版修复">
          <span style="color: var(--luogu-blue); font-weight: bold; font-size: 11px;">排版修复</span>
        </button>
      </div>

      <!-- Right-aligned View Mode Switchers -->
      <div style="margin-left: auto; display: flex; align-items: center; gap: 2px;">
        <button class="tool-btn view-mode-btn active" data-mode="split" onclick="LuoguEditor.setViewMode('split')" title="双栏预览">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
        </button>
        <button class="tool-btn view-mode-btn" data-mode="editor-only" onclick="LuoguEditor.setViewMode('editor-only')" title="纯编辑">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
        <button class="tool-btn view-mode-btn" data-mode="preview-only" onclick="LuoguEditor.setViewMode('preview-only')" title="纯预览">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>

    <!-- Main Workspace -->
    <main id="mainWorkspace" class="main-workspace mode-split">
      <!-- Editor Pane -->
      <div id="editorPane" class="editor-pane">
        <div class="pane-header">
          <span>MARKDOWN 源代码</span>
          <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">VSCode 同步编辑中</span>
        </div>
        <div class="editor-wrapper">
          <div class="gutter-stack">
            <div id="lineNumbersGutter" class="line-numbers-gutter"></div>
            <div id="foldMarkers" class="fold-markers" aria-hidden="false"></div>
          </div>
          <textarea id="editorTextarea" class="editor-textarea" placeholder="在此输入 Markdown 内容，右侧将实时渲染……" spellcheck="false"></textarea>
        </div>
      </div>

      <!-- Draggable Resizer -->
      <div id="splitResizer" class="split-resizer" title="拖动调整双栏宽度"></div>

      <!-- Preview Pane -->
      <div id="previewPane" class="preview-pane">
        <div class="pane-header">
          <span>实时渲染预览</span>
          <span id="currentThemeLabel" style="font-size:10px; font-weight:normal; color:var(--luogu-blue);">亮色</span>
        </div>
        <div id="previewContent" class="preview-content"></div>
      </div>
    </main>

    <!-- Bottom Status Bar -->
    <footer class="app-statusbar">
      <div class="status-left">
        <div class="status-item">
          <span class="status-dot"></span>
          <span id="saveStatusIndicator">VSCode 同步中</span>
        </div>
        <div class="status-item">
          <span id="docStatsText">0 行 | 0 字 | 0 公式</span>
        </div>
      </div>
      <div class="status-right">
        <div class="status-item">
          <span id="linterScoreBadge" class="status-score-badge status-score-good" onclick="LuoguEditor.openModal('linterModal')" style="cursor:pointer;">排版评分: 100分</span>
        </div>
        <div class="status-item">
          <span style="cursor:pointer;" onclick="LuoguEditor.openModal('helpModal')">❓ 帮助</span>
        </div>
      </div>
    </footer>
  </div>

  <!-- Modals (same as original) -->
  <div id="mathModal" class="modal-overlay">
    <div class="modal-dialog modal-dialog-large">
      <div class="modal-header">
        <h3 class="modal-title">📐 LaTeX / KaTeX 数学公式面板</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('mathModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div id="mathTabsContainer" class="math-tabs"></div>
        <div id="mathCheatsheetContainer"></div>
      </div>
      <div class="modal-footer">
        <span style="font-size: 11px; color: var(--text-muted); margin-right: auto;">点击任意公式即可插入</span>
        <button class="btn" onclick="LuoguEditor.closeModal('mathModal')">关闭</button>
      </div>
    </div>
  </div>

  <div id="tableModal" class="modal-overlay">
    <div class="modal-dialog modal-dialog-large">
      <div class="modal-header">
        <h3 class="modal-title">📊 表格生成器</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('tableModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; gap:8px;">
            <button class="btn" onclick="LuoguEditor.addTableRow()">➕ 添加行</button>
            <button class="btn" onclick="LuoguEditor.addTableCol()">➕ 添加列</button>
          </div>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; font-weight:600; color:var(--luogu-blue);">
            <input type="checkbox" id="tableTuackCheck" checked />
            启用 Tuack 竞赛风格
          </label>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
          提示：<code>^</code> 向上合并，<code>&lt;</code> 向左合并
        </p>
        <div id="tableBuilderGrid" class="table-builder-grid-preview"></div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('tableModal')">取消</button>
        <button class="btn btn-primary" onclick="LuoguEditor.buildAndInsertTable()">生成表格</button>
      </div>
    </div>
  </div>

  <div id="calloutModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">📦 插入折叠框</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('calloutModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">类型</label>
          <select id="calloutTypeSelect" class="form-select">
            <option value="info">📘 info</option>
            <option value="success">📗 success</option>
            <option value="warning">📙 warning</option>
            <option value="error">📕 error</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">标题 (支持 LaTeX)</label>
          <input type="text" id="calloutTitleInput" class="form-input" placeholder="例如：核心算法证明" />
        </div>
        <div class="form-group">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px;">
            <input type="checkbox" id="calloutOpenCheck" />
            <span>默认展开 ({open})</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('calloutModal')">取消</button>
        <button class="btn btn-primary" onclick="
          const type = document.getElementById('calloutTypeSelect').value;
          const title = document.getElementById('calloutTitleInput').value;
          const isOpen = document.getElementById('calloutOpenCheck').checked;
          LuoguEditor.insertCallout(type, title, isOpen);
          LuoguEditor.closeModal('calloutModal');
        ">插入</button>
      </div>
    </div>
  </div>

  <div id="epigraphModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">📜 插入引言</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('epigraphModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">落款 / 作者</label>
          <input type="text" id="epigraphAuthorInput" class="form-input" placeholder="例如：高德纳" />
        </div>
        <div class="form-group">
          <label class="form-label">引言内容</label>
          <textarea id="epigraphContentInput" class="form-input" rows="3" placeholder="例如：过早的优化是万恶之源。"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('epigraphModal')">取消</button>
        <button class="btn btn-primary" onclick="
          const author = document.getElementById('epigraphAuthorInput').value;
          const content = document.getElementById('epigraphContentInput').value;
          LuoguEditor.insertEpigraph(author, content);
          LuoguEditor.closeModal('epigraphModal');
        ">插入引言</button>
      </div>
    </div>
  </div>

  <div id="bilibiliModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">📺 插入 Bilibili 视频</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('bilibiliModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">BV号 / AV号</label>
          <input type="text" id="bilibiliIdInput" class="form-input" placeholder="例如：BV1GJ411x7h7" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('bilibiliModal')">取消</button>
        <button class="btn btn-primary" onclick="
          const id = document.getElementById('bilibiliIdInput').value.trim();
          if (id) { LuoguEditor.insertBilibili(id); LuoguEditor.closeModal('bilibiliModal'); }
        ">插入视频</button>
      </div>
    </div>
  </div>

  <div id="codeModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">💻 插入代码块</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('codeModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">编程语言</label>
          <select id="codeLangSelect" class="form-select">
            <option value="cpp">C++ (cpp)</option>
            <option value="c">C</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="pascal">Pascal</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
            <option value="plain">纯文本</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px;">
            <input type="checkbox" id="codeLineNumbersCheck" checked />
            <span>显示行号</span>
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">高亮行 (可选)</label>
          <input type="text" id="codeLinesInput" class="form-input" placeholder="例如：5-6 或 3,5,8-10" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('codeModal')">取消</button>
        <button class="btn btn-primary" onclick="
          const lang = document.getElementById('codeLangSelect').value;
          const hasLn = document.getElementById('codeLineNumbersCheck').checked;
          const lines = document.getElementById('codeLinesInput').value.trim();
          let args = lang;
          if (hasLn) args += ' line-numbers';
          if (lines) args += ' lines=' + lines;
          LuoguEditor.insertAtCursor('\\n\\n\`\`\`' + args + '\\n// 在此编写代码\\n\`\`\`\\n\\n');
          LuoguEditor.closeModal('codeModal');
        ">插入代码块</button>
      </div>
    </div>
  </div>

  <div id="linkModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">🔗 插入链接</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('linkModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">链接标题</label>
          <input type="text" id="linkTextInput" class="form-input" placeholder="例如：洛谷帮助中心" />
        </div>
        <div class="form-group">
          <label class="form-label">URL</label>
          <input type="text" id="linkUrlInput" class="form-input" placeholder="https://www.luogu.com.cn/" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('linkModal')">取消</button>
        <button class="btn btn-primary" onclick="
          const text = document.getElementById('linkTextInput').value.trim() || '链接';
          const url = document.getElementById('linkUrlInput').value.trim() || 'https://';
          LuoguEditor.insertAtCursor('[' + text + '](' + url + ')');
          LuoguEditor.closeModal('linkModal');
        ">插入链接</button>
      </div>
    </div>
  </div>

  <div id="imageModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">🖼️ 插入图片</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('imageModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">图片描述</label>
          <input type="text" id="imageAltInput" class="form-input" placeholder="例如：算法示意图" />
        </div>
        <div class="form-group">
          <label class="form-label">图片 URL</label>
          <input type="text" id="imageUrlInput" class="form-input" placeholder="https://cdn.luogu.com.cn/..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="LuoguEditor.closeModal('imageModal')">取消</button>
        <button class="btn btn-primary" onclick="
          const alt = document.getElementById('imageAltInput').value.trim() || '图片';
          const url = document.getElementById('imageUrlInput').value.trim();
          if (url) { LuoguEditor.insertAtCursor('![' + alt + '](' + url + ')'); LuoguEditor.closeModal('imageModal'); }
        ">插入图片</button>
      </div>
    </div>
  </div>

  <div id="linterModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">🛡️ 排版规范检查报告</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('linterModal')">&times;</button>
      </div>
      <div class="modal-body" id="linterReportBody">
        <p>正在分析……</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-success" onclick="LuoguEditor.autoFixSpacing(); LuoguEditor.closeModal('linterModal');">⚡ 一键修复</button>
        <button class="btn" onclick="LuoguEditor.closeModal('linterModal')">关闭</button>
      </div>
    </div>
  </div>

  <div id="helpModal" class="modal-overlay">
    <div class="modal-dialog modal-dialog-large">
      <div class="modal-header">
        <h3 class="modal-title">📖 帮助手册</h3>
        <button class="modal-close-btn" onclick="LuoguEditor.closeModal('helpModal')">&times;</button>
      </div>
      <div class="modal-body" style="font-size: 13px; line-height: 1.75;">
        <h4 style="color:var(--luogu-blue);">⌨️ 快捷键：</h4>
        <ul style="padding-left: 20px;">
          <li><code>Ctrl + S</code>：保存文件到 VSCode</li>
          <li><code>Ctrl + B</code>：加粗文本</li>
          <li><code>Ctrl + I</code>：斜体文本</li>
          <li><code>Ctrl + K</code>：插入链接</li>
          <li><code>Ctrl + Shift + K</code>：行内公式</li>
          <li><code>Ctrl + Shift + M</code>：行间公式</li>
          <li><code>Ctrl + Z / Y</code>：撤销 / 重做</li>
        </ul>
        <h4 style="color:var(--luogu-blue); margin-top: 16px;">🌟 洛谷扩展语法：</h4>
        <ul style="padding-left: 20px;">
          <li><code>:::info[标题]</code> / <code>:::success</code> / <code>:::warning</code> / <code>:::error</code> — 折叠框</li>
          <li><code>:::epigraph[落款]</code> — 引言</li>
          <li><code>:::align{center}</code> / <code>:::align{right}</code> — 居中/居右</li>
          <li><code>::cute-table{tuack}</code> — 竞赛风格表格</li>
          <li><code>![](bilibili:BV号)</code> — B站视频嵌入</li>
          <li><code>\`\`\`cpp line-numbers lines=5-6</code> — 代码行号与高亮</li>
          <li>表格合并：<code>^</code> 向上合并，<code>&lt;</code> 向左合并</li>
        </ul>
        <h4 style="color:var(--luogu-blue); margin-top: 16px;">💡 VSCode 集成：</h4>
        <ul style="padding-left: 20px;">
          <li>编辑器内容与 VSCode 中打开的 .md 文件双向同步</li>
          <li>使用 Ctrl+S 可直接保存到 VSCode 工作区</li>
          <li>在 VSCode 中编辑 .md 文件时，预览面板自动更新</li>
        </ul>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="LuoguEditor.closeModal('helpModal')">知道了</button>
      </div>
    </div>
  </div>

  <!-- Toast Container -->
  <div id="toastContainer" class="toast-container" role="status" aria-live="polite"></div>

  <!-- Scripts -->
  <script nonce="${nonce}" src="${uri('katex/katex.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-c.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-cpp.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-python.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-java.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('prism/prism-pascal.min.js')}"></script>
  <script nonce="${nonce}" src="${uri('luogu-parser.js')}"></script>
  <script nonce="${nonce}" src="${uri('luogu-linter.js')}"></script>
  <script nonce="${nonce}" src="${uri('luogu-math-cheatsheet.js')}"></script>
  <script nonce="${nonce}" src="${uri('luogu-templates.js')}"></script>
  <script nonce="${nonce}" src="${uri('editor.js')}"></script>
  <script nonce="${nonce}" src="${uri('vscode-bridge.js')}"></script>
  <script nonce="${nonce}">
    // Initialize with content from VSCode
    (function() {
      var encoded = "${encodedContent}";
      if (encoded) {
        var content = atob(encoded);
        // Decode UTF-8
        try {
          content = decodeURIComponent(escape(content));
        } catch(e) {}
        // Wait for editor to init, then set content
        var checkInterval = setInterval(function() {
          if (typeof LuoguEditor !== 'undefined' && LuoguEditor.textarea) {
            clearInterval(checkInterval);
            LuoguEditor.setContent(content, false);
          }
        }, 50);
      }
    })();
  </script>
</body>
</html>`;
  }

  dispose() {
    LuoguPreviewPanel.panels.delete(this);
    if (LuoguPreviewPanel._instance === this) {
      LuoguPreviewPanel._instance = null;
    }
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop().dispose();
    }
  }
}

/**
 * Custom editor provider for opening .md files directly in the Luogu editor
 */
class LuoguEditorProvider {
  static viewType = 'luogu-editor.preview';

  constructor(context) {
    this.context = context;
  }

  async resolveCustomTextEditor(
    webviewPanel,
    document,
    _token
  ) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    const content = document.getText();
    const fileName = path.basename(document.fileName);

    // Create a preview panel instance for this custom editor
    const previewPanel = new LuoguPreviewPanel(
      webviewPanel,
      this.context,
      content,
      fileName
    );

    // Sync document changes to the webview
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        webviewPanel.webview.postMessage({
          type: 'update-content',
          content: document.getText(),
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });
  }
}

// Utility functions
function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function deactivate() {}

module.exports = { activate, deactivate };
