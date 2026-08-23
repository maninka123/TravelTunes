# 🗄️ Cloudflare D1 Setup Runbook

This guide covers how to create the Cloudflare D1 database, apply migrations, enable the binding in `wrangler.toml`, and query run logs and aggregate usage statistics.

---

## 📋 Step-by-Step Setup

### Step 1: Create the D1 Database
Run the following command in your terminal (using the pinned Wrangler version compatible with Node 20):

```bash
npx wrangler@3.114.14 d1 create traveltunes-runs
```

#### Expected Output:
```text
✅ Successfully created DB 'traveltunes-runs'!

[[d1_databases]]
binding = "DB" # i.e. available in your Worker on env.DB
database_name = "traveltunes-runs"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### Step 2: Configure `wrangler.toml`
Open `wrangler.toml`, uncomment the `[[d1_databases]]` block, and replace `REPLACE_WITH_DATABASE_ID` with the `database_id` returned in Step 1.

> [!IMPORTANT]
> Keep `binding = "RUN_LOG"`. **Do NOT use `binding = "DB"`**. The application code expects `env.RUN_LOG`.

Your configured block in `wrangler.toml` should look like:
```toml
[[d1_databases]]
binding = "RUN_LOG"
database_name = "traveltunes-runs"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### Step 3: Apply Remote Migrations
Apply the schema migrations (`0001_run_log.sql` and `0002_usage_geo.sql`) to your remote D1 database:

```bash
npm run d1:migrate
```

*(This runs `npx wrangler@3.114.14 d1 migrations apply traveltunes-runs --remote`)*

#### Expected Output:
```text
Migrations to be applied:
  - 0001_run_log.sql
  - 0002_usage_geo.sql
✔ About to apply 2 migrations on traveltunes-runs. Do you want to proceed? … yes
🌀 Executing on remote database traveltunes-runs...
┌───────────────────┬────────┐
│ Migration         │ Status │
├───────────────────┼────────┤
│ 0001_run_log.sql  │ Success│
│ 0002_usage_geo.sql│ Success│
└───────────────────┴────────┘
```

---

### Step 4: Commit and Push to Deploy
Commit the updated `wrangler.toml` (with your database_id) and push to your GitHub branch/main to trigger a Cloudflare Pages deployment:

```bash
git add wrangler.toml
git commit -m "Enable D1 RUN_LOG binding"
git push origin main
```

---

### Step 5: Test on the Live Site
1. Visit your live site (e.g. `https://traveltunes.pages.dev`).
2. Upload a photo, select countries/sliders, and click **Find songs**.
3. Allow the request to complete.

---

### Step 6: Query Logs and Analytics

#### Tail Recent Model Runs:
```bash
npm run runs:tail
```
*(Runs `npx wrangler@3.114.14 d1 execute traveltunes-runs --remote --command "SELECT created_at, provider, vision_model, songs_model, countries, error FROM runs ORDER BY created_at DESC LIMIT 20"`)*

#### Tail Aggregate Daily Geography:
```bash
npm run geo:tail
```
*(Runs `npx wrangler@3.114.14 d1 execute traveltunes-runs --remote --command "SELECT day, country, city, runs FROM usage_geo ORDER BY day DESC, runs DESC LIMIT 30"`)*

---

## 🔍 Troubleshooting

### 1. Binding Named `DB` Instead of `RUN_LOG`
- **Symptom**: Migrations succeed and queries return empty rows even after multiple runs.
- **Cause**: `wrangler d1 create` outputs snippet examples with `binding = "DB"`. The backend code explicitly reads `env.RUN_LOG`.
- **Fix**: Verify `wrangler.toml` has `binding = "RUN_LOG"`.

### 2. Forgetting the `--remote` Flag
- **Symptom**: `npx wrangler d1 execute ...` outputs `0 rows` despite active traffic on the live site.
- **Cause**: Without `--remote`, Wrangler queries an isolated local SQLite file on your computer instead of the live Cloudflare D1 database.
- **Fix**: Always include `--remote` or use the predefined scripts (`npm run runs:tail` and `npm run geo:tail`).

### 3. Local Development (`npm run dev`)
- **Symptom**: No logs are written when testing locally via Vite (`http://localhost:5173`).
- **Explanation**: The local Vite dev server does not attach a live Cloudflare D1 database binding. `logRun` and `bumpGeo` detect that `env.RUN_LOG` is undefined and gracefully return early without errors.
- **Testing locally with D1**: If you want to test against D1 locally, run `npm run cf:dev` with a local D1 database or test directly against the deployed Pages environment.
