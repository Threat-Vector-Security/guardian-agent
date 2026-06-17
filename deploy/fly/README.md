# Fly.io Deployment Template

This folder is a reusable Fly.io deployment template. Keep live machine IDs,
image digests, release IDs, hostnames, and secrets out of Git.

## Runtime State

`fly.toml` is an example app config. Deploy with `--app <fly-app-name>` or edit
the app/region for your environment before deploying.

The template sets:

- `GUARDIAN_BASE_DIR=/data`
- `GUARDIAN_CONFIG_PATH=/data/config.yaml`
- `GUARDIAN_PROJECTS_DIR=/data/projects`
- `LOG_LEVEL=info`

On startup the container creates `/data/projects` on the mounted volume and links
`/app/projects` to it for compatibility with existing Code sessions. Coding
workspace files should therefore survive Fly machine restarts and image deploys.

The starter config is copied to `/data/config.yaml` only when that file does not already exist. Existing deployments can therefore keep older persisted config values until an operator edits `/data/config.yaml` or recreates the volume.

For Fly, the starter config disables local host/gateway monitoring and sets `assistant.security.deploymentProfile: cloud`. The app also infers cloud profile from Fly env when config omits an explicit profile.

The starter config sets `assistant.secondBrain.profile.timezone: Australia/Brisbane` so scheduled Second Brain routines follow the operator's local day instead of the Fly machine clock.

Web auth uses bearer mode. Set `GUARDIAN_WEB_AUTH_TOKEN` as a Fly secret; do not
commit or print the resolved value.

## Deploy

```powershell
flyctl secrets set GUARDIAN_WEB_AUTH_TOKEN="<token>" --app <fly-app-name>
flyctl deploy --config deploy/fly/fly.toml --app <fly-app-name> --remote-only
```

## Inspect

```powershell
fly status --config deploy/fly/fly.toml --app <fly-app-name>
fly releases --config deploy/fly/fly.toml --app <fly-app-name>
fly image show --config deploy/fly/fly.toml --app <fly-app-name>
fly logs --config deploy/fly/fly.toml --app <fly-app-name> --no-tail
```

Health check:

```powershell
Invoke-RestMethod -Uri 'https://<fly-app-name>.fly.dev/health' -Method Get -TimeoutSec 20
```
