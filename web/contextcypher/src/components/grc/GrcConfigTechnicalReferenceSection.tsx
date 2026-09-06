import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { GrcTabProps, cardSx } from './grcShared';

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{children}</Typography>
);

const Paragraph: React.FC<{ children: React.ReactNode; last?: boolean }> = ({ children, last }) => (
  <Typography variant="body2" sx={last ? undefined : { mb: 1 }}>{children}</Typography>
);

const CompactTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <TableContainer sx={{ mb: 1 }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          {headers.map(h => (
            <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>{h}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} sx={{ fontSize: '0.75rem', py: 0.5 }}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const GrcConfigTechnicalReferenceSection: React.FC<GrcTabProps> = ({ workspace }) => {
  const entityCount = (label: string, count: number) => (
    <Chip key={label} label={`${label}: ${count}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
  );

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>GRC Technical Reference</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Comprehensive reference for the GRC module's data model, entity relationships, status lifecycles,
          tier taxonomy, and integration points. Use this as a guide when building or auditing your workspace.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {entityCount('Assets', workspace.assets.length)}
          {entityCount('Findings', workspace.findings.length)}
          {entityCount('Risks', workspace.risks.length)}
          {entityCount('SoA Entries', workspace.soaEntries.length)}
          {entityCount('Control Sets', workspace.controlSets.length)}
          {entityCount('Assessments', workspace.assessments.length)}
          {entityCount('Tasks', workspace.workflowTasks.length)}
          {entityCount('Governance Docs', workspace.governanceDocuments.length)}
          {entityCount('Threat Actors', workspace.threatActors.length)}
          {entityCount('Threat Scenarios', workspace.threatScenarios.length)}
          {entityCount('Third Parties', workspace.thirdParties.length)}
          {entityCount('Initiatives', workspace.securityInitiatives.length)}
          {entityCount('Impl. Controls', workspace.implementedControls.length)}
          {entityCount('Risk Acceptances', (workspace.riskAcceptances || []).length)}
          {entityCount('Framework Mappings', (workspace.frameworkMappings || []).length)}
          {entityCount('Incidents', (workspace.incidents || []).length)}
          {entityCount('Appetite Rules', workspace.appetiteRules.length)}
          {entityCount('Tier Catalogue', workspace.tierCatalogue.length)}
        </Box>
      </Paper>

      <Paper sx={cardSx}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>1. Entity Types</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              The GRC module manages 15 entity types within a single workspace. Each entity type has a
              defined purpose, key fields, and linkages to other entities.
            </Paragraph>
            <CompactTable
              headers={['Entity', 'Purpose', 'Key Fields']}
              rows={[
                ['Asset', 'Hardware, software, data, or people that require protection', 'Name, domain, category, business/security criticality, diagram refs'],
                ['Finding', 'Observations from rule-engine analysis, manual review, or AI analysis', 'Title, type, severity, source, status, STRIDE, CWE/OWASP, linked nodes'],
                ['Risk', 'Potential threats or vulnerabilities that could impact the organisation', 'Title, tier path (T1-T4), likelihood, impact, score, treatment, owner'],
                ['SoA Entry', 'Statement of Applicability mapping a control to scope and risks', 'Control ID, applicability, implementation status, mitigated risks, evidence'],
                ['Control Set', 'A collection of controls from a framework (e.g. NIST 800-53, ISO 27001)', 'Name, framework, version, release date, controls array'],
                ['Assessment', 'Scoped evaluation of risks, controls, and threats', 'Title, scope items, tier filters, risk IDs, threat model canvas, SRMP'],
                ['Workflow Task', 'Actionable work item for treatment, review, or remediation', 'Title, type, priority, status, owner, due date, linked entities'],
                ['Governance Doc', 'Policy, procedure, SOP, standard, or guideline', 'Title, type, status, owner, version, review dates, external URL, tags'],
                ['Threat Actor', 'Known or hypothetical adversary', 'Name, type, capability (1-5), resource level, motivation, targeted assets'],
                ['Threat Scenario', 'Documented attack narrative linking actors, techniques, and targets', 'Title, actor, ATT&CK techniques, targeted assets, linked risks'],
                ['Third Party', 'External vendor, supplier, or partner', 'Name, category, risk rating, data classification, contract expiry, review dates'],
                ['Security Initiative', 'Strategic improvement program', 'Title, category, status, priority, milestones, current/target state'],
                ['Implemented Control', 'Deployed security mechanism', 'Title, type, category, automation level, vendor/product, review dates'],
                ['Risk Acceptance', 'Formal acceptance of a risk with conditions and expiry', 'Title, scope type, status, justification, effective/expiration dates'],
                ['Framework Mapping', 'Cross-framework control equivalence mapping', 'Source/target control set and ID, relationship type, notes'],
                ['Incident', 'Security incident from detection through resolution', 'Title, severity, status, detected/resolved/closed dates, timeline, lessons learned'],
                ['Appetite Rule', 'Scoped override of global risk appetite threshold', 'Scope (domain, tier, criticality), threshold score'],
                ['Tier Catalogue Node', 'Hierarchical risk taxonomy entry', 'Label, tier (1-4), parent ID, description'],
              ]}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>2. Entity Relationships</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              Risk is the central hub of the GRC model. Most entities connect through risk linkages,
              creating traceability chains from diagram architecture through threat identification to
              control implementation and treatment execution.
            </Paragraph>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Diagram → GRC
            </Typography>
            <CompactTable
              headers={['From', 'To', 'Link Field', 'Direction']}
              rows={[
                ['Diagram Nodes', 'Assets', 'asset.diagramRefs[].nodeId', 'Sync from diagram'],
                ['Diagram Analysis', 'Findings', 'finding.relatedNodeIds[]', 'Rule engine import'],
                ['Diagram Attack Paths', 'Assessment Canvas', 'assessment.threatModel.attackPaths[]', 'Import into assessment'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Asset Linkages
            </Typography>
            <CompactTable
              headers={['From', 'To', 'Link Field']}
              rows={[
                ['Asset', 'Risk', 'risk.assetIds[]'],
                ['Asset', 'Threat Actor', 'actor.targetedAssetIds[]'],
                ['Asset', 'Threat Scenario', 'scenario.targetedAssetIds[]'],
                ['Asset', 'Third Party', 'thirdParty.linkedAssetIds[]'],
                ['Asset', 'Impl. Control', 'implControl.linkedAssetIds[]'],
                ['Asset', 'Initiative', 'initiative.linkedAssetIds[]'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Risk Linkages (Central Hub)
            </Typography>
            <CompactTable
              headers={['From', 'To', 'Link Field']}
              rows={[
                ['Finding', 'Risk', 'finding.linkedRiskIds[] + risk.sourceFindingId'],
                ['Risk', 'SoA Entry', 'soaEntry.mitigatesRiskIds[]'],
                ['Risk', 'Assessment', 'assessment.riskIds[]'],
                ['Risk', 'Workflow Task', 'task.riskId'],
                ['Risk', 'Threat Actor', 'risk.threatActorIds[]'],
                ['Risk', 'Threat Scenario', 'scenario.linkedRiskIds[]'],
                ['Risk', 'Governance Doc', 'document.linkedRiskIds[]'],
                ['Risk', 'Third Party', 'thirdParty.linkedRiskIds[]'],
                ['Risk', 'Initiative', 'initiative.linkedRiskIds[]'],
                ['Risk', 'Impl. Control', 'implControl.linkedRiskIds[]'],
                ['Risk', 'Appetite Rule', 'Resolved per-risk via specificity matching'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Assessment Linkages
            </Typography>
            <CompactTable
              headers={['From', 'To', 'Link Field']}
              rows={[
                ['Assessment', 'SRMP Actions', 'assessment.riskManagementPlan.actions[]'],
                ['Assessment', 'Impl. Control', 'assessment.linkedImplementedControlIds[]'],
                ['Assessment', 'Initiative', 'assessment.linkedInitiativeIds[]'],
                ['Assessment', 'Threat Actor', 'assessment.threatActorIds[]'],
                ['Assessment', 'Canvas Nodes', 'assessment.threatModel.nodes/edges[]'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Compliance & Governance Linkages
            </Typography>
            <CompactTable
              headers={['From', 'To', 'Link Field']}
              rows={[
                ['SoA Entry', 'Evidence', 'soaEntry.evidence[]'],
                ['Impl. Control', 'SoA Entry', 'implControl.linkedSoaEntryIds[]'],
                ['Impl. Control', 'Assessment', 'implControl.linkedAssessmentIds[]'],
                ['Governance Doc', 'Risk', 'document.linkedRiskIds[]'],
                ['Governance Doc', 'Control Set', 'document.linkedControlSetIds[]'],
                ['Governance Doc', 'Assessment', 'document.linkedAssessmentIds[]'],
                ['Initiative', 'Control Set', 'initiative.linkedControlSetIds[]'],
                ['Initiative', 'Assessment', 'initiative.linkedAssessmentIds[]'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Task Generation Sources
            </Typography>
            <CompactTable
              headers={['Source', 'Task Type', 'Trigger']}
              rows={[
                ['Unmitigated Risks', 'Risk treatment', 'High/critical risk with no SoA mitigations'],
                ['Missing Evidence', 'Evidence collection', 'Impl. control without attached evidence'],
                ['Appetite Breach', 'Escalation', 'Risk score exceeds resolved appetite threshold'],
                ['Governance Review', 'Review', 'Document past its next review date'],
                ['Third-Party Review', 'Review', 'Vendor past its next review date'],
                ['Control Review', 'Review', 'Impl. control past its next review date'],
                ['SRMP Actions', 'Treatment', 'Open plan action converted to workflow task'],
                ['Finding', 'Remediation', 'Manual task creation from finding'],
              ]}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>3. Tier Taxonomy Model</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              Risks are classified using a four-tier hierarchy that flows upward. Each risk carries a tier path
              (tier1 → tier2 → tier3 → tier4) for consistent classification and aggregated reporting.
            </Paragraph>
            <CompactTable
              headers={['Tier', 'Purpose', 'Source', 'Editable in Risk Detail']}
              rows={[
                ['Tier 1', 'Enterprise-level risk domain', 'Auto-set from catalogue root', 'No (inherited from catalogue)'],
                ['Tier 2', 'Board-level risk categories', 'User-selected from catalogue or set at creation', 'Yes — dropdown select'],
                ['Tier 3', 'Named risk scenarios', 'User-selected from catalogue or set at creation', 'Yes — dropdown (filtered by T2 parent)'],
                ['Tier 4', 'Operational evidence', 'Auto-derived from linked findings', 'Read-only chip (findings-based)'],
              ]}
            />
            <Paragraph>
              The risk creation form offers a Tier 2 or Tier 3 toggle. Tier 4 risks are generated
              automatically when findings are linked to risks via the source finding reference.
            </Paragraph>
            <Paragraph>
              When editing a risk's expanded detail, the visible tier selects are scoped to the
              risk's level: Tier 2 risks show only the Tier 2 dropdown, Tier 3 risks show
              Tier 2 + Tier 3, and Tier 4 risks show Tier 2 + Tier 3 plus a read-only Tier 4 chip.
            </Paragraph>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Default Tier 2 Categories (6 board-level risk categories)
            </Typography>
            <CompactTable
              headers={['Category', 'Description']}
              rows={[
                ['Critical System Disruption', 'Critical systems become unavailable due to cyber attacks or technical failures'],
                ['Unauthorised Access', 'Unauthorised access caused by credential compromise or access control failures'],
                ['Data Breach', 'Sensitive data exposed through technical attacks, insider threats, or process failures'],
                ['System Integrity', 'Systems maliciously modified via malware, supply chain compromise, or insider actions'],
                ['Cyber Detection', 'Incidents not detected or contained due to insufficient monitoring or response capability'],
                ['Third Party Security', 'Incidents originating from third parties via supply chain compromise or vendor access'],
              ]}
            />
            <Paragraph last>
              Tier 3 contains 35 named risk scenarios (GRCT3001–GRCT3035) mapped to Tier 2 categories.
              Tier 3 can also be imported from CSV/TSV. The tier catalogue is managed in the Risk Statements
              section of Workflow & Config.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>4. Status Lifecycles</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <CompactTable
              headers={['Entity', 'Statuses', 'Typical Flow']}
              rows={[
                ['Risk', 'draft, assessed, treated, accepted, closed', 'draft → assessed → treated → closed'],
                ['Finding', 'open, in_review, accepted, mitigated, dismissed', 'open → in_review → mitigated'],
                ['Assessment', 'planned, in_progress, completed, archived', 'planned → in_progress → completed'],
                ['Workflow Task', 'open, in_progress, blocked, completed, cancelled', 'open → in_progress → completed'],
                ['Governance Doc', 'draft, active, under_review, archived, superseded', 'draft → active → under_review → active'],
                ['Third Party', 'active, under_review, onboarding, offboarding, terminated', 'onboarding → active → under_review'],
                ['Initiative', 'proposed, approved, in_progress, on_hold, completed, cancelled', 'proposed → approved → in_progress → completed'],
                ['Impl. Control', 'active, planned, under_review, deprecated, inactive', 'planned → active → under_review → active'],
                ['SoA Entry', 'not_applicable, planned, partial, implemented', 'planned → partial → implemented'],
                ['Milestone', 'pending, in_progress, completed, skipped', 'pending → in_progress → completed'],
                ['Risk Acceptance', 'draft, pending_review, approved, rejected, expired', 'draft → pending_review → approved'],
                ['Control Audit', 'pass, fail, partial, pending', 'pending → pass/fail/partial'],
                ['Incident', 'identified, triaged, investigating, contained, resolved, closed', 'identified → triaged → investigating → contained → resolved → closed'],
              ]}
            />
            <Paragraph last>
              Status transitions are not enforced — any status can be set directly. The typical flows
              above represent recommended progression. Dashboard and workflow health indicators monitor
              statuses to surface items requiring attention.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>5. Risk Scoring Model</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              Risk scores are computed from a configurable likelihood × impact matrix. Both scales
              support 3–10 levels with numeric weights. The raw score is the product of the selected
              likelihood and impact values.
            </Paragraph>
            <CompactTable
              headers={['Concept', 'Description']}
              rows={[
                ['Inherent Score', 'Likelihood × Impact before any controls applied. Set at creation (mid-range defaults), editable inline.'],
                ['Residual Score', 'Likelihood × Impact after controls applied. Optional, editable in expanded detail.'],
                ['Rating Label', 'Human-readable band (e.g. Critical, High, Medium, Low) derived from score thresholds.'],
                ['Rating Colour', 'Visual severity indicator from the rating band definition.'],
                ['Global Appetite', 'Workspace-wide threshold score. Risks exceeding this are flagged as appetite breaches.'],
                ['Scoped Appetite', 'Override rules by asset domain, tier path, or criticality. Most specific match wins; ties break by lowest threshold.'],
                ['Rescoring', 'When the risk model scales change, all existing risks are automatically rescored.'],
              ]}
            />
            <Paragraph>
              Current model: {workspace.riskModel.likelihoodScale.length} likelihood
              levels × {workspace.riskModel.impactScale.length} impact levels.
              Global appetite threshold: {workspace.riskModel.appetiteThresholdScore}.
              {workspace.appetiteRules.length > 0 && ` ${workspace.appetiteRules.length} scoped appetite rule(s) active.`}
            </Paragraph>
            <Paragraph last>
              Rating band presets are available (6-level, 5-level, 4-level) or custom bands can be defined
              with label, numeric value, threshold ratio, and colour.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>6. Deletion Behaviour & Referential Integrity</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              When an entity is deleted, stale references are automatically cleaned from all
              linked entities. This prevents orphaned IDs and broken cross-references.
            </Paragraph>
            <CompactTable
              headers={['Deleted Entity', 'Cleaned From']}
              rows={[
                ['Asset', 'Risks (assetIds), Threat Actors (targetedAssetIds), Threat Scenarios (targetedAssetIds), Workflow Tasks (assetId)'],
                ['Risk', 'SoA Entries (mitigatesRiskIds), Assessments (riskIds), SRMP Actions (linkedRiskIds), Tasks (riskId), Scenarios (linkedRiskIds), Governance Docs (linkedRiskIds), Findings (linkedRiskIds)'],
                ['Finding', 'Risks (sourceFindingId cleared), Tasks (sourceFindingId cleared)'],
                ['Assessment', 'No reverse cleanup required (standalone)'],
                ['Governance Doc', 'No reverse cleanup required (standalone)'],
                ['Third Party', 'No reverse cleanup required (standalone)'],
                ['Impl. Control', 'No reverse cleanup required (standalone)'],
                ['Initiative', 'No reverse cleanup required (standalone)'],
                ['Workflow Task', 'No reverse cleanup required (standalone)'],
              ]}
            />
            <Paragraph last>
              Entities marked "standalone" for deletion do not trigger cascade cleanup because they are
              referenced by ID from other entities (not the reverse). Future iterations may add reverse
              cleanup for these types.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>7. Assessment Model</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              Assessments are scoped evaluations that bring together risks, controls, threats, and
              evidence into a structured workspace.
            </Paragraph>
            <CompactTable
              headers={['Component', 'Description']}
              rows={[
                ['Scope Items', 'One or more scope entries: system, diagram, diagram segment/zone, asset group, application, OSI layer'],
                ['Tier Filters', 'Optional Tier 1-4 cascade to narrow the risk set to relevant categories'],
                ['Linked Risks', 'Risks in scope, seeded from suggested scope risks or manually selected'],
                ['Threat Actors', 'Optional multi-select to focus the threat landscape under assessment'],
                ['Threat Model Canvas', 'Mini diagram built by importing nodes/edges from the architecture diagram'],
                ['Attack Paths', 'Named attack paths imported from diagram; ordered edge traversal with STRIDE categories'],
                ['Risk Management Plan', 'One SRMP per assessment: objective, strategy, residual statement, action register'],
                ['Linked Impl. Controls', 'Deployed controls mitigating risks within the assessment scope'],
                ['Linked Initiatives', 'Initiatives justifying risk acceptance or strategic treatment decisions'],
                ['Related Findings', 'Findings derived from linked risks matching the assessment tier filter'],
              ]}
            />
            <Paragraph last>
              Zone-based navigation: the diagram node editor exposes shortcuts to open matching
              zonal assessment/SRMP workspaces in GRC. Double-clicking a linked canvas node or edge
              switches back to Diagram mode and focuses the original element.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>8. Persistence & Export</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <CompactTable
              headers={['Aspect', 'Behaviour']}
              rows={[
                ['Single-file persistence', 'Diagram save/save-as includes the full GRC workspace payload in the same JSON file'],
                ['File open', 'Restores GRC workspace when present; initialises defaults when absent'],
                ['Navigation state', 'Active tab, expanded rows, and section state are runtime-only (not saved to file)'],
                ['Evidence storage', 'Metadata references only (links and file references). No binary blobs in save files.'],
                ['Schema version', 'GRC workspace uses schemaVersion "1.0". Hydration normalises missing fields on load.'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              CSV Exports (via Reporting tab)
            </Typography>
            <CompactTable
              headers={['Export', 'Contents']}
              rows={[
                ['Assets', 'Name, domain, category, business/security criticality, linked risk count'],
                ['Risks', 'Title, tier path, score, rating, likelihood, impact, treatment, owner, status'],
                ['SoA Entries', 'Control ID, control set, applicability, implementation status, mitigated risks'],
                ['Workflow Tasks', 'Title, type, priority, status, owner, due date, linked entities'],
                ['Plans (SRMP)', 'Assessment title, objective, strategy, action details'],
                ['Threat Profiles', 'Actors + scenarios with types, capabilities, techniques'],
                ['Appetite Rules', 'Scope fields, threshold scores'],
                ['Governance Docs', 'Title, type, status, owner, version, review dates'],
                ['Findings', 'Title, type, severity, source, status, STRIDE, linked entities'],
                ['Third Parties', 'Name, category, risk rating, data classification, contact, dates'],
                ['Initiatives', 'Title, category, status, priority, milestone progress'],
                ['Impl. Controls', 'Title, type, category, status, automation level, review dates'],
                ['Risk Acceptances', 'Title, risk, scope, status, justification, effective/expiration dates'],
                ['Framework Mappings', 'Source/target sets and controls, relationship type, notes'],
                ['Incidents', 'Title, severity, status, detected/resolved/closed dates, owner, linked entities'],
              ]}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Report Templates (HTML/PDF/TXT via Reporting tab)
            </Typography>
            <Paragraph last>
              Four configurable report templates: Executive Summary, Risk & Compliance,
              Governance, and Control & Audit. Each template has configurable section visibility,
              ordering, reset, preview, and download. Custom charts built in the chart builder
              are also rendered in reports.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>9. Backend API Surface</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              GRC routes are mounted at /api/grc. AI analysis uses the shared /api/chat and
              /api/chat/stream endpoints with additional GRC context injected from workspace settings.
            </Paragraph>
            <CompactTable
              headers={['Endpoint', 'Purpose']}
              rows={[
                ['GET /api/grc/metadata', 'Returns GRC module metadata and capabilities'],
                ['POST /api/grc/score-risk', 'Calculates risk score from likelihood/impact inputs'],
                ['POST /api/grc/report/summary', 'Generates summary report data'],
                ['POST /api/grc/report/charts', 'Generates chart data for reporting'],
                ['POST /api/grc/import/tier3-catalogue/preview', 'Preview Tier 3 CSV/TSV import before committing'],
                ['POST /api/grc/import/tier3-catalogue', 'Import Tier 3 risk scenarios from CSV/TSV'],
                ['POST /api/grc/import/control-set/preview', 'Preview control set CSV/XLSX import'],
                ['POST /api/grc/import/control-set', 'Import control set from CSV/XLSX'],
                ['GET /api/grc/frameworks/catalog', 'Returns built-in framework catalog with availability flags'],
                ['POST /api/grc/frameworks/load', 'Loads a built-in framework by key with optional family/tactic filters'],
              ]}
            />
            <Paragraph last>
              Available built-in frameworks: NIST SP 800-53 Rev 5.1, OWASP Top 10 2021,
              CSA CCM v4.0.10, MITRE ATT&CK (Enterprise/ICS/Mobile v14.1), IEC 62443-3-3,
              Australian ISM Dec 2025, Essential Eight Oct 2024, NIST CSF 2.0, ISO 27001:2022.
              Large frameworks support selective family/tactic loading.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>10. Diagram Integration Points</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              The diagram and GRC modules share state through App.tsx. Switching between modes
              preserves all data — the diagram uses CSS visibility toggling while GRC is
              conditionally mounted.
            </Paragraph>
            <CompactTable
              headers={['Integration', 'Mechanism', 'Used By']}
              rows={[
                ['Context Snapshot', 'DiagramEditor fires onDiagramContextChange with nodes, edges, zones', 'Assets (sync), Findings (node refs), Risks (diagram links)'],
                ['Asset Sync', 'Diagram nodes mapped to asset inventory entries', 'Assets tab'],
                ['Finding Import', 'Rule-engine findings synced with category/severity mapping', 'Findings tab'],
                ['Node Focus', 'grc-focus-diagram-node custom event switches to diagram and selects node', 'Risks, Findings, Assessments'],
                ['Attack Path Import', 'Named paths from AttackPathsPanel imported into assessment canvas', 'Assessments tab'],
                ['Zone Assessment', 'Security zone fields in node editor link to scoped assessments/SRMPs', 'DiagramEditor → Assessments'],
                ['Canvas Double-Click', 'Double-click linked canvas node/edge switches to Diagram mode', 'Assessments tab'],
                ['AI Context', 'Full diagram context included in GRC AI analysis prompts', 'AI Analysis Panel (all tabs)'],
              ]}
            />
            <Paragraph last>
              GRC-internal tabs (Dashboard, Risk Management Plan, Threat Profile, Governance,
              Third Parties, Initiatives, Reporting, Workflow & Config) operate entirely on
              workspace data and function correctly even when no diagram is loaded.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>11. Incidents</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <Paragraph>
              Incidents track security events from initial detection through investigation, containment,
              resolution, and formal closure. Each incident links to affected risks, assets, and findings
              for full traceability and post-incident analysis.
            </Paragraph>
            <CompactTable
              headers={['Field', 'Type', 'Description']}
              rows={[
                ['id', 'string', 'Unique identifier (auto-generated)'],
                ['title', 'string', 'Short descriptive title of the incident'],
                ['description', 'string', 'Detailed narrative of the incident'],
                ['severity', 'enum', 'critical | high | medium | low'],
                ['status', 'enum', 'identified | triaged | investigating | contained | resolved | closed'],
                ['detectedDate', 'ISO date', 'Date/time the incident was first detected'],
                ['resolvedDate', 'ISO date', 'Date/time the incident was resolved (optional)'],
                ['closedDate', 'ISO date', 'Date/time the incident was formally closed (optional)'],
                ['owner', 'string', 'Person or team responsible for managing the incident'],
                ['linkedRiskIds', 'string[]', 'IDs of risks associated with or caused by the incident'],
                ['linkedAssetIds', 'string[]', 'IDs of assets affected by the incident'],
                ['linkedFindingIds', 'string[]', 'IDs of findings related to the incident'],
                ['timelineEntries', 'array', 'Chronological log of incident activities'],
                ['  .id', 'string', 'Unique identifier for the timeline entry'],
                ['  .date', 'ISO date', 'Date/time of the timeline event'],
                ['  .description', 'string', 'Description of the activity or decision'],
                ['  .actor', 'string', 'Person or system that performed the activity'],
                ['lessonsLearned', 'string', 'Post-incident analysis and recommendations'],
                ['notes', 'string', 'Free-form notes and additional context'],
                ['createdAt', 'ISO date', 'Record creation timestamp'],
                ['updatedAt', 'ISO date', 'Record last-modified timestamp'],
              ]}
            />
            <Paragraph last>
              Workflow health tracks incidents open longer than 30 days as "stale". The dashboard
              surfaces open incident counts, and CSV export includes all fields with linked entity IDs.
            </Paragraph>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
            <SectionTitle>12. Configuration Options</SectionTitle>
          </AccordionSummary>
          <AccordionDetails>
            <CompactTable
              headers={['Setting Area', 'What You Configure']}
              rows={[
                ['Risk Model', 'Likelihood scale (3-10 levels), impact scale (3-10 levels), global appetite threshold'],
                ['Rating Bands', 'Label, numeric value, threshold ratio, colour per band. Presets: 6/5/4 level.'],
                ['Tier Taxonomy', 'Tier 1-3 hierarchy. Tier 4 auto-populated from findings.'],
                ['Appetite Rules', 'Scoped overrides by asset domain, tier path, and/or criticality minimum.'],
                ['Asset Categories', 'Category lists per domain (IT, OT, Cloud, IoT, Application, Data, Network, Physical, People).'],
                ['Criticality Scales', 'Business and security criticality labels and values (2-10 levels).'],
                ['Assessment Scopes', 'Enabled scope types, application options, OSI layer options, protocol-OSI mappings.'],
                ['Record Defaults', 'Default risk status, treatment strategy, Tier 1 label, asset domain/category/criticality.'],
                ['Export Filenames', 'Customisable filenames for all CSV exports.'],
                ['AI Assist', 'Enable/disable, scope (linked/full), detail (summary/detailed), per-section toggles, max items.'],
                ['Custom Charts', 'Up to 20 user-defined charts with data source, group-by, chart type, colour scheme.'],
                ['Config Import/Export', 'Full configuration as JSON for backup or sharing across workspaces.'],
              ]}
            />
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default GrcConfigTechnicalReferenceSection;
