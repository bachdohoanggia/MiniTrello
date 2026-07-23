# Supabase Google Auth and global Super Admin

## Resulting behavior

- `/login` uses **Continue with Google** through Supabase Auth.
- First login creates one row in `auth.users` and one matching `public.users` row.
- The same UUID owns memberships, workspaces and global privilege.
- Regular users see only joined workspaces; Super Admin sees and administers all.
- Workspace Settings cannot demote or remove a global Super Admin.
- Realtime uses the native Supabase `authenticated` JWT role and RLS.
- Login Gmail changes through Google identity linking, with no transfer code.

## Supabase and Google setup

1. In Supabase open **Authentication → Sign In / Providers → Supabase Auth → Google**.
2. Copy the callback URL shown by Supabase.
3. In Google Cloud open **Google Auth Platform → Clients** and create a Web
   application OAuth client.
4. Add `http://localhost:5173` and the production domain under Authorized
   JavaScript origins.
5. Add the Supabase callback URL under Authorized redirect URIs.
6. Copy the Google Client ID and Client Secret into the Supabase Google provider,
   enable it and save.
7. In **Authentication → URL Configuration**, set the production Site URL and add
   `http://localhost:5173/**` plus the Vercel preview/production URLs to Redirect URLs.
8. In Auth configuration enable **Allow manual linking**. Account Settings needs
   this to attach a second Google identity to the current user.
9. Run the complete destructive `supabase/schema.sql` once.

## Environment

Only these browser variables are required:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

The publishable/anon key is expected in frontend code. Never expose a service-role
or secret key.

## Gmail replacement

1. The signed-in user opens Account Settings.
2. **Connect another Google account** calls `supabase.auth.linkIdentity()`.
3. Google redirects back to `/account`; both identities now point to one
   `auth.users.id`.
4. The user selects the new Gmail.
5. `select_google_login_identity(identity_id)` verifies that `auth.identities`
   contains that Google identity for `auth.uid()`, then updates the public email and
   avatar.
6. The client unlinks the old Google identity. Workspace and role foreign keys do
   not change because the Supabase user UUID never changed.

Supabase refuses identity linking if the target Google account already belongs to
another Supabase user. MiniTrello does not merge two active accounts.

## Promote a Super Admin

The Gmail must sign in once before its public profile exists. Then run separately:

```sql
update public.users
set global_role = 'super_admin'
where lower(email) = lower('admin@gmail.com');
```

There is no frontend RPC that changes `global_role`.

## Safe Firebase shutdown order

Do not disconnect Firebase until Supabase Google login has worked locally.

1. Enable and test Supabase Google provider.
2. Run `supabase/schema.sql`. This intentionally resets MiniTrello application data;
   old Firebase users are not migrated.
3. Remove the four `VITE_FIREBASE_*` variables from `.env.local` and restart Vite.
4. Sign in through MiniTrello and confirm the user appears under Supabase
   **Authentication → Users**.
5. Test two browsers on one workspace and confirm task changes arrive through
   Realtime without polling.
6. Remove `VITE_FIREBASE_*` variables from Vercel before the next deployment.
7. In Supabase **Third-Party Auth**, delete the Firebase integration.
8. In Firebase Console disable Google Authentication or delete the Firebase web app.
   Delete the whole Firebase project only if nothing else uses it.

The repository no longer imports Firebase and no longer contains the Firebase npm
package, client configuration or Third-Party JWT workaround.

## Behavior-to-code map

| Behavior | Implementation |
|---|---|
| Google login/session/logout | `src/AuthContext.jsx` |
| Authenticated routing | `src/RootApp.jsx` |
| Account identity linking | `src/components/AccountPage.jsx` |
| Google identity verification | `public.select_google_login_identity` in `supabase/schema.sql` |
| Automatic app profile | `public.handle_new_auth_user` trigger plus `ensure_current_user` |
| Caller identity | `public.current_app_user()` → `auth.uid()` |
| Super Admin authorization | `public.is_super_admin()` and workspace assertion helpers |
| Realtime RLS | authenticated policies and `supabase_realtime` publication |
