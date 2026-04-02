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
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` – For transactions table (payment logs)

### 3. Transactions table (Supabase)

Payment lifecycle events are stored in Supabase instead of in-memory logs:

1. Run the migration in Supabase SQL Editor: copy contents of `supabase/migrations/001_create_transactions_table.sql` (if you use the transactions / payment intent store features from the backend)
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to backend env (from Supabase Project Settings → API)

If you use **saved order history / customers**, create the `customers` and `merchant_orders` tables in the SQL Editor (same project as above).

### 4. Run locally

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
| **Amplify (merchant)** | `VITE_API_BASE` | `https://xxx.awsapprunner.com` | No trailing `/`, `?`, or `&` |
| **Amplify (merchant)** | `VITE_SUPABASE_URL` | Your Supabase project URL | Required for login |
| **Amplify (merchant)** | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Required for login |
| **Amplify (merchant)** | `VITE_CUSTOMER_BASE_URL` | `https://main.d2ihokjg486p29.amplifyapp.com` | Customer checkout URL for payment links |
| **App Runner** | `FRONTEND_BASE_URL` | Merchant Amplify URL | For CORS |
| **App Runner** | `CUSTOMER_BASE_URL` | `https://main.d2ihokjg486p29.amplifyapp.com` | Customer checkout URL for `/pay/{token}` links |

## Routes

- `/` – Merchant dashboard (login if not authenticated)

### Customer app (separate repo)

Payment links (`/pay/{token}`) must open in the customer checkout app. The customer app should:

1. **Route** `/pay` and `/pay/:token` to the checkout view
2. **Fetch** payment data from `GET {API_BASE}/api/pay/{token}` (same backend as merchant)
3. **Display** checkout with `orderId`, `amount`, `currency`, `note`, `items`, `merchantName` from the response
4. **Create** a payment intent and complete the flow

If the customer app uses a different path (e.g. `/customer/:token`), set `CUSTOMER_BASE_URL` to match (e.g. `https://main.xxx.amplifyapp.com/customer`). The backend builds links as `{CUSTOMER_BASE_URL}/pay/{token}` by default.

### Removed

- `/demo/logs` – Replaced by Supabase `transactions` table (query via API or Supabase dashboard)
