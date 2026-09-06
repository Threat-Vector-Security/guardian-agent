import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import { ChevronDown, HelpCircle, X } from 'lucide-react';
import {
  STRIDE_CATEGORIES,
  STRIDE_COLORS,
  STRIDE_DETAILS,
  STRIDE_SHORT,
  PASTA_STAGES
} from '../../utils/attackPathUtils';
import { StrideCategory } from '../../types/ThreatIntelTypes';

interface MethodologyGuidePanelProps {
  onClose: () => void;
}

const TERM_TOOLTIPS: Record<string, string> = {
  DFD: 'Data Flow Diagram — a structured diagram showing how data moves between actors, processes, data stores, and across trust boundaries. The foundation for STRIDE threat modeling.',
  'Trust Boundary': 'A line on a DFD separating two areas with different trust levels. Every data flow crossing a trust boundary should be examined for threats.',
  'External Entity': 'An actor outside the system (user, external service, device) that sends or receives data. External entities are outside your direct control.',
  Process: 'A system component that transforms, routes, or processes data. Can be an application, service, microservice, or function.',
  'Data Store': 'Anywhere data is persisted — a database, file, cache, queue, or registry. Data stores are prime targets for confidentiality and integrity attacks.',
  'Data Flow': 'An arrow on a DFD showing data moving between elements. Includes protocol, encryption, and data classification.',
  STRIDE: 'Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege — a taxonomy of threat categories developed by Microsoft.',
  PASTA: 'Process for Attack Simulation and Threat Analysis — a 7-stage risk-centric threat modeling methodology.',
  'MITRE ATT&CK': 'A globally-accessible knowledge base of adversary tactics and techniques based on real-world observations. Used to map threats to known attacker behavior.',
  CVE: 'Common Vulnerabilities and Exposures — a standardized identifier for publicly known security vulnerabilities.',
  CVSS: 'Common Vulnerability Scoring System — a framework for rating the severity of security vulnerabilities on a 0–10 scale.',
  mTLS: 'Mutual TLS — both client and server present certificates, providing bidirectional authentication.',
  'Least Privilege': 'A security principle: every user, process, and system component should have only the minimum permissions needed to perform its function.',
  IDOR: 'Insecure Direct Object Reference — when an attacker can access another user\'s resource by manipulating an identifier (e.g., changing user_id=123 to user_id=124).',
  RBAC: 'Role-Based Access Control — permissions are assigned to roles, and users are assigned to roles rather than receiving permissions directly.',
  SIEM: 'Security Information and Event Management — a platform that aggregates and correlates logs for security monitoring and incident detection.',
  SSRF: 'Server-Side Request Forgery — an attacker tricks a server into making HTTP requests to internal resources on their behalf.',
  WAF: 'Web Application Firewall — a security control that filters and monitors HTTP traffic to and from a web application.',
  'Zero Trust': 'A security model: never trust, always verify. No user or device is trusted by default, even inside the network perimeter.',
};

const Term: React.FC<{ children: string }> = ({ children }) => {
  const tooltip = TERM_TOOLTIPS[children];
  if (!tooltip) return <>{children}</>;
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box component="span" sx={{ borderBottom: '1px dashed', borderColor: 'primary.main', cursor: 'help', color: 'primary.main' }}>
        {children}
        <HelpCircle size={10} style={{ marginLeft: 2, verticalAlign: 'middle', opacity: 0.7 }} />
      </Box>
    </Tooltip>
  );
};

// STRIDE-per-element matrix (Microsoft standard)
const DFD_ELEMENTS = ['Process', 'Data Store', 'Data Flow', 'External Entity'] as const;
type DfdElement = typeof DFD_ELEMENTS[number];

const STRIDE_DFD_MATRIX: Record<DfdElement, Record<StrideCategory, boolean>> = {
  'Process': { Spoofing: true, Tampering: true, Repudiation: true, 'Information Disclosure': true, 'Denial of Service': true, 'Elevation of Privilege': true },
  'Data Store': { Spoofing: false, Tampering: true, Repudiation: true, 'Information Disclosure': true, 'Denial of Service': true, 'Elevation of Privilege': false },
  'Data Flow': { Spoofing: true, Tampering: true, Repudiation: false, 'Information Disclosure': true, 'Denial of Service': true, 'Elevation of Privilege': false },
  'External Entity': { Spoofing: true, Tampering: false, Repudiation: true, 'Information Disclosure': false, 'Denial of Service': false, 'Elevation of Privilege': true },
};

