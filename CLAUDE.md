# tea-erp

Canonical map: `graphify-out/tea-wiki/index.md` — читай его первым на любой структурный вопрос.

Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + react-router-dom v6.
Deploy: Vercel. DB: Supabase (15 таблиц, см. [[db-schema]]).

Branch policy: feature-ветки от `main`.

## Antigravity sync
После изменений в Antigravity скажи "обнови граф" — Claude делает pull, патчит `graphify-out/wiki/`.
