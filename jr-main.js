<script>
(function () {
  'use strict';

  /**************************************************************
   * SETTINGS
   **************************************************************/
  const MAX_PAGE_TIME_MS = 90000; // 90s absolute cap
  const START_DELAY_MS = Math.floor(Math.random() * 5000) + 20000; // 20-25s delay
  const SCROLL_CYCLES = 4;
  const SCROLL_DIST_MIN = 800;
  const SCROLL_DIST_MAX = 1200;
  const SCROLL_DURATION_MIN = 3000;
  const SCROLL_DURATION_MAX = 4000;
  const READ_PAUSE_MIN = 3000;
  const READ_PAUSE_MAX = 4000;

  const pageStart = performance.now();

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function atBottom() {
    const y = window.scrollY || window.pageYOffset;
    const h = document.documentElement.scrollHeight;
    const vh = window.innerHeight;
    return y + vh >= h - 2;
  }

  function scrollByPx(pixels, duration) {
    return new Promise(resolve => {
      const start = window.scrollY || window.pageYOffset;
      const end = start + pixels;
      const startTime = performance.now();

      function frame(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const current = start + (end - start) * eased;

        window.scrollTo(0, current);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  async function humanScroll() {
    for (let i = 0; i < SCROLL_CYCLES; i++) {
      if (performance.now() - pageStart >= MAX_PAGE_TIME_MS) {
        console.warn('[HumanScroll] Timeout during scroll loop.');
        break;
      }

      const dist = rand(SCROLL_DIST_MIN, SCROLL_DIST_MAX);
      const dur = rand(SCROLL_DURATION_MIN, SCROLL_DURATION_MAX);

      console.log(`[HumanScroll] Scroll ${i + 1}: ${dist}px over ${dur}ms`);
      await scrollByPx(dist, dur);
      await new Promise(r => setTimeout(r, rand(READ_PAUSE_MIN, READ_PAUSE_MAX)));

      if (atBottom()) {
        console.log('[HumanScroll] Reached bottom.');
        return true;
      }
    }
    return atBottom();
  }

  function navigateToNext() {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
        return true;
      });

    const recent = links.find(a => /read-?more|recent/i.test(a.textContent || '') || /read-?more/i.test(a.href));
    const target = recent || links.find(a => a.href && a.href !== location.href);

    if (target) {
      console.log('[HumanScroll] Navigating to', target.href);
      location.href = target.href;
    } else {
      console.warn('[HumanScroll] No links found. Redirecting to /');
      location.href = '/';
    }
  }

  function tryCloseTab() {
    console.warn('[HumanScroll] Max time reached — closing or redirecting');
    try { window.close(); } catch {}
    location.href = '/';
  }

  function enforceTimeout() {
    setTimeout(() => {
      console.warn('[HumanScroll] FORCE TIMEOUT — 90s reached');
      navigateToNext(); // Try navigate
      setTimeout(() => tryCloseTab(), 2000); // Fallback to close if still stuck
    }, MAX_PAGE_TIME_MS - (performance.now() - pageStart));
  }

  async function start() {
    console.log('[HumanScroll] Starting in', START_DELAY_MS, 'ms...');
    enforceTimeout(); // Set 90s hard cap now
    await new Promise(r => setTimeout(r, START_DELAY_MS));

    const pageTooShort = document.body.scrollHeight <= window.innerHeight + 100;
    if (pageTooShort) {
      console.log('[HumanScroll] Page too short. Skipping scroll.');
      navigateToNext();
      return;
    }

    const scrolledToEnd = await humanScroll();
    if (scrolledToEnd) {
      console.log('[HumanScroll] Done scrolling. Navigating...');
      navigateToNext();
    } else {
      console.warn('[HumanScroll] Scroll incomplete. Forcing navigation.');
      navigateToNext();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
</script>
