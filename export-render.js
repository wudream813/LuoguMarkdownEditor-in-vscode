/**
 * 导出渲染管线（v1.1.1）：Markdown → 自包含 HTML
 *
 * 纯 Node 模块（无 vscode 依赖），与 webview 复用同一条渲染链：
 * luogu-parser + katex(renderToString) + prism(highlight)。产物一个 HTML 文件，
 * CSS 全部内联；KaTeX 字体由 extension 层把 media/katex/fonts 复制到导出目录
 * （katex.min.css 以相对路径引用 fonts/）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

let _parser = null;

function getParser(assetsRoot) {
  if (_parser) return _parser;
  const katex = require(path.join(assetsRoot, 'katex', 'katex.min.js'));
  const Prism = require(path.join(assetsRoot, 'prism', 'prism.js'));
  // Prism 语法组件以自由变量引用全局 Prism（官方 node 用法）
  global.Prism = Prism;
  for (const lang of ['c', 'cpp', 'python', 'java', 'pascal', 'bash', 'rust', 'go', 'json', 'latex']) {
    try { require(path.join(assetsRoot, 'prism', `prism-${lang}.min.js`)); } catch (e) { /* 缺语言包就跳过 */ }
  }
  const { LuoguParser } = require(path.join(assetsRoot, 'luogu-parser.js'));
  _parser = new LuoguParser({ katex, prism: Prism });
  return _parser;
}

// 导出页用的交互辅助脚本：复制代码 / 点击加载 B 站播放器 / 任务复选框仅视觉切换
const HELPER_SCRIPT = `
function copyCodeBlock(btn) {
  var wrapper = btn.closest('.luogu-code-block-wrapper');
  if (!wrapper) return;
  var lines = wrapper.querySelectorAll('.code-line-text');
  var text = lines.length > 0
    ? Array.from(lines).map(function (el) { return el.innerText; }).join('\\n')
    : (wrapper.querySelector('pre code') || {}).innerText || '';
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () {
    var span = btn.querySelector('.copy-text') || btn;
    var orig = span.innerText; span.innerText = '已复制';
    setTimeout(function () { span.innerText = orig; }, 1800);
  });
}
function loadBilibiliPlayer(btn) {
  var src = btn.getAttribute('data-src');
  if (!src) return;
  var iframe = document.createElement('iframe');
  iframe.setAttribute('src', src);
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', 'no');
  iframe.setAttribute('allowfullscreen', 'true');
  iframe.setAttribute('referrerpolicy', 'origin');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation');
  iframe.style.width = '100%'; iframe.style.aspectRatio = '16/9';
  var wrapper = btn.closest('.luogu-bilibili-player-wrapper');
  if (wrapper) { wrapper.innerHTML = ''; wrapper.appendChild(iframe); }
  else { btn.replaceWith(iframe); }
}
function toggleTaskCheckbox() { /* 静态导出：仅视觉切换，不回写源码 */ }
`;

const PRINT_CSS = `
@media print {
  .luogu-code-copy-button, .luogu-bilibili-facade-hint { display: none !important; }
  body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const PRINT_SCRIPT = `
window.addEventListener('load', function () {
  setTimeout(function () { window.print(); }, 800);
});
`;

/**
 * @param {string} markdown 源文本
 * @param {object} opts { title, assetsRoot, forPrint }
 * @returns {string} 完整 HTML
 */
function buildStandaloneHtml(markdown, opts) {
  const { title, assetsRoot, forPrint } = opts;
  const parser = getParser(assetsRoot);
  const body = parser.render(markdown || '');

  const read = (...p) => fs.readFileSync(path.join(assetsRoot, ...p), 'utf8');
  const katexCss = read('katex', 'katex.min.css');
  const prismCss = read('prism', 'prism-tomorrow.min.css');
  const stylesCss = read('styles.css');
  const previewCss = read('preview.css');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${String(title || '导出文档').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>${katexCss}</style>
  <style>${prismCss}</style>
  <style>${stylesCss}</style>
  <style>${previewCss}</style>
  <style>
    html, body { height: auto !important; overflow: visible !important; }
    body { max-width: 860px; margin: 0 auto; padding: 24px 32px; }
  </style>
  ${forPrint ? `<style>${PRINT_CSS}</style>` : ''}
</head>
<body class="vscode-light">
  <div id="previewContent" class="preview-content luogu-preview-root">${body}</div>
  <script>${HELPER_SCRIPT}</script>
  ${forPrint ? `<script>${PRINT_SCRIPT}</script>` : ''}
</body>
</html>
`;
}

module.exports = { buildStandaloneHtml };
