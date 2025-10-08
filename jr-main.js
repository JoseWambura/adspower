(function () {
  'use strict';

  // --- Anti-Detection: Spoof Fingerprint to Match Proxy ---
  (function () {
    function spoofFingerprint(proxyOs, proxyTimezone) {
      const userAgents = {
        windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
        macos: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
      };
      const selectedUA = userAgents[proxyOs.toLowerCase()] || userAgents.windows;
      Object.defineProperty(navigator, 'userAgent', { value: selectedUA, configurable: true });
      Object.defineProperty(navigator, 'platform', { value: proxyOs === 'windows' ? 'Win32' : 'MacIntel', configurable: true });
      console.log('[HumanScroll] Spoofed User-Agent:', selectedUA, 'Platform:', navigator.platform);

      try {
        Object.defineProperty(Intl, 'DateTimeFormat', {
          value: function () {
            return { resolvedOptions: () => ({ timeZone: proxyTimezone }) };
          },
          configurable: true
        });
        console.log('[HumanScroll] Spoofed TimeZone:', proxyTimezone);
      } catch (e) {
        console.warn('[HumanScroll] Failed to spoof time zone:', e);
      }

      Object.defineProperty(navigator, 'language', { value: proxyTimezone.includes('America') ? 'en-US' : 'en-GB', configurable: true });
      Object.defineProperty(navigator, 'languages', { value: [proxyTimezone.includes('America') ? 'en-US' : 'en-GB', 'en'], configurable: true });

      try {
        Object.defineProperty(navigator, 'getUserMedia', { value: null, configurable: true });
        Object.defineProperty(navigator, 'webkitGetUserMedia', { value: null, configurable: true });
        Object.defineProperty(navigator, 'mozGetUserMedia', { value: null, configurable: true });
        Object.defineProperty(window, 'RTCPeerConnection', { value: null, configurable: true });
        console.log('[HumanScroll] WebRTC disabled');
      } catch (e) {
        console.warn('[HumanScroll] Failed to disable WebRTC:', e);
      }
    }

    function spoofCanvasAndWebGL() {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type) {
        const ctx = originalGetContext.apply(this, arguments);
        if (type === '2d' || type === 'webgl') {
          const originalFillRect = ctx.fillRect;
          ctx.fillRect = function (x, y, w, h) {
            const noise = Math.random() * 0.02 - 0.01;
            return originalFillRect.call(this, x + noise, y + noise, w, h);
          };
          const originalGetImageData = ctx.getImageData;
          ctx.getImageData = function (x, y, w, h) {
            const data = originalGetImageData.call(this, x, y, w, h);
            for (let i = 0; i < data.data.length; i += 4) {
              data.data[i] += Math.floor(Math.random() * 3 - 1);
              data.data[i + 1] += Math.floor(Math.random() * 3 - 1);
              data.data[i + 2] += Math.floor(Math.random() * 3 - 1);
            }
            return data;
          };
        }
        return ctx;
      };
      console.log('[HumanScroll] Canvas/WebGL fingerprint randomized');
    }

    function getProxyMetadata() {
      return { os: 'windows', timezone: 'America/New_York' };
    }

    const proxyMetadata = getProxyMetadata();
    spoofFingerprint(proxyMetadata.os, proxyMetadata.timezone);
    spoofCanvasAndWebGL();
  })();

  // --- Per-tab page load counter + pretty console log ---
  (function () {
    function ordinal(n) {
      var j = n % 10, k = n % 100;
      if (j === 1 && k !== 11) return n + 'st';
      if (j === 2 && k !== 12) return n + 'nd';
      if (j === 3 && k !== 13) return n + 'rd';
      return n + 'th';
    }
    try {
      var pv = parseInt(sessionStorage.getItem('pv_count') || '0', 10) + 1;
      sessionStorage.setItem('pv_count', String(pv));
      window.__pageviews_in_tab = pv;
      console.log('[HumanScroll] This is the ' + ordinal(pv) + ' page load in this tab.');
    } catch (e) {
      console.log('[HumanScroll] sessionStorage unavailable; treating as 1st page load.');
      window.__pageviews_in_tab = 1;
    }
  })();

  // ===== Config =====
  var START_DELAY_MS = Math.floor(Math.random() * (13000 - 10000 + 1)) + 10000;
  var PAUSE_MIN_MS = 1500; // Reduced for faster scrolling
  var PAUSE_MAX_MS = 4000;
  var DOWN_MIN_PX = 200; // Increased for fewer iterations
  var DOWN_MAX_PX = 600;
  var UP_CHANCE = 0.20;
  var UP_MIN_PX = 60;
  var UP_MAX_PX = 250;
  var BOTTOM_CONFIRM_MS = 2000;

  var EARLY_EXIT_PROB = 0.50; // Increased to 50% for faster exits
  var EARLY_EXIT_DEPTH_MIN = 50;
  var EARLY_EXIT_DEPTH_MAX = 70;

  var CLICK_AFTER_MIN_MS = 1500;
  var CLICK_AFTER_MAX_MS = 3500;
  var SAME_HOST_ONLY = true;

  var ENABLE_FORMS = true;
  var FORM_SUBMIT_PROB = 0.15;
  var FORM_CLICK_HOVER_MS = 400;
  var FORM_FIELD_DELAY_MIN_MS = 500;
  var FORM_FIELD_DELAY_MAX_MS = 1500;

  var WANDER_STEPS_MIN = 3;
  var WANDER_STEPS_MAX = 6;
  var WANDER_STEP_MS = 250;
  var FINAL_HOVER_MS = 400;

  var AD_PAUSE_MS = 3000; // Reduced but sufficient for viewability
  var IMAGE_PAUSE_MIN_MS = 2000;
  var IMAGE_PAUSE_MAX_MS = 5000;

  // ===== Helpers =====
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function atBottom(threshold) {
    threshold = threshold || 2;
    var y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var view = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
    var doc = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    return y + view >= doc - threshold;
  }
  function sameHost(url) {
    try { return new URL(url, location.href).host === location.host; } catch (e) { return false; }
  }
  function isGoodHref(href) {
    if (!href) return false;
    var s = href.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:') || s.startsWith('tel:')) return false;
    return true;
  }
  function isDisplayed(el) {
    if (!el) return false;
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
    var style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
  }
  function inViewport(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.left < (window.innerWidth || document.documentElement.clientWidth) && r.top < (window.innerHeight || document.documentElement.clientHeight);
  }

  // --- Enhanced: Pause at headings, ads, and images ---
  function maybePauseAtHeadingAdOrImage() {
    var images = document.querySelectorAll('img, figure, picture');
    for (var i = 0; i < images.length; i++) {
      var el = images[i];
      if (inViewport(el) && Math.random() < 0.40) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        console.log('[HumanScroll] Pausing at image:', el.src || el.alt);
        return randInt(IMAGE_PAUSE_MIN_MS, IMAGE_PAUSE_MAX_MS);
      }
    }

    var ad = document.querySelector('#gpt-passback2, #gpt-rect1');
    if (ad && inViewport(ad)) {
      try { ad.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      console.log('[HumanScroll] Pausing at ad:', ad.id);
      return AD_PAUSE_MS;
    }

    var heads = document.querySelectorAll('h1,h2,h3');
    for (var i = 0; i < heads.length; i++) {
      var el = heads[i];
      var r = el.getBoundingClientRect();
      if (r.top > 0 && r.top < (window.innerHeight * 0.35)) {
        if (Math.random() < 0.35) {
          return randInt(1500, 3000);
        }
        break;
      }
    }
    return 0;
  }

  // ===== GA4 / GTM scroll depth =====
  var firedPercents = new Set();
  var BREAKPOINTS = [25, 50, 75, 90, 100];

  function getPercentScrolled() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var view = window.innerHeight || document.documentElement.clientHeight || 0;
    var full = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    var pos = Math.min(full, y + view);
    var pct = Math.max(0, Math.min(100, Math.round((pos / full) * 100)));
    return pct;
  }

  function sendScrollDepth(percent) {
    if (firedPercents.has(percent)) return;
    firedPercents.add(percent);

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'scroll_depth', { percent: percent });
      console.log('[GA4] gtag scroll_depth:', percent);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: 'scroll_depth', percent: percent, page_location: location.href, page_title: document.title });
      console.log('[GTM] dataLayer scroll_depth:', percent);
    } else {
      console.log('[No GA] scroll_depth (not sent):', percent);
    }
  }

  function checkAndSendDepth() {
    var pct = getPercentScrolled();
    for (var i = 0; i < BREAKPOINTS.length; i++) {
      if (pct >= BREAKPOINTS[i]) sendScrollDepth(BREAKPOINTS[i]);
    }
  }

  window.addEventListener('scroll', function () {
    if (checkAndSendDepth._t) cancelAnimationFrame(checkAndSendDepth._t);
    checkAndSendDepth._t = requestAnimationFrame(checkAndSendDepth);
  }, { passive: true });

  // ===== Links =====
  function getAllCandidateLinks() {
    var links = Array.from(document.querySelectorAll('a[href]'));
    return links.filter(function (a) {
      var href = a.getAttribute('href') || '';
      if (!isGoodHref(href)) return false;
      if (SAME_HOST_ONLY && !sameHost(a.href)) return false;
      return true;
    });
  }

  function logAllLinks() {
    var raw = Array.from(document.querySelectorAll('a'));
    var mapped = raw.map(function (a, i) {
      return { index: i, text: (a.innerText || a.textContent || '').trim().slice(0, 120), href: a.href || a.getAttribute('href') || '' };
    });
    console.log('[HumanScroll] Found', mapped.length, 'links.');
    if (console.table) console.table(mapped);
    return mapped;
  }

  // ===== Enhanced Fake Cursor with Bezier Curve =====
  function createFakeCursor() {
    var cursor = document.createElement('div');
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
    cursor.style.transition = 'all 0.2s ease-out';
    document.body.appendChild(cursor);
    return cursor;
  }

  function moveCursorTo(cursor, x, y) {
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  }

  function removeCursor(cursor) {
    if (cursor && cursor.parentNode) cursor.parentNode.removeChild(cursor);
  }

  function bezierCurve(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }

  function cursorWander(cursor, steps, targetX, targetY, cb) {
    steps = Math.max(0, steps | 0);
    const startX = randInt(30, 200);
    const startY = randInt(30, 200);
    const control1 = { x: randInt(100, window.innerWidth - 100), y: randInt(100, window.innerHeight - 100) };
    const control2 = { x: randInt(100, window.innerWidth - 100), y: randInt(100, window.innerHeight - 100) };
    let i = 0;

    (function step() {
      if (i >= steps) {
        moveCursorTo(cursor, targetX, targetY);
        setTimeout(cb, FINAL_HOVER_MS);
        return;
      }
      const t = i / steps;
      const point = bezierCurve(t, { x: startX, y: startY }, control1, control2, { x: targetX, y: targetY });
      moveCursorTo(cursor, point.x, point.y);
      i++;
      setTimeout(step, WANDER_STEP_MS);
    })();
  }

  function clickWithCursorFlow(link) {
    var rect = link.getBoundingClientRect();
    var targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    var targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));

    var cursor = createFakeCursor();
    moveCursorTo(cursor, randInt(30, 200), randInt(30, 200));

    var wanderSteps = randInt(WANDER_STEPS_MIN, WANDER_STEPS_MAX);
    cursorWander(cursor, wanderSteps, targetX, targetY, function () {
      console.log('[HumanScroll] Clicking:', link.href);
      try { link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
      catch (e) { link.click(); }
      removeCursor(cursor);
    });
  }

  // ===== Forms (safe, with WordPress check and realistic delays) =====
  function isSafeForm(form) {
    var act = form.getAttribute('action') || '';
    try {
      if (act) { if (!sameHost(new URL(act, location.href).href)) return false; }
    } catch (e) { return false; }
    var text = (form.innerText || '').toLowerCase();
    if (text.includes('logout') || text.includes('delete') || text.includes('unsubscribe')) return false;
    if (form.querySelector('input[type="password"], input[name*="pass"], input[id*="pass"]')) return false;
    if (!findSubmitButton(form)) return false;
    if (form.classList.contains('wpcf7-form') || form.id.includes('contact-form')) {
      console.log('[HumanScroll] Prioritizing WordPress form.');
    }
    return true;
  }

  function getCandidateForms() {
    var forms = Array.from(document.querySelectorAll('form'));
    return forms.filter(function (f) { return isSafeForm(f); });
  }

  function findSubmitButton(form) {
    return form.querySelector('button[type="submit"], input[type="submit"], button:not([type]), input[type="button"][name="submit"], input[type="image"]');
  }

  function fillInput(el) {
    var name = (el.name || el.id || '').toLowerCase();
    var ph = (el.getAttribute('placeholder') || '').toLowerCase();

    if (el.type === 'email' || name.includes('email')) {
      el.value = 'user' + randInt(1000, 9999) + '@example.com';
    } else if (el.type === 'tel' || name.includes('phone')) {
      el.value = '+255' + randInt(600000000, 799999999);
    } else if (el.type === 'number') {
      el.value = randInt(1, 100);
    } else if (name.includes('name')) {
      el.value = 'John Doe';
    } else if (name.includes('city')) {
      el.value = 'Dar es Salaam';
    } else if (name.includes('country')) {
      el.value = 'Tanzania';
    } else if (el.type === 'url') {
      el.value = 'https://example.com';
    } else if (ph.includes('comment') || ph.includes('message') || ph.includes('feedback') || el.tagName === 'TEXTAREA') {
      el.value = 'Just checking this out. Looks good!';
    } else {
      el.value = (el.tagName === 'TEXTAREA') ? 'Hello!' : 'Sample';
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillFormFields(form) {
    var textFields = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"], textarea');
    textFields.forEach(function (el) {
      setTimeout(function () { fillInput(el); }, randInt(FORM_FIELD_DELAY_MIN_MS, FORM_FIELD_DELAY_MAX_MS));
    });
    var selects = form.querySelectorAll('select');
    selects.forEach(function (sel) {
      var opt = Array.from(sel.options).find(function (o) { return o.value && o.value.trim() !== ''; });
      if (opt) sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    var checks = form.querySelectorAll('input[type="checkbox"]');
    checks.forEach(function (c) { if (Math.random() < 0.35) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    var radiosByName = {};
    form.querySelectorAll('input[type="radio"]').forEach(function (r) {
      if (!radiosByName[r.name]) radiosByName[r.name] = [];
      radiosByName[r.name].push(r);
    });
    Object.keys(radiosByName).forEach(function (n) {
      var group = radiosByName[n];
      var pick = group[randInt(0, group.length - 1)];
      if (pick) { pick.checked = true; pick.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }

  function submitFormWithCursor(form) {
    var btn = findSubmitButton(form) || form;
    try { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    var rect = btn.getBoundingClientRect();
    var targetX = rect.left + Math.min(rect.width - 2, Math.max(2, rect.width * 0.6));
    var targetY = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height * 0.5));

    var cursor = createFakeCursor();
    moveCursorTo(cursor, randInt(30, 200), randInt(30, 200));
    var steps = randInt(WANDER_STEPS_MIN, WANDER_STEPS_MAX);

    cursorWander(cursor, steps, targetX, targetY, function () {
      console.log('[HumanScroll] Submitting form...');
      if (btn !== form) {
        try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
        catch (e) { btn.click(); }
      } else {
        form.requestSubmit ? form.requestSubmit() : form.submit();
      }
      removeCursor(cursor);
    });
  }

  function tryFormFlowOrFallbackToLink() {
    if (ENABLE_FORMS && Math.random() < FORM_SUBMIT_PROB) {
      var forms = getCandidateForms();
      if (forms.length) {
        var form = forms[randInt(0, forms.length - 1)];
        console.log('[HumanScroll] Chose FORM (15% path). Filling & submitting:', form);
        try { form.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        setTimeout(function () {
          fillFormFields(form);
          submitFormWithCursor(form);
        }, randInt(700, 1500));
        return;
      } else {
        console.log('[HumanScroll] No safe forms found. Falling back to link click.');
      }
    }
    var link = pickRandomLink();
    if (!link) { console.warn('[HumanScroll] No suitable link to click.'); return; }
    scrollToLinkThenClick(link);
  }

  // ===== Link click flow =====
  function pickRandomLink() {
    var links = getAllCandidateLinks();
    if (!links.length) return null;
    var idx = Math.floor(Math.random() * links.length);
    return links[idx];
  }

  function scrollToLinkThenClick(link) {
    try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { link.scrollIntoView(true); }
    setTimeout(function () { checkAndSendDepth(); }, 250);
    var wait = randInt(CLICK_AFTER_MIN_MS, CLICK_AFTER_MAX_MS);
    setTimeout(function () {
      if (!isDisplayed(link)) {
        console.warn('[HumanScroll] Picked link isn’t displayed. Repicking…');
        var alt = pickRandomLink();
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

  // ===== Bottom finish =====
  var finished = false;
  function finishIfBottomStable() {
    if (finished) return;
    if (!atBottom()) return;

    var initialHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );

    setTimeout(function () {
      if (atBottom()) {
        var newHeight = Math.max(
          document.body.scrollHeight, document.documentElement.scrollHeight,
          document.body.offsetHeight, document.documentElement.offsetHeight,
          document.body.clientHeight, document.documentElement.clientHeight
        );
        if (Math.abs(newHeight - initialHeight) < 4) {
          finished = true;
          checkAndSendDepth();
          console.log('[HumanScroll] Reached bottom. Logging links & deciding next action…');
          logAllLinks();
          tryFormFlowOrFallbackToLink();
        }
      }
    }, BOTTOM_CONFIRM_MS);
  }

  // ===== Human-like scrolling loop =====
  function humanScrollLoop() {
    if (finished) return;

    var pct = getPercentScrolled();

    if (pct >= randInt(EARLY_EXIT_DEPTH_MIN, EARLY_EXIT_DEPTH_MAX) && Math.random() < EARLY_EXIT_PROB) {
      console.log('[HumanScroll] Early exit at ' + pct + '% depth. Deciding next action…');
      finished = true;
      logAllLinks();
      tryFormFlowOrFallbackToLink();
      return;
    }

    if (atBottom()) { finishIfBottomStable(); return; }

    var goUp = Math.random() < UP_CHANCE;
    var deltaMultiplier = (pct < 50) ? 1.5 : 0.8;
    var delta = goUp ? -randInt(UP_MIN_PX, UP_MAX_PX) * deltaMultiplier : randInt(DOWN_MIN_PX, DOWN_MAX_PX) * deltaMultiplier;
    window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });

    if (Math.random() < 0.2) {
      setTimeout(function () { window.scrollBy({ top: 1, left: 0, behavior: 'smooth' }); }, 150);
    }

    checkAndSendDepth();

    var pause = randInt(PAUSE_MIN_MS, PAUSE_MAX_MS);
    var dwell = maybePauseAtHeadingAdOrImage();
    if (dwell) pause += dwell;
    if (Math.random() < 0.04) { pause += randInt(5000, 10000); }

    setTimeout(humanScrollLoop, pause);
  }

  // Kick off
  setTimeout(function () {
    checkAndSendDepth();
    humanScrollLoop();
  }, START_DELAY_MS);
})();
