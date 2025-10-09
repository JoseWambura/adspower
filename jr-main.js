// ==UserScript==
// @name         Human-like Scroll → GA4 + Random Link or Form Submit (40%) + Extra Human Tweaks
// @namespace    http://tampermonkey.net/
// @version      4.6
// @description  Human-like scroll with heading-dwell, rare long pauses, micro-nudges; GA4 depth; then 40% safe form submit or random link w/ fake cursor
// @match        *://jrsports.click/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==



(function () {
  'use strict';
  const DEBUG = false;

  // ===== Helpers =====
  let _seed = Date.now();
  function seededRandom() { _seed ^= _seed << 13; _seed ^= _seed >>> 17; _seed ^= _seed << 5; return (_seed >>> 0) / 0xFFFFFFFF; }
  function randInt(min, max) { return Math.floor(seededRandom() * (max - min + 1)) + min; }

  // ===== Config =====
  const MAX_PAGES = randInt(4, 6), MAX_SESSION_MS = 480000, START_DELAY_MS = randInt(10000, 13000);
  const PAUSE_MIN_MS = 1000, PAUSE_MAX_MS = 2500, DOWN_MIN_PX = 200, DOWN_MAX_PX = 600;
  const UP_CHANCE = 0.2, UP_MIN_PX = 60, UP_MAX_PX = 250, BOTTOM_CONFIRM_MS = 2000;
  const EARLY_EXIT_PROB = 0.5, EARLY_EXIT_DEPTH_MIN = 50, EARLY_EXIT_DEPTH_MAX = 70;
  const CLICK_AFTER_MIN_MS = 1000, CLICK_AFTER_MAX_MS = 2000, SAME_HOST_ONLY = true;
  const ENABLE_FORMS = true, FORM_SUBMIT_PROB = 0.15, FORM_FIELD_DELAY_MIN_MS = 500, FORM_FIELD_DELAY_MAX_MS = 1500;
  const WANDER_STEPS_MIN = 3, WANDER_STEPS_MAX = 6, WANDER_STEP_MS = 250, FINAL_HOVER_MS = 400;
  const AD_PAUSE_MS = 2000, IMAGE_PAUSE_MIN_MS = 1500, IMAGE_PAUSE_MAX_MS = 3000;

  // ===== Pageview Tracking =====
  try { let pv = parseInt(localStorage.getItem('pv_count') || '0', 10) + 1; localStorage.setItem('pv_count', pv.toString()); window.__pageviews_in_tab = pv; } catch (e) { window.__pageviews_in_tab = 1; }

  // ===== Scroll / Viewport Helpers =====
  function atBottom(t = 8) {
    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    const view = window.innerHeight || 0;
    const doc = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return y + view >= doc - t;
  }
  function sameHost(url) { try { return new URL(url, location.href).host === location.host; } catch (e) { return false; } }
  function isGoodHref(href) { if (!href) return false; const s = href.trim().toLowerCase(); return !s.startsWith('#') && !s.startsWith('javascript:') && !s.startsWith('mailto:') && !s.startsWith('tel:'); }
  function isDisplayed(el) { if (!el) return false; if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false; const style = window.getComputedStyle(el); return style.visibility !== 'hidden' && style.display !== 'none'; }
  function inViewport(el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.right > 0 && r.left < window.innerWidth && r.top < window.innerHeight; }

  // ===== Candidate Links (cached with fallback) =====
  let _candidateLinksCache = null;
  function getAllCandidateLinks() {
    if (_candidateLinksCache) return _candidateLinksCache;
    let links = Array.from(document.querySelectorAll('a[href]')).filter(a => {
      const href = a.getAttribute('href') || '';
      if (!isGoodHref(href)) return false;
      if (SAME_HOST_ONLY && !sameHost(href)) return false;
      const text = (a.innerText || a.textContent || '').toLowerCase();
      const className = (a.className || '').toLowerCase();
      const idName = (a.id || '').toLowerCase();
      if (text.includes('search') || className.includes('search') || idName.includes('search')) return false;
      if (a.closest('nav') || className.includes('menu') || idName.includes('menu')) return false;
      const isReadMore = text.includes('read more') || text.includes('continue reading');
      const isFooter = a.closest('footer');
      return isReadMore || isFooter || a.closest('article, section, div:not(nav)');
    });
    if (links.length === 0) {
      links = Array.from(document.querySelectorAll('a[href]')).filter(a => isGoodHref(a.getAttribute('href') || '') && (SAME_HOST_ONLY && sameHost(a.href)));
    }
    _candidateLinksCache = links;
    return links;
  }

  // ===== GA4 / GTM scroll depth =====
  const firedPercents = new Set();
  const BREAKPOINTS = [25, 50, 75, 90, 100];

  function sendScrollDepth(percent) {
    if (firedPercents.has(percent)) return;
    firedPercents.add(percent);
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', 'scroll_depth', { percent: percent }); if (DEBUG) console.log('[GA4] gtag scroll_depth:', percent); } catch (e) { if (DEBUG) console.warn(e); }
    } else if (Array.isArray(window.dataLayer)) {
      try { window.dataLayer.push({ event: 'scroll_depth', percent: percent, page_location: location.href, page_title: document.title }); if (DEBUG) console.log('[GTM] dataLayer scroll_depth pushed:', percent); } catch (e) { if (DEBUG) console.warn(e); }
    } else {
      if (DEBUG) console.log('[No GA] scroll_depth (not sent):', percent);
    }
  }

  function checkAndSendDepth() {
    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    const view = window.innerHeight || document.documentElement.clientHeight || 0;
    const full = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight);
    const pos = Math.min(full, y + view);
    const pct = Math.max(0, Math.min(100, Math.round((pos / full) * 100)));
    for (let i = 0; i < BREAKPOINTS.length; i++) {
      if (pct >= BREAKPOINTS[i]) sendScrollDepth(BREAKPOINTS[i]);
    }
  }

  let _scrollThrottleT = 0;
  window.addEventListener('scroll', () => {
    if (_scrollThrottleT) cancelAnimationFrame(_scrollThrottleT);
    _scrollThrottleT = requestAnimationFrame(checkAndSendDepth);
  }, { passive: true });

  // ===== Image / Heading / Ad pause logic =====
  let _cachedImages = null, _cachedHeads = null, _cachedAds = null;
  function refreshCaches() {
    _cachedImages = Array.from(document.querySelectorAll('img, picture, figure')).filter(isDisplayed);
    _cachedHeads = Array.from(document.querySelectorAll('h1, h2, h3')).filter(isDisplayed);
    _cachedAds = Array.from(document.querySelectorAll('#gpt-passback2, #gpt-rect1, .ad, [id^="ad-"]')).filter(isDisplayed);
    if (DEBUG) console.log('[HumanScroll] caches refreshed', _cachedImages.length, 'images', _cachedHeads.length, 'heads', _cachedAds.length, 'ads');
  }
  setInterval(refreshCaches, 10000);
  try { refreshCaches(); } catch (e) { if (DEBUG) console.warn(e); }

  function maybePauseAtHeadingAdOrImage() {
    for (let i = 0; i < (_cachedImages ? _cachedImages.length : 0); i++) {
      const el = _cachedImages[i];
      if (!el || !inViewport(el)) continue;
      if (seededRandom() < 0.40) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        if (DEBUG) console.log('[HumanScroll] pausing at image', el.src || el.alt || '(no src)');
        return randInt(IMAGE_PAUSE_MIN_MS, IMAGE_PAUSE_MAX_MS);
      }
    }

    for (let i = 0; i < (_cachedAds ? _cachedAds.length : 0); i++) {
      const ad = _cachedAds[i];
      if (!ad || !inViewport(ad)) continue;
      try { ad.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      if (DEBUG) console.log('[HumanScroll] pausing at ad', ad.id || ad.className || '(ad)');
      return AD_PAUSE_MS;
    }

    for (let i = 0; i < (_cachedHeads ? _cachedHeads.length : 0); i++) {
      const el = _cachedHeads[i];
      const r = el.getBoundingClientRect();
      if (r.top > 0 && r.top < (window.innerHeight * 0.35)) {
        if (seededRandom() < 0.35) {
          if (DEBUG) console.log('[HumanScroll] pausing at heading', el.textContent && el.textContent.trim().slice(0, 60));
          return randInt(1500, 3000);
        }
        break;
      }
    }
    return 0;
  }

  // ===== Form Automation =====
  function isDisplayedNode(el) { try { return isDisplayed(el); } catch (e) { return false; } }
  function fillForm(form) {
    try {
      const inputs = Array.from(form.querySelectorAll('input, textarea, select')).filter(isDisplayedNode);
      inputs.forEach(input => {
        const type = (input.type || '').toLowerCase();
        if (type === 'password' || input.disabled) return;
        if (type === 'email' || (input.name || '').toLowerCase().includes('email')) {
          input.value = `user${randInt(100, 9999)}@example.com`;
        } else if (type === 'tel' || (input.name || '').toLowerCase().includes('phone')) {
          input.value = '+255' + randInt(600000000, 799999999);
        } else if (input.tagName.toLowerCase() === 'textarea') {
          input.value = 'Looks good — testing form.';
        } else if (type === 'url') {
          input.value = 'https://example.com';
        } else if ((input.name || '').toLowerCase().includes('name')) {
          input.value = 'John Doe';
        } else if (input.tagName.toLowerCase() === 'select') {
          const opt = Array.from(input.options).find(o => o.value && o.value.trim() !== '');
          if (opt) input.value = opt.value;
        } else {
          input.value = 'Test';
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      if (seededRandom() < FORM_SUBMIT_PROB) {
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submit) {
          try { submit.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
          setTimeout(() => { try { submit.click(); } catch (e) { try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (e2) { if (DEBUG) console.warn(e2); } } }, randInt(CLICK_AFTER_MIN_MS, CLICK_AFTER_MAX_MS));
          if (DEBUG) console.log('[HumanScroll] form submitted');
        }
      }
    } catch (e) { if (DEBUG) console.warn('[HumanScroll] fillForm error', e); }
  }

  function tryFormFlowOrFallbackToLink() {
    if (ENABLE_FORMS && seededRandom() < 0.3) {
      const forms = Array.from(document.querySelectorAll('form')).filter(isDisplayedNode);
      if (forms.length) {
        const form = forms[randInt(0, forms.length - 1)];
        if (DEBUG) console.log('[HumanScroll] filling form', form);
        fillForm(form);
        return;
      }
    }
    const links = getAllCandidateLinks();
    if (links.length) {
      const link = links[randInt(0, links.length - 1)];
      if (DEBUG) console.log('[HumanScroll] clicking link', link.href || link.getAttribute('href'));
      try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      setTimeout(() => {
        try { link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (e) { link.click(); }
      }, randInt(CLICK_AFTER_MIN_MS, CLICK_AFTER_MAX_MS));
    } else {
      if (DEBUG) console.log('[HumanScroll] no links/forms to follow — finishing');
      finishSession();
    }
  }

  // ===== Session management =====
  let finished = false;
  const startTime = Date.now();
  function finishSession() {
    finished = true;
    try { localStorage.removeItem('pv_count'); } catch (e) {}
    console.log('[HumanScroll] Session finished after', window.__pageviews_in_tab, 'pages in', Math.round((Date.now() - startTime) / 1000), 'seconds.');
  }

  // ===== Human Scroll Loop =====
  function humanScrollLoop() {
    if (finished) return;

    if (Date.now() - startTime > MAX_SESSION_MS) {
      console.log('[HumanScroll] Max session time exceeded — terminating.');
      finishSession();
      return;
    }

    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    const view = window.innerHeight || document.documentElement.clientHeight || 0;
    const full = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight);
    const pos = Math.min(full, y + view);
    const pct = Math.max(0, Math.min(100, Math.round((pos / full) * 100)));

    checkAndSendDepth();

    if (pct >= randInt(EARLY_EXIT_DEPTH_MIN, EARLY_EXIT_DEPTH_MAX) && seededRandom() < EARLY_EXIT_PROB) {
      if (DEBUG) console.log('[HumanScroll] Early exit at', pct, '%');
      tryFormFlowOrFallbackToLink();
      return;
    }

    if (atBottom()) {
      const initialHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      setTimeout(() => {
        if (atBottom()) {
          const newHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
          if (Math.abs(newHeight - initialHeight) < 8) {
            if (DEBUG) console.log('[HumanScroll] bottom stable — deciding next action');
            tryFormFlowOrFallbackToLink();
            return;
          }
        }
        scheduleNextScrollLoop();
      }, BOTTOM_CONFIRM_MS);
      return;
    }

    const goUp = seededRandom() < UP_CHANCE;
    const deltaMultiplier = (pct < 50) ? 1.5 : 0.8;
    const delta = goUp ? -Math.round(randInt(UP_MIN_PX, UP_MAX_PX) * deltaMultiplier) : Math.round(randInt(DOWN_MIN_PX, DOWN_MAX_PX) * deltaMultiplier);
    try { window.scrollBy({ top: delta, left: 0, behavior: 'smooth' }); } catch (e) { window.scrollBy(0, delta); }

    const basePause = randInt(PAUSE_MIN_MS, PAUSE_MAX_MS);
    const dwell = maybePauseAtHeadingAdOrImage();
    let totalPause = basePause + (dwell || 0);
    if (seededRandom() < 0.04) totalPause += randInt(5000, 10000);

    setTimeout(humanScrollLoop, totalPause);
  }

  function scheduleNextScrollLoop() {
    setTimeout(humanScrollLoop, randInt(PAUSE_MIN_MS, PAUSE_MAX_MS));
  }

  // ===== Observer and Kickoff =====
  const observer = new MutationObserver(() => {
    _candidateLinksCache = null;
    refreshCaches();
    if (DEBUG) console.log('[HumanScroll] DOM changed, caches refreshed');
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    window.__pageviews_in_tab += 1;
    if (DEBUG) console.log('[HumanScroll] Page navigated, now at', window.__pageviews_in_tab, 'pages');
  });

  setTimeout(() => {
    if (DEBUG) console.log('[HumanScroll] starting session — max pages', MAX_PAGES, 'timeout', MAX_SESSION_MS / 1000, 's');
    checkAndSendDepth();
    humanScrollLoop();
  }, START_DELAY_MS);
})();
