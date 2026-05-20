# Indy's Swim Tracker

Interactive swim time progression tracker for Indigo Riordan. Built with React + Chart.js, hosted on GitHub Pages, reads live from Google Sheets.

---

## One-time setup

### 1 — Install Node.js

Download from https://nodejs.org (LTS version). Verify with:
```
node -v   # should print v18 or higher
npm -v
```

### 2 — Get a Google Sheets API key

1. Go to https://console.cloud.google.com/
2. Create a new project (e.g. "Swim Tracker")
3. Search for "Google Sheets API" → Enable it
4. Go to **APIs & Services → Credentials → Create Credentials → API key**
5. Click **Edit API key**, under "API restrictions" select "Restrict key" → choose **Google Sheets API**
6. Copy the key

### 3 — Configure the app

Open `src/config.js` and paste your key:
```js
export const API_KEY = 'AIza...'         // your key here
export const SHEET_TAB = 'Sheet1'        // tab name at bottom of your sheet
```

Also make sure your Google Sheet is shared as **"Anyone with the link can view"**
(Share → Change to anyone with the link → Viewer).

### 4 — Set the repo name in vite.config.js

```js
base: '/YOUR_REPO_NAME/',   // must match your GitHub repo name exactly
```

---

## Run locally

```bash
cd swim-tracker
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Deploy to GitHub Pages

### Option A — GitHub Actions (recommended, auto-deploys on push)

1. Create a new GitHub repo (e.g. `swim-tracker`)
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/swim-tracker.git
   git push -u origin main
   ```
3. In your repo on GitHub: **Settings → Pages → Source → GitHub Actions**
4. The first push will trigger a deploy. Your site will be live at:
   `https://YOUR_USERNAME.github.io/swim-tracker/`

> **Keep your API key private:** If your repo is public, the key in `src/config.js`
> will be visible. Restrict it to the Sheets API + your GitHub Pages domain in
> Google Cloud Console → that limits any misuse. Or add it as a GitHub secret:
> **Settings → Secrets → New secret → `VITE_GOOGLE_API_KEY`** and remove it from
> `config.js` (the GitHub Actions workflow already reads it from secrets).

### Option B — Manual deploy

```bash
npm run build       # creates dist/
npm run deploy      # pushes dist/ to gh-pages branch via gh-pages package
```

Then in GitHub: **Settings → Pages → Source → Deploy from branch → gh-pages → / (root)**

---

## Sheet format

Columns A–I must be in this order (matching your existing sheet):

| A    | B    | C      | D        | E      | F       | G   | H        | I    |
|------|------|--------|----------|--------|---------|-----|----------|------|
| Date | Meet | Stroke | Distance | Course | Country | Age | Verified | Time |

- **Date**: `DD/MM/YYYY` or `YYYY-MM-DD`
- **Time**: `m:ss.cc` (e.g. `1:02.34`) or `ss.cc` (e.g. `29.85`)
- **Distance**: just the number (`100`, `200`, etc.) — the app adds "m"
- **Course**: e.g. `SC` / `LC`

---

## Features

- Filter by Stroke, Distance, Course, Country
- Line chart with reversed Y-axis (faster = higher)
- Green dots = new PB at that point in time
- Summary metrics: result count, personal best, improvement %, meet count
- Results table with current PBs highlighted green (★)
- Reads live from Google Sheets — no manual CSV exports needed
