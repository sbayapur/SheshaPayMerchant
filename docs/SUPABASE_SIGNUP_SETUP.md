# Supabase Email Sign-Up Setup

Step-by-step guide to enable users to sign up via email in your Shesha Merchant app.

---

## Step 1: Open Your Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (or create one if you don't have it yet)

---

## Step 2: Enable Email Provider

1. In the left sidebar, click **Authentication**
2. Click **Providers**
3. Find **Email** in the list
4. Make sure it's **enabled** (toggle should be on)

---

## Step 3: Configure Email Confirmation (Choose One)

### Option A: Require email confirmation (more secure)

1. Still in **Authentication** → **Providers** → **Email**
2. Turn **ON** → "Confirm email"
3. Users must click a link in their inbox before they can sign in
4. Supabase sends the confirmation email automatically

### Option B: Skip confirmation (easier for testing)

1. Turn **OFF** → "Confirm email"
2. Users can sign in immediately after creating an account
3. Good for local/dev use; consider enabling confirmation for production

---

## Step 4: Add Site URL (for confirmation links)

If you're using email confirmation:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your app URL, e.g.:
   - Local: `http://localhost:5173`
   - Production: `https://your-app.com`
3. Add **Redirect URLs** if needed (e.g. `http://localhost:5173/**` for local dev)

---

## Step 5: (Optional) Customize Auth Emails

1. Go to **Authentication** → **Email Templates**
2. You can edit the confirmation email text if needed
3. Default template works fine for most cases

---

## Step 6: Test the Flow

1. Start your app: `npm run dev`
2. Go to the merchant dashboard (login screen)
3. Click **Sign up**
4. Enter email and password (min 6 characters)
5. Click **Create account**
6. If confirmation is ON: check email and click the link, then sign in
7. If confirmation is OFF: you should be signed in right away

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` |
| Emails not arriving | Check spam; verify SMTP in Project Settings → Auth |
| "User already registered" | Use Sign in instead, or try a different email |
| Confirm link goes nowhere | Add your URL to Redirect URLs in Auth settings |
