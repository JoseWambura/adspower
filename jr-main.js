// ==UserScript==
// @name         JR Sports: Human-like Scroll + GA Events + Cursor Hover (Ads Focus, Pauses Fixed)
// @namespace    http://tampermonkey.net/
// @version      7.14
// @description  Human-like scrolling with GA events and fake cursor; 2min dwell + 10s ad linger with 100% viewability, limited to 3 pages, 1%-3% ad click chance with inactive new tab.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Track total time in-page
  const pageStartMs = Date.now();

  /******************************************************************
   * HELPERS
   ******************************************************************/
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function fireEvent(action, { label = '', value = '' } = {}) {
    const eventData = { event_category: 'HumanScroll', event_action: action, event_label: label, value };
    try {
      if (typeof window.gtag === 'function') window.gtag('event', action, eventData);
      else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: action, ...eventData });
    } catch {}
  }
  function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
  function atBottom(th = 2) {
    const doc = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return window.scrollY + window.innerHeight >= doc - th;
  }
  function scrollToBottom() {
    const doc = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const y = Math.max(0, doc - window.innerHeight);
    window.scrollTo(0, y);
  }

  /******************************************************************
   * SESSION CONTROL (session_start once per tab)
   ******************************************************************/
  const SESSION_KEY = '__hs_session_started';
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, '1');
    fireEvent('session_start', { label: 'new session' });
  }
  fireEvent('page_view', { label: location.pathname, value: document.title });

  /******************************************************************
   * NAVIGATION COUNTER (controls page progression/limit)
   ******************************************************************/
  const NAV_KEY = '__hs_nav_count';
  const MAX_NAV_PAGES = 3; // Limited to 3 pages
  function getNavCount() { try { return parseInt(sessionStorage.getItem(NAV_KEY) || '0', 10) || 0; } catch { return 0; } }
  function setNavCount(n) { try { sessionStorage.setItem(NAV_KEY, String(n)); } catch {} }
  function beforeNavigateIncrement() {
    const n = getNavCount() + 1;
    setNavCount(n);
    fireEvent('page_progress', { label: `page ${n}/${MAX_NAV_PAGES}` });
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
   * SCROLL DEPTH + ENGAGED SESSION
   ******************************************************************/
  const firedPercents = new Set();
  const BREAKPOINTS = [25, 50, 75, 90, 100];
  let engagedFired = false;
  const engagedTimer = setTimeout(() => checkEngagedSession(true), 10000); // >=10s
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
  function checkEngagedSession(fromTimer) {
    if (engagedFired) return;
    const scrolledPct = getPercentScrolled();
    if (scrolledPct >= 50 && (fromTimer || performance.now() > 10000)) {
      fireEvent('engaged_session', { label: `>=50% after ${Math.round(performance.now()/1000)}s` });
      engagedFired = true;
      clearTimeout(engagedTimer);
    }
  }

  // Minimum in-page dwell: 2 minutes
  const MIN_INPAGE_MS = 120000; // 2 minutes
  function timeSince(ts) { return Date.now() - ts; }
  async function ensureMinDwell(startMs) {
    const elapsed = timeSince(startMs);
    const waitLeft = Math.max(0, MIN_INPAGE_MS - elapsed);
    if (waitLeft > 0) {
      scrollToBottom(); // ensure we visibly wait at the bottom
      fireEvent('dwell_wait', { value: waitLeft });
      await sleep(waitLeft);
    }
  }

  window.addEventListener('scroll', () => {
    if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t);
    checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth);
  }, { passive: true });

  /******************************************************************
   * PAUSE CONTROLS (new)
   ******************************************************************/
  let isPaused = false;          // master pause flag (reading pause / bg tab)
  let pendingPause = null;       // promise in-flight when we pause
  const PAUSE_PROFILE = (() => {
    // Deterministic: ensure 2–3 real reading pauses per page
    const longPauses = randInt(1, 2);  // 1–2 long pauses (15–25s)
    const shortPauses = randInt(1, 2); // 1–2 short pauses (6–10s)
    return { longPauses, shortPauses };
  })();

  async function doReadingPause(ms, label = 'reading_pause') {
    isPaused = true;
    fireEvent(label, { value: ms });
    pendingPause = sleep(ms);
    await pendingPause;
    pendingPause = null;
    isPaused = false;
  }

  // Auto-pause when tab hidden; resume when visible
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      if (!isPaused) await doReadingPause(0, 'bg_pause_begin'); // set flag only
    } else {
      if (pendingPause) { /* let reading pause finish */ }
      else { isPaused = false; fireEvent('bg_pause_end'); }
    }
  });

  /******************************************************************
   * SCROLL ENGINE (step-based, mid-scroll pausable)
   ******************************************************************/
  async function animateScrollByPx(totalPx, durationMs) {
    return new Promise(resolve => {
      const startY = window.scrollY || 0;
      const startT = performance.now();
      let lastProgress = 0;

      function frame(now) {
        if (isPaused) { requestAnimationFrame(frame); return; }

        const t = Math.min(1, (now - startT) / durationMs);
        const progress = easeInOutQuad(t);
        const step = (progress - lastProgress) * totalPx;
        lastProgress = progress;

        window.scrollBy(0, step);

        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  async function doOneScrollCycle(cfg) {
    // Optional mid-cycle reading pause BEFORE moving
    if (PAUSE_PROFILE.longPauses > 0 && Math.random() < 0.5) {
      PAUSE_PROFILE.longPauses--;
      await doReadingPause(randInt(15000, 25000)); // 15–25s
    } else if (PAUSE_PROFILE.shortPauses > 0 && Math.random() < 0.8) {
      PAUSE_PROFILE.shortPauses--;
      await doReadingPause(randInt(6000, 10000)); // 6–10s
    }

    const backscroll = Math.random() < 0.2; // 20% backscroll
    const dist = randInt(800, 1200) * (backscroll ? -0.5 : 1);
    const dur = randInt(5000, 7000);

    fireEvent('scroll_cycle', { label: backscroll ? 'backscroll' : 'forward', value: dur });
    await animateScrollByPx(dist, dur);

    checkAndSendDepth();

    // Optional micro-pause AFTER moving
    await sleep(randInt(cfg.pauseMin, cfg.pauseMax));
  }

  function randomTimingConfig() {
    const m = Math.random();
    if (m < 0.25) return { cycles: 3, pauseMin: 1200, pauseMax: 2200 };
    if (m < 0.85) return { cycles: 4, pauseMin: 1500, pauseMax: 2500 };
    return { cycles: 5, pauseMin: 2000, paceMax: 3000 }; // Fixed typo: paceMax to pauseMax
  }

  async function runScrollsUntilBottomThenAct() {
    const cfg = randomTimingConfig();
    let cycles = 0;

    while (true) {
      // If bottom and enough cycles, dwell at bottom until min time reached, then navigate
      if (atBottom() && cycles >= cfg.cycles) {
        await doReadingPause(randInt(3000, 6000), 'final_pause');
        fireEvent('page_end', { label: `cycles=${cycles}` });

        // Enforce minimum dwell (2 minutes). Wait AT the bottom.
        await ensureMinDwell(pageStartMs);

        await sleep(400 + randInt(200, 600));
        return navigateToRecentTarget();
      }

      await doOneScrollCycle(cfg);
      cycles++;
    }
  }

  async function navigateToRecentTarget() {
    const n = getNavCount();
    if (n >= MAX_NAV_PAGES) return tryCloseTab('max pages');

    // ~10% early exit kept
    if (Math.random() < 0.1 && n > 2) return tryCloseTab('random early exit');

    const links = Array.from(document.querySelectorAll('.wp-block-latest-posts__list a'));
    if (!links.length) return tryCloseTab('no posts');

    const target = links[Math.floor(Math.random() * links.length)].href;

    // Safety guard: if we somehow reach here earlier, still enforce dwell at bottom
    scrollToBottom();
    await ensureMinDwell(pageStartMs);

    const delay = randInt(500, 2000);
    fireEvent('click_event', { label: target });
    setTimeout(() => { beforeNavigateIncrement(); location.href = target; }, delay);
  }

  /******************************************************************
   * FAKE CURSOR + HOVER SIMULATION (with 10s Ad Focus linger at 100% viewability)
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
    document.body.appendChild(cursor);
    return cursor;
  }
  function removeFakeCursor() {
    const c = document.getElementById('__hs_fake_cursor');
    if (c) c.remove();
  }
  function moveCursorRandom(cursor) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const x = randInt(50, vw - 50);
    const y = randInt(50, vh - 50);
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  }
  function simulateHover(cursor) {
    const links = Array.from(document.querySelectorAll('a, button, img')).filter(el =>
      el.offsetWidth > 30 && el.offsetHeight > 20 && !el.closest('iframe'));
    if (!links.length) return;
    const target = links[Math.floor(Math.random() * links.length)];
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    fireEvent('hover_event', { label: target.href || target.tagName });
  }
  async function focusOnAd(cursor) {
    const adSelectors = ['#gpt-billboard', '#gpt-passback4', '#gpt-rect1', '#gpt-rect2', '#gpt-anchor'];
    const ads = adSelectors.map(sel => document.querySelector(sel)).filter(Boolean);
    if (!ads.length) return false;
    const target = ads[Math.floor(Math.random() * ads.length)];
    const rect = target.getBoundingClientRect();
    if (!rect || rect.width < 50 || rect.height < 50 || target.closest('iframe')) return false;

    // Adjust scroll to keep 100% of ad in viewport
    const viewHeight = window.innerHeight;
    const adTop = rect.top;
    const adBottom = rect.bottom;
    const adHeight = rect.height;
    let scrollY = window.scrollY;

    if (adHeight <= viewHeight) {
      // Ad fits fully, align top
      if (adTop < 0) scrollY += adTop; // Scroll up if above viewport
      else if (adBottom > viewHeight) scrollY += adTop; // Scroll to top if below
    } else {
      // Ad taller than viewport, center it
      const centerOffset = adTop + (adHeight / 2) - (viewHeight / 2);
      scrollY += centerOffset;
    }
    scrollY = Math.max(0, scrollY); // Prevent scrolling above top
    window.scrollTo(0, scrollY);

    // Verify ad is fully in view (debugging)
    const newRect = target.getBoundingClientRect();
    if (newRect.top < 0 || newRect.bottom > viewHeight) {
      console.warn('Ad not 100% visible, adjusting failed:', newRect);
    }

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    fireEvent('hover_event', { label: 'ad_focus_' + (target.id || 'slot') });

    // 1%-3% chance to simulate a "shit user" clicking the ad
    if (Math.random() < randInt(1, 3) / 100) {
      fireEvent('ad_click', { label: 'shit_user_click_' + (target.id || 'slot') });
      const adUrl = target.href || target.parentElement.href || 'about:blank'; // Fallback if no direct link
      window.open(adUrl, '_blank'); // Open in new tab, inactive
    }

    // Pause scroll and linger for 10 seconds with 100% view
    isPaused = true;
    await sleep(10000); // Fixed 10-second linger
    isPaused = false;

    return true;
  }
  function startMouseSimulation() {
    const cursor = createFakeCursor();
    let stopped = false;

    (async function loop() {
      if (stopped) return;

      if (isPaused) { setTimeout(loop, 300); return; }

      const chance = Math.random();
      if (chance < 0.2) {
        if (!(await focusOnAd(cursor))) moveCursorRandom(cursor);
      } else if (chance < 0.4) {
        simulateHover(cursor);
      } else {
        moveCursorRandom(cursor);
      }
      setTimeout(loop, randInt(3000, 6000));
    })();

    return () => { stopped = true; removeFakeCursor(); };
  }

  /******************************************************************
   * START: delay, optional bounce, then begin scrolling + cursor sim
   ******************************************************************/
  const START_DELAY_MS = randInt(10000, 15000);

  setTimeout(async () => {
    if (getNavCount() >= MAX_NAV_PAGES) return tryCloseTab('already max');

    // 3% instant bounce (2–5s after load)
    if (Math.random() < 0.03) {
      const d = randInt(2000, 5000);
      fireEvent('instant_bounce', { label: 'bounce', value: d });
      return setTimeout(() => tryCloseTab('instant bounce'), d);
    }

    fireEvent('scroll_start', { label: `delay ${START_DELAY_MS}ms` });

    const stopCursor = startMouseSimulation();
    await runScrollsUntilBottomThenAct();
    stopCursor();
  }, START_DELAY_MS);

})();
