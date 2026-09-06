import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import { ChevronLeft, ChevronRight, FolderOpen, Map as MapIcon, Save, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '../../settings/SettingsContext';
import { getTheme } from '../../styles/Theme';
import useViewportLayout from '../../hooks/useViewportLayout';
import { AppModuleMode, DiagramContextSnapshot, GrcWorkspace } from '../../types/GrcTypes';
import { buildGrcPromptContext, getAIAssistConfig, withUpdatedTimestamp } from '../../services/GrcWorkspaceService';
import {
  createDefaultGrcUiNavigationState,
  GrcFocusRequest,
  GrcTab,
  GrcUiNavigationState,
  StatusMessage,
  moduleTabs
} from './grcShared';
import ExamplesDropdown from '../ExamplesDropdown';
import { ExampleSystem } from '../../data/exampleSystems';

import GrcDashboardTab from './GrcDashboardTab';
import GrcAssetsTab from './GrcAssetsTab';
import GrcFindingsTab from './GrcFindingsTab';
import GrcRisksTab from './GrcRisksTab';
import GrcAssessmentsTab from './GrcAssessmentsTab';
import GrcRiskManagementPlanTab from './GrcRiskManagementPlanTab';
import GrcComplianceTab from './GrcComplianceTab';
import GrcGovernanceTab from './GrcGovernanceTab';
import GrcThreatProfileTab from './GrcThreatProfileTab';
import GrcTprmTab from './GrcTprmTab';
import GrcInitiativesTab from './GrcInitiativesTab';
import GrcImplementedControlsTab from './GrcImplementedControlsTab';
import GrcIncidentsTab from './GrcIncidentsTab';
import GrcReportingTab from './GrcReportingTab';
import GrcConfigurationTab from './GrcConfigurationTab';
import AnalysisPanel from '../AnalysisPanel';
import { chatWithAnalysisResponse } from '../../services/AIRequestService';
import { AnalysisContext } from '../../types/AnalysisTypes';
import { AnalysisResponse } from '../../types/ChatTypes';
import type { DiagramData } from '../../types/AnalysisTypes';
import { SecurityEdge, SecurityNode } from '../../types/SecurityTypes';

const tabTooltips: Record<GrcTab, string> = {
  dashboard: 'Posture overview for assets, risks, controls, and tasks.',
  assets: 'Maintain the in-scope asset inventory with IT/OT/Application classification.',
  findings: 'Rule-based security findings from the diagram analysis engine, linked to assets and risks.',
  risks: 'Maintain the risk register, scoring, owners, and treatment status.',
  compliance: 'Manage control sets and statement-of-applicability mappings.',
  controls: 'Registry of implemented security controls — the actual technologies, processes, and policies that satisfy framework requirements.',
  assessments: 'Create and maintain assessment workspaces with linked risks, gaps, and reports.',
  risk_management_plan: 'Create one risk management plan per assessment and track plan actions.',
  governance: 'Register policies, processes, guidelines, SOPs, and other governance documents with external links.',
  incidents: 'Track security incidents from detection through resolution with timeline, severity, and linkage to risks and assets.',
  threat_profile: 'Register threat actors, map targeted assets, and document threat scenarios with attack techniques.',
  third_parties: 'Manage third-party vendor profiles, risk assessments, and contract tracking with asset linkages.',
  initiatives: 'Track security uplift programs, remediation initiatives, and strategic improvements linked to risks and controls.',
  reporting: 'Export CSV outputs and review point-in-time metrics.',
  workflow_config: 'Workflow health, task board, risk model, taxonomy, appetite rules, defaults, and AI context.'
};

const tabFocusHints: Record<GrcTab, string> = {
  dashboard: 'dashboard metrics and cross-domain posture summaries',
  assets: 'asset inventory records and linked risks/findings',
  findings: 'finding records and their linked risks/assets',
  risks: 'risk register entries, treatments, and appetite status',
  assessments: 'assessment records and linked scopes/risks',
  risk_management_plan: 'assessment risk management plan data and action tracking',
  compliance: 'SoA entries, control implementation status, and control evidence',
  controls: 'implemented control records with type, category, automation level, vendor/product details, and linkages to SoA entries, risks, and assets',
  governance: 'governance documents and policy/process status',
  incidents: 'incident records with timeline, severity, status, and linked risks/assets',
  threat_profile: 'threat actor/scenario records and mapped risks',
  third_parties: 'third-party vendor records and TPRM status',
  initiatives: 'security initiative records, milestone progress, and current-vs-target state narratives',
  reporting: 'cross-section totals and reporting-ready summaries',
  workflow_config: 'workflow tasks, appetite rules, and workspace configuration state'
};

export interface DiagramFileActions {
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  open: () => void;
  loadExample: (example: ExampleSystem) => void;
  getCurrentDiagram?: () => DiagramData;
  getSystemName?: () => string;
  setSystemName?: (name: string) => void;
}

interface GrcModuleProps {
  workspace: GrcWorkspace;
  onWorkspaceChange: (nextWorkspace: GrcWorkspace) => void;
  onSwitchModule: (mode: AppModuleMode) => void;
  diagramSnapshot?: DiagramContextSnapshot | null;
  diagramFileActions?: DiagramFileActions | null;
  uiNavigationState?: GrcUiNavigationState;
  onUiNavigationStateChange?: (updater: (prev: GrcUiNavigationState) => GrcUiNavigationState) => void;
}

const buildSnapshotDiagram = (snapshot?: DiagramContextSnapshot | null): DiagramData => {
  if (!snapshot) {
    return { nodes: [], edges: [], metadata: {} };
  }

  const nodes: SecurityNode[] = snapshot.nodes.map((node, index) => ({
    id: node.id,
    type: 'server',
    position: { x: index * 180, y: 120 },
    data: {
      label: node.label || node.id,
      zone: 'Internal',
      dataClassification: 'Internal'
    }
  }));

  const edges: SecurityEdge[] = snapshot.edges && snapshot.edges.length > 0
    ? snapshot.edges
      .filter(edge => edge.source && edge.target)
      .map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'securityEdge',
        data: {
          label: edge.label,
          zone: edge.zone as any,
          protocol: edge.protocol
        }
      }))
    : Array.from({ length: Math.min(snapshot.edgeCount, Math.max(0, nodes.length - 1)) }, (_, index) => ({
        id: `snapshot-edge-${index + 1}`,
        source: nodes[index].id,
        target: nodes[index + 1].id,
        type: 'securityEdge',
        data: {
          label: `Snapshot Link ${index + 1}`
        }
      }));

  return {
    nodes,
    edges,
    metadata: {
      version: '1.0',
      lastModified: new Date()
    }
  };
};

