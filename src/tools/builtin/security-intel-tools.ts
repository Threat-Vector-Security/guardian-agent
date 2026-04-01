import type { ThreatIntelService, IntelActionType, IntelSourceType, IntelStatus } from '../../runtime/threat-intel.js';
import type {
  AiSecurityFindingStatus,
  AiSecurityRunSource,
  AiSecurityScanResult,
  AiSecurityService,
} from '../../runtime/ai-security.js';
import type { HostMonitoringService, HostMonitorReport } from '../../runtime/host-monitor.js';
import type { GatewayFirewallMonitoringService, GatewayMonitorReport } from '../../runtime/gateway-monitor.js';
import type { WindowsDefenderProvider } from '../../runtime/windows-defender-provider.js';
import type { NetworkBaselineService } from '../../runtime/network-baseline.js';
import type { PackageInstallTrustService } from '../../runtime/package-install-trust-service.js';
import type { ContainmentService } from '../../runtime/containment-service.js';
import { assessSecurityPosture, isDeploymentProfile, isSecurityOperatingMode } from '../../runtime/security-posture.js';
import {
  acknowledgeUnifiedSecurityAlert,
  availableSecurityAlertSources,
  collectUnifiedSecurityAlerts,
  matchesSecurityAlertQuery,
  normalizeSecurityAlertSeverity,
  normalizeSecurityAlertSources,
  resolveUnifiedSecurityAlert,
  suppressUnifiedSecurityAlert,
  type SecurityAlertSeverity,
  type SecurityAlertSource,
} from '../../runtime/security-alerts.js';
import { isSecurityAlertStatus } from '../../runtime/security-alert-lifecycle.js';
import { ToolRegistry } from '../registry.js';
import type { ToolExecutionRequest } from '../types.js';

interface SecurityIntelToolRegistrarContext {
  registry: ToolRegistry;
  requireString: (value: unknown, field: string) => string;
  asString: (value: unknown, fallback?: string) => string;
  asStringArray: (value: unknown) => string[];
  asNumber: (value: unknown, fallback: number) => number;
  guardAction: (request: ToolExecutionRequest, action: string, details: Record<string, unknown>) => void;
  isHostAllowed: (host: string) => boolean;
  threatIntel?: ThreatIntelService;
  assistantSecurity?: AiSecurityService;
  runAssistantSecurityScan?: (input: {
    profileId: string;
    targetIds?: string[];
    source?: AiSecurityRunSource;
    requestedBy?: string;
  }) => Promise<AiSecurityScanResult>;
  allowExternalPosting?: boolean;
  hostMonitor?: HostMonitoringService;
  runHostMonitorCheck?: (source: string) => Promise<HostMonitorReport>;
  gatewayMonitor?: GatewayFirewallMonitoringService;
  runGatewayMonitorCheck?: (source: string) => Promise<GatewayMonitorReport>;
  windowsDefender?: WindowsDefenderProvider;
  networkBaseline?: NetworkBaselineService;
  packageInstallTrust?: PackageInstallTrustService;
  containmentService?: ContainmentService;
}

