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
  // decodeHint:false —— 导出的 HTML 跑在真实浏览器里，B 站播放器可正常发声，
  // 「VSCode 缺少音频解码」提示在导出页只会误导（v1.2.18 用户反馈）。
  _parser = new LuoguParser({ katex, prism: Prism, decodeHint: false });
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
function toggleTaskCheckbox(cb) {
  // 复选框本体由浏览器原生切换（无 disabled），这里负责把编辑后的勾选态持久化：
  // 以「文档标题」派生 key 存 localStorage，重开同一份导出文件时恢复（v1.2.20）。
  // 不回写任何源码——导出产物是只读快照，但快照本身可作 checklist 使用。
  try {
    var key = luoguTasksKey();
    if (!key) return;
    var boxes = document.querySelectorAll('.luogu-task-checkbox');
    var states = [];
    for (var i = 0; i < boxes.length; i++) states.push(boxes[i].checked ? 1 : 0);
    localStorage.setItem(key, JSON.stringify(states));
  } catch (e) { /* file:// 协议或隐私模式下静默降级为仅视觉切换 */ }
}
function luoguTasksKey() {
  try {
    var s = 'luogu-export-tasks::' + String(document.title || location.pathname);
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return 'luogu-tasks-' + h.toString(36);
  } catch (e) { return null; }
}
(function luoguRestoreTaskStates() {
  function apply() {
    try {
      var key = luoguTasksKey();
      if (!key) return;
      var states = JSON.parse(localStorage.getItem(key) || 'null');
      if (!Array.isArray(states)) return;
      var boxes = document.querySelectorAll('.luogu-task-checkbox');
      for (var i = 0; i < boxes.length && i < states.length; i++) {
        boxes[i].checked = !!states[i];
      }
    } catch (e) { /* 无本地存储/数据损坏则保持出厂状态 */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

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
/* 图片全局兜底：原生 HTML <img>、SVG 与极高 DPI 截图均不得冲出内容列
   （.luogu-img 类已有同规则，这里兜住绕过了类路径的图片，v1.2.19 用户反馈） */
.luogu-preview-root img { max-width: 100%; height: auto; }
/* 行间公式居中：fit-content + margin auto，任何包层/浏览器默认渲染下都居中；
   滚动容器放在 100% 宽的外层（窄公式结构性不可能出滚动条，宽公式照常可滚） */
.luogu-math-block-wrap {
  display: block !important;
  text-align: center !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
}
.luogu-math-display {
  display: block !important;
  width: fit-content !important;
  max-width: 100% !important;
  margin: 1.2em auto !important;
  overflow-x: visible !important;
  overflow-y: visible !important;
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
  .luogu-export-toolbar, .luogu-toc { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

// ── 目录（TOC）：洛谷文章页同款右侧导航（v1.2.19 用户要求：文章太长定位不到重点）──
// 数据来源：渲染产物里带 id 的标准 luogu 标题（heading-<slug>），按层缩进；
// 两项以下不生成（短文档强求目录是噪音）。宽屏贴右栏、窄屏退化为顶置面板、打印隐藏。
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTocHtml(bodyHtml, docTitle) {
  const items = [];
  const re = /<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(bodyHtml)) !== null) {
    const text = m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) items.push({ level: Number(m[1]), id: m[2], text });
  }
  if (items.length < 2) return '';
  const links = items.map((it) =>
    `    <a class="luogu-toc-item luogu-toc-l${it.level}" href="#${escapeAttr(it.id)}">${escapeAttr(it.text)}</a>`);
  return `<nav class="luogu-toc" id="luogu-toc" aria-label="目录">
  <div class="luogu-toc-head">目录</div>
  <a class="luogu-toc-item luogu-toc-top" href="#previewContent">${escapeAttr(docTitle || '文档开头')}</a>
${links.join('\n')}
</nav>`;
}

const TOC_CSS = `
.luogu-toc {
  /* 正文 860px 居中 → 右栏贴着正文右侧放；max() 保证窄 margin 不贴边 */
  position: fixed;
  top: 72px;
  right: max(16px, calc(50vw - 430px - 242px));
  width: 208px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding-left: 12px;
  border-left: 2px solid var(--border-color, #e5e7eb);
  font-size: 13px;
  line-height: 1.5;
  z-index: 900;
}
.luogu-toc-head { font-weight: 600; margin-bottom: 6px; color: var(--text-primary, #2c3e50); }
.luogu-toc-item {
  display: block;
  padding: 2px 0 2px 6px;
  margin-left: -6px;
  color: var(--text-secondary, #6b7280);
  text-decoration: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border-left: 2px solid transparent;
}
.luogu-toc-item:hover { color: var(--luogu-blue, #0e90d2); }
.luogu-toc-top, .luogu-toc-l1 { font-weight: 600; color: var(--text-primary, #2c3e50); }
.luogu-toc-l2 { padding-left: 6px; }
.luogu-toc-l3 { padding-left: 18px; }
.luogu-toc-l4, .luogu-toc-l5, .luogu-toc-l6 { padding-left: 30px; }
.luogu-toc-item.active {
  color: var(--luogu-blue, #0e90d2);
  border-left-color: var(--luogu-blue, #0e90d2);
  background: var(--luogu-blue-light, #e8f4fa);
}
/* 窄屏（含手机）：退化为内容上方的静态面板 */
@media (max-width: 1200px) {
  .luogu-toc {
    position: static; width: auto; max-height: 40vh;
    margin: 8px 0 20px; padding: 12px 16px;
    border: 1px solid var(--border-color, #e5e7eb);
    border-left-width: 2px; border-radius: 8px;
  }
}
@media print { .luogu-toc { display: none !important; } }
`;

// 滚动高亮：最后一个越过视口上方 96px 的标题视为「当前节」。纯监听，与内容零耦合。
const TOC_SCRIPT = `
(function () {
  var toc = document.getElementById('luogu-toc');
  if (!toc) return;
  var links = Array.prototype.slice.call(
    toc.querySelectorAll('a.luogu-toc-item[href^="#heading-"]'));
  var targets = links.map(function (a) {
    return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
  });
  function onScroll() {
    var idx = 0;
    var y = window.scrollY + 96;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t && t.getBoundingClientRect().top + window.scrollY <= y) idx = i;
    }
    links.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
`;

const PRINT_SCRIPT = `
window.addEventListener('load', function () {
  // v1.2.20：打印与屏幕主题一致（所见即所得）——此前暗色页被强制回亮色再印，
  // 用户报告「暗色 HTML 打开打印，出来的却是亮色 PDF」。暗色背景仍能打上，
  // 靠 PRINT_CSS 的 print-color-adjust: exact（Chrome 默认带背景图形）。
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
  // 目录基于渲染产物里的标题 id 构建（≥2 个标题才生成）
  const tocHtml = buildTocHtml(body, title);

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

  // 打印主题忠实（v1.2.20，用户报的「暗色 HTML 打印却出亮色 PDF」翻转语义）：
  // styles.css 的 @media print 段有「强制亮色变量集」（v1.1 打印变白设计）仍在，
  // 此处从 styles.css 抽取暗色变量块，以「同优先级、后写胜」在导出 CSS 尾部重注。
  // 亮色/学术主题本来就亮，无需处理。
  let printThemeCss = '';
  {
    const darkBlock = stylesCss.match(/^\[data-theme="dark"\]\s*\{([\s\S]*?)^\}/m);
    if (darkBlock) {
      // styles.css 的 @media print 段除了按变量强制亮色，还内嵌一整套 !important
      // 白纸态色规则（html/body 白底黑字、代码块浅底、bilibili 横幅浅底…）。
      // 暗色主题忠实打印需要逐条镜像对冲（html[data-theme="dark"] 前缀令优先级
      // 稳赢原规则——同为 !important 时 (0,2,1) > (0,1,0)）。
      printThemeCss = `
@media print {
  [data-theme="dark"] {${darkBlock[1]}}
  html[data-theme="dark"], html[data-theme="dark"] body {
    background: #1e1e1e !important; color: #d4d4d4 !important;
  }
  html[data-theme="dark"] #app, html[data-theme="dark"] .main-workspace,
  html[data-theme="dark"] .preview-pane, html[data-theme="dark"] .preview-content {
    background: #1e1e1e !important;
  }
  html[data-theme="dark"] h1, html[data-theme="dark"] h2, html[data-theme="dark"] h3,
  html[data-theme="dark"] h4, html[data-theme="dark"] h5, html[data-theme="dark"] h6 {
    color: #d4d4d4 !important;
  }
  html[data-theme="dark"] .luogu-code-block-wrapper {
    background: #282c34 !important; color: #abb2bf !important; border-color: #333333 !important;
  }
  html[data-theme="dark"] .luogu-code-header {
    background: #21252b !important; color: #9da5b4 !important; border-bottom-color: #333333 !important;
  }
  html[data-theme="dark"] .luogu-code-pre { color: #abb2bf !important; }
  html[data-theme="dark"] .code-line-number { color: #5c6370 !important; border-right-color: #333333 !important; }
  html[data-theme="dark"] .code-line-text { color: #abb2bf !important; }
  html[data-theme="dark"] .code-line-highlighted {
    background: rgba(229,192,123,0.15) !important; border-left-color: #d4a72c !important;
  }
  html[data-theme="dark"] .luogu-callout { border-color: #333333 !important; }
  html[data-theme="dark"] .luogu-callout-content { border-top-color: #333333 !important; }
  html[data-theme="dark"] .luogu-bilibili-container {
    background: #252526 !important; border-color: #333333 !important;
  }
  html[data-theme="dark"] .luogu-bilibili-header {
    background: #252526 !important; color: #d4d4d4 !important;
  }
}`;
    }
  }
  // v1.2.20：取消「打印强制回亮色」——打印改为与屏幕主题一致（用户要暗色 PDF）。
  // 此前的 printLightCss @media print 强制 dark→亮色变量集已从产物移除。
  const printLightCss = '';
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
  <style>${EXPORT_CSS}${printThemeCss}</style>
  <style>${TOC_CSS}</style>
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
  ${tocHtml}
  <div id="previewContent" class="preview-content luogu-preview-root">${body}</div>
  <script>${HELPER_SCRIPT}</script>
  <script>${TOC_SCRIPT}</script>
  ${forPrint ? `<script>${PRINT_SCRIPT}</script>` : ''}
</body>
</html>
`;
}

module.exports = { buildStandaloneHtml };
