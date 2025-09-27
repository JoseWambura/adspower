// ==UserScript==
// @name         JR Sports: Block Images (except Google Ads) + Human-like Scroll (600–900px @ 6–10s) [No-Homepage-Clicks]
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Blocks normal images on jrsports.click (allows AdSense) + human-like scrolling (4–5 cycles, must reach bottom) then 40% safe form submit or random link (fake cursor), excluding homepage from clicks; GA4/GTM scroll depth + per-tab page-load counter.
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

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
   *  B) HUMAN-LIKE SCROLLER (starts later; image-block safe)
   ******************************************************************/
  (function () {
    function ordinal(n) { const j = n % 10, k = n % 100; if (j === 1 && k !== 11) return n + 'st'; if (j === 2 && k !== 12) return n + 'nd'; if (j === 3 && k !== 13) return n + 'rd'; return n + 'th'; }
    try { const pv = (parseInt(sessionStorage.getItem('pv_count') || '0', 10) + 1); sessionStorage.setItem('pv_count', String(pv)); window.__pageviews_in_tab = pv; console.log('[HumanScroll]', 'This is the ' + ordinal(pv) + ' page load in this tab.'); }
    catch (e) { console.log('[HumanScroll]', 'sessionStorage unavailable; treating as 1st page load.'); window.__pageviews_in_tab = 1; }
  })();

  const START_DELAY_MS = Math.floor(Math.random() * (13000 - 10000 + 1)) + 10000; // 10–13s
  const SCROLL_DIST_MIN_PX = 600, SCROLL_DIST_MAX_PX = 900;
  const SCROLL_DUR_MIN_MS  = 6000, SCROLL_DUR_MAX_MS  = 10000;
  const MIN_SCROLL_CYCLES  = Math.floor(Math.random() * (5 - 4 + 1)) + 4;
  const READ_PAUSE_MIN_MS  = 500,  READ_PAUSE_MAX_MS  = 1500;
  const BOTTOM_CONFIRM_MS  = 1500;

  const CLICK_AFTER_MIN_MS = 1200, CLICK_AFTER_MAX_MS = 3200, SAME_HOST_ONLY = true;
  const ENABLE_FORMS = true, FORM_SUBMIT_PROB = 0.40, FORM_CLICK_HOVER_MS = 350;
  const WANDER_STEPS_MIN = 2, WANDER_STEPS_MAX = 4, WANDER_STEP_MS = 300, FINAL_HOVER_MS = 350;

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
  function sameHost(url) { try { return new URL(url, location.href).host === location.host; } catch (e) { return false; } }
  function isGoodHref(href) {
    if (!href) return false;
    const s = href.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:') || s.startsWith('tel:')) return false;
    return true;
  }
  function isDisplayed(el) { if (!el) return false; if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false; const style = window.getComputedStyle(el); if (style.visibility === 'hidden' || style.display === 'none') return false; return true; }
  function inViewport(el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.right > 0 && r.left < (window.innerWidth || document.documentElement.clientWidth) && r.top < (window.innerHeight || document.documentElement.clientHeight); }

  // NEW: helper to detect homepage URLs on same origin (exclude from clicks)
  function isHomeURL(u) {
    try {
      const url = new URL(u, location.href);
      if (url.origin !== location.origin) return false;
      // treat any path resolving to "/" as homepage (regardless of search/hash)
      const normalized = url.pathname.replace(/\/+$/, '/');
      return normalized === '/';
    } catch (e) {
      return false;
    }
  }

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
    if (typeof window.gtag === 'function') { window.gtag('event', 'scroll_depth', { percent: percent }); console.log('[GA4] gtag scroll_depth:', percent); }
    else if (Array.isArray(window.dataLayer)) { window.dataLayer.push({ event: 'scroll_depth', percent: percent, page_location: location.href, page_title: document.title }); console.log('[GTM] dataLayer scroll_depth:', percent); }
    else { console.log('[No GA] scroll_depth (not sent):', percent); }
  }
  function checkAndSendDepth() { const pct = getPercentScrolled(); for (let i = 0; i < BREAKPOINTS.length; i++) { if (pct >= BREAKPOINTS[i]) sendScrollDepth(BREAKPOINTS[i]); } }
  window.addEventListener('scroll', function () { if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t); checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth); }, { passive: true });

  function getAllCandidateLinks() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.filter(a => {
      const href = a.getAttribute('href') || '';
      if (!isGoodHref(href)) return false;
      // same-host filter
      if (SAME_HOST_ONLY && !sameHost(a.href)) return false;
      // EXCLUDE homepage links
      if (isHomeURL(a.href)) return false;
      return true;
    });
  }

  function logAllLinks() {
    const raw = Array.from(document.querySelectorAll('a'));
    const mapped = raw.map((a, i) => ({ index: i, text: (a.innerText || a.textContent || '').trim().slice(0, 120), href: a.href || a.getAttribute('href') || '' }));
    console.log('[HumanScroll] Found', mapped.length, 'links.');
    if (console.table) console.table(mapped);
    return mapped;
  }

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
  function cursorWander(cursor, steps, cb) {
    steps = Math.max(0, steps|0);
    let i = 0;
    (function step() {
      if (i >= steps) { cb && cb(); return; }
      i++;
      const x = randInt(30, Math.max(60, window.innerWidth - 30));
      const y = randInt(30, Math.max(60, window.innerHeight - 30));
      moveCursorTo(cursor, x, y);
      setTimeout(step, WANDER_STEP_MS);
    })();
  }
  function clickWithCursorFlow(link) {
    const rect = link.getBoundingClientRect();
    const targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    const targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));
    const cursor = createFakeCursor();
    moveCursorTo(cursor, randInt(30, 200), randInt(30, 200));
    const wanderSteps = randInt(WANDER_STEPS_MIN, WANDER_STEPS_MAX);
    cursorWander(cursor, wanderSteps, function () {
      moveCursorTo(cursor, targetX, targetY);
      setTimeout(function () {
        console.log('[HumanScroll] Clicking:', link.href);
        try { link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
        catch (e) { link.click(); }
        removeCursor(cursor);
      }, FINAL_HOVER_MS);
    });
  }

  function isSafeForm(form) {
    const act = form.getAttribute('action') || '';
    try { if (act) { if (!sameHost(new URL(act, location.href).href)) return false; } } catch (e) { return false; }
    const text = (form.innerText || '').toLowerCase();
    if (text.includes('logout') || text.includes('delete') || text.includes('unsubscribe')) return false;
    if (form.querySelector('input[type="password"], input[name*="pass"], input[id*="pass"]')) return false;
    if (!findSubmitButton(form)) return false;
    return true;
  }
  function getCandidateForms() { return Array.from(document.querySelectorAll('form')).filter(isSafeForm); }
  function findSubmitButton(form) {
    return form.querySelector('button[type="submit"], input[type="submit"], button:not([type]), input[type="button"][name="submit"], input[type="image"]');
  }
  function fillInput(el) {
    const name = (el.name || el.id || '').toLowerCase();
    const ph = (el.getAttribute('placeholder') || '').toLowerCase();
    if (el.type === 'email' || name.includes('email')) el.value = 'user' + randInt(1000,9999) + '@example.com';
    else if (el.type === 'tel' || name.includes('phone')) el.value = '+255' + randInt(600000000, 799999999);
    else if (el.type === 'number') el.value = randInt(1, 100);
    else if (name.includes('name')) el.value = 'John Doe';
    else if (name.includes('city')) el.value = 'Dar es Salaam';
    else if (name.includes('country')) el.value = 'Tanzania';
    else if (el.type === 'url') el.value = 'https://example.com';
    else if (ph.includes('comment') || ph.includes('message') || ph.includes('feedback') || el.tagName === 'TEXTAREA') el.value = 'Just checking this out. Looks good!';
    else el.value = (el.tagName === 'TEXTAREA') ? 'Hello!' : 'Sample';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function fillFormFields(form) {
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"], textarea').forEach(fillInput);
    form.querySelectorAll('select').forEach(function (sel) {
      const opt = Array.from(sel.options).find(o => o.value && o.value.trim() !== '');
      if (opt) sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"]').forEach(function (c) {
      if (Math.random() < 0.35) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    const radiosByName = {};
    form.querySelectorAll('input[type="radio"]').forEach(function (r) {
      (radiosByName[r.name] = radiosByName[r.name] || []).push(r);
    });
    Object.keys(radiosByName).forEach(function (n) {
      const g = radiosByName[n], pick = g[randInt(0, g.length - 1)];
      if (pick) { pick.checked = true; pick.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }
  function submitFormWithCursor(form) {
    const btn = findSubmitButton(form) || form;
    try { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    const rect = btn.getBoundingClientRect();
    const targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    const targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));
    const cursor = createFakeCursor();
    moveCursorTo(cursor, randInt(30, 200), randInt(30, 200));
    const steps = randInt(WANDER_STEPS_MIN, WANDER_STEPS_MAX);
    cursorWander(cursor, steps, function () {
      moveCursorTo(cursor, targetX, targetY);
      setTimeout(function () {
        console.log('[HumanScroll] Submitting form...');
        if (btn !== form) {
          try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
          catch (e) { btn.click(); }
        } else {
          form.requestSubmit ? form.requestSubmit() : form.submit();
        }
        removeCursor(cursor);
      }, FORM_CLICK_HOVER_MS);
    });
  }
  function tryFormFlowOrFallbackToLink() {
    if (ENABLE_FORMS && Math.random() < FORM_SUBMIT_PROB) {
      const forms = getCandidateForms();
      if (forms.length) {
        const form = forms[randInt(0, forms.length - 1)];
        console.log('[HumanScroll] Chose FORM (40% path). Filling & submitting:', form);
        try { form.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        setTimeout(function () { fillFormFields(form); submitFormWithCursor(form); }, randInt(700, 1500));
        return;
      } else { console.log('[HumanScroll] No safe forms found. Falling back to link click.'); }
    }
    const link = pickRandomLink();
    if (!link) { console.warn('[HumanScroll] No suitable link to click.'); return; }
    scrollToLinkThenClick(link);
  }

  function pickRandomLink() {
    const links = getAllCandidateLinks();
    if (!links.length) return null;
    return links[Math.floor(Math.random() * links.length)];
  }
  function scrollToLinkThenClick(link) {
    try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { link.scrollIntoView(true); }
    setTimeout(function () { checkAndSendDepth(); }, 250);
    const wait = randInt(CLICK_AFTER_MIN_MS, CLICK_AFTER_MAX_MS);
    setTimeout(function () {
      if (!isDisplayed(link)) {
        console.warn('[HumanScroll] Picked link isn’t displayed. Repicking…');
        const alt = pickRandomLink();
        if (alt && alt !== link) return scrollToLinkThenClick(alt);
        return;
      }
      if (!inViewport(link)) {
        try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        return setTimeout(function () { clickWithCursorFlow(link); }, randInt(400, 900));
      }
      clickWithCursorFlow(link);
    }, wait);
  }

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
  function runScrollsUntilBottomThenAct() {
    let cyclesDone = 0;
    (function loop() {
      if (cyclesDone < MIN_SCROLL_CYCLES || !atBottom()) {
        doOneScrollCycle().then(function () {
          cyclesDone++;
          if (atBottom() && cyclesDone >= MIN_SCROLL_CYCLES) {
            confirmBottomStable(function () {
              checkAndSendDepth();
              console.log('[HumanScroll] Reached bottom after', cyclesDone, 'cycles. Deciding next action…');
              logAllLinks();
              tryFormFlowOrFallbackToLink();
            });
          } else { loop(); }
        });
      } else { doOneScrollCycle().then(loop); }
    })();
  }

  setTimeout(function () {
    checkAndSendDepth();
    runScrollsUntilBottomThenAct();
  }, START_DELAY_MS);

})();
