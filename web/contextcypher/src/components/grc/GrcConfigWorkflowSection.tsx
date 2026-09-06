import React, { useMemo } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Box,
  Chip,
  Paper,
  Typography
} from '@mui/material';
import { CheckCircle, ChevronDown } from 'lucide-react';
import { computeWorkflowHealth } from '../../services/GrcWorkspaceService';
import { GrcTabProps, cardSx } from './grcShared';
import GrcRiskMatrixPreview from './GrcRiskMatrixPreview';

const GrcConfigWorkflowSection: React.FC<GrcTabProps> = ({ workspace, onSwitchTab }) => {
  const workflowHealth = useMemo(() => computeWorkflowHealth(workspace), [workspace]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Workflow Health</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
          <Badge badgeContent={workflowHealth.orphanRiskCount} color="warning" max={999}>
            <Chip label="Orphan Risks" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('risks')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.unmitigatedHighRiskCount} color="error" max={999}>
            <Chip label="Unmitigated High Risks" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('risks')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.appetiteBreachCount} color="error" max={999}>
            <Chip label="Appetite Breaches" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('risks')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.controlsWithoutRiskLinksCount} color="warning" max={999}>
            <Chip label="Controls Without Risk Links" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('compliance')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.implementedControlsWithoutEvidenceCount} color="warning" max={999}>
            <Chip label="Implemented Without Evidence" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('compliance')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={`${workflowHealth.assessmentCoveragePercent}%`} color="info" max={999}>
            <Chip label="Assessment Coverage" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('assessments')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.overdueTaskCount} color="error" max={999}>
            <Chip label="Overdue Tasks" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('workflow_config')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.dueSoonTaskCount} color="warning" max={999}>
            <Chip label="Due Soon" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('workflow_config')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.governanceOverdueReviewCount} color="error" max={999}>
            <Chip label="Governance Reviews Overdue" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('governance')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.stalledInitiativeCount} color="warning" max={999}>
            <Chip label="Stalled Initiatives" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('initiatives')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.overdueInitiativeMilestoneCount} color="error" max={999}>
            <Chip label="Overdue Milestones" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('initiatives')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          {workflowHealth.implementedControlsOverdueReviewCount > 0 && (
            <Badge badgeContent={workflowHealth.implementedControlsOverdueReviewCount} color="error" max={999}>
              <Chip label="Controls Review Overdue" size="small" variant="outlined"
                onClick={() => onSwitchTab?.('controls')}
                sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
            </Badge>
          )}
          <Badge badgeContent={workflowHealth.expiredAcceptanceCount} color="error" max={999}>
            <Chip label="Expired Acceptances" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('risks')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.pendingReviewAcceptanceCount} color="warning" max={999}>
            <Chip label="Pending Review Acceptances" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('risks')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.pendingAuditCount} color="warning" max={999}>
            <Chip label="Pending Audits" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('controls')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
          <Badge badgeContent={workflowHealth.staleOpenIncidentCount} color="error" max={999}>
            <Chip label="Stale Open Incidents" size="small" variant="outlined"
              onClick={() => onSwitchTab?.('incidents')}
              sx={{ cursor: onSwitchTab ? 'pointer' : 'default' }} />
          </Badge>
        </Box>
        <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Recommended Next Actions</Typography>
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          {workflowHealth.recommendedActions.map(action => (
            <Box key={action} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <CheckCircle size={16} />
              <Typography variant="body2">{action}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper sx={cardSx}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Risk Matrix In Use</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Current model: {workspace.riskModel.likelihoodScale.length} likelihood levels x {workspace.riskModel.impactScale.length} impact levels
          {' '}| Global appetite threshold: {workspace.riskModel.appetiteThresholdScore}
          {(workspace.appetiteRules || []).length > 0 && ` | ${workspace.appetiteRules.length} scoped appetite rule(s) may override this threshold per risk`}
        </Typography>
        <GrcRiskMatrixPreview
          likelihoodScale={workspace.riskModel.likelihoodScale}
          impactScale={workspace.riskModel.impactScale}
          appetiteThresholdScore={workspace.riskModel.appetiteThresholdScore}
          config={workspace.config}
          helperText="Use this matrix to align treatment priority and escalation in workflow tasks."
        />
      </Paper>

      <Paper sx={cardSx}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Practical Workflow Reference</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Follow this order for predictable outcomes: configure model and appetite rules, scope assets, capture findings,
          register risks and threat actors, map controls, assess third-party vendors, run assessments, maintain plans,
          govern with policies, execute tasks, then report.
        </Typography>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">1. End-to-End Operating Flow</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>
              1. Configuration: set likelihood/impact scales, rating bands (with presets available), global appetite threshold,
              scoped appetite rules, statement-based tier taxonomy (Tier 1-4), asset categories per domain, criticality scales,
              assessment scope types, maturity model levels, and AI assist context.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              2. Assets: sync from diagram nodes and connection flows, classify each asset by domain
              (IT, OT, Cloud, IoT, Application, Data, Network, Physical, People) and category, then set
              business and security criticality. Connection counts are auto-derived from diagram data flows.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              3. Findings: review rule-engine findings generated from diagram analysis or create manual findings.
              Categorise by type (DFD, Boundary, Data, Identity, Encryption, Availability, Logging, Config, Threat, AttackPath),
              assign STRIDE categories and CWE/OWASP mappings, then link findings to risks or quick-create new risks directly.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              4. Risks: quick-create Tier 2 or Tier 3 risks using the toggle + title form (Tier 4 risks are auto-generated
              from findings). Expand the row to set tier classification, likelihood/impact scoring, owner, due date, treatment
              strategy (mitigate, transfer, avoid, accept), link to assets and findings, optionally assign a threat actor,
              and track residual risk scores post-control. New risks default to mid-range likelihood/impact scores.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              5. Threat Profiles: register threat actors by type (nation-state, organised crime, insider, hacktivist,
              opportunistic, competitor, supply chain) with capability level (1-5), resource level, and motivation.
              Document threat scenarios with MITRE ATT&amp;CK techniques, targeted assets, and linked risks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              6. Compliance: import control frameworks via the framework picker or CSV/XLSX upload, set SoA applicability
              and implementation status per control, assign maturity levels, link controls to risks they mitigate, and attach
              evidence references including governance document links.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              7. Implemented Controls: register deployed security mechanisms (technologies, tools, policies, processes) with
              type, category, automation level, and ownership. Link controls to SoA entries they satisfy, risks they mitigate,
              assets they protect, and assessments that evaluate their effectiveness.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              8. Assessments: create scoped assessments (system, diagram, diagram segment/zone, asset group, application, OSI layer)
              with optional tier filters and linked threat actors. Seed with suggested scoped risks, build a mini threat model
              canvas from diagram nodes/edges, define attack-path traversal order, capture findings, recommendations,
              and evidence summaries. Link mitigating implemented controls and supporting initiatives.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              9. Risk Management Plans: each assessment has exactly one plan. Define objective, strategy, and residual statement,
              then create plan actions with owner, due date, priority, and treatment strategy. Convert open actions into
              workflow tasks for execution tracking.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              10. Governance: register policies, processes, SOPs, standards, guidelines, and frameworks with version, owner,
              status (draft/active/under review/archived/superseded), review dates, external URLs, and tags.
              Link documents to risks, control sets, and assessments for cross-referencing.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              11. Third-Party Risk: register vendor profiles by category (cloud provider, SaaS, managed service, contractor,
              supplier, partner) with risk rating, data classification, contract expiry, and review dates.
              Link vendors to assets they support and risks they introduce.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              12. Security Initiatives: define strategic security improvement programs (uplift, remediation, compliance,
              transformation, hardening) with current vs target state narratives, milestones with owners and due dates,
              and linkages to risks, control sets, assets, and assessments. Track progress through milestone completion.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              13. Task Board: auto-generate tasks from compliance gaps, appetite breaches, overdue governance reviews, and open
              SRMP actions. Create manual tasks with explicit links to risks, assessments, assets, control sets, and individual
              controls. Use template seeding (Onboarding, Monthly Cycle, Incident Response) for rapid task creation.
            </Typography>
            <Typography variant="body2">
              14. Dashboard + Reporting: review real-time posture metrics across all domains. Build custom charts or use
              pre-built analytics. Generate HTML reports (Executive Summary, Risk &amp; Compliance, Governance, Control &amp; Audit)
              with configurable sections. Export CSV files for assets, risks, findings, governance documents, third parties,
              SoA entries, threat profiles, plans, and tasks.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">2. How Components Link</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="subtitle2" sx={{ mb: 0.75, fontSize: '0.8rem', color: 'text.secondary' }}>Risk is the central hub. Most entities connect through risk linkages.</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assets to Risks: risks inherit operational context through linked asset IDs and criticality. Asset domain and
              criticality also drive scoped appetite rule matching.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Findings to Risks: findings provide evidence that substantiates risk scenarios. Each finding can be linked to
              existing risks or used to quick-create a new risk. Findings also appear as Tier 4 options in the risk register
              for granular classification.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Threat Actors to Risks: each risk can reference a threat actor whose type, capability, and motivation inform
              likelihood assessment. Threat scenarios link MITRE ATT&amp;CK techniques and targeted assets to specific risks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Appetite Rules to Risk Scoring: scoped appetite rules override the global threshold by asset domain, risk tier,
              or asset criticality. The most specific matching rule wins; ties break by lowest threshold.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Risks to Compliance: SoA controls reference the risk IDs they mitigate, creating a traceable treatment chain
              from risk through control implementation to evidence.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Third Parties to Assets and Risks: vendor profiles link to the assets they support (infrastructure, services)
              and the risks they introduce (supply chain, data handling, availability).
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assessments to Threat Actors: assessments can scope specific threat actors to focus the threat landscape
              under review and filter relevant scenarios.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assessment Threat Model to Diagram: mini canvas nodes/edges remain locked to diagram node/edge IDs.
              Attack-path traversal is an ordered sequence over imported edges. Double-click jumps to Diagram mode
              with focus/selection on the linked element.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assessments to Risk Management Plans: every assessment has exactly one plan (no standalone plan objects).
              Plan actions track treatment execution with owner, due date, priority, and linked risks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              SRMP to Task Board: open plan actions convert into executable workflow tasks with owner/due dates,
              maintaining the link back to the originating assessment and risks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Governance Documents to Risks/Controls/Assessments: policies and procedures link to the entities they govern.
              Governance documents also serve as evidence references in SoA entries.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Security Initiatives to Risks/Controls/Assets: initiatives link to the risks they address, control sets
              they implement, and assets they protect. Milestone progress tracks strategic improvement delivery.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assessments to Implemented Controls: assessments can reference mitigating controls that are
              deployed to address identified risks within the assessment scope.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assessments to Initiatives: assessments can reference initiatives that justify risk acceptance
              or document strategic treatment programs tied to assessment findings.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Implemented Controls to Assessments: controls link back to the assessments that evaluate
              their effectiveness or depend on their deployment.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Initiatives to Assessments: initiatives link back to the assessments whose findings or
              risk treatment decisions they support.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Compliance Gaps to Task Board: auto-generated tasks flag risks without treatment, controls without evidence,
              appetite breaches requiring escalation, and overdue governance reviews.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Deletion Hygiene: deleting assets, risks, or other entities automatically removes stale links from all
              dependent entities to prevent orphaned references across the workspace.
            </Typography>
            <Typography variant="body2">
              Dashboard + Reporting aggregates state from all tabs: asset counts, risk distribution, finding severity,
              control coverage, task progress, governance status, third-party risk ratings, and threat actor profiles
              drive posture metrics, custom charts, and exportable reports.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">3. Scope-Driven Assessment Playbook</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>
              1. Choose scope items from enabled types (system, diagram, diagram segment/zone, asset group, application, OSI layer).
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              2. Apply optional tier filters (Tier 1-4 cascade) to narrow the risk set to relevant categories.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              3. Link relevant threat actors to focus the threat landscape under assessment.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              4. Use "Suggested Scope Risks" to seed the assessment workspace quickly, then adjust manually.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              5. Build the mini threat model canvas by importing diagram nodes and edges, then define traversal order
              for the attack path and annotate node/edge commentary. Use zone-based import to pull an entire
              security-zone section quickly.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              6. Capture findings, recommendations, and evidence summary. Link findings to risks for traceability.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              7. Open the Risk Management Plan to define objectives, strategy, and create plan actions with owners and due dates.
              Convert actions into workflow tasks for execution tracking.
            </Typography>
            <Typography variant="body2">
              8. In Diagram mode, use "Open Zone Assessment" / "Open Zone SRMP" near Security Zone fields to jump directly
              into the matching scoped workspace.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">4. Practical Operating Cadence</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Weekly: refresh asset inventory from diagram changes, triage new findings, update risk status and treatment progress,
              update SoA implementation/evidence, review appetite breaches, check third-party review dates, and clear overdue tasks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Monthly: run priority scoped assessments, refresh SRMP plan actions, review governance document status and overdue reviews,
              update threat actor profiles with new intelligence, review third-party risk ratings, and export reporting pack.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Quarterly: review and update risk appetite rules, validate tier taxonomy alignment, audit control framework coverage,
              assess third-party vendor contract renewals, and generate executive summary reports.
            </Typography>
            <Typography variant="body2">
              Incident: update affected risks and controls first, review relevant threat actor profiles and scenarios,
              create or update findings with evidence, run a targeted scoped assessment on impacted zones,
              then drive closure via SRMP-linked workflow tasks.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">5. Diagram &amp; Attack Path Integration</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Snapshot Mechanism: whenever the diagram changes (nodes added/removed/moved, edges modified, security zones updated),
              the DiagramEditor fires onDiagramContextChange which produces a DiagramContextSnapshot. This snapshot is stored in
              App.tsx state and passed as a prop to every GRC tab, giving each tab a read-only, always-current view of the
              architecture without coupling GRC logic to ReactFlow internals.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              GRC Tabs That Use Diagram Data: Assets syncs inventory from diagram nodes and connection flows.
              Findings can originate from diagram rule-engine analysis. Risks can reference diagram nodes and security zones.
              Compliance maps SoA controls to diagram nodes for spatial coverage analysis. Assessments import nodes/edges
              for threat model canvases and attack-path traversal.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              GRC-Internal Tabs (No Diagram Dependency): Dashboard, Risk Management Plan, Threat Profile, Governance,
              Third Parties, Reporting, and Configuration operate entirely on GRC workspace data. They aggregate, summarize,
              and export information already captured by the diagram-linked tabs above, so they function correctly even when
              no diagram is loaded.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Attack Path Lifecycle: attack paths originate in the AttackPathsPanel within the Diagram Editor, where
              analysts define ordered sequences of nodes and edges representing adversary traversal. From there, paths
              are imported into a scoped Assessment where each node and edge can be annotated with commentary, likelihood
              notes, and control references. The assessment then generates findings from path analysis, and those findings
              feed into risk treatment plans and SRMP actions for remediation tracking.
            </Typography>
            <Typography variant="body2">
              Methodology Support: the threat model canvas and attack path workflow support both STRIDE
              (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
              and PASTA (Process for Attack Simulation and Threat Analysis) methodologies. STRIDE categories can be
              assigned per node or edge in the canvas, while PASTA stages map naturally to the assessment lifecycle:
              define objectives (scope), define technical scope (diagram import), application decomposition (node analysis),
              threat analysis (attack paths), vulnerability analysis (findings), and attack modeling (traversal simulation).
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">6. Tab Quick Reference</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Dashboard: read-only posture overview with clickable cards for assets, risks, findings, controls,
              tasks, governance, threat actors, third parties, and appetite breaches. Framework coverage shows
              per-control-set implementation progress.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assets: asset inventory with 9 domain types, category classification, business/security criticality,
              diagram sync (nodes and connection flows), and column customization.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Findings: rule-engine and manual findings with severity, status tracking, STRIDE/CWE/OWASP categorisation,
              risk linking, and quick-create risk from any finding.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Risks: full risk register with tier path classification (Tier 1-4), likelihood/impact matrix scoring,
              inherent and residual scores, treatment strategy, linked assets/findings/threat actors, appetite breach detection,
              and finding-based Tier 4 selection.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Compliance: multi-framework SoA management with CSV/XLSX import, framework picker, scoped applicability
              (system or diagram), implementation status, maturity levels, risk-to-control mapping, and evidence references.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Controls: registry of implemented security mechanisms (technologies, tools, policies, processes) linked to
              SoA entries, risks, and assets. Track control effectiveness, review dates, ownership, and evidence.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Assessments: scoped assessment workspaces with tier filters, threat actor linking, mini threat model canvas,
              attack-path traversal ordering, findings capture, and HTML/TXT export.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Risk Management Plans: one plan per assessment with objective, strategy, and action tracking.
              Actions have owner, due date, priority, treatment strategy, and linked risks. Open actions convert to tasks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Governance: document registry for policies, processes, SOPs, standards, guidelines, and frameworks
              with version control, review date tracking, external URLs, tags, and cross-links to risks/controls/assessments.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Threat Profiles: threat actor registry (7 types, capability 1-5, resource levels) with targeted asset/domain mapping.
              Threat scenarios with MITRE ATT&amp;CK techniques, linked risks, and assessment references.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Third Parties: vendor profiles by category with risk rating, data classification, contract expiry,
              review dates, and linkages to assets and risks.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Initiatives: strategic security improvement programs with category (uplift, remediation, compliance,
              transformation, hardening), current/target state narratives, milestone tracking with progress bars,
              and linkages to risks, control sets, and assets.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Reporting: pre-built analytics charts, custom chart builder, 4 HTML report templates with configurable sections,
              and CSV bulk export for all major entities.
            </Typography>
            <Typography variant="body2">
              Workflow &amp; Config: workflow health indicators, task board with template seeding and gap generation,
              risk model scales and matrix, tier taxonomy, scoped appetite rules, rating band presets, asset categories,
              assessment scope types, maturity models, config import/export, and a comprehensive Technical Reference
              covering entity types, relationships, status lifecycles, scoring, deletion behaviour, and integration points.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <Typography variant="subtitle2">7. Configuration Reference</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Risk Model: define the likelihood scale (e.g. Rare/Unlikely/Possible/Likely/Almost Certain) and impact
              scale (e.g. Negligible/Minor/Moderate/Major/Severe) with numeric weights (3-10 levels each). The matrix
              auto-calculates scores from likelihood x impact. Set the global appetite threshold score above which any
              risk is flagged as a breach requiring escalation. All existing risks are automatically rescored when the
              model changes.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Risk Taxonomy (Tiers): build a hierarchical statement taxonomy across four tiers. Tier 1 captures
              strategic risk themes, Tier 2 breaks those into board-level risk categories, Tier 3 defines named
              risk scenarios, and Tier 4 provides granular control-level statements. Findings from the Findings tab
              also appear as Tier 4 options in the risk register. Every risk record can reference a tier path for
              consistent classification and aggregated reporting up the hierarchy.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Risk Appetite: create scoped override rules that replace the global appetite threshold for specific
              contexts. Rules can be scoped by asset domain (e.g. "Financial Systems"), risk tier path
              (e.g. Tier 1 "Operational Risk"), or asset criticality level (e.g. "Critical"). When multiple rules
              match a given risk, the most specific rule wins; ties break by the lowest threshold to enforce the
              most conservative posture.
            </Typography>
            <Typography variant="body2">
              Defaults &amp; Display: configure rating bands with presets (Default 6-level, Balanced 5-level, Compact 4-level)
              or custom definitions. Set asset categories per domain (9 domains available) and criticality scales (2-10 levels).
              Enable or disable assessment scope types (system, diagram, diagram segment, asset group, application, OSI layer)
              with protocol-to-OSI-layer mappings. Define record defaults, customize SoA applicability labels, set export
              filenames, configure maturity model levels for compliance scoring, and toggle AI assist with custom context strings.
              Full configuration can be imported/exported as JSON.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default GrcConfigWorkflowSection;
