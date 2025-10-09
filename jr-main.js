// ==UserScript==
// @name         Enhanced Human Multi-Page GA4 Simulator
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Advanced anti-detection with fingerprint randomization, WebDriver concealment, and natural behavior
// @match        *://jrsports.click/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;

    // ===== Anti-Detection: WebDriver Concealment =====
    (function concealAutomation() {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Fix Chrome automation artifacts
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        
        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Conceal plugin array
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
            ]
        });

        // Conceal languages with realistic variance
        const languages = [
            ['en-US', 'en'],
            ['en-GB', 'en'],
            ['en-US', 'en', 'es'],
            ['en-US', 'en', 'fr']
        ];
        const selectedLangs = languages[Math.floor(Math.random() * languages.length)];
        Object.defineProperty(navigator, 'languages', { get: () => selectedLangs });

        // Add realistic connection info
        Object.defineProperty(navigator, 'connection', {
            get: () => ({
                effectiveType: ['4g', '4g', '3g'][Math.floor(Math.random() * 3)],
                rtt: Math.floor(Math.random() * 100) + 50,
                downlink: Math.random() * 5 + 5,
                saveData: false
            })
        });

        // Canvas fingerprint noise injection
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' && Math.random() < 0.1) {
                const ctx = this.getContext('2d');
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    if (Math.random() < 0.001) {
                        imageData.data[i] = imageData.data[i] ^ 1;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
        };

        // WebGL fingerprint noise
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
                return 'Intel Inc.';
            }
            if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
                const renderers = [
                    'Intel Iris OpenGL Engine',
                    'Intel HD Graphics 630',
                    'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)'
                ];
                return renderers[Math.floor(Math.random() * renderers.length)];
            }
            return getParameter.apply(this, arguments);
        };

        // Audio fingerprint protection
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const originalCreateOscillator = AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator = function() {
                const oscillator = originalCreateOscillator.apply(this, arguments);
                const originalStart = oscillator.start;
                oscillator.start = function(when) {
                    const noise = Math.random() * 0.0001;
                    return originalStart.call(this, when ? when + noise : noise);
                };
                return oscillator;
            };
        }

        // Screen resolution variance (add 1-2px noise)
        const originalScreen = {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight
        };
        const noise = Math.random() < 0.5 ? 1 : 2;
        Object.defineProperty(screen, 'width', { get: () => originalScreen.width + noise });
        Object.defineProperty(screen, 'height', { get: () => originalScreen.height + noise });

        if (DEBUG) console.log('[Anti-Detection] All concealment applied');
    })();

    // ===== Human Random Functions with Improved Distribution =====
    function humanRandom() {
        const uniform = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
        const gaussian1 = Math.random();
        const gaussian2 = Math.random();
        const gaussian = Math.sqrt(-2 * Math.log(gaussian1)) * Math.cos(2 * Math.PI * gaussian2);
        return Math.max(0, Math.min(1, (uniform * 0.6) + ((gaussian + 3) / 6 * 0.4)));
    }
    const randInt = (min, max) => Math.floor(humanRandom() * (max - min + 1)) + min;
    const randFloat = (min, max) => humanRandom() * (max - min) + min;

    // ===== Enhanced Session Profiles with More Variance =====
    const SESSION_PROFILES = {
        rushed: { 
            speedMult: randFloat(1.4, 1.7), 
            pauseMult: randFloat(0.5, 0.7), 
            scrollMult: randFloat(1.3, 1.6), 
            errorRate: 0.15, 
            engagementRate: 0.3, 
            gaTrackingRate: 0.7,
            mouseWanderFreq: 0.4 
        },
        normal: { 
            speedMult: randFloat(0.9, 1.1), 
            pauseMult: randFloat(0.9, 1.1), 
            scrollMult: randFloat(0.9, 1.1), 
            errorRate: 0.08, 
            engagementRate: 0.6, 
            gaTrackingRate: 0.85,
            mouseWanderFreq: 0.65 
        },
        careful: { 
            speedMult: randFloat(0.6, 0.8), 
            pauseMult: randFloat(1.6, 2.0), 
            scrollMult: randFloat(0.6, 0.8), 
            errorRate: 0.03, 
            engagementRate: 0.85, 
            gaTrackingRate: 0.95,
            mouseWanderFreq: 0.85 
        },
        distracted: { 
            speedMult: randFloat(0.4, 0.6), 
            pauseMult: randFloat(2.3, 2.8), 
            scrollMult: randFloat(0.7, 0.9), 
            errorRate: 0.20, 
            engagementRate: 0.4, 
            gaTrackingRate: 0.75,
            mouseWanderFreq: 0.3 
        }
    };
    const profileKeys = Object.keys(SESSION_PROFILES);
    const currentProfile = SESSION_PROFILES[profileKeys[randInt(0, profileKeys.length - 1)]];
    if (DEBUG) console.log('[Profile]', Object.keys(SESSION_PROFILES)[profileKeys.indexOf(currentProfile)]);

    // ===== Robust Storage with Memory Fallback =====
    const storage = {
        cache: {},
        get(key) { 
            try { 
                return sessionStorage.getItem(key) || this.cache[key]; 
            } catch { 
                return this.cache[key]; 
            } 
        },
        set(key, value) { 
            try { 
                sessionStorage.setItem(key, value); 
            } catch { 
                this.cache[key] = value; 
            } 
        },
        remove(key) { 
            try { 
                sessionStorage.removeItem(key); 
            } catch { 
                delete this.cache[key]; 
            } 
        }
    };

    // ===== GA4 Event Handling with Realistic Variance =====
    const gaSession = {
        sessionId: storage.get('ga_session_id') || `${Date.now()}_${randInt(100000, 999999)}`,
        sessionStart: Date.now(),
        engagedTime: 0,
        lastEngagementUpdate: Date.now(),
        isEngaged: false,
        scrollDepthsFired: new Set(),
        eventCount: 0,
        clickCount: 0
    };
    storage.set('ga_session_id', gaSession.sessionId);

    function sendGA4Event(eventName, params = {}) {
        if (humanRandom() > currentProfile.gaTrackingRate) return;
        gaSession.eventCount++;
        
        const baseParams = {
            page_location: location.href,
            page_title: document.title,
            page_referrer: document.referrer || '(direct)',
            engagement_time_msec: gaSession.engagedTime,
            session_id: gaSession.sessionId,
            event_count: gaSession.eventCount,
            timestamp: Date.now(),
            client_id: storage.get('ga_client_id') || `${Date.now()}.${randInt(1000000000, 9999999999)}`
        };
        
        storage.set('ga_client_id', baseParams.client_id);
        const fullParams = { ...baseParams, ...params };
        
        if (typeof window.gtag === 'function') {
            try { 
                window.gtag('event', eventName, fullParams); 
                if (DEBUG) console.log('[GA4]', eventName, fullParams); 
            } catch (e) {
                if (DEBUG) console.warn('[GA4] Error:', e.message);
            }
        } else if (Array.isArray(window.dataLayer)) {
            try { 
                window.dataLayer.push({ event: eventName, ...fullParams }); 
                if (DEBUG) console.log('[GTM]', eventName); 
            } catch (e) {
                if (DEBUG) console.warn('[GTM] Error:', e.message);
            }
        }
    }

    // Session start with realistic delay
    if (!storage.get('ga_session_started')) {
        storage.set('ga_session_started', 'true');
        setTimeout(() => {
            sendGA4Event('session_start', { 
                session_engaged: '1',
                page_view: '1'
            });
        }, randInt(1000, 3000));
    }

    // More realistic engagement time tracking with variance
    setInterval(() => {
        if (!document.hidden) {
            const now = Date.now();
            const elapsed = now - gaSession.lastEngagementUpdate;
            const variance = randInt(-100, 100);
            gaSession.engagedTime += elapsed + variance;
            gaSession.lastEngagementUpdate = now;
            
            if (!gaSession.isEngaged && gaSession.engagedTime >= 10000) {
                gaSession.isEngaged = true;
                sendGA4Event('user_engagement', { 
                    engagement_time_msec: gaSession.engagedTime 
                });
            }
        }
    }, 1000);

    // ===== Enhanced Scroll Depth Tracking =====
    const SCROLL_BREAKPOINTS = [25, 50, 75, 90, 100];
    let lastScrollTime = Date.now();
    let scrollVelocity = 0;

    function sendScrollDepth(percent) {
        if (gaSession.scrollDepthsFired.has(percent)) return;
        if (humanRandom() < 0.12) return;
        
        const variance = randInt(-3, 3);
        const actualPercent = Math.max(0, Math.min(100, percent + variance));
        gaSession.scrollDepthsFired.add(percent);
        
        sendGA4Event('scroll', { 
            percent_scrolled: actualPercent, 
            engagement_time_msec: gaSession.engagedTime,
            scroll_velocity: Math.round(scrollVelocity)
        });
    }

    function checkAndSendDepth() {
        const now = Date.now();
        const timeDelta = (now - lastScrollTime) / 1000;
        lastScrollTime = now;

        const y = window.pageYOffset || document.documentElement.scrollTop || 0;
        const view = window.innerHeight || document.documentElement.clientHeight || 0;
        const full = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const pos = Math.min(full, y + view);
        const pct = Math.max(0, Math.min(100, Math.round((pos / full) * 100)));
        
        scrollVelocity = (y - (scrollVelocity || y)) / timeDelta;
        
        SCROLL_BREAKPOINTS.forEach(bp => { if (pct >= bp) sendScrollDepth(bp); });
    }

    let scrollDebounce;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => requestAnimationFrame(checkAndSendDepth), 100);
    }, { passive: true });

    // ===== Utilities =====
    function atBottom(t = 10) { 
        const y = window.pageYOffset || document.documentElement.scrollTop || 0; 
        const view = window.innerHeight || 0; 
        const doc = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight); 
        return y + view >= doc - t; 
    }

    function isGoodHref(href) { 
        if (!href) return false; 
        const s = href.trim().toLowerCase(); 
        return !s.startsWith('#') && 
               !s.startsWith('javascript:') && 
               !s.startsWith('mailto:') && 
               !s.startsWith('tel:') &&
               !s.endsWith('.pdf') &&
               !s.endsWith('.zip') &&
               !s.endsWith('.exe');
    }

    function sameHost(url) { 
        try { 
            const urlObj = new URL(url, location.href);
            return urlObj.host === location.host; 
        } catch { 
            return false; 
        } 
    }

    function inViewport(el) { 
        try { 
            const r = el.getBoundingClientRect(); 
            return r.bottom > 0 && 
                   r.right > 0 && 
                   r.left < window.innerWidth && 
                   r.top < window.innerHeight; 
        } catch { 
            return false; 
        } 
    }

    // ===== Enhanced Mouse Simulation with Perlin-like Noise =====
    let lastMouseX = randInt(100, Math.max(200, window.innerWidth - 100));
    let lastMouseY = randInt(100, Math.max(200, window.innerHeight - 100));
    let isMouseMoving = false;
    let mouseIdleTimeout;

    function cubicBezier(t, p0, p1, p2, p3) { 
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t; 
        return uuu * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + ttt * p3; 
    }

    async function moveMouseTo(targetX, targetY, duration = null) {
        if (isMouseMoving) return;
        isMouseMoving = true;
        
        const startX = lastMouseX;
        const startY = lastMouseY;
        const distX = targetX - startX;
        const distY = targetY - startY;
        const distance = Math.sqrt(distX ** 2 + distY ** 2);
        
        if (!duration) {
            duration = Math.max(200, Math.min(1500, distance * 0.8 + randInt(-100, 100))) * currentProfile.speedMult;
        }
        
        const steps = Math.max(10, Math.floor(duration / 16));
        
        // More human-like control points with overshoot potential
        const overshoot = humanRandom() < 0.3 ? randInt(-30, 30) : 0;
        const cp1x = startX + distX * 0.25 + randInt(-50, 50);
        const cp1y = startY + distY * 0.25 + randInt(-50, 50);
        const cp2x = startX + distX * 0.75 + randInt(-50, 50) + overshoot;
        const cp2y = startY + distY * 0.75 + randInt(-50, 50) + overshoot;
        
        const startTime = performance.now();
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            
            // More natural easing with micro-pauses
            let eased;
            if (humanRandom() < 0.05) {
                eased = i > 0 ? (i - 1) / steps : 0; // Micro-pause
            } else {
                eased = progress < 0.5 ? 
                    2 * progress * progress : 
                    1 - Math.pow(-2 * progress + 2, 2) / 2;
            }
            
            const x = Math.round(cubicBezier(eased, startX, cp1x, cp2x, targetX));
            const y = Math.round(cubicBezier(eased, startY, cp1y, cp2y, targetY));
            
            // Add tremor (human hand shake)
            const tremorX = Math.sin(Date.now() / 100) * randFloat(0, 0.5);
            const tremorY = Math.cos(Date.now() / 100) * randFloat(0, 0.5);
            
            const jitterX = x + randInt(-1, 1) + tremorX;
            const jitterY = y + randInt(-1, 1) + tremorY;
            const prevX = lastMouseX;
            const prevY = lastMouseY;
            
            lastMouseX = jitterX; 
            lastMouseY = jitterY;
            
            try { 
                const el = document.elementFromPoint(jitterX, jitterY) || document;
                el.dispatchEvent(new MouseEvent('mousemove', { 
                    bubbles: true, 
                    cancelable: true, 
                    view: window, 
                    clientX: jitterX, 
                    clientY: jitterY, 
                    screenX: jitterX + window.screenX, 
                    screenY: jitterY + window.screenY, 
                    movementX: jitterX - prevX, 
                    movementY: jitterY - prevY 
                })); 
            } catch { }
            
            const elapsed = performance.now() - startTime;
            const targetTime = (duration * (i + 1) / steps);
            const delay = Math.max(0, targetTime - elapsed);
            
            if (delay > 0) await new Promise(r => setTimeout(r, delay));
        }
        
        isMouseMoving = false;
    }

    async function randomMouseWander() { 
        const iterations = randInt(3, 8);
        for (let i = 0; i < iterations; i++) { 
            await moveMouseTo(
                randInt(50, window.innerWidth - 50), 
                randInt(50, window.innerHeight - 50)
            ); 
            await new Promise(r => setTimeout(r, randInt(200, 600))); 
        } 
    }

    // Idle mouse movement (humans don't keep mouse perfectly still)
    function scheduleIdleMovement() {
        clearTimeout(mouseIdleTimeout);
        mouseIdleTimeout = setTimeout(async () => {
            if (!isMouseMoving && humanRandom() < 0.3) {
                await moveMouseTo(
                    lastMouseX + randInt(-20, 20),
                    lastMouseY + randInt(-20, 20),
                    randInt(500, 1000)
                );
            }
            scheduleIdleMovement();
        }, randInt(5000, 15000));
    }
    scheduleIdleMovement();

    // ===== Enhanced Clicking with GA4 Events =====
    async function clickElement(element) {
        if (!element) return false;
        
        try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, randInt(400, 800) * currentProfile.pauseMult));
            
            const rect = element.getBoundingClientRect();
            const clickX = Math.round(rect.left + rect.width * randFloat(0.3, 0.7));
            const clickY = Math.round(rect.top + rect.height * randFloat(0.3, 0.7));
            
            // Simulate occasional mis-clicks
            if (humanRandom() < currentProfile.errorRate) { 
                await moveMouseTo(clickX + randInt(-40, 40), clickY + randInt(-40, 40)); 
                await new Promise(r => setTimeout(r, randInt(200, 600))); 
            }
            
            await moveMouseTo(clickX, clickY);
            
            const evtProps = { 
                bubbles: true, 
                cancelable: true, 
                view: window, 
                clientX: clickX, 
                clientY: clickY, 
                screenX: clickX + window.screenX, 
                screenY: clickY + window.screenY, 
                button: 0 
            };
            
            element.dispatchEvent(new MouseEvent('mousedown', evtProps)); 
            await new Promise(r => setTimeout(r, randInt(50, 150)));
            element.dispatchEvent(new MouseEvent('mouseup', evtProps));
            element.dispatchEvent(new MouseEvent('click', evtProps));
            
            // Track click in GA4
            gaSession.clickCount++;
            sendGA4Event('click', {
                link_url: element.href || element.getAttribute('data-href') || '',
                link_text: (element.innerText || element.textContent || '').slice(0, 100),
                click_count: gaSession.clickCount,
                engagement_time_msec: gaSession.engagedTime
            });
            
            return true;
        } catch (e) { 
            try { 
                element.click(); 
                return true; 
            } catch { 
                return false; 
            } 
        }
    }

    // ===== Smart Link Selection =====
    function getAllCandidateLinks() {
        let links = Array.from(document.querySelectorAll('a[href]'))
            .filter(a => isGoodHref(a.href) && sameHost(a.href));
        
        // Prioritize visible, content-rich links
        links = links.map(link => {
            const text = (link.innerText || '').trim();
            const isVisible = inViewport(link);
            const hasGoodText = text.length > 3 && text.length < 100;
            const score = (isVisible ? 2 : 0) + (hasGoodText ? 1 : 0);
            return { link, score };
        }).filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(item => item.link);
        
        return links;
    }

    // ===== Scroll Manager with Realistic Patterns =====
    class ScrollManager {
        constructor() { 
            this.consecutiveDownScrolls = 0;
            this.lastScrollDirection = 'down';
            this.pauseCount = 0;
        }
        
        getNextScrollAction() {
            // Occasionally scroll up to re-read
            if (humanRandom() < 0.15 && this.consecutiveDownScrolls > 3) {
                this.consecutiveDownScrolls = 0;
                this.lastScrollDirection = 'up';
                return { 
                    type: 'up', 
                    delta: randInt(-200, -100) * currentProfile.scrollMult 
                };
            }
            
            // Sometimes pause (simulate reading)
            if (humanRandom() < 0.25) {
                this.pauseCount++;
                return { type: 'pause', delta: 0 };
            }
            
            // Variable scroll distances
            const baseScroll = randInt(120, 600);
            const delta = baseScroll * currentProfile.scrollMult * (1 + humanRandom() * 0.3);
            
            this.consecutiveDownScrolls++;
            this.lastScrollDirection = 'down';
            return { type: 'down', delta };
        }
        
        async executeScrollAction(action) { 
            if (action.type === 'pause') {
                await new Promise(r => setTimeout(r, randInt(1000, 3000)));
                return;
            }
            
            try { 
                window.scrollBy({ 
                    top: action.delta, 
                    left: 0, 
                    behavior: 'smooth' 
                }); 
            } catch { 
                window.scrollBy(0, action.delta); 
            } 
        }
    }
    const scrollManager = new ScrollManager();

    // ===== Multi-Page Scroll Loop with Better Flow Control =====
    let loopRunning = true;
    let loopIterations = 0;
    const MAX_ITERATIONS = 200; // Prevent infinite loops

    async function humanScrollLoop() {
        if (!loopRunning || loopIterations++ > MAX_ITERATIONS) {
            if (DEBUG) console.log('[Loop] Stopped', { iterations: loopIterations });
            return;
        }

        try {
            if (atBottom()) {
                const links = getAllCandidateLinks();
                if (links.length > 0 && humanRandom() < 0.7) {
                    const link = links[randInt(0, Math.min(links.length - 1, 4))]; // Top 5 links
                    if (DEBUG) console.log('[Navigation] Next:', link.href);
                    
                    await clickElement(link);
                    
                    // Natural delay before navigation
                    await new Promise(r => setTimeout(r, randInt(500, 1500)));
                    
                    sendGA4Event('page_view', {
                        page_location: link.href,
                        page_referrer: location.href
                    });
                    
                    location.href = link.href;
                    return;
                }
            }

            if (humanRandom() < currentProfile.mouseWanderFreq) {
                await randomMouseWander();
            }
            
            const action = scrollManager.getNextScrollAction();
            await scrollManager.executeScrollAction(action);
            
            setTimeout(humanScrollLoop, randInt(800, 3500) * currentProfile.pauseMult);
            
        } catch (e) {
            if (DEBUG) console.error('[Loop] Error:', e);
            setTimeout(humanScrollLoop, 5000);
        }
    }

    // ===== Visibility Change Handling =====
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            gaSession.lastEngagementUpdate = Date.now();
            if (DEBUG) console.log('[Visibility] Tab hidden');
        } else {
            const now = Date.now();
            gaSession.lastEngagementUpdate = now;
            if (DEBUG) console.log('[Visibility] Tab visible');
        }
    });

    // ===== Cleanup on Unload =====
    window.addEventListener('beforeunload', () => {
        sendGA4Event('page_unload', {
            engagement_time_msec: gaSession.engagedTime,
            scroll_depth_max: Math.max(...Array.from(gaSession.scrollDepthsFired)),
            click_count: gaSession.clickCount
        });
        loopRunning = false;
    });

    // ===== Start Session with Realistic Initialization =====
    (async function start() {
        // Wait for page to be interactive
        if (document.readyState === 'loading') {
            await new Promise(r => document.addEventListener('DOMContentLoaded', r));
        }
        
        // Initial human-like delay
        await new Promise(r => setTimeout(r, randInt(2000, 6000)));
        
        // Send page_view event
        sendGA4Event('page_view', {
            page_location: location.href,
            page_referrer: document.referrer || '(direct)'
        });
        
        // Initial mouse movement
        await randomMouseWander();
        
        // Start main loop
        humanScrollLoop();
        
        if (DEBUG) console.log('[Session] Started', currentProfile);
    })();

})();
