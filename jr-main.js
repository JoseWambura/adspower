// ==UserScript==
// @name         JR Sports: Human-like Scroll + Recent Posts Random Nav, Close @3
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Human-like scroll, then ONLY open a random "Recent Posts" link (no search/category links). Tracks visited recent posts per tab (no repeats) and sends a GA event before navigation. Enforces a 3-page limit and closes tab after that.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /******************************************************************
   * 0) Navigation counter & auto-close after 3
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
    if (n >= 3) {
      console.log('[HumanScroll] Navigation count reached', n, '— will attempt to close on next page load.');
    } else {
      console.log('[HumanScroll] Navigation count =', n);
    }
  }
  function tryCloseTab(reason) {
    console.log('[HumanScroll] Attempting to close tab (' + reason + ')…');
    try { window.stop(); } catch {}
    try {
      document.documentElement.innerHTML = '';
      document.title = 'Done';
      document.documentElement.style.background = '#fff';
    } catch {}

    try { location.replace('about:blank'); } catch {}
    setTimeout(() => { try { location.href = 'about:blank'; } catch {} }, 150);

    try { window.close(); } catch {}
    setTimeout(() => { try { window.open('', '_self'); window.close(); } catch {} }, 150);
  }

  (function maybeCloseOnLoad() {
    const n = getNavCount();
    if (n >= 3) {
      setTimeout(() => tryCloseTab('limit reached on load (>=3)'), 1200);
    }
  })();

  /******************************************************************
   *  B) HUMAN-LIKE SCROLLER (unchanged, corrected timing)
   ******************************************************************/
  (function () {
    const pv = (parseInt(sessionStorage.getItem('pv_count') || '0', 10) + 1);
    sessionStorage.setItem('pv_count', String(pv));
    window.__pageviews_in_tab = pv;
    console.log('[HumanScroll]', 'This is the ' + pv + ' page load in this tab.');
  })();

  const START_DELAY_MS    = Math.floor(Math.random() * (22000 - 18000 + 1)) + 18000; // 18–22s
  const SCROLL_DIST_MIN_PX = 800, SCROLL_DIST_MAX_PX = 1200;
  const SCROLL_DUR_MIN_MS  = 2000, SCROLL_DUR_MAX_MS  = 3000;
  const MIN_SCROLL_CYCLES = Math.floor(Math.random() * (7 - 6 + 1)) + 6; // 6–7 cycles
  const READ_PAUSE_MIN_MS  = 5000,  READ_PAUSE_MAX_MS  = 7000;
  const BOTTOM_CONFIRM_MS  = 8000;

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
      const pauseDuration = randInt(READ_PAUSE_MIN_MS, READ_PAUSE_MAX_MS);
      return new Promise(function (r) { setTimeout(r, pauseDuration); });
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
  function isGoodRecentLink(el) {
    if (!el || !el.href) return false;
    const url = el.href;
    if (!sameHost(url)) return false;
    if (/\/(search|category|tag|page|author|comment)/i.test(url)) return false;
    if (!/\/recent\/\d+/.test(url)) return false;
    return true;
  }

  function buildRecentPool() {
    let pool = [];
    try {
      const anchors = document.querySelectorAll('a');
      for (const a of anchors) {
        if (isGoodRecentLink(a)) pool.push(a.href);
      }
      pool = [...new Set(pool)]; // dedupe
      sessionStorage.setItem(RECENT_POOL_KEY, JSON.stringify(pool));
    } catch { }
    return pool;
  }

  function getRecentPool() {
    try {
      let pool = JSON.parse(sessionStorage.getItem(RECENT_POOL_KEY));
      if (!Array.isArray(pool) || pool.length < 2) pool = buildRecentPool();
      return pool;
    } catch { return buildRecentPool(); }
  }

  function getVisited() {
    try {
      return JSON.parse(sessionStorage.getItem(RECENT_VISITED_KEY)) || [];
    } catch { return []; }
  }

  function setVisited(arr) {
    try { sessionStorage.setItem(RECENT_VISITED_KEY, JSON.stringify(arr)); } catch {}
  }

  function pickRandomRecentLink() {
    const pool = getRecentPool();
    const visited = getVisited();
    const unvisited = pool.filter(u => !visited.includes(u));
    if (unvisited.length === 0) {
      setVisited([]);
      return pickRandomRecentLink();
    }
    const chosen = unvisited[Math.floor(Math.random() * unvisited.length)];
    return chosen || null;
  }

  function sendGAPostClick(url) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'click_recent_post', {
        event_category: 'RecentPosts',
        event_label: url,
        page_location: location.href,
        page_title: document.title,
      });
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: 'click_recent_post',
        url: url,
        page_location: location.href,
        page_title: document.title,
      });
    }
  }

  function navigateToRecentTarget() {
    const target = pickRandomRecentLink();
    if (!target) {
      console.log('[HumanScroll] No recent target found, not navigating.');
      return;
    }
    beforeNavigateIncrement();
    const visited = getVisited();
    visited.push(target);
    setVisited(visited);
    sendGAPostClick(target);
    console.log('[HumanScroll] Navigating to recent post:', target);
    location.href = target;
  }

  /******************************************************************
   *  D) Ads detection + wait (timeout 15 sec)
   ******************************************************************/
  function waitForAdsToLoad() {
    return new Promise(function (resolve) {
      const MAX_WAIT_MS = 15000;
      const startTime = performance.now();

      function checkAds() {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const adsPresent = iframes.some(iframe => {
          const rect = iframe.getBoundingClientRect();
          return (
            rect.width > 0 && rect.height > 0 &&
            /ads|doubleclick|googleads|googlesyndication/i.test(iframe.src + iframe.className)
          );
        });
        if (adsPresent) {
          resolve();
        } else if (performance.now() - startTime > MAX_WAIT_MS) {
          resolve();
        } else {
          setTimeout(checkAds, 250);
        }
      }
      checkAds();
    });
  }

  /******************************************************************
   *  E) Run with max total timeout to prevent hangs (90 seconds max)
   ******************************************************************/
  const MAX_TOTAL_TIME_MS = 90000;

  async function scrollWithLogging() {
    let cyclesDone = 0;

    async function loop() {
      if (cyclesDone < MIN_SCROLL_CYCLES || !atBottom()) {
        await doOneScrollCycle();
        cyclesDone++;
        if (atBottom() && cyclesDone >= MIN_SCROLL_CYCLES) {
          return new Promise((resolve) => {
            confirmBottomStable(() => {
              checkAndSendDepth();
              navigateToRecentTarget();
              resolve();
            });
          });
        }
        return loop();
      } else {
        await doOneScrollCycle();
        return loop();
      }
    }

    await loop();
  }

  async function runWithTimeout(promise, timeoutMs, onTimeout) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error('Timeout'));
        if (onTimeout) onTimeout();
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /******************************************************************
   *  F) Kickoff after randomized delay
   ******************************************************************/
  setTimeout(async () => {
    if (getNavCount() >= 3) {
      tryCloseTab('limit reached before scrolling');
      return;
    }

    try {
      await runWithTimeout(waitForAdsToLoad(), MAX_TOTAL_TIME_MS, () => {
        console.warn('[HumanScroll] Ad wait timeout reached, proceeding anyway.');
      });
    } catch (e) {
      console.warn('[HumanScroll] Ad wait error or timeout:', e.message);
    }

    try {
      await runWithTimeout(scrollWithLogging(), MAX_TOTAL_TIME_MS, () => {
        console.warn('[HumanScroll] Scroll timeout reached, forcing close.');
        tryCloseTab('scroll timeout');
      });
    } catch (e) {
      console.warn('[HumanScroll] Scroll error or timeout:', e.message);
    }
  }, START_DELAY_MS);

})();
