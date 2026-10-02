# Deploying Team 71 Game Manager

Target: the existing Cloudflare Worker **`team71`** at
https://team71.vjdifd.workers.dev/

---

## The one thing that usually goes wrong

**The files must sit at the top level of the GitHub repository.** Not inside a
folder named after the zip.

Correct:

```
your-repo/
├── .gitignore
├── DEPLOY.md
├── README.md
├── V22_FIXES.md
├── V23_ROTATION.md
├── V24_SIDELINE.md
├── V25_PRINT.md
├── V26_ROSTER.md
├── V27_TOUCH.md
├── V28_LINEUP.md
├── V29_SHEET.md
├── V30_BENCH.md
├── V31_CLEAN.md
├── V32_SCHEDULE.md
├── V33_PRINTFIX.md
├── V34_PRINTLAYOUT.md
├── V35_FIELDHUD.md
├── V36_FIELDBAR.md
├── V37_PRINTDARK.md
├── package.json
├── package-lock.json
├── wrangler.json
├── docs/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   └── worker.js
└── test/
```

Wrong — and this is the silent failure mode:

```
your-repo/
└── Team71_GitHub_Ready_v22/       <-- nothing works from in here
    ├── wrangler.json
    ├── public/
    └── src/
```

If `wrangler.json` is one level down, Wrangler cannot find `main: src/worker.js`
or the `./public` assets directory. The build fails, Cloudflare keeps serving the
**last successful deployment**, and the site looks unchanged with no obvious
error. That is exactly how v19 stayed live while v20 and v21 sat in the repo.

So: extract the zip, then drag **the contents** into GitHub — `public`, `src`,
`test`, `docs`, and the loose files — never the enclosing folder.

---

## Option A — upload through the GitHub website

1. Open your repository (or create one: **New repository**, no README, no
   `.gitignore`, no license).
2. **Add file → Upload files**.
3. Extract the zip on your computer.
4. Select everything *inside* the extracted folder and drag it in. Folders are
   preserved, so `public/index.html` lands in the right place.
5. Commit to `main`.
6. Confirm on the repo's front page that you can see `wrangler.json` and
   `package.json` listed directly, with no extra folder above them.

## Option B — command line

```bash
cd path/to/extracted
git init
git add .
git commit -m "v22 stable"
git branch -M main
git remote add origin https://github.com/<you>/team71-game-manager.git
git push -u origin main
```

---

## Connect Cloudflare to the repository

Cloudflare dashboard → **Workers & Pages → team71 → Settings → Builds**:

| Setting | Value |
| --- | --- |
| Repository | your `team71-game-manager` repo |
| Production branch | `main` |
| Root directory | *leave blank* |
| Build command | *leave blank* |
| Deploy command | `npx wrangler deploy` |

The Worker name in `wrangler.json` is already `team71`, which must match the
existing Worker, and the D1 binding is already declared:

```
binding:       DB
database_name: team71-game-state
database_id:   d2545cc6-6d5f-4ac3-b75b-a38ddac63d89
```

---

## Verify the deploy actually landed

This is the step that was missing last time. Do all three.

1. **Check the build.** Workers & Pages → team71 → **Deployments**. The newest
   entry should be a success, with a timestamp from the last few minutes and the
   commit hash you just pushed. If there are failed builds above the last good
   one, open the log — it names the file it could not find.

2. **Check the version banner.** Load the site. Under the title it should read:

   ```
   East Islip GU7 • 5v5 • 4 × 12-minute quarters • v37 PRINTDARK
   ```

   If it still says an older version, the deploy did not land — go back to
   step 1. **Check this banner before every game.**

3. **Check the API.** Open `https://team71.vjdifd.workers.dev/api/health` in a
   browser. You want `{"ok":true,...}`. If you get `{"ok":false,...}` the site is
   fine but D1 is not reachable, so sharing between phones will not work.

### Refreshing the app on a phone

The app is an installed PWA with a service worker. After a deploy:

- The service worker fetches `index.html` from the network first, so one reload
  normally picks up the new version.
- If a phone is stubborn: close the app fully (swipe it away), reopen, and pull
  to refresh. The cache name changed to `team71-v37-printdark`, so the old cache
  is deleted on activation.

---

## Local development

```bash
npm install
npm run dev      # wrangler dev, against a local D1
npm test         # 147 tests, no network or Cloudflare account needed
npm run tail     # live logs from the deployed Worker
```

`npm test` runs the full suite in about 20 seconds. Run it before you deploy.
