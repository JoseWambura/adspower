// ==UserScript==
// @name         JR Sports: Block Images (except Google Ads) + Human-like Scroll (Fast Exit) [No-Homepage/Search-Clicks, Prefer Tags, Close @13] (Click-now, Short-Scroll-then-Navigate)
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Blocks normal images on jrsports.click (allows AdSense). Clicks internal link immediately, then ~5s slow scroll + fast scroll-to-bottom, then navigates (post-click delay reduced by ~10s). Also halves initial wait before action.
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
  function tryCloseTab(reason) {
    console.log('[HumanScroll] Attempting to close tab (' + reason + ')…');
    window.close();
    setTimeout(() => {
      try { window.open('', '_self'); window.close(); } catch {}
    }, 150);
    setTimeout(() => {
      try { location.replace('about:blank'); } catch {}
    }, 350);
  }
  (function maybeCloseOnLoad() {
    const n = getNavCount();
    if (n >= 13) setTimeout(() => tryCloseTab('limit reached on load (>=13)'), 1200);
  })();

  /******************************************************************
   *  A) IMAGE CONTROL — allow Google Ads, block the rest
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

  // Hard block <img>/<source> setters (except allowed ad hosts)
  (function hardBlockMediaSetters() {
    const imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imgDesc && imgDesc.set) {
      const get = imgDesc.get, set = imgDesc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: false, enumerable: imgDesc.enumerable, get,
        set(v) { if (isAllowedURL(v)) return set.call(this, v); this.removeAttribute('src'); }
      });
    }
    const imgSetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
    if (imgSetDesc && imgSetDesc.set) {
      const get = imgSetDesc.get, set = imgSetDesc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
        configurable: false, enumerable: imgSetDesc.enumerable, get,
        set(v) {
          if (typeof v === 'string') {
            const ok = v.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
            if (ok) return set.call(this, v);
          }
          this.removeAttribute('srcset');
        }
      });
    }
    const srcsetDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset');
    if (srcsetDesc && srcsetDesc.set) {
      const get = srcsetDesc.get, set = srcsetDesc.set;
      Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
        configurable: false, enumerable: srcsetDesc.enumerable, get,
        set(v) {
          if (typeof v === 'string') {
            const ok = v.split(',').every(c => { const url = (c.trim().split(/\s+/)[0] || ''); return url && isAllowedURL(url); });
            if (ok) return set.call(this, v);
          }
          this.removeAttribute('srcset');
        }
      });
    }
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
    if (srcDesc && srcDesc.set) {
      const get = srcDesc.get, set = srcDesc.set;
      Object.defineProperty(HTMLSourceElement.prototype, 'src', {
        configurable: false, enumerable: srcDesc.enumerable, get,
        set(v) { if (isAllowedURL(v)) return set.call(this, v); this.removeAttribute('src'); }
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
  console.log('[ImgBlock] Active (top page).');

  /******************************************************************
   *  B) HUMAN-LIKE ACTION FLOW — faster overall
   ******************************************************************/
  (function () {
    function ordinal(n) { const j = n % 10, k = n % 100; if (j === 1 && k !== 11) return n + 'st'; if (j === 2 && k !== 12) return n + 'nd'; if (j === 3 && k !== 13) return n + 'rd'; return n + 'th'; }
    try { const pv = (parseInt(sessionStorage.getItem('pv_count') || '0', 10) + 1); sessionStorage.setItem('pv_count', String(pv)); window.__pageviews_in_tab = pv; console.log('[HumanScroll]', 'This is the ' + ordinal(pv) + ' page load in this tab.'); }
    catch (e) { console.log('[HumanScroll]', 'sessionStorage unavailable; treating as 1st page load.'); window.__pageviews_in_tab = 1; }
  })();

  // ↓ Halved initial start delay (was 15–20s)
  const START_DELAY_MS = randInt(15000, 20000); // 7–10s

  // ↓ Post-click behavior:
  //    1) ~5s slow human scroll
  //    2) fast scroll to bottom (~0.7–1.0s)
  //    3) navigate immediately
  const SLOW_AFTER_CLICK_MS = 5000;           // ~5s slow scroll
  const FAST_TO_BOTTOM_MS   = randInt(700, 1000); // quick sweep to bottom

  // Misc helpers
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function sameHost(url) { try { return new URL(url, location.href).host === location.host; } catch { return false; } }
  function isGoodHref(href) {
    if (!href) return false;
    const s = href.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:') || s.startsWith('tel:')) return false;
    return true;
  }
  function isHomeURL(u) {
    try {
      const url = new URL(u, location.href);
      if (url.origin !== location.origin) return false;
      const normalized = url.pathname.replace(/\/+$/, '/');
      return normalized === '/';
    } catch { return false; }
  }
  function isSearchURL(u) {
    try {
      const url = new URL(u, location.href);
      if (url.origin !== location.origin) return false;
      if (url.searchParams.has('s')) return true;
      const p = url.pathname.toLowerCase();
      if (p === '/search' || p.startsWith('/search/')) return true;
      if (p.includes('/?s=')) return true;
      if (p.includes('search')) return true;
      if ((url.search || '').toLowerCase().includes('search')) return true;
      return false;
    } catch { return false; }
  }
  function isTagLink(a) {
    try {
      if (!a) return false;
      if (a.rel && String(a.rel).toLowerCase().split(/\s+/).includes('tag')) return true;
      if (a.className && /\btag\b/i.test(a.className)) return true;
      const href = a.getAttribute('href') || a.href || '';
      const url = new URL(href, location.href);
      if (url.origin === location.origin && /\/tag\/[^/]/i.test(url.pathname)) return true;
      const txt = (a.innerText || a.textContent || '').trim().toLowerCase();
      if (txt && (txt.startsWith('#') || txt.includes('tag'))) return true;
    } catch {}
    return false;
  }
  function inViewport(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.left < (window.innerWidth || document.documentElement.clientWidth) && r.top < (window.innerHeight || document.documentElement.clientHeight);
  }
  function isDisplayed(el) {
    if (!el) return false;
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
  }

  // Scroll depth events (kept lightweight)
  const firedPercents = new Set();
  const BREAKPOINTS = [25, 50, 75, 90, 100];
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
    if (typeof window.gtag === 'function') window.gtag('event', 'scroll_depth', { percent });
    else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'scroll_depth', percent, page_location: location.href, page_title: document.title });
  }
  function checkAndSendDepth() {
    const pct = getPercentScrolled();
    for (let i = 0; i < BREAKPOINTS.length; i++) if (pct >= BREAKPOINTS[i]) sendScrollDepth(BREAKPOINTS[i]);
  }
  window.addEventListener('scroll', function () {
    if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t);
    checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth);
  }, { passive: true });

  function getAllCandidateLinks() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.filter(a => {
      const href = a.getAttribute('href') || '';
      if (!isGoodHref(href)) return false;
      if (!sameHost(a.href)) return false;
      if (isHomeURL(a.href)) return false;
      if (isSearchURL(a.href)) return false;
      return true;
    });
  }
  function pickRandomLink() {
    const all = getAllCandidateLinks();
    if (!all.length) return null;
    const tags = all.filter(isTagLink);
    const pool = tags.length ? tags : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Cursor visuals (unchanged)
  function createFakeCursor() {
    const cursor = document.createElement('div');
    cursor.style.position = 'fixed';
    cursor.style.top = '0px';
    cursor.style.left = '0px';
    cursor.style.width = '14px';
    cursor.style.height = '14px';
    cursor.style.border = '2px solid #333';
    cursor.style.borderRadius = '50%';
    cursor.style.background = 'rgba(255,255,255,0.85)';
    cursor.style.zIndex = '999999';
    cursor.style.pointerEvents = 'none';
    cursor.style.transition = 'top 0.25s linear, left 0.25s linear';
    document.body.appendChild(cursor);
    return cursor;
  }
  function moveCursorTo(cursor, x, y) { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; }
  function removeCursor(cursor) { if (cursor && cursor.parentNode) cursor.parentNode.removeChild(cursor); }
  function cursorWander(cursor, steps, stepMs, cb) {
    steps = Math.max(0, steps|0);
    let i = 0;
    (function step() {
      if (i >= steps) { cb && cb(); return; }
      i++;
      const x = randInt(30, Math.max(60, window.innerWidth - 30));
      const y = randInt(30, Math.max(60, window.innerHeight - 30));
      moveCursorTo(cursor, x, y);
      setTimeout(step, stepMs);
    })();
  }

  function beforeNavigateIncrement() {
    const n = getNavCount() + 1;
    setNavCount(n);
    if (n >= 13) console.log('[HumanScroll] Navigation count reached', n, '— will attempt to close on next page load.');
    else console.log('[HumanScroll] Navigation count =', n);
  }

  // --- New: Post-click scroll sequence, then navigate ---
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

 function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ↑ NEW: allow a slightly faster slow-scroll via amplitudePx
async function slowHumanScroll(durationMs, amplitudePx = 180) { // was 120 → 180 (a bit faster)
  return new Promise(resolve => {
    const startT = performance.now();
    let lastY = window.pageYOffset || document.documentElement.scrollTop || 0;
    (function frame(now) {
      const t = Math.min(1, (now - startT) / durationMs);
      const step = amplitudePx * (0.5 - Math.cos(t * Math.PI) / 2); // eased micro-steps
      const targetY = lastY + step;
      const delta = targetY - (window.pageYOffset || document.documentElement.scrollTop || 0);
      window.scrollBy(0, delta);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    })(performance.now());
  });
}

// ↓ Slower “burst” than before (increase duration → lower speed)
async function fastScrollToBottom(durationMs) {
  return new Promise(resolve => {
    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const full = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    const maxY = full - (window.innerHeight || document.documentElement.clientHeight || 0);
    const dist = Math.max(0, maxY - startY);
    if (dist <= 2) return resolve();

    const startT = performance.now();
    (function frame(now) {
      const t = Math.min(1, (now - startT) / durationMs);
      // gentle ease (slower burst): easeInOutQuad
      const eased = (t < 0.5) ? 2*t*t : -1 + (4 - 2*t)*t;
      const y = startY + dist * eased;
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    })(performance.now());
  });
}


  function clickNowThenScrollThenNavigate(link) {
    const dest = (link.getAttribute('href') || link.href || '').trim();
    if (!dest) return;

    // Block default navigation of THIS click
    const blocker = function (e) {
      const a = e.target && (e.target.closest ? e.target.closest('a') : null);
      if (a === link) {
        e.preventDefault();
        e.stopImmediatePropagation();
        document.removeEventListener('click', blocker, true);
      }
    };
    document.addEventListener('click', blocker, true);

    // Click now (let handlers/analytics fire)
    try {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch { try { link.click(); } catch {} }

    // Short wander/hover to feel natural, then scroll + navigate
    (async () => {
      // ~5s slow scroll, then quick sweep to bottom (~0.7–1.0s)
      await slowHumanScroll(SLOW_AFTER_CLICK_MS);
      await fastScrollToBottom(FAST_TO_BOTTOM_MS);

      // Reduced post-click wait by ~10s overall vs prior (no extra idle delay here)
      beforeNavigateIncrement();
      try { window.location.assign(dest); }
      catch { window.location.href = dest; }
    })();
  }

  function clickWithCursorFlow(link) {
    const rect = link.getBoundingClientRect();
    const targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    const targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));
    const cursor = createFakeCursor();
    moveCursorTo(cursor, randInt(30, 200), randInt(30, 200));
    // Slightly shorter wander to save time
    const wanderSteps = randInt(1, 3);
    cursorWander(cursor, wanderSteps, randInt(220, 320), function () {
      moveCursorTo(cursor, targetX, targetY);
      setTimeout(function () {
        console.log('[HumanScroll] Click now; short post-click scroll, then navigate →', link.href);
        clickNowThenScrollThenNavigate(link);
        removeCursor(cursor);
      }, randInt(200, 400));
    });
  }

  function scrollToLinkThenClick(link) {
    try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { link.scrollIntoView(true); }
    setTimeout(function () { checkAndSendDepth(); }, 200);
    const aimWait = randInt(600, 1200); // quicker aim
    setTimeout(function () {
      if (!isDisplayed(link)) {
        const alt = pickRandomLink();
        if (alt && alt !== link) return scrollToLinkThenClick(alt);
        return;
      }
      if (!inViewport(link)) {
        try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
        return setTimeout(function () { clickWithCursorFlow(link); }, randInt(250, 500));
      }
      clickWithCursorFlow(link);
    }, aimWait);
  }

  function tryLinkFlow() {
    if (getNavCount() >= 13) { tryCloseTab('limit reached before action'); return; }
    const link = pickRandomLink();
    if (!link) { console.warn('[HumanScroll] No suitable link to click.'); return; }
    scrollToLinkThenClick(link);
  }

  setTimeout(async function () {
  checkAndSendDepth();
  if (getNavCount() >= 13) { 
    tryCloseTab('limit reached before scrolling'); 
    return; 
  }

  // ① Smooth scroll ~900px over ~8–10s
  await animateScrollByPx(900, randInt(8000, 10000));

  // ② Pause 5s
  await new Promise(r => setTimeout(r, 5000));

  // ③ Slower “burst” to bottom (2–3s)
  await fastScrollToBottom(randInt(2000, 3000));

  // ④ Continue with click/navigation
  tryLinkFlow();

}, START_DELAY_MS);



})();

