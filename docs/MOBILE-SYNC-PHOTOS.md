# Mobile chat sync, session and photo contracts

- Authenticated GET /session returns the existing sanitized user DTO without coding-statistics enrichment. Profile GET routes retain enrichment.
- Existing GET /chat/:targetUserId remains unchanged for old/web clients. Optional sync=1 returns {messages, cursor, hasMore, hasEarlier, reset}; defaults to the last 300 messages. after=<24-character ID> returns the next page after that ID. before=<ID> returns an earlier page. after and before are mutually exclusive. Invalid cursors return 400; a missing known cursor resets to recent history. Existing accepted-connection/JWT authorization runs first. Server-side embedded document read is unchanged, while mobile response transfer is bounded.
- Authenticated GET /profile/photo/upload-signature returns signed image parameters for the current user's devtinder/avatars namespace, allowed JPG/JPEG/PNG/WebP formats and a 1024px limiting transform.
- PATCH /profile/photo accepts publicId, numeric version, provider response signature and image format. The response signature and user prefix must verify; the server generates the Cloudinary delivery URL and saves it. Client-provided URLs are not trusted by this new route. Existing profile/edit remains compatible with older clients.
- The chooser enforces a 5 MB client limit. Signed allowed formats/type and the provider transformation constrain the upload, but this is not a new global media-quota/rate-limiting system. Orphan avatar cleanup is deferred.

Tests: 46 Node tests passed, including photo signature/ownership and chat windows, plus prior auth/resume/push regressions. No production DB test records or media were created by tests. Final real-device/provider upload test remains with the owner.
