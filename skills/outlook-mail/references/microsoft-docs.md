# Microsoft Outlook Mail / Graph Documentation

Read these before creating or modifying an Outlook Mail integration.

- Microsoft Graph Outlook mail API overview: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview?view=graph-rest-1.0
- OAuth 2.0 authorization code flow: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Scopes, permissions, and consent: https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc
- Microsoft Graph permissions reference: https://learn.microsoft.com/en-us/graph/permissions-reference
- Send mail with Microsoft Graph: https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- Send Outlook messages from another user/shared mailbox: https://learn.microsoft.com/en-us/graph/outlook-send-mail-from-other-user
- MSAL documentation: https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview

## Current guidance snapshot

- Use Microsoft Graph for Outlook mail access.
- Use OAuth 2.0 authorization code flow for web apps.
- Use delegated permissions when users connect their own mailbox.
- Use `Mail.Read` + `Mail.Send` for basic receive/send.
- Use `Mail.ReadWrite` only when the product needs to modify mailbox contents.
- Request `offline_access` at runtime when refresh tokens are needed.
- Use `common` authority for a public SaaS that supports both Microsoft personal accounts and work/school accounts.
