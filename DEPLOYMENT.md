# HealthThread deployment checklist

## Supabase configuration

1. Create or select the production Supabase project and configure the frontend environment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Keep the service-role key out of frontend environment variables, source control, and client bundles. The account-deletion Edge Function requires the server-side `SUPABASE_SERVICE_ROLE_KEY`; confirm it is available as an Edge Function secret in the target project.
3. Link the Supabase CLI to the intended project and apply all migrations:

   ```powershell
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   Review the migration plan before applying it to a production database. The migrations create owner-scoped table policies, a private `health-documents` bucket with a 10 MiB file limit and PDF/JPEG/PNG/WebP MIME allowlist, and storage path policies.
4. Deploy the account-deletion function with JWT verification enabled:

   ```powershell
   supabase functions deploy delete-account
   ```

   The function validates the caller's access token, removes that user's objects from the private bucket, then deletes the Auth user (which cascades the user's database rows). Storage removal is batched and retryable if a prior attempt partially completed. Do not expose the service-role key to the browser.
5. In Supabase Auth settings, configure the production site URL and allowed redirect URLs, including `<production-origin>/reset-password`. Set email confirmation and password policies to the intended production requirements.
6. Configure production HTTPS, backups/retention, monitoring, and an operational support route for account-deletion failures before enabling real user data.

## Verification before launch

- Use two separate test accounts to verify that each account can only read, insert, update, and delete its own profile, health records, medications, vaccinations, appointments, and menstrual logs.
- Verify the storage bucket is private; test own-folder access, cross-user denial, disallowed MIME types, and uploads above 10 MiB.
- Verify the deployed deletion function rejects unauthenticated and stale-session requests, removes nested files and relational data, deletes the Auth user, and clears the current browser session. The UI also requires password confirmation.
- Test sign-up with email confirmation enabled and disabled, sign-in, sign-out, password reset, onboarding/profile updates, data export, and page CRUD against the production-like Supabase project.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in CI or the release environment.

## Current implementation boundaries

- The application has a private storage bucket and row-level storage policies, but no file-upload or document-management UI is currently wired to it. Upload functionality still needs an authenticated UI that writes only to `<user-id>/<file-name>` and a documents metadata row.
- JSON export contains profile and database records, including document metadata, but not uploaded file contents.
- This repository has not applied its migrations to a live Supabase project or deployed the Edge Function. Authentication, RLS, storage behavior, and deletion must be verified against the target project before launch.
