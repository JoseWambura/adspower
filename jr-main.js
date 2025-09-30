// ==UserScript==
// @name         JR Sports: Human-like Scroll + Recent Posts Random Nav, Close @13
// @namespace    http://tampermonkey.net/
// @version      3.8
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
   *  A) IMAGE CONTROL - DISABLED due to CSP conflicts
   ******************************************************************/
  console.log('[HumanScroll] Image blocking disabled - CSP handles image restrictions');

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
  const SCROLL_DIST_MIN_PX = 800, SCROLL_DIST_MAX_PX = 1200;
  const SCROLL_DUR_MIN_MS  = 3000, SCROLL_DUR_MAX_MS  = 5000;
  const MIN_SCROLL_CYCLES  = Math.floor(Math.random() * (4 - 3 + 1)) + 3; // 3–4 cycles
  const READ_PAUSE_MIN_MS  = 4000,  READ_PAUSE_MAX_MS  = 5000;
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
  /******************************************************************
   *  A) IMAGE CONTROL - DISABLED due to CSP conflicts
   ******************************************************************/
  console.log('[HumanScroll] Image blocking disabled - CSP handles image restrictions');

  /******************************************************************
   *  B) AD SLOT MONITORING - Just observe without interfering
   ******************************************************************/
  (function monitorAdSlots() {
    console.log('[AdMonitor] Monitoring ad slots - CSP may block some ads');
    
    // Monitor after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkAdSlots, 3000);
      });
    } else {
      setTimeout(checkAdSlots, 3000);
    }
    
    function checkAdSlots() {
      const adContainers = document.querySelectorAll('[id*="gpt-"], [id*="ad-"], [class*="ad-"], [id*="div-gpt-"]');
      console.log('[AdMonitor] Found', adContainers.length, 'ad containers');
      
      adContainers.forEach(container => {
        const hasContent = container.innerHTML.trim() !== '';
        const hasHeight = container.offsetHeight > 10;
        const isVisible = !container.hidden && container.style.display !== 'none';
        console.log('[AdMonitor] Container', container.id, 
                   '- Has content:', hasContent, 
                   '- Has height:', hasHeight,
                   '- Visible:', isVisible);
      });
      
      // Also check for GPT API
      if (window.googletag && googletag.apiReady) {
        console.log('[AdMonitor] GPT API is ready');
        const slots = googletag.pubads().getSlots();
        console.log('[AdMonitor] GPT slots registered:', slots.length);
      } else {
        console.log('[AdMonitor] GPT API not ready or not available');
      }
    }
  })();
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
