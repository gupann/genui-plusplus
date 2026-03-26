# GenreUI Research – User Study

A small React app for running research user studies. Participants see a single “before” screen for each case study and list **multiple small, incremental changes** they would make, along with the **AI prompt** they’d use for each change.

## What’s in the app

- **Home**: Three case study buttons (Case Study 1, 2, 3). Clicking one starts that task.
- **Study flow** (for each task):
  1. **Screen**: Your image for this case study.
  2. **Collect N small changes**: For each change, the participant fills in:
     - “What is the small change or issue?”
     - “AI prompt you would use for this change”  
     They can add **N small changes** with the **“+ Add another small change”** button, then click **“Save changes and start evaluation”**.
  3. **Per-change evaluation pages**:
     - For each change, the app uses the corresponding AI prompt to generate an **after screen** (via `generateAfterScreen`).
     - The participant sees one page per change and answers:
       - **What is successful about this result?** (e.g., can find the asked UI element)
       - **What is not successful about this result?** (e.g., other UIs are changed)
       - **Would you approve this screen as a designer?** (Yes/No)
     - They click **“Next change”** until they finish all N changes.
  4. **Thank-you screen**: Summarizes that their changes and evaluations were captured.

The app now supports persistent study sessions and participant profiles:

- Magic-link sign-in (Supabase Auth)
- Required participant profile onboarding (`name`, `current profession`, `past work`)
- Autosave + resume for each participant/stage/task
- Final completion persistence on `Finish case study`

## Before screens (images + optional HTML)

Put one “before” screenshot (and optional “before” HTML) per case study under `public/case-study-N/`:

- `public/case-study-1/task1-before.png` (or `.jpg`) and optional `public/case-study-1/task1-before.html`
- `public/case-study-2/task2-before.png` (or `.jpg`) and optional `public/case-study-2/task2-before.html`
- `public/case-study-3/task3-before.png` (or `.jpg`) and optional `public/case-study-3/task3-before.html`

If a file is missing, the app shows a placeholder and tells you the expected path.

## Data persistence setup (Supabase)

1. Create a Supabase project.
2. In Supabase SQL editor, run [supabase/schema.sql](supabase/schema.sql).
3. Configure environment variables:

   Local `.env`:
   ```bash
   # Frontend
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

   # UI generation API
   VITE_UI_GENERATION_API_URL=/api/generate

   # Backend (server + Vercel functions)
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_KEY
   ```

4. Run both servers locally:
   ```bash
   npm run dev:server
   npm run dev
   ```

Notes:
- Vite proxies `/api/*` to `http://localhost:8787` in dev.
- If Supabase server env is missing, the app falls back to local file storage (`.data/study-sessions.json`).


## Connect your UI generation tool (Figma/Claude/Stitch/backend)

The study flow already calls `generateAfterScreen()` for each user prompt during evaluation.

1. Put your task assets in `public/`:
   - `case-study-1/task1-before.png`, `case-study-2/task2-before.png`, `case-study-3/task3-before.png`
   - Optional code context: `case-study-1/task1-before.html`, `case-study-2/task2-before.html`, `case-study-3/task3-before.html`
2. Set your generation endpoint in a `.env` file:

   ```bash
   VITE_UI_GENERATION_API_URL=/api/generate
   ```

3. Your endpoint should accept:
   - `taskId`
   - `prompt`
   - `beforeImageUrl`
   - `beforeCode` (if `task*-before.html` exists)

4. Return one of:
   - `{ "afterImageUrl": "https://..." }`
   - `{ "afterHtml": "<html>...</html>" }`
   - `{ "afterCode": "..." }`

For local development, `/api/generate` is proxied to the local generation server.

## How to run

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the dev server**

   ```bash
   npm run dev
   ```

3. Open the URL Vite prints (usually `http://localhost:5173`).  
   - Sign in with magic link (if Supabase frontend env is configured).
   - Complete profile onboarding once.
   - Start study and continue/resume progress across reloads.

**Build for production:**

```bash
npm run build
npm run preview   # serve the built app locally
```

Built files go into `dist/`; you can deploy that folder to any static host.

## Tech

- **React 18** + **Vite**
- **React Router** for `/` (home) and `/study/:taskId`
- Supabase (Auth + Postgres) for participant profiles and persisted study sessions