const DFD_ELEMENT_DESCRIPTIONS: Record<DfdElement, { description: string; icon: string; threats: string }> = {
  'Process': {
    icon: '⬡',
    description: 'A system component that receives, transforms, or routes data. Can be a service, application, API, or function.',
    threats: 'All 6 STRIDE threats apply — processes can be spoofed, their data tampered, their actions denied, their output leaked, their availability disrupted, and their privilege escalated.'
  },
  'Data Store': {
    icon: '⊟',
    description: 'Any location where data is persisted — a database, file system, cache, message queue, or configuration store.',
    threats: 'Cannot be "spoofed" (stores don\'t have identity) or elevated (they don\'t execute), but are vulnerable to Tampering, Repudiation, Information Disclosure, and DoS.'
  },
  'Data Flow': {
    icon: '→',
    description: 'An arrow showing data moving between DFD elements. Each flow should have a label, protocol, and data classification.',
    threats: 'Flows can be Spoofed (fake source), Tampered (modified in transit), have Information Disclosure (intercepted), or be disrupted (DoS). Repudiation and EoP are rare.'
  },
  'External Entity': {
    icon: '□',
    description: 'An actor outside the system boundary — a user, browser, external API, or third-party service. Not under your control.',
    threats: 'Can Spoof (impersonate another entity), Repudiate (deny actions), or attempt Elevation of Privilege. Cannot Tamper with stores they don\'t control.'
  },
};

const OWASP_STRIDE_MAPPING = [
  { id: 'A01', name: 'Broken Access Control', stride: ['Elevation of Privilege', 'Information Disclosure'], description: 'Failure to restrict what authenticated users can do.' },
  { id: 'A02', name: 'Cryptographic Failures', stride: ['Information Disclosure', 'Tampering'], description: 'Failure to protect data using strong cryptography in transit or at rest.' },
  { id: 'A03', name: 'Injection', stride: ['Tampering', 'Elevation of Privilege'], description: 'Untrusted data sent as commands — SQL, OS commands, LDAP queries.' },
  { id: 'A04', name: 'Insecure Design', stride: ['Tampering', 'Spoofing', 'Denial of Service'], description: 'Architectural flaws that cannot be fixed by correct implementation alone.' },
  { id: 'A05', name: 'Security Misconfiguration', stride: ['Elevation of Privilege', 'Information Disclosure', 'Denial of Service'], description: 'Insecure default configurations, incomplete setups, open cloud storage.' },
  { id: 'A06', name: 'Vulnerable Components', stride: ['Tampering', 'Denial of Service', 'Elevation of Privilege'], description: 'Known CVEs in libraries, frameworks, and other software dependencies.' },
  { id: 'A07', name: 'Auth Failures', stride: ['Spoofing', 'Elevation of Privilege'], description: 'Broken authentication, session management, and credential storage.' },
  { id: 'A08', name: 'Integrity Failures', stride: ['Tampering'], description: 'Code and infrastructure not protected against integrity violations — supply chain attacks.' },
  { id: 'A09', name: 'Logging Failures', stride: ['Repudiation'], description: 'Insufficient logging, monitoring, and alerting to detect and respond to attacks.' },
  { id: 'A10', name: 'SSRF', stride: ['Elevation of Privilege', 'Information Disclosure'], description: 'Server-side request forgery — server fetches a remote resource without validating the URL.' },
];

const MODELING_TIPS = [
  { title: 'Start with the diagram, not the threats', body: 'Before looking for threats, make sure your DFD is complete and accurate. Every data flow should have a label, every trust boundary should be explicit. A good DFD makes threat enumeration much easier.' },
  { title: 'Follow data across trust boundaries', body: 'Trust boundaries are where most threats live. For each flow crossing a boundary, ask: what happens if this flow is tampered with? What if the source is spoofed? This alone finds the majority of meaningful threats.' },
  { title: 'Use STRIDE systematically — not opportunistically', body: 'Go element by element, category by category. It is tempting to write down the obvious threats and stop. The systematic approach forces you to consider threats you would otherwise miss, especially Repudiation and DoS.' },
  { title: 'Distinguish threat from vulnerability from risk', body: 'A threat is what could go wrong (e.g., spoofing). A vulnerability is a specific weakness that makes the threat feasible (e.g., no MFA). Risk combines likelihood and impact. STRIDE helps you find threats; your risk model helps you prioritize them.' },
  { title: 'Think like an attacker', body: 'Ask: what is the most valuable thing in this system? What is the shortest path to it? What existing controls would an attacker bypass, and how? PASTA\'s attack modeling stage formalizes this thinking.' },
  { title: 'Threats require mitigations, not just documentation', body: 'A threat model that does not result in actionable mitigation tasks has limited value. Each confirmed threat should produce either a mitigation task, a risk acceptance decision, or a transfer decision.' },
];

