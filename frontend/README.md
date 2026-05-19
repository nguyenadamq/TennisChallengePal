# Tennis Challenge Pal Frontend

Next.js app router frontend for Tennis Challenge Pal.

## Environment

Create `frontend/.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service role key is used only by server routes for username login and filtered dashboard reads.

## Run

```bash
npm install
npm run dev
```

Local URL: [http://localhost:5173](http://localhost:5173)
