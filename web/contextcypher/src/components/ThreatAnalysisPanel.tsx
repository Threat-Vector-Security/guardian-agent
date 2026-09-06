import React, { useState, useRef, useImperativeHandle, useCallback, forwardRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Card,
  IconButton,
  Tooltip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Collapse,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormHelperText,
  Paper,
  FormGroup,
  Checkbox,
  Chip
} from '@mui/material';
import {
  Assessment,
  Stop,
  Warning,
  Error as ErrorIcon,
  Close,
  Security,
  BugReport,
  Description,
  SelectAll,
  DeselectOutlined,
  GpsFixed,
  Save,
  Upload,
  ExpandMore,
  Info,
  Search as SearchIcon
} from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import LanguageIcon from '@mui/icons-material/Language';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
// Word export removed for now
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';
import { styled } from '@mui/material/styles';
import { useSettings } from '../settings/SettingsContext';
import { useAnalysisContext } from './AnalysisContextProvider';
import { getTheme } from '../styles/Theme';
import { SecurityNode, SecurityEdge, ThreatData, SecurityContext, TargetedThreatAnalysis, ThreatScenarioFile } from '../types/SecurityTypes';
import { threatAnalysisLogger } from '../services/ThreatAnalysisLogger';
import AnalysisCostDialog from './AnalysisCostDialog';
import { estimateNodeByNodeTokens, estimateNodeByNodeTime } from '../utils/tokenEstimator';
import SystemAnalysisReport from './SystemAnalysisReport';
import { analyzeThreats } from '../services/guardianThreatAnalysis';

import ExportOnlyReportDialog from './ExportOnlyReportDialog';

import ExampleScenariosDropdown from './ExampleScenariosDropdown';
import { downloadHtmlFile, downloadTextFile } from '../utils/exportUtils';
import { saveFile } from '../../../shared/file-dialogs';
import useViewportLayout from '../hooks/useViewportLayout';

interface ThreatAnalysisPanelProps {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  selectedNodes?: string[]; // Array of selected node IDs
  onNodesUpdate?: (nodes: SecurityNode[]) => void;
  onEdgesUpdate?: (edges: SecurityEdge[]) => void;
  onOpenNodeEditor?: (nodeId: string, tab?: 'threats') => void; // Callback to open node editor
  onOpenEdgeEditor?: (edgeId: string, tab?: 'threats') => void; // Callback to open edge editor
  onCenterComponent?: (componentId: string) => void; // Callback to center and select component
  onSelectedNodesChange?: (nodeIds: string[]) => void; // Callback to update selected nodes
  onOpenThreatIntelPanel?: () => void; // Callback to open threat intel panel
}

export interface ThreatAnalysisPanelRef {
  analyzeNode: (node: SecurityNode) => Promise<SecurityContext & { detailedAnalysis: string }>;
  analyzeEdge: (edge: SecurityEdge) => Promise<SecurityContext & { detailedAnalysis: string }>;
  analyzeSelectedNodes: () => Promise<void>;
}

