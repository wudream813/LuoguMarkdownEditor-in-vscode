/**
 * Preview webview script for Luogu Markdown Editor v1.0.8
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

  // Track loaded Bilibili videos by their src URL
  var loadedBilibiliVideos = new Set();

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
    
    // Track this video as loaded
    loadedBilibiliVideos.add(src);
    
    var iframe = document.createElement('iframe');
    iframe.setAttribute('src', src);
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', 'no');
    iframe.setAttribute('framespacing', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-presentation');
    
    // Find the wrapper and replace button with iframe
    var wrapper = btn.closest('.luogu-bilibili-player-wrapper');
    if (wrapper) {
      wrapper.innerHTML = '';
      wrapper.appendChild(iframe);
    } else {
      btn.replaceWith(iframe);
    }
  };

  window.toggleTaskCheckbox = function (checkbox) {
    var taskIndex = checkbox.getAttribute('data-task-index');
    var isChecked = checkbox.checked;
    
    if (vscodeApi && taskIndex !== null) {
      vscodeApi.postMessage({
        type: 'toggle-task',
        taskIndex: parseInt(taskIndex, 10),
        checked: isChecked
      });
    }
  };

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

  // ── Bilibili auto-load for previously loaded videos ──

  function restoreBilibiliVideos() {
    if (!previewEl || loadedBilibiliVideos.size === 0) return;
    previewEl.querySelectorAll('.luogu-bilibili-facade').forEach(function (btn) {
      var src = btn.getAttribute('data-src');
      if (src && loadedBilibiliVideos.has(src)) {
        // Auto-load this video
        window.loadBilibiliPlayer(btn);
      }
    });
  }

  // ── Render ──

  function render(markdown) {
    if (!previewEl || !parser) return;
    var saved = saveCalloutStates();
    previewEl.innerHTML = parser.render(markdown || '');
    restoreCalloutStates(saved);
    restoreBilibiliVideos();
  }

  // ── Scroll sync ──
  
  var isSyncing = false;
  var scrollTimeout = null;

  function scrollToLine(topLine) {
    if (!previewEl || isSyncing) return;

    var anchors = [];
    var seen = {};
    previewEl.querySelectorAll('[data-src-line]').forEach(function (el) {
      var line = parseInt(el.getAttribute('data-src-line'), 10);
      if (isNaN(line) || seen[line]) return;
      if (el.closest && el.closest('details:not([open])')) return;
      seen[line] = true;
      anchors.push({ line: line, el: el });
    });
    anchors.sort(function (a, b) { return a.line - b.line; });
    if (anchors.length === 0) return;

    // The scrollable container is document.body (see preview.css)
    var scrollContainer = document.body;
    
    // Calculate positions for each anchor
    var points = anchors.map(function (a) {
      var rect = a.el.getBoundingClientRect();
      return { 
        line: a.line, 
        top: rect.top + scrollContainer.scrollTop - scrollContainer.getBoundingClientRect().top 
      };
    });
    
    // Add endpoint
    points.push({ line: 999999, top: scrollContainer.scrollHeight });

    // Find the two anchors that bracket our target line
    var target = 0;
    for (var i = 0; i < points.length - 1; i++) {
      if (points[i].line <= topLine && points[i + 1].line >= topLine) {
        // Interpolate between these two points
        var span = points[i + 1].line - points[i].line;
        var t = span > 0 ? (topLine - points[i].line) / span : 0;
        t = Math.max(0, Math.min(1, t));
        target = points[i].top + (points[i + 1].top - points[i].top) * t;
        break;
      }
    }

    var maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    var want = Math.max(0, Math.min(maxScroll, target));

    if (Math.abs(scrollContainer.scrollTop - want) > 2) {
      isSyncing = true;
      scrollContainer.scrollTo({ top: want, behavior: 'smooth' });
      setTimeout(function () { isSyncing = false; }, 150);
    }
  }

  // ── Theme ──

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.remove('vscode-light', 'vscode-dark');
    document.body.classList.add(theme === 'dark' ? 'vscode-dark' : 'vscode-light');
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'theme-changed', theme: theme });
    }
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

  if (vscodeApi) {
    vscodeApi.postMessage({ type: 'ready' });
  }
})();
