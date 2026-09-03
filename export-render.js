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

// ── 导出工具条：主题切换 + 复制 Markdown（v1.2.0）──
function luoguApplyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.remove('vscode-light', 'vscode-dark');
  document.body.classList.add(theme === 'dark' ? 'vscode-dark' : 'vscode-light');
  var btn = document.getElementById('luogu-theme-btn');
  if (btn) btn.innerHTML = theme === 'dark' ? '☀ 亮色' : '☾ 暗色';
  try { localStorage.setItem('luogu-export-theme', theme); } catch (e) {}
}
function luoguToggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  luoguApplyTheme(cur === 'dark' ? 'light' : 'dark');
}
function luoguCopyMarkdown(btn) {
  var el = document.getElementById('luogu-md-source');
  if (!el) return;
  var md = JSON.parse(el.textContent);
  var done = function () {
    var orig = btn.innerText; btn.innerText = '已复制 ✓';
    setTimeout(function () { btn.innerText = orig; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(md).then(done, function () { luoguCopyLegacy(md, done); });
  } else {
    luoguCopyLegacy(md, done);
  }
}
function luoguCopyLegacy(text, done) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove(); done();
}
// 初始主题：localStorage > 系统 prefers-color-scheme
(function () {
  var saved = null;
  try { saved = localStorage.getItem('luogu-export-theme'); } catch (e) {}
  var sys = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  luoguApplyTheme(saved || sys);
})();
`;

const EXPORT_CSS = `
/* 导出独立页面的基底：不依赖任何 --vscode-* 注入变量（浏览器/打印环境均不存在，
   此前 preview.css 提供的浅色 fallback 会压过 styles.css 的暗色块导致暗色全错） */
body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #2c3e50);
}
/* 行间公式居中：fit-content + margin auto，任何包层/浏览器默认渲染下都居中 */
.luogu-math-block-wrap { display: block !important; text-align: center !important; }
.luogu-math-display {
  display: block !important;
  width: fit-content !important;
  max-width: 100% !important;
  margin: 1.2em auto !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  text-align: center !important;
}
`;

// 右上角浮动工具条（主题切换 / 复制 Markdown）
const TOOLBAR_HTML = `
<div class="luogu-export-toolbar">
  <button id="luogu-theme-btn" type="button" onclick="luoguToggleTheme()" title="切换亮/暗主题"></button>
  <button type="button" onclick="luoguCopyMarkdown(this)" title="复制 Markdown 源码">⧉ 复制 Markdown</button>
