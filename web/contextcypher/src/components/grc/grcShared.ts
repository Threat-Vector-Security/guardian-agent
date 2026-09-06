import React from 'react';
import { saveExport } from '../../utils/exportUtils';
import { AppModuleMode, AssessmentScopeType, DiagramContextSnapshot, GrcWorkspace } from '../../types/GrcTypes';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import FindInPageOutlined from '@mui/icons-material/FindInPageOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import PolicyOutlined from '@mui/icons-material/PolicyOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import PlaylistAddCheckOutlined from '@mui/icons-material/PlaylistAddCheckOutlined';
import GavelOutlined from '@mui/icons-material/GavelOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import CrisisAlertOutlined from '@mui/icons-material/CrisisAlertOutlined';

export const createId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

export const downloadText = (filename: string, content: string, contentType = 'text/plain;charset=utf-8'): Promise<boolean> =>
  saveExport(filename, new Blob([content], { type: contentType }));

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return window.btoa(binary);
};

export const toSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export type GrcTab =
  | 'dashboard'
  | 'assets'
  | 'findings'
  | 'risks'
  | 'compliance'
  | 'controls'
  | 'assessments'
  | 'risk_management_plan'
  | 'governance'
  | 'threat_profile'
  | 'third_parties'
  | 'initiatives'
  | 'incidents'
  | 'reporting'
  | 'workflow_config';