const GrcModule: React.FC<GrcModuleProps> = ({
  workspace,
  onWorkspaceChange,
  onSwitchModule,
  diagramSnapshot,
  diagramFileActions,
  uiNavigationState,
  onUiNavigationStateChange
}) => {
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const {
    viewport,
    viewportTier,
    toolbarDensity,
    analysisPresentation,
    panelWidths,
    appShell
  } = useViewportLayout();
  const analysisPanelWidth = Math.round(panelWidths.analysis);
  const analysisPanelWidthPx = `${analysisPanelWidth}px`;
  const isDesktopViewport = viewportTier === 'lg';
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const isSmallTouchViewport = isPhoneViewport || (viewportTier === 'md' && viewport.height <= 540);
  const isCompactViewport = toolbarDensity === 'compact';
  const toolbarHeight = isCompactViewport ? appShell.compactToolbarHeight : appShell.appBarHeight;
  const analysisDocked = analysisPresentation === 'docked';
  const analysisFullscreen = analysisPresentation === 'fullscreen';

  const [activeTab, setActiveTab] = useState<GrcTab>(
    () => uiNavigationState?.activeTab ?? moduleTabs[0]?.id ?? 'dashboard'
  );
  const [focusRequest, setFocusRequest] = useState<GrcFocusRequest | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const updateNavigationState = useCallback((updater: (prev: GrcUiNavigationState) => GrcUiNavigationState) => {
    if (!onUiNavigationStateChange) {
      return;
    }
    onUiNavigationStateChange(updater);
  }, [onUiNavigationStateChange]);

  const setActiveTabWithPersistence = useCallback((nextTab: GrcTab) => {
    setActiveTab(nextTab);
    updateNavigationState(prev => ({
      ...prev,
      activeTab: nextTab
    }));
  }, [updateNavigationState]);

  const getTabViewState = useCallback(<T extends Record<string, unknown>>(tab: GrcTab, defaults: T): T => {
    const source = uiNavigationState?.tabState?.[tab];
    if (!source) {
      return defaults;
    }
    return {
      ...defaults,
      ...source
    } as T;
  }, [uiNavigationState?.tabState]);

  const setTabViewState = useCallback((tab: GrcTab, patch: Record<string, unknown>) => {
    updateNavigationState(prev => {
      const current = prev.tabState?.[tab] || {};
      return {
        ...prev,
        tabState: {
          ...(prev.tabState || {}),
          [tab]: {
            ...current,
            ...patch
          }
        }
      };
    });
  }, [updateNavigationState]);

  useEffect(() => {
    const nextTab = uiNavigationState?.activeTab;
    if (!nextTab) {
      return;
    }
    setActiveTab(current => (current === nextTab ? current : nextTab));
  }, [uiNavigationState?.activeTab]);

  useEffect(() => {
    if (!uiNavigationState) {
      updateNavigationState(() => createDefaultGrcUiNavigationState());
    }
  }, [uiNavigationState, updateNavigationState]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 10000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const [assessmentFocusRequest, setAssessmentFocusRequest] = useState<{
    requestId: string;
    scopeType: 'diagram_segment';
    scopeValue: string;
    diagramId?: string;
    openRiskPlan?: boolean;
  } | null>(null);
  const [fileMenuAnchor, setFileMenuAnchor] = useState<null | HTMLElement>(null);
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(() => {
    try { return localStorage.getItem('grc-analysis-panel-open') === 'true'; } catch { return false; }
  });
  const fallbackSystemLabel = diagramSnapshot?.systemName || 'Current System';
  const [systemNameInput, setSystemNameInput] = useState<string>(() =>
    diagramFileActions?.getSystemName?.() ?? fallbackSystemLabel
  );

  const applyWorkspace = useCallback(
    (nextWorkspace: GrcWorkspace) => {
      onWorkspaceChange(withUpdatedTimestamp(nextWorkspace));
    },
    [onWorkspaceChange]
  );

  useEffect(() => {
    const nextSystemName = diagramFileActions?.getSystemName?.() ?? fallbackSystemLabel;
    setSystemNameInput(nextSystemName);
  }, [diagramFileActions, fallbackSystemLabel]);

  useEffect(() => {
    try { localStorage.setItem('grc-analysis-panel-open', String(isAnalysisPanelOpen)); } catch {}
  }, [isAnalysisPanelOpen]);

  useEffect(() => {
    if (!isDesktopViewport) {
      setIsAnalysisPanelOpen(false);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{
        zone: string;
        diagramId?: string;
        openRiskPlan?: boolean;
      }>;
      const zone = customEvent.detail?.zone?.trim();
      if (!zone) {
        return;
      }
      const request = {
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scopeType: 'diagram_segment' as const,
        scopeValue: zone,
        diagramId: customEvent.detail.diagramId,
        openRiskPlan: customEvent.detail.openRiskPlan
      };
      setAssessmentFocusRequest(request);
      setActiveTabWithPersistence(request.openRiskPlan ? 'risk_management_plan' : 'assessments');
    };

    window.addEventListener('grc-open-scope-assessment', handler as EventListener);
    return () => {
      window.removeEventListener('grc-open-scope-assessment', handler as EventListener);
    };
  }, [setActiveTabWithPersistence]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { assessmentId } = (event as CustomEvent<{ assessmentId: string }>).detail;
      if (assessmentId) {
        setActiveTabWithPersistence('assessments');
      }
    };
    window.addEventListener('grc-open-assessment-by-id', handler as EventListener);
    return () => window.removeEventListener('grc-open-assessment-by-id', handler as EventListener);
  }, [setActiveTabWithPersistence]);

  const handleSave = useCallback(async () => {
    setFileMenuAnchor(null);
    if (diagramFileActions?.save) {
      await diagramFileActions.save();
    }
  }, [diagramFileActions]);

  const handleSaveAs = useCallback(async () => {
    setFileMenuAnchor(null);
    if (diagramFileActions?.saveAs) {
      await diagramFileActions.saveAs();
    }
  }, [diagramFileActions]);

  const handleOpen = useCallback(() => {
    setFileMenuAnchor(null);
    if (diagramFileActions?.open) {
      diagramFileActions.open();
    }
  }, [diagramFileActions]);

  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  }, []);

  const handleSelectExample = useCallback((example: ExampleSystem) => {
    if (diagramFileActions?.loadExample) {
      diagramFileActions.loadExample(example);
      onSwitchModule('diagram');
    }
  }, [diagramFileActions, onSwitchModule]);

  const handleSystemNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value;
    setSystemNameInput(nextName);
    diagramFileActions?.setSystemName?.(nextName);
  }, [diagramFileActions]);

  const handleToggleAnalysisPanel = useCallback(() => {
    setIsAnalysisPanelOpen(prev => !prev);
  }, []);

  const handleSwitchTab = useCallback((tab: GrcTab, focusEntityId?: string) => {
    setActiveTabWithPersistence(tab);
    if (focusEntityId) {
      setFocusRequest({ tab, entityId: focusEntityId, ts: Date.now() });
    }
  }, [setActiveTabWithPersistence]);

  const tabProps = useMemo(() => ({
    workspace,
    applyWorkspace,
    setStatusMessage,
    diagramSnapshot,
    assessmentFocusRequest,
    focusRequest,
    onSwitchModule,
    onSwitchTab: handleSwitchTab,
    getTabViewState,
    setTabViewState
  }), [
    workspace,
    applyWorkspace,
    diagramSnapshot,
    assessmentFocusRequest,
    focusRequest,
    onSwitchModule,
    handleSwitchTab,
    getTabViewState,
    setTabViewState
  ]);

  const activeTabContent = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return <GrcDashboardTab {...tabProps} />;
      case 'assets':
        return <GrcAssetsTab {...tabProps} />;
      case 'findings':
        return <GrcFindingsTab {...tabProps} />;
      case 'risks':
        return <GrcRisksTab {...tabProps} />;
      case 'assessments':
        return <GrcAssessmentsTab {...tabProps} />;
      case 'risk_management_plan':
        return <GrcRiskManagementPlanTab {...tabProps} />;
      case 'compliance':
        return <GrcComplianceTab {...tabProps} />;
      case 'controls':
        return <GrcImplementedControlsTab {...tabProps} />;
      case 'governance':
        return <GrcGovernanceTab {...tabProps} />;
      case 'incidents':
        return <GrcIncidentsTab {...tabProps} />;
      case 'threat_profile':
        return <GrcThreatProfileTab {...tabProps} />;
      case 'third_parties':
        return <GrcTprmTab {...tabProps} />;
      case 'initiatives':
        return <GrcInitiativesTab {...tabProps} />;
      case 'reporting':
        return <GrcReportingTab {...tabProps} />;
      case 'workflow_config':
        return <GrcConfigurationTab {...tabProps} />;
      default:
        return null;
    }
  }, [activeTab, tabProps]);
  const currentDiagram = diagramFileActions?.getCurrentDiagram?.() ?? buildSnapshotDiagram(diagramSnapshot);
  const aiAssistConfig = getAIAssistConfig(workspace);
  const showRightToggle = analysisDocked && !isSmallTouchViewport;
  const shouldOffsetShellForAnalysis = analysisDocked && isAnalysisPanelOpen;
  const panelToggleBottomOffsetPx = `${appShell.panelToggleBottomOffset}px`;
  const appBarHeightPx = `${toolbarHeight}px`;

  const augmentAnalysisContext = useCallback((context: AnalysisContext): AnalysisContext => {
    const aiPromptConfig = {
      ...aiAssistConfig,
      enabled: true,
      contextScope: 'workspace' as const,
      includeAssets: true,
      includeRisks: true,
      includeSoaEntries: true,
      includeTasks: true,
      includeAssessments: true,
      includeThreatProfiles: true,
      includeGovernanceDocuments: true,
      includeAppetiteRules: true,
      includeFindings: true,
      includeThirdParties: true,
      includeSecurityInitiatives: true,
      includeImplementedControls: true
    };

    const grcContext = buildGrcPromptContext(
      workspace,
      aiPromptConfig,
      diagramSnapshot?.diagramId,
      diagramSnapshot?.selectedNodeIds || [],
      diagramSnapshot?.attackPaths || []
    );

    const focusContext = [
      '=== GRC MODE FOCUS ===',
      'User is working in the GRC module.',
      `Active GRC tab: ${activeTab}. Prioritize ${tabFocusHints[activeTab]} first, then use the rest of the GRC workspace records.`,
      'Prioritize GRC data from the "GRC WORKSPACE CONTEXT" section below for all queries related to assets, risks, compliance, third-party vendors, assessments, findings, and governance.',
      'Treat GRC workspace records as the source of truth unless the user explicitly asks for diagram/component analysis.',
      'Analyze risk treatment, control implementation status, evidence gaps, workflow tasks, assessment readiness, threat actor and scenario analysis, appetite breach escalation, third-party risk management, and governance document review status.',
      'Reference concrete GRC records when available and keep recommendations actionable.'
    ].join('\n');

    const additionalContext = [focusContext, grcContext]
      .filter((section): section is string => Boolean(section && section.trim()))
      .join('\n\n');

    return {
      ...context,
      additionalContext: additionalContext || undefined,
      metadata: {
        ...(context.metadata || {}),
        systemType: 'grc',
        isInitialSystem: false
      }
    };
  }, [activeTab, aiAssistConfig, diagramSnapshot, workspace]);

  const handleGrcChat = useCallback(
    async (message: string, context?: AnalysisContext): Promise<AnalysisResponse> => {
      const baseContext: AnalysisContext = context || {
        diagram: currentDiagram,
        customContext: null,
        messageHistory: [],
        threatIntel: null,
        metadata: {
          lastModified: new Date(),
          version: process.env.REACT_APP_VERSION,
          systemType: 'grc',
          isInitialSystem: false
        }
      };

      return chatWithAnalysisResponse(message, baseContext);
    },
    [currentDiagram]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100vh', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          transition: 'margin-right 0.3s ease-in-out',
          marginRight: shouldOffsetShellForAnalysis ? analysisPanelWidthPx : 0
        }}
      >
        <AppBar
          position="static"
          sx={{
            backgroundColor: currentTheme.colors.surface,
            borderBottom: 'none',
            boxShadow: 'none'
          }}
        >
          <Toolbar
            sx={{
              minHeight: `${toolbarHeight}px !important`,
              px: isCompactViewport ? 1 : 2,
              gap: 1,
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: isPhoneViewport ? 0.75 : 1.5 }}>
              <Box
                component="span"
                sx={{
                  fontSize: isPhoneViewport ? '1.2rem' : '1.35rem',
                  background: `linear-gradient(135deg, ${currentTheme.colors.primary} 0%, ${currentTheme.colors.secondary} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                ⟐
              </Box>
              <Typography
                variant={isPhoneViewport ? 'subtitle1' : 'h6'}
                sx={{
                  background: `linear-gradient(135deg, ${currentTheme.colors.primary} 0%, ${currentTheme.colors.secondary} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isPhoneViewport ? 'GRC' : 'ContextCypher GRC'}
              </Typography>
            </Box>

            <Box
              sx={{
                minWidth: 0,
                display: 'flex',
                justifyContent: isCompactViewport ? 'flex-start' : 'center',
                px: isCompactViewport ? 0.5 : 2
              }}
            >
              <TextField
                value={systemNameInput}
                onChange={handleSystemNameChange}
                variant="outlined"
                size="small"
                placeholder="System name..."
                sx={{
                  width: '100%',
                  maxWidth: isCompactViewport ? '100%' : 520,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: currentTheme.colors.surface,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: currentTheme.colors.textPrimary,
                    '& fieldset': {
                      borderColor: currentTheme.colors.border,
                    },
                    '&:hover fieldset': {
                      borderColor: currentTheme.colors.primary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: currentTheme.colors.primary,
                    },
                  },
                  '& .MuiInputBase-input': {
                    padding: isCompactViewport ? '6px 10px' : '8px 12px',
                  },
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: isCompactViewport ? 0.25 : 1 }}>
              {diagramFileActions && !isPhoneViewport && (
                <>
                  <Button
                    size="small"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => setFileMenuAnchor(e.currentTarget)}
                    sx={{ color: currentTheme.colors.textSecondary, textTransform: 'none', minWidth: 'auto' }}
                  >
                    File
                  </Button>
                  <Menu
                    anchorEl={fileMenuAnchor}
                    open={Boolean(fileMenuAnchor)}
                    onClose={() => setFileMenuAnchor(null)}
                  >
                    <MenuItem onClick={handleSave}>
                      <ListItemIcon><Save size={16} /></ListItemIcon>
                      <ListItemText>Save</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleSaveAs}>
                      <ListItemIcon><Save size={16} /></ListItemIcon>
                      <ListItemText>Save As</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleOpen}>
                      <ListItemIcon><FolderOpen size={16} /></ListItemIcon>
                      <ListItemText>Open</ListItemText>
                    </MenuItem>
                    </Menu>
                </>
              )}
              {!isPhoneViewport && <ExamplesDropdown onSelectExample={handleSelectExample} />}
              {!showRightToggle && (
                <Tooltip
                  title={isAnalysisPanelOpen ? 'Close Analysis Panel' : 'Open Analysis Panel'}
                  placement="bottom"
                  arrow
                >
                  <IconButton
                    onClick={handleToggleAnalysisPanel}
                    sx={{
                      color: currentTheme.colors.textPrimary,
                      '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                    }}
                    aria-label="Toggle Analysis Panel"
                  >
                    {isAnalysisPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Switch to Diagram Mode" placement="bottom" arrow>
                <IconButton
                  onClick={() => onSwitchModule('diagram')}
                  sx={{
                    color: currentTheme.colors.textPrimary,
                    '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                  }}
                  aria-label="Switch to Diagram Mode"
                >
                  <MapIcon size={20} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Settings" placement="bottom" arrow>
                <IconButton
                  onClick={handleOpenSettings}
                  sx={{
                    color: currentTheme.colors.textPrimary,
                    '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                  }}
                  aria-label="Settings"
                >
                  <SettingsIcon size={20} />
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <Box
            component="nav"
            sx={{
              width: isPhoneViewport ? 48 : 180,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              backgroundColor: currentTheme.colors.surface,
              overflowY: 'auto',
              overflowX: 'hidden',
              pt: isPhoneViewport ? 1 : 2
            }}
          >
            {moduleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const item = (
                <Box
                  key={tab.id}
                  role="button"
                  aria-label={tab.label}
                  aria-pressed={isActive}
                  tabIndex={0}
                  onClick={() => setActiveTabWithPersistence(tab.id)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTabWithPersistence(tab.id); }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: isPhoneViewport ? 0 : 1.5,
                    py: isPhoneViewport ? 1 : 1.25,
                    cursor: 'pointer',
                    justifyContent: isPhoneViewport ? 'center' : 'flex-start',
                    borderLeft: isActive ? '3px solid' : '3px solid transparent',
                    borderColor: isActive ? 'primary.main' : 'transparent',
                    backgroundColor: isActive ? 'action.selected' : 'transparent',
                    '&:hover': { backgroundColor: 'action.hover' },
                    transition: 'background-color 0.15s'
                  }}
                >
                  <Icon sx={{ fontSize: 18, flexShrink: 0, color: isActive ? 'primary.main' : 'text.secondary' }} />
                  {!isPhoneViewport && (
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'text.primary' : 'text.secondary',
                        lineHeight: 1.3
                      }}
                    >
                      {tab.label}
                    </Typography>
                  )}
                </Box>
              );
              return isPhoneViewport ? (
                <Tooltip key={tab.id} title={tab.label} placement="right" arrow describeChild>
                  {item}
                </Tooltip>
              ) : (
                <Tooltip key={tab.id} title={tabTooltips[tab.id]} placement="right" arrow enterDelay={600} describeChild>
                  {item}
                </Tooltip>
              );
            })}
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'auto', p: isCompactViewport ? 1.25 : 2.5 }}>
              {statusMessage && (
                <Alert severity={statusMessage.severity} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>
                  {statusMessage.text}
                </Alert>
              )}

              {activeTabContent}
            </Box>
          </Box>
        </Box>
      </Box>

      {showRightToggle && (
        <Tooltip
          title={isAnalysisPanelOpen ? 'Hide AI Analysis Panel' : 'Show AI Analysis Panel'}
          placement="left"
          arrow
        >
          <Box
            role="button"
            tabIndex={0}
            aria-label={isAnalysisPanelOpen ? 'Hide GRC analysis panel' : 'Show GRC analysis panel'}
            onClick={handleToggleAnalysisPanel}
            onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleToggleAnalysisPanel();
              }
            }}
            sx={{
              position: 'fixed',
              right: isAnalysisPanelOpen ? analysisPanelWidthPx : '0px',
              bottom: panelToggleBottomOffsetPx,
              backgroundColor: currentTheme.colors.surface,
              border: `1px solid ${currentTheme.colors.border}`,
              borderRight: isAnalysisPanelOpen ? 'none' : `1px solid ${currentTheme.colors.border}`,
              borderRadius: '8px 0 0 8px',
              zIndex: 1200,
              padding: '12px 8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              minHeight: `${appShell.panelToggleMinHeight}px`,
              minWidth: `${appShell.panelToggleMinWidth}px`,
              color: currentTheme.colors.textPrimary,
              '&:hover': {
                backgroundColor: currentTheme.colors.surfaceHover,
                color: currentTheme.colors.primary,
                transform: 'translateX(-2px)'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {isAnalysisPanelOpen ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
            <Box
              sx={{
                writingMode: 'vertical-lr',
                textOrientation: 'mixed',
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: '1px',
                marginTop: 1
              }}
            >
              ANALYSIS
            </Box>
          </Box>
        </Tooltip>
      )}

      {!analysisDocked && isAnalysisPanelOpen && (
        <Box
          onClick={() => setIsAnalysisPanelOpen(false)}
          sx={{
            position: 'fixed',
            top: appBarHeightPx,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.22)',
            zIndex: 1350
          }}
        />
      )}

      <Box
        className="grc-analysis-panel-container"
        data-testid="grc-analysis-panel-container"
        sx={{
          position: 'fixed',
          right: 0,
          top: analysisDocked ? 0 : appBarHeightPx,
          bottom: 0,
          width: analysisFullscreen ? '100vw' : analysisPanelWidthPx,
          height: analysisDocked ? '100dvh' : `calc(100dvh - ${appBarHeightPx})`,
          minHeight: analysisDocked ? '100vh' : `calc(100vh - ${appBarHeightPx})`,
          display: 'flex',
          transform: isAnalysisPanelOpen
            ? 'translateX(0)'
            : `translateX(${analysisFullscreen ? '100vw' : analysisPanelWidthPx})`,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: analysisDocked ? 1000 : 1360,
          pointerEvents: isAnalysisPanelOpen ? 'auto' : 'none'
        }}
      >
        <Box
          className="grc-analysis-panel-inner"
          sx={{
            width: '100%',
            backgroundColor: currentTheme.colors.background,
            borderLeft: `1px solid ${currentTheme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <AnalysisPanel
              isOpen={isAnalysisPanelOpen}
              onToggle={() => setIsAnalysisPanelOpen(prev => !prev)}
              onSendMessage={handleGrcChat}
              onRequestAnalysis={async () => undefined}
              isAnalyzing={false}
              currentDiagram={currentDiagram}
              historyScope="grc"
              contextAugmenter={augmentAnalysisContext}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default GrcModule;
