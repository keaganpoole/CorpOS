---
name: outlook-mail
description: Create and configure a Microsoft Entra ID web application for Outlook Mail / Microsoft Graph so website users can connect Outlook accounts and send or receive mail. Use when Keagan needs Outlook, Microsoft 365, Microsoft Graph mail, OAuth, Azure app registration, redirect URI, mail scopes, or project .env setup. MANDATORY: Before creating or changing an Outlook/Microsoft app, read current Microsoft documentation for Microsoft Graph mail permissions, OAuth authorization code flow, and scopes/consent best practices.
---

# Outlook Mail — Microsoft Graph Web App Setup

Create and configure a Microsoft Entra ID app registration for a web application that lets users connect Outlook / Microsoft 365 mailboxes and send or receive mail through the website.

Use **Microsoft Graph** for Outlook mail. Do not use the legacy Outlook REST API unless Keagan explicitly asks for a legacy integration.

## Mandatory documentation check

Before doing the setup, read the latest Microsoft documentation and confirm the current guidance for:

1. Microsoft Graph Outlook mail API overview
2. Microsoft identity platform OAuth 2.0 authorization code flow
3. Microsoft identity platform scopes, permissions, and consent
4. Microsoft Graph mail permissions for reading and sending mail

Current reference links are in `references/microsoft-docs.md`.

If documentation has changed, follow Microsoft’s current documentation over anything written in this skill.

## Integration goal

The app must support website users connecting their own Outlook account, then allowing the website to:

- Sign the user in with Microsoft OAuth
- Receive an authorization code at the backend callback URL
- Exchange the code for access and refresh tokens
- Read received mail through Microsoft Graph
- Send mail through Microsoft Graph
- Refresh tokens using `offline_access`

This is a **delegated user OAuth** integration. Prefer delegated permissions because users are connecting their own mailbox. Do not use application permissions unless Keagan specifically wants tenant-wide/admin mailbox access.

## Recommended delegated scopes

Use least privilege for the product feature being built.

### Standard send + receive mailbox connection

Request these scopes in the OAuth URL/runtime scope string:

```text
openid profile email offline_access User.Read Mail.Read Mail.Send
```

Use this when the site only needs to read messages and send messages.

### If the product must modify messages

Request:

```text
openid profile email offline_access User.Read Mail.ReadWrite Mail.Send
```

Use `Mail.ReadWrite` only if the app needs to create drafts, mark read/unread, move, update, or delete messages. Do not request it just for basic inbox viewing.

### Shared mailbox support

Only add shared mailbox scopes when explicitly needed:

```text
Mail.Read.Shared Mail.ReadWrite.Shared Mail.Send.Shared
```

The signed-in user must still have the required mailbox permissions in Microsoft 365.

## Environment variables

After creating the app, write these values into the project `.env` file:

```env
OUTLOOK_CLIENT_ID=<application-client-id>
OUTLOOK_CLIENT_SECRET=<client-secret-value>
OUTLOOK_TENANT_ID=common
OUTLOOK_AUTHORITY=https://login.microsoftonline.com/common
OUTLOOK_REDIRECT_URI=<backend-callback-url>
OUTLOOK_SCOPES=openid profile email offline_access User.Read Mail.Read Mail.Send
MICROSOFT_GRAPH_BASE_URL=https://graph.microsoft.com/v1.0
```

Use `common` for both personal Microsoft accounts and work/school accounts. Use `organizations` only if the product intentionally excludes personal Microsoft accounts. Use a tenant ID only for a single-tenant internal app.

Never commit `.env` or client secrets to git.

## Azure / Entra setup checklist

1. Read the current Microsoft docs listed above.
2. Create a Microsoft Entra ID app registration.
3. Set supported account types to allow the target users:
   - Prefer **Accounts in any organizational directory and personal Microsoft accounts** for a public SaaS mailbox connection.
4. Add a **Web** platform redirect URI, for example:
   - Local: `http://localhost:7878/api/integrations/outlook/callback`
   - Production: `https://<domain>/api/integrations/outlook/callback`
5. Add delegated Microsoft Graph API permissions:
   - `User.Read`
   - `Mail.Read` or `Mail.ReadWrite`
   - `Mail.Send`
6. Do not add broad application permissions such as `Mail.ReadWrite.All` unless Keagan explicitly asks for admin/tenant-wide access.
7. Create a client secret.
8. Put the app/client ID, secret, authority, redirect URI, scopes, and Graph base URL into `.env`.
9. Make sure the backend stores refresh tokens encrypted at rest.
10. Implement OAuth with authorization code flow. For Node backends, prefer MSAL where practical.
11. Test consent and token exchange with one Microsoft account before wiring scenario nodes.

## Script

A helper script is provided:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-outlook-mail-app.ps1 -DisplayName "CorpOS Outlook Mail" -RedirectUri "http://localhost:7878/api/integrations/outlook/callback" -EnvPath ".env"
```

The script uses Azure CLI (`az`). Run `az login` first. It creates an app registration, configures delegated Microsoft Graph mail permissions, creates a client secret, and appends the environment variables to the selected `.env` file.

If Azure CLI is not installed or not authenticated, complete the checklist manually in Microsoft Entra admin center.

## OAuth implementation notes

Authorization URL shape:

```text
https://login.microsoftonline.com/common/oauth2/v2.0/authorize
  ?client_id=<OUTLOOK_CLIENT_ID>
  &response_type=code
  &redirect_uri=<urlencoded OUTLOOK_REDIRECT_URI>
  &response_mode=query
  &scope=<urlencoded OUTLOOK_SCOPES>
  &state=<csrf_state>
```

Token endpoint:

```text
https://login.microsoftonline.com/common/oauth2/v2.0/token
```

Token exchange must include:

```text
client_id
client_secret
code
redirect_uri
grant_type=authorization_code
scope
```

Refresh token exchange must include:

```text
client_id
client_secret
refresh_token
grant_type=refresh_token
scope
```

## Microsoft Graph mail endpoints

Read messages:

```http
GET https://graph.microsoft.com/v1.0/me/messages
Authorization: Bearer <access_token>
```

Send mail:

```http
POST https://graph.microsoft.com/v1.0/me/sendMail
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request body example:

```json
{
  "message": {
    "subject": "Hello from CorpOS",
    "body": {
      "contentType": "Text",
      "content": "This was sent through Microsoft Graph."
    },
    "toRecipients": [
      {
        "emailAddress": {
          "address": "customer@example.com"
        }
      }
    ]
  },
  "saveToSentItems": true
}
```

## Safety and security rules

- Use authorization code flow for web apps.
- Use a server-side token exchange. Do not expose the client secret in frontend code.
- Always validate the `state` parameter to prevent CSRF.
- Store refresh tokens encrypted.
- Request the smallest scope set needed.
- Separate local, staging, and production app registrations when possible.
- Rotate client secrets before expiration.
- If app verification or publisher verification is required, explain the exact Microsoft requirement instead of guessing.

## Troubleshooting

- `AADSTS50011`: redirect URI mismatch. The callback URL must exactly match the Web redirect URI in the app registration.
- `invalid_scope`: a scope is misspelled or not supported for the account type.
- `access_denied`: user/admin did not consent, or tenant policy blocks user consent.
- `401 InvalidAuthenticationToken`: token is expired, wrong audience, or not a Graph token.
- `403 ErrorAccessDenied`: missing Graph permission, user lacks mailbox access, or admin consent is required by the tenant.
- Personal account issues: confirm supported account type includes personal Microsoft accounts and authority uses `common`.
