import React, { useMemo } from 'react';
import { Box, Chip, LinearProgress, Paper, Tooltip, Typography } from '@mui/material';
import { computeGrcDashboardMetrics, getConfig } from '../../services/GrcWorkspaceService';
import { GrcTabProps, cardSx } from './grcShared';

const ratingColorMap = (
  rating: string,
  config: ReturnType<typeof getConfig>
): string => {
  const match = config.ratingBands.find(
    band => band.label.trim().toLowerCase() === rating.trim().toLowerCase()
  );
  return match?.color || config.ratingColors.unrated;
};

const clickableSx = {
  ...cardSx,
  cursor: 'pointer',
  transition: 'box-shadow 0.15s, transform 0.1s',
  '&:hover': {
    boxShadow: 4,
    transform: 'translateY(-1px)'
  }
};

const GrcDashboardTab: React.FC<GrcTabProps> = ({ workspace, onSwitchTab }) => {
  const metrics = useMemo(() => computeGrcDashboardMetrics(workspace), [workspace]);
  const riskRatingEntries = useMemo(() => Object.entries(metrics.riskByRating), [metrics.riskByRating]);
  const assetDomainEntries = useMemo(() => Object.entries(metrics.assetsByDomain), [metrics.assetsByDomain]);
  const totalRiskCountForChart = Math.max(metrics.riskCount, 1);
  const config = getConfig(workspace);

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('assets')}>
        <Tooltip describeChild title="Click to go to Assets tab. Total assets in scope with counts of high business/security critical entries." arrow>
          <Typography variant="caption" color="text.secondary">
            Assets
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.assetCount}</Typography>
        <Typography variant="body2" color="text.secondary">
          High Business: {metrics.highBusinessCriticalAssetCount} | High Security: {metrics.highSecurityCriticalAssetCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('assets')}>
        <Tooltip describeChild title="Click to go to Assets tab. Distribution of assets across IT, OT, and Application domains." arrow>
          <Typography variant="caption" color="text.secondary">
            Asset Domains
          </Typography>
        </Tooltip>
        {assetDomainEntries.map(([domain, count]) => (
          <Typography key={domain} variant="body2">{domain}: {count}</Typography>
        ))}
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('risks')}>
        <Tooltip describeChild title="Click to go to Risks tab. Total risks and count in highest-severity rating bands." arrow>
          <Typography variant="caption" color="text.secondary">
            Risks
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.riskCount}</Typography>
        <Typography variant="body2" color="error.main">
          Highest Severity: {metrics.highAndCriticalRiskCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('assessments')}>
        <Tooltip describeChild title="Click to go to Assessments tab. Assessments not yet completed." arrow>
          <Typography variant="caption" color="text.secondary">
            Assessments Open
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.openAssessmentCount}</Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('risk_management_plan')}>
        <Tooltip describeChild title="Click to go to Risk Management Plan tab. Assessment-linked risk management plans and currently open plan actions." arrow>
          <Typography variant="caption" color="text.secondary">
            Risk Management Plans
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.assessmentsWithPlansCount}</Typography>
        <Typography variant="body2" color="text.secondary">
          Open Actions: {metrics.openPlanActionCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('compliance')}>
        <Tooltip describeChild title="Click to go to Compliance tab. Implemented controls versus applicable controls." arrow>
          <Typography variant="caption" color="text.secondary">
            SoA Coverage
          </Typography>
        </Tooltip>
        <Typography variant="h4">
          {metrics.implementedControlCount}/{metrics.applicableControlCount}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Implemented applicable controls
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('workflow_config')}>
        <Tooltip describeChild title="Click to go to Workflow & Config tab. Open workflow tasks with overdue and due-soon tracking." arrow>
          <Typography variant="caption" color="text.secondary">
            Workflow Tasks
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.openTaskCount}</Typography>
        <Typography variant="body2" color={metrics.overdueTaskCount > 0 ? 'error.main' : 'text.secondary'}>
          Overdue: {metrics.overdueTaskCount} | Due Soon: {metrics.dueSoonTaskCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('governance')}>
        <Tooltip describeChild title="Click to go to Governance tab. Governance documents registered: policies, processes, SOPs, and guidelines." arrow>
          <Typography variant="caption" color="text.secondary">
            Governance Documents
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.governanceDocumentCount}</Typography>
        <Typography variant="body2" color="text.secondary">
          Active: {metrics.activeGovernanceDocumentCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('threat_profile')}>
        <Tooltip describeChild title="Click to go to Threat Profiles tab. Threat actors and documented threat scenarios in the threat landscape registry." arrow>
          <Typography variant="caption" color="text.secondary">
            Threat Profiles
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.threatActorCount}</Typography>
        <Typography variant="body2" color="text.secondary">
          Actors | Scenarios: {metrics.threatScenarioCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('third_parties')}>
        <Tooltip describeChild title="Click to go to Third Parties tab. Third-party vendors and suppliers with risk rating tracking." arrow>
          <Typography variant="caption" color="text.secondary">
            Third Parties
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.thirdPartyCount}</Typography>
        <Typography variant="body2"
          color={metrics.highRiskThirdPartyCount > 0 ? 'error.main' : 'text.secondary'}>
          {metrics.highRiskThirdPartyCount} high/critical risk
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('initiatives')}>
        <Tooltip describeChild title="Click to go to Initiatives tab. Strategic security improvement programs with milestone tracking." arrow>
          <Typography variant="caption" color="text.secondary">
            Security Initiatives
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.initiativeCount}</Typography>
        <Typography variant="body2"
          color={metrics.overdueInitiativeCount > 0 ? 'error.main' : 'text.secondary'}>
          Active: {metrics.activeInitiativeCount}{metrics.overdueInitiativeCount > 0 ? ` | Overdue: ${metrics.overdueInitiativeCount}` : ''}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('controls')}>
        <Tooltip describeChild title="Click to go to Controls tab. Registry of implemented security mechanisms with review tracking." arrow>
          <Typography variant="caption" color="text.secondary">
            Implemented Controls
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.implementedControlRegistryCount}</Typography>
        <Typography variant="body2" color="text.secondary">
          Active: {metrics.activeImplementedControlRegistryCount}
        </Typography>
        {metrics.controlsOverdueForReviewCount > 0 && (
          <Typography variant="body2" color="error.main">
            Overdue for Review: {metrics.controlsOverdueForReviewCount}
          </Typography>
        )}
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('risks')}>
        <Tooltip describeChild title="Click to go to Risks tab. Risks whose inherent score meets or exceeds their resolved appetite threshold." arrow>
          <Typography variant="caption" color="text.secondary">
            Appetite Breaches
          </Typography>
        </Tooltip>
        <Typography variant="h4" color={metrics.appetiteBreachCount > 0 ? 'error.main' : 'text.primary'}>
          {metrics.appetiteBreachCount}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          of {metrics.riskCount} risks
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('findings')}>
        <Tooltip describeChild title="Click to go to Findings tab. Security findings from rule engine analysis and manual entries." arrow>
          <Typography variant="caption" color="text.secondary">
            Findings
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.findingCount}</Typography>
        <Typography variant="body2" color={metrics.criticalHighFindingCount > 0 ? 'error.main' : 'text.secondary'}>
          Open: {metrics.openFindingCount} | Critical/High: {metrics.criticalHighFindingCount}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('risks')}>
        <Tooltip describeChild title="Click to go to Risks tab. Risk acceptances that are pending review or have expired." arrow>
          <Typography variant="caption" color="text.secondary">
            Risk Acceptances
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.pendingAcceptanceCount + metrics.expiredAcceptanceCount}</Typography>
        <Typography variant="body2"
          color={metrics.expiredAcceptanceCount > 0 ? 'error.main' : 'text.secondary'}>
          Pending: {metrics.pendingAcceptanceCount}{metrics.expiredAcceptanceCount > 0 ? ` | Expired: ${metrics.expiredAcceptanceCount}` : ''}
        </Typography>
      </Paper>
      <Paper sx={clickableSx} onClick={() => onSwitchTab?.('incidents')}>
        <Tooltip describeChild title="Click to go to Incidents tab. Security incidents with open/active tracking." arrow>
          <Typography variant="caption" color="text.secondary">
            Incidents
          </Typography>
        </Tooltip>
        <Typography variant="h4">{metrics.incidentCount}</Typography>
        <Typography variant="body2"
          color={metrics.openIncidentCount > 0 ? 'error.main' : 'text.secondary'}>
          Open: {metrics.openIncidentCount}
        </Typography>
      </Paper>
      <Paper sx={{ ...cardSx, gridColumn: '1 / -1' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Risk Distribution
        </Typography>
        {riskRatingEntries.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No risk ratings yet.
          </Typography>
        )}
        {riskRatingEntries.map(([rating, count]) => (
          <Box key={rating} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">{rating}</Typography>
              <Typography variant="body2">{count}</Typography>
            </Box>
            <Box sx={{ width: '100%', height: 10, backgroundColor: 'action.hover', borderRadius: 99 }}>
              <Box
                sx={{
                  width: `${(count / totalRiskCountForChart) * 100}%`,
                  height: '100%',
                  borderRadius: 99,
                  backgroundColor: ratingColorMap(rating, config)
                }}
              />
            </Box>
          </Box>
        ))}
      </Paper>
      {workspace.controlSets.length > 0 && (
        <Paper sx={{ ...cardSx, gridColumn: '1 / -1' }} onClick={() => onSwitchTab?.('compliance')} style={{ cursor: 'pointer' }}>
          <Tooltip describeChild title="Click to go to Compliance tab. Per-framework implementation coverage across applicable controls." arrow>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Framework Coverage
            </Typography>
          </Tooltip>
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
    </Box>
  );
};

export default GrcDashboardTab;
