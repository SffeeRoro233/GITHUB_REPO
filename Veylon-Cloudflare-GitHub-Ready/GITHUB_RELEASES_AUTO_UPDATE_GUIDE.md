# Veylon v2.9.0 — GitHub Releases & Cloudflare Pages Auto-Update Guide

## 1. Release Artifacts Built & Verified
- **`/home/user/Veylon-Setup.exe`** — Signed-manifest NSIS Windows x64 per-user installer (`Veylon v2.9.0`).
- **`/home/user/latest.yml`** — Electron/Veylon auto-update manifest containing exact `version`, `size`, and Base64 `SHA-512` hash.
- **`/home/user/Veylon-Cloudflare-GitHub-Ready.zip`** — Production website bundle ready for Cloudflare Pages (`veylon.fr`).

## 2. How to Publish a New Release on GitHub Releases (Automatic Desktop Updates)
1. Create a public GitHub repository (for example: `your-username/veylon-releases`) — this repo only needs to host Release assets (source code can remain private).
2. Click **Releases -> Draft a new release**:
   - **Tag version**: `v2.9.0` (must match `package.json` `version`)
   - **Release title**: `Veylon v2.9.0`
   - **Attach binaries**: Upload **BOTH** files to the same Release:
     1. `Veylon-Setup.exe`
     2. `latest.yml`
3. Click **Publish release**.

## 3. Environment Variables for Future Releases
- **Desktop Auto-Updater Feed (`build-windows-installer.sh`)**:
  ```bash
  VEYLON_GITHUB_REPO="your-username/veylon-releases" npm run build:windows
  ```
  - You can also enter `owner/repo` or a custom HTTPS feed URL directly inside **Veylon -> User Settings -> About & Updates**.
  - Even before GitHub Releases is configured, connected clients automatically check `<active-central-server>/api/releases/latest.yml` with full SHA-512 verification.
- **Transactional Email Delivery (`server/.env`)**:
  - **Option A — Resend API**:
    ```env
    RESEND_API_KEY=re_xxxxxxxxx
    EMAIL_FROM="Veylon <noreply@veylon.fr>"
    ```
  - **Option B — Standard SMTP**:
    ```env
    SMTP_HOST=smtp.resend.com
    SMTP_PORT=465
    SMTP_SECURE=true
    SMTP_USER=resend
    SMTP_PASS=re_xxxxxxxxx
    EMAIL_FROM="Veylon <noreply@veylon.fr>"
    ```
  - Verify your sending domain (`SPF` + `DKIM` DNS records) in your email provider dashboard so verification and password-reset emails land in primary inboxes rather than spam.

## 4. Rebuilding & Validating Releases Locally
```bash
npm run build:windows     # Compiles client + server + Veylon-Setup.exe + latest.yml
npm run release:prepare   # Recomputes SHA-512 & SHA-256 digests into latest.yml
npm run release:validate  # Strictly validates PE header, version parity & SHA-512 match
node ./scripts/verify-v29-upgrade.mjs  # Runs full 9-suite E2E verification
```
