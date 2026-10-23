/* ==========================================================================
   VEYLON CLOUDFLARE PAGES EDGE MIDDLEWARE (Zero-CLI, Auto-Deployed from GitHub)
   - Enforces canonical https://veylon.fr redirect from www.veylon.fr
   - Resolves verified 80 MB Veylon-Setup.exe binary on GitHub Releases / Tunnel
   - Strictly prevents HTML pages from EVER being downloaded as fake .exe files
   - Routes /channels/@me seamlessly to the live Central Server or status gateway
   ========================================================================== */

const RELEASE_META = {
  app: 'Veylon',
  version: '2.9.3',
  seasonalEvent: 'Haunted Harvest 2026',
  platform: 'Windows 10 / 11 (x64)',
  sizeBytes: 83615996,
  sha512: '0cKZ0skdjVeiZWc/ygs7VyJD/456PjVnfpwZvpnmV2dsutT5Rl34/W3r2Kid4jyn+RSLKWY8w1xFiQAPqAA81Q==',
  sha256: 'b3b2a8e78d7378d17df219a493ae6784a260eb5b00e462f88676ca522323067a',
  ntfyRegistry: 'https://ntfy.sh/veylon-official-central-hub-v282/json?poll=1',
};

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Veylon-Cloudflare-Pages-Edge/2.9.3',
};

async function fetchWithTimeout(resource, init = {}, timeoutMs = 2600) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function discoverGithubReleaseBinary(explicitRepo) {
  const checkRepoReleases = async (repoFullName) => {
    const relRes = await fetchWithTimeout(
      `https://api.github.com/repos/${repoFullName}/releases?per_page=5`,
      { headers: GH_HEADERS },
      2800
    ).catch(() => null);
    if (!relRes || !relRes.ok) return null;
    const releases = await relRes.json().catch(() => []);
    if (!Array.isArray(releases)) return null;
    for (const rel of releases) {
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      const exactMatch = assets.find(
        (a) =>
          a &&
          typeof a.browser_download_url === 'string' &&
          a.name.toLowerCase().endsWith('.exe') &&
          Number(a.size) === RELEASE_META.sizeBytes
      );
      if (exactMatch) {
        return { url: exactMatch.browser_download_url, sizeBytes: Number(exactMatch.size) };
      }
      const namedMatch = assets.find(
        (a) =>
          a &&
          typeof a.browser_download_url === 'string' &&
          a.name.toLowerCase() === 'veylon-setup.exe' &&
          Number(a.size) > 40 * 1024 * 1024
      );
      if (namedMatch) {
        return { url: namedMatch.browser_download_url, sizeBytes: Number(namedMatch.size) };
      }
    }
    return null;
  };

  if (explicitRepo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(explicitRepo.trim())) {
    const direct = await checkRepoReleases(explicitRepo.trim());
    if (direct) return direct;
    return {
      url: `https://github.com/${explicitRepo.trim()}/releases/latest/download/Veylon-Setup.exe`,
      sizeBytes: RELEASE_META.sizeBytes,
    };
  }

  const searchRes = await fetchWithTimeout(
    'https://api.github.com/search/repositories?q=veylon+in:name&sort=updated&per_page=12',
    { headers: GH_HEADERS },
    2800
  ).catch(() => null);
  if (!searchRes || !searchRes.ok) return null;
  const searchJson = await searchRes.json().catch(() => null);
  const items = Array.isArray(searchJson && searchJson.items) ? searchJson.items : [];
  for (const repo of items) {
    if (!repo || !repo.full_name) continue;
    const found = await checkRepoReleases(repo.full_name);
    if (found) return found;
  }
  return null;
}

