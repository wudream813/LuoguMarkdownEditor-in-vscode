/**
 * Preview webview script for Luogu Markdown Editor v1.0.7
 */
(function () {
  'use strict';

  var parser = null;
  if (typeof LuoguParser !== 'undefined') {
    parser = new LuoguParser({
      katex: typeof katex !== 'undefined' ? katex : null,
      prism: typeof Prism !== 'undefined' ? Prism : null
    });
  }
  if (typeof Prism !== 'undefined') Prism.manual = true;

  var previewEl = document.getElementById('previewContent');
  var vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  var scrollSyncLock = false;

  // ── Global functions for inline onclick handlers ──

  window.copyCodeBlock = function (btn) {
    var wrapper = btn.closest('.luogu-code-block-wrapper');
    if (!wrapper) return;
    var lines = wrapper.querySelectorAll('.code-line-text');
    var text = lines.length > 0
      ? Array.from(lines).map(function (el) { return el.innerText; }).join('\n')
      : (wrapper.querySelector('pre code') || {}).innerText || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        var span = btn.querySelector('.copy-text') || btn;
        var orig = span.innerText;
        span.innerText = '已复制';
        setTimeout(function () { span.innerText = orig; }, 1800);
      });
    }
  };

  window.loadBilibiliPlayer = function (btn) {
    var src = btn.getAttribute('data-src');
    if (!src) return;
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0;';
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    // No sandbox - Bilibili player needs same-origin for its API
    var container = btn.closest('.luogu-bilibili-player-wrapper') || btn.parentNode;
    if (container) {
      btn.remove();
      container.appendChild(iframe);
    } else {
      btn.replaceWith(iframe);
    }
  };

  window.toggleTaskCheckbox = function () {};

  // ── Callout state preservation ──

  function saveCalloutStates() {
    var states = {};
    if (!previewEl) return states;
    previewEl.querySelectorAll('details.luogu-callout').forEach(function (d) {
      var line = d.getAttribute('data-src-line');
      if (line !== null) states[line] = d.hasAttribute('open');
    });
    return states;
  }

  function restoreCalloutStates(states) {
    if (!previewEl) return;
    previewEl.querySelectorAll('details.luogu-callout').forEach(function (d) {
      var line = d.getAttribute('data-src-line');
      if (line !== null && states.hasOwnProperty(line)) {
        if (states[line]) d.setAttribute('open', '');
        else d.removeAttribute('open');
      }
    });
  }

  // ── Render ──

  function render(markdown) {
    if (!previewEl || !parser) return;
    var saved = saveCalloutStates();
    previewEl.innerHTML = parser.render(markdown || '');
    restoreCalloutStates(saved);
  }

  // ── Scroll sync ──

  function scrollToLine(topLine) {
    if (!previewEl || scrollSyncLock) return;

    var anchors = [];
    var seen = {};
    previewEl.querySelectorAll('[data-src-line]').forEach(function (el) {
      var line = parseInt(el.getAttribute('data-src-line'), 10);
      if (isNaN(line) || seen[line]) return;
      // Skip elements inside collapsed details
      if (el.closest && el.closest('details:not([open])')) return;
      seen[line] = true;
      anchors.push({ line: line, el: el });
    });
    anchors.sort(function (a, b) { return a.line - b.line; });
    if (anchors.length === 0) return;

    // Build pixel positions
    var scrollTop = previewEl.scrollTop;
    var containerTop = previewEl.getBoundingClientRect().top;
    var points = anchors.map(function (a) {
      return { line: a.line, top: a.el.getBoundingClientRect().top - containerTop + scrollTop };
    });
    // Add end point
    points.push({ line: 999999, top: previewEl.scrollHeight });

    // Find interpolation segment
    var target = 0;
    for (var i = 0; i < points.length - 1; i++) {
      if (points[i].line <= topLine && points[i + 1].line >= topLine) {
        var span = points[i + 1].line - points[i].line;
        var t = span > 0 ? (topLine - points[i].line) / span : 0;
        target = points[i].top + (points[i + 1].top - points[i].top) * Math.min(1, Math.max(0, t));
        break;
      }
    }

    var maxScroll = previewEl.scrollHeight - previewEl.clientHeight;
    var want = Math.max(0, Math.min(maxScroll, target));

    if (Math.abs(previewEl.scrollTop - want) > 2) {
      scrollSyncLock = true;
      previewEl.scrollTop = want;
      setTimeout(function () { scrollSyncLock = false; }, 80);
    }
  }

  // ── Theme ──

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Also add class to body for CSS compatibility
    document.body.classList.remove('vscode-light', 'vscode-dark');
    document.body.classList.add(theme === 'dark' ? 'vscode-dark' : 'vscode-light');
  }

  // ── Message handler ──

  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'update':
        render(msg.content);
        break;
      case 'scroll-sync':
        // Use rAF to wait for DOM to settle after render
        requestAnimationFrame(function () { scrollToLine(msg.topLine); });
        break;
      case 'set-theme':
        setTheme(msg.theme);
        break;
    }
  });

  // ── Init ──
  render('');
  if (previewEl) {
    previewEl.innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:#888;">' +
      '<h2 style="color:#666;font-weight:500;">Luogu Markdown Preview</h2>' +
      '<p style="font-size:14px;margin-top:12px;">Start editing to see live preview.</p></div>';
  }

  // Notify extension host that webview is ready
  if (vscodeApi) {
    vscodeApi.postMessage({ type: 'ready' });
  }
})();
