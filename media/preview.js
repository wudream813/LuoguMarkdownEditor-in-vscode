/**
 * Preview webview script for Luogu Markdown Editor
 * - Renders markdown via LuoguParser
 * - Scroll sync from editor
 * - Preserves callout open/close state across re-renders
 * - Provides global functions for inline onclick handlers
 */
(function () {
  'use strict';

  var ParserClass = typeof LuoguParser !== 'undefined' ? LuoguParser
    : typeof window !== 'undefined' ? window.LuoguParser : null;
  var katexLib = typeof katex !== 'undefined' ? katex
    : typeof window !== 'undefined' ? window.katex : null;
  var prismLib = typeof Prism !== 'undefined' ? Prism
    : typeof window !== 'undefined' ? window.Prism : null;

  var parser = ParserClass ? new ParserClass({ katex: katexLib, prism: prismLib }) : null;
  if (typeof Prism !== 'undefined') { Prism.manual = true; }

  var previewEl = document.getElementById('previewContent');
  var isSyncing = false;
  var scrollTimer = null;

  // ── Global functions for inline onclick/onchange handlers ──

  window.copyCodeBlock = function (btn) {
    var wrapper = btn.closest('.luogu-code-block-wrapper');
    if (!wrapper) return;
    var codeLines = wrapper.querySelectorAll('.code-line-text');
    var text = '';
    if (codeLines.length > 0) {
      text = Array.from(codeLines).map(function (el) { return el.innerText; }).join('\n');
    } else {
      var codeEl = wrapper.querySelector('pre code');
      text = codeEl ? codeEl.innerText : '';
    }
    navigator.clipboard.writeText(text).then(function () {
      var span = btn.querySelector('.copy-text') || btn;
      var orig = span.innerText;
      span.innerText = '已复制';
      setTimeout(function () { span.innerText = orig; }, 1800);
    }).catch(function () {});
  };

  window.loadBilibiliPlayer = function (btn) {
    var src = btn.getAttribute('data-src');
    if (!src) return;
    var iframe = document.createElement('iframe');
    iframe.setAttribute('src', src);
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', 'no');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-presentation');
    btn.replaceWith(iframe);
  };

  window.toggleTaskCheckbox = function (cb) {
    // No-op in preview mode (read-only)
  };

  // ── Render ──

  function renderMarkdown(markdown) {
    if (!previewEl || !parser) return;

    // Save callout open state before re-render
    var openStates = saveCalloutStates();

    var html = parser.render(markdown);
    previewEl.innerHTML = html;

    // Restore callout open state after re-render
    restoreCalloutStates(openStates);
  }

  // ── Callout state preservation ──

  function saveCalloutStates() {
    var states = [];
    if (!previewEl) return states;
    var details = previewEl.querySelectorAll('details.luogu-callout');
    details.forEach(function (d, idx) {
      states.push({
        index: idx,
        srcLine: d.getAttribute('data-src-line'),
        open: d.hasAttribute('open')
      });
    });
    return states;
  }

  function restoreCalloutStates(states) {
    if (!previewEl || !states.length) return;
    var details = previewEl.querySelectorAll('details.luogu-callout');

    // Match by data-src-line first (most reliable), then by index
    var bySrcLine = {};
    states.forEach(function (s) {
      if (s.srcLine !== null) bySrcLine[s.srcLine] = s.open;
    });

    details.forEach(function (d, idx) {
      var srcLine = d.getAttribute('data-src-line');
      var shouldBeOpen;
      if (srcLine !== null && bySrcLine.hasOwnProperty(srcLine)) {
        shouldBeOpen = bySrcLine[srcLine];
      } else if (idx < states.length) {
        shouldBeOpen = states[idx].open;
      } else {
        return;
      }
      if (shouldBeOpen && !d.hasAttribute('open')) {
        d.setAttribute('open', '');
      } else if (!shouldBeOpen && d.hasAttribute('open')) {
        d.removeAttribute('open');
      }
    });
  }

  // ── Scroll sync ──

  function buildAnchors() {
    if (!previewEl) return [];
    var nodes = previewEl.querySelectorAll('[data-src-line]');
    var anchors = [];
    var seen = {};
    nodes.forEach(function (el) {
      var line = parseInt(el.getAttribute('data-src-line'), 10);
      if (!Number.isFinite(line) || seen[line]) return;
      if (el.closest && el.closest('details:not([open])')) return;
      seen[line] = true;
      anchors.push({ line: line, el: el });
    });
    anchors.sort(function (a, b) { return a.line - b.line; });
    return anchors;
  }

  function scrollToLine(topLine, fraction) {
    if (!previewEl) return;
    var anchors = buildAnchors();
    if (anchors.length === 0) return;

    var containerRect = previewEl.getBoundingClientRect();
    var baseTop = containerRect.top - previewEl.scrollTop;

    var points = [];
    for (var i = 0; i < anchors.length; i++) {
      var rect = anchors[i].el.getBoundingClientRect();
      points.push({ line: anchors[i].line, top: rect.top - baseTop });
    }
    points.push({ line: 999999, top: previewEl.scrollHeight });

    var targetTop = 0;
    if (topLine <= points[0].line) {
      targetTop = points[0].top;
    } else {
      var found = false;
      for (var j = 0; j < points.length - 1; j++) {
        if (points[j].line <= topLine && points[j + 1].line >= topLine) {
          var span = points[j + 1].line - points[j].line;
          if (span <= 0) span = 1;
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

    var maxScroll = previewEl.scrollHeight - previewEl.clientHeight;
    var want = Math.max(0, Math.min(maxScroll, targetTop));
    if (Math.abs(previewEl.scrollTop - want) > 1) {
      isSyncing = true;
      previewEl.scrollTop = want;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { isSyncing = false; }, 100);
    }
  }

  // ── Message handler ──

  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'update':
        renderMarkdown(msg.content || '');
        break;
      case 'scroll-sync':
        // Use rAF to ensure DOM has settled after any recent render
        requestAnimationFrame(function () {
          scrollToLine(msg.topLine, msg.fraction || 0);
        });
        break;
    }
  });

  // ── Initial render ──
  renderMarkdown('');
  if (previewEl) {
    previewEl.innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:var(--text-muted,#999);">' +
      '<h2 style="color:var(--text-secondary,#666);font-weight:500;">Luogu Markdown Preview</h2>' +
      '<p style="font-size:14px;max-width:400px;margin:12px auto;line-height:1.6;">' +
      'Start editing in the left panel to see live preview here.</p></div>';
  }
})();
