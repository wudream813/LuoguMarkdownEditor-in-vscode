/**
 * Preview webview script for Luogu Markdown Editor v1.0.12
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

  // Loaded Bilibili videos are kept as LIVE <iframe> elements keyed by src URL.
  // Every edit triggers a full innerHTML re-render, which used to DESTROY any
  // playing video and reload it (resetting progress) on every keystroke. Now,
  // before each re-render the iframes are moved to a hidden parking container —
  // re-appending an element that never left the document does NOT reload it, so
  // playback position and buffering survive.
  var loadedBilibiliVideos = new Map();
  var videoParking = null;

  function getVideoParking() {
    if (!videoParking) {
      videoParking = document.createElement('div');
      videoParking.id = 'bilibili-video-parking';
      videoParking.style.display = 'none';
      document.body.appendChild(videoParking);
    }
    return videoParking;
  }

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

    // Reuse the existing live iframe for this src if we have one — creating a new
    // element would start the video over.
    var iframe = loadedBilibiliVideos.get(src);
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.setAttribute('src', src);
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('frameborder', 'no');
      iframe.setAttribute('framespacing', '0');
      iframe.setAttribute('allowfullscreen', 'true');
      // referrerpolicy='origin' is REQUIRED and must be explicit. The iframe's
      // policy propagates to every request the player makes INSIDE the frame;
      // Bilibili's video CDN (upos-*.bilivideo.com) hotlink-checks the Referer
      // and 403s anything that isn't a bilibili.com origin (verified: empty →
      // 403, player.bilibili.com → 206). Relying on the inherited default is
      // fragile (the outer webview page's own policy may yield an EMPTY Referer
      // — exactly what made metadata load but never a single video frame).
      // 'origin' pins the Referer to https://player.bilibili.com regardless of
      // what the outer webview does.
      iframe.setAttribute('referrerpolicy', 'origin');
      // allow-same-origin + allow-forms are REQUIRED: without same-origin the
      // player runs as an opaque origin — localStorage/cookies are blocked and
      // Bilibili's player init crashes into a black "video won't load" screen.
      // Deliberately NO allow-top-navigation (must not let the player hijack
      // the whole webview panel to bilibili.com).
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation');
      loadedBilibiliVideos.set(src, iframe);
    }

    // Find the wrapper and replace the facade button with the iframe
    var wrapper = btn.closest('.luogu-bilibili-player-wrapper');
    if (wrapper) {
      wrapper.innerHTML = '';
      wrapper.appendChild(iframe);   // move, not recreate — playback keeps running
    } else {
      btn.replaceWith(iframe);
    }
  };

  window.toggleTaskCheckbox = function (checkbox) {
    var taskLine = checkbox.getAttribute('data-task-line');
    var isChecked = checkbox.checked;

    if (vscodeApi && taskLine !== null) {
      // Send the DOCUMENT LINE stamped by the parser (data-task-line), not a
      // re-counted ordinal — two independent task-counting implementations can
      // diverge on messy fences/quotes and flip the wrong line.
      vscodeApi.postMessage({
        type: 'toggle-task',
        taskLine: parseInt(taskLine, 10),
        checked: isChecked
      });
    }
  };

  // ── Callout state preservation ──

  function saveCalloutStates() {
    // Key by ORDINAL (position among callouts), not data-src-line: typing above a
    // callout shifts every line number, so a line-keyed restore applied each
    // saved open/closed state to the WRONG callout. Ordinal order is stable under
    // line edits and only shifts if a callout itself is inserted/removed.
    var states = {};
    if (!previewEl) return states;
    var idx = 0;
    previewEl.querySelectorAll('details.luogu-callout').forEach(function (d) {
      states[idx++] = d.hasAttribute('open');
    });
    return states;
  }

  function restoreCalloutStates(states) {
    if (!previewEl) return;
    var idx = 0;
    previewEl.querySelectorAll('details.luogu-callout').forEach(function (d) {
      var key = idx++;
      if (Object.prototype.hasOwnProperty.call(states, key)) {
        if (states[key]) d.setAttribute('open', '');
        else d.removeAttribute('open');
      }
    });
  }

  // ── Bilibili iframe preservation across re-renders ──

  function parkBilibiliVideos() {
    if (loadedBilibiliVideos.size === 0) return;
    var parking = getVideoParking();
    loadedBilibiliVideos.forEach(function (iframe) {
      if (iframe.isConnected && iframe.parentNode !== parking) {
        parking.appendChild(iframe);   // keeps the element (and playback) alive
      }
    });
  }

  function restoreBilibiliVideos() {
    if (!previewEl) return;
    previewEl.querySelectorAll('.luogu-bilibili-facade').forEach(function (btn) {
      var src = btn.getAttribute('data-src');
      if (src && loadedBilibiliVideos.has(src)) {
        // Move the SAME iframe back into place — no reload.
        window.loadBilibiliPlayer(btn);
      }
    });
    // Prune videos whose markdown was deleted: after a full restore any iframe
    // still parked has no facade waiting for it in the document.
    var parking = getVideoParking();
    var stale = [];
    loadedBilibiliVideos.forEach(function (iframe, src) {
      if (iframe.parentNode === parking) stale.push(src);
    });
    stale.forEach(function (src) {
      var iframe = loadedBilibiliVideos.get(src);
      if (iframe.remove) iframe.remove();
      loadedBilibiliVideos.delete(src);
    });
  }

  // ── Render ──

  function render(markdown) {
    if (!previewEl || !parser) return;
    var saved = saveCalloutStates();
    parkBilibiliVideos();
    previewEl.innerHTML = parser.render(markdown || '');
    restoreCalloutStates(saved);
    restoreBilibiliVideos();
    // A re-render REPLACES innerHTML under the scroll container; if the content
    // got shorter the browser clamps scrollTop, which fires a 'scroll' event.
    // That must not be relayed to the editor as a user scroll.
    lastProgrammaticScroll = Date.now();
  }

  // ── Scroll sync ──

  // Loop prevention for the bidirectional sync: scroll events caused BY a sync
  // (programmatic scrollTo below, or a re-render clamping scrollTop) must not be
  // relayed back to the editor, and the editor-side reveal it triggers must not
  // sync back here (the extension swallows that echo). Anything within
  // SUPPRESS_MS of a programmatic scroll is considered non-user input.
  var lastProgrammaticScroll = 0;
  var SUPPRESS_MS = 400; // covers the smooth-scroll animation tail

  // Collect [data-src-line] anchors as sorted {line, top-in-document} points,
  // plus a sentinel at the document bottom. Shared by both sync directions.
  function collectAnchorPoints(scrollContainer) {
    if (!previewEl) return null;
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
    if (anchors.length === 0) return null;

    var containerTop = scrollContainer.getBoundingClientRect().top;
    var points = anchors.map(function (a) {
      var rect = a.el.getBoundingClientRect();
      return { line: a.line, top: rect.top + scrollContainer.scrollTop - containerTop };
    });
    points.push({ line: 999999, top: scrollContainer.scrollHeight }); // sentinel
    return points;
  }

  // NOTE: there used to be an `isSyncing` lock here that DROPPED scroll-sync
  // messages arriving within 150ms of a programmatic smooth scroll — it ate the
  // FINAL landing position when the user scrolled right as the preview opened.
  // Messages are always honored now; loop prevention uses precise timestamp
  // suppression on the relay side instead of dropping inbound syncs.
  function scrollToLine(topLine, instant) {
    if (!previewEl) return;

    // The scrollable container is document.body (see preview.css)
    var scrollContainer = document.body;
    var points = collectAnchorPoints(scrollContainer);
    if (!points) return;

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
      lastProgrammaticScroll = Date.now(); // starting now, scrolls are machine-made
      // 'instant' positioning (opening the preview, switching files) must jump —
      // smooth animation there reads as the preview drifting on its own.
      scrollContainer.scrollTo({ top: want, behavior: instant ? 'auto' : 'smooth' });
    }
  }

  // Reverse mapping for preview→editor sync: which source line is at the top of
  // the preview viewport right now? Returns a FRACTIONAL line (or null).
  function lineForScrollTop() {
    var scrollContainer = document.body;
    var points = collectAnchorPoints(scrollContainer);
    if (!points) return null;
    var st = scrollContainer.scrollTop;
    if (st <= points[0].top) return points[0].line;
    for (var i = 0; i < points.length - 1; i++) {
      if (points[i].top <= st && points[i + 1].top >= st) {
        var span = points[i + 1].top - points[i].top;
        var t = span > 0 ? (st - points[i].top) / span : 0;
        t = Math.max(0, Math.min(1, t));
        // Never interpolate INTO the sentinel (line 999999): scrolling through
        // the tail below the last anchor would report absurd line numbers.
        var nextLine = points[i + 1].line >= 999999 ? points[i].line : points[i + 1].line;
        return points[i].line + (nextLine - points[i].line) * t;
      }
    }
    return points[points.length - 2].line;
  }

  // Relay USER scrolls of the preview up to the extension, throttled (~80ms)
  // with a trailing fire so the final position always lands. Programmatic
  // scrolls (suppression window) are ignored — relaying them would create a
  // sync loop between the two panes.
  var relayTimer = null;
  document.body.addEventListener('scroll', function () {
    if (Date.now() - lastProgrammaticScroll < SUPPRESS_MS) return;
    if (relayTimer) return;
    relayTimer = setTimeout(function () {
      relayTimer = null;
      if (Date.now() - lastProgrammaticScroll < SUPPRESS_MS) return;
      var line = lineForScrollTop();
      if (line === null || !vscodeApi) return;
      vscodeApi.postMessage({ type: 'preview-scrolled', topLine: line });
    }, 80);
  }, { passive: true });

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
        requestAnimationFrame(function () { scrollToLine(msg.topLine, msg.instant); });
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
