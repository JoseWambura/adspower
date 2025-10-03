// ==UserScript==
// @name         JR Sports: Human-like Scroll + GA Events + Cursor Hover (90s Time Budget)
// @namespace    http://tampermonkey.net/
// @version      7.7
// @description  Scrolls with GA events and a fake cursor, but caps dwell to ~90s on any page (adaptive to page height). Includes distance/percent pacing modes.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Exit if not top window (avoid iframe contexts)
  if (window.top !== window.self) {
    console.log('[HumanScroll] Running in iframe, exiting.');
    return;
  }

  /******************************************************************
   * CONFIG (time budget + pacing mode)
   ******************************************************************/
  const TARGET_SECONDS = randInt(70, 100);                 // total desired time on page
  const MODE = 'percent';                    // 'distance' | 'percent'
  const START_DELAY_MS = randInt(2000, 4000);// short randomized start
  const SAFETY_TAIL_MS = 3500;               // bottom linger + nav window
  const RECENT_POST_SEL = '.wp-block-latest-posts__list a';

  // Distance-mode tuning
  const MIN_STEP_MS = 120, MAX_STEP_MS = 220;
  const MIN_STEP_PX = 40,  MAX_STEP_PX = 140;

  /******************************************************************
   * HELPERS
   ******************************************************************/
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
  function nowPerf() { return performance.now(); }

  function fireEvent(action, { label = '', value = '' } = {}) {
    const eventData = { event_category: 'HumanScroll', event_action: action, event_label: label, value };
    try {
      if (typeof window.gtag === 'function') window.gtag('event', action, eventData);
      else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: action, ...eventData });
    } catch {}
  }

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

  /******************************************************************
   * SESSION CONTROL (session_start once per tab)
   ******************************************************************/
  const SESSION_KEY = '__hs_session_started';
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, '1');
    fireEvent('session_start', { label: 'new session' });
  }

  // Always fire page_view on load
  fireEvent('page_view', { label: location.pathname, value: document.title });

  /******************************************************************
   * NAVIGATION COUNTER
   ******************************************************************/
  const NAV_KEY = '__hs_nav_count';
  const MAX_NAV_PAGES = randInt(6, 13);

  function getNavCount() {
    try { return parseInt(sessionStorage.getItem(NAV_KEY) || '0', 10) || 0; } catch { return 0; }
  }
  function setNavCount(n) {
    try { sessionStorage.setItem(NAV_KEY, String(n)); } catch {}
  }
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
   * FAKE CURSOR (bounded by the same deadline)
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
    cursor.style.top  = y + 'px';
  }
  // --- Smooth rAF scroller (continuous, no ticking) ---
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

// Optional gentle speed variation so it doesn’t look robot-straight
function speedMod(t){ return 1 + 0.18*Math.sin(2*Math.PI*(t*0.9 + 0.23)); }

