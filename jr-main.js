// ==UserScript==
// @name         JR Sports: Block Images (except Google Ads) + Human-like Scroll (+ Random Whitelist Nav, Close @13)
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Blocks normal images on jrsports.click (allows AdSense) + human scroll, then opens one random URL from a fixed whitelist (no in-page clicks). Uses sessionStorage rotation (no repeats) and enforces a 13-page limit per tab.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

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
    if (n >= 13) {
      console.log('[HumanScroll] Navigation count reached', n, '— will attempt to close on next page load.');
    } else {
      console.log('[HumanScroll] Navigation count =', n);
    }
  }
  function tryCloseTab(reason) {
    console.log('[HumanScroll] Attempting to close tab (' + reason + ')…');
    window.close();
    setTimeout(() => { try { window.open('', '_self'); window.close(); } catch {} }, 150);
    setTimeout(() => { try { location.replace('about:blank'); } catch {} }, 350);
  }
  (function maybeCloseOnLoad() {
    const n = getNavCount();
    if (n >= 13) {
      setTimeout(() => tryCloseTab('limit reached on load (>=13)'), 1200);
    }
  })();

  /******************************************************************
   *  A) IMAGE CONTROL (TOP PAGE ONLY) — allow Google Ads, block rest
   ******************************************************************/
  const HIDE_NON_AD_IFRAMES = true;

  const ALLOW_HOSTS = [
    /\.googlesyndication\.com$/i,
    /\.doubleclick\.net$/i,
    /\.googleusercontent\.com$/i,
    /\.gstatic\.com$/i,
    /\.googleadservices\.com$/i,
    /\.google\.com$/i,
    /\.googletagservices\.com$/i
  ];

  function isAllowedURL(url) {
    try { const u = new URL(url, location.href); return ALLOW_HOSTS.some(rx => rx.test(u.host)); }
    catch (_) { return false; }
  }

  (function hardBlockMediaSetters() {
    const imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imgDesc && imgDesc.set) {
      const origGet = imgDesc.get, origSet = imgDesc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: false, enumerable: imgDesc.enumerable,
        get: origGet,
        set: function (v) { if (isAllowedURL(v)) return origSet.call(this, v); this.removeAttribute('src'); }
      });
    }
    const imgSetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
    if (imgSetDesc && imgSetDesc.set) {
      const oget = imgSetDesc.get, oset = imgSetDesc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
        configurable: false, enumerable: imgSetDesc.enumerable,
        get: oget,
        set: function (v) {
          if (typeof v === 'string') {
            const ok = v.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
            if (ok) return oset.call(this, v);
          }
          this.removeAttribute('srcset');
        }
      });
    }
    const srcsetDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset');
    if (srcsetDesc && srcsetDesc.set) {
      const oget = srcsetDesc.get, oset = srcsetDesc.set;
      Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
        configurable: false, enumerable: srcsetDesc.enumerable,
        get: oget,
        set: function (v) {
          if (typeof v === 'string') {
            const ok = v.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
            if (ok) return oset.call(this, v);
          }
          this.removeAttribute('srcset');
        }
      });
    }
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
    if (srcDesc && srcDesc.set) {
      const oget = srcDesc.get, oset = srcDesc.set;
      Object.defineProperty(HTMLSourceElement.prototype, 'src', {
        configurable: false, enumerable: srcDesc.enumerable,
        get: oget,
        set: function (v) { if (isAllowedURL(v)) return oset.call(this, v); this.removeAttribute('src'); }
      });
    }
    const origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      const tag = this.tagName;
      const n = String(name).toLowerCase();
      if (tag === 'IMG' && (n === 'src' || n === 'srcset')) {
        if (n === 'src' && isAllowedURL(value)) return origSetAttr.call(this, name, value);
        if (n === 'srcset') {
          const ok = String(value).split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
          if (ok) return origSetAttr.call(this, name, value);
        }
        return;
      }
      if (tag === 'SOURCE' && (n === 'src' || n === 'srcset')) {
        if (n === 'src' && isAllowedURL(value)) return origSetAttr.call(this, name, value);
        if (n === 'srcset') {
          const ok = String(value).split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
          if (ok) return origSetAttr.call(this, name, value);
        }
        return;
      }
      return origSetAttr.call(this, name, value);
    };
  })();

  function stripExistingMedia() {
    document.querySelectorAll('img[src], img[srcset], img[data-src], img[data-srcset]').forEach(img => {
      const src = img.getAttribute('src');
      const srcset = img.getAttribute('srcset');
      const ds = img.getAttribute('data-src');
      const dss = img.getAttribute('data-srcset');
      if (src && !isAllowedURL(src)) img.removeAttribute('src');
      if (srcset) {
        const ok = srcset.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) img.removeAttribute('srcset');
      }
      if (ds && !isAllowedURL(ds)) img.removeAttribute('data-src');
      if (dss) {
        const ok2 = dss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok2) img.removeAttribute('data-srcset');
      }
      img.removeAttribute('sizes');
      img.setAttribute('loading', 'lazy');
    });
    document.querySelectorAll('picture source[src], picture source[srcset], source[src], source[srcset]').forEach(s => {
      const src = s.getAttribute('src');
      const ss = s.getAttribute('srcset');
      if (src && !isAllowedURL(src)) s.removeAttribute('src');
      if (ss) {
        const ok = ss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) s.removeAttribute('srcset');
      }
      s.removeAttribute('sizes');
    });
  }

  function observeNewMedia() {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'IMG') sanitizeImg(n);
          else if (n.tagName === 'SOURCE') sanitizeSource(n);
          else if (n.querySelectorAll) {
            n.querySelectorAll('img').forEach(sanitizeImg);
            n.querySelectorAll('source').forEach(sanitizeSource);
          }
        }
        if (m.type === 'attributes') {
          const t = m.target;
          if (t && t.nodeType === 1) {
            if (t.tagName === 'IMG') sanitizeImg(t);
            if (t.tagName === 'SOURCE') sanitizeSource(t);
          }
        }
      }
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'sizes']
    });

    function sanitizeImg(img) {
      const s = img.getAttribute('src');
      if (s && !isAllowedURL(s)) img.removeAttribute('src');
      const ss = img.getAttribute('srcset');
      if (ss) {
        const ok = ss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) img.removeAttribute('srcset');
      }
      const ds = img.getAttribute('data-src');
      if (ds && !isAllowedURL(ds)) img.removeAttribute('data-src');
      const dss = img.getAttribute('data-srcset');
      if (dss) {
        const ok2 = dss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok2) img.removeAttribute('data-srcset');
      }
      img.removeAttribute('sizes');
    }
    function sanitizeSource(s) {
      const src = s.getAttribute('src');
      if (src && !isAllowedURL(src)) s.removeAttribute('src');
      const ss = s.getAttribute('srcset');
      if (ss) {
        const ok = ss.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
        if (!ok) s.removeAttribute('srcset');
      }
      s.removeAttribute('sizes');
    }
  }

  function setupIframeHider() {
    if (!HIDE_NON_AD_IFRAMES) return;
    function isAllowedIframeURL(url) {
      try { const u = new URL(url, location.href); return ALLOW_HOSTS.some(rx => rx.test(u.host)); }
      catch (_) { return false; }
    }
    function markHidden(iframe) {
      if (iframe.dataset.__hsHidden === '1') return;
      iframe.dataset.__hsHidden = '1';
      iframe.style.setProperty('display', 'none', 'important');
      iframe.style.setProperty('visibility', 'hidden', 'important');
      iframe.style.setProperty('width', '0px', 'important');
      iframe.style.setProperty('height', '0px', 'important');
      iframe.style.setProperty('min-width', '0', 'important');
      iframe.style.setProperty('min-height', '0', 'important');
      iframe.style.setProperty('border', '0', 'important');
    }
    function maybeHide(iframe) {
      const src = iframe.getAttribute('src') || '';
      if (isAllowedIframeURL(src)) return;
      if (iframe.hasAttribute('srcdoc')) { markHidden(iframe); return; }
      const s = src.toLowerCase();
      const looksLikeImage =
        /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/.test(s) ||
        s.startsWith('data:image/') ||
        /[/?._-](img|image|images|photo|gallery|thumb|media|cdn)[/?._-]?/i.test(s);
      if (looksLikeImage) { markHidden(iframe); return; }
      try {
        const u = new URL(src, location.href);
        if (u.host === location.host && /\/(img|image|images|photo|gallery|media|cdn)\b/i.test(u.pathname)) markHidden(iframe);
      } catch (_) {}
    }
    function sweep(root) { (root || document).querySelectorAll('iframe').forEach(maybeHide); }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => sweep(document), { once: true });
    } else { sweep(document); }
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'IFRAME') maybeHide(n);
          else if (n.querySelectorAll) n.querySelectorAll('iframe').forEach(maybeHide);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  stripExistingMedia();
  observeNewMedia();
  setupIframeHider();
  console.log('[ImgBlock] Active (top page). Allowed image hosts:', ALLOW_HOSTS.map(r => r.source).join(', '));

  /******************************************************************
   *  B) HUMAN-LIKE SCROLLER — tuned a bit faster overall
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

  const START_DELAY_MS    = Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000; // keep 15–20s
  const SCROLL_DIST_MIN_PX = 800, SCROLL_DIST_MAX_PX = 1200;
  const SCROLL_DUR_MIN_MS  = 3000, SCROLL_DUR_MAX_MS  = 5000;
  const MIN_SCROLL_CYCLES  = Math.floor(Math.random() * (4 - 3 + 1)) + 3; // 3–4 cycles
  const READ_PAUSE_MIN_MS  = 4000,  READ_PAUSE_MAX_MS  = 5000;
  const BOTTOM_CONFIRM_MS  = 900;

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
   *  C) TARGETED RANDOM NAV — rotate through your whitelist (no repeats)
   ******************************************************************/
  const LINK_TARGETS = [
    "https://jrsports.click/tag/potters-next-task-will-be-to-turn-things-around-in-the-premier-league/",
    "https://jrsports.click/tag/a-major-transfer-story-unfolding/",
    "https://jrsports.click/tag/the-complexity-of-player-coach-relationships/",
    "https://jrsports.click/tag/bridging-the-gap-fan-engagement-nationwide/",
    "https://jrsports.click/tag/personal-terms-agreed-player-on-board-with-chiefs-vision/",
    "https://jrsports.click/tag/amakhosi-offer-straight-cash/",
    "https://jrsports.click/tag/what-this-victory-means-for-mokwanas-future/",
    "https://jrsports.click/tag/says-piers-morgan/",
    "https://jrsports.click/tag/should-chiefs-forget-about-appollis-and-find-a-more-viable-target/",
    "https://jrsports.click/tag/walker-could-link-up-with-fellow-england-internationals-abraham-and-tomori-at-the-san-siro/",
    "https://jrsports.click/tag/chiefs-hard-at-work-in-the-january-window/",
    "https://jrsports.click/kaizer-chiefs-transfers-ramiro-vaca-zitha-kwinika-wandile-duba/",
    "https://jrsports.click/orlando-pirates-identify-new-striker-target-for-this-window/",
    "https://jrsports.click/tag/mohamed-salah-the-king-of-anfield/",
    "https://jrsports.click/real-madrid-vs-manchester-city-a-modern-champions-league-rivalry-what-could-2025-hold/",
    "https://jrsports.click/tag/the-barcelona-and-la-liga-transfer-saga/",
    "https://jrsports.click/tag/the-managers-take-jurgen-klopp-on-salahs-importance/",
    "https://jrsports.click/antony-launches-legal-action-against-ajax-over-unsavoury-manchester-united-transfer/",
    "https://jrsports.click/tag/mduduzi-shabalala/",
    "https://jrsports.click/tag/key-highlights-of-the-betway-sponsorship/",
    "https://jrsports.click/tag/saleng-situation-dividing-fans/",
    "https://jrsports.click/no-offer-from-kaizer-chiefs-for-prime-transfer-target/",
    "https://jrsports.click/lobola-negotiations-former-kaizer-chiefs-star-pictures/",
    "https://jrsports.click/kaizer-chiefs-bid-for-top-nasreddine-nabi-target-rejected/",
    "https://jrsports.click/tag/arsenal-vs-tottenham-what-has-been-said/",
    "https://jrsports.click/heres-how-kaizer-chiefs-should-spend-r60-million/",
    "https://jrsports.click/orlando-pirates-deny-monnapule-salengs-uae-move-agent-claims-it-left-him-disheartened/",
    "https://jrsports.click/pep-guardiolas-confidence-in-e60m-signing-nico-gonzalez-a-midfield-gem-for-manchester-city/",
    "https://jrsports.click/tag/nasreddine-nabis-absence-a-blessing-in-disguise/",
    "https://jrsports.click/tag/midweek-premier-league-fixtures/",
    "https://jrsports.click/tag/makhehleni-makhaula-missed-midweek/",
    "https://jrsports.click/tag/golden-arrows-in-durban/",
    "https://jrsports.click/tag/the-transfer-of-dani-olmo-a-strategic-move/",
    "https://jrsports.click/tag/walker-favours-a-move-to-ac-milan-as-he-seeks-an-exit-away-from-the-etihad/",
    "https://jrsports.click/kaizer-chiefs-set-to-unveil-new-signing-a-major-boost-for-the-glamour-boys/",
    "https://jrsports.click/orlando-pirates-beating-chiefs-and-sundowns-for-bafana-star/",
    "https://jrsports.click/tag/brighton-unveiled-gomez-at-the-amex-in-december/",
    "https://jrsports.click/tag/caf-champions-league-orlando-pirates-vs-cr-belouizdad/",
    "https://jrsports.click/tag/kahrabas-career-after-al-ahly/",
    "https://jrsports.click/tag/dubas-rise-to-prominence/",
    "https://jrsports.click/tag/wayne-rooney-has-been-tipped-for-a-return-to-where-it-all-began-for-him/",
    "https://jrsports.click/tag/why-is-maela-on-the-out/",
    "https://jrsports.click/elias-mokwana-secures-first-major-trophy-as-esperance-de-tunis-clinches-tunisian-super-cup/",
    "https://jrsports.click/morena-ramoreboli-appointed-head-coach-of-botswanas-national-team-a-new-era-for-the-zebras/",
    "https://jrsports.click/tag/coach-jose-riveiros-confidence/",
    "https://jrsports.click/mathys-tel-a-rising-star-in-european-football/",
    "https://jrsports.click/tag/mayo-scored-for-hosts/",
    "https://jrsports.click/man-citys-premier-league-rivals-told-to-sign-kyle-walker-as-champions-league-contenders-eye-up-move/",
    "https://jrsports.click/tag/pitso-mosimane-a-legend-in-football-coaching/",
    "https://jrsports.click/tag/the-meeting-that-changed-everything/",
    "https://jrsports.click/tag/whats-next-for-saleng/",
    "https://jrsports.click/terms-and-conditions/",
    "https://jrsports.click/tag/khusanov-is-set-to-become-citys-first-signing-of-the-transfer-window/",
    "https://jrsports.click/tag/chairman-confirms-kaizer-chiefs-approach-for-his-right-back/",
    "https://jrsports.click/kaizer-chiefs-full-list-five-bafana-bafana-stars/",
    "https://jrsports.click/premier-league-done-deals-every-completed-transfer-in-2025-january-window-tottenham-land-new-goalkeeper/",
    "https://jrsports.click/more-worrying-news-confirmed-between-pirates-and-saleng/",
    "https://jrsports.click/tag/the-uncertain-road-ahead/",
    "https://jrsports.click/tag/nabis-response/",
    "https://jrsports.click/enzo-maresca-shuts-down-reporter-with-five-word-response-as-he-laughs-off-awkward-question/",
    "https://jrsports.click/dr-patrice-motsepe-re-elected-as-caf-president-a-new-era-for-african-football-until-2029/",
    "https://jrsports.click/tag/dream-starting-xi-with-new-signings/",
    "https://jrsports.click/tag/why-pirates-said-no/",
    "https://jrsports.click/tag/dubas-potential-at-kaizer-chiefs/",
    "https://jrsports.click/tag/2016-real-madrid-edge-past-manchester-city-in-the-semifinals/",
    "https://jrsports.click/tag/could-chiefs-have-been-a-better-fit/",
    "https://jrsports.click/tag/buccaneers-proposed-swap-plus-cash/",
    "https://jrsports.click/tag/more-on-basadien-negotiations/",
    "https://jrsports.click/itumeleng-khune-criticizes-coach-nasreddine-nabi-over-handling-of-mfundo-vilakazi/",
    "https://jrsports.click/tag/the-premier-league-season-is-the-highlight-of-a-football-fans-year/",
    "https://jrsports.click/tag/mngqithis-legacy-and-the-road-ahead/",
    "https://jrsports.click/tag/but-rogers-scored-the-villa-winner-after-a-controversial-onana-leveller/",
    "https://jrsports.click/category/news/",
    "https://jrsports.click/tag/can-amakhosi-claim-the-nedbank-cup/",
    "https://jrsports.click/nabi-chiefs-star-will-continue-in-new-position-if/",
    "https://jrsports.click/tag/three-signings-in-january-a-bold-statement-of-intent/",
    "https://jrsports.click/tag/basadien-to-replace-ageing-skipper-maela/",
    "https://jrsports.click/kyle-walker-keen-on-move-to-ac-milan-after-asking-pep-guardiola-to-leave-man-city/",
    "https://jrsports.click/tag/pirates-aim-to-lure-basadien-over-from-stellenbosch/",
    "https://jrsports.click/tag/why-cele-fits-kaizer-chiefs-plans/",
    "https://jrsports.click/tag/a-new-era-with-betway-premiership-sponsorship/",
    "https://jrsports.click/junior-khanyes-bold-prediction-al-ahly-will-claim-caf-champions-league-glory-despite-loss-to-orlando-pirates/",
    "https://jrsports.click/tag/is-duba-a-kaizer-chiefs-legend-in-the-making/",
    "https://jrsports.click/tag/is-basadien-the-answer-to-pirates-left-back-conundrum/",
    "https://jrsports.click/las-vegas-grand-prix-2025-schedule-drivers-and-key-insights/",
    "https://jrsports.click/golf-holiday-packages-scotland-ultimate-guide-for-2025/",
    "https://jrsports.click/leicester-turn-down-chance-to-sign-premier-league-star-with-club-set-to-announce-arrival-of-3million-alternative/",
    "https://jrsports.click/tag/a-bright-future-for-amakhosi/",
    "https://jrsports.click/tag/group-f/",
    "https://jrsports.click/kaizer-chiefs-boss-nabi-isolates-two-priority-transfer-targets/",
    "https://jrsports.click/tag/a-landmark-moment-for-mokwana-in-tunisia/",
    "https://jrsports.click/tag/velebayi-wants-to-play-top-flight-soccer/",
    "https://jrsports.click/ex-pirates-sundowns-striker-kermit-erasmus-is-back-in-the-psl/",
    "https://jrsports.click/tag/how-many-matches-are-in-a-premier-league-season/",
    "https://jrsports.click/i-know-your-faces-pep-guardiola-scolds-autograph-hunters-and-urges-them-to-rethink-their-lives/",
    "https://jrsports.click/tag/implications-for-south-african-football/",
    "https://jrsports.click/tag/pitso-mosimanes-response-and-legacy/",
    "https://jrsports.click/tag/how-does-it-work/",
    "https://jrsports.click/kaizer-chiefs-three-most-important-players/",
    "https://jrsports.click/rulani-mokwena-set-to-inflict-double-transfer-blow-to-kaizer-chiefs/"
  ];

  // Stored in sessionStorage so each tab gets its own rotation
  const POOL_KEY = '__hs_link_pool_v1';

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getPoolState() {
    try {
      const raw = sessionStorage.getItem(POOL_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function setPoolState(state) {
    try { sessionStorage.setItem(POOL_KEY, JSON.stringify(state)); } catch {}
  }

  function ensurePool() {
    let s = getPoolState();
    if (!s || !Array.isArray(s.order) || typeof s.idx !== 'number' || s.order.length !== LINK_TARGETS.length) {
      s = { order: shuffle([...Array(LINK_TARGETS.length).keys()]), idx: 0 };
      setPoolState(s);
    }
    return s;
  }

  function pickNextTarget() {
    const s = ensurePool();
    const i = s.order[s.idx];
    s.idx += 1;
    if (s.idx >= s.order.length) {
      // reshuffle for the next pass
      s.order = shuffle(s.order);
      s.idx = 0;
    }
    setPoolState(s);
    return LINK_TARGETS[i];
  }

  function navigateToRandomTarget() {
    if (getNavCount() >= 13) { tryCloseTab('limit reached before target nav'); return; }
    const target = pickNextTarget();
    const delay = Math.floor(Math.random() * (1600 - 800 + 1)) + 800; // small natural wait
    console.log('[HumanScroll] Next target chosen:', target, '… navigating in ~', delay, 'ms');
    setTimeout(() => {
      beforeNavigateIncrement();
      location.href = target; // same-tab nav keeps the flow & counter
    }, delay);
  }

  /******************************************************************
   *  D) Flow — scroll to bottom, then go to a random whitelist URL
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
              console.log('[HumanScroll] Reached bottom after', cyclesDone, 'cycles. Going to a random whitelisted tag URL…');
              navigateToRandomTarget();
            });
          } else { loop(); }
        });
      } else { doOneScrollCycle().then(loop); }
    })();
  }

  /******************************************************************
   *  E) Kickoff: initial wait, then scrolling
   ******************************************************************/
  setTimeout(function () {
    checkAndSendDepth();
    if (getNavCount() >= 13) { tryCloseTab('limit reached before scrolling'); return; }
    runScrollsUntilBottomThenAct();
  }, START_DELAY_MS);

})();
