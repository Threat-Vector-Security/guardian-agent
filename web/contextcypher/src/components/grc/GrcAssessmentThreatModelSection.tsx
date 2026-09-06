import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Trash2 } from 'lucide-react';
import {
  AppModuleMode,
  AssessmentAttackPath,
  AssessmentThreatModelEdge,
  AssessmentThreatModelNode,
  AssessmentThreatModelPosition,
  DiagramAttackPath,
  DiagramContextSnapshot,
  DiagramNodeSummary,
  GrcAssessment,
  GrcAssessmentThreatModel,
  GrcWorkspace
} from '../../types/GrcTypes';
import { STRIDE_COLORS, STRIDE_SHORT, RISK_LEVEL_COLORS } from '../../utils/attackPathUtils';
import { materialIconMappings } from '../../utils/materialIconMappings';
import { createId, StatusMessage } from './grcShared';

interface GrcAssessmentThreatModelSectionProps {
  assessment: GrcAssessment;
  workspace: GrcWorkspace;
  diagramSnapshot?: DiagramContextSnapshot | null;
  onChange: (model: GrcAssessmentThreatModel) => void;
  onSwitchModule?: (mode: AppModuleMode) => void;
  setStatusMessage: (msg: StatusMessage | null) => void;
}

interface NodeRenderInfo {
  label: string;
  nodeType: string;
  iconName: string;
  zone: string;
  diagramNodeId?: string;
  diagramId?: string;
}

const getEmptyThreatModel = (): GrcAssessmentThreatModel => ({
  nodes: [],
  edges: [],
  updatedAt: new Date().toISOString()
});

const resolveIconName = (nodeType: string | undefined): string =>
  nodeType && materialIconMappings[nodeType] ? nodeType : 'generic';

const parsePathOrder = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const order = Math.floor(value);
  return order > 0 ? order : undefined;
};

const getNextPosition = (count: number): AssessmentThreatModelPosition => ({
  x: 36 + ((count % 4) * 220),
  y: 36 + (Math.floor(count / 4) * 170)
});

const autoOrderThreatModelEdges = (edges: AssessmentThreatModelEdge[]): AssessmentThreatModelEdge[] => {
  const pathEdges = edges.filter(e => parsePathOrder(e.pathOrder) !== undefined);
  if (pathEdges.length === 0) return edges;

  const adjacency = new Map<string, AssessmentThreatModelEdge[]>();
  const incomingNodes = new Set<string>();
  const sourceNodes = new Set<string>();

  pathEdges.forEach(edge => {
    const list = adjacency.get(edge.source) || [];
    list.push(edge);
    adjacency.set(edge.source, list);
    incomingNodes.add(edge.target);
    sourceNodes.add(edge.source);
  });

  const entryPoints = Array.from(sourceNodes).filter(id => !incomingNodes.has(id));
  if (entryPoints.length === 0 && pathEdges.length > 0) {
    entryPoints.push(pathEdges[0].source);
  }

  const ordered: AssessmentThreatModelEdge[] = [];
  const visited = new Set<string>();

  const walk = (nodeId: string) => {
    (adjacency.get(nodeId) || []).forEach(edge => {
      if (visited.has(edge.id)) return;
      visited.add(edge.id);
      ordered.push(edge);
      walk(edge.target);
    });
  };

  entryPoints.forEach(ep => walk(ep));
  pathEdges.forEach(edge => {
    if (!visited.has(edge.id)) ordered.push(edge);
  });

  const orderMap = new Map<string, number>();
  ordered.forEach((edge, idx) => orderMap.set(edge.id, idx + 1));

  return edges.map(edge => ({
    ...edge,
    pathOrder: orderMap.get(edge.id) || edge.pathOrder
  }));
};