async function runBudgetedScroll_raf(totalMs){
  const docH = getDocHeight();
  const viewH = window.innerHeight;
  const startY = window.scrollY || 0;
  const distance = Math.max(0, docH - viewH - startY);
  if (distance <= 0) { await sleep(Math.max(0, totalMs - SAFETY_TAIL_MS)); return; }

  const scrollTimeMs = Math.max(1000, totalMs - SAFETY_TAIL_MS);

  // depth markers (same as your BREAKPOINTS idea)
  const depthMarks = new Set([25,50,75,90,100]);
  let lastDepth = 0;

  // Build a normalized progress that integrates speedMod but stays within scrollTimeMs
  const t0 = performance.now();
  let lastPct = 0;

  return new Promise(resolve => {
    (function frame(now){
      const elapsed = now - t0;
      const raw = Math.min(1, elapsed / scrollTimeMs);

      // base easing for smoothness
      const eased = easeInOutCubic(raw);

      // apply gentle modulation, but normalize so we still end at 1.0
      // we map eased -> modulated by blending (keeps smoothness)
      const mod = clamp(eased * speedMod(eased), 0, 1);

      // ensure monotonic increase vs last sample
      const pct = Math.max(lastPct, Math.min(1, mod));
      lastPct = pct;

      const y = startY + distance * pct;
      window.scrollTo(0, y);

      // fire depth events only when crossing marks
      const visPct = Math.round(((y + viewH) / docH) * 100);
      for (const br of Array.from(depthMarks)) {
        if (visPct >= br) {
          fireEvent('scroll_depth', { label: br + '%' });
          depthMarks.delete(br);
        }
      }

      if (elapsed < scrollTimeMs && !atBottom()) {
        requestAnimationFrame(frame);
      } else {
        // snap to bottom and finish
        if (!atBottom()) window.scrollTo({ top: docH, behavior: 'instant' });
        resolve();
      }
    })(performance.now());
  });
}

  function simulateHover(cursor) {
    const links = Array.from(document.querySelectorAll('a, button, img'))
      .filter(el => el.offsetWidth > 30 && el.offsetHeight > 20 && !el.closest('iframe'));
    if (!links.length) return;
    const target = links[Math.floor(Math.random() * links.length)];
    const rect   = target.getBoundingClientRect();
    const x = rect.left + rect.width  / 2;
    const y = rect.top  + rect.height / 2;
    cursor.style.left = x + 'px';
    cursor.style.top  = y + 'px';
    fireEvent('hover_event', { label: target.href || target.tagName });
  }
  function focusOnAd(cursor) {
    const adSelectors = ['#gpt-billboard', '#gpt-passback4', '#gpt-rect1', '#gpt-rect2', '#gpt-anchor'];
    const ads = adSelectors.map(sel => document.querySelector(sel)).filter(Boolean);
    if (!ads.length) return false;
    const target = ads[Math.floor(Math.random() * ads.length)];
    const rect   = target.getBoundingClientRect();
    if (!rect || rect.width < 50 || rect.height < 50 || target.closest('iframe')) return false;
    const x = rect.left + rect.width  / 2;
    const y = rect.top  + rect.height / 2;
    cursor.style.left = x + 'px';
    cursor.style.top  = y + 'px';
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
   * TIME-BUDGETED SCROLLERS
   ******************************************************************/
  async function runBudgetedScroll_distance(totalMs) {
    const startY = window.scrollY || 0;
    const docH = getDocHeight();
    const viewH = window.innerHeight;
    const distance = Math.max(0, docH - viewH - startY);

    if (distance <= 0) {
      fireEvent('page_already_bottom', { value: distance });
      const idle = Math.max(0, totalMs - SAFETY_TAIL_MS);
      await sleep(idle);
      return;
    }

    const approxStepPx = clamp(distance / 180, MIN_STEP_PX, MAX_STEP_PX);
    let steps = Math.ceil(distance / approxStepPx);
    steps = Math.max(40, Math.min(steps, 400));
    const scrollTimeMs = Math.max(1000, totalMs - SAFETY_TAIL_MS);
    let avgDelay = clamp(Math.floor(scrollTimeMs / steps), MIN_STEP_MS, MAX_STEP_MS);
    steps = Math.max(10, Math.floor(scrollTimeMs / avgDelay));
    const stepPx = distance / steps;

    for (let i = 0; i < steps; i++) {
      const jitterDelay = clamp(randInt(avgDelay - 30, avgDelay + 30), MIN_STEP_MS, MAX_STEP_MS);
      window.scrollBy(0, stepPx);
      if ((i % Math.floor(steps / 4 || 1)) === 0) {
        const pct = Math.round(((window.scrollY + viewH) / docH) * 100);
        fireEvent('scroll_depth', { label: pct + '%' });
      }
      await sleep(jitterDelay);
    }

    if (!atBottom()) {
      window.scrollTo({ top: docH, behavior: 'smooth' });
      await sleep(350);
    }
  }

  async function runBudgetedScroll_percent(totalMs) {
    const docH = getDocHeight();
    const viewH = window.innerHeight;
    const startY = window.scrollY || 0;
    const distance = Math.max(0, docH - viewH - startY);

    if (distance <= 0) {
      await sleep(Math.max(0, totalMs - SAFETY_TAIL_MS));
      return;
    }

    const scrollTimeMs = Math.max(1000, totalMs - SAFETY_TAIL_MS);
    const stops = [0.25, 0.50, 0.75, 1.00].map(p => Math.round((docH - viewH) * p));
    const slice = Math.floor(scrollTimeMs / stops.length);

    let lastTarget = window.scrollY || 0;
    for (let i = 0; i < stops.length; i++) {
      const targetY = stops[i];
      const segmentDist = Math.max(0, targetY - lastTarget);
      const steps = clamp(Math.ceil(segmentDist / 90), 12, 160);
      const stepPx = segmentDist / steps;
      const avgDelay = Math.max(12, Math.floor(slice / steps));
      for (let s = 0; s < steps; s++) {
        window.scrollBy(0, stepPx);
        await sleep(randInt(Math.max(10, avgDelay - 25), avgDelay + 25));
      }
      const pct = Math.round(((window.scrollY + viewH) / docH) * 100);
      fireEvent('scroll_depth', { label: pct + '%' });
      lastTarget = targetY;
    }

    if (!atBottom()) {
      window.scrollTo({ top: docH, behavior: 'smooth' });
      await sleep(300);
    }
  }

  /******************************************************************
   * START: wait a beat, then run within a fixed 90s budget
   ******************************************************************/
  (async function main() {
    const wallStart = Date.now();
    fireEvent('scroll_start', { label: `budgeted_v7.7` });

    // Small randomized start delay
    await sleep(START_DELAY_MS);

    // Wait for DOM (interactive/complete). We don't block on ad slots here,
    // to keep the overall timing consistent.
    await new Promise(resolve => {
      const check = () => (document.readyState === 'interactive' || document.readyState === 'complete') ? resolve() : setTimeout(check, 50);
      check();
    });

    // Compute remaining time budget relative to TARGET_SECONDS
    const elapsed = Date.now() - wallStart; // includes START_DELAY_MS
    const remaining = Math.max(0, (TARGET_SECONDS * 1000) - elapsed);
    const deadline = nowPerf() + remaining;

    // Start cursor sim, bounded by deadline
    const stopCursor = startMouseSimulation(deadline);

    // Run one of the time-budgeted scrollers
    if (MODE === 'percent') {
      await runBudgetedScroll_percent(remaining);
    } else {
      await runBudgetedScroll_distance(remaining);
    }

    // Linger up to SAFETY_TAIL_MS if any budget remains, then navigate/exit
    const msLeft = Math.max(0, deadline - nowPerf());
    const linger = Math.max(0, Math.min(SAFETY_TAIL_MS, msLeft));
    await sleep(linger);

    fireEvent('page_end', { label: 'budget_reached' });
    stopCursor();

    // Navigate to a recent post (or close if none)
    navigateToRecentTargetOrExit();
  })();

})();