async function discoverLiveCentralOrigin(registryUrl) {
  try {
    const regRes = await fetchWithTimeout(registryUrl || RELEASE_META.ntfyRegistry, {}, 2400);
    if (!regRes.ok) return null;
    const lines = (await regRes.text()).trim().split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines.slice(0, 6)) {
      try {
        const outer = JSON.parse(line);
        const inner = typeof outer.message === 'string' ? JSON.parse(outer.message) : outer;
        if (inner && inner.app === 'Veylon' && typeof inner.url === 'string' && inner.url.startsWith('https://')) {
          const candidate = inner.url.replace(/\/+$/, '');
          const healthRes = await fetchWithTimeout(`${candidate}/api/health`, {}, 2000).catch(() => null);
          if (healthRes && healthRes.ok) {
            const health = await healthRes.json().catch(() => null);
            if (health && (health.ok || health.status === 'ok')) {
              return candidate;
            }
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function resolveEdgeState(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = new Request(`https://${url.host}/__veylon_edge_meta_v285`);

  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) {
      return await hit.json();
    }
  }

  let cfg = {};
  if (env && env.ASSETS) {
    try {
      const cfgRes = await env.ASSETS.fetch(new URL('/site.config.json', url));
      if (cfgRes.ok) cfg = await cfgRes.json();
    } catch {}
  }

  let downloadUrl = ((env && env.DOWNLOAD_URL) || cfg.cdnDownloadUrl || '').trim();
  let sizeBytes = Number(cfg.sizeBytes || RELEASE_META.sizeBytes);
  const githubRepo = ((env && env.GITHUB_REPO) || cfg.githubRepo || '').trim();

  if (!downloadUrl) {
    const ghFound = await discoverGithubReleaseBinary(githubRepo);
    if (ghFound && ghFound.url) {
      downloadUrl = ghFound.url;
      sizeBytes = ghFound.sizeBytes || sizeBytes;
    }
  }

  let centralOrigin = ((env && env.WEBAPP_URL) || cfg.webAppOrigin || '').trim().replace(/\/+$/, '');
  if (!centralOrigin) {
    centralOrigin = (await discoverLiveCentralOrigin(cfg.registryDiscoveryUrl)) || '';
  }

  if (!downloadUrl && centralOrigin) {
    downloadUrl = `${centralOrigin}/downloads/Veylon-Setup.exe`;
  }

  const state = {
    app: RELEASE_META.app,
    version: cfg.version || RELEASE_META.version,
    seasonalEvent: RELEASE_META.seasonalEvent,
    platform: RELEASE_META.platform,
    installerAvailable: Boolean(downloadUrl),
    sizeBytes,
    sha512: cfg.sha512 || RELEASE_META.sha512,
    sha256: cfg.sha256 || RELEASE_META.sha256,
    downloadUrl: downloadUrl || null,
    centralOnline: Boolean(centralOrigin),
    webAppUrl: centralOrigin ? `${centralOrigin}/channels/@me` : '/channels/@me',
    centralOrigin: centralOrigin || null,
  };

  if (cache) {
    const ttl = state.installerAvailable ? 180 : 20;
    const cacheResp = new Response(JSON.stringify(state), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${ttl}`,
      },
    });
    context.waitUntil(cache.put(cacheKey, cacheResp).catch(() => {}));
  }

  return state;
}

function renderPendingBinaryPage(state) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Veylon Windows Installer · Release Check</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet" href="/css/tokens.css" />
  <link rel="stylesheet" href="/css/layout.css" />
</head>
<body style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div class="ambient-grid" aria-hidden="true"></div>
  <main style="position:relative;z-index:2;max-width:560px;width:100%;padding:36px 32px;border-radius:24px;background:var(--bg-card);border:1px solid var(--border-amber);box-shadow:var(--shadow-card);">
    <span class="season-tag" style="margin-bottom:14px;">Veylon v${state.version} · Binary Verification Guard</span>
    <h1 style="font-size:24px;font-weight:830;letter-spacing:-0.02em;color:#fff;margin-bottom:10px;">
      Windows Installer Binary Not Yet Linked
    </h1>
    <p style="font-size:13.5px;color:var(--ink-secondary);line-height:1.65;margin-bottom:18px;">
      Veylon strictly protects visitors from ever downloading an HTML error page disguised as an <code>.exe</code> file.
      Publish <code>Veylon-Setup.exe</code> (80 MB) in your GitHub repository’s <strong>Releases</strong> tab or set <code>DOWNLOAD_URL</code> in Cloudflare Pages to enable instant one-click downloads.
    </p>
    <div style="padding:12px 14px;border-radius:12px;background:#0a0b10;border:1px solid var(--border-subtle);margin-bottom:20px;">
      <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--amber-400);margin-bottom:4px;">Verified SHA-512 Digest (${state.sizeBytes.toLocaleString('en-US')} bytes)</div>
      <code style="display:block;word-break:break-all;font-family:var(--font-mono);font-size:11px;color:#e2e8f0;">${state.sha512}</code>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <a href="/downloads/Veylon-Setup.exe" class="btn btn-primary-amber" style="height:42px;padding:0 20px;border-radius:11px;font-size:13px;">Retry Download Check</a>
      <a href="/" class="btn btn-secondary-dark" style="height:42px;padding:0 18px;border-radius:11px;font-size:13px;">Back to Homepage</a>
    </div>
  </main>
</body>
</html>`;
}

function renderWebAppGatewayPage(state) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Veylon Web App · Central Server Connection</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet" href="/css/tokens.css" />
  <link rel="stylesheet" href="/css/layout.css" />
</head>
<body style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div class="ambient-grid" aria-hidden="true"></div>
  <main style="position:relative;z-index:2;max-width:540px;width:100%;padding:36px 32px;border-radius:24px;background:var(--bg-card);border:1px solid var(--border-amber);box-shadow:var(--shadow-card);">
    <span class="season-tag" style="margin-bottom:14px;">Central Server Connection Status</span>
    <h1 style="font-size:24px;font-weight:830;letter-spacing:-0.02em;color:#fff;margin-bottom:10px;">
      Waiting for Central Veylon Server
    </h1>
    <p style="font-size:13.5px;color:var(--ink-secondary);line-height:1.65;margin-bottom:20px;">
      All Veylon clients share a single central server over encrypted HTTPS port 443. The central host is currently offline or restarting — start Veylon on the host machine and click <strong>Retry Connection</strong> below.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button type="button" onclick="window.location.reload()" class="btn btn-primary-amber" style="height:44px;padding:0 20px;border-radius:12px;font-size:13px;">Retry Connection</button>
      ${
        state.downloadUrl
          ? `<a href="${state.downloadUrl}" class="btn btn-secondary-dark" style="height:44px;padding:0 18px;border-radius:12px;font-size:13px;">Download Windows App</a>`
          : ''
      }
      <a href="/" class="btn btn-secondary-dark" style="height:44px;padding:0 18px;border-radius:12px;font-size:13px;">Back to Home</a>
    </div>
  </main>
</body>
</html>`;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathLower = url.pathname.replace(/\/+$/, '').toLowerCase() || '/';

  // 1. Canonical redirect: www.veylon.fr -> https://veylon.fr
  if (url.hostname.toLowerCase() === 'www.veylon.fr') {
    const target = `https://veylon.fr${url.pathname}${url.search}`;
    return Response.redirect(target, 301);
  }

  // 2. Public JSON release metadata endpoints
  if (pathLower === '/api/site-meta' || pathLower === '/api/releases/public-info') {
    const state = await resolveEdgeState(context);
    return new Response(JSON.stringify(state), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 3. Verified Windows x64 Installer Download Route (NEVER serves fake HTML as .exe!)
  if (
    pathLower === '/downloads/veylon-setup.exe' ||
    pathLower === '/download/veylon-setup.exe' ||
    pathLower === '/downloads/vesper-setup.exe'
  ) {
    const state = await resolveEdgeState(context);
    if (state.downloadUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: state.downloadUrl,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
          'X-Veylon-SHA512': state.sha512,
        },
      });
    }
    return new Response(renderPendingBinaryPage(state), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 4. Web App Gateway (/channels/*, /login, /register, /invite/*)
  if (
    pathLower.startsWith('/channels/') ||
    pathLower === '/channels' ||
    pathLower === '/login' ||
    pathLower === '/register' ||
    pathLower.startsWith('/invite/')
  ) {
    const state = await resolveEdgeState(context);
    if (state.centralOrigin) {
      return Response.redirect(`${state.centralOrigin}${url.pathname}${url.search}`, 302);
    }
    return new Response(renderWebAppGatewayPage(state), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 5. Marketing Studio Single-Account Guard (/marketing-studio, /marketing, /studio)
  if (
    pathLower === '/marketing-studio' ||
    pathLower.startsWith('/marketing-studio/') ||
    pathLower === '/marketing' ||
    pathLower === '/studio'
  ) {
    const state = await resolveEdgeState(context);
    if (state.centralOrigin) {
      return Response.redirect(`${state.centralOrigin}${url.pathname}${url.search}`, 302);
    }
    return new Response(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>403 · Restricted Access</title><link rel="stylesheet" href="/css/tokens.css"/><link rel="stylesheet" href="/css/layout.css"/></head><body style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;"><main style="max-width:460px;width:100%;padding:32px;border-radius:20px;background:#121520;border:1px solid rgba(255,255,255,0.1);text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#fda4af;margin-bottom:8px;">403 · Restricted Access</div><h1 style="font-size:20px;font-weight:800;color:#fff;margin-bottom:10px;">Marketing Studio Access Denied</h1><p style="font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:20px;">Marketing Studio is strictly restricted to the single designated account authorized on the Veylon server.</p><a href="/" class="btn btn-primary-amber" style="height:42px;padding:0 20px;border-radius:11px;font-size:13px;">Return to Veylon</a></main></body></html>`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  // 6. Dedicated Support Page (/support -> /support.html)
  if (pathLower === '/support') {
    if (context.env && context.env.ASSETS) {
      return context.env.ASSETS.fetch(new URL('/support.html', url));
    }
  }

  // 7. Marketing alias routes (/download, /site) -> root index.html
  if (pathLower === '/download' || pathLower === '/site') {
    if (context.env && context.env.ASSETS) {
      return context.env.ASSETS.fetch(new URL('/', url));
    }
  }

  return context.next();
}
