/**
 * Preview webview script for Luogu Markdown Editor
 * - Renders markdown via LuoguParser
 * - Handles scroll sync messages from the extension host
 */
(function () {
  'use strict';

  const ParserClass = typeof LuoguParser !== 'undefined' ? LuoguParser
    : typeof window !== 'undefined' ? window.LuoguParser : null;
  const katexLib = typeof katex !== 'undefined' ? katex
    : typeof window !== 'undefined' ? window.katex : null;
  const prismLib = typeof Prism !== 'undefined' ? Prism
    : typeof window !== 'undefined' ? window.Prism : null;

  const parser = ParserClass ? new ParserClass({ katex: katexLib, prism: prismLib }) : null;
  if (typeof Prism !== 'undefined') { Prism.manual = true; }

  const previewEl = document.getElementById('previewContent');

  // Track whether we are programmatically scrolling to avoid feedback loops
  let isSyncing = false;
  let scrollTimer = null;
  let renderSeq = 0;

  function renderMarkdown(markdown) {
    if (!previewEl || !parser) return;
    renderSeq++;
    const html = parser.render(markdown);
    previewEl.innerHTML = html;
  }

  /**
   * Build sorted anchor list: [{line, top}] mapping source lines to preview pixel positions.
   * Uses data-src-line attributes that the parser adds to rendered elements.
   */
  function buildAnchors() {
    if (!previewEl) return [];
    const nodes = previewEl.querySelectorAll('[data-src-line]');
    const anchors = [];
    const seen = new Set();
    nodes.forEach(function (el) {
      var line = parseInt(el.getAttribute('data-src-line'), 10);
      if (!Number.isFinite(line) || seen.has(line)) return;
      // Skip elements inside collapsed <details>
      if (el.closest && el.closest('details:not([open])')) return;
      seen.add(line);
      anchors.push({ line: line, el: el });
    });
    anchors.sort(function (a, b) { return a.line - b.line; });
    return anchors;
  }

  /**
   * Scroll preview so the content corresponding to `topLine` is at the top of the viewport.
   * Uses piecewise linear interpolation between anchor points.
   */
  function scrollToLine(topLine, fraction) {
    if (!previewEl || isSyncing) return;
    var anchors = buildAnchors();
    if (anchors.length === 0) return;

    // Compute pixel tops for each anchor
    var containerRect = previewEl.getBoundingClientRect();
    var baseTop = containerRect.top - previewEl.scrollTop;
    var points = [];
    for (var i = 0; i < anchors.length; i++) {
      var rect = anchors[i].el.getBoundingClientRect();
      points.push({ line: anchors[i].line, top: rect.top - baseTop });
    }

    // Add a final point at the bottom of content
    var scrollHeight = previewEl.scrollHeight;
    points.push({ line: Infinity, top: scrollHeight });

    // Find the two anchor points surrounding topLine
    var targetTop = 0;
    if (topLine <= points[0].line) {
      targetTop = points[0].top;
    } else {
      var found = false;
      for (var j = 0; j < points.length - 1; j++) {
        if (points[j].line <= topLine && (points[j + 1].line >= topLine || points[j + 1].line === Infinity)) {
          var span = points[j + 1].line - points[j].line;
          if (span === 0 || !Number.isFinite(span)) span = 1;
          var t = (topLine + (fraction || 0) - points[j].line) / span;
          t = Math.max(0, Math.min(1, t));
          targetTop = points[j].top + (points[j + 1].top - points[j].top) * t;
          found = true;
          break;
        }
      }
      if (!found) {
        targetTop = points[points.length - 2].top;
      }
    }

    // Apply scroll
    var maxScroll = scrollHeight - previewEl.clientHeight;
    var want = Math.max(0, Math.min(maxScroll, targetTop));
    if (Math.abs(previewEl.scrollTop - want) > 1) {
      isSyncing = true;
      previewEl.scrollTop = want;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { isSyncing = false; }, 100);
    }
  }

  // Listen for messages from the extension host
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || !message.type) return;

    switch (message.type) {
      case 'update': {
        renderMarkdown(message.content || '');
        break;
      }
      case 'scroll-sync': {
        // topLine: the line number at the top of the editor viewport
        // fraction: fractional part (0-1) for sub-line precision
        scrollToLine(message.topLine, message.fraction || 0);
        break;
      }
    }
  });

  // Initial render
  renderMarkdown('');

  if (previewEl) {
    previewEl.innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:var(--text-muted,#999);">' +
      '<h2 style="color:var(--text-secondary,#666);font-weight:500;">Luogu Markdown 实时预览</h2>' +
      '<p style="font-size:14px;max-width:400px;margin:12px auto;line-height:1.6;">' +
      '在左侧编辑器中编写 Markdown，此处实时渲染。<br>' +
      '滚动编辑器时预览自动同步。</p></div>';
  }
})();
