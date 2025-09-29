// ==UserScript==
// @name         JR Sports: Block Images (except Google Ads) + Human-like Scroll (+ Recent Posts Random Nav, Close @13)
// @namespace    http://tampermonkey.net/
// @version      3.7
// @description  Human-like scroll, then ONLY open a random "Recent Posts" link (no search/category links). Tracks visited recent posts per tab (no repeats) and sends a GA event before navigation. Enforces a 13-page limit and closes.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /******************************************************************
   * 0) Navigation counter & auto-close after 13
   ******************************************************************/
  const NAV_KEY = '__hs_nav_count';
  function getNavCount() {
    try { return parseInt(sessionStorage.getItem(NAV_KEY) || '0', 10) || 0; } catch { return 0; }
  }
  function setNavCount(n) {
    try { sessionStorage.setItem(NAV_KEY, String(n)); } catch {}
  }
  function beforeNavigateIncrement() {
    const n = getNavCount() + 1;
    setNavCount(n);
    if (n >= 13) {
      console.log('[HumanScroll] Navigation count reached', n, '— will attempt to close on next page load.');
    } else {
      console.log('[HumanScroll] Navigation count =', n);
    }
  }
  function tryCloseTab(reason) {
  console.log('[HumanScroll] Attempting to close tab (' + reason + ')…');

  // Stop network activity and blank the page (works even when window.close() is blocked)
  try { window.stop(); } catch {}
  try {
    document.documentElement.innerHTML = '';
    document.title = 'Done';
    document.documentElement.style.background = '#fff';
  } catch {}

  // Best-effort navigate to inert page
  try { location.replace('about:blank'); } catch {}
  setTimeout(() => { try { location.href = 'about:blank'; } catch {} }, 150);

  // If the tab was opened by script, these may actually close it
  try { window.close(); } catch {}
  setTimeout(() => { try { window.open('', '_self'); window.close(); } catch {} }, 150);
}

  (function maybeCloseOnLoad() {
    const n = getNavCount();
    if (n >= 13) {
      setTimeout(() => tryCloseTab('limit reached on load (>=13)'), 1200);
    }
  })();

  /******************************************************************
   *  A) IMAGE CONTROL — allow Google Ads, block other images/iframes
   ******************************************************************/
  const HIDE_NON_AD_IFRAMES = true;

  const ALLOW_HOSTS = [
    /\.googlesyndication\.com$/i,
    /\.doubleclick\.net$/i,
    /\.googleusercontent\.com$/i,
    /\.gstatic\.com$/i,
    /\.googleadservices\.com$/i,
    /\.google\.com$/i,
    /\.googletagservices\.com$/i
  ];

  function isAllowedURL(url) {
    try { const u = new URL(url, location.href); return ALLOW_HOSTS.some(rx => rx.test(u.host)); }
    catch (_) { return false; }
  }

  (function hardBlockMediaSetters() {
    const imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imgDesc && imgDesc.set) {
      const origGet = imgDesc.get, origSet = imgDesc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: false, enumerable: imgDesc.enumerable,
        get: origGet,
        set: function (v) { if (isAllowedURL(v)) return origSet.call(this, v); this.removeAttribute('src'); }
      });
    }
    const imgSetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
    if (imgSetDesc && imgSetDesc.set) {
      const oget = imgSetDesc.get, oset = imgSetDesc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
        configurable: false, enumerable: imgSetDesc.enumerable,
        get: oget,
        set: function (v) {
          if (typeof v === 'string') {
            const ok = v.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
            if (ok) return oset.call(this, v);
          }
          this.removeAttribute('srcset');
        }
      });
    }
    const srcsetDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset');
    if (srcsetDesc && srcsetDesc.set) {
      const oget = srcsetDesc.get, oset = srcsetDesc.set;
      Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
        configurable: false, enumerable: srcsetDesc.enumerable,
        get: oget,
        set: function (v) {
          if (typeof v === 'string') {
            const ok = v.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
            if (ok) return oset.call(this, v);
          }
          this.removeAttribute('srcset');
        }
      });
    }
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
    if (srcDesc && srcDesc.set) {
      const oget = srcDesc.get, oset = srcDesc.set;
      Object.defineProperty(HTMLSourceElement.prototype, 'src', {
        configurable: false, enumerable: srcDesc.enumerable,
        get: oget,
        set: function (v) { if (isAllowedURL(v)) return oset.call(this, v); this.removeAttribute('src'); }
      });
    }
    const origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      const tag = this.tagName;
      const n = String(name).toLowerCase();
      if (tag === 'IMG' && (n === 'src' || n === 'srcset')) {
        if (n === 'src' && isAllowedURL(value)) return origSetAttr.call(this, name, value);
        if (n === 'srcset') {
          const ok = String(value).split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
          if (ok) return origSetAttr.call(this, name, value);
        }
        return;
      }
      if (tag === 'SOURCE' && (n === 'src' || n === 'srcset')) {
        if (n === 'src' && isAllowedURL(value)) return origSetAttr.call(this, name, value);
        if (n === 'srcset') {
          const ok = String(value).split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
          if (ok) return origSetAttr.call(this, name, value);
        }
        return;
      }
      return origSetAttr.call(this, name, value);
    };
  })();

  function stripExistingMedia() {
    document.querySelectorAll('img[src], img[srcset], img[data-src], img[data-srcset]').forEach(img => {
      const src = img.getAttribute('src');
      const srcset = img.getAttribute('srcset');
      const ds = img.getAttribute('data-src');
      const dss = img.getAttribute('data-srcset');
      if (src && !isAllowedURL(src)) img.removeAttribute('src');
      if (srcset) {
        const ok = srcset.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) img.removeAttribute('srcset');
      }
      if (ds && !isAllowedURL(ds)) img.removeAttribute('data-src');
      if (dss) {
        const ok2 = dss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok2) img.removeAttribute('data-srcset');
      }
      img.removeAttribute('sizes');
      img.setAttribute('loading', 'lazy');
    });
    document.querySelectorAll('picture source[src], picture source[srcset], source[src], source[srcset]').forEach(s => {
      const src = s.getAttribute('src');
      const ss = s.getAttribute('srcset');
      if (src && !isAllowedURL(src)) s.removeAttribute('src');
      if (ss) {
        const ok = ss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) s.removeAttribute('srcset');
      }
      s.removeAttribute('sizes');
    });
  }

  function observeNewMedia() {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'IMG') sanitizeImg(n);
          else if (n.tagName === 'SOURCE') sanitizeSource(n);
          else if (n.querySelectorAll) {
            n.querySelectorAll('img').forEach(sanitizeImg);
            n.querySelectorAll('source').forEach(sanitizeSource);
          }
        }
        if (m.type === 'attributes') {
          const t = m.target;
          if (t && t.nodeType === 1) {
            if (t.tagName === 'IMG') sanitizeImg(t);
            if (t.tagName === 'SOURCE') sanitizeSource(t);
          }
        }
      }
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'sizes']
    });

    function sanitizeImg(img) {
      const s = img.getAttribute('src');
      if (s && !isAllowedURL(s)) img.removeAttribute('src');
      const ss = img.getAttribute('srcset');
      if (ss) {
        const ok = ss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) img.removeAttribute('srcset');
      }
      const ds = img.getAttribute('data-src');
      if (ds && !isAllowedURL(ds)) img.removeAttribute('data-src');
      const dss = img.getAttribute('data-srcset');
      if (dss) {
        const ok2 = dss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok2) img.removeAttribute('data-srcset');
      }
      img.removeAttribute('sizes');
    }
    function sanitizeSource(s) {
      const src = s.getAttribute('src');
      if (src && !isAllowedURL(src)) s.removeAttribute('src');
      const ss = s.getAttribute('srcset');
      if (ss) {
        const ok = ss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) s.removeAttribute('srcset');
      }
      s.removeAttribute('sizes');
    }
  }

  function setupIframeHider() {
    if (!HIDE_NON_AD_IFRAMES) return;
    function isAllowedIframeURL(url) {
      try { const u = new URL(url, location.href); return ALLOW_HOSTS.some(rx => rx.test(u.host)); }
      catch (_) { return false; }
    }
    function markHidden(iframe) {
      if (iframe.dataset.__hsHidden === '1') return;
      iframe.dataset.__hsHidden = '1';
      iframe.style.setProperty('display', 'none', 'important');
      iframe.style.setProperty('visibility', 'hidden', 'important');
      iframe.style.setProperty('width', '0px', 'important');
      iframe.style.setProperty('height', '0px', 'important');
      iframe.style.setProperty('min-width', '0', 'important');
      iframe.style.setProperty('min-height', '0', 'important');
      iframe.style.setProperty('border', '0', 'important');
    }
    function maybeHide(iframe) {
      const src = iframe.getAttribute('src') || '';
      if (isAllowedIframeURL(src)) return;
      if (iframe.hasAttribute('srcdoc')) { markHidden(iframe); return; }
      const s = src.toLowerCase();
      const looksLikeImage =
        /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/.test(s) ||
        s.startsWith('data:image/') ||
        /[/?._-](img|image|images|photo|gallery|thumb|media|cdn)[/?._-]?/i.test(s);
      if (looksLikeImage) { markHidden(iframe); return; }
      try {
        const u = new URL(src, location.href);
        if (u.host === location.host && /\/(img|image|images|photo|gallery|media|cdn)\b/i.test(u.pathname)) markHidden(iframe);
      } catch (_) {}
    }
    function sweep(root) { (root || document).querySelectorAll('iframe').forEach(maybeHide); }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => sweep(document), { once: true });
    } else { sweep(document); }
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'IFRAME') maybeHide(n);
          else if (n.querySelectorAll) n.querySelectorAll('iframe').forEach(maybeHide);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  stripExistingMedia();
  observeNewMedia();
  setupIframeHider();
  console.log('[ImgBlock] Active. Allowed image hosts:', ALLOW_HOSTS.map(r => r.source).join(', '));

  /******************************************************************
   *  B) HUMAN-LIKE SCROLLER
   ******************************************************************/
  (function () {
    function ordinal(n) { const j = n % 10, k = n % 100; if (j === 1 && k !== 11) return n + 'st'; if (j === 2 && k !== 12) return n + 'nd'; if (j === 3 && k !== 13) return n + 'rd'; return n + 'th'; }
    try {
      const pv = (parseInt(sessionStorage.getItem('pv_count') || '0', 10) + 1);
      sessionStorage.setItem('pv_count', String(pv));
      window.__pageviews_in_tab = pv;
      console.log('[HumanScroll]', 'This is the ' + ordinal(pv) + ' page load in this tab.');
    } catch (e) {
      console.log('[HumanScroll]', 'sessionStorage unavailable; treating as 1st page load.');
      window.__pageviews_in_tab = 1;
    }
  })();

  const START_DELAY_MS    = Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000; // 15–20s
  const SCROLL_DIST_MIN_PX = 700;
  const SCROLL_DIST_MAX_PX = 1000;
  const SCROLL_DUR_MIN_MS  = 4000;
  const SCROLL_DUR_MAX_MS  = 6000;

  const MIN_SCROLL_CYCLES  = Math.floor(Math.random() * (4 - 3 + 1)) + 3; // 3–4 cycles
  const READ_PAUSE_MIN_MS  = 7000,  READ_PAUSE_MAX_MS  = 9000;
  const BOTTOM_CONFIRM_MS  = 900;

  const firedPercents = new Set();
  const BREAKPOINTS = [25, 50, 75, 90, 100];

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function atBottom(threshold) {
    threshold = threshold || 2;
    const y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const view = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
    const doc = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    return y + view >= doc - threshold;
  }
  function getPercentScrolled() {
    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    const view = window.innerHeight || document.documentElement.clientHeight || 0;
    const full = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    const pos = Math.min(full, y + view);
    return Math.max(0, Math.min(100, Math.round((pos / full) * 100)));
  }
  function sendScrollDepth(percent) {
    if (firedPercents.has(percent)) return; firedPercents.add(percent);
    if (typeof window.gtag === 'function') { window.gtag('event', 'scroll_depth', { percent }); }
    else if (Array.isArray(window.dataLayer)) { window.dataLayer.push({ event: 'scroll_depth', percent, page_location: location.href, page_title: document.title }); }
  }
  function checkAndSendDepth() {
    const pct = getPercentScrolled();
    for (let i = 0; i < BREAKPOINTS.length; i++) {
      if (pct >= BREAKPOINTS[i]) sendScrollDepth(BREAKPOINTS[i]);
    }
  }
  window.addEventListener('scroll', function () {
    if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t);
    checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth);
  }, { passive: true });

  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function animateScrollByPx(totalPx, durationMs) {
    return new Promise(function (resolve) {
      const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const startT = performance.now();
      let lastY  = startY;
      (function frame(now) {
        const elapsed  = now - startT;
        const t        = Math.min(1, elapsed / durationMs);
        const progress = easeInOutQuad(t);
        const targetY  = startY + totalPx * progress;
        const delta    = targetY - lastY;
        if (atBottom()) { resolve(); return; }
        window.scrollBy(0, delta);
        lastY = targetY;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      })(performance.now());
    });
  }

  function doOneScrollCycle() {
    const dist = randInt(SCROLL_DIST_MIN_PX, SCROLL_DIST_MAX_PX);
    const dur  = randInt(SCROLL_DUR_MIN_MS,  SCROLL_DUR_MAX_MS);
    return animateScrollByPx(dist, dur).then(function () {
      checkAndSendDepth();
      return new Promise(function (r) { setTimeout(r, randInt(READ_PAUSE_MIN_MS, READ_PAUSE_MAX_MS)); });
    });
  }

  function confirmBottomStable(cb) {
    const initialHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    setTimeout(function () {
      if (!atBottom()) return;
      const newHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      );
      if (Math.abs(newHeight - initialHeight) < 4) cb();
    }, BOTTOM_CONFIRM_MS);
  }

  /******************************************************************
   *  C) Recent Posts ONLY — rotation & GA event
   ******************************************************************/
  const RECENT_POOL_KEY = '__hs_recent_pool_v1';  // session-scoped
  const RECENT_VISITED_KEY = '__hs_recent_visited_v1'; // session-scoped

  function sameHost(url) { try { return new URL(url, location.href).host === location.host; } catch { return false; } }
  function isGoodHref(href) {
    if (!href) return false;
    const s = href.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:') || s.startsWith('tel:')) return false;
    return true;
  }

  // Collect recent posts anchors from common "Recent Posts" widgets (including your sample)
  function getRecentPostLinks() {
    const recentSelectors = [
      'aside.widget_recent_entries a.wp-block-latest-posts__post-title',
      'aside.widget_recent_entries .wp-block-latest-posts__list a',
      '.wp-block-latest-posts__list a.wp-block-latest-posts__post-title',
      // fallback: any li under recent posts list
      'aside.widget_recent_entries .wp-block-latest-posts__list li > a'
    ];
    let links = [];
    recentSelectors.forEach(sel => {
      links = links.concat(Array.from(document.querySelectorAll(sel)));
    });
    // de-duplicate by href and filter
    const seen = new Set();
    const filtered = [];
    for (const a of links) {
      const href = a.getAttribute('href') || a.href || '';
      if (!isGoodHref(href)) continue;
      try {
        const abs = new URL(href, location.href).href;
        if (!sameHost(abs)) continue;
        if (seen.has(abs)) continue;
        seen.add(abs);
        filtered.push({ el: a, href: abs, text: (a.textContent || '').trim() });
      } catch {}
    }
    return filtered;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function loadVisited() {
    try { return new Set(JSON.parse(sessionStorage.getItem(RECENT_VISITED_KEY) || '[]')); } catch { return new Set(); }
  }
  function saveVisited(set) {
    try { sessionStorage.setItem(RECENT_VISITED_KEY, JSON.stringify(Array.from(set))); } catch {}
  }

  function pickRecentTarget() {
    const candidates = getRecentPostLinks().map(o => o.href);
    if (!candidates.length) return null;
    const visited = loadVisited();

    // Filter out already visited in this tab session
    let pool = candidates.filter(h => !visited.has(h));

    // If everything is visited, reset the pool (start a fresh rotation)
    if (!pool.length) {
      visited.clear();
      saveVisited(visited);
      pool = candidates.slice();
    }

    // Random choice
    const target = pool[Math.floor(Math.random() * pool.length)];
    visited.add(target);
    saveVisited(visited);
    return target;
  }

  function sendGARecentClick(targetUrl, label) {
    label = label || 'click';
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', label, { link_url: targetUrl, page_location: location.href, page_title: document.title });
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: label, link_url: targetUrl, page_location: location.href, page_title: document.title });
      }
    } catch (e) {
      // no-op
    }
  }

  function navigateToRecentTarget() {
    if (getNavCount() >= 13) { tryCloseTab('limit reached before target nav'); return; }
    const target = pickRecentTarget();
    if (!target) {
      console.warn('[HumanScroll] No Recent Posts found. Considering Read More fallback…');
      tryClickReadMoreFallback();
      return;
    }
    const delay = Math.floor(Math.random() * (1600 - 800 + 1)) + 800;
    console.log('[HumanScroll] Recent post chosen:', target, '… navigating in ~', delay, 'ms');
    sendGARecentClick(target, 'click');
    setTimeout(() => {
      beforeNavigateIncrement();
      location.href = target;
    }, delay);
  }

  /******************************************************************
   *  D) Read More fallback (only if no Recent Posts found)
   *     - Priority remains: RECENT POSTS > Read More
   ******************************************************************/
  function createFakeCursor() {
    const cursor = document.createElement('div');
    cursor.style.position = 'fixed';
    cursor.style.top = '0px';
    cursor.style.left = '0px';
    cursor.style.width = '14px';
    cursor.style.height = '14px';
    cursor.style.border = '2px solid #333';
    cursor.style.borderRadius = '50%';
    cursor.style.background = 'rgba(255,255,255,0.85)';
    cursor.style.zIndex = '999999';
    cursor.style.pointerEvents = 'none';
    cursor.style.transition = 'top 0.25s linear, left 0.25s linear';
    document.body.appendChild(cursor);
    return cursor;
  }
  function moveCursorTo(cursor, x, y) { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; }
  function removeCursor(cursor) { if (cursor && cursor.parentNode) cursor.parentNode.removeChild(cursor); }

  function findReadMoreLinks() {
    const all = Array.from(document.querySelectorAll('a[href]'));
    const res = [];
    for (const a of all) {
      const t = (a.textContent || '').trim().toLowerCase();
      const href = a.getAttribute('href') || '';
      if (!isGoodHref(href)) continue;
      if (t.includes('read more') || a.classList.contains('more-link') || /read-?more/i.test(href)) {
        try {
          const abs = new URL(href, location.href).href;
          if (!sameHost(abs)) continue;
          res.push(a);
        } catch {}
      }
    }
    return res;
  }

  function tryClickReadMoreFallback() {
    const links = findReadMoreLinks();
    if (!links.length) {
      console.warn('[HumanScroll] No Read More links found. Staying on page.');
      return;
    }
    const link = links[Math.floor(Math.random() * links.length)];
    const rect = link.getBoundingClientRect();
    const targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    const targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));
    const cursor = createFakeCursor();
    moveCursorTo(cursor, 60, 60);

    // small wander
    setTimeout(() => {
      moveCursorTo(cursor, targetX, targetY);
      setTimeout(() => {
        const url = link.getAttribute('href') || link.href || '';
        try { sendGARecentClick(new URL(url, location.href).href, 'click'); } catch {}
        console.log('[HumanScroll] Clicking Read More fallback:', url);
        beforeNavigateIncrement();
        try { link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
        catch (e) { link.click(); }
        removeCursor(cursor);
      }, 300);
    }, 300);
  }

  /******************************************************************
   *  E) Flow — scroll to bottom, then go to Random Recent Post (or Read More)
   ******************************************************************/
  function runScrollsUntilBottomThenAct() {
    let cyclesDone = 0;
    (function loop() {
      if (cyclesDone < MIN_SCROLL_CYCLES || !atBottom()) {
        doOneScrollCycle().then(function () {
          cyclesDone++;
          if (atBottom() && cyclesDone >= MIN_SCROLL_CYCLES) {
            confirmBottomStable(function () {
              checkAndSendDepth();
              console.log('[HumanScroll] Reached bottom after', cyclesDone, 'cycles. Going to a random Recent Post…');
              navigateToRecentTarget();
            });
          } else { loop(); }
        });
      } else { doOneScrollCycle().then(loop); }
    })();
  }

  /******************************************************************
   *  F) Kickoff
   ******************************************************************/
  setTimeout(function () {
    checkAndSendDepth();
    if (getNavCount() >= 13) { tryCloseTab('limit reached before scrolling'); return; }
    runScrollsUntilBottomThenAct();
  }, START_DELAY_MS);

})();