const AttackPathFlowDiagram: React.FC<{
  path: AssessmentAttackPath;
  nodeInfoMap: Map<string, NodeRenderInfo>;
  edgeMap: Map<string, AssessmentThreatModelEdge>;
  onFocusNode: (diagramNodeId?: string, diagramId?: string) => void;
  onFocusEdge: (diagramEdgeId?: string, diagramId?: string) => void;
}> = ({ path, nodeInfoMap, edgeMap, onFocusNode, onFocusEdge }) => {
  const sortedSteps = useMemo(
    () => [...path.steps].sort((a, b) => a.order - b.order),
    [path.steps]
  );

  const nodeSequence = useMemo(() => {
    const seen = new Set<string>();
    const seq: string[] = [];
    for (const step of sortedSteps) {
      if (!seen.has(step.sourceNodeId)) {
        seen.add(step.sourceNodeId);
        seq.push(step.sourceNodeId);
      }
      if (!seen.has(step.targetNodeId)) {
        seen.add(step.targetNodeId);
        seq.push(step.targetNodeId);
      }
    }
    return seq;
  }, [sortedSteps]);

  const stepBetween = useMemo(() => {
    const map = new Map<string, (typeof sortedSteps)[0]>();
    for (const step of sortedSteps) {
      map.set(`${step.sourceNodeId}->${step.targetNodeId}`, step);
    }
    return map;
  }, [sortedSteps]);

  const strideColor = STRIDE_COLORS[path.strideCategory];

  if (nodeSequence.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No nodes in this attack path.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 0.75, py: 1, px: 0.5 }}>
      {nodeSequence.map((nodeId, idx) => {
        const info = nodeInfoMap.get(nodeId);
        const label = info?.label || nodeId;
        const nodeType = info?.nodeType || 'generic';
        const iconKey = info?.iconName || resolveIconName(nodeType);
        const zone = info?.zone || '';
        const IconComponent = materialIconMappings[iconKey]?.icon;

        const incomingStep = sortedSteps.find(s => s.targetNodeId === nodeId);
        const technique = incomingStep?.technique;

        const nextNodeId = idx < nodeSequence.length - 1 ? nodeSequence[idx + 1] : null;
        const connectingStep = nextNodeId ? stepBetween.get(`${nodeId}->${nextNodeId}`) : null;
        const connectingEdge = connectingStep ? edgeMap.get(connectingStep.edgeId) : null;

        return (
          <React.Fragment key={nodeId}>
            <Tooltip title={info?.diagramNodeId ? `Click to navigate to ${label} in diagram` : label} arrow>
              <Box
                onClick={() => { if (info?.diagramNodeId) onFocusNode(info.diagramNodeId, info.diagramId); }}
                sx={{
                  minWidth: 100,
                  maxWidth: 140,
                  textAlign: 'center',
                  position: 'relative',
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  cursor: info?.diagramNodeId ? 'pointer' : 'default',
                  '&:hover': info?.diagramNodeId ? { borderColor: strideColor, bgcolor: 'action.hover' } : {}
                }}
              >
                <Box sx={{
                  position: 'absolute',
                  top: -8,
                  left: -8,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: strideColor,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1
                }}>
                  {idx + 1}
                </Box>
                {IconComponent && (
                  <IconComponent sx={{ fontSize: 20, color: 'text.secondary', display: 'block', mx: 'auto', mb: 0.25 }} />
                )}
                <Typography variant="body2" sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3
                }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2, fontSize: '0.65rem' }}>
                  {materialIconMappings[iconKey]?.name || nodeType}
                </Typography>
                {zone && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'info.main', fontSize: '0.6rem', lineHeight: 1.2 }} display="block">
                    {zone}
                  </Typography>
                )}
                {technique && (
                  <Typography variant="caption" sx={{ fontStyle: 'italic', fontSize: '0.6rem', lineHeight: 1.2 }} display="block">
                    {technique}
                  </Typography>
                )}
              </Box>
            </Tooltip>

            {nextNodeId && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                alignSelf: 'center',
                minHeight: 32
              }}>
                <Tooltip title={connectingEdge?.label || `Step ${connectingStep?.order || ''}`} arrow>
                  <ArrowForwardIcon
                    sx={{
                      fontSize: 20,
                      color: strideColor,
                      cursor: connectingEdge?.diagramEdgeId ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (connectingEdge?.diagramEdgeId) {
                        onFocusEdge(connectingEdge.diagramEdgeId, connectingEdge.diagramId);
                      }
                    }}
                  />
                </Tooltip>
                {connectingEdge?.label && (
                  <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary', maxWidth: 60, textAlign: 'center', lineHeight: 1.1 }}>
                    {connectingEdge.label}
                  </Typography>
                )}
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

