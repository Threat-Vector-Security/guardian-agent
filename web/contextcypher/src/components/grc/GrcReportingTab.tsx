import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, Chip, Collapse, FormControlLabel, IconButton, LinearProgress, Paper, Tooltip, Typography, useTheme
} from '@mui/material';
import {
  ChevronDown, ChevronRight, ChevronUp, Download, Eye, RotateCcw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { GrcReportCatalogEntry, GrcReportId, GrcReportSectionConfig } from '../../types/GrcTypes';
import {
  computeGrcDashboardMetrics,
  computeWorkflowHealth,
  exportAppetiteRulesCsv,
  exportAssetsCsv,
  exportFindingsCsv,
  exportGovernanceDocsCsv,
  exportThirdPartiesCsv,
  exportImplementedControlsCsv,
  exportInitiativesCsv,
  exportRiskAcceptancesCsv,
  exportFrameworkMappingsCsv,
  exportIncidentsCsv,
  exportPlansCsv,
  exportRisksCsv,
  exportTasksCsv,
  exportSoaCsv,
  exportThreatProfilesCsv,
  generateReportHtml,
  getConfig,
  GRC_REPORT_CATALOG
} from '../../services/GrcWorkspaceService';
import { downloadHtmlFile } from '../../utils/exportUtils';
import { GrcTabProps, cardSx, downloadText, SEVERITY_COLORS, PIE_PALETTE, IMPL_COLORS, TASK_STATUS_COLORS, LBL, countBy } from './grcShared';
import { CustomChartConfig } from '../../types/GrcTypes';
import CustomChartRenderer from './CustomChartRenderer';
import CustomChartBuilderDialog from './CustomChartBuilderDialog';
import GrcChartTooltip from './GrcChartTooltip';
import { Pencil, Trash2, Plus } from 'lucide-react';

const metricCardSx = {
  textAlign: 'center' as const,
  p: 1.5,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  bgcolor: 'background.paper'
};

const useReportSectionConfig = (
  reportId: GrcReportId,
  catalog: GrcReportCatalogEntry,
  workspace: GrcTabProps['workspace'],
  applyWorkspace: GrcTabProps['applyWorkspace']
) => {
  const config = getConfig(workspace);
  const stored: GrcReportSectionConfig | undefined = config.reportSections?.[reportId];
  const defaultIds = useMemo(() => catalog.defaultSections.map(s => s.id), [catalog]);

  const visibleIds = useMemo(() => {
    if (!stored?.visibleSectionIds?.length) return defaultIds;
    const known = new Set(catalog.defaultSections.map(s => s.id));
    return stored.visibleSectionIds.filter(id => known.has(id));
  }, [stored, defaultIds, catalog]);

  const persist = useCallback((nextIds: string[]) => {
    const nextReportSections = { ...(config.reportSections || {}), [reportId]: { visibleSectionIds: nextIds } };
    applyWorkspace({
      ...workspace,
      config: { ...config, reportSections: nextReportSections },
      updatedAt: new Date().toISOString()
    });
  }, [applyWorkspace, config, reportId, workspace]);

  const toggle = useCallback((sectionId: string) => {
    const current = [...visibleIds];
    const idx = current.indexOf(sectionId);
    if (idx >= 0) current.splice(idx, 1); else current.push(sectionId);
    persist(current);
  }, [persist, visibleIds]);

  const move = useCallback((sectionId: string, direction: 'up' | 'down') => {
    const current = [...visibleIds];
    const idx = current.indexOf(sectionId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= current.length) return;
    [current[idx], current[swapIdx]] = [current[swapIdx], current[idx]];
    persist(current);
  }, [persist, visibleIds]);

  const reset = useCallback(() => persist(defaultIds), [defaultIds, persist]);

  return { visibleIds, toggle, move, reset, sectionConfig: { visibleSectionIds: visibleIds } as GrcReportSectionConfig };
};

const MetricCard: React.FC<{ value: string | number; label: string; color?: string }> = ({ value, label, color }) => (
  <Box sx={metricCardSx}>
    <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Box>
);

const SectionHeader: React.FC<{
  title: string;
  count?: number;
  expanded?: boolean;
  onToggle?: () => void;
  action?: React.ReactNode;
}> = ({ title, count, expanded, onToggle, action }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    mb: onToggle && expanded === false ? 0 : 1.5,
    ...(onToggle ? { cursor: 'pointer', userSelect: 'none' } : {})
  }} onClick={onToggle}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {onToggle && (expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />)}
      <Typography variant="h6" sx={{ lineHeight: 1.3 }}>{title}</Typography>
      {count !== undefined && count > 0 && (
        <Chip size="small" label={count} sx={{ height: 20, fontSize: 11, fontWeight: 600 }} />
      )}
    </Box>
    {action && <Box onClick={e => e.stopPropagation()}>{action}</Box>}
  </Box>
);

