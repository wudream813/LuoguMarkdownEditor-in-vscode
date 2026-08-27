/**
 * VSCode Bridge - Handles communication between the webview and VSCode extension host
 */
(function () {
  'use strict';

  // Acquire VSCode API
  const vscode =
    typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

  // State persistence
  const state = vscode ? vscode.getState() || {} : {};

  // Override editor's autoSave to use VSCode file system
  function patchEditorForVscode() {
    // Wait for LuoguEditor to be ready
    const checkInterval = setInterval(function () {
      if (typeof LuoguEditor === 'undefined' || !LuoguEditor.textarea) return;
      clearInterval(checkInterval);

      // Add saveToVscode method
      LuoguEditor.saveToVscode = function () {
        const content = this.getContent();
        if (vscode) {
          vscode.postMessage({
            type: 'save-file',
            content: content,
          });
        }
        this.showToast('已保存到 VSCode！', 'success');
      };

      // Override saveMarkdownFile to save via VSCode
      const origSave = LuoguEditor.saveMarkdownFile;
      LuoguEditor.saveMarkdownFile = function () {
        if (vscode) {
          this.saveToVscode();
        } else {
          origSave.call(this);
        }
      };

      // Override Ctrl+S to save via VSCode
      const origKeyDown = LuoguEditor.handleKeyDown.bind(LuoguEditor);
      LuoguEditor.handleKeyDown = function (e) {
        const isCtrl = e.ctrlKey || e.metaKey;
        if (isCtrl && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          this.saveToVscode();
          return;
        }
        origKeyDown(e);
      };

      // Override autoSave to also notify VSCode
      const origAutoSave = LuoguEditor.autoSave.bind(LuoguEditor);
      LuoguEditor.autoSave = function () {
        // Save to localStorage for webview persistence
        origAutoSave();
        // Also send to VSCode for live sync
        if (vscode) {
          const content = this.getContent();
          vscode.setState({ content: content });
        }
      };

      // Override copyLuoguMarkdown to use VSCode clipboard
      const origCopy = LuoguEditor.copyLuoguMarkdown.bind(LuoguEditor);
      LuoguEditor.copyLuoguMarkdown = function () {
        const content = this.getContent();
        if (vscode) {
          vscode.postMessage({
            type: 'copy-clipboard',
            content: content,
          });
          this.showToast(
            '已复制洛谷标准 Markdown 源码，可直接粘贴到洛谷发布！',
            'success'
          );
        } else {
          origCopy();
        }
      };

      // Override insertTemplate to also insert into VSCode editor
      const origInsertTemplate =
        LuoguEditor.insertTemplate.bind(LuoguEditor);
      LuoguEditor.insertTemplate = function (key) {
        if (
          typeof LuoguTemplates !== 'undefined' &&
          LuoguTemplates[key]
        ) {
          if (confirm('应用模板将覆盖当前编辑区内容，是否继续？')) {
            this.setContent(LuoguTemplates[key]);
            this.showToast('模板应用成功！', 'success');
            if (vscode) {
              vscode.postMessage({
                type: 'replace-content',
                content: LuoguTemplates[key],
              });
            }
          }
        }
      };

      // Patch insertAtCursor to also update VSCode
      const origInsertAtCursor =
        LuoguEditor.insertAtCursor.bind(LuoguEditor);
      LuoguEditor.insertAtCursor = function (text) {
        origInsertAtCursor(text);
        if (vscode) {
          vscode.postMessage({
            type: 'sync-content',
            content: this.getContent(),
          });
        }
      };

      console.log('洛谷编辑器已成功适配 VSCode 环境');
    }, 100);
  }

  // Listen for messages from VSCode extension host
  if (typeof window !== 'undefined') {
    window.addEventListener('message', function (event) {
      const message = event.data;
      if (!message || !message.type) return;

      switch (message.type) {
        case 'update-content': {
          // Update the editor content from VSCode
          if (
            typeof LuoguEditor !== 'undefined' &&
            LuoguEditor.textarea
          ) {
            // Only update if content actually changed to avoid cursor jumps
            const current = LuoguEditor.getContent();
            if (current !== message.content) {
              const cursorPos = LuoguEditor.textarea.selectionStart;
              LuoguEditor.setContent(message.content, false);
              // Try to restore cursor position
              try {
                LuoguEditor.textarea.setSelectionRange(
                  Math.min(cursorPos, message.content.length),
                  Math.min(cursorPos, message.content.length)
                );
              } catch (e) {}
            }
          }
          break;
        }
        case 'fix-spacing': {
          // Apply linter fix and send result back
          if (
            typeof LuoguEditor !== 'undefined' &&
            LuoguEditor.linter
          ) {
            const formatted = LuoguEditor.linter.formatSpacing(
              message.content
            );
            if (vscode) {
              vscode.postMessage({
                type: 'replace-content',
                content: formatted,
              });
            }
          }
          break;
        }
        case 'get-template': {
          if (
            typeof LuoguTemplates !== 'undefined' &&
            LuoguTemplates[message.templateKey]
          ) {
            if (
              typeof LuoguEditor !== 'undefined' &&
              LuoguEditor.textarea
            ) {
              LuoguEditor.setContent(
                LuoguTemplates[message.templateKey]
              );
              LuoguEditor.showToast('模板已应用！', 'success');
              if (vscode) {
                vscode.postMessage({
                  type: 'replace-content',
                  content: LuoguTemplates[message.templateKey],
                });
              }
            }
          }
          break;
        }
        case 'export-html': {
          // The export is handled in the extension host
          if (
            typeof LuoguEditor !== 'undefined' &&
            LuoguEditor.parser
          ) {
            const html = LuoguEditor.parser.render(message.content);
            if (vscode) {
              vscode.postMessage({
                type: 'export-html-done',
                outputPath: message.outputPath,
                html: html,
              });
            }
          }
          break;
        }
      }
    });
  }

  // Initialize
  patchEditorForVscode();
})();