const GrcAssessmentThreatModelSection: React.FC<GrcAssessmentThreatModelSectionProps> = ({
  assessment,
  workspace,
  diagramSnapshot,
  onChange,
  onSwitchModule,
  setStatusMessage
}) => {
  const [tmNodes, setTmNodes] = useState<AssessmentThreatModelNode[]>([]);
  const [tmEdges, setTmEdges] = useState<AssessmentThreatModelEdge[]>([]);
  const [attackPathDescription, setAttackPathDescription] = useState('');
  const [namedAttackPaths, setNamedAttackPaths] = useState<AssessmentAttackPath[]>([]);

  const isHydratingRef = useRef(false);

  const threatModel = assessment.threatModel || getEmptyThreatModel();

  const nodeByDiagramId = useMemo(() => {
    const map = new Map<string, DiagramNodeSummary>();
    (diagramSnapshot?.nodes || []).forEach(node => map.set(node.id, node));
    return map;
  }, [diagramSnapshot?.nodes]);

  const nodeInfoMap = useMemo(() => {
    const map = new Map<string, NodeRenderInfo>();
    tmNodes.forEach(node => {
      const diagramNode = node.diagramNodeId ? nodeByDiagramId.get(node.diagramNodeId) : undefined;
      map.set(node.id, {
        label: node.label,
        nodeType: node.nodeType || 'generic',
        iconName: node.iconName || resolveIconName(node.nodeType),
        zone: diagramNode?.zone || '',
        diagramNodeId: node.diagramNodeId,
        diagramId: node.diagramId
      });
    });
    return map;
  }, [tmNodes, nodeByDiagramId]);

  const edgeInfoMap = useMemo(() => {
    const map = new Map<string, AssessmentThreatModelEdge>();
    tmEdges.forEach(edge => map.set(edge.id, edge));
    return map;
  }, [tmEdges]);

  const persistThreatModel = useCallback((
    nextNodes: AssessmentThreatModelNode[],
    nextEdges: AssessmentThreatModelEdge[],
    desc?: string,
    paths?: AssessmentAttackPath[]
  ) => {
    onChange({
      nodes: nextNodes,
      edges: autoOrderThreatModelEdges(nextEdges),
      attackPathDescription: desc?.trim() || undefined,
      attackPaths: paths && paths.length > 0 ? paths : undefined,
      updatedAt: new Date().toISOString()
    });
  }, [onChange]);

  useEffect(() => {
    isHydratingRef.current = true;
    setTmNodes(threatModel.nodes);
    setTmEdges(threatModel.edges);
    setAttackPathDescription(threatModel.attackPathDescription || '');
    setNamedAttackPaths(threatModel.attackPaths || []);

    const timer = window.setTimeout(() => {
      isHydratingRef.current = false;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [assessment.id]);

  useEffect(() => {
    if (isHydratingRef.current) return;

    const timer = window.setTimeout(() => {
      persistThreatModel(tmNodes, tmEdges, attackPathDescription, namedAttackPaths);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [tmNodes, tmEdges, attackPathDescription, namedAttackPaths, persistThreatModel]);

  const focusDiagramNode = useCallback((diagramNodeId?: string, diagramId?: string) => {
    if (!diagramNodeId) {
      setStatusMessage({ severity: 'info', text: 'This element is not linked to a diagram node.' });
      return;
    }
    onSwitchModule?.('diagram');
    window.dispatchEvent(new CustomEvent('grc-focus-diagram-node', {
      detail: { nodeId: diagramNodeId, diagramId, force2D: true }
    }));
  }, [onSwitchModule, setStatusMessage]);

  const focusDiagramEdge = useCallback((diagramEdgeId?: string, diagramId?: string) => {
    if (!diagramEdgeId) {
      setStatusMessage({ severity: 'info', text: 'This element is not linked to a diagram edge.' });
      return;
    }
    onSwitchModule?.('diagram');
    window.dispatchEvent(new CustomEvent('grc-focus-diagram-edge', {
      detail: { edgeId: diagramEdgeId, diagramId, force2D: true }
    }));
  }, [onSwitchModule, setStatusMessage]);

  const ensureThreatModelNode = useCallback((
    diagramNodeId: string,
    currentNodes: AssessmentThreatModelNode[]
  ): { nodeId: string | null; updatedNodes: AssessmentThreatModelNode[]; created: boolean } => {
    const existing = currentNodes.find(node => node.diagramNodeId === diagramNodeId);
    if (existing) {
      return { nodeId: existing.id, updatedNodes: currentNodes, created: false };
    }

    const diagramNode = nodeByDiagramId.get(diagramNodeId);
    if (!diagramNode) {
      return { nodeId: null, updatedNodes: currentNodes, created: false };
    }

    const nodeType = resolveIconName(diagramNode.type || 'generic');
    const newNode: AssessmentThreatModelNode = {
      id: createId('attack-node'),
      label: diagramNode.label || diagramNodeId,
      sourceType: 'diagram_node',
      position: getNextPosition(currentNodes.length),
      nodeType,
      iconName: resolveIconName(nodeType),
      diagramId: diagramSnapshot?.diagramId,
      diagramNodeId
    };

    return { nodeId: newNode.id, updatedNodes: [...currentNodes, newNode], created: true };
  }, [diagramSnapshot?.diagramId, nodeByDiagramId]);

  const importDiagramAttackPath = useCallback((diagramPath: DiagramAttackPath) => {
    const snapshotEdges = diagramSnapshot?.edges || [];
    let nextNodes = [...tmNodes];
    let nextEdges = [...tmEdges];
    const assessmentSteps: AssessmentAttackPath['steps'] = [];

    for (const step of diagramPath.steps) {
      const srcResult = ensureThreatModelNode(step.sourceNodeId, nextNodes);
      nextNodes = srcResult.updatedNodes;

      const tgtResult = ensureThreatModelNode(step.targetNodeId, nextNodes);
      nextNodes = tgtResult.updatedNodes;

      if (!srcResult.nodeId || !tgtResult.nodeId) continue;

      let existingEdge = nextEdges.find(e => e.diagramEdgeId === step.edgeId);
      if (!existingEdge) {
        const snapshotEdge = snapshotEdges.find(e => e.id === step.edgeId);
        const newEdge: AssessmentThreatModelEdge = {
          id: createId('attack-edge'),
          source: srcResult.nodeId,
          target: tgtResult.nodeId,
          sourceType: 'diagram_edge',
          label: snapshotEdge?.label?.trim() || undefined,
          diagramId: diagramSnapshot?.diagramId,
          diagramEdgeId: step.edgeId,
          pathOrder: step.order
        };
        nextEdges.push(newEdge);
        existingEdge = newEdge;
      }

      assessmentSteps.push({
        order: step.order,
        edgeId: existingEdge.id,
        sourceNodeId: srcResult.nodeId,
        targetNodeId: tgtResult.nodeId,
        technique: step.technique
      });
    }

    const nowIso = new Date().toISOString();
    const assessmentPath: AssessmentAttackPath = {
      id: createId('aap'),
      name: diagramPath.name,
      strideCategory: diagramPath.strideCategory,
      riskLevel: diagramPath.riskLevel,
      description: diagramPath.description,
      steps: assessmentSteps,
      diagramAttackPathId: diagramPath.id,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    setTmNodes(nextNodes);
    setTmEdges(autoOrderThreatModelEdges(nextEdges));
    setNamedAttackPaths(prev => {
      const existingIdx = prev.findIndex(p => p.diagramAttackPathId === diagramPath.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = assessmentPath;
        return updated;
      }
      return [...prev, assessmentPath];
    });
    setStatusMessage({ severity: 'success', text: `Imported attack path "${diagramPath.name}" with ${assessmentSteps.length} step(s).` });
  }, [diagramSnapshot, tmNodes, tmEdges, ensureThreatModelNode, setStatusMessage]);

  const handleDeleteNamedPath = useCallback((pathId: string) => {
    setNamedAttackPaths(prev => prev.filter(p => p.id !== pathId));
  }, []);

  const diagramAttackPaths = useMemo(
    () => diagramSnapshot?.attackPaths || [],
    [diagramSnapshot?.attackPaths]
  );

  const importedDiagramPathIds = useMemo(
    () => new Set(namedAttackPaths.map(p => p.diagramAttackPathId).filter(Boolean)),
    [namedAttackPaths]
  );

  const pathsWithDescription = useMemo(
    () => namedAttackPaths.filter(p => p.description),
    [namedAttackPaths]
  );

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {diagramAttackPaths.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Import Attack Paths from Diagram
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Select attack paths from the diagram to import. Referenced nodes and edges are automatically added to the threat model.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>STRIDE</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Steps</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diagramAttackPaths.map(path => {
                  const isImported = importedDiagramPathIds.has(path.id);
                  return (
                    <TableRow key={path.id}>
                      <TableCell>
                        <Chip
                          label={STRIDE_SHORT[path.strideCategory]}
                          size="small"
                          sx={{ bgcolor: STRIDE_COLORS[path.strideCategory], color: '#fff', fontWeight: 700, fontSize: 10, height: 20, minWidth: 20 }}
                        />
                      </TableCell>
                      <TableCell>{path.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={path.riskLevel}
                          size="small"
                          sx={{ bgcolor: RISK_LEVEL_COLORS[path.riskLevel], color: '#fff', fontSize: 10, height: 18 }}
                        />
                      </TableCell>
                      <TableCell>{path.steps.length}</TableCell>
                      <TableCell>
                        <Chip
                          label={isImported ? 'Imported' : 'Available'}
                          size="small"
                          variant="outlined"
                          color={isImported ? 'success' : 'default'}
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip describeChild title={isImported ? 'Already imported' : 'Import this attack path into the assessment threat model'} arrow>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={isImported}
                              onClick={() => importDiagramAttackPath(path)}
                            >
                              Import
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {namedAttackPaths.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Typography variant="subtitle2">Imported Attack Paths ({namedAttackPaths.length})</Typography>
          {namedAttackPaths.map(path => (
            <Box
              key={path.id}
              sx={{
                border: '2px solid',
                borderColor: STRIDE_COLORS[path.strideCategory],
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box sx={{
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                bgcolor: `${STRIDE_COLORS[path.strideCategory]}11`,
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}>
                <Chip
                  label={STRIDE_SHORT[path.strideCategory]}
                  size="small"
                  sx={{ bgcolor: STRIDE_COLORS[path.strideCategory], color: '#fff', fontWeight: 700, fontSize: 10, height: 20, minWidth: 20 }}
                />
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {path.name}
                </Typography>
                <Chip
                  label={path.riskLevel}
                  size="small"
                  sx={{ bgcolor: RISK_LEVEL_COLORS[path.riskLevel], color: '#fff', fontSize: 10, height: 18 }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${path.steps.length} step${path.steps.length !== 1 ? 's' : ''}`}
                  sx={{ fontSize: 10, height: 18 }}
                />
                <Tooltip describeChild title="Remove this attack path from the assessment" arrow>
                  <IconButton size="small" color="error" onClick={() => handleDeleteNamedPath(path.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ p: 1.5 }}>
                <AttackPathFlowDiagram
                  path={path}
                  nodeInfoMap={nodeInfoMap}
                  edgeMap={edgeInfoMap}
                  onFocusNode={focusDiagramNode}
                  onFocusEdge={focusDiagramEdge}
                />
              </Box>

              <Box sx={{ px: 1.5, pb: 1.5 }}>
                <TextField
                  size="small"
                  multiline
                  minRows={2}
                  maxRows={6}
                  fullWidth
                  label="Path Description"
                  placeholder="Describe this attack path scenario..."
                  value={path.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    setNamedAttackPaths(prev =>
                      prev.map(p => p.id === path.id ? { ...p, description: value, updatedAt: new Date().toISOString() } : p)
                    );
                  }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 0.75 }}>
        {pathsWithDescription.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Copy description from path</InputLabel>
              <Select
                label="Copy description from path"
                value=""
                onChange={e => {
                  const path = namedAttackPaths.find(p => p.id === e.target.value);
                  if (path?.description) setAttackPathDescription(path.description);
                }}
              >
                {pathsWithDescription.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Chip label={STRIDE_SHORT[p.strideCategory]} size="small" sx={{ bgcolor: STRIDE_COLORS[p.strideCategory], color: '#fff', fontWeight: 700, fontSize: 10, height: 16, minWidth: 16 }} />
                      <span>{p.name}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Tooltip describeChild title="Describe the overall attack scenario: entry point, techniques, data exfiltration method, business impact." arrow>
          <TextField
            size="small"
            multiline
            minRows={3}
            maxRows={8}
            label="Attack Path Description"
            placeholder="Describe the attack path scenario: entry point, techniques used, lateral movement, exfiltration method, impact..."
            value={attackPathDescription}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAttackPathDescription(event.target.value)}
          />
        </Tooltip>
      </Box>

      {tmNodes.length === 0 && namedAttackPaths.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No attack path elements yet. Import an attack path from the diagram to visualize it here.
        </Typography>
      )}

      {tmNodes.length > 0 && namedAttackPaths.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {tmNodes.length} node{tmNodes.length !== 1 ? 's' : ''} and {tmEdges.length} edge{tmEdges.length !== 1 ? 's' : ''} in threat model.
          Import named attack paths from the diagram for visual flow representation.
        </Typography>
      )}
    </Box>
  );
};

export default GrcAssessmentThreatModelSection;
