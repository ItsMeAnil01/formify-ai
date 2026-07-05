<div align="center">

# 🔨 Formify.ai

**A full-stack Smart Form, Quiz & Exam Builder.**
MERN stack · JWT auth · auto-grading · AI-assisted question generation (Claude or Gemini) · real analytics.

![Node](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?logo=mongodb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## What is this?

Formify.ai is one form builder that becomes a **survey**, **quiz**, **exam**, **feedback form**, **registration form**, or a **plain custom form** depending on a single `mode` field — not five different models bolted together. Build a question set once, and marks/negative-marking/pass-fail/instant-results just turn on when the mode calls for it.

It's a real, running MERN app — not a mockup:

- 🔐 JWT auth with bcrypt password hashing, **email verification**, and **Google Sign-In**
- 🧩 **17 question types** across text, choice, boolean, rating, selection, and input groups
- ✅ Server-side **auto-grading** — marks, negative marking, pass thresholds, per-question correctness breakdown (can't be spoofed from the client)
- 🤖 **AI-assisted authoring** — generate questions from a paragraph or topic, parse messy pasted questions, fix grammar, detect duplicate questions, summarize open-ended responses — powered by **Claude or Gemini**, your choice
- 📥 **CSV / Excel question import** and **image uploads** for questions and cover images
- 📊 Real analytics — completion rate, average time, score distribution, per-question option breakdowns
- 📎 **CSV export** of every response, with columns that adapt to the form's mode
- 🔒 Rate limiting, security headers (Helmet), NoSQL-injection sanitization
- ✅ **33 passing unit tests** covering grading logic, CSV parsing, and AI provider routing

---

## Table of contents

- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Design system](#design-system)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Known gaps / roadmap](#known-gaps--roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Screenshots

> _Add screenshots or a short GIF here once you've run it locally — the dashboard, the question builder, and the respondent fill-out flow are the three worth showing off._

| Dashboard | Builder | Respondent view |
|---|---|---|
| `docs/screenshot-dashboard.png` | `docs/screenshot-builder.png` | `docs/screenshot-respondent.png` |

---

## Tech stack

**Backend:** Node.js, Express, MongoDB + Mongoose, JWT, bcrypt, Multer, ExcelJS, Helmet, express-rate-limit, express-mongo-sanitize, Nodemailer, google-auth-library

**Frontend:** React 18, Vite, React Router, Tailwind CSS, Axios

**AI:** Anthropic Claude (`claude-sonnet-4-5`, `claude-haiku-4-5`) or Google Gemini (`gemini-2.5-flash`, `gemini-3.5-flash`) — swappable via one env var, called through plain `fetch`, no vendor SDK lock-in

**Testing:** Node's built-in `node:test` runner — zero extra test-framework dependency

---

## Project structure

```
formify/
├── server/
│   ├── src/
│   │   ├── config/          MongoDB connection
│   │   ├── controllers/     auth, forms, responses, ai
│   │   ├── middleware/      JWT auth, rate limiting, file upload, error handling
│   │   ├── models/          User, Form (mode + settings + questions), Response
│   │   ├── routes/          /api/auth, /api/forms, /api/responses, /api/ai
│   │   ├── services/        aiService (Claude/Gemini router), emailService
│   │   ├── utils/           grading, CSV export, CSV/Excel import parsing
│   │   └── index.js         Express app entry point
│   └── tests/               33 unit tests, zero DB dependency
└── client/
    └── src/
        ├── pages/            Login, Register, Dashboard, FormBuilder, FormResponses, PublicForm
        ├── components/       Navbar, QuestionEditor, StatCard, ProtectedRoute
        ├── context/          AuthContext
        └── constants/        question type definitions shared across builder + respondent view
```

---

## Quick start

### Prerequisites

- Node.js 18+
- A MongoDB instance — local (`mongodb://127.0.0.1:27017/formify`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Backend

```bash
cd server
cp .env.example .env      # fill in MONGO_URI and a real JWT_SECRET at minimum
npm install
npm run dev                # http://localhost:5000
```

### 2. Frontend

```bash
cd client
cp .env.example .env       # points to the API, defaults to localhost:5000
npm install
npm run dev                 # http://localhost:5173
```

Open `http://localhost:5173`, register an account, and start building. Everything else (AI, email, Google login) is optional — the app runs fully without any of those keys, it just skips those specific features until configured.

---

## Environment variables

All of these live in `server/.env` (copy from `server/.env.example`).

| Variable | Required? | What it does |
|---|---|---|
| `PORT` | optional (default 5000) | API port |
| `MONGO_URI` | **required** | MongoDB connection string |
| `JWT_SECRET` | **required** | Long random string signing auth tokens |
| `JWT_EXPIRES_IN` | optional (default `7d`) | Token lifetime |
| `CLIENT_URL` | optional | Used for CORS and building email verification links |
| `AI_PROVIDER` | optional (default `anthropic`) | `anthropic` or `gemini` — which provider the AI endpoints use by default |
| `AI_MODEL` | optional | Override the default model — see table below |
| `ANTHROPIC_API_KEY` | optional | Enables Claude — get one at [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `GEMINI_API_KEY` | optional | Enables Gemini — get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional | Enables real email delivery for verification emails. **Leave blank during dev** — verification links get logged to the server console instead |
| `GOOGLE_CLIENT_ID` | optional | Enables "Sign in with Google" — create an OAuth client at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) |

**AI model options** (set via `AI_MODEL`, or override per-request):

| Model ID | Provider | Notes |
|---|---|---|
| `claude-sonnet-4-5` | Anthropic | balanced default |
| `claude-haiku-4-5` | Anthropic | fastest/cheapest Claude |
| `gemini-2.5-flash` | Google | fast, cheap, solid quality |
| `gemini-3.5-flash` | Google | Google's strongest Flash-tier reasoning |

`client/.env` only needs one variable: `VITE_API_URL` (defaults to `http://localhost:5000/api`).

---

## API reference

### Auth — `/api/auth`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | – | Create account, triggers verification email |
| POST | `/login` | – | Log in |
| POST | `/google` | – | Sign in with a Google ID token |
| GET | `/verify-email/:token` | – | Confirm email address |
| GET | `/me` | ✓ | Current user |
| POST | `/resend-verification` | ✓ | Resend the verification email |

### Forms — `/api/forms`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/` | ✓ | List own forms + dashboard stats |
| POST | `/` | ✓ | Create form |
| POST | `/upload-image` | ✓ | Upload a question/cover image |
| GET / PUT / DELETE | `/:id` | ✓ | Manage one form |
| PATCH | `/:id/status` | ✓ | Draft / publish / close / archive |
| POST | `/:id/duplicate` | ✓ | Clone a form |
| POST | `/:id/import-questions` | ✓ | Bulk-import questions from a `.csv` or `.xlsx` file |
| GET | `/public/:slug` | – | Respondent fetch (share link) |
| GET | `/:id/responses` | ✓ | List responses |
| GET | `/:id/analytics` | ✓ | Per-question breakdown, scores, pass rate |
| GET | `/:id/export.csv` | ✓ | Download responses as CSV |

### Responses — `/api/responses`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/:slug` | – | Submit a response (auto-graded if quiz/exam) |

### AI — `/api/ai` (all authenticated)

| Method | Route | Purpose |
|---|---|---|
| GET | `/models` | List available AI models and which are configured |
| POST | `/generate-questions` | Generate questions from a paragraph or topic |
| POST | `/parse-paste` | Convert messy pasted text into structured questions |
| POST | `/fix-grammar` | Grammar/spelling correction |
| GET | `/forms/:id/duplicates` | Detect near-duplicate questions in a form |
| GET | `/forms/:id/questions/:questionId/summary` | Summarize open-ended responses to one question |

---

## Design system

Palette: charcoal ink (`#1A1D24`), cool steel-grey paper (`#EEF0F2`), forge-ember accent (`#EF5F3B`) for primary actions, steel-blue (`#3A6EA5`) for informational/secondary. Display type is **Space Grotesk**, body is **Inter**, data/scores use **IBM Plex Mono** — all defined in `client/tailwind.config.js`.

---

## Testing

```bash
cd server
npm test
```

33 tests, zero database dependency — they run against pure logic (grading, CSV import/export parsing, AI model routing) using Node's built-in test runner, so there's nothing extra to install.

---

## Security notes

- Passwords hashed with bcrypt; JWTs signed with a server-side secret
- `express-rate-limit` on auth endpoints (20 req/15 min) and public form submission (10 req/min)
- `helmet` for standard security headers, `express-mongo-sanitize` to block NoSQL injection via request bodies
- File uploads are size- and type-restricted (5MB, image/CSV/XLSX only)
- **Known residual issue:** a moderate-severity transitive `uuid` advisory via `exceljs`/`google-auth-library` with no non-breaking fix currently available upstream — low practical risk since it's not exercised with attacker-controlled input, but worth revisiting when those packages update.
- This has **not** been through a full penetration test or run against production traffic — treat it as a strong starting point, not a finished security posture.

---

## Known gaps / roadmap

The backend API for these is complete and tested, but **the frontend UI isn't wired up yet** — worth knowing before you assume a feature "just works" from the browser:

- 🤖 AI panel in the builder (generate/parse/fix-grammar/duplicates/summarize) — API ready, no UI yet
- 📥 CSV/Excel import button in the builder — API ready, no UI yet
- 🖼️ Image upload control in the question editor — API ready, no UI yet
- 🔓 "Sign in with Google" button — API ready, no UI yet
- ✉️ Email verification banner / `/verify-email/:token` page — API ready, no UI yet

Not yet built at all:

- Drag-and-drop question reordering (currently up/down buttons only)
- QR code generation for share links
- Toast notification system (currently uses `alert()`/inline banners)
- CAPTCHA on public form submission

If you pick one of these up, the AI service (`server/src/services/aiService.js`) and question schema (`server/src/models/Form.js`) are the two files most other features build on top of — start there.

---

## Contributing

Issues and PRs welcome. If you add a feature, please add a test alongside it in `server/tests/` — the existing suite is a good template (`node:test` + `node:assert/strict`, no DB required).

## License

MIT — see [`LICENSE`](./LICENSE). Use it, fork it, ship it.
