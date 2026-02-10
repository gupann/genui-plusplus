# GenUI Research – User Study

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

Right now, the app logs data to the browser console when:

- The list of small changes is saved (`Save changes and start evaluation`).
- The per-change evaluations are completed (`Finish case study`).

You can hook these points up to a backend or analytics tool if you want to persist the data.

## Before screens (images)

Put one “before” screenshot per task in the `public/` folder:

- `public/task1-before.png` (or `.jpg`) for Case Study 1  
- `public/task2-before.png` for Case Study 2  
- `public/task3-before.png` for Case Study 3  

If a file is missing, the app shows a placeholder and tells you the expected path.

## Capturing results

When a participant clicks **“Finish study”** on `/study/:taskId`, the app:

- Keeps the list of `{ id, problem, prompt }` objects in memory.
- Logs them via `console.log('Submitted changes for task', taskId, changes)`.

If you want to persist results, you can:

- Add a small API call in `Study.jsx` inside `handleSubmit` to POST the `changes` array to your backend.
- Or integrate with any analytics/telemetry SDK you use.

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
   - Click a case study → view the screen → add as many (problem, AI prompt) pairs as you like → click “Finish study”.

**Build for production:**

```bash
npm run build
npm run preview   # serve the built app locally
```

Built files go into `dist/`; you can deploy that folder to any static host.

## Tech

- **React 18** + **Vite**
- **React Router** for `/` (home) and `/study/:taskId`
- No database: feedback is only sent to `submitFeedback()` in `api.js` (currently a `console.log`). Add your own backend or analytics there if you want to store responses.
