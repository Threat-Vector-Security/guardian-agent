# Cloud Operations

Use the built-in cloud and hosting tools for inspection and approved operations across Vercel, Cloudflare, Supabase, Fly.io, AWS, GCP, Azure, cPanel, and WHM.

## Core Rules

- Check `<tool-context>` for configured cloud profiles before asking the user to repeat provider details.
- Prefer the narrowest read-only status or inventory tool first.
- Separate confirmed tool output from your inference.
- If the exact provider tool is not visible, call `find_tools` with the provider name before saying a capability is missing.
- For Supabase and Fly.io, use `supabase_api` / `fly_api` for Management/Machines API operations and `supabase_cli` / `fly_cli` when the provider CLI is the right surface. Mutating operations go through normal Guardian approval.

## Provider Workflow

1. Start with the provider health or account summary.
   - `vercel_status`, `cf_status`, `supabase_status`, `fly_status`, `aws_status`, `gcp_status`, `azure_status`, `cpanel_account`, `whm_status`
2. Move to the narrow provider-specific tool that matches the request.
   - Vercel: projects, deployments, domains, env, logs
   - Cloudflare: DNS, SSL, cache
   - Supabase: `supabase_api` or `supabase_cli`
   - Fly.io: `fly_api` or `fly_cli`
   - AWS: EC2, security groups, S3, Route53, Lambda, CloudWatch, RDS, IAM, costs
   - GCP: Compute, Cloud Run, Storage, DNS, logs
   - Azure: VMs, App Service, Storage, DNS, Monitor
   - cPanel / WHM: domains, DNS, SSL, backups, services, accounts
3. Summarize the result in operator language.
   - what exists
   - what is degraded or unusual
   - what the likely next inspection step is

## Monitoring Guidance

- For recurring cloud checks, pair this skill with `automation-builder`.
- Prefer low-noise inventory or status checks before logs-heavy workflows.
- For possible security issues, hand off to `security-triage` after gathering the minimal cloud evidence.

## Gotchas

- Do not jump straight to logs when a status or inventory tool can answer the question faster.
- Do not treat a missing configured profile as proof that the provider is unsupported; check `<tool-context>` and `find_tools` first.
- Do not hand-write provider-specific workflows if the provider CLI already owns the operation; run the CLI with explicit args instead.
