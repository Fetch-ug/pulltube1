# PullTube — Deploy Guide

A public website where anyone can paste a YouTube URL and download it.
No terminal knowledge needed for end users — just paste, pick, click.

---

## Deploy in 5 steps (takes ~10 minutes total)

### Step 1 — Put the code on GitHub
1. Go to https://github.com and sign in (free)
2. Click the **+** button → **New repository**
3. Name it `pulltube` → click **Create repository**
4. Click **uploading an existing file** → drag this entire folder in → click **Commit changes**

### Step 2 — Deploy to Render
1. Go to https://render.com and sign in with GitHub (free)
2. Click **New +** → **Web Service**
3. Click **Connect** next to your `pulltube` repo
4. Fill in these settings:
   - **Name:** pulltube (or anything)
   - **Runtime:** Node
   - **Build Command:** `bash build.sh`
   - **Start Command:** `node server.js`
5. Click **Create Web Service**

### Step 3 — Wait ~3 minutes
Render installs everything (Node, yt-dlp, ffmpeg) automatically.
You'll see a green **Live** badge when it's done.

### Step 4 — Your site is live
You get a URL like: `https://pulltube.onrender.com`
Share it with anyone — they just paste a URL and click Download.

### Step 5 — Custom domain (optional)
In Render → Settings → Custom Domains → add your domain.

---

## How it works for users
1. Paste a YouTube playlist or video URL
2. Pick Audio (MP3/M4A/OPUS) or Video (MP4/MKV)
3. Pick resolution (1080p selected by default)
4. Click Download
5. File downloads straight to their computer
   - Single video → downloads directly as MP4/MP3
   - Full playlist → downloads as ZIP (numbered & named files inside)

---

## Free tier limits on Render
- Server sleeps after 15 min idle (first visit after sleep takes ~30 seconds to wake up)
- Upgrade to paid ($7/mo) for always-on
- No download size limits otherwise

## Project structure
```
pulltube/
  public/
    index.html      ← entire frontend (one file)
  server.js         ← Express backend + yt-dlp runner
  package.json      ← Node dependencies
  build.sh          ← installs yt-dlp + ffmpeg on Render
  render.yaml       ← Render config
  .gitignore
  README.md
```
