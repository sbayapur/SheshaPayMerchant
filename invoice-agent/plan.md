# AI Invoice Agent — Plan

## Overview
Chat-style invoice generation for Craig (Durban Plumbing). Craig describes a job in natural language; Claude parses it into a structured invoice; the invoice is emailed to the customer via Resend.

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4
- Supabase (invoices table)
- Anthropic API — claude-sonnet-4-6
- Resend (transactional email)
- AWS Amplify (deployment, Root Directory = invoice-agent/)

## Steps

| # | Step | Status |
|---|------|--------|
| 1 | Scaffold sub-app, deps, config | ✅ Done |
| 2 | Supabase schema | ✅ Done (run manually) |
| 3 | Chat UI shell | ✅ Done |
| 4 | /api/parse-invoice (Claude) | ✅ Done |
| 5 | Invoice preview card | ✅ Done (in step 3/4) |
| 6 | /api/send-invoice + Resend | ⏳ Next |
| 7 | Public /invoice/[id] page | ⏳ Pending |
| 8 | /sent invoices list | ⏳ Pending |

## Routes
- `/`              — Chat interface (Craig)
- `/sent`          — Sent invoices table
- `/invoice/[id]`  — Public customer invoice page
- `/api/parse-invoice` — POST: Claude parsing
- `/api/send-invoice`  — POST: save + email

## Environment Variables
See `.env.local.example`

## Amplify Deployment
- Connect repo in Amplify console
- Set **App root directory** = `invoice-agent`
- Add all env vars from `.env.local.example` under Environment variables
- Framework: Next.js (Amplify detects automatically)

## Database
One table: `invoices`
```sql
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     text not null default 'craig-demo',
  customer_name   text not null,
  customer_email  text not null,
  line_items      jsonb not null,
  subtotal        numeric(10,2) not null,
  total           numeric(10,2) not null,
  due_date        date not null,
  status          text not null default 'sent',
  created_at      timestamptz not null default now()
);
```
