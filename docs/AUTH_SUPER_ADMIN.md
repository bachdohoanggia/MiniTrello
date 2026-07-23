# Supabase Google Auth and global Super Admin

## Resulting behavior

- `/login` uses **Continue with Google** through Supabase Auth.
- First login creates one row in `auth.users` and one matching `public.users` row.
- The same UUID owns memberships, workspaces and global privilege.
- Regular users see only joined workspaces; Super Admin sees and administers all.
- Workspace Settings cannot demote or remove a global Super Admin.
- Realtime uses the native Supabase `authenticated` JWT role and RLS.
- Login Gmail changes through Google identity linking, with no transfer code.
- Token refresh for the same Supabase UUID is silent when a tab regains focus.

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

If a production redirect falls back to localhost, the production `redirectTo`
URL is missing from the Supabase Redirect URLs allow-list. Do not replace the
Google Authorized redirect URI with the Vercel URL; Google must continue to use
the Supabase `/auth/v1/callback` URL.

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
2. **Connect new login Gmail** calls `supabase.auth.linkIdentity()`. In the Google
   popup the user selects the new Gmail, not the current Gmail.
3. Google redirects back to `/account`; both identities now point to one
   `auth.users.id`.
4. The user selects the new Gmail.
5. The client sends Supabase `UserIdentity.identity_id` (not the provider-facing
   `id`). `select_google_login_identity(identity_id)` compares it with
   `auth.identities.id::text`, verifies ownership by `auth.uid()`, then updates the
   public email and avatar.
6. The client unlinks the old Google identity. Workspace and role foreign keys do
   not change because the Supabase user UUID never changed.

Supabase refuses identity linking if the target Google account already belongs to
another Supabase user. MiniTrello does not merge two active accounts. Account
Settings maps callback errors to explicit messages for selecting the current Gmail,
selecting a Gmail owned by another MiniTrello account, or disabled manual linking.
After a new identity is connected, the Step 1 button disappears and the UI directs
the user to choose the Gmail to keep.

## Session restoration and tab focus

`AuthContext` bootstraps the profile once per real Supabase user UUID. Repeated
`SIGNED_IN` or `TOKEN_REFRESHED` events for the same UUID update the session
silently without calling `ensure_current_user()` again.

`RootApp` keys workspace loading and its context channel by primitive values
(`userId`, `profileId`, `routeName`, `workspaceId`) rather than session objects.
Therefore returning to a tab does not clear `workspaceContext`, display
**Loading MiniTrello**, or rebuild Realtime channels. Initial workspace entry,
workspace switching and real account switching still use full-screen loading.

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
   Keep the underlying Google Cloud project if it contains the OAuth client now
   used by Supabase Google login.

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
| Silent same-user token refresh | prepared Supabase UUID in `src/AuthContext.jsx` |
| Stable workspace loading | primitive UUID/route dependencies in `src/RootApp.jsx` |
