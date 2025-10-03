// ==UserScript==
// @name         JR Sports: Human-like Scroll + GA Events + Cursor Hover (Ads Focus)
// @namespace    http://tampermonkey.net/
// @version      7.5
// @description  Human-like scrolling with GA events (session_start, page_view, engaged_session, depth, clicks, exits) and fake cursor that wanders, hovers links, and pauses over ad slots (avoiding iframe access).
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
   * HELPERS
   ******************************************************************/
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function fireEvent(action, { label = '', value = '' } = {}) {
    const eventData = {
      event_category: 'HumanScroll',
      event_action: action,
      event_label: label,
      value: value
    };
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', action, eventData);
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: action, ...eventData });
      }
      // console.log('[GA Event]', action, eventData); // uncomment to debug
    } catch (e) {
      // console.log('[GA ERROR]', action, e);
    }
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
   * NAVIGATION COUNTER (controls page progression/limit)
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
   * SCROLL ENGINE (forward scroll cycles; pauses randomized)
   ******************************************************************/
  function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
  function atBottom(th = 2) {
    return window.scrollY + window.innerHeight >= document.body.scrollHeight - th;
  }
  function animateScrollByPx(totalPx, durationMs) {
    return new Promise(resolve => {
      const startY = window.scrollY || 0;
      const startT = performance.now();
      let lastY = startY;
      (function frame(now) {
        const t = Math.min(1, (now - startT) / durationMs);
        const progress = easeInOutQuad(t);
        const targetY = startY + totalPx * progress;
        const delta = targetY - lastY;
        window.scrollBy(0, delta);
        lastY = targetY;
        if (t < 1) requestAnimationFrame(frame); else resolve();
      })(performance.now());
    });
  }

  async function doOneScrollCycle(cfg) {
    const backscroll = Math.random() < 0.2; // 20% backscroll
    const dist = randInt(800, 1200) * (backscroll ? -0.5 : 1);
    const dur  = randInt(5000, 7000);
    fireEvent('scroll_cycle', { label: backscroll ? 'backscroll' : 'forward' });
    await animateScrollByPx(dist, dur);
    checkAndSendDepth();

    // 20% chance: idle pause (20–30s) to mimic reading/hover
    if (Math.random() < 0.2) {
      const idle = randInt(20000, 30000);
      fireEvent('idle_pause', { label: 'pause', value: idle });
      await new Promise(r => setTimeout(r, idle));
    } else {
      await new Promise(r => setTimeout(r, randInt(cfg.pauseMin, cfg.pauseMax)));
    }
  }

  function randomTimingConfig() {
    const m = Math.random();
    if (m < 0.25) return { cycles: 3, pauseMin: 7000, pauseMax: 9000 };
    if (m < 0.85) return { cycles: 4, pauseMin: 10000, pauseMax: 12000 };
    return { cycles: 5, pauseMin: 12000, pauseMax: 15000 };
  }

  function runScrollsUntilBottomThenAct() {
    const cfg = randomTimingConfig();
    let cycles = 0;
    (function loop() {
      if (cycles < cfg.cycles || !atBottom()) {
        doOneScrollCycle(cfg).then(() => {
          cycles++;
          if (atBottom() && cycles >= cfg.cycles) {
            fireEvent('page_end', { label: `cycles=${cycles}` });
            setTimeout(() => navigateToRecentTarget(), 4000);
          } else { loop(); }
        });
      }
    })();
  }

  function navigateToRecentTarget() {
    const n = getNavCount();
    if (n >= MAX_NAV_PAGES) return tryCloseTab('max pages');
    if (Math.random() < 0.1 && n > 2) return tryCloseTab('random early exit');

    const links = Array.from(document.querySelectorAll('.wp-block-latest-posts__list a'));
    if (!links.length) return tryCloseTab('no posts');

    const target = links[Math.floor(Math.random() * links.length)].href;
    const delay  = randInt(500, 4000);
    fireEvent('click_event', { label: target });
    setTimeout(() => { beforeNavigateIncrement(); location.href = target; }, delay);
  }

  /******************************************************************
   * FAKE CURSOR + HOVER SIMULATION (with Ad Focus on outer elements)
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

    // Linger 2–4s over ads
    setTimeout(() => {}, randInt(2000, 4000));
    return true;
  }
  function startMouseSimulation() {
    const cursor = createFakeCursor();
    function loop() {
      const chance = Math.random();
      if (chance < 0.2) { // 20% focus on ads
        if (!focusOnAd(cursor)) moveCursorRandom(cursor);
      } else if (chance < 0.4) { // 20% hover links/images
        simulateHover(cursor);
      } else { // 60% wander randomly
        moveCursorRandom(cursor);
      }
      setTimeout(loop, randInt(3000, 6000)); // every 3–6s
    }
    loop();
  }

  /******************************************************************
   * START: delay, wait for ads, then begin scrolling + cursor sim
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

    // Wait for page and ads to load
    await new Promise(resolve => {
        const check = () => {
            const ads = document.querySelectorAll('#gpt-billboard, #gpt-passback4, #gpt-rect1, #gpt-rect2, #gpt-anchor');
            if (document.readyState === 'complete' && ads.length > 0) {
                resolve();
            } else {
                setTimeout(check, 500);
            }
        };
        check();
    });

    fireEvent('scroll_start', { label: `delay ${START_DELAY_MS}ms` });
    startMouseSimulation(); // Start cursor + ad hovers
    runScrollsUntilBottomThenAct(); // Kick off scrolling
  }, START_DELAY_MS);

})();
