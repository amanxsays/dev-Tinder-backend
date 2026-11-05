# Resume upload configuration

The backend signs direct-to-Cloudinary uploads. Render must set all three values from one active product environment: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Do not include surrounding literal quotes in dashboard values. Keep the secret in local ignored `.env` and Render environment settings, never in a frontend build or Git.

Missing or malformed settings now return a safe 503 before issuing a signature with an invalid cloud URL. `npm run cloudinary:check` performs an authenticated, read-only Cloudinary ping; it uploads/deletes no files and does not print secret values. The local configured cloud/key pair passed this check.

The reported production `cloud_name is disabled` upload failure was resolved by correcting Render's environment settings; the owner confirmed uploads work after redeployment. Active API keys in the Cloudinary console do not prove Render uses the matching cloud/key pair. If an actual product environment is disabled, restore it with Cloudinary rather than retrying uploads indefinitely. Rotate any secret accidentally shared in chat/screenshots and update both local and deployed values privately.

Existing resume replacement still saves the new record before retiring the previous asset. A failed upload must not call the save endpoint or delete the old resume. Tests cover credential guards and existing resume lifecycle behavior.
