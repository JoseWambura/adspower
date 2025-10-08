// ==UserScript==
// @name         JR Sports: Human Scroll + Recent Post Nav (8 Pages Max)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Human-like scroll, wait for ads, then navigate to a random recent post. Limit to 8 pages. Logs current page number.
// @match        *://jrsports.click/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MAX_PAGES = randInt(10, 12);;
  const NAV_KEY = '__hs_nav_count';

  function getNavCount() {
    try {
      return parseInt(sessionStorage.getItem(NAV_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function setNavCount(n) {
    try {
      sessionStorage.setItem(NAV_KEY, String(n));
    } catch {}
  }

  function beforeNavigateIncrement() {
    const n = getNavCount() + 1;
    setNavCount(n);
    console.log(`[HumanScroll] Navigating to page ${n} of ${MAX_PAGES}`);
    if (n >= MAX_PAGES) {
      console.warn(`[HumanScroll] Page limit (${MAX_PAGES}) reached.`);
    }
  }

  function tryCloseTab(reason) {
    console.warn(`[HumanScroll] Closing tab (${reason})`);
    try { window.stop(); } catch {}
    try {
      document.body.innerHTML = '';
      document.title = 'Done';
      document.body.style.background = '#fff';
    } catch {}

    try { location.replace('about:blank'); } catch {}
    setTimeout(() => { try { location.href = 'about:blank'; } catch {} }, 150);

    try { window.close(); } catch {}
    setTimeout(() => { try { window.open('', '_self'); window.close(); } catch {} }, 200);
  }

  if (getNavCount() >= MAX_PAGES) {
    setTimeout(() => tryCloseTab('page limit hit on load'), 1000);
    return;
  }

  // Wait for ads
  function waitForAdsToLoad() {
    return new Promise((resolve) => {
      console.log('[AdWait] Waiting for ads to load...');
      let checks = 0;
      const maxChecks = 30;

      function checkAds() {
        checks++;
        const adSelectors = ['#gpt-passback2', '#gpt-passback3', '#gpt-passback4', '#gpt-rect1'];
        const ads = adSelectors.map(sel => document.querySelector(sel)).filter(el => el);
        const loadedAds = ads.filter(ad => ad.innerHTML.length > 500 && ad.offsetHeight > 50);

        console.log(`[AdWait] Check ${checks}: ${loadedAds.length}/${ads.length} ads loaded`);

        if (loadedAds.length >= 2 || checks >= maxChecks) {
          console.log('[AdWait] Proceeding after ad check');
          resolve();
        } else {
          setTimeout(checkAds, 1000);
        }
      }

      checkAds();
    });
  }

  // Scroll logic
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function animateScrollByPx(totalPx, durationMs) {
    return new Promise(resolve => {
      const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const startT = performance.now();
      let lastY = startY;

      (function step(now) {
        const elapsed = now - startT;
        const t = Math.min(1, elapsed / durationMs);
        const progress = easeInOutQuad(t);
        const targetY = startY + totalPx * progress;
        const delta = targetY - lastY;

        if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
          resolve();
          return;
        }

        window.scrollBy(0, delta);
        lastY = targetY;

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      })(performance.now());
    });
  }

  function doOneScrollCycle() {
    const dist = randInt(800, 1200);
    const dur = randInt(5000, 7000);
    return animateScrollByPx(dist, dur).then(() => {
      return new Promise(r => setTimeout(r, randInt(10000, 12000)));
    });
  }

  // Recent post logic
  function getRecentPostLinks() {
    const selectors = [
      'aside.widget_recent_entries a',
      '.wp-block-latest-posts__list a'
    ];
    let anchors = [];
    selectors.forEach(sel => {
      anchors = anchors.concat(Array.from(document.querySelectorAll(sel)));
    });
    const links = anchors
      .map(a => a.href)
      .filter(h => h && h.startsWith(location.origin));
    return [...new Set(links)];
  }

  function pickRecentTarget() {
    const visited = new Set(JSON.parse(sessionStorage.getItem('__recent_visited') || '[]'));
    let pool = getRecentPostLinks().filter(url => !visited.has(url));

    if (pool.length === 0) {
      visited.clear();
      pool = getRecentPostLinks();
    }

    const target = pool[Math.floor(Math.random() * pool.length)];
    visited.add(target);
    sessionStorage.setItem('__recent_visited', JSON.stringify([...visited]));
    return target;
  }

  function navigateToRecentPost() {
    const target = pickRecentTarget();
    if (!target) {
      console.warn('[HumanScroll] No recent post found. Staying on page.');
      return;
    }
    setTimeout(() => {
      beforeNavigateIncrement();
      location.href = target;
    }, randInt(1200, 1800));
  }

  function scrollToBottomThenNavigate() {
  function isAtBottom() {
    return (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 50);
  }

  (function loop() {
    if (isAtBottom()) {
      console.log('[HumanScroll] Reached bottom. Navigating to recent post...');
      navigateToRecentPost();
      return;
    }

    doOneScrollCycle().then(loop);
  })();
}

  // Start script
  const START_DELAY = randInt(20000, 25000);
  setTimeout(async () => {
    console.log(`[HumanScroll] Starting after delay (${START_DELAY} ms)`);
    await waitForAdsToLoad();
    scrollToBottomThenNavigate();
  }, START_DELAY);

})();
