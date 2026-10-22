# Veylon Official Website (`v2.8.5` · `veylon.fr`)

Official production static website & Cloudflare Pages Edge configuration for **Veylon** (`Windows 10/11 x64` & `Web App`), ready for zero-CLI browser upload to **GitHub** and automatic **HTTPS / TLS 1.3** deployment on **Cloudflare Pages** (`https://veylon.fr`).

## Project Structure (GitHub Repository Root)

```text
├── index.html                  # Main Veylon v2.8.5 website, OpenGraph & JSON-LD schema
├── 404.html                    # Custom 404 page (prevents SPA HTML catch-all on missing files)
├── css/
│   ├── tokens.css              # Design system tokens (colors, typography, borders, shadows)
│   ├── layout.css              # 4-pane interactive workspace, 12-col Bento grid & responsive rules
│   └── motion.css              # GPU-composited transitions & prefers-reduced-motion support
├── js/
│   └── main.js                 # Verified binary download resolver, SHA-512 copy & interactive demos
├── functions/
│   └── _middleware.js          # Cloudflare Pages Edge Function (www redirect, GitHub Release 302, anti-fake-exe guard)
├── favicon.svg                 # Vector V crest icon
├── og-cover.png                # 1200x630 OpenGraph / Discord / X social preview image
├── og-cover.svg                # Vector OpenGraph source
├── manifest.webmanifest        # Web App Manifest
├── site.config.json            # Release metadata & cryptographic digests
├── latest.yml                  # Official NSIS SHA-512 release manifest
├── robots.txt                  # Search crawler rules + Sitemap: https://veylon.fr/sitemap.xml
├── sitemap.xml                 # Canonical XML sitemap for https://veylon.fr/
└── _headers                    # Cloudflare Pages security & cache headers
```

## Official Installer Integrity (`Veylon-Setup.exe` `v2.8.5`)

- **File**: `Veylon-Setup.exe` (`Windows 10 / 11 x64`)
- **Exact Size**: `83,567,247` bytes (`79.70 MiB`)
- **SHA-512 (Base64)**: `3eugR03adAy7bhTiUtJvU4au6BqxElzaSwVplqk1AC2Z99zRvSnKciGOxlRBeoETgel5axBuBZrOEZz43aHypg==`
- **SHA-256 (Hex)**: `81986b466dc12485c860baf98964e14668e41eca3a818fd5a882bbe70164f00a`
