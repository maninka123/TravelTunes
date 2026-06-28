# 🎧 TravelTunes

Photo mood to country-aware songs, wrapped in a clean mobile-first app.

[![Live App](https://img.shields.io/badge/Live-traveltunes.pages.dev-087f8c?style=for-the-badge&logo=cloudflarepages&logoColor=white)](https://traveltunes.pages.dev)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=111827)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=for-the-badge&logo=vite&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?style=for-the-badge&logo=cloudflare&logoColor=white)

## 🌐 Live App

Try it here: **[traveltunes.pages.dev](https://traveltunes.pages.dev)**

## 📱 App Preview

![TravelTunes full app screenshot](./public/app-screenshot.png)

## ✨ What It Does

- 📸 Upload up to 4 travel photos.
- 🧭 Detect the photo country from EXIF GPS when available.
- 🌍 Search countries with flag suggestions and manual override.
- 🎚️ Tune the vibe with premium Energy and Style sliders.
- 🗣️ Prioritize English, Sinhala, and local-language music.
- 🧠 Choose Qwen or Gemini for photo mood and song generation.
- ▶️ Play songs in an audio-first row UI with a seek timeline.
- 📋 Copy individual song names from each result row.
- ☁️ Runs on Cloudflare Pages + Functions so API keys stay server-side.

## 🧱 Stack

- React 18 + Vite
- Cloudflare Pages + Pages Functions
- `exifr` for client-side GPS metadata
- OpenStreetMap Nominatim for reverse geocoding
- Gemini + Qwen/DashScope model routes
- YouTube Data API search for playable tracks

## 🚀 Local Development

Install dependencies:

```bash
npm install
```

Run frontend only:

```bash
npm run dev
```

Run with Cloudflare Functions locally:

```bash
cp .dev.vars.example .dev.vars
npm run cf:dev
```

Add real keys to `.dev.vars` or copy them from `.env.local`. These files are ignored by git.

## 🔐 Required Env Vars

```text
GEMINI_API_KEY
QWEN_API_KEY or DASHSCOPE_API_KEY
YOUTUBE_API_KEY
```

Optional model overrides:

```text
GEMINI_VISION_MODEL
GEMINI_TEXT_MODEL
QWEN_MODEL
QWEN_VISION_MODEL
QWEN_TEXT_MODEL
```

## ☁️ Cloudflare Pages Deploy

Use these Pages build settings:

```text
Build command: npm run build
Output directory: dist
```

Then add the env vars above in:

```text
Cloudflare Pages → Settings → Environment variables
```

Every push to GitHub can deploy automatically once the repo is connected.

## 📍 Future Place Data

Use the `places/` folder for place-specific song rules, language defaults, or curated overrides.
