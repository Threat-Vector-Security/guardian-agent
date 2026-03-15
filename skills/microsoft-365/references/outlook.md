# Outlook Mail

Use these tools:
- `outlook_draft` for simple plain-text drafts
- `outlook_send` for simple plain-text sends
- `m365` for reads, advanced drafts/sends, folders, attachments, and searches
- `m365_schema` if a Graph endpoint is unclear

CRITICAL: Always execute reads immediately. Do not ask the user if they want you to check their email — just do it.

## List recent messages

Always include `toRecipients` and `bodyPreview` — the user will ask follow-ups about recipients and content.

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/messages",
    "method": "list",
    "params": {
      "$top": 10,
      "$select": "subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance,hasAttachments",
      "$orderby": "receivedDateTime desc"
    }
  }
}
```

When presenting results, format as a numbered list:
1. **Subject** — From: sender — Date — (preview snippet if relevant)

## Read one message (full details)

Use this when the user asks for the body, recipients, or full details of a specific email.

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/messages",
    "method": "get",
    "id": "MESSAGE_ID",
    "params": {
      "$select": "subject,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,importance,isRead"
    }
  }
}
```

## Search messages

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/messages",
    "method": "list",
    "params": {
      "$search": "\"from:boss@company.com\"",
      "$top": 10,
      "$select": "subject,from,toRecipients,receivedDateTime,bodyPreview"
    }
  }
}
```

## Filter unread messages

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/messages",
    "method": "list",
    "params": {
      "$filter": "isRead eq false",
      "$top": 10,
      "$select": "subject,from,toRecipients,receivedDateTime,bodyPreview",
      "$orderby": "receivedDateTime desc"
    }
  }
}
```

## Get user's own email address

If the user asks "what's my email?" or "what account is this?", use the user profile endpoint:

```json
{
  "tool": "m365",
  "args": {
    "service": "user",
    "resource": "me",
    "method": "get",
    "params": {
      "$select": "displayName,mail,userPrincipalName"
    }
  }
}
```

## Draft a simple email

Prefer:
```json
{
  "tool": "outlook_draft",
  "args": {
    "to": "recipient@example.com",
    "subject": "Subject",
    "body": "Body text"
  }
}
```

## Send a simple email

Prefer:
```json
{
  "tool": "outlook_send",
  "args": {
    "to": "recipient@example.com",
    "subject": "Subject",
    "body": "Body text"
  }
}
```

## Advanced draft via m365

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/messages",
    "method": "create",
    "json": {
      "subject": "Subject",
      "body": { "contentType": "HTML", "content": "<h1>Hello</h1>" },
      "toRecipients": [{ "emailAddress": { "address": "user@example.com" } }],
      "ccRecipients": [{ "emailAddress": { "address": "cc@example.com" } }]
    }
  }
}
```

## Send a draft

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/messages",
    "method": "send",
    "id": "DRAFT_MESSAGE_ID"
  }
}
```
Note: sending a draft uses POST /me/messages/{id}/send — put the draft ID in `id`, the service builds the URL.

## List mail folders

```json
{
  "tool": "m365",
  "args": {
    "service": "mail",
    "resource": "me/mailFolders",
    "method": "list",
    "params": {
      "$select": "displayName,totalItemCount,unreadItemCount"
    }
  }
}
```

Body format rules:
- `body.contentType` can be `Text` or `HTML`
- Recipients are arrays of `{ emailAddress: { address: "..." } }`
- Put the message body in `json`, never `params`

Approval rules:
- Draft creation is a mutating action and may require approval
- Sending is always high-risk and requires approval

Error recovery:
- If an endpoint is unclear, call `m365_schema`
- If auth fails, tell the user to connect Microsoft 365 in Settings
