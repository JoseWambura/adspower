(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    /******************************************************************
     * 0) Navigation Counter & Auto-Close (Fixed 3 Pages)
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
        limit = 3;
        try { sessionStorage.setItem(LIMIT_KEY, String(limit)); } catch {}
      }
      return limit;
    }

    function beforeNavigateIncrement() {
      const n = getNavCount() + 1;
      const limit = getNavLimit();
      setNavCount(n);
      console.log('[HumanScroll] Navigation count =', n, '/', limit);
      if (n >= limit) tryCloseTab(`limit reached (${limit})`);
    }

    function tryCloseTab(reason) {
      console.log('[HumanScroll] Closing tab:', reason);
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
      if (getNavCount() >= getNavLimit()) {
        setTimeout(() => tryCloseTab(`limit reached on load`), 1200);
      }
    })();

    /******************************************************************
     * A) Scroll Tracking & Ad Waiting
     ******************************************************************/
    const START_DELAY_MS = Math.floor(Math.random() * (25000 - 20000 + 1)) + 20000;
    const MAX_PAGE_TIME_MS = 90000;
    const MIN_PAGE_TIME_MS = Math.floor(Math.random() * (90000 - 70000 + 1)) + 70000;
    const SCROLL_DIST_MIN_PX = 800, SCROLL_DIST_MAX_PX = 1200;
    const SCROLL_DUR_MIN_MS = 3000, SCROLL_DUR_MAX_MS = 4000;
    const MIN_SCROLL_CYCLES = Math.floor(Math.random() * (5 - 4 + 1)) + 4;
    const BOTTOM_CONFIRM_MS = 5000;

    function atBottom(threshold = 2) {
      const y = window.pageYOffset || document.documentElement.scrollTop || 0;
      const view = window.innerHeight || document.documentElement.clientHeight || 0;
      const doc = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight
      );
      return y + view >= doc - threshold;
    }

    function animateScrollByPx(totalPx, durationMs) {
      return new Promise(resolve => {
        const startY = window.pageYOffset;
        const startT = performance.now();
        let lastY = startY;

        function frame(now) {
          const elapsed = now - startT;
          const t = Math.min(1, elapsed / durationMs);
          const progress = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          const targetY = startY + totalPx * progress;
          const delta = targetY - lastY;

          if (atBottom() && totalPx > 0) return resolve();
          window.scrollBy(0, delta);
          lastY = targetY;
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        }

        requestAnimationFrame(frame);
      });
    }

    function simulateHover() {
      const targets = document.querySelectorAll('#gpt-rect1, .adsbygoogle, a');
      const el = targets[Math.floor(Math.random() * targets.length)];
      if (el) {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        setTimeout(() => el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })), 3000);
        console.log('[HumanScroll] Simulated hover:', el.tagName, el.id || el.href || '');
      }
    }

    function getRecentPostLinks() {
      const selectors = ['aside.widget_recent_entries a', '.wp-block-latest-posts__list a'];
      let links = [];

      selectors.forEach(sel => {
        links = links.concat([...document.querySelectorAll(sel)]);
      });

      return links.map(a => a.href).filter(href => {
        try {
          return new URL(href).host === location.host;
        } catch {
          return false;
        }
      });
    }

    function navigateToRandomRecentPost() {
      const links = getRecentPostLinks();
      if (!links.length) {
        console.warn('[HumanScroll] No recent post links found. Going home.');
        return (location.href = '/');
      }

      const href = links[Math.floor(Math.random() * links.length)];
      console.log('[HumanScroll] Navigating to:', href);
      beforeNavigateIncrement();
      location.href = href;
    }

    function waitForAdsToLoad() {
      return new Promise(resolve => {
        const maxTries = 6;
        let tries = 0;
        function check() {
          const el = document.querySelector('#gpt-rect1');
          if (el && el.innerHTML.length > 500 && el.offsetHeight > 50) {
            return resolve();
          }
          if (++tries >= maxTries) return resolve();
          setTimeout(check, 1000);
        }
        check();
      });
    }

    async function runHumanScroll(pageStart) {
      let cycles = 0;
      while (cycles < MIN_SCROLL_CYCLES || !atBottom()) {
        if (performance.now() - pageStart > MAX_PAGE_TIME_MS) break;
        const dist = Math.floor(Math.random() * (SCROLL_DIST_MAX_PX - SCROLL_DIST_MIN_PX + 1)) + SCROLL_DIST_MIN_PX;
        const dur = Math.floor(Math.random() * (SCROLL_DUR_MAX_MS - SCROLL_DUR_MIN_MS + 1)) + SCROLL_DUR_MIN_MS;

        await animateScrollByPx(dist, dur);
        if (Math.random() < 0.3) simulateHover();
        await new Promise(r => setTimeout(r, 3000));
        cycles++;
      }

      setTimeout(() => {
        if (atBottom()) {
          console.log('[HumanScroll] Finished scrolls, navigating...');
          navigateToRandomRecentPost();
        } else {
          console.log('[HumanScroll] Scroll incomplete, retrying...');
          runHumanScroll(pageStart);
        }
      }, BOTTOM_CONFIRM_MS);
    }

    /******************************************************************
     * Start after delay
     ******************************************************************/
    setTimeout(async () => {
      const pageStart = performance.now();

      if (getNavCount() >= getNavLimit()) {
        tryCloseTab(`limit reached before scrolling`);
        return;
      }

      await waitForAdsToLoad();
      runHumanScroll(pageStart);
    }, START_DELAY_MS);

  });
})();
