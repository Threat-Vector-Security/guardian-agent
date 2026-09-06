import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Popover,
  Select,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { Edge, Node } from '@xyflow/react';
import { Compass, ChevronDown, ChevronUp, Crosshair, ExternalLink, HelpCircle, MousePointer, Plus, Trash2, X } from 'lucide-react';
import { StrideCategory } from '../../types/ThreatIntelTypes';
import { AppModuleMode, AttackPathRiskLevel, DiagramAttackPath, GrcAssessment, GrcWorkspace } from '../../types/GrcTypes';
import {
  createDiagramAttackPath,
  STRIDE_CATEGORIES,
  STRIDE_SHORT,
  STRIDE_COLORS,
  STRIDE_DETAILS,
  PASTA_STAGES,
  RISK_LEVELS,
  RISK_LEVEL_COLORS,
  autoOrderSteps,
  PastaStageId
} from '../../utils/attackPathUtils';
import { materialIconMappings } from '../../utils/materialIconMappings';

interface AttackPathsPanelProps {
  nodes: Node[];
  edges: Edge[];
  attackPaths: DiagramAttackPath[];
  selectedPathId: string | null;
  isPathBuildingMode: boolean;
  expandedPathIds: Set<string>;
  onExpandedPathsChange: (ids: Set<string>) => void;
  onAttackPathsChange: (paths: DiagramAttackPath[]) => void;
  onSelectedPathChange: (pathId: string | null) => void;
  onPathBuildingModeChange: (active: boolean) => void;
  onOpenMethodologyGuide?: () => void;
  onFocusNode?: (nodeId: string) => void;
  grcWorkspace?: GrcWorkspace | null;
  onSwitchModule?: (mode: AppModuleMode) => void;
}

const getNodeInfo = (nodes: Node[], nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);
  const label = (node?.data as any)?.label || nodeId;
  const nodeType = node?.type || 'generic';
  const zone = (node?.data as any)?.zone || '';
  const indexCode = (node?.data as any)?.indexCode || '';
  const iconKey = materialIconMappings[nodeType] ? nodeType : 'generic';
  return { label, id: nodeId, nodeType, zone, iconKey, indexCode };
};

const getEdgeInfo = (edges: Edge[], _nodes: Node[], edgeId: string) => {
  const edge = edges.find(e => e.id === edgeId);
  const label = (edge?.data as any)?.label || (edge?.label as string) || '';
  const indexCode = (edge?.data as any)?.indexCode || '';
  return { label, id: edgeId, indexCode };
};

interface PathFlowPreviewProps {
  path: DiagramAttackPath;
  nodes: Node[];
  edges: Edge[];
  strideColor: string;
  onRemoveStep: (edgeId: string) => void;
  onMoveStep: (stepIndex: number, direction: 'up' | 'down') => void;
  onFocusNode?: (nodeId: string) => void;
}

