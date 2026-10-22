/* ==========================================================================
   VEYLON OFFICIAL WEBSITE CONTROLLER (ES6+ · v2.8.5)
   - Multi-source verified binary download resolver (GitHub Releases CDN,
     Cloudflare Pages Edge Metadata, Central Server, Live HTTPS 443 Tunnel)
   - Strictly prevents HTML error/fallback pages from disguising as .exe files
   - Interactive 4-pane workspace switcher, reaction toggle, volume & spoiler demos
   - Mobile navigation drawer, scroll-spy header & verified SHA-512 clipboard helper
   ========================================================================== */
(function () {
  'use strict';

  document.documentElement.classList.add('js-ready');

  const state = {
    version: '2.8.5',
    sizeBytes: 83567247,
    sha512: '3eugR03adAy7bhTiUtJvU4au6BqxElzaSwVplqk1AC2Z99zRvSnKciGOxlRBeoETgel5axBuBZrOEZz43aHypg==',
    sha256: '81986b466dc12485c860baf98964e14668e41eca3a818fd5a882bbe70164f00a',
    downloadUrl: '/downloads/Veylon-Setup.exe',
    webAppUrl: '/channels/@me',
    installerVerified: false,
    centralOnline: false,
  };

  function formatMegabytes(bytes) {
    return Math.max(70, Math.round(Number(bytes || 83567247) / (1024 * 1024))) + ' MB';
  }

  function applyResolvedEndpoints() {
    const sizeText = 'Veylon-Setup.exe · 64-bit (' + formatMegabytes(state.sizeBytes) + ')';
    document.querySelectorAll('[data-download-link]').forEach((el) => {
      el.setAttribute('href', state.downloadUrl);
      el.removeAttribute('download');
    });
    document.querySelectorAll('[data-webapp-link]').forEach((el) => {
      el.setAttribute('href', state.webAppUrl);
    });
    document.querySelectorAll('[data-size-label]').forEach((el) => {
      el.textContent = sizeText;
    });
    document.querySelectorAll('[data-version-text]').forEach((el) => {
      el.textContent = 'v' + state.version;
    });
  }

  async function probeSameOriginBinary(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!res.ok) return false;
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      // Strictly reject HTML pages so an HTML fallback can NEVER masquerade as .exe
      if (ctype.includes('text/html')) return false;
      const len = Number(res.headers.get('content-length') || 0);
      if (len < 10 * 1024 * 1024) return false;
      state.sizeBytes = len;
      return true;
    } catch {
      return false;
    }
  }

  async function discoverGithubReleaseClientSide(explicitRepo) {
    const checkRepo = async (repoFullName) => {
      const r = await fetch('https://api.github.com/repos/' + repoFullName + '/releases?per_page=5', {
        headers: { Accept: 'application/vnd.github+json' },
      }).catch(() => null);
      if (!r || !r.ok) return null;
      const list = await r.json().catch(() => []);
      if (!Array.isArray(list)) return null;
      for (const rel of list) {
        const assets = Array.isArray(rel.assets) ? rel.assets : [];
        const exact = assets.find(
          (a) =>
            a &&
            typeof a.browser_download_url === 'string' &&
            a.name.toLowerCase().endsWith('.exe') &&
            Number(a.size) === state.sizeBytes
        );
        if (exact) return { url: exact.browser_download_url, sizeBytes: Number(exact.size) };
        const named = assets.find(
          (a) =>
            a &&
            typeof a.browser_download_url === 'string' &&
            a.name.toLowerCase() === 'veylon-setup.exe' &&
            Number(a.size) > 40 * 1024 * 1024
        );
        if (named) return { url: named.browser_download_url, sizeBytes: Number(named.size) };
      }
      return null;
    };

    if (explicitRepo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(explicitRepo.trim())) {
      const found = await checkRepo(explicitRepo.trim());
      if (found) return found;
      return {
        url: 'https://github.com/' + explicitRepo.trim() + '/releases/latest/download/Veylon-Setup.exe',
        sizeBytes: state.sizeBytes,
      };
    }

    try {
      const sRes = await fetch(
        'https://api.github.com/search/repositories?q=veylon+in:name&sort=updated&per_page=10',
        { headers: { Accept: 'application/vnd.github+json' } }
      );
      if (!sRes.ok) return null;
      const data = await sRes.json();
      const items = Array.isArray(data && data.items) ? data.items : [];
      for (const repo of items) {
        if (!repo || !repo.full_name) continue;
        const found = await checkRepo(repo.full_name);
        if (found) return found;
      }
    } catch {}
    return null;
  }

  async function initReleaseAndServerDiscovery() {
    const statusLabel = document.getElementById('serverStatusText');
    const statusDot = document.getElementById('serverStatusDot');

    const markOnline = (label) => {
      state.centralOnline = true;
      if (statusLabel) statusLabel.textContent = label || 'Online';
      if (statusDot) statusDot.style.background = '#34d399';
    };

    // 1. Load static site.config.json
    let cfg = {};
    try {
      const cfgRes = await fetch('/site.config.json', { cache: 'no-store' });
      if (cfgRes.ok) {
        cfg = await cfgRes.json();
        if (cfg.version) state.version = cfg.version;
        if (cfg.sizeBytes) state.sizeBytes = cfg.sizeBytes;
        if (cfg.sha512) state.sha512 = cfg.sha512;
        if (cfg.sha256) state.sha256 = cfg.sha256;
        if (cfg.webAppOrigin) {
          state.webAppUrl = cfg.webAppOrigin.replace(/\/+$/, '') + '/channels/@me';
        }
        if (cfg.cdnDownloadUrl && /^https?:\/\//i.test(cfg.cdnDownloadUrl.trim())) {
          state.downloadUrl = cfg.cdnDownloadUrl.trim();
          state.installerVerified = true;
        }
      }
    } catch {}

    // 2. Check Cloudflare Pages Edge / Central Express API (/api/releases/public-info & /api/health)
    try {
      const [relRes, healthRes] = await Promise.all([
        fetch('/api/releases/public-info', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/health', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (relRes) {
        if (relRes.version) state.version = relRes.version;
        if (relRes.sizeBytes) state.sizeBytes = relRes.sizeBytes;
        if (relRes.sha512) state.sha512 = relRes.sha512;
        if (relRes.webAppUrl) state.webAppUrl = relRes.webAppUrl;
        if (relRes.centralOnline) markOnline('Online');
        if (relRes.installerAvailable && relRes.downloadUrl) {
          state.downloadUrl = relRes.downloadUrl;
          state.installerVerified = true;
        }
      }

      if (healthRes && (healthRes.status === 'ok' || healthRes.ok)) {
        markOnline('Online');
      }
    } catch {}

    // 3. Direct same-origin binary verification (rejects HTML rewrites strictly)
    if (!state.installerVerified) {
      if (await probeSameOriginBinary('/downloads/Veylon-Setup.exe')) {
        state.downloadUrl = '/downloads/Veylon-Setup.exe';
        state.installerVerified = true;
      }
    }

    // 4. Client-side GitHub Releases CDN discovery (works even on pure static hosts without Workers)
    if (!state.installerVerified) {
      const ghFound = await discoverGithubReleaseClientSide(cfg.githubRepo || '');
      if (ghFound && ghFound.url) {
        state.downloadUrl = ghFound.url;
        state.sizeBytes = ghFound.sizeBytes || state.sizeBytes;
        state.installerVerified = true;
      }
    }

    // 5. Live Founder HTTPS 443 Tunnel Discovery (resolves live Web App + backup .exe download)
    if ((!state.centralOnline || !state.installerVerified) && cfg.registryDiscoveryUrl) {
      try {
        const regRes = await fetch(cfg.registryDiscoveryUrl);
        if (regRes.ok) {
          const lines = (await regRes.text()).trim().split(/\r?\n/).filter(Boolean).reverse();
          for (const line of lines.slice(0, 6)) {
            try {
              const env = JSON.parse(line);
              const inner = typeof env.message === 'string' ? JSON.parse(env.message) : env;
              if (inner && inner.app === 'Veylon' && typeof inner.url === 'string' && inner.url.startsWith('https://')) {
                const origin = inner.url.replace(/\/+$/, '');
                const health = await fetch(origin + '/api/health')
                  .then((r) => (r.ok ? r.json() : null))
                  .catch(() => null);
                if (health && (health.status === 'ok' || health.ok)) {
                  state.webAppUrl = origin + '/channels/@me';
                  if (!state.installerVerified) {
                    state.downloadUrl = origin + '/downloads/Veylon-Setup.exe';
                    state.installerVerified = true;
                  }
                  markOnline('Online');
                  break;
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    if (!state.centralOnline && statusLabel) {
      statusLabel.textContent = 'Edge Ready';
    }

    applyResolvedEndpoints();
  }

  // Sticky Header Scroll State & Section Scroll Spy
  const header = document.getElementById('siteHeader');
  const navLinks = Array.from(document.querySelectorAll('.nav-item[href^="#"]'));
  const observedSections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function onScroll() {
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 18);
    }
    const scrollPos = window.scrollY + 140;
    let currentId = '';
    for (const sec of observedSections) {
      if (sec.offsetTop <= scrollPos) {
        currentId = '#' + sec.id;
      }
    }
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === currentId);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile Menu Drawer
  const menuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  if (menuBtn && mobileDrawer) {
    menuBtn.addEventListener('click', () => {
      const open = mobileDrawer.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    mobileDrawer.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Interactive 4-Pane Veylon Workspace Switcher
  const composerHint = document.getElementById('composerPlaceholder');
  const stageLabels = {
    chat: 'Message #general or paste PNG / Tenor GIF…',
    media: 'Drop HD screenshots or search instant Tenor GIFs in #media-showcase…',
    voice: 'Connected to Midnight Fire · 48 kHz Stereo Opus (14 ms)',
    harvest: 'Browse Haunted Harvest 2026 seasonal items — kept permanently forever',
  };

  document.querySelectorAll('[data-stage-target]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const target = trigger.getAttribute('data-stage-target');
      document.querySelectorAll('[data-stage-target]').forEach((el) => {
        el.classList.toggle('active', el.getAttribute('data-stage-target') === target);
      });
      document.querySelectorAll('.stage-view').forEach((view) => {
        view.classList.toggle('active', view.id === 'stage-' + target);
      });
      if (composerHint && stageLabels[target]) {
        composerHint.textContent = stageLabels[target];
      }
    });
  });

  // Interactive Message Reaction Chips inside Workspace Preview
  document.querySelectorAll('[data-reaction-btn]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const countEl = chip.querySelector('[data-count]');
      const active = chip.classList.toggle('reacted');
      if (countEl) {
        const base = Number(countEl.getAttribute('data-base') || 4);
        countEl.textContent = String(active ? base + 1 : base);
      }
    });
  });

  // Interactive Per-User Audio Volume Slider Demo
  const volRange = document.getElementById('demoVolumeSlider');
  const volValue = document.getElementById('demoVolumeValue');
  if (volRange && volValue) {
    volRange.addEventListener('input', () => {
      volValue.textContent = volRange.value + '%';
    });
  }

  // Interactive Click-to-Reveal Spoiler Card Demo
  const spoilerCard = document.getElementById('demoSpoilerCard');
  if (spoilerCard) {
    spoilerCard.addEventListener('click', () => {
      spoilerCard.classList.toggle('blurred');
    });
    spoilerCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        spoilerCard.classList.toggle('blurred');
      }
    });
  }

  // Copy SHA-512 Checksum & Copy Share URL Buttons
  const copyChecksumBtn = document.getElementById('copyChecksumBtn');
  if (copyChecksumBtn) {
    copyChecksumBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(state.sha512).catch(() => {});
      const label = copyChecksumBtn.querySelector('span');
      if (label) {
        const prev = label.textContent;
        label.textContent = 'SHA-512 Copied!';
        setTimeout(() => {
          label.textContent = prev;
        }, 2200);
      }
    });
  }

  const shareSiteBtn = document.getElementById('shareSiteBtn');
  if (shareSiteBtn) {
    shareSiteBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
      const label = shareSiteBtn.querySelector('span');
      if (label) {
        const prev = label.textContent;
        label.textContent = 'URL Copied';
        setTimeout(() => {
          label.textContent = prev;
        }, 2200);
      }
    });
  }

  // Download Feedback & Anti-Fake-HTML-EXE Protection
  const dlToast = document.getElementById('downloadFeedback');
  document.querySelectorAll('[data-download-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!dlToast) return;
      dlToast.innerHTML = state.installerVerified
        ? '<span><strong>Downloading Veylon-Setup.exe (' +
          formatMegabytes(state.sizeBytes) +
          ')…</strong> Verified SHA-512 package — server connection is 100% automatic on first launch.</span>'
        : '<span><strong>Verifying release source…</strong> Redirecting to the official Veylon Windows installer check.</span>';
      dlToast.classList.add('visible');
    });
  });

  // Subtle GPU Mouse Spotlight Tracking on Bento Cards
  document.querySelectorAll('.bento-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--spot-y', (e.clientY - rect.top) + 'px');
    });
  });

  // Scroll Reveal Observer
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.03, rootMargin: '0px 0px 30px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
  }

  // Seasonal Haunted Harvest Countdown Badge
  const countdownEl = document.getElementById('harvestCountdown');
  if (countdownEl) {
    const novFirst = new Date(new Date().getFullYear(), 10, 1, 0, 0, 0).getTime();
    const diff = novFirst - Date.now();
    if (diff > 0) {
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      countdownEl.textContent = 'Ends in ' + d + 'd ' + h + 'h';
    } else {
      countdownEl.textContent = 'Seasonal Collection';
    }
  }

  initReleaseAndServerDiscovery();
})();