export function registerBuiltinSecurityIntelTools(context: SecurityIntelToolRegistrarContext): void {
  context.registry.register(
    {
      name: 'intel_summary',
      description: 'Get threat-intel summary state including watchlist count, findings count, and scan status. Read-only — no network calls.',
      shortDescription: 'Get threat-intel summary including watchlist and findings count.',
      risk: 'read_only',
      category: 'intel',
      deferLoading: true,
      parameters: { type: 'object', properties: {} },
    },
    async () => {
      if (!context.threatIntel) {
        return { success: false, error: 'Threat intel is not available.' };
      }
      return { success: true, output: context.threatIntel.getSummary() };
    },
  );

  context.registry.register(
    {
      name: 'intel_watch_add',
      description: 'Add a name, handle, brand, or domain to the threat-intel watchlist for monitoring. Mutating — local store only, no network calls.',
      shortDescription: 'Add a name, handle, or domain to the threat-intel watchlist.',
      risk: 'mutating',
      category: 'intel',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
      },
    },
    async (args) => {
      if (!context.threatIntel) {
        return { success: false, error: 'Threat intel is not available.' };
      }
      const target = context.requireString(args.target, 'target');
      const result = context.threatIntel.addWatchTarget(target);
      return { success: result.success, output: result, error: result.success ? undefined : result.message };
    },
  );

  context.registry.register(
    {
      name: 'intel_watch_remove',
      description: 'Remove a target from the threat-intel watchlist. Mutating — local store only, no network calls.',
      shortDescription: 'Remove a target from the threat-intel watchlist.',
      risk: 'mutating',
      category: 'intel',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
      },
    },
    async (args) => {
      if (!context.threatIntel) {
        return { success: false, error: 'Threat intel is not available.' };
      }
      const target = context.requireString(args.target, 'target');
      const result = context.threatIntel.removeWatchTarget(target);
      return { success: result.success, output: result, error: result.success ? undefined : result.message };
    },
  );

  context.registry.register(
    {
      name: 'intel_scan',
      description: 'Run a threat-intel scan across configured sources (open web, optionally dark web). Returns findings with severity and source info. Security: network calls to configured intel sources only. Requires network_access capability.',
      shortDescription: 'Run a threat-intel scan across configured sources.',
      risk: 'network',
      category: 'intel',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          includeDarkWeb: { type: 'boolean' },
          sources: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    async (args) => {
      if (!context.threatIntel) {
        return { success: false, error: 'Threat intel is not available.' };
      }
      const result = await context.threatIntel.scan({
        query: context.asString(args.query),
        includeDarkWeb: !!args.includeDarkWeb,
        sources: Array.isArray(args.sources) ? args.sources as IntelSourceType[] : undefined,
      });
      return { success: result.success, output: result, error: result.success ? undefined : result.message };
    },
  );

  context.registry.register(
    {
      name: 'intel_findings',
      description: 'List threat-intel findings with optional status filter. Returns severity, source, and match details. Read-only — no network calls.',
      shortDescription: 'List threat-intel findings with optional status filter.',
      risk: 'read_only',
      category: 'intel',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          status: { type: 'string' },
        },
      },
    },
    async (args) => {
      if (!context.threatIntel) {
        return { success: false, error: 'Threat intel is not available.' };
      }
      const limit = Math.max(1, Math.min(200, context.asNumber(args.limit, 50)));
      const status = context.asString(args.status) as IntelStatus | undefined;
      return {
        success: true,
        output: context.threatIntel.listFindings(limit, status),
      };
    },
  );

  context.registry.register(
    {
      name: 'intel_draft_action',
      description: 'Draft a threat-intel response action for a specific finding. Action types: takedown, monitor, block, report. Mutating — creates draft in local store, no external calls.',
      shortDescription: 'Draft a threat-intel response action for a finding.',
      risk: 'mutating',
      category: 'intel',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          type: { type: 'string' },
        },
        required: ['findingId', 'type'],
      },
    },
    async (args) => {
      if (!context.threatIntel) {
        return { success: false, error: 'Threat intel is not available.' };
      }
      const findingId = context.requireString(args.findingId, 'findingId');
      const type = context.requireString(args.type, 'type') as IntelActionType;
      const result = context.threatIntel.draftAction(findingId, type);
      return { success: result.success, output: result, error: result.success ? undefined : result.message };
    },
  );

  context.registry.register(
    {
      name: 'assistant_security_summary',
      description: 'Get Assistant Security posture summary, available scan profiles, target coverage, and recent runs. Read-only.',
      shortDescription: 'Get Assistant Security posture summary and recent runs.',
      risk: 'read_only',
      category: 'security',
      deferLoading: true,
      parameters: { type: 'object', properties: {} },
    },
    async (_args, request) => {
      if (!context.assistantSecurity) {
        return { success: false, error: 'Assistant Security is not available.' };
      }
      context.guardAction(request, 'system_info', { action: 'assistant_security_summary' });
      return {
        success: true,
        output: {
          summary: context.assistantSecurity.getSummary(),
          profiles: context.assistantSecurity.getProfiles(),
          targets: context.assistantSecurity.listTargets(),
          recentRuns: context.assistantSecurity.listRuns(5),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'assistant_security_scan',
      description: 'Run an Assistant Security posture scan against the Guardian runtime and tracked coding workspaces. Returns findings and recent run details. Read-only from the operator perspective, but records scan history and may promote high-risk findings into Security Log.',
      shortDescription: 'Run an Assistant Security posture scan.',
      risk: 'read_only',
      category: 'security',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Scan profile id such as quick, runtime-hardening, or workspace-boundaries.' },
          targetIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional target ids to limit the scan scope.',
          },
          source: {
            type: 'string',
            description: 'Optional source label: manual, scheduled, or system.',
          },
        },
      },
    },
    async (args, request) => {
      const service = context.assistantSecurity;
      if (!service && !context.runAssistantSecurityScan) {
        return { success: false, error: 'Assistant Security is not available.' };
      }
      const profileId = context.asString(args.profileId).trim() || 'quick';
      const targetIds = context.asStringArray(args.targetIds);
      const rawSource = context.asString(args.source).trim().toLowerCase();
      if (rawSource && rawSource !== 'manual' && rawSource !== 'scheduled' && rawSource !== 'system') {
        return {
          success: false,
          error: "'source' must be one of 'manual', 'scheduled', or 'system'.",
        };
      }
      const source = (rawSource || (request.scheduleId ? 'scheduled' : 'manual')) as AiSecurityRunSource;

      context.guardAction(request, 'system_info', {
        action: 'assistant_security_scan',
        profileId,
        targetIds,
        source,
      });

      const result = context.runAssistantSecurityScan
        ? await context.runAssistantSecurityScan({
          profileId,
          targetIds: targetIds.length > 0 ? targetIds : undefined,
          source,
          requestedBy: `tool:${request.agentId || request.origin}`,
        })
        : await service!.scan({
          profileId,
          targetIds: targetIds.length > 0 ? targetIds : undefined,
          source,
        });

      return {
        success: result.success,
        output: result,
        error: result.success ? undefined : result.message,
      };
    },
  );

  context.registry.register(
    {
      name: 'assistant_security_findings',
      description: 'List Assistant Security findings with optional status filter. Returns current posture and workspace-boundary findings without running a new scan. Read-only.',
      shortDescription: 'List Assistant Security findings.',
      risk: 'read_only',
      category: 'security',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max findings to include (1-200, default 50).' },
          status: { type: 'string', description: 'Optional status filter: new, triaged, resolved, or suppressed.' },
        },
      },
    },
    async (args, request) => {
      if (!context.assistantSecurity) {
        return { success: false, error: 'Assistant Security is not available.' };
      }
      const limit = Math.max(1, Math.min(200, context.asNumber(args.limit, 50)));
      const rawStatus = context.asString(args.status).trim().toLowerCase();
      if (rawStatus && rawStatus !== 'new' && rawStatus !== 'triaged' && rawStatus !== 'resolved' && rawStatus !== 'suppressed') {
        return {
          success: false,
          error: "'status' must be one of 'new', 'triaged', 'resolved', or 'suppressed'.",
        };
      }
      const status = rawStatus ? rawStatus as AiSecurityFindingStatus : undefined;
      context.guardAction(request, 'system_info', {
        action: 'assistant_security_findings',
        limit,
        status,
      });
      return {
        success: true,
        output: {
          findings: context.assistantSecurity.listFindings(limit, status),
          summary: context.assistantSecurity.getSummary(),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'forum_post',
      description: 'Post a response to an external forum. Requires allowExternalPosting to be enabled. Security: hostname validated against allowedDomains. external_post risk — always requires manual approval. Requires network_access capability.',
      shortDescription: 'Post a response to an external forum (approval required).',
      risk: 'external_post',
      category: 'forum',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['url', 'content'],
      },
    },
    async (args, request) => {
      if (!context.allowExternalPosting) {
        return {
          success: false,
          error: 'External posting is disabled by policy.',
        };
      }
      const urlText = context.requireString(args.url, 'url').trim();
      const content = context.requireString(args.content, 'content');
      const parsed = new URL(urlText);
      const host = parsed.hostname.toLowerCase();
      if (!context.isHostAllowed(host)) {
        return {
          success: false,
          error: `Host '${host}' is not in allowedDomains.`,
        };
      }
      context.guardAction(request, 'http_request', { url: parsed.toString(), method: 'POST' });
      const response = await fetch(parsed.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GuardianAgent-Tools/1.0',
        },
        body: JSON.stringify({ content }),
      });
      return {
        success: response.ok,
        output: { status: response.status, url: parsed.toString() },
        error: response.ok ? undefined : `Forum post failed with status ${response.status}.`,
      };
    },
  );

  context.registry.register(
    {
      name: 'host_monitor_status',
      description: 'Return workstation host-monitor posture, including baseline status, recent host alerts, suspicious process count, persistence visibility, and sensitive-path monitoring summary. Read-only.',
      shortDescription: 'Return workstation host-monitor posture and active alerts.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max active alerts to include (1-100, default 20).' },
          includeAcknowledged: { type: 'boolean', description: 'Include acknowledged alerts (default false).' },
        },
      },
    },
    async (args, request) => {
      if (!context.hostMonitor) {
        return { success: false, error: 'Host monitoring is not available.' };
      }
      const limit = Math.max(1, Math.min(100, context.asNumber(args.limit, 20)));
      const includeAcknowledged = !!args.includeAcknowledged;
      context.guardAction(request, 'system_info', { action: 'host_monitor_status', limit, includeAcknowledged });
      return {
        success: true,
        output: {
          status: context.hostMonitor.getStatus(),
          alerts: context.hostMonitor.listAlerts({ includeAcknowledged, limit }),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'host_monitor_check',
      description: 'Run an immediate workstation host-monitoring check. Detects suspicious processes, persistence changes, sensitive-path drift, and new external destinations relative to the saved baseline. Read-only.',
      shortDescription: 'Run an immediate workstation host-monitoring check.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    async (_args, request) => {
      if (!context.hostMonitor) {
        return { success: false, error: 'Host monitoring is not available.' };
      }
      context.guardAction(request, 'system_info', { action: 'host_monitor_check' });
      const report = context.runHostMonitorCheck
        ? await context.runHostMonitorCheck(`tool:host_monitor_check:${request.agentId || 'assistant'}`)
        : await context.hostMonitor.runCheck();
      return { success: true, output: report };
    },
  );

  context.registry.register(
    {
      name: 'gateway_firewall_status',
      description: 'Return gateway firewall monitoring posture, including configured targets, recent gateway alerts, firewall state summaries, and baseline status. Read-only.',
      shortDescription: 'Return gateway firewall posture and active alerts.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max active alerts to include (1-100, default 20).' },
          includeAcknowledged: { type: 'boolean', description: 'Include acknowledged alerts (default false).' },
        },
      },
    },
    async (args, request) => {
      if (!context.gatewayMonitor) {
        return { success: false, error: 'Gateway firewall monitoring is not available.' };
      }
      const limit = Math.max(1, Math.min(100, context.asNumber(args.limit, 20)));
      const includeAcknowledged = !!args.includeAcknowledged;
      context.guardAction(request, 'system_info', { action: 'gateway_firewall_status', limit, includeAcknowledged });
      return {
        success: true,
        output: {
          status: context.gatewayMonitor.getStatus(),
          alerts: context.gatewayMonitor.listAlerts({ includeAcknowledged, limit }),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'gateway_firewall_check',
      description: 'Run an immediate gateway firewall monitoring check. Reads configured gateway collector outputs, detects firewall disablement, rule drift, port-forward changes, and admin-user changes relative to baseline. Read-only.',
      shortDescription: 'Run an immediate gateway firewall monitoring check.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    async (_args, request) => {
      if (!context.gatewayMonitor) {
        return { success: false, error: 'Gateway firewall monitoring is not available.' };
      }
      context.guardAction(request, 'system_info', { action: 'gateway_firewall_check' });
      const report = context.runGatewayMonitorCheck
        ? await context.runGatewayMonitorCheck(`tool:gateway_firewall_check:${request.agentId || 'assistant'}`)
        : await context.gatewayMonitor.runCheck();
      return { success: true, output: report };
    },
  );

  context.registry.register(
    {
      name: 'windows_defender_status',
      description: 'Return the current Windows Defender provider status, including AV/real-time protection health, firewall posture, signature age, and active native alerts. Read-only.',
      shortDescription: 'Return current Windows Defender status and native alerts.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    async (_args, request) => {
      if (!context.windowsDefender) {
        return { success: false, error: 'Windows Defender integration is not available.' };
      }
      context.guardAction(request, 'system_info', {
        action: 'windows_defender_status',
      });
      return {
        success: true,
        output: {
          status: context.windowsDefender.getStatus(),
          alerts: context.windowsDefender.listAlerts({
            includeAcknowledged: true,
            includeInactive: true,
            limit: 100,
          }),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'windows_defender_refresh',
      description: 'Refresh Windows Defender status from the host, updating AV/real-time protection health, signature age, firewall posture, and native alerts. Read-only with host-native command execution.',
      shortDescription: 'Refresh Windows Defender status from the host.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    async (_args, request) => {
      if (!context.windowsDefender) {
        return { success: false, error: 'Windows Defender integration is not available.' };
      }
      context.guardAction(request, 'system_info', {
        action: 'windows_defender_refresh',
      });
      return {
        success: true,
        output: {
          status: await context.windowsDefender.refreshStatus(),
          alerts: context.windowsDefender.listAlerts({
            includeAcknowledged: true,
            includeInactive: true,
            limit: 100,
          }),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'windows_defender_scan',
      description: 'Request a Windows Defender scan on the host. Supports quick, full, or custom path scans. Mutating and approval-gated.',
      shortDescription: 'Request a Windows Defender quick, full, or custom scan.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Scan type: quick, full, or custom.' },
          path: { type: 'string', description: 'Required custom scan path when type is custom.' },
        },
        required: ['type'],
      },
    },
    async (args, request) => {
      if (!context.windowsDefender) {
        return { success: false, error: 'Windows Defender integration is not available.' };
      }
      const type = context.asString(args.type).trim().toLowerCase();
      if (type !== 'quick' && type !== 'full' && type !== 'custom') {
        return { success: false, error: "type must be one of 'quick', 'full', or 'custom'." };
      }
      const path = context.asString(args.path).trim() || undefined;
      if (type === 'custom' && !path) {
        return { success: false, error: 'path is required when type is custom.' };
      }
      context.guardAction(request, 'execute_command', {
        action: 'windows_defender_scan',
        scanType: type,
        path,
      });
      const result = await context.windowsDefender.runScan({ type, path });
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return { success: true, output: { ...result, type, path } };
    },
  );

  context.registry.register(
    {
      name: 'windows_defender_update_signatures',
      description: 'Request an immediate Windows Defender signature update on the host. Mutating and approval-gated.',
      shortDescription: 'Request an immediate Windows Defender signature update.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    async (_args, request) => {
      if (!context.windowsDefender) {
        return { success: false, error: 'Windows Defender integration is not available.' };
      }
      context.guardAction(request, 'execute_command', {
        action: 'windows_defender_update_signatures',
      });
      const result = await context.windowsDefender.updateSignatures();
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return { success: true, output: result };
    },
  );

  context.registry.register(
    {
      name: 'security_alert_search',
      description: 'Search and filter unified security alerts across workstation host monitoring, network anomaly alerts, gateway firewall monitoring, native security-provider alerts such as Windows Defender, Assistant Security findings, and managed package-install trust alerts. Read-only.',
      shortDescription: 'Search unified security alerts across host, network, gateway, native, assistant, and install sources.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional free-text query matched against source, type, description, and evidence.' },
          source: { type: 'string', description: 'Optional single source filter: host, network, gateway, native, assistant, or install.' },
          sources: {
            type: 'array',
            description: 'Optional list of source filters: any of host, network, gateway, native, assistant, or install.',
            items: { type: 'string' },
          },
          severity: { type: 'string', description: 'Optional severity filter: low, medium, high, or critical.' },
          status: { type: 'string', description: 'Optional lifecycle-state filter: active, acknowledged, resolved, or suppressed.' },
          type: { type: 'string', description: 'Optional exact alert-type filter.' },
          limit: { type: 'number', description: 'Maximum alerts to return (1-200, default 50).' },
          includeAcknowledged: { type: 'boolean', description: 'Include acknowledged alerts (default false).' },
          includeInactive: { type: 'boolean', description: 'Include resolved and suppressed alerts (default false).' },
        },
      },
    },
    async (args, request) => {
      if (!hasSecurityAlertSources(context)) {
        return { success: false, error: 'No security alert sources are available.' };
      }

      const limit = Math.max(1, Math.min(200, context.asNumber(args.limit, 50)));
      const includeAcknowledged = !!args.includeAcknowledged;
      const query = context.asString(args.query).trim();
      const severity = normalizeSecurityAlertSeverity(args.severity);
      if (context.asString(args.severity).trim() && !severity) {
        return { success: false, error: "Severity must be one of 'low', 'medium', 'high', or 'critical'." };
      }
      const statusFilter = context.asString(args.status).trim().toLowerCase();
      if (statusFilter && !isSecurityAlertStatus(statusFilter)) {
        return { success: false, error: "status must be one of 'active', 'acknowledged', 'resolved', or 'suppressed'." };
      }
      const typeFilter = context.asString(args.type).trim().toLowerCase();
      const selectedSources = normalizeSecurityAlertSources(args.source, args.sources);
      const includeInactive = !!args.includeInactive;

      context.guardAction(request, 'system_info', {
        action: 'security_alert_search',
        query,
        sources: selectedSources,
        severity: severity ?? undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        includeAcknowledged,
        includeInactive,
        limit,
      });

      let alerts = collectUnifiedSecurityAlerts({
        ...buildSecurityAlertServices(context),
        includeAcknowledged,
        includeInactive,
      });
      if (selectedSources.length > 0) {
        const allowed = new Set(selectedSources);
        alerts = alerts.filter((alert) => allowed.has(alert.source));
      }
      if (severity) {
        alerts = alerts.filter((alert) => alert.severity === severity);
      }
      if (statusFilter) {
        alerts = alerts.filter((alert) => alert.status === statusFilter);
      }
      if (typeFilter) {
        alerts = alerts.filter((alert) => alert.type.toLowerCase() === typeFilter);
      }
      if (query) {
        alerts = alerts.filter((alert) => matchesSecurityAlertQuery(alert, query));
      }

      alerts.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
      const filteredTotal = alerts.length;
      const bySource: Record<SecurityAlertSource, number> = { host: 0, network: 0, gateway: 0, native: 0, assistant: 0, install: 0 };
      const bySeverity: Record<SecurityAlertSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      for (const alert of alerts) {
        bySource[alert.source] += 1;
        bySeverity[alert.severity] += 1;
      }

      return {
        success: true,
        output: {
          totalMatches: filteredTotal,
          returned: Math.min(filteredTotal, limit),
          searchedSources: selectedSources.length > 0 ? selectedSources : availableSecurityAlertSources(buildSecurityAlertServices(context)),
          includeAcknowledged,
          includeInactive,
          query: query || undefined,
          severity: severity ?? undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          bySource,
          bySeverity,
          alerts: alerts.slice(0, limit),
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'security_posture_status',
      description: 'Summarize current security posture across available host, network, gateway, native, Assistant Security, and managed package-install trust alert sources and recommend whether to stay in monitor mode or move to guarded, lockdown, or ir_assist. Read-only.',
      shortDescription: 'Summarize security posture and recommend an operating mode.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          profile: { type: 'string', description: 'Deployment profile: personal, home, or organization. Defaults to personal.' },
          currentMode: { type: 'string', description: 'Current operating mode: monitor, guarded, lockdown, or ir_assist. Defaults to monitor.' },
          includeAcknowledged: { type: 'boolean', description: 'Include acknowledged alerts when assessing posture (default false).' },
        },
      },
    },
    async (args, request) => {
      const profileRaw = context.asString(args.profile, 'personal').trim().toLowerCase() || 'personal';
      if (!isDeploymentProfile(profileRaw)) {
        return { success: false, error: "Profile must be one of 'personal', 'home', or 'organization'." };
      }
      const modeRaw = context.asString(args.currentMode, 'monitor').trim().toLowerCase() || 'monitor';
      if (!isSecurityOperatingMode(modeRaw)) {
        return { success: false, error: "currentMode must be one of 'monitor', 'guarded', 'lockdown', or 'ir_assist'." };
      }
      const includeAcknowledged = !!args.includeAcknowledged;

      context.guardAction(request, 'system_info', {
        action: 'security_posture_status',
        profile: profileRaw,
        currentMode: modeRaw,
        includeAcknowledged,
      });

      const alerts = collectUnifiedSecurityAlerts({
        ...buildSecurityAlertServices(context),
        includeAcknowledged,
        includeInactive: false,
      });
      const assessment = assessSecurityPosture({
        profile: profileRaw,
        currentMode: modeRaw,
        alerts,
        availableSources: availableSecurityAlertSources(buildSecurityAlertServices(context)),
      });

      return {
        success: true,
        output: assessment,
      };
    },
  );

  context.registry.register(
    {
      name: 'security_containment_status',
      description: 'Return the effective local containment state, including temporary guarded auto-escalation, active bounded response actions, and the effective operating mode derived from current alerts. Read-only.',
      shortDescription: 'Return effective security containment state and active bounded actions.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          profile: { type: 'string', description: 'Deployment profile: personal, home, or organization. Defaults to personal.' },
          currentMode: { type: 'string', description: 'Current operating mode: monitor, guarded, lockdown, or ir_assist. Defaults to monitor.' },
        },
      },
    },
    async (args, request) => {
      if (!context.containmentService) {
        return { success: false, error: 'Security containment is not available.' };
      }
      const profileRaw = context.asString(args.profile, 'personal').trim().toLowerCase() || 'personal';
      if (!isDeploymentProfile(profileRaw)) {
        return { success: false, error: "Profile must be one of 'personal', 'home', or 'organization'." };
      }
      const modeRaw = context.asString(args.currentMode, 'monitor').trim().toLowerCase() || 'monitor';
      if (!isSecurityOperatingMode(modeRaw)) {
        return { success: false, error: "currentMode must be one of 'monitor', 'guarded', 'lockdown', or 'ir_assist'." };
      }

      context.guardAction(request, 'system_info', {
        action: 'security_containment_status',
        profile: profileRaw,
        currentMode: modeRaw,
      });

      const alerts = collectUnifiedSecurityAlerts({
        ...buildSecurityAlertServices(context),
        includeAcknowledged: false,
        includeInactive: false,
      });
      const posture = assessSecurityPosture({
        profile: profileRaw,
        currentMode: modeRaw,
        alerts,
        availableSources: availableSecurityAlertSources(buildSecurityAlertServices(context)),
      });

      return {
        success: true,
        output: context.containmentService.getState({
          profile: profileRaw,
          currentMode: modeRaw,
          alerts,
          posture,
        }),
      };
    },
  );

  context.registry.register(
    {
      name: 'security_alert_ack',
      description: 'Acknowledge a security alert by id across host monitoring, network anomaly alerts, gateway firewall monitoring, native security-provider alerts, Assistant Security findings, or package-install trust alerts. Mutating and approval-gated.',
      shortDescription: 'Acknowledge a security alert by id.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          alertId: { type: 'string', description: 'Security alert id to acknowledge.' },
          source: { type: 'string', description: 'Optional source hint: host, network, gateway, native, assistant, or install.' },
        },
        required: ['alertId'],
      },
    },
    async (args, request) => {
      const alertId = context.requireString(args.alertId, 'alertId').trim();
      const source = normalizeSecurityAlertSources(args.source, undefined)[0];
      if (context.asString(args.source).trim() && !source) {
        return { success: false, error: "Source must be one of 'host', 'network', 'gateway', 'native', 'assistant', or 'install'." };
      }
      context.guardAction(request, 'write_file', {
        path: 'security:alerts',
        action: 'security_alert_ack',
        alertId,
        source: source ?? undefined,
      });
      const result = acknowledgeUnifiedSecurityAlert({
        alertId,
        source,
        ...buildSecurityAlertServices(context),
      });
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return {
        success: true,
        output: {
          alertId,
          source: result.source,
          message: result.message,
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'security_alert_resolve',
      description: 'Resolve a security alert by id across host monitoring, network anomaly alerts, gateway firewall monitoring, native security-provider alerts, Assistant Security findings, or package-install trust alerts. Mutating and approval-gated.',
      shortDescription: 'Resolve a security alert by id.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          alertId: { type: 'string', description: 'Security alert id to resolve.' },
          source: { type: 'string', description: 'Optional source hint: host, network, gateway, native, assistant, or install.' },
          reason: { type: 'string', description: 'Optional operator reason for resolving the alert.' },
        },
        required: ['alertId'],
      },
    },
    async (args, request) => {
      const alertId = context.requireString(args.alertId, 'alertId').trim();
      const source = normalizeSecurityAlertSources(args.source, undefined)[0];
      if (context.asString(args.source).trim() && !source) {
        return { success: false, error: "Source must be one of 'host', 'network', 'gateway', 'native', 'assistant', or 'install'." };
      }
      const reason = context.asString(args.reason).trim() || undefined;
      context.guardAction(request, 'write_file', {
        path: 'security:alerts',
        action: 'security_alert_resolve',
        alertId,
        source: source ?? undefined,
        reason,
      });
      const result = resolveUnifiedSecurityAlert({
        alertId,
        source,
        reason,
        ...buildSecurityAlertServices(context),
      });
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return {
        success: true,
        output: {
          alertId,
          source: result.source,
          message: result.message,
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'security_alert_suppress',
      description: 'Suppress a security alert by id across host monitoring, network anomaly alerts, gateway firewall monitoring, native security-provider alerts, Assistant Security findings, or package-install trust alerts until a future timestamp. Mutating and approval-gated.',
      shortDescription: 'Suppress a security alert until a future timestamp.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          alertId: { type: 'string', description: 'Security alert id to suppress.' },
          source: { type: 'string', description: 'Optional source hint: host, network, gateway, native, assistant, or install.' },
          suppressedUntil: { type: 'number', description: 'UTC timestamp in milliseconds when suppression expires.' },
          reason: { type: 'string', description: 'Optional operator reason for suppressing the alert.' },
        },
        required: ['alertId', 'suppressedUntil'],
      },
    },
    async (args, request) => {
      const alertId = context.requireString(args.alertId, 'alertId').trim();
      const source = normalizeSecurityAlertSources(args.source, undefined)[0];
      if (context.asString(args.source).trim() && !source) {
        return { success: false, error: "Source must be one of 'host', 'network', 'gateway', 'native', 'assistant', or 'install'." };
      }
      const suppressedUntil = context.asNumber(args.suppressedUntil, NaN);
      if (!Number.isFinite(suppressedUntil)) {
        return { success: false, error: 'suppressedUntil must be a valid UTC timestamp in milliseconds.' };
      }
      const reason = context.asString(args.reason).trim() || undefined;
      context.guardAction(request, 'write_file', {
        path: 'security:alerts',
        action: 'security_alert_suppress',
        alertId,
        source: source ?? undefined,
        suppressedUntil,
        reason,
      });
      const result = suppressUnifiedSecurityAlert({
        alertId,
        source,
        suppressedUntil,
        reason,
        ...buildSecurityAlertServices(context),
      });
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return {
        success: true,
        output: {
          alertId,
          source: result.source,
          suppressedUntil,
          message: result.message,
        },
      };
    },
  );
}

function hasSecurityAlertSources(context: SecurityIntelToolRegistrarContext): boolean {
  return !!context.hostMonitor
    || !!context.networkBaseline
    || !!context.gatewayMonitor
    || !!context.windowsDefender
    || !!context.assistantSecurity
    || !!context.packageInstallTrust;
}

function buildSecurityAlertServices(context: SecurityIntelToolRegistrarContext): {
  hostMonitor?: HostMonitoringService;
  networkBaseline?: NetworkBaselineService;
  gatewayMonitor?: GatewayFirewallMonitoringService;
  windowsDefender?: WindowsDefenderProvider;
  assistantSecurity?: AiSecurityService;
  packageInstallTrust?: PackageInstallTrustService;
} {
  return {
    hostMonitor: context.hostMonitor,
    networkBaseline: context.networkBaseline,
    gatewayMonitor: context.gatewayMonitor,
    windowsDefender: context.windowsDefender,
    assistantSecurity: context.assistantSecurity,
    packageInstallTrust: context.packageInstallTrust,
  };
}