</div>
`;

const TOOLBAR_CSS = `
.luogu-export-toolbar {
  position: fixed; top: 14px; right: 16px; z-index: 9999;
  display: flex; gap: 8px;
  font-family: var(--vscode-font-family, "PingFang SC", "Microsoft YaHei", sans-serif);
}
.luogu-export-toolbar button {
  padding: 6px 12px; border-radius: 16px; cursor: pointer;
  font-size: 12px; line-height: 1; white-space: nowrap;
  border: 1px solid var(--border-color, #d0d7de);
  background: var(--bg-secondary, #f6f8fa);
  color: var(--text-primary, #1f2328);
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: filter 0.15s, transform 0.1s;
}
.luogu-export-toolbar button:hover { filter: brightness(0.95); transform: translateY(-1px); }
@media print { .luogu-export-toolbar { display: none !important; } }
`;

const PRINT_CSS = `
@media print {
  .luogu-code-copy-btn, .luogu-code-copy-button, .luogu-bilibili-facade-hint,
  .luogu-export-toolbar { display: none !important; }
  body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const PRINT_SCRIPT = `
window.addEventListener('load', function () {
  // PDF 打印必须亮色：暗色主题下 body 被 @media print 强制留白但组件仍走暗色变体，
  // 打出来会糊成一片；打印前统一回色，印完用户仍可切换。
  luoguApplyTheme('light');
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
  let genVersion = 'dev';
  try { genVersion = require(path.join(__dirname, 'package.json')).version; } catch (e) {}
  const parser = getParser(assetsRoot);
  const body = parser.render(markdown || '');

  const read = (...p) => fs.readFileSync(path.join(assetsRoot, ...p), 'utf8');
  const katexCss = read('katex', 'katex.min.css');

  // KaTeX 字体内嵌（自包含单文件）：为 fonts/ 里每个 woff2 生成 data URI @font-face。
  // 库版 logo 字体名 = 文件名主段（KaTeX_Main-Regular.woff2 → KaTeX_Main）；
  // 变体 → weight/style 映射：含 Bold→700、含 Italic→italic。
  let embedFontsCss = '';
  try {
    const fontsDir = path.join(assetsRoot, 'katex', 'fonts');
    const woff2 = fs.readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'));
    embedFontsCss = woff2.map((file) => {
      const base = file.replace(/\.woff2$/, '');           // KaTeX_Main-Regular
      const cutAt = base.lastIndexOf('-');
      const family = cutAt > 0 ? base.slice(0, cutAt) : base; // KaTeX_Main
      const variant = cutAt > 0 ? base.slice(cutAt + 1) : 'Regular';
      const weight = /Bold/i.test(variant) ? '700' : '400';
      const style = /Italic/i.test(variant) ? 'italic' : 'normal';
      const b64 = fs.readFileSync(path.join(fontsDir, file)).toString('base64');
      return `@font-face{font-display:block;font-family:"${family}";font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
    }).join('');
  } catch (e) { /* 字体目录缺失则跳过内嵌（外链 fonts/ 仍可作为改造老导出兼容） */ }
  const prismCss = read('prism', 'prism-tomorrow.min.css');
  const stylesCss = read('styles.css');

  // 打印变白：抽取 styles.css :root 亮色变量集，封装为 @media print 覆盖 [data-theme="dark"]。
  // 用户在页面上选了暗色后手动 Ctrl+P 时，打印仍输出通用亮色页面（屏幕主题不回变）。
  let printLightCss = '';
  {
    const rootMatch = stylesCss.match(/:root\s*\{([\s\S]*?)\}/);
    if (rootMatch) {
      printLightCss = `@media print { :root, [data-theme="dark"] {${rootMatch[1]} } }`;
    }
  }
  // preview.css 是 webview 专用基底（含 --vscode-* 变量与 100vh 布局），独立导出不可含
  // 它——其浅色 fallback 会以「后写同 specificity」压过 styles.css 的暗色块（暗色乱掉根因）。
  const previewCss = ''; // eslint-disable-line no-unused-vars

  // 内嵌 Markdown 源码供「复制 Markdown」按钮使用。JSON.stringify 后用 
  // 转义全部 < —— 防止源码中的 "</script>" 击穿 script 标签（ 是合法 JSON 转义）。
  const mdSourceJson = JSON.stringify(markdown || '').replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${String(title || '导出文档').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>${katexCss}</style>
  ${embedFontsCss ? `<style>${embedFontsCss}</style>` : ''}
  <style>${prismCss}</style>
  <style>${stylesCss}</style>
  <style>${EXPORT_CSS}</style>
  <style>
    html, body { height: auto !important; overflow: visible !important; }
    body { max-width: 860px; margin: 0 auto; padding: 24px 32px; }
  </style>
  <style>${TOOLBAR_CSS}</style>
  ${printLightCss ? `<style>${printLightCss}</style>` : ''}
  ${forPrint ? `<style>${PRINT_CSS}</style>` : ''}
  <!-- generated by wudream.luogu-markdown-editor v${genVersion} -->
</head>
<body class="vscode-light">
  ${TOOLBAR_HTML}
  <script id="luogu-md-source" type="application/json">${mdSourceJson}</script>
  <div id="previewContent" class="preview-content luogu-preview-root">${body}</div>
  <script>${HELPER_SCRIPT}</script>
  ${forPrint ? `<script>${PRINT_SCRIPT}</script>` : ''}
</body>
</html>
`;
}

module.exports = { buildStandaloneHtml };