export interface StatusMessage {
  severity: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

export interface GrcFocusRequest {
  tab: GrcTab;
  entityId: string;
  ts: number;
}

export interface GrcUiNavigationState {
  activeTab: GrcTab;
  tabState: Partial<Record<GrcTab, Record<string, unknown>>>;
}

export const createDefaultGrcUiNavigationState = (): GrcUiNavigationState => ({
  activeTab: 'dashboard',
  tabState: {}
});

export interface GrcTabProps {
  workspace: GrcWorkspace;
  applyWorkspace: (next: GrcWorkspace) => void;
  setStatusMessage: (msg: StatusMessage | null) => void;
  diagramSnapshot?: DiagramContextSnapshot | null;
  assessmentFocusRequest?: GrcAssessmentFocusRequest | null;
  focusRequest?: GrcFocusRequest | null;
  onSwitchModule?: (mode: AppModuleMode) => void;
  onSwitchTab?: (tab: GrcTab, focusEntityId?: string) => void;
  getTabViewState?: <T extends Record<string, unknown>>(tab: GrcTab, defaults: T) => T;
  setTabViewState?: (tab: GrcTab, patch: Record<string, unknown>) => void;
}

export interface GrcAssessmentFocusRequest {
  requestId: string;
  scopeType: AssessmentScopeType;
  scopeValue: string;
  diagramId?: string;
  openRiskPlan?: boolean;
}

export const cardSx = {
  p: 2,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a',
  info: '#6b7280', negligible: '#a3a3a3', not_assessed: '#a3a3a3'
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  extreme: '#7f1d1d',
  high: '#dc2626',
  medium: '#ca8a04',
  minor: '#16a34a',
  sustainable: '#6b7280',
  low: '#16a34a',
};

export const getRiskColor = (risk: string): string => {
  const normalized = (risk || '').trim().toLowerCase();
  return RISK_LEVEL_COLORS[normalized] || SEVERITY_COLORS[normalized] || '#6b7280';
};

export const PIE_PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#14b8a6', '#f97316'];

export const IMPL_COLORS: Record<string, string> = {
  implemented: '#16a34a', in_progress: '#3b82f6', planned: '#ca8a04', not_implemented: '#94a3b8'
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8', in_progress: '#3b82f6', blocked: '#ef4444', done: '#16a34a'
};

export const LBL: Record<string, string> = {
  it: 'IT', ot: 'OT', cloud: 'Cloud', iot: 'IoT', application: 'Application',
  data: 'Data', network: 'Network', physical: 'Physical', people: 'People',
  draft: 'Draft', assessed: 'Assessed', treated: 'Treated', accepted: 'Accepted', closed: 'Closed',
  open: 'Open', in_review: 'In Review', mitigated: 'Mitigated', dismissed: 'Dismissed',
  active: 'Active', under_review: 'Under Review', archived: 'Archived', superseded: 'Superseded',
  extreme: 'Extreme', critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info', sustainable: 'Sustainable',
  negligible: 'Negligible', not_assessed: 'Not Assessed',
  todo: 'To Do', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done',
  implemented: 'Implemented', planned: 'Planned', not_implemented: 'Not Impl.',
  nation_state: 'Nation State', organised_crime: 'Organised Crime', insider: 'Insider',
  hacktivist: 'Hacktivist', opportunistic: 'Opportunistic', competitor: 'Competitor', supply_chain: 'Supply Chain',
  mitigate: 'Mitigate', transfer: 'Transfer', avoid: 'Avoid', accept: 'Accept',
  applicable: 'Applicable', not_applicable: 'N/A', partially_applicable: 'Partial',
  system: 'System', diagram: 'Diagram', assessment: 'Assessment', asset_group: 'Asset Group',
  cloud_provider: 'Cloud Provider', saas: 'SaaS', managed_service: 'Managed Service',
  contractor: 'Contractor', supplier: 'Supplier', partner: 'Partner', other: 'Other',
  onboarding: 'Onboarding', offboarding: 'Offboarding', terminated: 'Terminated',
  public: 'Public', internal: 'Internal', confidential: 'Confidential', restricted: 'Restricted',
  policy: 'Policy', process: 'Process', procedure: 'Procedure', guideline: 'Guideline',
  sop: 'SOP', standard: 'Standard', framework: 'Framework',
  very_low: 'Very Low', moderate: 'Moderate', very_high: 'Very High',
  proposed: 'Proposed', approved: 'Approved', on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled',
  uplift: 'Uplift', remediation: 'Remediation', compliance: 'Compliance', transformation: 'Transformation', hardening: 'Hardening',
  pending: 'Pending', skipped: 'Skipped',
  risk_treatment: 'Risk Treatment', control_implementation: 'Control Impl.', evidence: 'Evidence', review: 'Review',
  threat: 'Threat', vulnerability: 'Vulnerability', weakness: 'Weakness', observation: 'Observation',
  rule_engine: 'Rule Engine', manual: 'Manual', ai_analysis: 'AI Analysis',
  technical: 'Technical', administrative: 'Administrative', operational: 'Operational',
  semi_automated: 'Semi-Automated', fully_automated: 'Fully Automated',
  access_control: 'Access Control', encryption: 'Encryption', monitoring: 'Monitoring',
  network_security: 'Network Security', endpoint_protection: 'Endpoint Protection',
  identity_management: 'Identity Management', logging: 'Logging', backup_recovery: 'Backup & Recovery',
  incident_response: 'Incident Response', training: 'Training', physical_security: 'Physical Security',
  deprecated: 'Deprecated', inactive: 'Inactive',
  identified: 'Identified', confirmed: 'Confirmed', remediation_planned: 'Remediation Planned',
  remediation_in_progress: 'Remediation In Progress', remediated: 'Remediated', verified: 'Verified',
  false_positive: 'False Positive',
  mandatory: 'Mandatory', recommended: 'Recommended', optional: 'Optional',
  pending_review: 'Pending Review', rejected: 'Rejected', expired: 'Expired',
  risk: 'Risk',
  pass: 'Pass', fail: 'Fail', partial: 'Partial',
  equivalent: 'Equivalent', related: 'Related',
  triaged: 'Triaged', investigating: 'Investigating', contained: 'Contained', resolved: 'Resolved'
};

export const countBy = <T,>(items: T[], key: (item: T) => string): { name: string; value: number; _key: string }[] => {
  const counts: Record<string, number> = {};
  for (const item of items) { const k = key(item); counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).map(([k, v]) => ({ name: LBL[k] || k, value: v, _key: k }));
};

export const moduleTabs: Array<{ id: GrcTab; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardOutlined },
  { id: 'assets', label: 'Assets', icon: StorageOutlined },
  { id: 'findings', label: 'Findings', icon: FindInPageOutlined },
  { id: 'risks', label: 'Risks', icon: WarningAmberOutlined },
  { id: 'compliance', label: 'Compliance', icon: PolicyOutlined },
  { id: 'controls', label: 'Controls', icon: SecurityOutlined },
  { id: 'assessments', label: 'Assessments', icon: AssignmentOutlined },
  { id: 'risk_management_plan', label: 'Risk Management', icon: PlaylistAddCheckOutlined },
  { id: 'governance', label: 'Governance', icon: GavelOutlined },
  { id: 'threat_profile', label: 'Threat Profiles', icon: ShieldOutlined },
  { id: 'third_parties', label: 'Third Parties', icon: GroupsOutlined },
  { id: 'initiatives', label: 'Initiatives', icon: RocketLaunchOutlined },
  { id: 'incidents', label: 'Incidents', icon: CrisisAlertOutlined },
  { id: 'reporting', label: 'Reporting', icon: AssessmentOutlined },
  { id: 'workflow_config', label: 'Workflow & Config', icon: SettingsOutlined }
];
