# 🎧 TravelTunes

Photo mood to country-aware songs, wrapped in a clean mobile-first app.

[![Live App](https://img.shields.io/badge/Live-traveltunes.pages.dev-087f8c?style=for-the-badge&logo=cloudflarepages&logoColor=white)](https://traveltunes.pages.dev)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=111827)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=for-the-badge&logo=vite&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?style=for-the-badge&logo=cloudflare&logoColor=white)

## 🌐 Live App

Try it here: **[traveltunes.pages.dev](https://traveltunes.pages.dev)**

## 📱 App Preview

<p align="center">
  <img src="./public/app-screenshot.png" alt="TravelTunes full app screenshot" width="420" />
</p>

## ✨ What It Does

- Upload up to 4 travel photos with a dynamic preview layout.
- Detect the photo country from EXIF GPS when available to guide mood analysis.
- Choose which countries the music should come from with a curated list (up to 4 countries maximum).
- Allocate song counts per country with responsive `+` and `−` steppers (e.g. 3 from Sri Lanka, 3 from Japan, 2 from India).
- Tune the vibe with discrete Energy (Calm / Easy / Lively / High) and Style (Traditional / Mixed / Modern) segmented controls.
- Choose Gemini, Qwen, or DeepSeek for photo mood reading and song generation.
- Play songs with lazy on-demand YouTube lookup, caching, and seek timeline.
- Copy individual song names from each result row.
- Runs on Cloudflare Pages + Functions so API keys stay server-side.


## 🧱 Stack

- React 18 + Vite
- Cloudflare Pages + Pages Functions
- Cloudflare D1 (Optional text-only run logs & aggregate geo analytics)
- FlagCDN for lightweight on-demand country flag images
- `@icons-pack/react-simple-icons` for verified AI provider brand marks
- `exifr` for client-side GPS metadata
- OpenStreetMap Nominatim reverse geocoding proxied via `/api/geocode`
- Gemini, Qwen/DashScope, and DeepSeek model routes
- YouTube Data API search with Cloudflare KV caching (`YT_CACHE`)


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
DEEPSEEK_API_KEY
YOUTUBE_API_KEY
```

### Model Defaults & Optional Overrides:

- **Google Gemini**:
  - Required key: `GEMINI_API_KEY`
  - Default model: `gemini-3.1-flash-lite`
  - Overrides: `GEMINI_VISION_MODEL`, `GEMINI_TEXT_MODEL`
- **Alibaba Qwen / DashScope**:
  - Required key: `QWEN_API_KEY` or `DASHSCOPE_API_KEY`
  - Default model: `qwen3.5-flash`
  - Overrides: `QWEN_VISION_MODEL`, `QWEN_TEXT_MODEL`, `QWEN_MODEL`
- **DeepSeek**:
  - Required key: `DEEPSEEK_API_KEY`
  - Default vision model: `deepseek-v4-flash-vision-exp`
  - Default text model: `deepseek-v4-flash`
  - Overrides: `DEEPSEEK_VISION_MODEL`, `DEEPSEEK_TEXT_MODEL`


## 📊 Run Log & Usage Analytics (Cloudflare D1)

TravelTunes includes an optional, privacy-first debugging and analytics system powered by Cloudflare D1.

### Privacy Guarantees & Plain-Text Transparency
- **No personal data is stored.**
- **Explicit Exclusion List (Never Stored or Logged):**
  - No image bytes, base64 payloads, or image filenames
  - No EXIF metadata or GPS coordinates
  - No detected photo location
  - No user image notes or free-text descriptions
  - No IP addresses or request headers on run records
  - No cookies, session identifiers, tracking pixels, or fingerprinting
- **Runs Table (`runs`)**: Logs text-only technical debugging metadata for prompt and model evaluation:
  - Timestamp, provider, resolved vision/songs models
  - User-selected music countries (names & counts)
  - Slider values (energy, style)
  - Model response JSON (structured mood tags and song recommendations)
  - Latency durations (`vision_ms`, `songs_ms`) and error messages
- **Unlinkable Aggregate Geography (`usage_geo`)**:
  - Increments a coarse daily country/city counter derived from Cloudflare Edge metadata.
  - Stored separately from `runs` with **no joinable columns**, no timestamps finer than the day (`YYYY-MM-DD`), and no run IDs. The tables cannot be correlated.
- **No HTTP API exposure**: There is no public or private HTTP endpoint exposing run data (`/api/runs` does not exist). Data is accessible solely via Wrangler CLI.

### Setting up D1 (Optional)

1. Create the D1 database:
   ```bash
   npx wrangler d1 create traveltunes-runs
   ```
2. Uncomment the `[[d1_databases]]` block in `wrangler.toml` and fill in `database_id`.
3. Apply database migrations:
   ```bash
   npx wrangler d1 migrations apply traveltunes-runs
   ```

### Querying Logs & Analytics

Query the latest model runs:
```bash
npm run runs:tail
```

Query aggregate daily geography counters:
```bash
npm run geo:tail
```


## 📦 Cloudflare KV Caching

Create the KV namespace for YouTube search results:

```bash
npx wrangler kv:namespace create YT_CACHE
```

Add the generated namespace ID to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "YT_CACHE"
id = "<your-namespace-id>"
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
