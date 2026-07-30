# Set up

To set up and run this project locally or deploy the project, please refer to docs/set_up.md.

## Prerequisite

Before setup, create or have access to:

1. A Supabase project.
2. A Google Cloud project for the Google OAuth client.
3. Node.js and npm.
4. A Git repository.
5. A Vercel account for production deployment.

Only Supabase owns application sessions and users. Google Cloud supplies the
Google OAuth identity. Vercel only hosts the React application.

Supabase persists a normal session in browser storage, so closing and reopening a
tab restores the same MiniTrello account automatically. After an explicit
**Sign out** or successful account deletion, the next **Continue with Google**
request adds Google's `prompt=select_account`; this lets the person choose a
different Gmail instead of silently reusing the Chrome profile's last account.
The chooser flag is consumed after that one login attempt.

## 1. Install the project

Clone the repository and install dependencies:

```bash
git clone YOUR_REPOSITORY_URL
cd MiniTrello
npm install
```

## 2. Create the Supabase database

Open the Supabase project, then go to:

```text
SQL Editor → New Query
```

Copy all of [`supabase/schema.sql`](supabase/schema.sql), paste it into the SQL
Editor and select **Run**.

> **Warning:** `schema.sql` is the complete destructive development schema. It
> deletes and recreates MiniTrello tables and therefore resets all MiniTrello
> application data. It does not delete rows from Supabase `auth.users`.

The schema creates:

- application users, roles, workspaces and workspace memberships;
- columns, tasks, labels, task-label relationships and task assignees;
- authenticated RPC functions for all mutations;
- RLS policies for members and Super Admin;
- automatic public-profile creation for new Auth users;
- safe account-deletion rules for personal and shared workspaces;
- Realtime publication and replica identity configuration.

Run this complete file during development while data can be reset. For an
existing production database with real data, use a reviewed migration instead
of rerunning the destructive schema.

## 3. Get the Supabase browser values

In Supabase, open the project's API settings and copy:

- **Project URL**
- **Publishable key** or legacy **anon public key**

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

The publishable/anon key is designed for browser use because RLS protects the
database. Never use a secret key or `service_role` key in a `VITE_*` variable.

`.env.local` is ignored by Git. The committed [`.env.example`](.env.example)
contains placeholders only.

## 4. Create the Google OAuth application

