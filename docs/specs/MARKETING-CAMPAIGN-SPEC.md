# Marketing Campaign Automation Spec

## Goal
Provide a safe, approval-gated workflow for:
- discovering contacts from allowed web pages,
- managing campaign contacts/templates,
- sending targeted emails through Gmail API.

## Scope
- Tools runtime integrations in `src/tools/executor.ts`
- Local persistence in `src/tools/marketing-store.ts`
- CLI operator commands under `/campaign`
- Approval-gated send operations through existing tools policy engine

## Tooling
- `contacts_discover_browser` (network)
- `contacts_import_csv` (mutating)
- `contacts_list` (read-only)
- `campaign_create` (mutating)
- `campaign_list` (read-only)
- `campaign_add_contacts` (mutating)
- `campaign_dry_run` (read-only)
- `gmail_send` (external_post)
- `campaign_run` (external_post)

## Security Model
- Host allowlist enforced through `assistant.tools.allowedDomains`
- Gmail operations require `gmail.googleapis.com` in allowlist
- Send operations are `external_post` risk and therefore manual-approval gated
- Guardian `send_email` action checks are executed before outbound send

## Gmail Authentication
- Uses OAuth access token provided as:
  - tool arg `accessToken`, or
  - env var `GOOGLE_OAUTH_ACCESS_TOKEN`
- Expected scope: `https://www.googleapis.com/auth/gmail.send`

## Persistence
- Local JSON file: `.guardianagent/marketing-state.json`
- Stores:
  - contacts
  - campaigns
  - campaign run history summaries

## CLI UX
- `/campaign discover <url> [tagsCsv]`
- `/campaign import <csvPath> [source]`
- `/campaign contacts [limit] [query]`
- `/campaign create <name> | <subjectTemplate> | <bodyTemplate>`
- `/campaign add <campaignId> <contactId[,contactId...]>`
- `/campaign list [limit]`
- `/campaign preview <campaignId> [limit]`
- `/campaign run <campaignId> [maxRecipients]`

## Template Variables
- `{name}`
- `{company}`
- `{email}`
