// ==UserScript==
// @name         JR Sports: Human-like Scroll + Recent Posts Random Nav, Close @Random
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Human-like scroll with pauses on ads, random navigation limit (mostly 7-12 pages, rarely 3-6), hover events, scrollstart events, occasional burst scrolls, 10% back-and-forth scrolling. Ensures 70-90s per page, then auto-navigate. Tracks visited recent posts per tab (no repeats) and sends GA events.
// @match        https://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /******************************************************************
   * 0) Navigation counter & auto-close after random limit (7-12 mostly, 3-6 rarely)
   ******************************************************************/
  const NAV_KEY = '__hs_nav_count';
  const LIMIT_KEY = '__hs_nav_limit';
  function getNavCount() {
    try { return parseInt(sessionStorage.getItem(NAV_KEY) || '0', 10) || 0; } catch { return 0; }
  }
  function setNavCount(n) {
    try { sessionStorage.setItem(NAV_KEY, String(n)); } catch {}
  }
  function getNavLimit() {
    let limit = parseInt(sessionStorage.getItem(LIMIT_KEY), 10);
    if (!limit) {
      // 5% chance for 3-6, else 7-12
      const rare = Math.random() < 0.05;
      limit = rare ? Math.floor(Math.random() * (6 - 3 + 1)) + 3 : Math.floor(Math.random() * (12 - 7 + 1)) + 7;
      try { sessionStorage.setItem(LIMIT_KEY, String(limit)); } catch {}
    }
    return limit;
  }
  function beforeNavigateIncrement() {
    const n = getNavCount() + 1;
    const limit = getNavLimit();
    setNavCount(n);
    if (n >= limit) {
      console.log('[HumanScroll] Navigation count reached', n, '/', limit, '— will attempt to close on next page load.');
    } else {
      console.log('[HumanScroll] Navigation count =', n, '/', limit);
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
    const limit = getNavLimit();
    if (n >= limit) {
      setTimeout(() => tryCloseTab(`limit reached on load (>=${limit})`), 1200);
    }
  })();

  /******************************************************************
   *  A) IMAGE CONTROL - DISABLED due to CSP conflicts
   ******************************************************************/
  console.log('[HumanScroll] Image blocking disabled - CSP handles image restrictions');

  /******************************************************************
   *  B) HUMAN-LIKE SCROLLER with enhancements
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

  let pausedUntil = 0;
  const MIN_PAGE_TIME_MS = Math.floor(Math.random() * (90000 - 70000 + 1)) + 70000; // 70–90s
  const MAX_PAGE_TIME_MS = 90000; // 90s max
  const START_DELAY_MS = Math.floor(Math.random() * (25000 - 20000 + 1)) + 20000; // 20–25s
  const SCROLL_DIST_MIN_PX = 800, SCROLL_DIST_MAX_PX = 1200;
  const BURST_DIST_MIN_PX = 400, BURST_DIST_MAX_PX = 800;
  const SCROLL_DUR_MIN_MS = 5000, SCROLL_DUR_MAX_MS = 7000;
  const BURST_DUR_MIN_MS = 1000, BURST_DUR_MAX_MS = 2000;
  const MIN_SCROLL_CYCLES = Math.floor(Math.random() * (5 - 4 + 1)) + 4; // 4–5 cycles
  const READ_PAUSE_MIN_MS = 4000, READ_PAUSE_MAX_MS = 6000; // Adjusted for shorter cycles
  const BOTTOM_CONFIRM_MS = 10000;
  const BACK_FORTH_PROB = 0.10; // 10% chance for back-and-forth
  const BURST_PROB = 0.05; // 5% chance for burst scroll per cycle

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
  function dispatchScrollStart() {
    const event = new Event('scrollstart', { bubbles: true });
    window.dispatchEvent(event);
    if (typeof window.gtag === 'function') { window.gtag('event', 'scroll_start', { page_location: location.href, page_title: document.title }); }
    else if (Array.isArray(window.dataLayer)) { window.dataLayer.push({ event: 'scroll_start', page_location: location.href, page_title: document.title }); }
  }
  function checkAndSendDepth() {
    const pct = getPercentScrolled();
    for (let i = 0; i < BREAKPOINTS.length; i++) {
      if (pct >= BREAKPOINTS[i]) sendScrollDepth(BREAKPOINTS[i]);
    }
  }
  const firedPercents = new Set();
  const BREAKPOINTS = [25, 50, 75, 90, 100];
  window.addEventListener('scroll', function () {
    if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t);
    checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth);
  }, { passive: true });

  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function animateScrollByPx(totalPx, durationMs) {
    return new Promise(function (resolve) {
      const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const startT = performance.now();
      let lastY = startY;
      let totalPaused = 0;
      let currentPauseStart = 0;
      (function frame(now) {
        if (now < pausedUntil) {
          if (currentPauseStart === 0) {
            currentPauseStart = now;
          }
          requestAnimationFrame(frame);
          return;
        }
        if (currentPauseStart !== 0) {
          totalPaused += now - currentPauseStart;
          currentPauseStart = 0;
        }
        const elapsed = now - startT - totalPaused;
        const t = Math.min(1, elapsed / durationMs);
        const progress = easeInOutQuad(t);
        const targetY = startY + totalPx * progress;
        const delta = targetY - lastY;
        if (atBottom() && totalPx > 0) { resolve(); return; }
        if (window.pageYOffset <= 0 && totalPx < 0) { resolve(); return; }
        window.scrollBy(0, delta);
        lastY = targetY;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      })(performance.now());
    });
  }

  async function doOneScrollCycle(isBackForth = false) {
    let dist = randInt(SCROLL_DIST_MIN_PX, SCROLL_DIST_MAX_PX);
    let dur = randInt(SCROLL_DUR_MIN_MS, SCROLL_DUR_MAX_MS);
    if (Math.random() < BURST_PROB) {
      console.log('[HumanScroll] Burst scroll!');
      dist = randInt(BURST_DIST_MIN_PX, BURST_DIST_MAX_PX);
      dur = randInt(BURST_DUR_MIN_MS, BURST_DUR_MAX_MS);
      const chainCount = Math.random() < 0.3 ? randInt(2, 3) : 1;
      for (let i = 0; i < chainCount; i++) {
        dispatchScrollStart();
        await animateScrollByPx(dist, dur);
      }
    } else {
      dispatchScrollStart();
      if (isBackForth) dist = -dist;
      await animateScrollByPx(dist, dur);
    }
    checkAndSendDepth();
    await new Promise(r => setTimeout(r, randInt(READ_PAUSE_MIN_MS, READ_PAUSE_MAX_MS)));
  }

  function confirmBottomStable(pageStartTime, cb) {
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
      if (Math.abs(newHeight - initialHeight) < 4) {
        const elapsed = performance.now() - pageStartTime;
        const remaining = MIN_PAGE_TIME_MS - elapsed;
        if (remaining > 0) {
          console.log('[HumanScroll] Scrolling done early, waiting', Math.round(remaining / 1000), 's to reach min page time');
          setTimeout(cb, remaining);
        } else {
          cb();
        }
      }
    }, BOTTOM_CONFIRM_MS);
  }

  // Simulate hover over ads primarily, then links
  function simulateHover() {
    const adElements = document.querySelectorAll('#gpt-passback2, #gpt-passback3, #gpt-passback4, #gpt-rect1, .ad-container, .adsbygoogle');
    const hoverable = adElements.length ? adElements : document.querySelectorAll('a');
    if (hoverable.length) {
      const el = hoverable[Math.floor(Math.random() * hoverable.length)];
      const evtOver = new MouseEvent('mouseover', { bubbles: true });
      const evtOut = new MouseEvent('mouseout', { bubbles: true });
      el.dispatchEvent(evtOver);
      setTimeout(() => el.dispatchEvent(evtOut), randInt(2000, 5000));
      console.log('[HumanScroll] Hovering on:', el.tagName, el.id || el.href || '');
    }
  }

  /******************************************************************
   *  C) Recent Posts ONLY — rotation & GA event
   ******************************************************************/
  const RECENT_POOL_KEY = '__hs_recent_pool_v1';
  const RECENT_VISITED_KEY = '__hs_recent_visited_v1';

  function sameHost(url) { try { return new URL(url, location.href).host === location.host; } catch { return false; } }
  function isGoodHref(href) {
    if (!href) return false;
    const s = href.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:') || s.startsWith('tel:')) return false;
    return true;
  }

  function getRecentPostLinks() {
    const recentSelectors = [
      'aside.widget_recent_entries a.wp-block-latest-posts__post-title',
      'aside.widget_recent_entries .wp-block-latest-posts__list a',
      '.wp-block-latest-posts__list a.wp-block-latest-posts__post-title',
      'aside.widget_recent_entries .wp-block-latest-posts__list li > a'
    ];
    let links = [];
    recentSelectors.forEach(sel => {
      links = links.concat(Array.from(document.querySelectorAll(sel)));
    });
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

    let pool = candidates.filter(h => !visited.has(h));
    if (!pool.length) {
      visited.clear();
      saveVisited(visited);
      pool = candidates.slice();
    }

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
    } catch (e) {}
  }

  function navigateToRecentTarget() {
    const limit = getNavLimit();
    if (getNavCount() >= limit) { tryCloseTab(`limit reached before target nav (${limit})`); return; }
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
      console.warn('[HumanScroll] No Read More links found. Falling back to homepage…');
      setTimeout(() => {
        beforeNavigateIncrement();
        location.href = '/';
      }, 1000);
      return;
    }
    const link = links[Math.floor(Math.random() * links.length)];
    const rect = link.getBoundingClientRect();
    const targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    const targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));
    const cursor = createFakeCursor();
    moveCursorTo(cursor, 60, 60);

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
   *  E) Flow — scroll to bottom with enhancements, then go to Random Recent Post (or Read More)
   ******************************************************************/
  async function runScrollsUntilBottomThenAct(pageStartTime) {
    let cyclesDone = 0;
    const doBackForth = Math.random() < BACK_FORTH_PROB;
    if (doBackForth) console.log('[HumanScroll] Back-and-forth scrolling enabled.');
    while (cyclesDone < MIN_SCROLL_CYCLES || !atBottom()) {
      if (performance.now() - pageStartTime > MAX_PAGE_TIME_MS) {
        console.log('[HumanScroll] Max page time reached (90s). Forcing navigation.');
        navigateToRecentTarget();
        return;
      }
      await doOneScrollCycle();
      cyclesDone++;
      if (Math.random() < 0.3) simulateHover();
      if (doBackForth && Math.random() < 0.5 && cyclesDone > 1) {
        const backForthCycles = randInt(2, 3);
        console.log('[HumanScroll] Performing', backForthCycles, 'back-and-forth cycles.');
        for (let i = 0; i < backForthCycles; i++) {
          await doOneScrollCycle(true); // Up
          await doOneScrollCycle(); // Down
        }
      }
    }
    confirmBottomStable(pageStartTime, function () {
      checkAndSendDepth();
      console.log('[HumanScroll] Reached bottom after', cyclesDone, 'cycles. Going to a random Recent Post…');
      navigateToRecentTarget();
    });
  }
  /******************************************************************
   *  G) AD LOADING WAIT - Ensure ads load before scrolling
   ******************************************************************/
  function waitForAdsToLoad() {
    return new Promise((resolve) => {
      console.log('[AdWait] Waiting for ads to load...');
      let checks = 0;
      const maxChecks = 30;

      function checkAds() {
        checks++;
        const adSelectors = '#gpt-passback2, #gpt-passback3, #gpt-passback4, #gpt-rect1, .ad-container, .adsbygoogle';
        const mainAdContainers = document.querySelectorAll(adSelectors);
        const loadedAds = Array.from(mainAdContainers).filter(container => {
          return container.innerHTML.length > 500 && container.offsetHeight > 50;
        });

        console.log(`[AdWait] Check ${checks}: ${loadedAds.length}/${mainAdContainers.length} ads loaded`);

        if (loadedAds.length >= 2 || checks >= maxChecks) {
          console.log(`[AdWait] Proceeding - ${loadedAds.length} ads loaded after ${checks} seconds`);
          resolve();
        } else {
          setTimeout(checkAds, 1000);
        }
      }

      // Watch for dynamically loaded ads
      const observer = new MutationObserver(() => {
        checkAds();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      checkAds();
    });
  }
  /******************************************************************
   *  F) Kickoff - Wait for ads then scroll
   ******************************************************************/
  setTimeout(async function () {
    const pageStartTime = performance.now();
    checkAndSendDepth();
    const limit = getNavLimit();
    if (getNavCount() >= limit) { tryCloseTab(`limit reached before scrolling (${limit})`); return; }

    // Global timeout for max page time
    setTimeout(() => {
      if (performance.now() - pageStartTime > MAX_PAGE_TIME_MS) {
        console.log('[HumanScroll] Global timeout reached (90s). Forcing navigation.');
        navigateToRecentTarget();
      }
    }, MAX_PAGE_TIME_MS);

    // WAIT FOR ADS TO LOAD BEFORE SCROLLING
    await waitForAdsToLoad();

    // Set up ad pausing
    const adSelectors = '#gpt-passback2, #gpt-passback3, #gpt-passback4, #gpt-rect1, .ad-container, .adsbygoogle';
    const adContainers = Array.from(document.querySelectorAll(adSelectors)).filter(container => container.innerHTML.length > 500 && container.offsetHeight > 50);
    if (adContainers.length) {
      console.log('[HumanScroll] Found ' + adContainers.length + ' loaded ads for pausing.');
      const viewedAds = new Set();
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3 && !viewedAds.has(entry.target)) {
            viewedAds.add(entry.target);
            const now = performance.now();
            pausedUntil = Math.max(pausedUntil, now) + 30000;
            console.log('[HumanScroll] Ad visible:', entry.target.id || entry.target.className, '— pausing for 30s.');
            simulateHover(); // Hover during ad pause
          }
        });
      }, { threshold: 0.3 });
      adContainers.forEach(ad => observer.observe(ad));
    }

    console.log('[HumanScroll] Starting human-like scrolling after ads loaded');
    runScrollsUntilBottomThenAct(pageStartTime);
  }, START_DELAY_MS);

})();