const StrideTabContent: React.FC = () => {
  const [expanded, setExpanded] = useState<StrideCategory | false>(false);

  return (
    <Box sx={{ display: 'grid', gap: 2, p: 1.5 }}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>What is STRIDE?</Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <Term>STRIDE</Term> is a threat modeling framework developed by Microsoft that provides a systematic way to identify threats. Each letter represents a threat category. Apply STRIDE to each element in your <Term>DFD</Term> to ensure comprehensive coverage.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          STRIDE is <strong>element-centric</strong> — you start from each component in your diagram and ask "what threats apply here?" This is different from <Term>PASTA</Term>, which is attacker-centric (starting from the attacker's goal).
        </Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>STRIDE-per-Element Matrix</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Which threats apply to which <Term>DFD</Term> element types (✓ = applicable, − = rarely applicable)
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ p: 0.5, textAlign: 'left', borderBottom: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>Element</Box>
                {STRIDE_CATEGORIES.map(cat => (
                  <Box key={cat} component="th" sx={{ p: 0.5, textAlign: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Chip label={STRIDE_SHORT[cat]} size="small" sx={{ bgcolor: STRIDE_COLORS[cat], color: '#fff', fontWeight: 700, fontSize: 10, height: 18, minWidth: 18 }} />
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {DFD_ELEMENTS.map(element => (
                <Box key={element} component="tr" sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box component="td" sx={{ p: 0.75, fontWeight: 600, fontSize: 11, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Tooltip title={DFD_ELEMENT_DESCRIPTIONS[element].description} arrow>
                      <Box component="span" sx={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>{DFD_ELEMENT_DESCRIPTIONS[element].icon}</Box>
                        {element}
                        <HelpCircle size={10} style={{ opacity: 0.5 }} />
                      </Box>
                    </Tooltip>
                  </Box>
                  {STRIDE_CATEGORIES.map(cat => (
                    <Box key={cat} component="td" sx={{ p: 0.5, textAlign: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                      {STRIDE_DFD_MATRIX[element][cat]
                        ? <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>✓</Box>
                        : <Box component="span" sx={{ color: 'text.disabled' }}>−</Box>
                      }
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider />

      <Typography variant="subtitle2">STRIDE Categories</Typography>
      {STRIDE_CATEGORIES.map(cat => {
        const detail = STRIDE_DETAILS[cat];
        return (
          <Accordion
            key={cat}
            expanded={expanded === cat}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? cat : false)}
            disableGutters
            sx={{ border: '1px solid', borderColor: expanded === cat ? STRIDE_COLORS[cat] : 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ChevronDown size={14} />} sx={{ minHeight: 44, px: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={STRIDE_SHORT[cat]} size="small" sx={{ bgcolor: STRIDE_COLORS[cat], color: '#fff', fontWeight: 700, fontSize: 11, height: 20, minWidth: 20 }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{cat}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block' }}>{detail.threat}</Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pb: 1.5, display: 'grid', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">{detail.description}</Typography>

              <Box>
                <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Applies to</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {detail.dfdApplicability.map(t => (
                    <Tooltip key={t} title={DFD_ELEMENT_DESCRIPTIONS[t as DfdElement]?.description || ''} arrow>
                      <Chip label={t} size="small" variant="outlined" sx={{ fontSize: 10, height: 18, cursor: 'help' }} />
                    </Tooltip>
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Questions to ask</Typography>
                {detail.questionsToAsk.map((q, i) => (
                  <Typography key={i} variant="caption" display="block" sx={{ mb: 0.5, pl: 1, borderLeft: '2px solid', borderColor: 'divider', py: 0.25 }}>
                    {i + 1}. {q}
                  </Typography>
                ))}
              </Box>

              <Box>
                <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'error.main' }}>Attack examples</Typography>
                {detail.examples.map((ex, i) => (
                  <Typography key={i} variant="caption" display="block" color="error.light" sx={{ mb: 0.25, pl: 1 }}>• {ex}</Typography>
                ))}
              </Box>

              <Box>
                <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'success.main' }}>Mitigations</Typography>
                {detail.mitigations.map((m, i) => (
                  <Typography key={i} variant="caption" display="block" color="success.light" sx={{ mb: 0.25, pl: 1 }}>• {m}</Typography>
                ))}
              </Box>

              {detail.owasp.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>OWASP mapping</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {detail.owasp.map(o => (
                      <Chip key={o} label={o} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                    ))}
                  </Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

const PastaTabContent: React.FC = () => {
  const [expanded, setExpanded] = useState<number | false>(false);

  return (
    <Box sx={{ display: 'grid', gap: 2, p: 1.5 }}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>What is PASTA?</Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <Term>PASTA</Term> (Process for Attack Simulation and Threat Analysis) is a 7-stage, risk-centric threat modeling methodology. Unlike <Term>STRIDE</Term> which focuses on threat categories per element, PASTA starts from business objectives and works toward simulated attack scenarios with risk scoring.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          PASTA is <strong>attacker-centric</strong> — you model how a real attacker would pursue your most valuable assets. The output is a prioritized risk register grounded in business impact.
        </Typography>
      </Box>

      <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>STRIDE vs PASTA — when to use each</Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          <strong>STRIDE</strong>: Best for systematic coverage of a new design, DFD review, or when you need to be sure you haven't missed a category of threat.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          <strong>PASTA</strong>: Best for risk prioritization, executive reporting, and when you need to connect technical threats to business impact and risk appetite.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          <strong>Together</strong>: Use STRIDE (Stage 4) within PASTA to enumerate threats systematically, then PASTA's Stage 6–7 to model attack scenarios and score risk.
        </Typography>
      </Box>

      <Divider />

      <Typography variant="subtitle2">PASTA Stages</Typography>

      {PASTA_STAGES.map(stage => (
        <Accordion
          key={stage.id}
          expanded={expanded === stage.id}
          onChange={(_, isExpanded) => setExpanded(isExpanded ? stage.id : false)}
          disableGutters
          sx={{ border: '1px solid', borderColor: expanded === stage.id ? 'primary.main' : 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ChevronDown size={14} />} sx={{ minHeight: 44, px: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`${stage.id}`} size="small" sx={{ bgcolor: '#0f172a', color: '#94a3b8', fontWeight: 700, fontSize: 11, height: 20, minWidth: 20 }} />
              <Box>
                <Typography variant="body2" fontWeight={600}>{stage.shortName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block' }}>{stage.name}</Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.5, pb: 1.5, display: 'grid', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">{stage.description}</Typography>

            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
              <Typography variant="caption" color="text.secondary">{stage.guidance}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Questions to ask</Typography>
              {stage.questionsToAsk.map((q, i) => (
                <Typography key={i} variant="caption" display="block" sx={{ mb: 0.5, pl: 1, borderLeft: '2px solid', borderColor: 'divider', py: 0.25 }}>
                  {i + 1}. {q}
                </Typography>
              ))}
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'success.main' }}>Expected outputs</Typography>
              {stage.outputs.map((o, i) => (
                <Typography key={i} variant="caption" display="block" color="success.light" sx={{ mb: 0.25, pl: 1 }}>• {o}</Typography>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

const ReferenceTabContent: React.FC = () => {
  const [tipExpanded, setTipExpanded] = useState<number | false>(false);

  return (
    <Box sx={{ display: 'grid', gap: 2, p: 1.5 }}>

      <Box>
        <Typography variant="subtitle2" gutterBottom>DFD Elements Reference</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          A <Term>DFD</Term> uses four element types. Each has a visual shape in the diagram editor and a specific role in threat analysis.
        </Typography>
        {DFD_ELEMENTS.map(element => (
          <Box key={element} sx={{ mb: 1, p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Box component="span" sx={{ fontSize: 16, color: 'text.secondary', minWidth: 20 }}>{DFD_ELEMENT_DESCRIPTIONS[element].icon}</Box>
              <Typography variant="body2" fontWeight={600}>{element}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{DFD_ELEMENT_DESCRIPTIONS[element].description}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontStyle: 'italic' }}>
              Threats: {DFD_ELEMENT_DESCRIPTIONS[element].threats}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          OWASP Top 10 → STRIDE Mapping
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          OWASP Top 10 describes common vulnerability classes. Each maps to one or more STRIDE categories.
        </Typography>
        {OWASP_STRIDE_MAPPING.map(item => (
          <Box key={item.id} sx={{ mb: 1, p: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider', display: 'grid', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip label={item.id} size="small" variant="outlined" sx={{ fontSize: 10, height: 18, fontWeight: 700 }} />
              <Typography variant="caption" fontWeight={600}>{item.name}</Typography>
              <Box sx={{ display: 'flex', gap: 0.25, ml: 'auto', flexWrap: 'wrap' }}>
                {item.stride.map(cat => (
                  <Chip key={cat} label={STRIDE_SHORT[cat as StrideCategory]} size="small" sx={{ bgcolor: STRIDE_COLORS[cat as StrideCategory], color: '#fff', fontWeight: 700, fontSize: 9, height: 16, minWidth: 16 }} />
                ))}
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{item.description}</Typography>
          </Box>
        ))}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>The Four-Question Framework</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          The simplest threat modeling process answers four questions (credit Adam Shostack):
        </Typography>
        {[
          { q: '1. What are we building?', a: 'Create a DFD or architecture diagram. Identify components, data flows, and trust boundaries.' },
          { q: '2. What can go wrong?', a: 'Apply STRIDE to each element. Use PASTA to model attacker scenarios. Consider threat intelligence.' },
          { q: '3. What are we going to do about it?', a: 'For each threat: mitigate, transfer, accept, or eliminate. Create GRC tasks for each mitigation.' },
          { q: '4. Did we do a good enough job?', a: 'Review completeness, validate with stakeholders, schedule recurring threat model reviews.' },
        ].map(({ q, a }) => (
          <Box key={q} sx={{ mb: 1, p: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="caption" fontWeight={700} display="block" color="primary.main">{q}</Typography>
            <Typography variant="caption" color="text.secondary">{a}</Typography>
          </Box>
        ))}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>Practical Tips</Typography>
        {MODELING_TIPS.map((tip, i) => (
          <Accordion
            key={i}
            expanded={tipExpanded === i}
            onChange={(_, isExpanded) => setTipExpanded(isExpanded ? i : false)}
            disableGutters
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', mb: 0.75, '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ChevronDown size={12} />} sx={{ minHeight: 36, px: 1.25 }}>
              <Typography variant="caption" fontWeight={600}>{tip.title}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.25, pb: 1 }}>
              <Typography variant="caption" color="text.secondary">{tip.body}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>Key Terms Glossary</Typography>
        {Object.entries(TERM_TOOLTIPS).map(([term, def]) => (
          <Box key={term} sx={{ mb: 0.75, p: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" fontWeight={700} display="block" color="primary.main">{term}</Typography>
            <Typography variant="caption" color="text.secondary">{def}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const MethodologyGuidePanel: React.FC<MethodologyGuidePanelProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'stride' | 'pasta' | 'reference'>('stride');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, maxWidth: '100%', minHeight: 0, height: '100%', bgcolor: 'background.paper', overflowWrap: 'anywhere' }}>
      <Box sx={{
        px: 2, py: 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700}>Threat Modeling Guide</Typography>
          <Typography variant="caption" color="text.secondary">STRIDE · PASTA · Reference</Typography>
        </Box>
        <Tooltip title="Close guide" arrow>
          <IconButton size="small" sx={{ flexShrink: 0 }} onClick={onClose} aria-label="Close methodology guide">
            <X size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      <Tabs
        variant="scrollable"
        scrollButtons="auto"
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: 13 }
        }}
      >
        <Tab value="stride" label="STRIDE" />
        <Tab value="pasta" label="PASTA" />
        <Tab value="reference" label="Reference" />
      </Tabs>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', '& > *': { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', gridTemplateColumns: 'minmax(0, 1fr)' }, '& .MuiAccordionSummary-content': { minWidth: 0 }, '& .MuiChip-root': { maxWidth: '100%' }, '& .MuiChip-label': { whiteSpace: 'normal' } }}>
        {tab === 'stride' && <StrideTabContent />}
        {tab === 'pasta' && <PastaTabContent />}
        {tab === 'reference' && <ReferenceTabContent />}
      </Box>
    </Box>
  );
};

export default MethodologyGuidePanel;