const PathFlowPreview: React.FC<PathFlowPreviewProps> = ({
  path, nodes, edges, strideColor, onRemoveStep, onMoveStep, onFocusNode
}) => {
  const sortedSteps = useMemo(
    () => [...path.steps].sort((a, b) => a.order - b.order),
    [path.steps]
  );

  const nodeSequence = useMemo(() => {
    const seen = new Set<string>();
    const seq: string[] = [];
    for (const step of sortedSteps) {
      if (!seen.has(step.sourceNodeId)) { seen.add(step.sourceNodeId); seq.push(step.sourceNodeId); }
      if (!seen.has(step.targetNodeId)) { seen.add(step.targetNodeId); seq.push(step.targetNodeId); }
    }
    return seq;
  }, [sortedSteps]);

  const stepBetween = useMemo(() => {
    const map = new Map<string, { step: (typeof sortedSteps)[0]; index: number }>();
    sortedSteps.forEach((step, idx) => {
      map.set(`${step.sourceNodeId}->${step.targetNodeId}`, { step, index: idx });
    });
    return map;
  }, [sortedSteps]);

  if (nodeSequence.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0, py: 0.25 }}>
      {nodeSequence.map((nodeId, idx) => {
        const info = getNodeInfo(nodes, nodeId);
        const IconComponent = materialIconMappings[info.iconKey]?.icon;
        const typeName = materialIconMappings[info.iconKey]?.name || info.nodeType;

        const nextNodeId = idx < nodeSequence.length - 1 ? nodeSequence[idx + 1] : null;
        const connecting = nextNodeId ? stepBetween.get(`${nodeId}->${nextNodeId}`) : null;
        const edgeInfo = connecting ? getEdgeInfo(edges, nodes, connecting.step.edgeId) : null;

        return (
          <React.Fragment key={nodeId}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.5,
              borderRadius: 0.75,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              minWidth: 0
            }}>
              <Box sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: strideColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0
              }}>
                {idx + 1}
              </Box>
              {IconComponent && <IconComponent sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, fontSize: '0.7rem' }}>
                  {info.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', lineHeight: 1.1, display: 'block' }}>
                  {typeName}{info.zone ? ` · ${info.zone}` : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.55rem', lineHeight: 1.1, fontFamily: 'monospace', opacity: 0.7 }}>
                  {info.indexCode || info.id}
                </Typography>
              </Box>
              {onFocusNode && (
                <Tooltip title="Focus in diagram" arrow>
                  <IconButton size="small" onClick={() => onFocusNode(nodeId)} sx={{ p: 0.25, flexShrink: 0 }}>
                    <Crosshair size={12} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {nextNodeId && connecting && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, pl: 1, py: 0.125 }}>
                <ArrowDownwardIcon sx={{ fontSize: 14, color: strideColor, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" noWrap sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>
                    {edgeInfo?.label || connecting.step.technique || ''}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'monospace', opacity: 0.7, display: 'block' }}>
                    {edgeInfo?.indexCode || connecting.step.edgeId}
                  </Typography>
                </Box>
                {onFocusNode && (
                  <Tooltip title="Focus in diagram" arrow>
                    <IconButton size="small" onClick={() => onFocusNode(connecting.step.sourceNodeId)} sx={{ p: 0.125, flexShrink: 0 }}>
                      <Crosshair size={10} />
                    </IconButton>
                  </Tooltip>
                )}
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => onMoveStep(connecting.index, 'up')} disabled={connecting.index === 0} sx={{ p: 0.125 }}>
                    <ChevronUp size={10} />
                  </IconButton>
                  <IconButton size="small" onClick={() => onMoveStep(connecting.index, 'down')} disabled={connecting.index === sortedSteps.length - 1} sx={{ p: 0.125 }}>
                    <ChevronDown size={10} />
                  </IconButton>
                  <IconButton size="small" onClick={() => onRemoveStep(connecting.step.edgeId)} sx={{ p: 0.125, color: 'error.main' }}>
                    <Trash2 size={10} />
                  </IconButton>
                </Box>
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

const AttackPathsPanel: React.FC<AttackPathsPanelProps> = ({
  nodes,
  edges,
  attackPaths,
  selectedPathId,
  isPathBuildingMode,
  expandedPathIds,
  onExpandedPathsChange,
  onAttackPathsChange,
  onSelectedPathChange,
  onPathBuildingModeChange,
  onOpenMethodologyGuide,
  onFocusNode,
  grcWorkspace,
  onSwitchModule
}) => {
  const [newPathName, setNewPathName] = useState('');
  const [newPathStride, setNewPathStride] = useState<StrideCategory>('Tampering');
  const [strideGuideAnchor, setStrideGuideAnchor] = useState<HTMLElement | null>(null);
  const [strideGuideCategory, setStrideGuideCategory] = useState<StrideCategory>('Tampering');
  const [pastaGuideAnchor, setPastaGuideAnchor] = useState<HTMLElement | null>(null);
  const [pastaGuideStage, setPastaGuideStage] = useState<PastaStageId>(1);
  const toggleExpand = useCallback((pathId: string) => {
    const next = new Set(expandedPathIds);
    const isExpanding = !next.has(pathId);
    if (isExpanding) {
      next.add(pathId);
    } else {
      next.delete(pathId);
    }
    onExpandedPathsChange(next);
    if (isExpanding && onFocusNode) {
      const path = attackPaths.find(p => p.id === pathId);
      if (path && path.steps.length > 0) {
        const sorted = [...path.steps].sort((a, b) => a.order - b.order);
        onFocusNode(sorted[0].sourceNodeId);
      }
    }
  }, [expandedPathIds, onExpandedPathsChange, onFocusNode, attackPaths]);

  const handleCreatePath = useCallback(() => {
    const name = newPathName.trim() || `Attack Path ${attackPaths.length + 1}`;
    const path = createDiagramAttackPath(name, newPathStride);
    const updated = [...attackPaths, path];
    onAttackPathsChange(updated);
    onSelectedPathChange(path.id);
    onExpandedPathsChange(new Set([...Array.from(expandedPathIds), path.id]));
    setNewPathName('');
  }, [attackPaths, newPathName, newPathStride, onAttackPathsChange, onSelectedPathChange, expandedPathIds, onExpandedPathsChange]);

  const handleDeletePath = useCallback((pathId: string) => {
    onAttackPathsChange(attackPaths.filter(p => p.id !== pathId));
    if (selectedPathId === pathId) {
      onSelectedPathChange(null);
      onPathBuildingModeChange(false);
    }
    const next = new Set(expandedPathIds);
    next.delete(pathId);
    onExpandedPathsChange(next);
  }, [attackPaths, onAttackPathsChange, onPathBuildingModeChange, onSelectedPathChange, selectedPathId, expandedPathIds, onExpandedPathsChange]);

  const updatePath = useCallback((pathId: string, patch: Partial<DiagramAttackPath>) => {
    onAttackPathsChange(attackPaths.map(p =>
      p.id === pathId
        ? { ...p, ...patch, updatedAt: new Date().toISOString() }
        : p
    ));
  }, [attackPaths, onAttackPathsChange]);

  const handleMoveStep = useCallback((pathId: string, stepIndex: number, direction: 'up' | 'down') => {
    const path = attackPaths.find(p => p.id === pathId);
    if (!path) return;
    const steps = [...path.steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    [steps[stepIndex], steps[targetIndex]] = [steps[targetIndex], steps[stepIndex]];
    updatePath(pathId, { steps: steps.map((s, i) => ({ ...s, order: i + 1 })) });
  }, [attackPaths, updatePath]);

  const handleRemoveStep = useCallback((pathId: string, edgeId: string) => {
    const path = attackPaths.find(p => p.id === pathId);
    if (!path) return;
    const steps = path.steps
      .filter(s => s.edgeId !== edgeId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    updatePath(pathId, { steps });
  }, [attackPaths, updatePath]);

  const handleAutoOrder = useCallback((pathId: string) => {
    const path = attackPaths.find(p => p.id === pathId);
    if (!path || path.steps.length === 0) return;
    updatePath(pathId, { steps: autoOrderSteps(path.steps) });
  }, [attackPaths, updatePath]);

  const openStrideGuide = useCallback((event: React.MouseEvent<HTMLElement>, category: StrideCategory) => {
    event.stopPropagation();
    setStrideGuideCategory(category);
    setStrideGuideAnchor(event.currentTarget);
  }, []);

  const openPastaGuide = useCallback((event: React.MouseEvent<HTMLElement>, stageId: PastaStageId) => {
    event.stopPropagation();
    setPastaGuideStage(stageId);
    setPastaGuideAnchor(event.currentTarget);
  }, []);

  const strideGuide = STRIDE_DETAILS[strideGuideCategory];
  const pastaGuide = PASTA_STAGES.find(s => s.id === pastaGuideStage);

  const linkedAssessmentsByPathId = useMemo(() => {
    const map = new Map<string, GrcAssessment[]>();
    if (!grcWorkspace) return map;
    for (const assessment of grcWorkspace.assessments) {
      const importedPaths = assessment.threatModel?.attackPaths;
      if (!importedPaths) continue;
      for (const ap of importedPaths) {
        if (ap.diagramAttackPathId) {
          const list = map.get(ap.diagramAttackPathId) || [];
          list.push(assessment);
          map.set(ap.diagramAttackPathId, list);
        }
      }
    }
    return map;
  }, [grcWorkspace]);

  const handleNavigateToAssessment = useCallback((assessmentId: string) => {
    onSwitchModule?.('grc');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('grc-open-assessment-by-id', {
        detail: { assessmentId }
      }));
    }, 50);
  }, [onSwitchModule]);

  const totalPaths = attackPaths.length;
  const criticalHighCount = attackPaths.filter(p => p.riskLevel === 'Critical' || p.riskLevel === 'High').length;

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 1, display: 'grid', gap: 1, alignContent: 'start' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontSize: '0.8rem' }}>Attack Paths</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {totalPaths > 0 && (
            <Chip size="small" label={totalPaths} variant="outlined" sx={{ fontSize: 10, height: 18 }} />
          )}
          {criticalHighCount > 0 && (
            <Chip size="small" label={`${criticalHighCount} crit`} sx={{ fontSize: 10, height: 18, bgcolor: '#dc2626', color: '#fff' }} />
          )}
          {onOpenMethodologyGuide && (
            <Tooltip title="STRIDE & PASTA Methodology Guide" arrow>
              <IconButton size="small" onClick={() => onOpenMethodologyGuide()} sx={{ p: 0.25 }}>
                <Compass size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Create form */}
      <Box sx={{ p: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', display: 'grid', gap: 0.5 }}>
        <TextField
          size="small"
          placeholder="New path name..."
          value={newPathName}
          onChange={e => setNewPathName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreatePath()}
          inputProps={{ style: { fontSize: '0.8rem', padding: '4px 8px' } }}
        />
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Select
            size="small"
            value={newPathStride}
            onChange={e => setNewPathStride(e.target.value as StrideCategory)}
            sx={{ flex: 1, fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 } }}
            renderValue={(val) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STRIDE_COLORS[val as StrideCategory], flexShrink: 0 }} />
                {val}
              </Box>
            )}
          >
            {STRIDE_CATEGORIES.map(cat => (
              <MenuItem key={cat} value={cat} sx={{ fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STRIDE_COLORS[cat], flexShrink: 0 }} />
                  {cat}
                </Box>
              </MenuItem>
            ))}
          </Select>
          <Tooltip title="STRIDE guidance" arrow>
            <IconButton size="small" onClick={e => openStrideGuide(e, newPathStride)} sx={{ p: 0.25 }}>
              <HelpCircle size={13} />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" size="small" onClick={handleCreatePath} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.75rem' }}>
            <Plus size={14} />
          </Button>
        </Box>
      </Box>

      {/* Empty state */}
      {attackPaths.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          Create an attack path, then click "Build" and select edges on the diagram to define the attack sequence.
        </Typography>
      )}

      {/* Path list */}
      {attackPaths.length > 0 && (
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          {attackPaths.map(path => {
            const isExpanded = expandedPathIds.has(path.id);
            const isSelected = path.id === selectedPathId;
            const isBuilding = isSelected && isPathBuildingMode;

            return (
              <Box
                key={path.id}
                sx={{
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: isBuilding ? 'error.main' : isSelected ? 'primary.main' : (path.steps.length > 0 ? STRIDE_COLORS[path.strideCategory] : 'divider'),
                  overflow: 'hidden'
                }}
              >
                {/* Collapsed header */}
                <Tooltip
                  title={!isExpanded && path.steps.length > 0 ? 'Expand to show attack path on diagram' : ''}
                  placement="right"
                  arrow
                  enterDelay={400}
                >
                <Box
                  onClick={() => {
                    onSelectedPathChange(isSelected && !isExpanded ? null : path.id);
                    toggleExpand(path.id);
                    if (isSelected && isExpanded && isPathBuildingMode) {
                      onPathBuildingModeChange(false);
                    }
                  }}
                  sx={{
                    px: 0.75,
                    py: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    minWidth: 0
                  }}
                >
                  <Tooltip title={`${path.strideCategory}`} arrow>
                    <Chip
                      label={path.strideCategory}
                      size="small"
                      onClick={e => openStrideGuide(e, path.strideCategory)}
                      sx={{
                        bgcolor: STRIDE_COLORS[path.strideCategory],
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 10,
                        height: 18,
                        cursor: 'pointer',
                        '& .MuiChip-label': { px: 0.5 }
                      }}
                    />
                  </Tooltip>
                  <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 400, fontSize: '0.75rem', minWidth: 0 }}>
                    {path.name}
                  </Typography>
                  <Chip
                    label={path.riskLevel}
                    size="small"
                    sx={{
                      bgcolor: RISK_LEVEL_COLORS[path.riskLevel],
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 10,
                      height: 18,
                      '& .MuiChip-label': { px: 0.5 }
                    }}
                  />
                  {path.steps.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', flexShrink: 0 }}>
                      {path.steps.length}s
                    </Typography>
                  )}
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </Box>
                </Tooltip>

                {/* Expanded detail */}
                {isExpanded && (
                  <Box sx={{ px: 0.75, py: 0.75, display: 'grid', gap: 0.75, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <TextField
                      size="small"
                      placeholder="Path name"
                      value={path.name}
                      onChange={e => updatePath(path.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      inputProps={{ style: { fontSize: '0.8rem', padding: '4px 8px' } }}
                    />

                    {/* STRIDE + Risk row */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Select
                        size="small"
                        value={path.strideCategory}
                        onChange={e => updatePath(path.id, { strideCategory: e.target.value as StrideCategory })}
                        sx={{ flex: 1, fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 } }}
                        renderValue={(val) => (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STRIDE_COLORS[val as StrideCategory], flexShrink: 0 }} />
                            {val}
                          </Box>
                        )}
                      >
                        {STRIDE_CATEGORIES.map(cat => (
                          <MenuItem key={cat} value={cat} sx={{ fontSize: '0.8rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STRIDE_COLORS[cat], flexShrink: 0 }} />
                              {cat}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      <Select
                        size="small"
                        value={path.riskLevel}
                        onChange={e => updatePath(path.id, { riskLevel: e.target.value as AttackPathRiskLevel })}
                        sx={{ flex: 1, fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
                      >
                        {RISK_LEVELS.map(level => (
                          <MenuItem key={level} value={level} sx={{ fontSize: '0.8rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: RISK_LEVEL_COLORS[level], flexShrink: 0 }} />
                              {level}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>

                    {/* PASTA stage row */}
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Select
                        size="small"
                        displayEmpty
                        value={path.pastaStage || ''}
                        onChange={e => updatePath(path.id, { pastaStage: (e.target.value || undefined) as DiagramAttackPath['pastaStage'] })}
                        sx={{ flex: 1, fontSize: '0.7rem', '& .MuiSelect-select': { py: 0.5 } }}
                        renderValue={(val) => val ? `PASTA ${val}. ${PASTA_STAGES.find(s => s.id === val)?.shortName || ''}` : <Typography sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>PASTA stage</Typography>}
                      >
                        <MenuItem value="" sx={{ fontSize: '0.8rem' }}><em>None</em></MenuItem>
                        {PASTA_STAGES.map(stage => (
                          <MenuItem key={stage.id} value={stage.id} sx={{ fontSize: '0.8rem' }}>{stage.id}. {stage.shortName}</MenuItem>
                        ))}
                      </Select>
                      {path.pastaStage && (
                        <Tooltip title="PASTA stage guidance" arrow>
                          <IconButton size="small" onClick={e => openPastaGuide(e, path.pastaStage!)} sx={{ p: 0.25 }}>
                            <HelpCircle size={12} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>

                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      maxRows={3}
                      placeholder="Describe the attack scenario..."
                      value={path.description}
                      onChange={e => updatePath(path.id, { description: e.target.value })}
                      inputProps={{ style: { fontSize: '0.75rem' } }}
                    />

                    {/* Build path button */}
                    <Button
                      variant={isBuilding ? 'contained' : 'outlined'}
                      color={isBuilding ? 'error' : 'primary'}
                      size="small"
                      fullWidth
                      startIcon={isBuilding ? <X size={12} /> : <MousePointer size={12} />}
                      onClick={() => {
                        onSelectedPathChange(path.id);
                        onPathBuildingModeChange(!isBuilding);
                      }}
                      sx={{ fontSize: '0.75rem', py: 0.25, textTransform: 'none' }}
                    >
                      {isBuilding ? 'Stop Building' : 'Build Path'}
                    </Button>

                    {isBuilding && (
                      <Typography variant="caption" color="error.main" sx={{ fontSize: '0.65rem' }}>
                        Click edges on the diagram to add/remove steps.
                      </Typography>
                    )}

                    {/* Linked assessments */}
                    {(() => {
                      const linked = linkedAssessmentsByPathId.get(path.id);
                      if (!linked || linked.length === 0) return null;
                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                            Linked Assessments ({linked.length})
                          </Typography>
                          {linked.map(a => (
                            <Tooltip key={a.id} title={`Open assessment "${a.title}" in GRC`} arrow>
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<ExternalLink size={11} />}
                                onClick={() => handleNavigateToAssessment(a.id)}
                                sx={{
                                  fontSize: '0.7rem',
                                  py: 0,
                                  px: 0.5,
                                  textTransform: 'none',
                                  justifyContent: 'flex-start',
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'block',
                                  textAlign: 'left'
                                }}
                              >
                                {a.title}
                              </Button>
                            </Tooltip>
                          ))}
                        </Box>
                      );
                    })()}

                    {/* Steps */}
                    {path.steps.length > 0 && (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem' }}>Steps ({path.steps.length})</Typography>
                          <Tooltip title="Auto-order steps by graph traversal" arrow>
                            <Button size="small" onClick={() => handleAutoOrder(path.id)} sx={{ fontSize: '0.65rem', py: 0, px: 0.5, minWidth: 0, textTransform: 'none' }}>
                              Auto-order
                            </Button>
                          </Tooltip>
                        </Box>
                        <PathFlowPreview
                          path={path}
                          nodes={nodes}
                          edges={edges}
                          strideColor={STRIDE_COLORS[path.strideCategory]}
                          onRemoveStep={(edgeId) => handleRemoveStep(path.id, edgeId)}
                          onMoveStep={(stepIndex, direction) => handleMoveStep(path.id, stepIndex, direction)}
                          onFocusNode={onFocusNode}
                        />
                      </>
                    )}

                    <Divider sx={{ my: 0 }} />

                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      startIcon={<Trash2 size={12} />}
                      onClick={() => handleDeletePath(path.id)}
                      sx={{ fontSize: '0.7rem', py: 0, textTransform: 'none', justifyContent: 'flex-start' }}
                    >
                      Delete Path
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* STRIDE guide popover */}
      <Popover
        open={Boolean(strideGuideAnchor)}
        anchorEl={strideGuideAnchor}
        onClose={() => setStrideGuideAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 1.5, maxWidth: 340, maxHeight: '70vh', overflow: 'auto' } }}
      >
        {strideGuide && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={STRIDE_SHORT[strideGuide.category]}
                size="small"
                sx={{ bgcolor: STRIDE_COLORS[strideGuide.category], color: '#fff', fontWeight: 700 }}
              />
              <Typography variant="subtitle2" fontWeight={700}>{strideGuide.category}</Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">{strideGuide.description}</Typography>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Applies to</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {strideGuide.dfdApplicability.map(t => (
                  <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Questions to ask</Typography>
              {strideGuide.questionsToAsk.map((q, i) => (
                <Typography key={i} variant="caption" display="block" sx={{ mb: 0.25, pl: 1 }}>
                  {'\u2022'} {q}
                </Typography>
              ))}
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Attack examples</Typography>
              {strideGuide.examples.map((ex, i) => (
                <Typography key={i} variant="caption" display="block" color="error.light" sx={{ mb: 0.25, pl: 1 }}>
                  {'\u2022'} {ex}
                </Typography>
              ))}
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Mitigations</Typography>
              {strideGuide.mitigations.map((m, i) => (
                <Typography key={i} variant="caption" display="block" color="success.light" sx={{ mb: 0.25, pl: 1 }}>
                  {'\u2022'} {m}
                </Typography>
              ))}
            </Box>

            {strideGuide.owasp.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>OWASP mapping</Typography>
                {strideGuide.owasp.map(o => (
                  <Chip key={o} label={o} size="small" variant="outlined" sx={{ fontSize: 10, height: 18, mr: 0.5 }} />
                ))}
              </Box>
            )}
          </Box>
        )}
      </Popover>

      {/* PASTA guide popover */}
      <Popover
        open={Boolean(pastaGuideAnchor)}
        anchorEl={pastaGuideAnchor}
        onClose={() => setPastaGuideAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 1.5, maxWidth: 340, maxHeight: '70vh', overflow: 'auto' } }}
      >
        {pastaGuide && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`Stage ${pastaGuide.id}`} size="small" sx={{ bgcolor: '#0f172a', color: '#94a3b8', fontWeight: 700 }} />
              <Typography variant="subtitle2" fontWeight={700}>{pastaGuide.name}</Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">{pastaGuide.description}</Typography>

            <Box
              sx={{
                p: 0.75,
                borderRadius: 1,
                bgcolor: 'action.hover',
                borderLeft: '3px solid',
                borderColor: 'primary.main'
              }}
            >
              <Typography variant="caption" color="text.secondary">{pastaGuide.guidance}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Questions to ask</Typography>
              {pastaGuide.questionsToAsk.map((q, i) => (
                <Typography key={i} variant="caption" display="block" sx={{ mb: 0.25, pl: 1 }}>
                  {'\u2022'} {q}
                </Typography>
              ))}
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Expected outputs</Typography>
              {pastaGuide.outputs.map((o, i) => (
                <Typography key={i} variant="caption" display="block" color="success.light" sx={{ mb: 0.25, pl: 1 }}>
                  {'\u2022'} {o}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Popover>
    </Box>
  );
};

export default AttackPathsPanel;
