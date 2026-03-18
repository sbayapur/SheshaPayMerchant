-- Transactions table for payment lifecycle events (replaces in-memory webhook logs)
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  type text not null,
  timestamp timestamptz not null default now(),
  payment_intent_id text,
  order_id text,
  status text,
  provider text,
  amount numeric,
  currency text default 'ZAR',
  iso20022_meta text,
  settlement_ref text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_payment_intent_id on public.transactions(payment_intent_id);
create index if not exists idx_transactions_timestamp on public.transactions(timestamp desc);
create index if not exists idx_transactions_order_id on public.transactions(order_id);

-- RLS enabled; backend uses service_role key which bypasses RLS
-- Add policies when you scope by merchant_id / user_id
alter table public.transactions enable row level security;