interface AnalysisProgress {
  total: number;
  completed: number;
  current: string;
  currentNode?: string;
  status: 'idle' | 'preparing' | 'analyzing' | 'completing' | 'done' | 'cancelled';
  errors: string[];
}

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '8px',
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const ThreatAnalysisPanel = forwardRef<ThreatAnalysisPanelRef, ThreatAnalysisPanelProps>(({
  nodes,
  edges,
  selectedNodes = [],
  onNodesUpdate,
  onEdgesUpdate,
  onOpenNodeEditor,
  onOpenEdgeEditor,
  onCenterComponent,
  onSelectedNodesChange,
  onOpenThreatIntelPanel
}, ref) => {
  const { settings, updateSettings } = useSettings();
  const { state: analysisState, setImportedThreatIntel } = useAnalysisContext();
  const theme = getTheme(settings.theme);
  const { viewportTier } = useViewportLayout();
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const cancelRef = useRef(false);
  const analysisInProgressRef = useRef(false); // Guard against duplicate execution
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({
    total: 0,
    completed: 0,
    current: '',
    status: 'idle',
    errors: []
  });
  const [, setAnalysisResults] = useState<{
    threatsFound: number;
    vulnerabilitiesFound: number;
    riskLevels: {
      Extreme: number;
      High: number;
      Medium: number;
      Minor: number;
      Sustainable: number;
    };
    timestamp: Date;
  } | null>(null);

  // State for system-wide analysis data
  const [systemAnalysis, setSystemAnalysis] = useState<{
    systemOverview: any;
    attackPaths: any[];
    vulnerabilities: any[];
    recommendations: any[];
    componentThreats: Record<string, any[]>;
    ttpSummary?: Record<string, { name: string; description?: string }>;
    timestamp: Date;
    isTargetedAnalysis?: boolean;
    targetedAnalysis?: TargetedThreatAnalysis & {
      threatIntelligence?: {
        rawIntelligence?: string;
        recentCVEs?: string;
        knownIOCs?: string;
        campaignInfo?: string;
        intelligenceDate?: string;
      };
    };
  } | null>(null);
  
  // State for system analysis dialog
  const [showSystemAnalysisDialog, setShowSystemAnalysisDialog] = useState(false);
  
  const [exportOnlyMode, setExportOnlyMode] = useState(false);

  // State for threat intel import mode

  // Targeted threat analysis state
  // Toggle persists in settings (localStorage)
  const targetedModeEnabled = settings.threatAnalysis.targetedModeEnabled || false;
  
  // Input data persists in component state (memory only)
  const [targetedThreatAnalysis, setTargetedThreatAnalysis] = useState<TargetedThreatAnalysis>({
    threatActors: '',
    ttps: '',
    vulnerabilities: '',
    focusAreas: '',
    scenarioDescription: ''
  });
  
  const setTargetedModeEnabled = (enabled: boolean) => {
    updateSettings({
      threatAnalysis: {
        ...settings.threatAnalysis,
        targetedModeEnabled: enabled
      }
    });
  };
  
  const [costDialog, setCostDialog] = useState<{
    open: boolean;
    tokens: number;
    passes: number;
    onContinue: () => void;
    onCancel: () => void;
    analysisType?: 'selected' | 'entire';
    componentCount?: number;
    provider?: string;
    model?: string;
    estimatedTime?: number;
    isAnalyzing?: boolean;
    analysisId?: string; // Track the analysis ID
    progress?: {
      current: number;
      total: number;
      currentComponent?: string;
      timeRemaining?: number;
    };
    isTargetedAnalysis?: boolean;
    targetedThreatActor?: string;
  }>({open:false,tokens:0,passes:1,onContinue:()=>{},onCancel:()=>{}});
  
  // Track current analysis ID for cancellation
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

  // Track previous node/edge counts to detect diagram resets
  const prevDiagramRef = useRef({ nodeCount: 0, edgeCount: 0, hasThreats: false });

  // Reset analysis state when a new diagram is loaded
  useEffect(() => {
    const currentNodeCount = nodes.length;
    const currentEdgeCount = edges.length;
    
    // Check if any nodes have threat analysis data
    const hasThreats = nodes.some(node => {
      if (node.type === 'securityZone') return false;
      const nodeData = node.data as any;
      return nodeData?.securityContext?.threats && 
             nodeData.securityContext.threats.length > 0;
    });
    
    const prev = prevDiagramRef.current;
    
    // Detect diagram reset scenarios:
    // 1. All nodes were cleared (count went to 0) and now we have new nodes
    // 2. Significant change in node count AND no threat data (indicating fresh load)
    // 3. Previous diagram had threats but current doesn't (indicating cleanup)
    const isDigramReset = (
      (prev.nodeCount > 0 && currentNodeCount === 0) || // Nodes were cleared
      (prev.nodeCount === 0 && currentNodeCount > 0 && !hasThreats) || // New nodes loaded without threats
      (prev.hasThreats && !hasThreats && currentNodeCount > 0) || // Had threats, now clean
      (Math.abs(currentNodeCount - prev.nodeCount) > 3 && !hasThreats) // Significant change without threats
    );
    
    if (isDigramReset) {
      console.log('[ThreatAnalysisPanel] Diagram reset detected, clearing analysis state', {
        prevNodeCount: prev.nodeCount,
        currentNodeCount,
        prevEdgeCount: prev.edgeCount,
        currentEdgeCount,
        prevHasThreats: prev.hasThreats,
        currentHasThreats: hasThreats
      });
      
      // Reset all analysis state
      setAnalysisResults(null);
      setSystemAnalysis(null);
      setProgress({
        total: 0,
        completed: 0,
        current: '',
        status: 'idle',
        errors: []
      });
      setShowSystemAnalysisDialog(false);
      setCostDialog({open:false,tokens:0,passes:1,onContinue:()=>{},onCancel:()=>{},analysisType:undefined,componentCount:undefined,provider:undefined,model:undefined,estimatedTime:undefined,isAnalyzing:false,progress:undefined});
      setShowProgressDialog(false);
      setIsAnalyzing(false);
      
      // Cancel any ongoing analysis
      cancelRef.current = true;
    }
    
    // Update previous values
    prevDiagramRef.current = {
      nodeCount: currentNodeCount,
      edgeCount: currentEdgeCount,
      hasThreats
    };
  }, [nodes, edges]); // Depend on nodes and edges arrays

  const analysisController = useRef<AbortController | null>(null);
  useEffect(() => () => { analysisController.current?.abort(); }, []);
  const fetchThreatAnalysis = useCallback(async (componentIds: string[], analysisType: 'node' | 'edge') => {
    const controller = new AbortController();
    analysisController.current = controller;
    try {
      return await analyzeThreats(nodes, edges, componentIds, analysisType, {
        customContext: analysisState.customContext,
        importedThreatIntel: analysisState.importedThreatIntel,
        targetedAnalysis: targetedModeEnabled ? targetedThreatAnalysis : undefined,
      }, controller.signal);
    } finally { if (analysisController.current === controller) analysisController.current = null; }
  }, [nodes, edges, analysisState, targetedModeEnabled, targetedThreatAnalysis]);

  const analyzeNode = async (
    node: SecurityNode
  ): Promise<SecurityContext & { detailedAnalysis: string }> => {
    const { threats, detailedAnalysis, diagram } = await fetchThreatAnalysis([node.id], 'node');
    
    // For node analysis, the detailed analysis is in the returned diagram
    let nodeSpecificAnalysis = detailedAnalysis;
    
    // Check if we have a diagram with the node's analysis
    if (diagram && diagram.nodes) {
      const updatedNode = diagram.nodes.find((n: any) => n.id === node.id);
      if (updatedNode && updatedNode.data?.additionalContext) {
        nodeSpecificAnalysis = updatedNode.data.additionalContext;
        console.log(`[ThreatAnalysisPanel] Found node analysis in diagram for ${node.id}: ${nodeSpecificAnalysis.length} chars`);
      }
    }
    
    return {
      threats,
detailedAnalysis: nodeSpecificAnalysis
    };
  };

  const analyzeEdge = async (
    edge: SecurityEdge
  ): Promise<SecurityContext & { detailedAnalysis: string }> => {
    const { threats, detailedAnalysis } = await fetchThreatAnalysis([edge.id], 'edge');
    return { threats, detailedAnalysis };
  };

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    analyzeNode,
    analyzeEdge,
    analyzeSelectedNodes
  }));

  const analyzeSelectedNodes = useCallback(async () => {
    // Generate single analysis ID for the entire flow
    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[ThreatAnalysisPanel] analyzeSelectedNodes called with ID: ${analysisId}`);
    
    if (!onNodesUpdate || !onEdgesUpdate) {
      console.error('Update handlers not provided');
      return;
    }

    if (selectedNodes.length === 0) {
      console.warn('No nodes selected for analysis');
      return;
    }
    
    // Prevent duplicate analysis if already running
    if (isAnalyzing || analysisInProgressRef.current) {
      console.log(`[ThreatAnalysisPanel] Analysis already in progress, ignoring call for ${analysisId}`);
      return;
    }
    
    // Set the current analysis ID immediately
    setCurrentAnalysisId(analysisId);

    // Filter out security zone nodes and drawing nodes from analysis
    const selectedNodeObjects = nodes.filter(node => 
      selectedNodes.includes(node.id) && 
      node.type !== 'securityZone' &&
      (node as any).type !== 'freehand' &&
      (node as any).type !== 'shape' &&
      (node as any).type !== 'textAnnotation'
    );
    
    // Find all edges connected to selected nodes
    const connectedEdges = edges.filter(edge => 
      selectedNodes.includes(edge.source) || selectedNodes.includes(edge.target)
    );
    
    const componentCount = selectedNodeObjects.length;
    
    // Use new node-by-node estimation
    const tokenEstimate = estimateNodeByNodeTokens(componentCount, connectedEdges.length);
    const estimatedTokens = tokenEstimate.total;
    const requestCount = componentCount + 1; // One request per node + system analysis
    
    // Get current provider info
    const provider = settings.api.llmMode === 'local' ? 'local' : 'public';
    const model = settings.api.llmMode === 'local' ? settings.api.localLLM.model : 
                  settings.api.providerConfig?.openai?.model || 
                  settings.api.providerConfig?.anthropic?.model || 
                  'gpt-4';
    
    // Use new time estimation
    const timeEstimate = estimateNodeByNodeTime(componentCount, provider);
    const estimatedTime = timeEstimate.total;
    
    // Show cost dialog
    setCostDialog({
      open: true,
      tokens: estimatedTokens,
      passes: requestCount,
      analysisType: 'selected',
      componentCount,
      provider,
      model,
      estimatedTime,
      analysisId, // Pass the analysis ID
      isTargetedAnalysis: targetedModeEnabled,
      targetedThreatActor: targetedModeEnabled ? targetedThreatAnalysis.threatActors?.split(',')[0]?.trim() : undefined,
      onContinue: () => {
        console.log(`[ThreatAnalysisPanel] Cost dialog onContinue clicked for ${analysisId}`);
        // Prevent double-click on continue button
        setCostDialog(prev => {
          if (!prev.open) {
            console.log('[ThreatAnalysisPanel] Cost dialog already closed, ignoring continue');
            return prev;
          }
          return { ...prev, open: false };
        });
        // Directly call without delay to prevent race conditions
        proceedWithSelectedAnalysis(analysisId);
      },
      onCancel: () => {
        setCostDialog(prev => ({ ...prev, open: false }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodes, nodes, edges, settings, onNodesUpdate, onEdgesUpdate]);
  
  const proceedWithSelectedAnalysis = useCallback(async (analysisId?: string) => {
    // Use provided ID or generate new one (for backward compatibility)
    const finalAnalysisId = analysisId || `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[ThreatAnalysisPanel] proceedWithSelectedAnalysis called with ID: ${finalAnalysisId}`);
    
    // Use ref guard to prevent duplicate execution
    if (analysisInProgressRef.current) {
      console.log(`[ThreatAnalysisPanel] Analysis already in progress (ref guard), aborting ${finalAnalysisId}`);
      return;
    }
    
    // Double-check state to prevent duplicate analysis
    if (isAnalyzing) {
      console.log(`[ThreatAnalysisPanel] Analysis already in progress (state check), aborting ${finalAnalysisId}`);
      return;
    }
    
    // Set the ref guard immediately
    analysisInProgressRef.current = true;
    
    // Use the final ID
    setCurrentAnalysisId(finalAnalysisId);
    setIsAnalyzing(true);
    cancelRef.current = false;
    setShowProgressDialog(true);
    
    // Re-get selected nodes since they're not in closure
    const selectedNodeObjects = nodes.filter(node => 
      selectedNodes.includes(node.id) && node.type !== 'securityZone'
    );
    
    // Find all edges connected to selected nodes
    const connectedEdges = edges.filter(edge => 
      selectedNodes.includes(edge.source) || selectedNodes.includes(edge.target)
    );
    
    const startTime = Date.now();
    
    // Initialize threat analysis logger if enabled
    if (settings.threatAnalysisLogging?.enabled) {
      await threatAnalysisLogger.initialize(settings.threatAnalysisLogging);
    }
    
    // Find directly connected nodes for additional context
    const directlyConnectedNodeIds = new Set();
    connectedEdges.forEach(edge => {
      if (selectedNodes.includes(edge.source) && !selectedNodes.includes(edge.target)) {
        directlyConnectedNodeIds.add(edge.target);
      }
      if (selectedNodes.includes(edge.target) && !selectedNodes.includes(edge.source)) {
        directlyConnectedNodeIds.add(edge.source);
      }
    });
    
    
    const totalItems = selectedNodeObjects.length;
    
    // Log analysis start
    if (threatAnalysisLogger.isEnabled()) {
      await threatAnalysisLogger.startAnalysis(
        selectedNodeObjects.length, 
        connectedEdges.length, 
        { 
          ...settings.threatAnalysis || {},
          analysisType: 'selected-nodes',
          selectedNodeIds: selectedNodes,
          contextNodeIds: Array.from(directlyConnectedNodeIds)
        }
      );
    }
    
    setProgress({
      total: selectedNodeObjects.length + 2, // nodes + system analysis + MITRE enrichment
      completed: 0,
      current: `Preparing analysis of ${selectedNodeObjects.length} selected nodes...`,
      status: 'preparing',
      errors: []
    });

    let threatsFound = 0;
    let vulnerabilitiesFound = 0;


    try {
      // Show dialog in analyzing mode
      setCostDialog(prev => ({ 
        ...prev, 
        isAnalyzing: true,
        progress: {
          current: 0,
          total: selectedNodeObjects.length + 2, // nodes + system analysis + MITRE enrichment
          currentComponent: 'Preparing analysis...',
          timeRemaining: undefined,
          phase: 'node-analysis'
        }
      }));

            // Analyze selected nodes
      const updatedNodes: SecurityNode[] = [...nodes];
      
      // Perform comprehensive analysis for selected nodes
      try {
        // Show progress
        setProgress(prev => ({
          ...prev,
          completed: 0,
          current: `Analyzing ${selectedNodeObjects.length} selected components...`,
          status: 'analyzing'
        }));
        
        setCostDialog(prev => ({ 
          ...prev,
          progress: {
            current: 0,
            total: selectedNodeObjects.length + 2,
            currentComponent: 'Phase 1: Analyzing components and connections',
            timeRemaining: 30,
            phase: 'node-analysis'
          }
        }));

        // Perform comprehensive analysis
        // Note: Backend analyzes nodes individually but we don't get progress updates
        // for each node, only the final result
        let systemResult;
        try {
          console.log(`[ThreatAnalysisPanel] Calling fetchThreatAnalysis for ${finalAnalysisId} with nodes:`, selectedNodes);
          systemResult = await fetchThreatAnalysis(selectedNodes, 'node');
          
          // Log the complete structure of systemResult for debugging
          console.log(`[ThreatAnalysisPanel] Complete systemResult structure for ${finalAnalysisId}:`, {
            hasSystemResult: !!systemResult,
            systemResultType: typeof systemResult,
            systemResultKeys: systemResult ? Object.keys(systemResult) : [],
            threats: systemResult?.threats,
            detailedAnalysis: systemResult?.detailedAnalysis?.substring(0, 100),
            hasSystemAnalysis: !!systemResult?.systemAnalysis,
            hasComponentThreats: !!systemResult?.componentThreats,
            componentThreatsKeys: systemResult?.componentThreats ? Object.keys(systemResult.componentThreats) : [],
            hasAttackPaths: !!systemResult?.attackPaths,
            attackPathsLength: systemResult?.attackPaths?.length,
            hasVulnerabilities: !!systemResult?.vulnerabilities,
            vulnerabilitiesLength: systemResult?.vulnerabilities?.length,
            hasRecommendations: !!systemResult?.recommendations,
            recommendationsLength: systemResult?.recommendations?.length,
            hasDiagram: !!systemResult?.diagram,
            diagramNodeCount: systemResult?.diagram?.nodes?.length
          });
        } catch (fetchError) {
          console.error('[ThreatAnalysisPanel] fetchThreatAnalysis failed:', fetchError);
          const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
          throw new Error(`Failed to fetch threat analysis: ${errorMessage}`);
        }
        
        // Extract the updated diagram from the result (contains node-specific analysis in additionalContext)
        const returnedDiagram = systemResult?.diagram;
        
        console.log('[ThreatAnalysisPanel] Received diagram from backend:', {
          hasDiagram: !!returnedDiagram,
          nodeCount: returnedDiagram?.nodes?.length || 0,
          nodesWithAnalysis: returnedDiagram?.nodes?.filter((n: any) => n.data?.additionalContext)?.length || 0
        });
        
        // Update progress to system analysis phase
        setProgress(prev => ({
          ...prev,
          completed: selectedNodeObjects.length, // All nodes analyzed
          current: 'Consolidating threats and attack paths...',
          status: 'analyzing'
        }));
        
        setCostDialog(prev => ({ 
          ...prev,
          progress: {
            current: selectedNodeObjects.length,
            total: selectedNodeObjects.length + 2,
            currentComponent: 'Phase 2: Analyzing system-wide attack paths',
            timeRemaining: 10,
            phase: 'system-analysis'
          }
        }));
        
        
        
        // Extract and apply results
        const componentThreatsMap = systemResult?.componentThreats || {};
        
        console.log('[ThreatAnalysisPanel] Extracted componentThreatsMap:', {
          hasComponentThreatsMap: !!componentThreatsMap,
          componentIds: Object.keys(componentThreatsMap),
          totalThreats: Object.values(componentThreatsMap).flat().length
        });
        
        // Update selected nodes with their threats
        selectedNodeObjects.forEach(currentNode => {
          const threats = componentThreatsMap[currentNode.id] || [];
          const nodeIndex = updatedNodes.findIndex(n => n.id === currentNode.id);
          
          if (nodeIndex !== -1) {
            // Get node-specific analysis from the returned diagram if available
            let nodeAnalysis = '';
            if (returnedDiagram && returnedDiagram.nodes) {
              const updatedNode = returnedDiagram.nodes.find((n: any) => n.id === currentNode.id);
              if (updatedNode && updatedNode.data && updatedNode.data.additionalContext) {
                nodeAnalysis = updatedNode.data.additionalContext;
              }
            }
            
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              data: {
                ...updatedNodes[nodeIndex].data,
                securityContext: {
                  threats
                },
                additionalContext: nodeAnalysis
              }
            } as SecurityNode;
            
            console.log(`[ThreatAnalysisPanel] Updated node ${currentNode.id} with analysis:`, {
              threatsCount: threats.length,
              hasNodeAnalysis: !!nodeAnalysis,
              nodeAnalysisLength: nodeAnalysis?.length || 0,
              nodeAnalysisPreview: nodeAnalysis ? nodeAnalysis.substring(0, 100) + '...' : 'No analysis',
              hasReturnedDiagram: !!returnedDiagram,
              foundInReturnedDiagram: returnedDiagram?.nodes?.some((n: any) => n.id === currentNode.id)
            });
            
            threatsFound += threats.filter((t: any) => t.type === 'threat').length;
            vulnerabilitiesFound += threats.filter((t: any) => t.type === 'vulnerability').length;
          }
        });
        
        // Update progress to enrichment phase
        setProgress(prev => ({
          ...prev,
          completed: selectedNodeObjects.length + 1, // All nodes + system analysis complete
          current: 'Preparing the analysis report...',
          status: 'analyzing'
        }));
        
        setCostDialog(prev => ({ 
          ...prev,
          progress: {
            current: selectedNodeObjects.length + 1,
            total: selectedNodeObjects.length + 2,
            currentComponent: 'Preparing the analysis report',
            timeRemaining: 5,
            phase: 'enrichment'
          }
        }));
        
        
        
        // Build comprehensive system analysis from the backend response
        console.log('[ThreatAnalysisPanel] Building systemAnalysisData from:', {
          hasSystemAnalysis: !!systemResult?.systemAnalysis,
          systemAnalysisKeys: systemResult?.systemAnalysis ? Object.keys(systemResult.systemAnalysis) : [],
          hasAttackPaths: !!systemResult?.attackPaths,
          hasVulnerabilities: !!systemResult?.vulnerabilities,
          hasRecommendations: !!systemResult?.recommendations
        });
        
        const systemAnalysisData: any = {
          systemOverview: systemResult?.systemAnalysis?.systemOverview || '',
          componentThreats: systemResult?.systemAnalysis?.componentThreats || componentThreatsMap,
          analyzedComponents: systemResult?.systemAnalysis?.analyzedComponents || [],
          attackPaths: systemResult?.systemAnalysis?.attackPaths || [],
          vulnerabilities: systemResult?.systemAnalysis?.vulnerabilities || [],
          recommendations: systemResult?.systemAnalysis?.recommendations || [],
          ttpSummary: systemResult?.systemAnalysis?.ttpSummary || {},
          overallRiskAssessment: systemResult?.systemAnalysis?.overallRiskAssessment || {},
          timestamp: new Date(),
          // Include targeted analysis info if enabled
          isTargetedAnalysis: targetedModeEnabled || systemResult?.systemAnalysis?.isTargetedAnalysis,
          targetedAnalysis: systemResult?.systemAnalysis?.targetedAnalysis || (targetedModeEnabled ? {
            threatActors: targetedThreatAnalysis.threatActors,
            ttps: targetedThreatAnalysis.ttps,
            vulnerabilities: targetedThreatAnalysis.vulnerabilities,
            focusAreas: targetedThreatAnalysis.focusAreas,
            scenarioDescription: targetedThreatAnalysis.scenarioDescription,
            threatIntelligence: targetedThreatAnalysis.threatIntelligence
          } : undefined)
        };
        
        console.log('[ThreatAnalysisPanel] Created systemAnalysisData:', {
          hasSystemOverview: !!systemAnalysisData.systemOverview,
          componentThreatsCount: Object.keys(systemAnalysisData.componentThreats).length,
          attackPathsCount: systemAnalysisData.attackPaths.length,
          vulnerabilitiesCount: systemAnalysisData.vulnerabilities.length,
          recommendationsCount: systemAnalysisData.recommendations.length,
          isTargetedAnalysis: systemAnalysisData.isTargetedAnalysis,
          hasTargetedAnalysis: !!systemAnalysisData.targetedAnalysis,
          targetedThreatActors: systemAnalysisData.targetedAnalysis?.threatActors
        });
        
        setSystemAnalysis(systemAnalysisData);
        setShowSystemAnalysisDialog(true);
        
        // Log analysis details
        if (threatAnalysisLogger.isEnabled()) {
          await threatAnalysisLogger.completeAnalysis({
            totalThreats: threatsFound,
            totalVulnerabilities: vulnerabilitiesFound,
            duration: Date.now() - startTime,
            nodesAnalyzed: selectedNodeObjects.length,
            edgesAnalyzed: 0
          });
        }
      } catch (error) {
        console.error('[ThreatAnalysisPanel] Analysis error in try block:', error);
        const errorMessage = `Failed to analyze selected nodes: ${error}`;
        
        // Make sure to set progress to 'done' even on error so dialog can close
        setProgress(prev => ({
          ...prev,
          status: 'done',
          errors: [...prev.errors, errorMessage]
        }));
        
        if (threatAnalysisLogger.isEnabled()) {
          await threatAnalysisLogger.logError(errorMessage, { error });
        }
      }

      const updatedEdges: SecurityEdge[] = [...edges];

      if (!cancelRef.current) {
        // Update all nodes and edges
        console.log('[ThreatAnalysisPanel] Calling onNodesUpdate with', updatedNodes.length, 'nodes');
        if (onNodesUpdate) onNodesUpdate(updatedNodes);
        if (onEdgesUpdate) onEdgesUpdate(updatedEdges);

        // Calculate risk level counts from all threats, attack paths, and vulnerabilities
        const riskLevels = {
          Extreme: 0,
          High: 0,
          Medium: 0,
          Minor: 0,
          Sustainable: 0
        };

        // Count risk levels from available threat data
        // This is a placeholder - we'll calculate from actual threat data
        const totalFindings = threatsFound + vulnerabilitiesFound;
        if (totalFindings > 0) {
          const highRisk = Math.ceil(totalFindings * 0.3);
          const mediumRisk = Math.ceil(totalFindings * 0.5);
          const minorRisk = totalFindings - highRisk - mediumRisk;
          
          riskLevels.High = highRisk;
          riskLevels.Medium = mediumRisk;
          riskLevels.Minor = Math.max(0, minorRisk);
        }

        const analysisResults = {
          threatsFound,
          vulnerabilitiesFound,
          riskLevels,
          timestamp: new Date()
        };
        
        setAnalysisResults(analysisResults);

        // Log analysis completion
        if (threatAnalysisLogger.isEnabled()) {
          await threatAnalysisLogger.completeAnalysis({
            totalThreats: threatsFound,
            totalVulnerabilities: vulnerabilitiesFound,
            duration: Date.now() - startTime,
            nodesAnalyzed: selectedNodeObjects.length,
            edgesAnalyzed: 0 // Edges are analyzed as part of node context
          });
        }

        setProgress(prev => ({
          ...prev,
          completed: selectedNodeObjects.length + 2, // All nodes + 2 phases complete
          current: `Analysis complete! Analyzed ${selectedNodeObjects.length} nodes with MITRE enrichment.`,
          status: 'done'
        }));
      }
    } catch (error) {
      console.error('[ThreatAnalysisPanel] Outer catch - Selected nodes analysis failed:', error);
      
      // Extract error message and stack trace
      let errorDetails = '';
      if (error instanceof Error) {
        errorDetails = error.message;
        if (error.stack) {
          console.error('[ThreatAnalysisPanel] Error stack:', error.stack);
        }
      } else {
        errorDetails = String(error);
      }
      
      const errorMessage = `Analysis failed: ${errorDetails}`;
      setProgress(prev => ({
        ...prev,
        status: 'done',
        errors: [...prev.errors, errorMessage]
      }));
      
      if (threatAnalysisLogger.isEnabled()) {
        await threatAnalysisLogger.logError(errorMessage, { error, totalItems });
      }
    } finally {
      // Always reset the ref guard and state
      analysisInProgressRef.current = false;
      setIsAnalyzing(false);
      
      console.log(`[ThreatAnalysisPanel] Analysis completed/failed, reset guards`);
      
      // Close cost dialog after a short delay
      setTimeout(() => {
        setCostDialog(prev => ({ 
          ...prev, 
          open: false,
          isAnalyzing: false
        }));
      }, 2000);
      
      if (progress.errors.length === 0) {
        setTimeout(() => setShowProgressDialog(false), 2000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodes, nodes, edges, settings, onNodesUpdate, onEdgesUpdate, fetchThreatAnalysis, progress.errors.length]);





  // Select all non-zone nodes
  const selectAllNodes = useCallback(() => {
    const nonZoneNodeIds = nodes
      .filter(node => node.type !== 'securityZone')
      .map(node => node.id);
    
    if (onSelectedNodesChange) {
      onSelectedNodesChange(nonZoneNodeIds);
    }
  }, [nodes, onSelectedNodesChange]);

  // Deselect all nodes
  const deselectAllNodes = useCallback(() => {
    if (onSelectedNodesChange) {
      onSelectedNodesChange([]);
    }
  }, [onSelectedNodesChange]);

  // Save threat scenario to file
  const saveThreatScenario = useCallback(async () => {
    try {
      const scenarioFile: ThreatScenarioFile = {
        version: '1.0',
        name: `Threat_Scenario_${new Date().toISOString().split('T')[0]}`,
        description: targetedThreatAnalysis.scenarioDescription,
        targetedAnalysis: targetedThreatAnalysis,
        timestamp: new Date().toISOString()
      };

      const threatActorName = targetedThreatAnalysis.threatActors
        ? targetedThreatAnalysis.threatActors.split(',')[0].trim().replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase()
        : 'threat-scenario';
      const written = await saveFile(`${threatActorName || 'threat-scenario'}-${new Date().toISOString().split('T')[0]}.json`, new Blob([JSON.stringify(scenarioFile, null, 2)], { type: 'application/json' }));
      if (written) setSnackbar({ open: true, severity: 'success', message: 'Threat scenario saved.' });
    } catch (error) {
      console.error('Error saving threat scenario:', error);
      setSnackbar({ open: true, severity: 'error', message: `Threat scenario was not saved: ${error instanceof Error ? error.message : 'Unknown file error'}` });
    }
  }, [targetedThreatAnalysis]);

  // Load threat scenario from file
  const loadThreatScenario = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const scenario: ThreatScenarioFile = JSON.parse(text);
        
        if (scenario.version === '1.0' && scenario.targetedAnalysis) {
          setTargetedThreatAnalysis(scenario.targetedAnalysis);
          setTargetedModeEnabled(true);
        } else {
          console.error('Invalid threat scenario file format');
        }
      } catch (error) {
        console.error('Error loading threat scenario:', error);
      }
    };
    
    input.click();
  }, []);

  const cancelAnalysis = async () => {
    cancelRef.current = true;
    setProgress(prev => ({ ...prev, status: 'cancelled' }));
    analysisInProgressRef.current = false; // Reset ref guard on cancel
    setIsAnalyzing(false);
    
    analysisController.current?.abort();
  };

  // Helper function to find node/edge by label or ID
  const findComponentByLabel = (label: string): { type: 'node' | 'edge'; id: string } | null => {
    // First try to find exact node match by label
    const nodeByLabel = nodes.find(node => 
      node.data?.label?.toLowerCase() === label.toLowerCase() ||
      node.id.toLowerCase() === label.toLowerCase()
    );
    if (nodeByLabel) {
      return { type: 'node', id: nodeByLabel.id };
    }

    // Then try to find exact edge match by label
    const edgeByLabel = edges.find(edge => 
      edge.data?.label?.toLowerCase() === label.toLowerCase() ||
      edge.id.toLowerCase() === label.toLowerCase()
    );
    if (edgeByLabel) {
      return { type: 'edge', id: edgeByLabel.id };
    }

    // Fallback: partial matching for node labels
    const nodeByPartialLabel = nodes.find(node => 
      node.data?.label?.toLowerCase().includes(label.toLowerCase()) ||
      label.toLowerCase().includes(node.data?.label?.toLowerCase() || '')
    );
    if (nodeByPartialLabel) {
      return { type: 'node', id: nodeByPartialLabel.id };
    }

    return null;
  };

  // Handle clicking on a component name to center and select it
  const handleComponentClick = (componentIdOrLabel: string) => {
    // First try to find by ID
    let component = nodes.find(n => n.id === componentIdOrLabel);
    
    // If not found, try to find by label
    if (!component) {
      const found = findComponentByLabel(componentIdOrLabel);
      if (found && found.type === 'node') {
        component = nodes.find(n => n.id === found.id);
      }
    }
    
    if (component && onCenterComponent) {
      onCenterComponent(component.id);
      setShowSystemAnalysisDialog(false); // Close the dialog
    } else {
      console.warn(`Component not found: ${componentIdOrLabel}`);
    }
  };


  // Refs for export
  const reportContentRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    progress: number;
    status: string;
  } | undefined>();
  
  // Snackbar state for threat intel import feedback
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const handleExportPdf = async () => {
    if (!systemAnalysis) {
      console.error('[ThreatAnalysisPanel] Cannot export PDF: No system analysis data');
      return;
    }
    
    // In export-only mode, we don't have reportContentRef, so we need to generate PDF differently
    if (exportOnlyMode) {
      await handleExportPdfFromData();
      return;
    }
    
    if (!reportContentRef.current) {
      console.error('[ThreatAnalysisPanel] Cannot export PDF: No report content ref');
      return;
    }
    
    try {
    const written = await saveFile(`system-analysis-${new Date().toISOString().split('T')[0]}.pdf`, async () => {
    // Expand and render only after the user chooses a destination.
    setIsExporting(true);
    
    // Wait for React to re-render with expanded components
    await new Promise(resolve => {
      // Use requestAnimationFrame to ensure the browser has painted
      requestAnimationFrame(() => {
        // Add additional delay to ensure all animations complete
        setTimeout(resolve, 1000);
      });
    });
    
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (2 * margin);
      let currentY = margin;
      
      // Helper function to add element to PDF with proper pagination
      const addElementToPdf = async (element: HTMLElement, forceNewPage: boolean = false) => {
        const canvas = await html2canvas(element, {
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          windowHeight: element.scrollHeight
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const scale = contentWidth / imgProps.width;
        const scaledHeight = imgProps.height * scale;
        
        // Force new page if requested or if content won't fit
        if (forceNewPage || (currentY + scaledHeight > pageHeight - margin)) {
          pdf.addPage();
          currentY = margin;
        }
        
        // Split content across pages if needed
        let remainingHeight = scaledHeight;
        let sourceY = 0;
        
        while (remainingHeight > 0) {
          const availableHeight = pageHeight - margin - currentY;
          const heightToRender = Math.min(remainingHeight, availableHeight);
          const sourceHeight = heightToRender / scale;
          
          // Create temporary canvas for this portion
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgProps.width;
          tempCanvas.height = sourceHeight;
          const ctx = tempCanvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, sourceY, imgProps.width, sourceHeight,
              0, 0, imgProps.width, sourceHeight
            );
            
            const tempImgData = tempCanvas.toDataURL('image/png');
            pdf.addImage(tempImgData, 'PNG', margin, currentY, contentWidth, heightToRender);
          }
          
          remainingHeight -= heightToRender;
          sourceY += sourceHeight;
          currentY += heightToRender + 5; // Add small gap
          
          // If more content remains, add new page
          if (remainingHeight > 0) {
            pdf.addPage();
            currentY = margin;
          }
        }
      };
      
      // Get the report element
      const reportElement = reportContentRef.current;
      if (!reportElement) throw new Error('The report was closed before export could finish.');
      
      console.log('Report HTML:', reportElement.innerHTML.substring(0, 500));
      
      // Find and process all top-level sections
      
      // 1. First get the Risk Assessment alert if it exists
      const riskAlert = reportElement.querySelector('.MuiAlert-root');
      if (riskAlert) {
        await addElementToPdf(riskAlert as HTMLElement, false);
      }
      
      // 2. Get System Overview card
      const allCards = Array.from(reportElement.querySelectorAll('.MuiCard-root'));
      const systemOverviewCard = allCards.find(card => {
        const title = card.querySelector('.MuiCardHeader-title');
        return title && title.textContent?.includes('System Overview');
      });
      if (systemOverviewCard) {
        console.log('Found System Overview card');
        await addElementToPdf(systemOverviewCard as HTMLElement, false);
      } else {
        console.log('System Overview card not found');
      }
      
      // 3. Process all remaining cards (Component Analysis, Attack Paths, Recommendations, MITRE)
      const remainingCards = allCards.filter(card => {
        const title = card.querySelector('.MuiCardHeader-title');
        return title && !title.textContent?.includes('System Overview');
      });
      
      for (const card of remainingCards) {
        // Skip nested cards
        if (card.parentElement?.closest('.MuiCard-root')) continue;
        
        // Add each major section on a new page
        const isMainSection = card.querySelector('.MuiCardHeader-root') !== null;
        await addElementToPdf(card as HTMLElement, isMainSection);
      }
      
      return pdf.output('blob');
    });
    if (written) setSnackbar({ open: true, severity: 'success', message: 'PDF saved.' });
    } catch (error) {
      setSnackbar({ open: true, severity: 'error', message: `PDF was not saved: ${error instanceof Error ? error.message : 'Unknown file error'}` });
    } finally {
      // Reset exporting state
      setIsExporting(false);
    }
  };

  const handleExportPdfFromData = async () => {
    if (!systemAnalysis) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const written = await saveFile(`system-security-analysis-${timestamp}.pdf`, async () => {
      setIsExporting(true);
      setExportProgress({ progress: 0, status: 'Generating PDF...' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - (2 * margin);
      let yPos = margin;
      
      // Helper function to add text with word wrap
      const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        const lines = pdf.splitTextToSize(text, contentWidth);
        
        lines.forEach((line: string) => {
          if (yPos > 280) {
            pdf.addPage();
            yPos = margin;
          }
          pdf.text(line, margin, yPos);
          yPos += fontSize * 0.4;
        });
        yPos += 5;
      };
      
      // Title
      addText('SYSTEM SECURITY ANALYSIS REPORT', 16, true);
      addText(`Generated: ${new Date().toLocaleString()}`, 10);
      yPos += 10;
      
    // Summary metrics
    const componentCount = Array.isArray(nodes)
      ? nodes.filter(n => n.type !== 'securityZone').length
      : 0;
    const threatCount = systemAnalysis.componentThreats 
      ? Object.values(systemAnalysis.componentThreats).flat().length 
      : 0;
    const vulnerabilityCount = systemAnalysis.vulnerabilities?.length || 0;
    const attackPathCount = systemAnalysis.attackPaths?.length || 0;
    const mitreCount = systemAnalysis.ttpSummary 
      ? Object.keys(systemAnalysis.ttpSummary).length 
      : 0;
      
      addText('ANALYSIS SUMMARY', 14, true);
      addText(`Components Analyzed: ${componentCount}`);
      addText(`Threats Identified: ${threatCount}`);
      addText(`Vulnerabilities Found: ${vulnerabilityCount}`);
      addText(`Attack Paths: ${attackPathCount}`);
      addText(`MITRE Techniques: ${mitreCount}`);
      yPos += 10;
      
      // 1. System Overview Section
      if (systemAnalysis.systemOverview) {
        addText('SYSTEM OVERVIEW', 14, true);
        
        // Description
        if (systemAnalysis.systemOverview.description) {
          addText(systemAnalysis.systemOverview.description);
        }
        
        // Overall Risk Assessment
        if (systemAnalysis.systemOverview.overallRiskAssessment) {
          yPos += 5;
          addText('Overall Risk Assessment:', 12, true);
          const risk = systemAnalysis.systemOverview.overallRiskAssessment;
          addText(`Risk Level: ${risk.risk}`);
          addText(`Likelihood: ${risk.likelihood}`);
          addText(`Impact: ${risk.impact}`);
          if (risk.justification) {
            addText(`Justification: ${risk.justification}`);
          }
        }
        
        // Key Findings
        if (systemAnalysis.systemOverview.keyFindings?.length > 0) {
          yPos += 5;
          addText('Key Findings:', 12, true);
          systemAnalysis.systemOverview.keyFindings.forEach((finding: string, idx: number) => {
            addText(`${idx + 1}. ${finding}`);
          });
        }
        
        // Critical Components
        if (systemAnalysis.systemOverview.criticalComponents?.length > 0) {
          yPos += 5;
          addText('Critical Components:', 12, true);
          systemAnalysis.systemOverview.criticalComponents.forEach((comp: string) => {
            addText(`• ${comp}`);
          });
        }
        
        yPos += 10;
      }
      
      // 2. Component Analysis Section
      if (systemAnalysis.componentThreats && Object.keys(systemAnalysis.componentThreats).length > 0) {
        pdf.addPage();
        yPos = margin;
        addText('COMPONENT SECURITY ANALYSIS', 14, true);
        
        // Group components by zone
        const componentsByZone: Record<string, any[]> = {};
        Object.entries(systemAnalysis.componentThreats).forEach(([componentId, threats]) => {
          const node = nodes.find(n => n.id === componentId);
          if (node) {
            const zone = (node.data as any).zone || 'Unzoned';
            const zoneKey = String(zone);
            if (!componentsByZone[zoneKey]) componentsByZone[zoneKey] = [];
            componentsByZone[zoneKey].push({ node, threats });
          }
        });
        
        // Process each zone
        Object.entries(componentsByZone).sort().forEach(([zone, components]) => {
          addText(`[${zone} Zone]`, 12, true);
          
          components.forEach(({ node, threats }) => {
            addText(`${node.data.label} (${node.data.type})`, 11, true);
            
            if (Array.isArray(threats) && threats.length > 0) {
              threats.forEach((threat: any, index: number) => {
                addText(`${index + 1}. ${threat.description || threat.threat || 'Unknown threat'}`);
                if (threat.risk) addText(`   Risk: ${threat.risk}`);
                if (threat.likelihood) addText(`   Likelihood: ${threat.likelihood}`);
                if (threat.impact) addText(`   Impact: ${threat.impact}`);
                if (threat.mitreTechniques?.length > 0) {
                  addText(`   MITRE: ${threat.mitreTechniques.join(', ')}`);
                }
                if (threat.mitigation) {
                  addText(`   Mitigation: ${threat.mitigation}`);
                }
              });
            }
            yPos += 5;
          });
        });
      }
      
      // 3. Attack Paths Section
      if (systemAnalysis.attackPaths && systemAnalysis.attackPaths.length > 0) {
        pdf.addPage();
        yPos = margin;
        addText('ATTACK PATH ANALYSIS', 14, true);
        
        systemAnalysis.attackPaths.forEach((path: any, index: number) => {
          addText(`Attack Path ${index + 1}:`, 12, true);
          
          // Path visualization
          if (path.path && Array.isArray(path.path)) {
            addText(`Path: ${path.path.join(' → ')}`);
          }
          
          if (path.description) {
            addText(path.description);
          }
          
          addText(`Risk: ${path.risk || 'Unknown'}`);
          addText(`Likelihood: ${path.likelihood || 'Unknown'}`);
          addText(`Impact: ${path.impact || 'Unknown'}`);
          
          if (path.mitreTechniques?.length > 0) {
            addText(`MITRE Techniques: ${path.mitreTechniques.join(', ')}`);
          }
          
          if (path.mitigation) {
            addText(`Mitigation: ${path.mitigation}`);
          }
          
          yPos += 5;
        });
      }
      
      // 4. Recommendations Section
      if (systemAnalysis.recommendations && systemAnalysis.recommendations.length > 0) {
        pdf.addPage();
        yPos = margin;
        addText('SECURITY RECOMMENDATIONS', 14, true);
        
        // Sort by priority
        const sortedRecs = [...systemAnalysis.recommendations].sort((a: any, b: any) => {
          const priorityOrder = ['EXTREME', 'HIGH', 'MEDIUM', 'MINOR', 'LOW'];
          const aPriority = a.priority || 'LOW';
          const bPriority = b.priority || 'LOW';
          return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
        });
        
        sortedRecs.forEach((rec: any, index: number) => {
          const priority = rec.priority || 'MEDIUM';
          addText(`${index + 1}. [${priority}] ${rec.action || rec.recommendation || rec.description || rec}`, 11, true);
          
          if (rec.affectedComponents?.length > 0) {
            addText(`Affects: ${rec.affectedComponents.join(', ')}`);
          }
          
          if (rec.rationale) {
            addText(`Rationale: ${rec.rationale}`);
          }
          
          if (rec.effort) {
            addText(`Effort: ${rec.effort}`);
          }
          
          if (rec.impact) {
            addText(`Expected Impact: ${rec.impact}`);
          }
          
          yPos += 3;
        });
      }
      
      // 5. MITRE ATT&CK Techniques Section
      if (systemAnalysis.ttpSummary && Object.keys(systemAnalysis.ttpSummary).length > 0) {
        pdf.addPage();
        yPos = margin;
        addText('MITRE ATT&CK TECHNIQUE REFERENCE', 14, true);
        
        Object.entries(systemAnalysis.ttpSummary)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([techniqueId, details]: [string, any]) => {
            addText(`${techniqueId}: ${details.name}`, 11, true);
            
            if (details.description) {
              addText(details.description);
            }
            
            if (details.tactics?.length > 0) {
              addText(`Tactics: ${details.tactics.join(', ')}`);
            }
            
            if (details.url) {
              addText(`Reference: ${details.url}`);
            }
            
            yPos += 5;
          });
      }
      
      // 6. Vulnerabilities Section (if present)
      if (systemAnalysis.vulnerabilities && systemAnalysis.vulnerabilities.length > 0) {
        pdf.addPage();
        yPos = margin;
        addText('IDENTIFIED VULNERABILITIES', 14, true);
        
        systemAnalysis.vulnerabilities.forEach((vuln: any, index: number) => {
          addText(`${index + 1}. ${vuln.vulnerability || vuln.description || 'Unknown vulnerability'}`, 11, true);
          if (vuln.severity) addText(`Severity: ${vuln.severity}`);
          if (vuln.affectedComponents?.length > 0) {
            addText(`Affected Components: ${vuln.affectedComponents.join(', ')}`);
          }
          if (vuln.cve) addText(`CVE: ${vuln.cve}`);
          if (vuln.remediation) {
            addText(`Remediation: ${vuln.remediation}`);
          }
          yPos += 3;
        });
      }
      
      return pdf.output('blob');
      });
      if (written) setExportProgress({ progress: 100, status: 'PDF saved successfully!' });
      else setExportProgress(undefined);
      
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportProgress({ progress: 0, status: 'PDF export failed' });
      setSnackbar({ open: true, severity: 'error', message: `PDF was not saved: ${error instanceof Error ? error.message : 'Unknown file error'}` });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(undefined), 2000);
    }
  };
  
  // Helper function to update both local state and analysis context
  const updateThreatIntelligence = (updates: Partial<typeof targetedThreatAnalysis.threatIntelligence>) => {
    // Update local state
    setTargetedThreatAnalysis(prev => ({
      ...prev,
      threatIntelligence: {
        ...prev.threatIntelligence,
        ...updates
      }
    }));
    
    // Update analysis context for AnalysisChat
    const currentIntel = targetedThreatAnalysis.threatIntelligence || {};
    const updatedIntel = { ...currentIntel, ...updates };
    
    setImportedThreatIntel({
      raw: updatedIntel.rawIntelligence || '',
      processed: {
        cves: updatedIntel.recentCVEs || '',
        iocs: updatedIntel.knownIOCs || '',
        campaigns: updatedIntel.campaignInfo || ''
      },
      metadata: {
        totalImported: 0, // Will be updated on actual import
        relevantExtracted: 0, // Will be updated on actual import
        importDate: updatedIntel.intelligenceDate || new Date().toISOString(),
        source: 'manual_entry'
      }
    });
  };


  const handleExportText = async () => {
    console.log('[ThreatAnalysisPanel] handleExportText called, systemAnalysis:', systemAnalysis);
    if (!systemAnalysis) {
      console.error('[ThreatAnalysisPanel] Cannot export text: No system analysis data');
      return;
    }
    
    // Build text content
    let textContent = 'SYSTEM SECURITY ANALYSIS REPORT\n';
    textContent += '================================\n\n';
    textContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Add targeted analysis info if present
    if (systemAnalysis.isTargetedAnalysis && systemAnalysis.targetedAnalysis) {
      textContent += 'TARGETED THREAT ANALYSIS\n';
      textContent += '========================\n';
      textContent += `Threat Actors: ${systemAnalysis.targetedAnalysis.threatActors}\n`;
      textContent += `TTPs: ${systemAnalysis.targetedAnalysis.ttps}\n`;
      textContent += `Known Vulnerabilities: ${systemAnalysis.targetedAnalysis.vulnerabilities}\n`;
      textContent += `Focus Areas: ${systemAnalysis.targetedAnalysis.focusAreas}\n`;
      if (systemAnalysis.targetedAnalysis.scenarioDescription) {
        textContent += `Scenario: ${systemAnalysis.targetedAnalysis.scenarioDescription}\n`;
      }
      
      // Add threat intelligence if present
      if (systemAnalysis.targetedAnalysis.threatIntelligence) {
        textContent += '\nTHREAT INTELLIGENCE:\n';
        if (systemAnalysis.targetedAnalysis.threatIntelligence.rawIntelligence) {
          textContent += `Intelligence Reports:\n${systemAnalysis.targetedAnalysis.threatIntelligence.rawIntelligence}\n\n`;
        }
        if (systemAnalysis.targetedAnalysis.threatIntelligence.recentCVEs) {
          textContent += `Recent CVEs:\n${systemAnalysis.targetedAnalysis.threatIntelligence.recentCVEs}\n\n`;
        }
        if (systemAnalysis.targetedAnalysis.threatIntelligence.knownIOCs) {
          textContent += `Known IOCs:\n${systemAnalysis.targetedAnalysis.threatIntelligence.knownIOCs}\n\n`;
        }
        if (systemAnalysis.targetedAnalysis.threatIntelligence.campaignInfo) {
          textContent += `Campaign Information:\n${systemAnalysis.targetedAnalysis.threatIntelligence.campaignInfo}\n\n`;
        }
        if (systemAnalysis.targetedAnalysis.threatIntelligence.intelligenceDate) {
          textContent += `Intelligence Date: ${systemAnalysis.targetedAnalysis.threatIntelligence.intelligenceDate}\n`;
        }
      }
      textContent += '\n';
    }
    
    // Summary metrics
    const componentCount = nodes.filter(n => n.type !== 'securityZone').length;
    const threatCount = systemAnalysis.componentThreats 
      ? Object.values(systemAnalysis.componentThreats).flat().length 
      : 0;
    const vulnerabilityCount = systemAnalysis.vulnerabilities?.length || 0;
    const attackPathCount = systemAnalysis.attackPaths?.length || 0;
    const mitreCount = systemAnalysis.ttpSummary 
      ? Object.keys(systemAnalysis.ttpSummary).length 
      : 0;
    
    textContent += 'ANALYSIS SUMMARY\n';
    textContent += '================\n';
    textContent += `Components Analyzed: ${componentCount}\n`;
    textContent += `Threats Identified: ${threatCount}\n`;
    textContent += `Vulnerabilities Found: ${vulnerabilityCount}\n`;
    textContent += `Attack Paths: ${attackPathCount}\n`;
    textContent += `MITRE Techniques: ${mitreCount}\n\n`;
    
    // 1. System Overview
    if (systemAnalysis.systemOverview) {
      textContent += 'SYSTEM OVERVIEW\n';
      textContent += '===============\n';
      
      if (systemAnalysis.systemOverview.description) {
        textContent += systemAnalysis.systemOverview.description + '\n\n';
      }
      
      // Overall Risk Assessment
      if (systemAnalysis.systemOverview.overallRiskAssessment) {
        textContent += 'Overall Risk Assessment\n';
        textContent += '-----------------------\n';
        const risk = systemAnalysis.systemOverview.overallRiskAssessment;
        textContent += `Risk Level: ${risk.risk}\n`;
        textContent += `Likelihood: ${risk.likelihood}\n`;
        textContent += `Impact: ${risk.impact}\n`;
        if (risk.justification) {
          textContent += `Justification: ${risk.justification}\n`;
        }
        textContent += '\n';
      }
      
      // Key Findings
      if (systemAnalysis.systemOverview.keyFindings?.length > 0) {
        textContent += 'Key Findings\n';
        textContent += '------------\n';
        systemAnalysis.systemOverview.keyFindings.forEach((finding: string, idx: number) => {
          textContent += `${idx + 1}. ${finding}\n`;
        });
        textContent += '\n';
      }
      
      // Critical Components
      if (systemAnalysis.systemOverview.criticalComponents?.length > 0) {
        textContent += 'Critical Components\n';
        textContent += '-------------------\n';
        systemAnalysis.systemOverview.criticalComponents.forEach((comp: string) => {
          textContent += `• ${comp}\n`;
        });
        textContent += '\n';
      }
    }
    
    // 2. Component Security Analysis
    const analyzedComps = (systemAnalysis as any).analyzedComponents || [];
    if (analyzedComps.length > 0 || (systemAnalysis.componentThreats && Object.keys(systemAnalysis.componentThreats).length > 0)) {
      textContent += '\nCOMPONENT SECURITY ANALYSIS\n';
      textContent += '===========================\n\n';
      
      // Group components by zone
      const componentsByZone: Record<string, any[]> = {};
      
      // If we have analyzedComponents, use that (includes all analyzed nodes)
      if (analyzedComps.length > 0) {
        analyzedComps.forEach((comp: any) => {
          const node = nodes.find(n => n.id === comp.nodeId);
          if (node) {
            const zone = (node.data as any).zone || 'Unzoned';
            const zoneKey = String(zone);
            if (!componentsByZone[zoneKey]) componentsByZone[zoneKey] = [];
            const threats = systemAnalysis.componentThreats?.[comp.nodeId] || [];
            componentsByZone[zoneKey].push({ node, threats });
          }
        });
      } else {
        // Fallback to old method using componentThreats
        Object.entries(systemAnalysis.componentThreats).forEach(([componentId, threats]) => {
          const node = nodes.find(n => n.id === componentId);
          if (node) {
            const zone = (node.data as any).zone || 'Unzoned';
            const zoneKey = String(zone);
            if (!componentsByZone[zoneKey]) componentsByZone[zoneKey] = [];
            componentsByZone[zoneKey].push({ node, threats });
          }
        });
      }
      
      // Process each zone
      Object.entries(componentsByZone).sort().forEach(([zone, components]) => {
        textContent += `[${zone} Zone]\n`;
        textContent += '='.repeat(zone.length + 7) + '\n\n';
        
        components.forEach(({ node, threats }) => {
          const nodeLabel = node?.data?.label ?? 'Unnamed';
          const nodeType = node?.data?.type ?? '';
          const header = nodeType ? `${nodeLabel} (${nodeType})` : `${nodeLabel}`;
          textContent += `## ${header}\n`;
          textContent += '-'.repeat(header.length + 3) + '\n';
          
          // Component properties
           if (node?.data?.securityLevel) {
            textContent += `Security Level: ${node.data.securityLevel}\n`;
          }
           if (node?.data?.dataClassification) {
            textContent += `Data Classification: ${node.data.dataClassification}\n`;
          }
           if (Array.isArray(node?.data?.authMethods) && node.data.authMethods.length > 0) {
            textContent += `Authentication: ${node.data.authMethods.join(', ')}\n`;
          }
          
          // Threats
          if (Array.isArray(threats) && threats.length > 0) {
            textContent += '\nThreats:\n';
            threats.forEach((threat: any, index: number) => {
              textContent += `${index + 1}. ${threat.description || threat.threat || 'Unknown threat'}\n`;
              textContent += `   Risk: ${threat.risk || 'Unknown'}\n`;
              textContent += `   Likelihood: ${threat.likelihood || 'Unknown'} | Impact: ${threat.impact || 'Unknown'}\n`;
              if (threat.mitreTechniques?.length > 0) {
                textContent += `   MITRE: ${threat.mitreTechniques.join(', ')}\n`;
              }
              if (threat.mitigation) {
                textContent += `   Mitigation: ${threat.mitigation}\n`;
              }
            });
          }
          
          // Vulnerabilities for this component
          const vulns = systemAnalysis.vulnerabilities?.filter((v: any) => 
            (Array.isArray(v.affectedComponents) && v.affectedComponents.includes(nodeLabel)) || v.affectedNode === nodeLabel
          );
          if (vulns && vulns.length > 0) {
            textContent += '\nVulnerabilities:\n';
            vulns.forEach((vuln: any, index: number) => {
              textContent += `${index + 1}. ${vuln.description || vuln.vulnerability || 'Unknown'}\n`;
              if (vuln.severity) textContent += `   Severity: ${vuln.severity}\n`;
              if (vuln.cve && vuln.cve !== 'N/A') {
                textContent += `   CVE: ${vuln.cve}`;
                if (vuln.cvss) textContent += ` | CVSS: ${vuln.cvss}`;
                textContent += '\n';
              }
              if (vuln.remediation) {
                textContent += `   Remediation: ${vuln.remediation}\n`;
              }
            });
          }
          textContent += '\n';
        });
      });
    }
    
    // 3. Attack Paths Analysis
    if (systemAnalysis.attackPaths?.length > 0) {
      textContent += '\nATTACK PATH ANALYSIS\n';
      textContent += '====================\n\n';
      
      systemAnalysis.attackPaths.forEach((path: any, index: number) => {
        textContent += `Attack Path ${index + 1}\n`;
        textContent += '-'.repeat(13 + String(index + 1).length) + '\n';
        
        if (path.path && Array.isArray(path.path)) {
          textContent += `Path: ${path.path.join(' → ')}\n`;
        }
        
        if (path.description) {
          textContent += `Description: ${path.description}\n`;
        }
        
        textContent += `Risk: ${path.risk || 'Unknown'}\n`;
        textContent += `Likelihood: ${path.likelihood || 'Unknown'} | Impact: ${path.impact || 'Unknown'}\n`;
        
        if (path.mitreTechniques?.length > 0) {
          textContent += `MITRE Techniques: ${path.mitreTechniques.join(', ')}\n`;
        }
        
        if (path.mitigation) {
          textContent += `Mitigation: ${path.mitigation}\n`;
        }
        
        textContent += '\n';
      });
    }
    
    // 4. Security Recommendations
    if (systemAnalysis.recommendations?.length > 0) {
      textContent += '\nSECURITY RECOMMENDATIONS\n';
      textContent += '========================\n\n';
      
      const sortedRecs = [...systemAnalysis.recommendations].sort((a: any, b: any) => {
        const priorityOrder = ['EXTREME', 'HIGH', 'MEDIUM', 'MINOR', 'LOW'];
        const aPriority = a.priority || 'LOW';
        const bPriority = b.priority || 'LOW';
        return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
      });
      
      sortedRecs.forEach((rec: any, index: number) => {
        const priority = rec.priority || 'MEDIUM';
        textContent += `${index + 1}. [${priority}] ${rec.action || rec.recommendation || rec.description || rec}\n`;
        
        if (rec.affectedComponents?.length > 0) {
          textContent += `   Affects: ${rec.affectedComponents.join(', ')}\n`;
        }
        
        if (rec.rationale) {
          textContent += `   Rationale: ${rec.rationale}\n`;
        }
        
        if (rec.effort) {
          textContent += `   Effort: ${rec.effort}\n`;
        }
        
        if (rec.impact) {
          textContent += `   Expected Impact: ${rec.impact}\n`;
        }
        
        textContent += '\n';
      });
    }
    
    // 5. MITRE ATT&CK Technique Reference
    if (systemAnalysis.ttpSummary && Object.keys(systemAnalysis.ttpSummary).length > 0) {
      textContent += '\nMITRE ATT&CK TECHNIQUE REFERENCE\n';
      textContent += '================================\n\n';
      
      Object.entries(systemAnalysis.ttpSummary)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([techniqueId, details]: [string, any]) => {
          const name = details?.name || 'Technique';
          const title = `${techniqueId}: ${name}`;
          textContent += `${title}\n`;
          textContent += '-'.repeat(title.length) + '\n';
          
          if (details.description) {
            textContent += `${details.description}\n`;
          }
          
          if (details.tactics?.length > 0) {
            textContent += `Tactics: ${details.tactics.join(', ')}\n`;
          }
          
          if (details.url) {
            textContent += `Reference: ${details.url}\n`;
          }
          
          textContent += '\n';
        });
    }
    
    // 6. Vulnerabilities Summary (if not already included in components)
    const standaloneVulns = systemAnalysis.vulnerabilities?.filter((v: any) => 
      !v.affectedComponents || v.affectedComponents.length === 0
    );
    if (standaloneVulns && standaloneVulns.length > 0) {
      textContent += '\nIDENTIFIED VULNERABILITIES\n';
      textContent += '==========================\n\n';
      
      standaloneVulns.forEach((vuln: any, index: number) => {
        textContent += `${index + 1}. ${vuln.vulnerability || vuln.description || 'Unknown vulnerability'}\n`;
        if (vuln.severity) textContent += `   Severity: ${vuln.severity}\n`;
        if (vuln.cve && vuln.cve !== 'N/A') {
          textContent += `   CVE: ${vuln.cve}`;
          if (vuln.cvss) textContent += ` | CVSS: ${vuln.cvss}`;
          textContent += '\n';
        }
        if (vuln.remediation) {
          textContent += `   Remediation: ${vuln.remediation}\n`;
        }
        textContent += '\n';
      });
    }
    
    // Create and download the file
    console.log('[ThreatAnalysisPanel] Creating text file, content length:', textContent.length);
    if (await downloadTextFile(textContent, 'system-security-analysis')) console.log('[ThreatAnalysisPanel] Text export completed');
  };

  const handleExportHtml = async () => {
    if (!systemAnalysis) return;
    
    // Calculate metrics
    const componentCount = nodes.filter(n => n.type !== 'securityZone').length;
    const threatCount = systemAnalysis.componentThreats 
      ? Object.values(systemAnalysis.componentThreats).flat().length 
      : 0;
    const vulnerabilityCount = systemAnalysis.vulnerabilities?.length || 0;
    const attackPathCount = systemAnalysis.attackPaths?.length || 0;
    const mitreCount = systemAnalysis.ttpSummary 
      ? Object.keys(systemAnalysis.ttpSummary).length 
      : 0;
    
    // Build HTML content with embedded CSS
    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${systemAnalysis.isTargetedAnalysis ? 'Targeted Threat' : 'System Security'} Analysis Report - ${new Date().toISOString().split('T')[0]}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3, h4 {
            color: #1976d2;
            margin-top: 30px;
        }
        h1 {
            border-bottom: 3px solid #1976d2;
            padding-bottom: 10px;
        }
        h2 {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 8px;
        }
        .metadata {
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
        }
        .risk-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 14px;
            margin-right: 8px;
        }
        .risk-extreme { background-color: #d32f2f; color: white; }
        .risk-high { background-color: #f44336; color: white; }
        .risk-medium { background-color: #ff9800; color: white; }
        .risk-minor { background-color: #ffc107; color: black; }
        .risk-sustainable { background-color: #4caf50; color: white; }
        .component-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            background-color: #fafafa;
        }
        .threat-item, .vuln-item {
            margin-bottom: 15px;
            padding: 10px;
            background-color: white;
            border-radius: 4px;
            border-left: 4px solid #1976d2;
        }
        .mitre-link, .cve-link {
            color: #1976d2;
            text-decoration: none;
            font-weight: 500;
        }
        .mitre-link:hover, .cve-link:hover {
            text-decoration: underline;
        }
        .attack-path {
            background-color: #fff3e0;
            border: 1px solid #ffb74d;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .recommendation {
            background-color: #e8f5e9;
            border: 1px solid #81c784;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .priority-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
        }
        .zone-section {
            margin-bottom: 30px;
        }
        .zone-header {
            background-color: #e3f2fd;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .tech-ref {
            background-color: #f5f5f5;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .tactic-badge {
            display: inline-block;
            background-color: #e1bee7;
            color: #4a148c;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            margin-right: 5px;
        }
        a.tactic-badge:hover {
            background-color: #ce93d8;
            color: #4a148c;
        }
        .summary-box {
            background-color: #f0f7ff;
            border: 1px solid #1976d2;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric-card {
            background-color: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #1976d2;
        }
        .metric-label {
            color: #666;
            font-size: 14px;
        }
        .findings-list {
            list-style-type: none;
            padding-left: 0;
        }
        .findings-list li {
            margin-bottom: 10px;
            padding-left: 25px;
            position: relative;
        }
        .findings-list li::before {
            content: "▸";
            position: absolute;
            left: 0;
            color: #1976d2;
        }
        .targeted-banner {
            background-color: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
        .targeted-banner h3 {
            color: #1976d2;
            margin: 0 0 10px 0;
        }
        .targeted-info {
            margin: 5px 0;
        }
        .targeted-label {
            font-weight: bold;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${systemAnalysis.isTargetedAnalysis ? 'Targeted Threat' : 'System Security'} Analysis Report</h1>
        <div class="metadata">
            Generated: ${new Date().toLocaleString()}<br>
            Analysis Type: ${systemAnalysis.isTargetedAnalysis ? 'Targeted Threat Assessment' : 'Comprehensive Security Assessment'}
        </div>`;
        
    // Add targeted analysis banner if present
    if (systemAnalysis.isTargetedAnalysis && systemAnalysis.targetedAnalysis) {
      htmlContent += `
        <div class="targeted-banner">
            <h3>Targeted Threat Analysis Parameters</h3>
            <div class="targeted-info"><span class="targeted-label">Threat Actors:</span> ${systemAnalysis.targetedAnalysis.threatActors}</div>
            <div class="targeted-info"><span class="targeted-label">TTPs:</span> ${systemAnalysis.targetedAnalysis.ttps}</div>
            <div class="targeted-info"><span class="targeted-label">Known Vulnerabilities:</span> ${systemAnalysis.targetedAnalysis.vulnerabilities}</div>
            <div class="targeted-info"><span class="targeted-label">Focus Areas:</span> ${systemAnalysis.targetedAnalysis.focusAreas}</div>
            ${systemAnalysis.targetedAnalysis.scenarioDescription ? `<div class="targeted-info"><span class="targeted-label">Scenario:</span> ${systemAnalysis.targetedAnalysis.scenarioDescription}</div>` : ''}
            ${systemAnalysis.targetedAnalysis.threatIntelligence ? `
                <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
                <h4 style="margin: 10px 0;">Threat Intelligence</h4>
                ${systemAnalysis.targetedAnalysis.threatIntelligence.rawIntelligence ? `
                    <div class="targeted-info"><span class="targeted-label">Intelligence Reports:</span><br>
                        <div style="margin-left: 20px; margin-top: 5px; white-space: pre-wrap;">${systemAnalysis.targetedAnalysis.threatIntelligence.rawIntelligence}</div>
                    </div>` : ''}
                ${systemAnalysis.targetedAnalysis.threatIntelligence.recentCVEs ? `
                    <div class="targeted-info"><span class="targeted-label">Recent CVEs:</span><br>
                        <div style="margin-left: 20px; margin-top: 5px; white-space: pre-wrap;">${systemAnalysis.targetedAnalysis.threatIntelligence.recentCVEs}</div>
                    </div>` : ''}
                ${systemAnalysis.targetedAnalysis.threatIntelligence.knownIOCs ? `
                    <div class="targeted-info"><span class="targeted-label">Known IOCs:</span><br>
                        <div style="margin-left: 20px; margin-top: 5px; white-space: pre-wrap;">${systemAnalysis.targetedAnalysis.threatIntelligence.knownIOCs}</div>
                    </div>` : ''}
                ${systemAnalysis.targetedAnalysis.threatIntelligence.campaignInfo ? `
                    <div class="targeted-info"><span class="targeted-label">Campaign Information:</span><br>
                        <div style="margin-left: 20px; margin-top: 5px; white-space: pre-wrap;">${systemAnalysis.targetedAnalysis.threatIntelligence.campaignInfo}</div>
                    </div>` : ''}
                ${systemAnalysis.targetedAnalysis.threatIntelligence.intelligenceDate ? `
                    <div class="targeted-info"><span class="targeted-label">Intelligence Date:</span> ${systemAnalysis.targetedAnalysis.threatIntelligence.intelligenceDate}</div>` : ''}
            ` : ''}
        </div>`;
    }
    
    // Summary Section
    htmlContent += `
        <div class="summary-box">
            <h2 style="margin-top: 0;">Analysis Summary</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${componentCount}</div>
                    <div class="metric-label">Components Analyzed</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #f44336;">${threatCount}</div>
                    <div class="metric-label">Threats Identified</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #ff9800;">${vulnerabilityCount}</div>
                    <div class="metric-label">Vulnerabilities</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #9c27b0;">${attackPathCount}</div>
                    <div class="metric-label">Attack Paths</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #673ab7;">${mitreCount}</div>
                    <div class="metric-label">MITRE Techniques</div>
                </div>
            </div>
        </div>`;
    
    // 1. System Overview
    if (systemAnalysis.systemOverview) {
      htmlContent += `<h2>System Overview</h2>`;
      
      if (systemAnalysis.systemOverview.description) {
        htmlContent += `<p>${systemAnalysis.systemOverview.description.replace(/\n/g, '<br>')}</p>`;
      }
      
      // Overall Risk Assessment
      if (systemAnalysis.systemOverview.overallRiskAssessment) {
        const risk = systemAnalysis.systemOverview.overallRiskAssessment;
        htmlContent += `
        <h3>Overall Risk Assessment</h3>
        <div style="padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin-bottom: 20px;">
            <p>
                <span class="risk-badge risk-${risk.risk.toLowerCase()}">${risk.risk}</span>
                <strong>Likelihood:</strong> ${risk.likelihood} | 
                <strong>Impact:</strong> ${risk.impact}
            </p>
            <p>${risk.justification || ''}</p>
        </div>`;
      }
      
      // Key Findings
      if (systemAnalysis.systemOverview.keyFindings?.length > 0) {
        htmlContent += `
        <h3>Key Findings</h3>
        <ul class="findings-list">`;
        systemAnalysis.systemOverview.keyFindings.forEach((finding: string) => {
          htmlContent += `<li>${finding}</li>`;
        });
        htmlContent += `</ul>`;
      }
      
      // Critical Components
      if (systemAnalysis.systemOverview.criticalComponents?.length > 0) {
        htmlContent += `
        <h3>Critical Components</h3>
        <ul class="findings-list">`;
        systemAnalysis.systemOverview.criticalComponents.forEach((comp: string) => {
          htmlContent += `<li><strong>${comp}</strong></li>`;
        });
        htmlContent += `</ul>`;
      }
    }
    
    // 2. Component Analysis
    const analyzedComponents = (systemAnalysis as any).analyzedComponents || [];
    if (analyzedComponents.length > 0 || (systemAnalysis.componentThreats && Object.keys(systemAnalysis.componentThreats).length > 0)) {
      htmlContent += `<h2>Component Security Analysis</h2>`;
      
      // Group components by zone
      const componentsByZone: Record<string, any[]> = {};
      
      // If we have analyzedComponents, use that (includes all analyzed nodes)
      if (analyzedComponents.length > 0) {
        analyzedComponents.forEach((comp: any) => {
          const node = nodes.find(n => n.id === comp.nodeId);
          if (node) {
            const zone = (node.data as any).zone || 'Unzoned';
            const zoneKey = String(zone);
            if (!componentsByZone[zoneKey]) componentsByZone[zoneKey] = [];
            const threats = systemAnalysis.componentThreats?.[comp.nodeId] || [];
            componentsByZone[zoneKey].push({ node, threats });
          }
        });
      } else {
        // Fallback to old method using componentThreats
        Object.entries(systemAnalysis.componentThreats).forEach(([componentId, threats]) => {
          const node = nodes.find(n => n.id === componentId);
          if (node) {
            const zone = (node.data as any).zone || 'Unzoned';
            const zoneKey = String(zone);
            if (!componentsByZone[zoneKey]) componentsByZone[zoneKey] = [];
            componentsByZone[zoneKey].push({ node, threats });
          }
        });
      }
      
      // Process each zone
      Object.entries(componentsByZone).sort().forEach(([zone, components]) => {
        htmlContent += `
          <div class="zone-section">
              <div class="zone-header">${zone} Zone</div>`;
        
        components.forEach(({ node, threats }) => {
          const label = node.data.label;
          htmlContent += `
              <div class="component-card">
                  <h3>${label} <small style="color: #666;">(${node.data.type})</small></h3>`;
          
          // Component properties
          if (node.data.securityLevel || node.data.dataClassification) {
            htmlContent += '<p style="margin: 10px 0; font-size: 14px;">';
            if (node.data.securityLevel) {
              htmlContent += `<strong>Security Level:</strong> ${node.data.securityLevel} `;
            }
            if (node.data.dataClassification) {
              htmlContent += `<strong>Data Classification:</strong> ${node.data.dataClassification}`;
            }
            htmlContent += '</p>';
          }
          
          // Threats
          if (Array.isArray(threats) && threats.length > 0) {
            htmlContent += '<h4>Threats</h4>';
            threats.forEach((threat: any, index: number) => {
              const riskClass = threat.risk ? threat.risk.toLowerCase() : 'medium';
              htmlContent += `
                  <div class="threat-item">
                      <strong>${index + 1}. ${threat.description || threat.threat || 'Unknown threat'}</strong><br>
                      <small>
                          <span class="risk-badge risk-${riskClass}">${threat.risk || 'Unknown'}</span>
                          Likelihood: ${threat.likelihood || 'Unknown'} | 
                          Impact: ${threat.impact || 'Unknown'}`;
              
              if (threat.mitreTechniques?.length > 0) {
                htmlContent += '<br>MITRE: ';
                threat.mitreTechniques.forEach((technique: string, i: number) => {
                  if (i > 0) htmlContent += ', ';
                  htmlContent += `<a href="https://attack.mitre.org/techniques/${technique}/" target="_blank" class="mitre-link" rel="noopener noreferrer">${technique}</a>`;
                });
              }
              
              if (threat.mitigation) {
                htmlContent += `<br><strong>Mitigation:</strong> ${threat.mitigation}`;
              }
              
              htmlContent += `
                      </small>
                  </div>`;
            });
          }
          
          // Vulnerabilities
          const vulns = systemAnalysis.vulnerabilities?.filter((v: any) => 
            v.affectedComponents?.includes(label) || v.affectedNode === label
          );
          if (vulns && vulns.length > 0) {
            htmlContent += '<h4>Vulnerabilities</h4>';
            vulns.forEach((vuln: any, index: number) => {
              htmlContent += `
                  <div class="vuln-item">
                      <strong>${index + 1}. ${vuln.description || vuln.vulnerability || 'Unknown'}</strong><br>
                      <small>`;
              if (vuln.cve && vuln.cve !== 'N/A') {
                htmlContent += `CVE: <a href="https://nvd.nist.gov/vuln/detail/${vuln.cve}" target="_blank" class="cve-link" rel="noopener noreferrer">${vuln.cve}</a>`;
                if (vuln.cvss) {
                  htmlContent += ` | CVSS: ${vuln.cvss}`;
                }
              }
              if (vuln.severity) {
                htmlContent += ` | Severity: <span class="risk-badge risk-${vuln.severity.toLowerCase()}">${vuln.severity}</span>`;
              }
              if (vuln.remediation) {
                htmlContent += `<br><strong>Remediation:</strong> ${vuln.remediation}`;
              }
              htmlContent += `
                      </small>
                  </div>`;
            });
          }
          
          htmlContent += '</div>';
        });
        
        htmlContent += '</div>';
      });
    }
    
    // 3. Attack Paths
    if (systemAnalysis.attackPaths?.length > 0) {
      htmlContent += `
        <h2>Attack Path Analysis</h2>
        <p>Identified attack chains and potential exploitation routes:</p>`;
      
      systemAnalysis.attackPaths.forEach((path: any, index: number) => {
        const riskClass = path.risk ? path.risk.toLowerCase() : 'medium';
        htmlContent += `
            <div class="attack-path">
                <h4>Attack Path ${index + 1}</h4>`;
        
        if (path.path && Array.isArray(path.path)) {
          htmlContent += `<p><strong>Path:</strong> ${path.path.join(' → ')}</p>`;
        }
        
        if (path.description) {
          htmlContent += `<p>${path.description}</p>`;
        }
        
        htmlContent += `
                <p>
                    <span class="risk-badge risk-${riskClass}">${path.risk || 'Unknown'}</span>
                    <strong>Likelihood:</strong> ${path.likelihood || 'Unknown'} | 
                    <strong>Impact:</strong> ${path.impact || 'Unknown'}
                </p>`;
        
        if (path.mitreTechniques?.length > 0) {
          htmlContent += '<p><strong>MITRE Techniques:</strong> ';
          path.mitreTechniques.forEach((technique: string, i: number) => {
            if (i > 0) htmlContent += ', ';
            htmlContent += `<a href="https://attack.mitre.org/techniques/${technique}/" target="_blank" class="mitre-link" rel="noopener noreferrer">${technique}</a>`;
          });
          htmlContent += '</p>';
        }
        
        if (path.mitigation) {
          htmlContent += `<p><strong>Mitigation:</strong> ${path.mitigation}</p>`;
        }
        
        htmlContent += '</div>';
      });
    }
    
    // 4. Recommendations
    if (systemAnalysis.recommendations?.length > 0) {
      htmlContent += `
        <h2>Security Recommendations</h2>`;
      
      const sortedRecs = [...systemAnalysis.recommendations].sort((a: any, b: any) => {
        const priorityOrder = ['EXTREME', 'HIGH', 'MEDIUM', 'MINOR', 'LOW'];
        const aPriority = a.priority || 'LOW';
        const bPriority = b.priority || 'LOW';
        return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
      });
      
      sortedRecs.forEach((rec: any) => {
        const priority = rec.priority || 'MEDIUM';
        const priorityClass = priority.toLowerCase();
        htmlContent += `
          <div class="recommendation">
              <span class="priority-badge risk-${priorityClass}">${priority}</span>
              <strong>${rec.action || rec.recommendation || rec.description || rec}</strong>`;
        
        if (rec.affectedComponents?.length > 0) {
          htmlContent += `<br><small><strong>Affects:</strong> ${rec.affectedComponents.join(', ')}</small>`;
        }
        
        if (rec.rationale) {
          htmlContent += `<br><small><strong>Rationale:</strong> ${rec.rationale}</small>`;
        }
        
        if (rec.effort) {
          htmlContent += `<br><small><strong>Effort:</strong> ${rec.effort}</small>`;
        }
        
        if (rec.impact) {
          htmlContent += `<br><small><strong>Expected Impact:</strong> ${rec.impact}</small>`;
        }
        
        htmlContent += '</div>';
      });
    }
    
    // MITRE Techniques Reference
    if (systemAnalysis.ttpSummary && Object.keys(systemAnalysis.ttpSummary).length > 0) {
      htmlContent += `
        <h2>MITRE ATT&CK Technique Reference</h2>
        <p>Detailed information about techniques identified in this analysis:</p>`;
      
      Object.entries(systemAnalysis.ttpSummary)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([techniqueId, details]: [string, any]) => {
          htmlContent += `
            <div class="tech-ref">
                <h4><a href="https://attack.mitre.org/techniques/${techniqueId}/" target="_blank" class="mitre-link">${techniqueId}</a>: ${details.name}</h4>
                <p>${details.description}</p>`;
          
          if (details.tactics?.length > 0) {
            // Mapping of tactic names to IDs for MITRE ATT&CK links
            const tacticMapping: Record<string, string> = {
              'Reconnaissance': 'TA0043',
              'Resource Development': 'TA0042',
              'Initial Access': 'TA0001',
              'Execution': 'TA0002',
              'Persistence': 'TA0003',
              'Privilege Escalation': 'TA0004',
              'Defense Evasion': 'TA0005',
              'Credential Access': 'TA0006',
              'Discovery': 'TA0007',
              'Lateral Movement': 'TA0008',
              'Collection': 'TA0009',
              'Command and Control': 'TA0011',
              'Exfiltration': 'TA0010',
              'Impact': 'TA0040',
              // ICS-specific tactics
              'Evasion': 'TA0103',
              'Impair Process Control': 'TA0106',
              'Inhibit Response Function': 'TA0107'
            };
            
            htmlContent += '<p><strong>Tactics:</strong> ';
            details.tactics.forEach((tactic: string, i: number) => {
              if (i > 0) htmlContent += ' ';
              const tacticId = tacticMapping[tactic];
              if (tacticId) {
                htmlContent += `<a href="https://attack.mitre.org/tactics/${tacticId}/" target="_blank" class="tactic-badge" style="text-decoration: none;">${tactic}</a>`;
              } else {
                htmlContent += `<span class="tactic-badge">${tactic}</span>`;
              }
            });
            htmlContent += '</p>';
          }
          
          htmlContent += '</div>';
        });
    }
    
    // 6. Standalone Vulnerabilities (not associated with specific components)
    const standaloneVulns = systemAnalysis.vulnerabilities?.filter((v: any) => 
      !v.affectedComponents || v.affectedComponents.length === 0
    );
    if (standaloneVulns && standaloneVulns.length > 0) {
      htmlContent += `
        <h2>Identified Vulnerabilities</h2>
        <p>Additional vulnerabilities discovered during analysis:</p>`;
      
      standaloneVulns.forEach((vuln: any, index: number) => {
        htmlContent += `
          <div class="vuln-item" style="margin-bottom: 15px;">
              <strong>${index + 1}. ${vuln.vulnerability || vuln.description || 'Unknown vulnerability'}</strong><br>
              <small>`;
        
        if (vuln.severity) {
          htmlContent += `Severity: <span class="risk-badge risk-${vuln.severity.toLowerCase()}">${vuln.severity}</span> `;
        }
        
        if (vuln.cve && vuln.cve !== 'N/A') {
          htmlContent += `| CVE: <a href="https://nvd.nist.gov/vuln/detail/${vuln.cve}" target="_blank" class="cve-link" rel="noopener noreferrer">${vuln.cve}</a> `;
          if (vuln.cvss) {
            htmlContent += `| CVSS: ${vuln.cvss} `;
          }
        }
        
        if (vuln.remediation) {
          htmlContent += `<br><strong>Remediation:</strong> ${vuln.remediation}`;
        }
        
        htmlContent += `
              </small>
          </div>`;
      });
    }
    
    htmlContent += `
    </div>
</body>
</html>`;
    
    // Create and download the file
    await downloadHtmlFile(htmlContent, 'system-security-analysis');
  };


  // Word export removed for now

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StyledCard sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Fixed Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Security sx={{ mr: 1, color: theme.colors.primary }} />
          <Typography variant="h6">Threat Analysis</Typography>
        </Box>

        {/* Scrollable Content */}
        <Box sx={{ 
          flex: 1, 
          minHeight: 0,
          overflowY: 'auto', 
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pr: 1, // Add padding for scrollbar
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.colors.border,
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: theme.colors.primary,
          },
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Tooltip 
            title="Analyze only the components you've selected in the diagram for focused threat assessment"
            enterDelay={500}
            leaveDelay={0}
            disableInteractive
          >
            <span>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={isAnalyzing ? <Stop /> : <Assessment />}
                onClick={isAnalyzing ? cancelAnalysis : analyzeSelectedNodes}
                disabled={selectedNodes.length === 0 || isAnalyzing}
              >
                {isAnalyzing ? 'Stop Analysis' : `Analyze Selected (${selectedNodes.length})`}
              </Button>
            </span>
          </Tooltip>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip 
              title="Select all components in the diagram (excluding security zones)"
              enterDelay={500}
              leaveDelay={0}
              disableInteractive
            >
              <span style={{ flex: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<SelectAll />}
                  onClick={selectAllNodes}
                  disabled={nodes.filter(n => n.type !== 'securityZone').length === 0}
                >
                  Select All
                </Button>
              </span>
            </Tooltip>
            <Tooltip 
              title="Deselect all components"
              enterDelay={500}
              leaveDelay={0}
              disableInteractive
            >
              <span style={{ flex: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<DeselectOutlined />}
                  onClick={deselectAllNodes}
                  disabled={selectedNodes.length === 0}
                >
                  Deselect All
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Targeted Threat Analysis Section */}
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={targetedModeEnabled}
                  onChange={(e) => setTargetedModeEnabled(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GpsFixed sx={{ fontSize: 18 }} />
                  <Typography variant="body2">Targeted Threat Analysis</Typography>
                </Box>
              }
            />
            
            {targetedModeEnabled && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Save />}
                  onClick={saveThreatScenario}
                  disabled={!targetedThreatAnalysis.threatActors && !targetedThreatAnalysis.ttps && !targetedThreatAnalysis.vulnerabilities}
                >
                  Save Scenario
                </Button>
                
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Upload />}
                  onClick={loadThreatScenario}
                >
                  Load Scenario
                </Button>
              </Box>
            )}

            {targetedModeEnabled && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <ExampleScenariosDropdown
                  onScenarioSelect={(scenario) => {
                    // Load the scenario data
                    setTargetedThreatAnalysis({
                      threatActors: scenario.targetedAnalysis.threatActors || '',
                      ttps: scenario.targetedAnalysis.ttps || '',
                      vulnerabilities: scenario.targetedAnalysis.vulnerabilities || '',
                      focusAreas: scenario.targetedAnalysis.focusAreas || '',
                      scenarioDescription: scenario.targetedAnalysis.scenarioDescription || '',
                      threatIntelligence: scenario.targetedAnalysis.threatIntelligence
                    });
                    
                    // Log the loaded scenario
                    console.log('[ThreatAnalysisPanel] Loaded example scenario:', scenario.name);
                  }}
                />
              </Box>
            )}
          </Box>
          
          <Collapse in={targetedModeEnabled} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 3 }}>
              {/* Main Threat Parameters */}
              <Paper elevation={0} sx={{ p: 3, backgroundColor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'primary.main' }}>
                  Threat Analysis Parameters
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <TextField
                      fullWidth
                      label="Threat Actors"
                      value={targetedThreatAnalysis.threatActors}
                      onChange={(e) => setTargetedThreatAnalysis(prev => ({ ...prev, threatActors: e.target.value }))}
                      variant="outlined"
                      helperText="Specify known threat actors or groups (e.g., Scattered Spider, APT29, Ransomware Groups)"
                      FormHelperTextProps={{ sx: { mt: 0.5 } }}
                    />
                  </Box>
                  
                  <Box>
                    <TextField
                      fullWidth
                      label="TTPs (Tactics, Techniques, and Procedures)"
                      value={targetedThreatAnalysis.ttps}
                      onChange={(e) => setTargetedThreatAnalysis(prev => ({ ...prev, ttps: e.target.value }))}
                      variant="outlined"
                      multiline
                      rows={3}
                      helperText="MITRE ATT&CK techniques (e.g., T1078 Valid Accounts, T1190 Exploit Public-Facing Application)"
                      FormHelperTextProps={{ sx: { mt: 0.5 } }}
                    />
                  </Box>
                  
                  <Box>
                    <TextField
                      fullWidth
                      label="Known Vulnerabilities"
                      value={targetedThreatAnalysis.vulnerabilities}
                      onChange={(e) => setTargetedThreatAnalysis(prev => ({ ...prev, vulnerabilities: e.target.value }))}
                      variant="outlined"
                      multiline
                      rows={3}
                      helperText="Specific vulnerabilities or CVEs to focus on (e.g., Log4j, ProxyLogon, CVE-2024-12345)"
                      FormHelperTextProps={{ sx: { mt: 0.5 } }}
                    />
                  </Box>
                  
                  <Box>
                    <TextField
                      fullWidth
                      label="Focus Areas"
                      value={targetedThreatAnalysis.focusAreas}
                      onChange={(e) => setTargetedThreatAnalysis(prev => ({ ...prev, focusAreas: e.target.value }))}
                      variant="outlined"
                      helperText="System components to prioritize (e.g., Identity systems, Cloud infrastructure, API endpoints)"
                      FormHelperTextProps={{ sx: { mt: 0.5 } }}
                    />
                  </Box>
                  
                  <Box>
                    <TextField
                      fullWidth
                      label="Scenario Description"
                      value={targetedThreatAnalysis.scenarioDescription}
                      onChange={(e) => setTargetedThreatAnalysis(prev => ({ ...prev, scenarioDescription: e.target.value }))}
                      variant="outlined"
                      multiline
                      rows={3}
                      helperText="Optional: Describe the specific threat scenario or assessment goals"
                      FormHelperTextProps={{ sx: { mt: 0.5 } }}
                    />
                  </Box>
                </Box>
              </Paper>
              
              {/* Threat Intelligence Section */}
              {targetedModeEnabled && (
              <Accordion sx={{ mt: 3, backgroundColor: 'background.paper', '&:before': { display: 'none' } }}>
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    backgroundColor: 'background.default',
                    '&.Mui-expanded': {
                      minHeight: 48,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      Threat Intelligence
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (Optional)
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Import and manage threat intelligence data to enhance your security analysis with real-world threat information.
                    </Typography>

                    {/* View/Edit Intel Button */}
                    {onOpenThreatIntelPanel && (
                      <Button
                        variant="contained"
                        startIcon={<OpenInNewIcon />}
                        onClick={onOpenThreatIntelPanel}
                        fullWidth
                        sx={{ mt: 1 }}
                      >
                        Open Threat Intelligence Panel
                      </Button>
                    )}

                    {/* Show current status if threat intel is loaded */}
                    {(targetedThreatAnalysis.threatIntelligence || analysisState.importedThreatIntel) && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.selected', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Threat intelligence loaded
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
              )}
            </Box>
          </Collapse>
        </Box>

        {/* Web Search Configuration (Anthropic Only) */}
        {settings.api.provider === 'anthropic' && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.threatAnalysis.webSearch?.enabled || false}
                    onChange={(e) => {
                      updateSettings({
                        threatAnalysis: {
                          ...settings.threatAnalysis,
                          webSearch: {
                            enabled: e.target.checked,
                            maxSearchesPerComponent: settings.threatAnalysis.webSearch?.maxSearchesPerComponent || 3,
                            maxSearchesPerAnalysis: settings.threatAnalysis.webSearch?.maxSearchesPerAnalysis || 10,
                            domainCategories: settings.threatAnalysis.webSearch?.domainCategories || ['vulnerabilityDatabases', 'threatIntelligence']
                          }
                        }
                      });
                    }}
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SearchIcon sx={{ fontSize: 18 }} />
                    <Typography variant="body2">Enable Web Search</Typography>
                    <Chip 
                      label="Pro" 
                      size="small" 
                      color="primary" 
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                }
              />
              
              {settings.threatAnalysis.webSearch?.enabled && (
                <Box sx={{ ml: 4, mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Web search enhances threat analysis by fetching real-time vulnerability data and threat intelligence from trusted CTI sources.
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Search Domain Categories:
                    </Typography>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.threatAnalysis.webSearch?.domainCategories?.includes('vulnerabilityDatabases') || false}
                            onChange={(e) => {
                              const currentCategories = settings.threatAnalysis.webSearch?.domainCategories || [];
                              const newCategories = e.target.checked
                                ? [...currentCategories, 'vulnerabilityDatabases']
                                : currentCategories.filter(c => c !== 'vulnerabilityDatabases');
                              
                              updateSettings({
                                threatAnalysis: {
                                  ...settings.threatAnalysis,
                                  webSearch: {
                                    enabled: settings.threatAnalysis.webSearch?.enabled || false,
                                    maxSearchesPerComponent: settings.threatAnalysis.webSearch?.maxSearchesPerComponent || 3,
                                    maxSearchesPerAnalysis: settings.threatAnalysis.webSearch?.maxSearchesPerAnalysis || 10,
                                    domainCategories: newCategories
                                  }
                                }
                              });
                            }}
                          />
                        }
                        label={
                          <Typography variant="caption">
                            Vulnerability Databases (NVD, CVE, CWE)
                          </Typography>
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.threatAnalysis.webSearch?.domainCategories?.includes('threatIntelligence') || false}
                            onChange={(e) => {
                              const currentCategories = settings.threatAnalysis.webSearch?.domainCategories || [];
                              const newCategories = e.target.checked
                                ? [...currentCategories, 'threatIntelligence']
                                : currentCategories.filter(c => c !== 'threatIntelligence');
                              
                              updateSettings({
                                threatAnalysis: {
                                  ...settings.threatAnalysis,
                                  webSearch: {
                                    enabled: settings.threatAnalysis.webSearch?.enabled || false,
                                    maxSearchesPerComponent: settings.threatAnalysis.webSearch?.maxSearchesPerComponent || 3,
                                    maxSearchesPerAnalysis: settings.threatAnalysis.webSearch?.maxSearchesPerAnalysis || 10,
                                    domainCategories: newCategories
                                  }
                                }
                              });
                            }}
                          />
                        }
                        label={
                          <Typography variant="caption">
                            Threat Intelligence (MITRE ATT&CK, AlienVault OTX)
                          </Typography>
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.threatAnalysis.webSearch?.domainCategories?.includes('securityVendors') || false}
                            onChange={(e) => {
                              const currentCategories = settings.threatAnalysis.webSearch?.domainCategories || [];
                              const newCategories = e.target.checked
                                ? [...currentCategories, 'securityVendors']
                                : currentCategories.filter(c => c !== 'securityVendors');
                              
                              updateSettings({
                                threatAnalysis: {
                                  ...settings.threatAnalysis,
                                  webSearch: {
                                    enabled: settings.threatAnalysis.webSearch?.enabled || false,
                                    maxSearchesPerComponent: settings.threatAnalysis.webSearch?.maxSearchesPerComponent || 3,
                                    maxSearchesPerAnalysis: settings.threatAnalysis.webSearch?.maxSearchesPerAnalysis || 10,
                                    domainCategories: newCategories
                                  }
                                }
                              });
                            }}
                          />
                        }
                        label={
                          <Typography variant="caption">
                            Security Vendor Advisories
                          </Typography>
                        }
                      />
                    </FormGroup>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                      Note: Each search costs tokens ($10 per 1,000 searches)
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {nodes.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            Add components to your diagram to enable threat analysis
          </Typography>
        )}
        
        {selectedNodes.length === 0 && nodes.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            Select nodes on the diagram to analyze specific components
          </Typography>
        )}
        
        {selectedNodes.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            Selected analysis will include {selectedNodes.length} nodes and their connected edges
          </Typography>
        )}
        </Box> {/* End scrollable content */}
      </StyledCard>

      {systemAnalysis && (
        <StyledCard>
          <Typography variant="subtitle2" gutterBottom>
            Latest Analysis Results
          </Typography>
          {(() => {
            const threatCount = Object.values(systemAnalysis.componentThreats || {}).reduce((sum, arr)=> sum + arr.length, 0);
            const vulnCount = systemAnalysis.vulnerabilities?.length || 0;
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning sx={{ fontSize: 16, color: theme.colors.error }} />
                    <Typography variant="body2">Threats Found</Typography>
                  </Box>
                  <Badge badgeContent={threatCount} color="error" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BugReport sx={{ fontSize: 16, color: theme.colors.warning }} />
                    <Typography variant="body2">Vulnerabilities</Typography>
                  </Box>
                  <Badge badgeContent={vulnCount} color="warning" />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Analyzed at {systemAnalysis.timestamp.toLocaleTimeString()}
                </Typography>
              </Box>
            );
          })()}
        </StyledCard>
      )}

      {/* System Analysis Button - Show when we have system-wide analysis data */}
      {systemAnalysis && (
        <StyledCard>
          <Button
            fullWidth
            variant="outlined"
            color="info"
            startIcon={<Description />}
            onClick={() => setShowSystemAnalysisDialog(true)}
          >
            View System Analysis Report
          </Button>
        </StyledCard>
      )}

      {/* Progress Dialog */}
      <Dialog
        open={showProgressDialog}
        onClose={() => !isAnalyzing && setShowProgressDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Analyzing Diagram</Typography>
            {!isAnalyzing && (
              <IconButton onClick={() => setShowProgressDialog(false)} size="small">
                <Close />
              </IconButton>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={(progress.completed / progress.total) * 100}
              sx={{ mb: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary">
              {progress.completed} of {progress.total} items analyzed
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {progress.currentNode ? `Analyzing: ${progress.currentNode}` : progress.current}
            </Typography>
          </Box>

          {progress.errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                {progress.errors.length} error(s) occurred:
              </Typography>
              <List dense>
                {progress.errors.map((error, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ErrorIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText primary={error} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {progress.status === 'done' && progress.errors.length === 0 && (
            <Alert severity="success">
              <Typography variant="body2">
                Analysis completed successfully!
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {isAnalyzing ? (
            <Button onClick={cancelAnalysis} color="error">
              Cancel Analysis
            </Button>
          ) : (
            <Button onClick={() => setShowProgressDialog(false)}>
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* System Analysis Dialog */}
      <Dialog
        open={showSystemAnalysisDialog}
        onClose={() => setShowSystemAnalysisDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isPhoneViewport}
        PaperProps={{
          sx: {
            borderRadius: isPhoneViewport ? 0 : '12px',
            maxHeight: isPhoneViewport ? '100dvh' : '90dvh',
            border: (t: any) => t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : 'none',
          }
        }}
      >
        <DialogTitle sx={{ px: isPhoneViewport ? 2 : 3, py: isPhoneViewport ? 1.5 : 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: isPhoneViewport ? 'wrap' : 'nowrap' }}>
            <Typography variant={isPhoneViewport ? 'subtitle1' : 'h6'} sx={{ fontWeight: 600 }}>
              System Security Analysis Report
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
              {/* PDF Export temporarily disabled
              <Tooltip title="Export to PDF"><IconButton onClick={handleExportPdf}><PictureAsPdfIcon /></IconButton></Tooltip>
              */}
              <Tooltip title="Export to Text"><IconButton onClick={handleExportText}><DescriptionIcon /></IconButton></Tooltip>
              <Tooltip title="Export to HTML"><IconButton onClick={handleExportHtml}><LanguageIcon /></IconButton></Tooltip>
              <IconButton onClick={() => setShowSystemAnalysisDialog(false)} size="small"><Close /></IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent
          dividers
          ref={reportContentRef}
          sx={{
            px: isPhoneViewport ? 1.5 : 3,
            py: isPhoneViewport ? 2 : 3,
            overflowX: 'hidden',
          }}
        >
          {systemAnalysis && (
            <SystemAnalysisReport
              systemAnalysis={{
                ...systemAnalysis,
                overallRiskAssessment: systemAnalysis.systemOverview?.overallRiskAssessment
              }}
              onComponentClick={handleComponentClick}
              nodes={nodes}
              edges={edges}
              expandAll={isExporting}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: isPhoneViewport ? 2 : 3, py: isPhoneViewport ? 1.5 : 2 }}>
          <Button onClick={() => setShowSystemAnalysisDialog(false)} sx={{ width: isPhoneViewport ? '100%' : 'auto' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cost Dialog */}
      <AnalysisCostDialog
        open={costDialog.open}
        onClose={() => setCostDialog(c => ({ ...c, open: false }))}
        tokens={costDialog.tokens}
        passes={costDialog.passes}
        onContinue={costDialog.onContinue}
        onCancel={costDialog.onCancel}
        analysisType={costDialog.analysisType}
        componentCount={costDialog.componentCount}
        provider={costDialog.provider}
        model={costDialog.model}
        estimatedTime={costDialog.estimatedTime}
        isAnalyzing={costDialog.isAnalyzing}
        progress={costDialog.progress}
        isTargetedAnalysis={costDialog.isTargetedAnalysis}
        targetedThreatActor={costDialog.targetedThreatActor}
      />
      
      {(() => {
        // Calculate analysis metrics for ExportOnlyReportDialog
        const componentCount = nodes.filter(n => n.type !== 'securityZone').length;
        const threatCount = systemAnalysis?.componentThreats 
          ? Object.values(systemAnalysis.componentThreats).flat().length 
          : 0;
        const vulnerabilityCount = systemAnalysis?.vulnerabilities?.length || 0;
        const attackPathCount = systemAnalysis?.attackPaths?.length || 0;
        const reportSize = JSON.stringify(systemAnalysis || {}).length;
        
        const analysisMetrics = {
          componentCount,
          threatCount,
          vulnerabilityCount,
          attackPathCount,
          reportSize,
          estimatedRenderTime: componentCount * 50 // 50ms per component estimate
        };

        return (
          /* Export Only Report Dialog */
          <ExportOnlyReportDialog
            open={exportOnlyMode}
            onClose={() => setExportOnlyMode(false)}
            systemAnalysis={systemAnalysis}
            onExportPdf={handleExportPdf}
            onExportText={handleExportText}
            onExportHtml={handleExportHtml}
            isExporting={isExporting}
            exportProgress={exportProgress}
            metrics={analysisMetrics}
          />
        );
      })()}
      
      {/* Snackbar for feedback messages */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
});

ThreatAnalysisPanel.displayName = 'ThreatAnalysisPanel';

export default ThreatAnalysisPanel;
