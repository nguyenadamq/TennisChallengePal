# Tennis Challenge Pal

Tennis Challenge Pal is a Next.js + Supabase application for club tennis:

- Intro, register, and username login
- Required profile fields: username, email, first name, last name, sex, and age group
- Multi-club membership with unique club names and password-protected joins
- Club presidents, officers, and members
- Club-scoped ladder rankings, requests, doubles partner confirmation, and officer tools
- Exact username social search, friend requests, and friend lists
- Court finder posts for public, friends, selected clubs, and direct friend invites
- In-app notifications with global and per-tab unread counts

## Fresh Supabase Setup

Use a new Supabase project and run one schema file:

1. Create a new Supabase project.
2. Open `SQL Editor`.
3. Run the full SQL script in [supabase/fresh_database.sql](supabase/fresh_database.sql).
4. In `Authentication > Providers`, keep `Email` enabled.
5. For fast local testing, disable email confirmation. For production, keep it enabled and configure SMTP.
6. In `Project Settings > API`, copy:
   - Project URL
   - Anon public key
   - Service role key
7. Create `frontend/.env` from [frontend/.env.example](frontend/.env.example).

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not expose it in client code or commit a real `.env`.

## Local Run

```bash
cd frontend
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173).

## SQL Safety Notes

- Passwords are handled by Supabase Auth.
- Club passwords are stored with `extensions.crypt(...)` bcrypt hashes.
- User actions go through allowlisted Next.js API routes and typed Supabase RPC calls.
- Row-level security is enabled on application tables.
- Server-only dashboard reads use the Supabase service role key after validating the user's JWT.
- Club names and usernames are both unique case-insensitively.

## Important

This project includes older migration files from a previous ladder-only version. For a completely fresh database matching the current app, use [supabase/fresh_database.sql](supabase/fresh_database.sql) instead of the legacy migration stack.
