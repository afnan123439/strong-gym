# Strong Gym commercial operations

## Required GitHub secrets

Repository → Settings → Secrets and variables → Actions:

- `SUPABASE_DB_URL`: the encoded direct database connection string from Supabase.
- `BACKUP_ENCRYPTION_KEY`: a long unique passphrase kept outside GitHub as the restore key.
- `E2E_MANAGER_EMAIL` and `E2E_MANAGER_PASSWORD`: a dedicated active manager test account.
- `E2E_MEMBER_EMAIL` and `E2E_MEMBER_PASSWORD`: a dedicated active member test account.

Never place these values in source files or commits.

## Automated quality checks

GitHub runs static, integration, live deployment, and authenticated role/RLS tests on every push and pull request. Authenticated tests are clearly marked as skipped until all four E2E secrets are configured.

## Automated backup

The scheduled workflow creates a logical Supabase database dump every day at 02:17 UTC, encrypts it with AES-256 before upload, deletes the plaintext dump, and retains each encrypted GitHub Actions artifact for 30 days. It can also be started manually from Actions → Daily Supabase backup → Run workflow.

Test restoration into a separate Supabase project at least once per quarter. A backup that has never been restored is not considered verified.

## Client error monitoring

Authenticated dashboard pages record sanitized JavaScript errors and rejected promises in `public.client_errors`. Email addresses and phone-like values are removed in the browser before transmission. Only managers can read the error records; users can only insert records tied to their own account.
