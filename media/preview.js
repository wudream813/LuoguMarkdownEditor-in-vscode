/**
 * Preview-only webview script for Luogu Markdown Editor v1.0.1
 * This script runs inside the VSCode webview panel and only renders
 * the markdown preview (no editor UI).
 */
(function () {
  'use strict';

  // Initialize the Luogu parser
  const ParserClass =
    typeof LuoguParser !== 'undefined'
      ? LuoguParser
      : typeof window !== 'undefined'
      ? window.LuoguParser
      : null;
  const katexLib =
    typeof katex !== 'undefined'
      ? katex
      : typeof window !== 'undefined'
      ? window.katex
      : null;
  const prismLib =
    typeof Prism !== 'undefined'
      ? Prism
      : typeof window !== 'undefined'
      ? window.Prism
      : null;

  const parser = ParserClass
    ? new ParserClass({ katex: katexLib, prism: prismLib })
    : null;

  // Disable Prism auto-highlight
  if (typeof Prism !== 'undefined') {
    Prism.manual = true;
  }

  const previewEl = document.getElementById('previewContent');

  // Render markdown to HTML
  function renderMarkdown(markdown) {
    if (!previewEl || !parser) return;
    const html = parser.render(markdown);
    previewEl.innerHTML = html;
  }

  // Listen for messages from the extension host
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || !message.type) return;

    switch (message.type) {
      case 'update': {
        renderMarkdown(message.content || '');
        break;
      }
    }
  });

  // Initial render with empty content
  renderMarkdown('');

  // Show a welcome message
  if (previewEl) {
    previewEl.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-muted, #999);">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <h2 style="color: var(--text-secondary, #666); font-weight: 500;">洛谷 Markdown 实时预览</h2>
        <p style="font-size: 14px; max-width: 400px; margin: 12px auto; line-height: 1.6;">
          在左侧 VSCode 编辑器中编写 Markdown，<br>此处将实时渲染预览效果。
        </p>
        <p style="font-size: 12px; color: var(--text-muted, #aaa); margin-top: 20px;">
          💡 使用左侧活动栏的 <strong>洛谷 Markdown</strong> 图标<br>打开格式工具箱快速插入语法
        </p>
      </div>
    `;
  }
})();
