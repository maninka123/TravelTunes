# TravelTunes

TravelTunes is an iPhone-first Cloudflare Pages app that turns up to three travel photos into a country-aware song list with YouTube playback.

## Features

- Upload up to 3 photos and preview them locally.
- Read EXIF GPS data in the browser with `exifr`.
- Reverse-geocode GPS coordinates to a country using OpenStreetMap Nominatim.
- Manually override the country at any time.
- Tune Energy and Style sliders.
- Adjust language priority chips and add custom languages or countries.
- Select Gemini or Qwen for the vision mood read and song suggestions.
- Search YouTube server-side and embed playable results when `YOUTUBE_API_KEY` is configured.

## Local Development

```bash
npm install
npm run dev
```

Vite serves the frontend only. API routes need Cloudflare Pages Functions:

```bash
cp .dev.vars.example .dev.vars
npm run cf:dev
```

Keep real keys in `.env.local`, `.dev.vars`, or Cloudflare Pages encrypted environment variables. They are intentionally ignored by git.

## Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Set these encrypted environment variables in Cloudflare Pages:

```text
GEMINI_API_KEY
QWEN_API_KEY
YOUTUBE_API_KEY
```

Optional model overrides are listed in `.env.example`.

## Future Place Data

Use the `places/` folder for place-specific song rules, language defaults, or curated overrides.
