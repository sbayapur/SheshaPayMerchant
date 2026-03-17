# Shesha Pay – Merchant

Merchant dashboard and API for Shesha Pay. View payments, generate QR codes, manage employees, and access accounting.

## Structure

- **frontend/** – React merchant dashboard (deployed to AWS Amplify)
- **backend/** – Express API (deploy separately)

## Setup

### 1. Install dependencies

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Environment variables

**Frontend** – Copy `frontend/.env.example` to `frontend/.env`:

- `VITE_API_BASE` – Backend API URL (e.g. `http://localhost:4000` for local, or your deployed API URL)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` – Supabase Auth (required for login)

**Backend** – Copy `backend/.env.example` to `backend/.env`:

- `PORT` – Server port (default: 4000)
- `STITCH_CLIENT_ID` / `STITCH_CLIENT_SECRET` – Stitch payment provider
- `META_APP_ID` / `META_APP_SECRET` – Optional, for WhatsApp Business

### 3. Run locally

```bash
# Terminal 1 – backend
npm run dev:api

# Terminal 2 – frontend
npm run dev
```

Or run both:

```bash
npm run dev:full
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000

## Deployment

### Frontend (AWS Amplify)

The repo includes `amplify.yml` for Amplify Hosting. Connect this repo to Amplify and deploy. Set environment variables in Amplify Console:

- `VITE_API_BASE` – Your deployed backend URL
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` – Supabase Auth

### Backend

Amplify hosts only the static frontend. Deploy the backend separately:

- **AWS Lambda + API Gateway** – Use serverless-express or similar
- **AWS Elastic Beanstalk** – Node.js app
- **Render / Railway / Fly.io** – Managed Node hosting

After deploying the backend, set `VITE_API_BASE` in the Amplify environment to your backend URL.

### Deployment checklist (Amplify + App Runner)

To avoid CORS and network errors:

| Where | Variable | Value | Notes |
|-------|----------|-------|-------|
| **Amplify** | `VITE_API_BASE` | `https://xxx.awsapprunner.com` | No trailing `/`, `?`, or `&` |
| **Amplify** | `VITE_SUPABASE_URL` | Your Supabase project URL | Required for login |
| **Amplify** | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Required for login |
| **App Runner** | `FRONTEND_BASE_URL` | `https://main.xxx.amplifyapp.com` | Exact Amplify app URL (CORS allows this origin) |

If you see "CORS header does not match" or "Failed to fetch", ensure:
1. `FRONTEND_BASE_URL` in App Runner matches your Amplify URL exactly.
2. `VITE_API_BASE` in Amplify has no trailing characters.
3. Redeploy both frontend and backend after changing env vars.

## Routes

- `/` – Merchant dashboard (login if not authenticated)
- `/demo/logs` – Webhook logs (demo/dev)
