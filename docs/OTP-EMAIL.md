# OTP email delivery

The legacy mailserver.automationlounge.com endpoint failed its TLS handshake (EPROTO / unrecognized name) during read-only diagnosis on 6 November 2026, before any email could be accepted. No real email was sent in testing.

The OTP flow now normalizes email, generates codes securely, confirms provider acceptance before reporting success and removes pending codes after send failure. Pending concurrent requests cannot claim successful delivery. Resend cooldown is two minutes; code expiry is five minutes, enforced during signup independently of Mongo TTL cleanup. Failed sends no longer advance the frontend, and changing the recipient resets verification.

## Free HTTPS delivery using Brevo on the existing Node Render service

1. Create a Brevo account and complete its account/transactional-email activation requirements.
2. Add and verify a sender email you control. Free-email senders may be rewritten to Brevo's compliant domain. A custom domain is recommended for reputation but not required for this setup.
3. Create an API key privately (not an SMTP key).
4. Add to the existing Node Render service, then Save and deploy:

```
EMAIL_PROVIDER=brevo
EMAIL_FROM=<verified sender email>
BREVO_API_KEY=<private API key>
```

Keep secrets out of Git, frontend variables and chat. No Spring settings change, SMTP port, new dependency or new deployment service is needed. Until explicitly configured, the legacy promail provider remains selected. The Brevo API request uses HTTPS and a 20-second timeout. Provider failure logs contain only provider/status/safe error code, never credentials or OTP bodies.

5. Request an OTP from the web signup form for an email you control. Check inbox/spam and transactional logs, enter it, and verify signup. Test resend and incorrect/expired codes before rebuilding Android. API acceptance does not prove inbox delivery.

The current free plan includes 300 sends per day shared by OTP, welcome and other app mail. Provider activation, limits and spam filtering may affect delivery. Real email delivery remains pending your verified sender/API-key setup and signup test. Mock tests do not send real mail.

Official references:
- https://developers.brevo.com/docs/send-a-transactional-email
- https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan

## Persistent HTTP 401

A 401 can indicate a rejected key or an unauthorized source IP. Check Brevo Settings > Security > Authorized IPs and its security email for the failed request's IP. Only approve the IP after matching it to the existing Render service outbound addresses; do not disable the security control globally. Render outbound addresses are shown in its dashboard. The restricted API key needs Transactional email All. `EMAIL_KEY` is the legacy SMTP credential; Brevo reads only `BREVO_API_KEY`.

Logs now include a fixed reason enum: IP_NOT_AUTHORIZED, API_KEY_REJECTED, PERMISSION_DENIED, SENDER_NOT_AUTHORIZED, AUTHENTICATION_REJECTED, ACCESS_DENIED, PROVIDER_LIMIT or PROVIDER_UNAVAILABLE. No raw provider response or key is logged. Generic authentication rejection is not enough to infer which credential or restriction is wrong.