const ChartCard: React.FC<{ title: string; isEmpty: boolean; children: React.ReactNode }> = ({ title, isEmpty, children }) => (
  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: 280 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
    {isEmpty ? (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
        <Typography variant="caption" color="text.disabled">No data</Typography>
      </Box>
    ) : children}
  </Paper>
);

const GrcReportingTab: React.FC<GrcTabProps> = ({ workspace, applyWorkspace, getTabViewState, setTabViewState }) => {
  const metrics = useMemo(() => computeGrcDashboardMetrics(workspace), [workspace]);
  const health = useMemo(() => computeWorkflowHealth(workspace), [workspace]);
  const exportFilenames = getConfig(workspace).exportFilenames;
  const persistedView = getTabViewState?.('reporting', {
    selectedReportId: null,
    csvExpanded: false,
    analyticsExpanded: true
  }) ?? {
    selectedReportId: null,
    csvExpanded: false,
    analyticsExpanded: true
  };

  const [selectedReportId, setSelectedReportId] = useState<GrcReportId | null>((persistedView.selectedReportId as GrcReportId | null) ?? null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [csvExpanded, setCsvExpanded] = useState<boolean>(Boolean(persistedView.csvExpanded as boolean | undefined));
  const [analyticsExpanded, setAnalyticsExpanded] = useState<boolean>(persistedView.analyticsExpanded !== false);

  const theme = useTheme();
  const axisTickColor = theme.palette.text.secondary;

  const riskRatingData = useMemo(() => {
    const bands = ['critical', 'high', 'medium', 'low', 'negligible'];
    const counts: Record<string, number> = {};
    for (const r of workspace.risks) {
      const band = (r.inherentScore.ratingLabel || '').toLowerCase();
      counts[band] = (counts[band] || 0) + 1;
    }
    return bands.filter(b => counts[b]).map(b => ({ name: LBL[b] || b, value: counts[b], _key: b }));
  }, [workspace.risks]);

  const riskStatusData = useMemo(() => countBy(workspace.risks, r => r.status), [workspace.risks]);
  const assetDomainData = useMemo(() => countBy(workspace.assets, a => a.domain), [workspace.assets]);

  const findingSeverityData = useMemo(() => {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    const data = countBy(workspace.findings, f => f.severity);
    return data.sort((a, b) => order.indexOf(a._key) - order.indexOf(b._key));
  }, [workspace.findings]);

  const findingStatusData = useMemo(() => countBy(workspace.findings, f => f.status), [workspace.findings]);

  const taskChartData = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {};
    for (const t of workspace.workflowTasks) {
      if (!grid[t.priority]) grid[t.priority] = {};
      grid[t.priority][t.status] = (grid[t.priority][t.status] || 0) + 1;
    }
    return ['critical', 'high', 'medium', 'low']
      .filter(p => grid[p])
      .map(p => ({ name: LBL[p] || p, todo: grid[p].todo || 0, in_progress: grid[p].in_progress || 0, blocked: grid[p].blocked || 0, done: grid[p].done || 0 }));
  }, [workspace.workflowTasks]);

  const controlImplData = useMemo(() => {
    return workspace.controlSets.map(cs => {
      const counts = { implemented: 0, in_progress: 0, planned: 0, not_implemented: 0 };
      for (const ctrl of cs.controls) {
        const entry = workspace.soaEntries.find(
          e => e.controlSetId === cs.id && e.controlId === ctrl.controlId && e.scopeType === 'system' && e.scopeId === 'system'
        );
        const app = entry?.applicability || 'applicable';
        if (app !== 'not_applicable') {
          const impl = (entry?.implementationStatus || 'not_implemented') as keyof typeof counts;
          counts[impl]++;
        }
      }
      return { name: cs.name.length > 20 ? cs.name.slice(0, 20) + '\u2026' : cs.name, ...counts };
    });
  }, [workspace.controlSets, workspace.soaEntries]);

  const thirdPartyRiskData = useMemo(() => {
    const order = ['critical', 'high', 'medium', 'low', 'not_assessed'];
    const data = countBy(workspace.thirdParties, tp => tp.riskRating);
    return data.sort((a, b) => order.indexOf(a._key) - order.indexOf(b._key));
  }, [workspace.thirdParties]);

  const govDocStatusData = useMemo(() => countBy(workspace.governanceDocuments, d => d.status), [workspace.governanceDocuments]);
  const threatActorTypeData = useMemo(() => countBy(workspace.threatActors, a => a.type), [workspace.threatActors]);

  const riskTierRollupData = useMemo(() => {
    const tiers: Record<string, { risks: number; findings: number }> = {};
    for (const risk of workspace.risks) {
      const tp = risk.tierPath || {};
      const t2 = tp.tier2 || 'Unclassified';
      if (!tiers[t2]) tiers[t2] = { risks: 0, findings: 0 };
      tiers[t2].risks++;
    }
    for (const finding of workspace.findings) {
      const linkedRisks = (finding.linkedRiskIds || []).map(id => workspace.risks.find(r => r.id === id)).filter(Boolean);
      const seen = new Set<string>();
      for (const risk of linkedRisks) {
        const t2 = risk!.tierPath?.tier2 || 'Unclassified';
        if (!seen.has(t2)) {
          seen.add(t2);
          if (!tiers[t2]) tiers[t2] = { risks: 0, findings: 0 };
          tiers[t2].findings++;
        }
      }
    }
    return Object.entries(tiers)
      .sort(([, a], [, b]) => b.risks - a.risks)
      .map(([name, counts]) => ({ name, risks: counts.risks, findings: counts.findings }));
  }, [workspace.risks, workspace.findings]);

  const riskTierLevelData = useMemo(() => {
    const levels: Record<string, number> = { 'Tier 2': 0, 'Tier 3': 0, 'Tier 4': 0, 'Unclassified': 0 };
    for (const risk of workspace.risks) {
      const tp = risk.tierPath || {};
      if (tp.tier4) levels['Tier 4']++;
      else if (tp.tier3) levels['Tier 3']++;
      else if (tp.tier2) levels['Tier 2']++;
      else levels['Unclassified']++;
    }
    return Object.entries(levels).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, _key: name }));
  }, [workspace.risks]);

  const riskReductionByTierData = useMemo(() => {
    const tiers: Record<string, { inherent: number; residual: number; count: number; withResidual: number }> = {};
    for (const risk of workspace.risks) {
      const t2 = risk.tierPath?.tier2 || 'Unclassified';
      if (!tiers[t2]) tiers[t2] = { inherent: 0, residual: 0, count: 0, withResidual: 0 };
      tiers[t2].inherent += risk.inherentScore.rawScore;
      tiers[t2].count++;
      if (risk.residualScore) {
        tiers[t2].residual += risk.residualScore.rawScore;
        tiers[t2].withResidual++;
      } else {
        tiers[t2].residual += risk.inherentScore.rawScore;
      }
    }
    return Object.entries(tiers)
      .sort(([, a], [, b]) => b.inherent - a.inherent)
      .map(([name, d]) => ({
        name: name.length > 25 ? name.slice(0, 25) + '\u2026' : name,
        inherent: Math.round(d.inherent),
        residual: Math.round(d.residual),
        reduction: Math.round(d.inherent - d.residual),
      }));
  }, [workspace.risks]);

  const assessmentStatusData = useMemo(() => countBy(workspace.assessments, a => a.status), [workspace.assessments]);

  const assessmentRiskCoverageData = useMemo(() => {
    return workspace.assessments.map(a => ({
      name: a.title.length > 25 ? a.title.slice(0, 25) + '\u2026' : a.title,
      risks: (a.riskIds || []).length,
      actions: (a.riskManagementPlan?.actions || []).length
    })).sort((a, b) => b.risks - a.risks).slice(0, 12);
  }, [workspace.assessments]);

  const analyticsChartCount = useMemo(() => {
    let count = 0;
    if (riskRatingData.length > 0) count++;
    if (riskStatusData.length > 0) count++;
    if (assetDomainData.length > 0) count++;
    if (findingSeverityData.length > 0) count++;
    if (findingStatusData.length > 0) count++;
    if (taskChartData.length > 0) count++;
    if (controlImplData.length > 0) count++;
    if (thirdPartyRiskData.length > 0) count++;
    if (govDocStatusData.length > 0) count++;
    if (threatActorTypeData.length > 0) count++;
    if (riskTierRollupData.length > 0) count++;
    if (riskTierLevelData.length > 0) count++;
    if (assessmentStatusData.length > 0) count++;
    if (assessmentRiskCoverageData.length > 0) count++;
    if (riskReductionByTierData.length > 0) count++;
    return count;
  }, [riskRatingData, riskStatusData, assetDomainData, findingSeverityData, findingStatusData, taskChartData, controlImplData, thirdPartyRiskData, govDocStatusData, threatActorTypeData, riskTierRollupData, riskTierLevelData, assessmentStatusData, assessmentRiskCoverageData, riskReductionByTierData]);

  const selectedCatalog = useMemo(
    () => selectedReportId ? GRC_REPORT_CATALOG.find(r => r.id === selectedReportId) ?? null : null,
    [selectedReportId]
  );

  const sectionHook = useReportSectionConfig(
    selectedReportId || 'executive_summary',
    selectedCatalog || GRC_REPORT_CATALOG[0],
    workspace, applyWorkspace
  );

  const handlePreview = useCallback(() => {
    if (!selectedReportId) return;
    setPreviewHtml(generateReportHtml(selectedReportId, workspace, sectionHook.sectionConfig));
  }, [selectedReportId, workspace, sectionHook.sectionConfig]);

  const handleDownload = useCallback(() => {
    if (!selectedReportId) return;
    const html = generateReportHtml(selectedReportId, workspace, sectionHook.sectionConfig);
    const catalog = GRC_REPORT_CATALOG.find(r => r.id === selectedReportId);
    downloadHtmlFile(html, catalog?.title.toLowerCase().replace(/\s+/g, '-') || selectedReportId);
  }, [selectedReportId, workspace, sectionHook.sectionConfig]);

  const handleSelectReport = useCallback((id: GrcReportId) => {
    setSelectedReportId(prev => prev === id ? null : id);
    setPreviewHtml(null);
  }, []);

  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<CustomChartConfig | null>(null);
  const customCharts = getConfig(workspace).customCharts || [];

  const handleSaveCustomChart = useCallback((config: CustomChartConfig) => {
    const cfg = getConfig(workspace);
    const existing = cfg.customCharts || [];
    const idx = existing.findIndex(c => c.id === config.id);
    const next = idx >= 0
      ? existing.map(c => c.id === config.id ? config : c)
      : [...existing, config];
    applyWorkspace({
      ...workspace,
      config: { ...cfg, customCharts: next },
      updatedAt: new Date().toISOString()
    });
    setChartDialogOpen(false);
    setEditingChart(null);
  }, [applyWorkspace, workspace]);

  const handleDeleteCustomChart = useCallback((id: string) => {
    const cfg = getConfig(workspace);
    applyWorkspace({
      ...workspace,
      config: { ...cfg, customCharts: (cfg.customCharts || []).filter(c => c.id !== id) },
      updatedAt: new Date().toISOString()
    });
  }, [applyWorkspace, workspace]);

  const handleEditCustomChart = useCallback((chart: CustomChartConfig) => {
    setEditingChart(chart);
    setChartDialogOpen(true);
  }, []);

  useEffect(() => {
    setTabViewState?.('reporting', {
      selectedReportId,
      csvExpanded,
      analyticsExpanded
    });
  }, [selectedReportId, csvExpanded, analyticsExpanded, setTabViewState]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* Metrics Snapshot */}
      <Paper sx={cardSx}>
        <SectionHeader title="Metrics Snapshot" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5 }}>
          <MetricCard value={metrics.assetCount} label="Assets" />
          <MetricCard value={metrics.riskCount} label="Risks" />
          <MetricCard value={metrics.highAndCriticalRiskCount} label="High/Critical Risks" color={metrics.highAndCriticalRiskCount > 0 ? '#dc2626' : undefined} />
          <MetricCard value={metrics.findingCount} label="Findings" />
          <MetricCard value={metrics.openFindingCount} label="Open Findings" color={metrics.openFindingCount > 0 ? '#ea580c' : undefined} />
          <MetricCard value={metrics.soaEntryCount} label="SoA Entries" />
          <MetricCard value={metrics.implementedControlCount} label="Implemented Controls" />
          <MetricCard value={metrics.openTaskCount} label="Open Tasks" />
          <MetricCard value={metrics.overdueTaskCount} label="Overdue Tasks" color={metrics.overdueTaskCount > 0 ? '#dc2626' : undefined} />
          <MetricCard value={metrics.appetiteBreachCount} label="Appetite Breaches" color={metrics.appetiteBreachCount > 0 ? '#dc2626' : undefined} />
          <MetricCard value={`${health.assessmentCoveragePercent}%`} label="Assessment Coverage" />
          <MetricCard value={workspace.assessments.length} label="Assessments" />
          <MetricCard value={workspace.assessments.filter(a => a.status === 'completed').length} label="Completed Assessments" />
          <MetricCard value={workspace.assessments.filter(a => a.riskManagementPlan?.actions?.length).length} label="Assessments w/ Plans" />
          <MetricCard value={metrics.governanceDocumentCount} label="Gov. Documents" />
        </Box>
      </Paper>

      {/* Custom Charts */}
      <Paper sx={cardSx}>
        <SectionHeader
          title="Custom Charts"
          count={customCharts.length}
          action={
            <Button
              variant="outlined" size="small" startIcon={<Plus size={14} />}
              disabled={customCharts.length >= 20}
              onClick={() => { setEditingChart(null); setChartDialogOpen(true); }}
            >
              Add Chart
            </Button>
          }
        />
        {customCharts.length === 0 ? (
          <Box sx={{
            py: 4, textAlign: 'center', border: '2px dashed', borderColor: 'divider',
            borderRadius: 2, bgcolor: 'action.hover'
          }}>
            <Plus size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              No custom charts yet
            </Typography>
            <Button
              variant="text" size="small" startIcon={<Plus size={14} />}
              onClick={() => { setEditingChart(null); setChartDialogOpen(true); }}
            >
              Create your first chart
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {customCharts.map(chart => (
              <Paper key={chart.id} elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: 280 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>{chart.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <IconButton size="small" onClick={() => handleEditCustomChart(chart)}><Pencil size={14} /></IconButton>
                    <IconButton size="small" onClick={() => handleDeleteCustomChart(chart.id)}><Trash2 size={14} /></IconButton>
                  </Box>
                </Box>
                <CustomChartRenderer config={chart} workspace={workspace} />
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <CustomChartBuilderDialog
        open={chartDialogOpen}
        onClose={() => { setChartDialogOpen(false); setEditingChart(null); }}
        onSave={handleSaveCustomChart}
        existingConfig={editingChart}
      />

      {/* Analytics (collapsible) */}
      <Paper sx={cardSx}>
        <SectionHeader
          title="Analytics"
          count={analyticsChartCount}
          expanded={analyticsExpanded}
          onToggle={() => setAnalyticsExpanded(prev => !prev)}
        />
        <Collapse in={analyticsExpanded}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mt: analyticsExpanded ? 0 : undefined }}>
            <ChartCard title="Risk Rating Distribution" isEmpty={riskRatingData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskRatingData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} width={70} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Bar dataKey="value" name="Risks">
                    {riskRatingData.map((d, i) => <Cell key={i} fill={SEVERITY_COLORS[d._key] || PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Risk Status" isEmpty={riskStatusData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={riskStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                    {riskStatusData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Asset Domains" isEmpty={assetDomainData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={assetDomainData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                    {assetDomainData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Finding Severity" isEmpty={findingSeverityData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={findingSeverityData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Bar dataKey="value" name="Findings">
                    {findingSeverityData.map((d, i) => <Cell key={i} fill={SEVERITY_COLORS[d._key] || PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Finding Status" isEmpty={findingStatusData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={findingStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                    {findingStatusData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Task Status & Priority" isEmpty={taskChartData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={taskChartData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="todo" name="To Do" stackId="a" fill={TASK_STATUS_COLORS.todo} />
                  <Bar dataKey="in_progress" name="In Progress" stackId="a" fill={TASK_STATUS_COLORS.in_progress} />
                  <Bar dataKey="blocked" name="Blocked" stackId="a" fill={TASK_STATUS_COLORS.blocked} />
                  <Bar dataKey="done" name="Done" stackId="a" fill={TASK_STATUS_COLORS.done} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Control Implementation" isEmpty={controlImplData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={controlImplData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="implemented" name="Implemented" stackId="a" fill={IMPL_COLORS.implemented} />
                  <Bar dataKey="in_progress" name="In Progress" stackId="a" fill={IMPL_COLORS.in_progress} />
                  <Bar dataKey="planned" name="Planned" stackId="a" fill={IMPL_COLORS.planned} />
                  <Bar dataKey="not_implemented" name="Not Impl." stackId="a" fill={IMPL_COLORS.not_implemented} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Third-Party Risk Ratings" isEmpty={thirdPartyRiskData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={thirdPartyRiskData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} width={85} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Bar dataKey="value" name="Third Parties">
                    {thirdPartyRiskData.map((d, i) => <Cell key={i} fill={SEVERITY_COLORS[d._key] || PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Governance Document Status" isEmpty={govDocStatusData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={govDocStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                    {govDocStatusData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Threat Actor Types" isEmpty={threatActorTypeData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={threatActorTypeData} layout="vertical" margin={{ left: 20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} width={110} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Bar dataKey="value" name="Actors" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Risk Tier Rollup (T2)" isEmpty={riskTierRollupData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskTierRollupData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 10 }} width={100} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="risks" name="Risks" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="findings" name="Findings" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Risk Reduction by Tier (T2)" isEmpty={riskReductionByTierData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskReductionByTierData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 10 }} width={100} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inherent" name="Inherent Score" fill="#ef4444" />
                  <Bar dataKey="residual" name="Residual Score" fill="#22c55e" />
                  <Bar dataKey="reduction" name="Reduction" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Risks by Tier Level" isEmpty={riskTierLevelData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={riskTierLevelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                    {riskTierLevelData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Assessment Status" isEmpty={assessmentStatusData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={assessmentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                    {assessmentStatusData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Assessment Risk & Action Coverage" isEmpty={assessmentRiskCoverageData.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={assessmentRiskCoverageData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTickColor, fontSize: 10 }} width={100} />
                  <RechartsTooltip content={<GrcChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="risks" name="Linked Risks" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="actions" name="Plan Actions" stackId="a" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Box>
        </Collapse>
      </Paper>

      {/* Framework Coverage */}
      {workspace.controlSets.length > 0 && (
        <Paper sx={cardSx}>
          <SectionHeader title="Framework Coverage" count={workspace.controlSets.length} />
          <Box sx={{ display: 'grid', gap: 2 }}>
            {workspace.controlSets.map(cs => {
              const counts = { applicable: 0, partially_applicable: 0, not_applicable: 0, implemented: 0, in_progress: 0, planned: 0, not_implemented: 0 };
              for (const control of cs.controls) {
                const entry = workspace.soaEntries.find(
                  e => e.controlSetId === cs.id && e.controlId === control.controlId &&
                    e.scopeType === 'system' && e.scopeId === 'system'
                );
                const app = entry?.applicability || 'applicable';
                counts[app]++;
                const impl = entry?.implementationStatus || 'not_implemented';
                if (app !== 'not_applicable') counts[impl]++;
              }
              const totalApplicable = counts.applicable + counts.partially_applicable;
              const pct = totalApplicable > 0 ? Math.round((counts.implemented / totalApplicable) * 100) : 0;
              return (
                <Box key={cs.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ minWidth: 180, fontWeight: 500 }}>
                      {cs.name}
                      {cs.version && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>v{cs.version}</Typography>}
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
                      {pct}%
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: '196px' }}>
                    <Chip size="small" variant="outlined" label={`Implemented: ${counts.implemented}`} color="success" />
                    <Chip size="small" variant="outlined" label={`In Progress: ${counts.in_progress}`} color="info" />
                    <Chip size="small" variant="outlined" label={`Planned: ${counts.planned}`} color="warning" />
                    <Chip size="small" variant="outlined" label={`Not Implemented: ${counts.not_implemented}`} color="default" />
                    <Chip size="small" variant="outlined" label={`Applicable: ${counts.applicable}`} />
                    <Chip size="small" variant="outlined" label={`Partial: ${counts.partially_applicable}`} />
                    <Chip size="small" variant="outlined" label={`N/A: ${counts.not_applicable}`} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Report Catalog */}
      <Paper sx={cardSx}>
        <SectionHeader title="Report Catalog" count={GRC_REPORT_CATALOG.length} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5 }}>
          {GRC_REPORT_CATALOG.map((report: GrcReportCatalogEntry) => (
            <Paper
              key={report.id}
              elevation={0}
              onClick={() => handleSelectReport(report.id)}
              sx={{
                p: 1.5, cursor: 'pointer', border: '1px solid',
                borderColor: selectedReportId === report.id ? 'primary.main' : 'divider',
                borderRadius: 2, transition: 'border-color 0.2s',
                bgcolor: selectedReportId === report.id ? 'action.selected' : 'background.paper',
                '&:hover': { borderColor: 'primary.light' }
              }}
            >
              <Typography variant="subtitle2">
                {report.icon} {report.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {report.description}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                {report.defaultSections.length} sections
              </Typography>
            </Paper>
          ))}
        </Box>
      </Paper>

      {/* Report Detail Panel */}
      {selectedCatalog && (
        <Paper sx={cardSx}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {selectedCatalog.icon} {selectedCatalog.title} — Sections
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
            {selectedCatalog.defaultSections.map(section => {
              const isVisible = sectionHook.visibleIds.includes(section.id);
              const idx = sectionHook.visibleIds.indexOf(section.id);
              return (
                <Box key={section.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FormControlLabel
                    sx={{ flex: 1, m: 0 }}
                    control={
                      <Checkbox size="small" checked={isVisible} onChange={() => sectionHook.toggle(section.id)} />
                    }
                    label={<Typography variant="body2">{section.label}</Typography>}
                  />
                  {isVisible && (
                    <>
                      <Tooltip title="Move up" arrow>
                        <span>
                          <IconButton size="small" disabled={idx <= 0} onClick={() => sectionHook.move(section.id, 'up')}>
                            <ChevronUp size={14} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down" arrow>
                        <span>
                          <IconButton size="small" disabled={idx >= sectionHook.visibleIds.length - 1} onClick={() => sectionHook.move(section.id, 'down')}>
                            <ChevronDown size={14} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Tooltip title="Reset sections to defaults" arrow>
              <Button variant="outlined" size="small" startIcon={<RotateCcw size={14} />} onClick={sectionHook.reset}>
                Reset to Defaults
              </Button>
            </Tooltip>
            <Tooltip title="Generate and preview report inline" arrow>
              <Button variant="outlined" size="small" startIcon={<Eye size={14} />} onClick={handlePreview}>
                Preview
              </Button>
            </Tooltip>
            <Tooltip title="Download report as self-contained HTML file" arrow>
              <Button variant="contained" size="small" startIcon={<Download size={14} />} onClick={handleDownload}>
                Download HTML
              </Button>
            </Tooltip>
          </Box>

          {previewHtml && (
            <Box
              component="iframe"
              title={`${selectedCatalog?.title || 'GRC'} report preview`}
              sandbox=""
              srcDoc={previewHtml}
              sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1,
                width: '100%', height: 500, bgcolor: '#fff'
              }}
            />
          )}
        </Paper>
      )}

      {/* CSV Data Exports (collapsible) */}
      <Paper sx={cardSx}>
        <SectionHeader
          title="CSV Data Exports"
          expanded={csvExpanded}
          onToggle={() => setCsvExpanded(prev => !prev)}
        />
        <Collapse in={csvExpanded}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            <Tooltip describeChild title="Export the asset register including domain/category and criticality ratings." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.assetsCsv, exportAssetsCsv(workspace), 'text/csv;charset=utf-8')}>
                Assets
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export the risk register with current inherent ratings and ownership." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.risksCsv, exportRisksCsv(workspace), 'text/csv;charset=utf-8')}>
                Risks
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export statement-of-applicability records with implementation and evidence counts." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.soaCsv, exportSoaCsv(workspace), 'text/csv;charset=utf-8')}>
                SoA
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export workflow task tracking records and linkage fields." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.tasksCsv, exportTasksCsv(workspace), 'text/csv;charset=utf-8')}>
                Tasks
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export assessment risk management plans and plan action tracking rows." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.plansCsv, exportPlansCsv(workspace), 'text/csv;charset=utf-8')}>
                Plans
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export threat actors and threat scenarios from the threat profile registry." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.threatProfilesCsv, exportThreatProfilesCsv(workspace), 'text/csv;charset=utf-8')}>
                Threat Profiles
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export risk appetite rules with scope and threshold definitions." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.appetiteRulesCsv, exportAppetiteRulesCsv(workspace), 'text/csv;charset=utf-8')}>
                Appetite Rules
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export governance documents registry with status, review dates, and linkages." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.governanceDocsCsv, exportGovernanceDocsCsv(workspace), 'text/csv;charset=utf-8')}>
                Governance Docs
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export security findings with type, severity, status, and linked components." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.findingsCsv, exportFindingsCsv(workspace), 'text/csv;charset=utf-8')}>
                Findings
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export third-party vendor profiles to CSV." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.thirdPartiesCsv, exportThirdPartiesCsv(workspace), 'text/csv;charset=utf-8')}>
                Third Parties
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export security initiatives with milestones and linkages to CSV." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.initiativesCsv, exportInitiativesCsv(workspace), 'text/csv;charset=utf-8')}>
                Initiatives
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export implemented controls registry with review dates and status to CSV." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.implementedControlsCsv || 'grc-implemented-controls.csv', exportImplementedControlsCsv(workspace), 'text/csv;charset=utf-8')}>
                Implemented Controls
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export risk acceptances with status, dates, and justification to CSV." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.riskAcceptancesCsv || 'grc-risk-acceptances.csv', exportRiskAcceptancesCsv(workspace), 'text/csv;charset=utf-8')}>
                Risk Acceptances
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export cross-framework control mappings to CSV." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.frameworkMappingsCsv || 'grc-framework-mappings.csv', exportFrameworkMappingsCsv(workspace), 'text/csv;charset=utf-8')}>
                Framework Mappings
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Export incident records with timeline and linkages to CSV." arrow>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />}
                onClick={() => downloadText(exportFilenames.incidentsCsv || 'grc-incidents.csv', exportIncidentsCsv(workspace), 'text/csv;charset=utf-8')}>
                Incidents
              </Button>
            </Tooltip>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default GrcReportingTab;
