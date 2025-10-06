(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const MAX_PAGE_TIME_MS = 90000;   // 90 s
    const START_DELAY_MS = 20000 + Math.random() * 5000; // 20–25 s
    const adWaitTimeout = 5000;       // 5 s max to wait for ad
    const BOTTOM_THRESHOLD = 20;      // allow 20px slack for bottom detection

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

    function getNavCount() {
      try { return parseInt(sessionStorage.getItem('__hs_nav_count')||'0',10) || 0; } catch { return 0; }
    }
    function setNavCount(n) {
      try { sessionStorage.setItem('__hs_nav_count', String(n)); } catch {}
    }
    function getNavLimit() {
      try {
        const lim = parseInt(sessionStorage.getItem('__hs_nav_limit'),10);
        if (lim) return lim;
      } catch {}
      try { sessionStorage.setItem('__hs_nav_limit','3'); } catch {}
      return 3;
    }
    function beforeNavigate() {
      const cnt = getNavCount()+1;
      setNavCount(cnt);
      console.log('[HumanScroll] Nav count:', cnt);
      if (cnt >= getNavLimit()) tryCloseTab('nav limit reached');
    }

    function atBottom() {
      const y = window.pageYOffset || document.documentElement.scrollTop || 0;
      const view = window.innerHeight || document.documentElement.clientHeight;
      const doc = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      );
      return y + view >= doc - BOTTOM_THRESHOLD;
    }

    function waitForAdsToLoad() {
      return new Promise((resolve) => {
        let resolved = false;
        const el = document.querySelector('#gpt-rect1');
        function check() {
          if (resolved) return;
          if (el && el.innerHTML.length > 200 && el.offsetHeight > 50) {
            resolved = true;
            console.log('[HumanScroll] Ad detected, proceeding');
            resolve();
            return;
          }
        }
        // initial check and periodic checks
        check();
        const interval = setInterval(check, 500);
        // fallback after timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn('[HumanScroll] Ad wait timeout, proceeding anyway');
            resolve();
          }
        }, adWaitTimeout);
      });
    }

    function navigateFallback() {
      // pick recent links or Go Home
      const links = Array.from(document.querySelectorAll('a')).filter(a => {
        const txt = (a.textContent||'').toLowerCase();
        return txt.includes('read more') || a.classList.contains('more-link');
      });
      if (links.length) {
        const link = links[Math.floor(Math.random()*links.length)];
        console.log('[HumanScroll] Fallback click to:', link.href);
        beforeNavigate();
        try { link.click(); } catch { location.href = link.href; }
      } else {
        console.warn('[HumanScroll] No fallback link, going to homepage');
        beforeNavigate();
        location.href = '/';
      }
    }

    async function runScrollAndThenNavigate(startTime) {
      // if page too short, directly fallback
      if (document.body.scrollHeight <= window.innerHeight + 50) {
        console.log('[HumanScroll] Page too short to scroll, immediate fallback');
        navigateFallback();
        return;
      }

      // do scroll cycles with max time guard
      const MIN_CYCLES = 3;
      let cycles = 0;
      const SCROLL_DIST_MIN = 800, SCROLL_DIST_MAX = 1200;
      const SCROLL_DUR_MIN = 3000, SCROLL_DUR_MAX = 4000;

      function rand(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
      }
      function animateScroll(dist, dur) {
        return new Promise(res => {
          const startY = window.pageYOffset;
          const t0 = performance.now();
          function frame(t) {
            const elapsed = t - t0;
            const frac = Math.min(1, elapsed / dur);
            const y = startY + dist * frac;
            window.scrollTo(0, y);
            if (frac < 1) requestAnimationFrame(frame);
            else res();
          }
          requestAnimationFrame(frame);
        });
      }

      while (cycles < MIN_CYCLES || !atBottom()) {
        if (performance.now() - startTime > MAX_PAGE_TIME_MS) {
          console.warn('[HumanScroll] Max scroll time exceeded, forcing fallback');
          navigateFallback();
          return;
        }
        const dist = rand(SCROLL_DIST_MIN, SCROLL_DIST_MAX);
        const dur = rand(SCROLL_DUR_MIN, SCROLL_DUR_MAX);
        await animateScroll(dist, dur);
        cycles++;
        if (atBottom()) break;
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      }

      // if bottom reached or cycles done
      console.log('[HumanScroll] Scroll done, navigating');
      navigateFallback();
    }

    // Kickoff
    setTimeout(async () => {
      const startTime = performance.now();

      if (getNavCount() >= getNavLimit()) {
        tryCloseTab('limit reached before start');
        return;
      }

      console.log('[HumanScroll] Kickoff after delay');
      await waitForAdsToLoad();

      // Global guard: after MAX_PAGE_TIME_MS, force fallback
      setTimeout(() => {
        console.warn('[HumanScroll] Global timeout reached, fallback');
        navigateFallback();
      }, MAX_PAGE_TIME_MS);

      runScrollAndThenNavigate(startTime);

    }, START_DELAY_MS);

  });
})();
