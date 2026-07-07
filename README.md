# Discord Family Tree

An Ancestry.com-style family tree for your Discord friends. Import your friend list using the same method as [fwendator](https://github.com/Escartem/fwendator) and explore how your friends connect.

**Live demo:** [https://cloud-121.github.io/VAWB/](https://cloud-121.github.io/VAWB/) *(after enabling GitHub Pages)*

## Features

- Pedigree-style tree layout with profile cards and avatars
- Import Discord friends via fwendator-compatible JSON export
- Mutual-friend connections shown as sibling links
- Fully client-side — data stays in your browser (localStorage)
- Works on GitHub Pages (static deploy, no server needed)

## Quick start (local)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Import your friends

1. Open [discord.com/app](https://discord.com/app) in your browser
2. Press `F12` → Console
3. Paste the contents of [`frontend/public/getFriends.js`](frontend/public/getFriends.js)
4. Enter your Discord token when prompted (stays local — never sent to this app)
5. Download the generated JSON file
6. In the app, go to **Import Friends** and upload the JSON

> **Warning:** Using your token in the console is self-botting and against Discord ToS. The token is only used in your browser to call Discord's API. Use at your own risk.

## GitHub Pages deploy

The repo includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds and deploys automatically on push to `main`.

**One-time setup:**

1. Go to your repo **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` — the workflow builds `frontend/` and deploys to Pages

The app is built with base path `/VAWB/` for the `Cloud-121/VAWB` repo. If you fork to a different repo name, update `base` in `frontend/vite.config.ts`.

## Optional backend (local dev)

A Node/Express API exists in `backend/` for OAuth and SQLite storage, but **GitHub Pages only serves the static frontend**. The deployed site uses browser localStorage instead.

```bash
cd backend && npm install && npm run dev
```

## Credits

- Friend export method adapted from [fwendator](https://github.com/Escartem/fwendator) by Escartem
