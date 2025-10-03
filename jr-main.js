// ==UserScript==
// @name         JR Sports: Human-like Scroll + GA Events + Cursor Hover (90s Budget, Adaptive)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Smooth, adaptive percentage-based scrolling with GA events and fake cursor; resists layout shifts, waits for stable layout, pauses when tab hidden.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScript);
  } else {
    initScript();
  }

  function initScript() {
    /******************************************************************
     * CONFIG
     ******************************************************************/
    const TARGET_SECONDS      = randInt(70, 100);
    const START_DELAY_MS      = randInt(2000, 4000);
    const SAFETY_TAIL_MS      = 3500;
    const MIN_SCROLL_PHASE_MS = 8000;            // never rush the main scroll
    const RECENT_POST_SEL     = '.wp-block-latest-posts__list a';
    const LAYOUT_STABLE_MS    = 700;             // quiet time window
    const LAYOUT_JITTER_PX    = 8;               // acceptable height change within window
    const LAYOUT_MAX_WAIT_MS  = 4500;            // give up after this

    /******************************************************************
     * HELPERS
     ******************************************************************/
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
    function nowPerf() { return performance.now(); }

    function getDocHeight() {
      return Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      );
    }
    function atBottom(th = 2) {
      return (window.scrollY + window.innerHeight) >= (getDocHeight() - th);
    }

    function fireEvent(action, { label = '', value = '' } = {}) {
      const eventData = { event_category: 'HumanScroll', event_action: action, event_label: label, value };
      try {
        if (typeof window.gtag === 'function') window.gtag('event', action, eventData);
        else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: action, ...eventData });
      } catch {}
    }

    /******************************************************************
     * GA session + page_view
     ******************************************************************/
    const SESSION_KEY = '__hs_session_started';
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      fireEvent('session_start', { label: 'new session' });
    }
    fireEvent('page_view', { label: location.pathname, value: document.title });

    /******************************************************************
     * NAV counter
     ******************************************************************/
    const NAV_KEY = '__hs_nav_count';
    const MAX_NAV_PAGES = randInt(6, 13);
    const getNavCount = () => { try { return parseInt(sessionStorage.getItem(NAV_KEY) || '0', 10) || 0; } catch { return 0; } };
    const setNavCount = (n) => { try { sessionStorage.setItem(NAV_KEY, String(n)); } catch {} };
    function beforeNavigateIncrement() {
      const n = getNavCount() + 1;
      setNavCount(n);
      fireEvent('page_progress', { label: `page ${n}/${MAX_NAV_PAGES}` });
    }
    function navigateToRecentTargetOrExit() {
      const n = getNavCount();
      if (n >= MAX_NAV_PAGES) return tryCloseTab('max pages');
      const links = Array.from(document.querySelectorAll(RECENT_POST_SEL));
      if (!links.length) return tryCloseTab('no posts');
      const target = links[Math.floor(Math.random() * links.length)].href;
      fireEvent('click_event', { label: target });
      beforeNavigateIncrement();
      location.href = target;
    }
    function tryCloseTab(reason) {
      fireEvent('session_exit', { label: reason, value: getNavCount() });
      removeFakeCursor();
      try { window.stop(); } catch {}
      try {
        document.documentElement.innerHTML = '';
        document.title = 'Done';
        document.documentElement.style.background = '#fff';
      } catch {}
      try { location.replace('about:blank'); } catch {}
      setTimeout(() => { try { window.open('', '_self'); window.close(); } catch {} }, 200);
    }

    /******************************************************************
     * Depth + engaged session
     ******************************************************************/
    const firedPercents = new Set();
    const BREAKPOINTS = [25, 50, 75, 90, 100];
    let engagedFired = false;
    const engagedTimer = setTimeout(() => checkEngagedSession(true), 10000);
    function getPercentScrolled() {
      const y = window.scrollY || 0;
      const view = window.innerHeight;
      const full = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const pos = Math.min(full, y + view);
      return Math.round((pos / full) * 100);
    }
    function checkAndSendDepth() {
      const pct = getPercentScrolled();
      for (let i = 0; i < BREAKPOINTS.length; i++) {
        if (pct >= BREAKPOINTS[i] && !firedPercents.has(BREAKPOINTS[i])) {
          firedPercents.add(BREAKPOINTS[i]);
          fireEvent('scroll_depth', { label: `${BREAKPOINTS[i]}%` });
        }
      }
      checkEngagedSession(false);
    }
    window.addEventListener('scroll', () => {
      if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t);
      checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth);
    }, { passive: true });
    function checkEngagedSession(fromTimer) {
      if (engagedFired) return;
      const scrolledPct = getPercentScrolled();
      if (scrolledPct >= 50 && (fromTimer || performance.now() > 10000)) {
        fireEvent('engaged_session', { label: `>=50% after ${Math.round(performance.now()/1000)}s` });
        engagedFired = true;
        clearTimeout(engagedTimer);
      }
    }

    /******************************************************************
     * Fake cursor (unchanged behavior)
     ******************************************************************/
    function createFakeCursor() {
      const cursor = document.createElement('div');
      cursor.id = '__hs_fake_cursor';
      cursor.style.position = 'fixed';
      cursor.style.top = '100px';
      cursor.style.left = '100px';
      cursor.style.width = '12px';
      cursor.style.height = '12px';
      cursor.style.borderRadius = '50%';
      cursor.style.background = 'rgba(0,0,0,0.5)';
      cursor.style.zIndex = '999999';
      cursor.style.pointerEvents = 'none';
      cursor.style.transition = 'top 0.35s ease, left 0.35s ease';
      if (document.body) document.body.appendChild(cursor);
      return cursor;
    }
    function removeFakeCursor() {
      const c = document.getElementById('__hs_fake_cursor');
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }
    function moveCursorRandom(cursor) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const x = randInt(50, vw - 50);
      const y = randInt(50, vh - 50);
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
    }
    function simulateHover(cursor) {
      const links = Array.from(document.querySelectorAll('a, button, img'))
        .filter(el => el.offsetWidth > 30 && el.offsetHeight > 20 && !el.closest('iframe'));
      if (!links.length) return;
      const target = links[Math.floor(Math.random() * links.length)];
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
      fireEvent('hover_event', { label: target.href || target.tagName });
    }
    function focusOnAd(cursor) {
      const adSelectors = ['#gpt-billboard', '#gpt-passback4', '#gpt-rect1', '#gpt-rect2', '#gpt-anchor'];
      const ads = adSelectors.map(sel => document.querySelector(sel)).filter(Boolean);
      if (!ads.length) return false;
      const target = ads[Math.floor(Math.random() * ads.length)];
      const rect = target.getBoundingClientRect();
      if (!rect || rect.width < 50 || rect.height < 50 || target.closest('iframe')) return false;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
      fireEvent('hover_event', { label: 'ad_focus_' + (target.id || 'slot') });
      return true;
    }
    function startMouseSimulation(deadlineMs) {
      const cursor = createFakeCursor();
      let stopped = false;
      (function loop() {
        if (stopped || nowPerf() >= deadlineMs) { removeFakeCursor(); return; }
        const chance = Math.random();
        if (chance < 0.2) { if (!focusOnAd(cursor)) moveCursorRandom(cursor); }
        else if (chance < 0.4) { simulateHover(cursor); }
        else { moveCursorRandom(cursor); }
        setTimeout(loop, randInt(3000, 6000));
      })();
      return () => { stopped = true; removeFakeCursor(); };
    }

    /******************************************************************
     * Layout settle gate (reduces CLS-induced jumps)
     ******************************************************************/
    async function waitForStableLayout(maxWait = LAYOUT_MAX_WAIT_MS, quiet = LAYOUT_STABLE_MS, jitter = LAYOUT_JITTER_PX) {
      const start = performance.now();
      let lastH = getDocHeight();
      let lastChangeTs = performance.now();

      const mo = new MutationObserver(() => {
        const h = getDocHeight();
        if (Math.abs(h - lastH) > jitter) {
          lastH = h;
          lastChangeTs = performance.now();
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: false });

      try {
        while ((performance.now() - start) < maxWait) {
          const since = performance.now() - lastChangeTs;
          if (since >= quiet) break;
          await sleep(50);
        }
      } finally {
        mo.disconnect();
      }
    }

    /******************************************************************
     * Visibility-aware timer (prevents rAF mega-steps in bg)
     ******************************************************************/
    async function waitUntilVisible() {
      if (!document.hidden) return;
      await new Promise(res => {
        const onVis = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', onVis); res(); } };
        document.addEventListener('visibilitychange', onVis);
      });
    }

    /******************************************************************
     * Easing + adaptive percentage-based scroll
     ******************************************************************/
    function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
    function speedMod(t) { return 1 + 0.18*Math.sin(2*Math.PI*(t*0.9 + 0.23)); }

    async function runBudgetedScroll_adaptive(totalMs) {
      const activeScrollMs = Math.max(MIN_SCROLL_PHASE_MS, totalMs - SAFETY_TAIL_MS);
      if (activeScrollMs <= 0) return;

      // Compute initial starting percent from current position
      const initDocH = getDocHeight();
      const initViewH = window.innerHeight;
      const initMaxY  = Math.max(1, initDocH - initViewH);
      const initY     = clamp(window.scrollY || 0, 0, initMaxY);
      const startPct  = clamp(initY / initMaxY, 0, 1);

      let running = true;
      let accumulated = 0;            // visible-time accumulator
      let lastTs = performance.now();

      await new Promise(resolve => {
        function frame(ts) {
          if (!running) return;
          const dt = ts - lastTs;
          lastTs = ts;

          // If tab hidden, pause accumulation (prevents jumpy large steps)
          if (document.hidden) {
            requestAnimationFrame(frame);
            return;
          }

          accumulated += dt;
          const raw = clamp(accumulated / activeScrollMs, 0, 1);
          const eased = easeInOutCubic(raw);
          const mod = clamp(eased * speedMod(eased), 0, 1);

          // Target percent moves from startPct -> 1.0
          const targetPct = clamp(startPct + (1 - startPct) * mod, 0, 1);

          // Recompute current doc height every frame (adaptive to layout changes)
          const docH = getDocHeight();
          const viewH = window.innerHeight;
          const maxY = Math.max(0, docH - viewH);
          const y = Math.round(maxY * targetPct);

          window.scrollTo(0, y);

          // Emit depth based on current position
          const visPct = Math.round(((y + viewH) / docH) * 100);
          for (let i = 0; i < BREAKPOINTS.length; i++) {
            const br = BREAKPOINTS[i];
            if (visPct >= br && !firedPercents.has(br)) {
              firedPercents.add(br);
              fireEvent('scroll_depth', { label: br + '%' });
            }
          }

          if (raw < 1 && !atBottom()) {
            requestAnimationFrame(frame);
          } else {
            // Final snap to bottom in case of rounding; no native smooth to avoid clashes
            const finalDocH = getDocHeight();
            const finalMaxY = Math.max(0, finalDocH - window.innerHeight);
            window.scrollTo(0, finalMaxY);
            running = false;
            resolve();
          }
        }
        requestAnimationFrame(frame);
      });
    }

    /******************************************************************
     * START
     ******************************************************************/
    (async function main() {
      const wallStart = Date.now();
      fireEvent('scroll_start', { label: 'budgeted_v8.0' });

      // Randomized small start delay
      await sleep(START_DELAY_MS);

      // Ensure DOM is interactive/complete
      await new Promise(resolve => {
        const check = () => (document.readyState === 'interactive' || document.readyState === 'complete') ? resolve() : setTimeout(check, 50);
        check();
      });

      // Wait until visible (avoid bg throttling jumps)
      await waitUntilVisible();

      // Wait for layout to stabilize (minimizes CLS during the run)
      await waitForStableLayout();

      // Compute remaining budget and deadline
      const elapsed = Date.now() - wallStart;
      const remaining = Math.max(0, (TARGET_SECONDS * 1000) - elapsed);
      const deadline = nowPerf() + remaining;

      // Start cursor sim
      const stopCursor = startMouseSimulation(deadline);

      // Run adaptive scroll (percentage-based; recalculates doc height per frame)
      await runBudgetedScroll_adaptive(remaining);

      // Linger within remaining safety tail (if any)
      const msLeft = Math.max(0, deadline - nowPerf());
      const linger = Math.max(0, Math.min(SAFETY_TAIL_MS, msLeft));
      await sleep(linger);

      fireEvent('page_end', { label: 'budget_reached' });
      stopCursor();

      // Navigate/exit
      navigateToRecentTargetOrExit();
    })();
  }
})();
