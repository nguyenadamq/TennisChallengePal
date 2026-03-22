# Tennis Challenge Pal

Tennis Challenge Pal is now structured as a Supabase-backed fullstack ladder app:

- `frontend/`: Vite + React client
- `supabase/migrations/0001_tennis_challenge_pal.sql`: database schema, RLS, RPCs, and realtime setup
- `supabase/migrations/0002_usernames_friends_doubles.sql`: usernames, friends, notifications, doubles teams, and partner-confirmation workflow
- `supabase/migrations/0003_username_policy_and_reset.sql`: required username policy plus destructive removal of existing signed-up users
- `supabase/migrations/0004_fix_ladder_limit_ambiguity.sql`: resolves the duplicate ladder-limit function issue during admin approvals
- `supabase/migrations/0005_fix_notification_signature.sql`: fixes notification creation when admin approvals or rejections send updates
- `supabase/migrations/0006_fix_friend_request_status_cast.sql`: fixes accepting or declining friend requests when enum status writes were treated as text
- `supabase/migrations/0007_allow_partner_to_read_ladder_requests.sql`: lets invited doubles partners actually see pending partner invites in the app

Use the setup instructions in this file and `frontend/README.md` to connect the app to your Supabase project.

## What It Supports

- Email/password signup and login
- `admin` and `user` roles
- Five live leaderboards:
  - Mens Singles
  - Mens Doubles
  - Mixed Doubles
  - Womens Singles
  - Womens Doubles
- Admin actions to add, remove, and move players on each ladder
- User requests to join a ladder or challenge for a higher spot
- Admin review queue for pending requests
- Supabase realtime updates so the boards refresh live
- Unique usernames for user search
- Friend requests and friend lists
- Doubles requests that require a friend to accept before admins can review them

## Supabase Setup

1. Create a new Supabase project.
2. In the Supabase dashboard, open the SQL editor.
3. Run the SQL from `supabase/migrations/0001_tennis_challenge_pal.sql`.
4. Then run the SQL from `supabase/migrations/0002_usernames_friends_doubles.sql`.
5. Then run the SQL from `supabase/migrations/0003_username_policy_and_reset.sql`.
6. Then run the SQL from `supabase/migrations/0004_fix_ladder_limit_ambiguity.sql`.
7. Then run the SQL from `supabase/migrations/0005_fix_notification_signature.sql`.
8. Then run the SQL from `supabase/migrations/0006_fix_friend_request_status_cast.sql`.
9. Then run the SQL from `supabase/migrations/0007_allow_partner_to_read_ladder_requests.sql`.
10. In `Authentication > Providers`, keep `Email` enabled.
11. In `Authentication > URL Configuration`, add:
   - `http://localhost:5173` as a site URL for local development
   - `http://localhost:5173/**` as an additional redirect URL if you want email confirmation links to return to the app
12. Copy your project URL and anon key from `Project Settings > API`.
13. Create `frontend/.env` using `frontend/.env.example`.

Example:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Create The First Admin

Signup in the app normally first. Then, in the Supabase SQL editor, run:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

After logging out and back in, that account will see the admin console.

## Optional Self-Promotion To Admin

Users can now promote themselves from the profile settings area if they know a shared admin promotion password.

Set that password once in the Supabase SQL editor:

```sql
insert into public.admin_promotion_secrets (id, password_hash)
values (true, extensions.crypt('your-shared-admin-password', extensions.gen_salt('bf')))
on conflict (id) do update
set password_hash = excluded.password_hash;
```

Important notes:

- The plaintext password is never stored in the database.
- The frontend sends the entered password to a protected Supabase RPC.
- The RPC compares it against the stored bcrypt hash using `extensions.crypt(...)`.
- If it matches, only the currently logged-in user is promoted to `admin`.

If you do not want this feature, simply do not insert a row into `public.admin_promotion_secrets`.

## Email Confirmation

You have two options:

- Fastest local setup: disable email confirmation in Supabase so new accounts sign in immediately after signup.
- Production-friendly setup: leave confirmation on and configure SMTP in `Authentication > SMTP Settings`.

If email confirmation stays enabled and SMTP is not configured, Supabase's default email delivery limits may affect signup testing.

## Local Run

```bash
cd frontend
npm install
npm run dev
```

## Product Assumption

Singles ladders are individual entries. Doubles ladders are now team entries, so if someone drops a doubles ladder as part of a new request, the whole team entry is removed when that new request is approved.

## SQL Injection Safety

This app is built to avoid SQL injection:

- The React app uses the Supabase client query builder and RPC calls, not raw string-concatenated SQL.
- The database functions in [0001_tennis_challenge_pal.sql](C:\Users\User\Documents\GitHub\TennisChallengePal\supabase\migrations\0001_tennis_challenge_pal.sql) do not use dynamic SQL like `execute`.
- User input is passed as typed function parameters into Postgres.
- Role-sensitive operations such as admin promotion, entry moves, request approval, and manual ladder changes are done through protected `security definer` functions with explicit checks.
## Username Rules

Usernames are now created during signup and are enforced in both the app and the database:

- Required at signup
- Must be unique
- Must use 3-24 lowercase letters, numbers, or underscores
- Cannot be only numbers
- Cannot start with `player_`
- Cannot contain blocked admin/reserved/inappropriate terms

## Destructive Reset

Running [0003_username_policy_and_reset.sql](C:\Users\User\Documents\GitHub\TennisChallengePal\supabase\migrations\0003_username_policy_and_reset.sql) deletes all currently signed-up users from `auth.users`.

That means:

- Existing accounts are removed
- Their related profiles, ladder requests, friendships, notifications, and ladder memberships are removed through cascading deletes
- Everyone will need to sign up again with a valid username