Open [Google Cloud Console](https://console.cloud.google.com/) and select the
Google Cloud project that will own MiniTrello's OAuth client.

### 4.1 Configure the consent screen

Open:

```text
Google Auth Platform → Branding
```

Set at least:

- App name: `MiniTrello`
- User support email
- Developer contact email

Then open:

```text
Google Auth Platform → Audience
```

For personal development, use **External** and add the Gmail accounts that will
test the app if the application is still in testing mode. Production publication
or Google verification depends on the audience and scopes used by the project.

MiniTrello only needs the normal Google identity information provided by the
`openid`, `email` and `profile` scopes.

### 4.2 Copy the Supabase callback URL

Before creating the Google client, open:

```text
Supabase → Authentication → Sign In / Providers
→ Supabase Auth → Google
```

Copy the **Callback URL (for OAuth)** displayed by Supabase. It has this form:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Google must redirect to this Supabase URL—not directly to localhost or Vercel.

### 4.3 Create a Google web client

Return to Google Cloud and open:

```text
Google Auth Platform → Clients → Create client
```

Choose **Web application**.

Add these **Authorized JavaScript origins**:

```text
http://localhost:5173
https://mini-trello-bice.vercel.app
```

Add the Supabase callback copied above as the **Authorized redirect URI**:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Create the client and securely copy its:

- Client ID
- Client Secret

The downloaded Google client JSON is not needed by the React app. Do not place
that JSON or the Client Secret in this repository, `.env.local`, or Vercel
frontend environment variables. The Client Secret is entered only in the
Supabase provider configuration.

## 5. Enable Google login in Supabase

Return to:

```text
Supabase → Authentication → Sign In / Providers
→ Supabase Auth → Google
```

Then:

1. Turn on **Enable Sign in with Google**.
2. Paste the Google **Client ID**.
3. Paste the Google **Client Secret**.
4. Keep **Skip nonce checks** disabled.
5. Keep **Allow users without an email** disabled.
6. Select **Save**.

MiniTrello's Account page can replace a login Gmail by linking another Google
identity to the same Supabase UUID. Enable **Allow manual linking** in the
Supabase Auth configuration before testing that feature.

If the new Gmail already belongs to another Supabase user, MiniTrello rejects the
change instead of merging two active accounts.

## 6. Configure local and production redirects

Open:

```text
Supabase → Authentication → URL Configuration
```

Use the following values.

### Site URL

```text
https://mini-trello-bice.vercel.app
```

### Redirect URLs

```text
http://localhost:5173/**
https://mini-trello-bice.vercel.app/**
```

The local redirect keeps development login working even though the default Site
URL points to production.

If Google login returns to `localhost` after a production login, either the
production URL is missing from this Supabase allow-list or the deployed app is
still using an old Supabase project/environment value.

## 7. Run locally

Start Vite:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Test the following before deployment:

1. Select **Continue with Google**.
2. Confirm the redirect returns to `localhost:5173`.
3. Confirm a row exists in Supabase **Authentication → Users**.
4. Confirm a matching row exists in `public.users`.
5. Create a workspace and task.
6. Open another browser or incognito session, join the workspace and verify live
   task updates.

Create a production build locally:

```bash
npm run build
```

Optionally preview that build:

```bash
npm run preview
```

## 8. Grant Super Admin

The target Gmail must sign in once so its `public.users` row exists. Then run this
separately in the Supabase SQL Editor:

```sql
update public.users
set global_role = 'super_admin'
where lower(email) = lower('admin@gmail.com');
```

Replace the example Gmail with the real account. There is intentionally no
frontend operation that grants or removes `global_role`.

A Super Admin:

- sees every workspace on the dashboard;
- can open and administer every workspace;
- has effective admin permission without requiring membership;
- cannot be demoted or removed through Workspace Settings.

## 9. Deploy to Vercel

### 9.0 Deploy the account-deletion Edge Function

Account deletion cannot run in browser code because deleting a Supabase Auth user
requires a server-side secret. Deploy the committed Edge Function to the same
Supabase project.

Git push and Vercel deployment only publish the React frontend. They do **not**
publish `supabase/functions/`. The account-deletion function is a separate
server-side deployment hosted by Supabase.

From the repository root, initialize the Supabase CLI configuration once if
`supabase/config.toml` is missing:

```bash
npx supabase@latest init
```

Then authenticate, link this repository to the MiniTrello Supabase project and
deploy the function:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref kzettvldsabiekawcryj
npx supabase@latest functions deploy delete-account
```

Supabase-hosted Edge Functions receive `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` as server-only environment variables. Do not copy the
service-role key into React, `.env.local`, GitHub or Vercel.

The function verifies the bearer token itself and only deletes the user ID from
that token. The frontend cannot submit an arbitrary target user ID.

After deployment, verify that **Supabase Dashboard → Edge Functions** contains
`delete-account`. Reload MiniTrello and test with a disposable account. No Vercel
redeployment is required when only this function is deployed.

Deployment frequency:

- React/UI change: push Git and let Vercel redeploy.
- `supabase/schema.sql` change: apply the SQL to Supabase.
- `supabase/functions/delete-account/index.ts` change: run the function deploy
  command again.

### 9.1 Before pushing

Run:

```bash
npm run build
git status
```

Confirm that none of these are staged or committed:

- `.env.local`
- Google OAuth client JSON
- Google Client Secret
- Supabase secret or `service_role` key

Commit and push the source code to the Git provider connected to Vercel.

### 9.2 Import the project

In Vercel:

1. Select **Add New → Project**.
2. Import the MiniTrello Git repository.
3. Keep the detected framework as **Vite**.
4. Keep the build command as `npm run build`.
5. Keep the output directory as `dist`.

The committed [`vercel.json`](vercel.json) rewrites nested React routes such as
`/login`, `/account` and `/workspace/:id` to `index.html`.

### 9.3 Add Vercel environment variables

In:

```text
Vercel Project → Settings → Environment Variables
```

Add:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Apply them to Production and any Preview/Development environments that should
connect to this Supabase project.

Do not add the Google Client Secret to Vercel. Supabase—not the React
application—uses that secret.

### 9.4 Deploy

Select **Deploy**. If environment variables are added or changed after a build,
create a new deployment because Vite injects `VITE_*` variables at build time.

The current production domain is:

```text
https://mini-trello-bice.vercel.app
```

If Vercel assigns a different production domain later, update all three places:

1. Supabase **Site URL**.
2. Supabase **Redirect URLs**.
3. Google OAuth **Authorized JavaScript origins**.

The Google **Authorized redirect URI** remains the Supabase
`/auth/v1/callback` URL.

## 10. Production verification

After deploying:

1. Open the production URL in a normal browser.
2. Sign in with Google and confirm the browser returns to the Vercel domain.
3. Open a direct nested URL such as `/account` and refresh it.
4. Create a workspace and task.
5. Open the same workspace in another browser/account.
6. Create, edit, move and delete a task and confirm the other browser updates
   without refreshing.
7. Switch to another tab and return; the board should remain visible without
   showing full-screen **Loading MiniTrello**.
8. Test Gmail identity linking only with a Google account that does not already
   own another MiniTrello account.
9. With a disposable account, open **My Account → Delete account**, enter its
   Gmail and confirm that it disappears from both `auth.users` and
   `public.users`.

## Account deletion behavior

Deleting an account permanently removes its Supabase Auth login and public
MiniTrello profile:

- a workspace containing only that user is permanently deleted;
- in a shared workspace with another admin, the user leaves and ownership is
  reassigned when necessary;
- remaining admins receive a persistent Realtime notification that the user
  deleted their account and left; each admin dismisses their own copy;
- deletion is blocked when the user is the last admin of a workspace that still
  has other members;
- a `super_admin` must first be demoted with privileged SQL.

After a successful server deletion, MiniTrello also clears the browser session
immediately. This matters because an already-issued access token can otherwise
remain valid until it expires.

## Realtime architecture

All board mutations run through authenticated PostgreSQL RPC functions. The
schema publishes these tables to `supabase_realtime`:

```text
users
workspaces
workspace_members
columns
tasks
labels
task_labels
task_assignees
```

React subscribes to Postgres Changes through a Supabase Realtime WebSocket. RLS
still controls what each signed-in user can read.

Task assignment is metadata, not a visibility filter. Every workspace member can
still read every task. Add Task and Task Detail send `assignee_ids` through the
transactional board RPC; Task Detail saves task fields, labels and assignees
together. The `task_assignees` foreign keys only accept real members of the same
workspace, so the virtual Super Admin row cannot be assigned. Removing a member
or deleting a task automatically removes the corresponding assignments.

There is no periodic polling or 1.5-second automatic reload. Returning to a tab
may refresh the Supabase token, but a refresh for the same UUID updates silently
without clearing the board or rebuilding its Realtime subscriptions.

## Trash behavior

Deleting a task moves it to Trash. Deleting a column first moves that column's
tasks to Trash and then removes the column.

Users can restore a task into an existing column or empty Trash permanently.
Opening a board also removes tasks that have remained in Trash for more than 30
days.

For scheduled cleanup even when nobody opens the board, configure Supabase Cron
to run:

```sql
select public.empty_taskflow_trash_older_than_30_days();
```

An optional cron example is commented at the bottom of
[`supabase/schema.sql`](supabase/schema.sql).

## Common errors

### `Unsupported provider: provider is not enabled`

The Google provider is disabled or its settings were not saved in Supabase.
Enable Google under **Authentication → Sign In / Providers → Supabase Auth**.

### Login redirects to localhost in production

Set the Supabase Site URL to the production domain and add
`https://mini-trello-bice.vercel.app/**` to Redirect URLs. Then redeploy if the
Vercel environment variables were changed.

### `redirect_uri_mismatch`

The Google OAuth client's Authorized redirect URI does not exactly match the
Supabase callback URL. Copy the callback directly from the Supabase Google
provider screen.

### A nested Vercel route returns 404

Confirm [`vercel.json`](vercel.json) is committed and redeploy.

### Gmail cannot be connected

- Selecting the current Gmail is not a login change.
- A Gmail already owned by another Supabase user cannot be linked.
- Supabase manual identity linking must be enabled.

### Changes appear only after refreshing

Run the current schema, confirm the tables are included in the
`supabase_realtime` publication, and test with two authenticated users who are
allowed to read the same workspace under RLS.

## Security rules

- Never commit `.env.local`.
- Never expose a Supabase secret or `service_role` key in frontend code.
- Never commit or deploy the Google Client Secret or OAuth client JSON.
- Never trust an actor UUID supplied by the browser.
- All authenticated database functions derive identity from `auth.uid()`.
- Email is used for lookup and display; stable relationships use UUIDs.
- Global Super Admin changes are database-operator actions only.
