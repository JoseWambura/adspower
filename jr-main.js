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
   * A) IMAGE CONTROL - DISABLED due to CSP conflicts
   ******************************************************************/
  console.log('[HumanScroll] Image blocking disabled - CSP handles image restrictions');

  /******************************************************************
   * B) HUMAN-LIKE SCROLLER
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

  const START_DELAY_MS    = Math.floor(Math.random() * (25000 - 20000 + 1)) + 20000; // 20–25s
  const SCROLL_DIST_MIN_PX = 800, SCROLL_DIST_MAX_PX = 1200;
  const SCROLL_DUR_MIN_MS  = 2000, SCROLL_DUR_MAX_MS  = 4000; // 2–4s
  const MIN_SCROLL_CYCLES = Math.floor(Math.random() * (5 - 4 + 1)) + 4; // 4–5 cycles
  const READ_PAUSE_MIN_MS  = 3000, READ_PAUSE_MAX_MS  = 4000; // 3–4s
  const BOTTOM_CONFIRM_MS  = 5000; // 5s

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
   * C) Recent Posts ONLY — rotation & GA event
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
    if (getNavCount() >= 3) { tryCloseTab('limit reached before target nav'); return; }
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
   * D) Read More fallback (only if no Recent Posts found)
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
   * E) Flow — scroll to bottom, then go to Random Recent Post (or Read More)
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
   * G) AD LOADING WAIT - Ensure ads load before scrolling
   ******************************************************************/
  function waitForAdsToLoad() {
    return new Promise(resolve => {
      console.log('[AdWait] Waiting for ads or DOM to load...');
      let checks = 0;
      const maxChecks = 6; // 6s max for SunBrowser
      function checkAds() {
        checks++;
        const contentSelectors = '.entry-content, .inside-article, article';
        const content = document.querySelector(contentSelectors);
        const adSelectors = '#gpt-passback2, #gpt-rect1, #gpt-passback3, #gpt-passback4, .ad-container, .adsbygoogle';
        const mainAdContainers = content ? Array.from(content.querySelectorAll(adSelectors)) : Array.from(document.querySelectorAll(adSelectors));
        const gptPassback2 = content ? content.querySelector('#gpt-passback2') : document.querySelector('#gpt-passback2');
        const gptRect1 = content ? content.querySelector('#gpt-rect1') : document.querySelector('#gpt-rect1');
        const loadedAds = mainAdContainers.filter(container => container.innerHTML.length > 500 && container.offsetHeight > 50);
        const isGptPassback2Loaded = gptPassback2 && gptPassback2.innerHTML.length > 500 && gptPassback2.offsetHeight >= 280;
        const isGptRect1Loaded = gptRect1 && gptRect1.innerHTML.length > 500 && gptRect1.offsetHeight >= 250;
        console.log(`[AdWait] Check ${checks}: ${loadedAds.length}/${mainAdContainers.length} ads, #gpt-passback2: ${!!isGptPassback2Loaded}, #gpt-rect1: ${!!isGptRect1Loaded}, DOM children: ${document.body.children.length}`);
        if (isGptPassback2Loaded || isGptRect1Loaded || loadedAds.length >= 2 || checks >= maxChecks || document.body.children.length > 0) {
          console.log(`[AdWait] Proceeding - #gpt-passback2: ${!!isGptPassback2Loaded}, #gpt-rect1: ${!!isGptRect1Loaded}, ${loadedAds.length} ads, ${checks} checks`);
          resolve();
        } else {
          setTimeout(checkAds, 1000);
        }
      }
      const observer = new MutationObserver(checkAds);
      observer.observe(document.body, { childList: true, subtree: true });
      checkAds();
    });
  }

  /******************************************************************
   * F) Kickoff
   ******************************************************************/
  setTimeout(async function () {
    const pageStartTime = performance.now();
    checkAndSendDepth();
    if (getNavCount() >= 3) { tryCloseTab('limit reached before scrolling'); return; }
    setTimeout(() => {
      if (performance.now() - pageStartTime > 90000) {
        console.log('[HumanScroll] Max page time reached (90s). Forcing navigation.');
        navigateToRecentTarget();
      }
    }, 90000);
    await waitForAdsToLoad();
    const contentSelectors = '.entry-content, .inside-article, article';
    const content = document.querySelector(contentSelectors);
    const adSelectors = '#gpt-passback2, #gpt-rect1, #gpt-passback3, #gpt-passback4, .ad-container, .adsbygoogle';
    const adContainers = (content ? Array.from(content.querySelectorAll(adSelectors)) : Array.from(document.querySelectorAll(adSelectors)))
      .filter(c => c.innerHTML.length > 500 && c.offsetHeight > 50);
    const adIframes = Array.from(document.querySelectorAll('iframe')).filter(f => {
      try {
        return f.offsetHeight > 50 && f.offsetWidth > 100 && f.src && f.src !== 'about:blank';
      } catch {
        return false;
      }
    });
    const allAds = [...adContainers, ...adIframes];
    let pausedUntil = 0;
    function scrollAdToCenter(adEl) {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          try {
            const rect = adEl.getBoundingClientRect();
            const adCenterY = window.scrollY + rect.top + rect.height / 2;
            const targetScrollY = adCenterY - window.innerHeight / 2;
            const totalPx = targetScrollY - window.scrollY;
            const duration = randInt(1000, 2000);
            console.log('[HumanScroll] Scrolling to center ad:', adEl.id || adEl.className, 'distance:', totalPx, 'px, duration:', duration, 'ms');
            animateScrollByPx(totalPx, duration).then(resolve);
          } catch (e) {
            console.warn('[HumanScroll] Error centering ad:', e.message);
            resolve();
          }
        });
      });
    }
    function simulateHover() {
      const hoverable = allAds.length ? allAds : document.querySelectorAll('a');
      if (hoverable.length) {
        const el = hoverable[Math.floor(Math.random() * hoverable.length)];
        const evtOver = new MouseEvent('mouseover', { bubbles: true });
        const evtOut = new MouseEvent('mouseout', { bubbles: true });
        el.dispatchEvent(evtOver);
        setTimeout(() => el.dispatchEvent(evtOut), randInt(2000, 5000));
        console.log('[HumanScroll] Hovering on:', el.tagName, el.id || el.href || '');
      }
    }
    if (allAds.length) {
      console.log('[HumanScroll] Found', allAds.length, 'ads for pausing/centering.');
      const viewedAds = new Set();
      let isProcessingAd = false;
      const maxAdsToProcess = randInt(2, 3);
      let adsProcessed = 0;
      const observer = new IntersectionObserver(entries => {
        entries.forEach(async entry => {
          if (
            entry.isIntersecting &&
            entry.intersectionRatio > 0.3 &&
            !viewedAds.has(entry.target) &&
            !isProcessingAd &&
            performance.now() >= pausedUntil &&
            adsProcessed < maxAdsToProcess
          ) {
            isProcessingAd = true;
            if (Math.random() < 0.05) {
              console.log('[HumanScroll] Ad ignored (5% skip):', entry.target.id || entry.target.className);
              viewedAds.add(entry.target);
              isProcessingAd = false;
              return;
            }
            console.log('[HumanScroll] Ad visible:', entry.target.id || entry.target.className);
            await scrollAdToCenter(entry.target);
            viewedAds.add(entry.target);
            adsProcessed++;
            simulateHover();
            const pauseDuration = 5000;
            pausedUntil = performance.now() + pauseDuration;
            console.log('[HumanScroll] Pausing for 5s (', adsProcessed, '/', maxAdsToProcess, 'ads processed).');
            setTimeout(() => {
              isProcessingAd = false;
              if (performance.now() - pageStartTime > 90000) {
                console.log('[HumanScroll] Ad pause exceeded 90s. Forcing navigation.');
                observer.disconnect();
                navigateToRecentTarget();
              }
            }, pauseDuration);
          }
        });
      }, { threshold: 0.3 });
      allAds.forEach(ad => observer.observe(ad));
    }
    console.log('[HumanScroll] Starting human-like scrolling');
    runScrollsUntilBottomThenAct();
  }, START_DELAY_MS);
})();
