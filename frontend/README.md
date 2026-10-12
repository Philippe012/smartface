# SmartFace frontend

React 19 + TypeScript single-page app for the SmartFace attendance system, built with Vite,
Tailwind CSS 4 and lucide-react icons. See the [project README](../README.md) for the full setup.

```powershell
npm install
Copy-Item .env.example .env
npm run dev          # http://localhost:5173, proxies /api to http://127.0.0.1:8000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with API proxy |
| `npm run build` | Type-check and build to `dist/` (served by Django in production) |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests |
| `npm run preview` | Preview the production build |

## Structure

```
src/
├── app/           router (lazy-loaded route groups) and providers
├── components/    Logo and ui/ (Button, Field, Card, Badge, Dialog, Table, Toast, …)
├── features/
│   ├── landing/   public landing page
│   ├── auth/      session context, route guard, login, password recovery, 403/404
│   ├── admin/     dashboard, employees + enrollment, attendance, cameras, reviews, reports, audit, settings
│   ├── employee/  employee portal pages
│   └── shared/    status badges, chart, account forms, audit diff
├── hooks/         useApi (fetch + polling), debounce, online status, document title
├── layouts/       AppShell (sidebar + mobile drawer), admin/employee/auth layouts
├── lib/           API client (session + CSRF), formatting, form error mapping
├── styles/        Tailwind entry and design tokens (@theme)
└── types/         API types
```

## Conventions

- Authentication uses Django session cookies. The client fetches a CSRF token from
  `/auth/csrf` and sends it as `X-CSRFToken` on unsafe requests. No tokens are kept in
  local storage.
- Route guards only control navigation. The API enforces every permission.
- Only public values go in `VITE_*` variables.
- Icons come from `lucide-react` only. Colours come from the `brand`/`ink` tokens in
  `src/styles/index.css` plus Tailwind's slate scale.
