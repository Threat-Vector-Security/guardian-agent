import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { ChevronDown, ChevronRight, Plus, Shield, Trash2, Zap } from 'lucide-react';
import {
  GrcAssetDomain,
  GrcThreatActor,
  GrcThreatActorResourceLevel,
  GrcThreatActorType,
  GrcThreatScenario
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const actorTypeLabels: Record<GrcThreatActorType, string> = {
  nation_state: 'Nation State',
  organised_crime: 'Organised Crime',
  insider: 'Insider',
  hacktivist: 'Hacktivist',
  opportunistic: 'Opportunistic',
  competitor: 'Competitor',
  supply_chain: 'Supply Chain'
};

const resourceLabels: Record<GrcThreatActorResourceLevel, string> = {
  very_low: 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High'
};

const ACTOR_TYPE_COLORS: Record<GrcThreatActorType, string> = {
  nation_state: '#dc2626',
  organised_crime: '#ea580c',
  insider: '#ca8a04',
  hacktivist: '#7c3aed',
  opportunistic: '#6b7280',
  competitor: '#2563eb',
  supply_chain: '#059669'
};

const RESOURCE_COLORS: Record<GrcThreatActorResourceLevel, string> = {
  very_low: '#6b7280',
  low: '#2563eb',
  moderate: '#ca8a04',
  high: '#ea580c',
  very_high: '#dc2626'
};

const capabilityLabel = (level: number): string => {
  switch (level) {
    case 1: return 'Script Kiddie';
    case 2: return 'Basic';
    case 3: return 'Intermediate';
    case 4: return 'Advanced';
    case 5: return 'APT';
    default: return 'Unknown';
  }
};

const domainLabels: Record<GrcAssetDomain, string> = {
  it: 'IT', ot: 'OT', cloud: 'Cloud', iot: 'IoT', application: 'Application',
  data: 'Data', network: 'Network', physical: 'Physical', people: 'People'
};
const ALL_DOMAINS: GrcAssetDomain[] = ['it', 'ot', 'cloud', 'iot', 'application', 'data', 'network', 'physical', 'people'];

const ACTOR_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', defaultVisible: true, removable: false },
  { id: 'type', label: 'Type', defaultVisible: true, removable: true },
  { id: 'capability', label: 'Capability', defaultVisible: true, removable: true },
  { id: 'resources', label: 'Resources', defaultVisible: true, removable: true },
  { id: 'motivation', label: 'Motivation', defaultVisible: true, removable: true },
  { id: 'targetedAssets', label: 'Assets', defaultVisible: true, removable: true },
  { id: 'targetedDomains', label: 'Domains', defaultVisible: false, removable: true },
  { id: 'linkedScenarios', label: 'Scenarios', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Risks', defaultVisible: true, removable: true },
  { id: 'linkedAssessments', label: 'Assessments', defaultVisible: false, removable: true },
  { id: 'tags', label: 'Tags', defaultVisible: false, removable: true },
  { id: 'actions', label: '', defaultVisible: true, removable: false }
];

const SCENARIO_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Title', defaultVisible: true, removable: false },
  { id: 'actor', label: 'Actor', defaultVisible: true, removable: true },
  { id: 'techniques', label: 'Techniques', defaultVisible: true, removable: true },
  { id: 'targetedAssets', label: 'Assets', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Risks', defaultVisible: true, removable: true },
  { id: 'linkedAssessments', label: 'Assessments', defaultVisible: true, removable: true },
  { id: 'likelihood', label: 'Likelihood', defaultVisible: true, removable: true },
  { id: 'impact', label: 'Impact', defaultVisible: true, removable: true },
  { id: 'actions', label: '', defaultVisible: true, removable: false }
];

const ACTOR_SORTABLE = new Set(['name', 'type', 'capability', 'resources', 'motivation', 'targetedAssets', 'linkedScenarios', 'linkedRisks']);
const SCENARIO_SORTABLE = new Set(['title', 'actor', 'techniques', 'targetedAssets', 'linkedRisks', 'linkedAssessments', 'likelihood', 'impact']);

type SortDir = 'asc' | 'desc';

const GrcThreatProfileTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const actors = useMemo(() => workspace.threatActors || [], [workspace.threatActors]);
  const scenarios = useMemo(() => workspace.threatScenarios || [], [workspace.threatScenarios]);
  const assets = useMemo(() => workspace.assets || [], [workspace.assets]);
  const risks = useMemo(() => workspace.risks || [], [workspace.risks]);
  const assessments = useMemo(() => workspace.assessments || [], [workspace.assessments]);
  const persistedView = getTabViewState?.('threat_profile', {
    expandedActorId: null,
    expandedScenarioId: null
  }) ?? {
    expandedActorId: null,
    expandedScenarioId: null
  };

  const actorColumnConfig = useTableColumnConfig('threatActors', ACTOR_COLUMNS, workspace, applyWorkspace);
  const scenarioColumnConfig = useTableColumnConfig('threatScenarios', SCENARIO_COLUMNS, workspace, applyWorkspace);

  const [actorSort, setActorSort] = useState<string>('name');
  const [actorSortDir, setActorSortDir] = useState<SortDir>('asc');
  const [scenarioSort, setScenarioSort] = useState<string>('title');
  const [scenarioSortDir, setScenarioSortDir] = useState<SortDir>('asc');

  const [actorTypeFilter, setActorTypeFilter] = useState<GrcThreatActorType | 'all'>('all');
  const [scenarioActorFilter, setScenarioActorFilter] = useState<string>('all');
  const [actorSearch, setActorSearch] = useState('');
  const [scenarioSearch, setScenarioSearch] = useState('');

  const [expandedActorId, setExpandedActorId] = useState<string | null>((persistedView.expandedActorId as string | null) ?? null);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>((persistedView.expandedScenarioId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab === 'threat_profile' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (actors.some(a => a.id === id)) {
        setExpandedActorId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-actor-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      } else if (scenarios.some(s => s.id === id)) {
        setExpandedScenarioId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-scenario-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, actors, scenarios]);

  useEffect(() => {
    setTabViewState?.('threat_profile', {
      expandedActorId,
      expandedScenarioId
    });
  }, [expandedActorId, expandedScenarioId, setTabViewState]);

  const [showActorForm, setShowActorForm] = useState(false);
  const [showScenarioForm, setShowScenarioForm] = useState(false);

  const [deleteActorId, setDeleteActorId] = useState<string | null>(null);
  const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(null);

  const [newActorName, setNewActorName] = useState('');
  const [newActorType, setNewActorType] = useState<GrcThreatActorType>('opportunistic');
  const [newActorCapability, setNewActorCapability] = useState(3);
  const [newActorResource, setNewActorResource] = useState<GrcThreatActorResourceLevel>('moderate');
  const [newActorMotivation, setNewActorMotivation] = useState('');

  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioActorId, setNewScenarioActorId] = useState('');
  const [newScenarioTechniques, setNewScenarioTechniques] = useState<string[]>([]);
  const [newScenarioDescription, setNewScenarioDescription] = useState('');

  const scenariosByActorId = useMemo(() => {
    const map = new Map<string, GrcThreatScenario[]>();
    scenarios.forEach(s => {
      if (!s.threatActorId) return;
      const list = map.get(s.threatActorId) || [];
      list.push(s);
      map.set(s.threatActorId, list);
    });
    return map;
  }, [scenarios]);

  const risksByActorId = useMemo(() => {
    const map = new Map<string, typeof risks>();
    risks.forEach(r => {
      if (!r.threatActorIds?.length) return;
      r.threatActorIds.forEach(actorId => {
        const list = map.get(actorId) || [];
        list.push(r);
        map.set(actorId, list);
      });
    });
    return map;
  }, [risks]);

  const assessmentsByActorId = useMemo(() => {
    const map = new Map<string, typeof assessments>();
    assessments.forEach(a => {
      if (!a.threatActorIds?.length) return;
      a.threatActorIds.forEach(actorId => {
        const list = map.get(actorId) || [];
        list.push(a);
        map.set(actorId, list);
      });
    });
    return map;
  }, [assessments]);

  const mitreControls = useMemo(() => {
    return workspace.controlSets
      .filter(cs => (cs.importSourceName || cs.name || '').toLowerCase().includes('mitre'))
      .flatMap(cs => cs.controls.map(c => ({
        controlId: c.controlId, title: c.title, family: c.family || ''
      })));
  }, [workspace.controlSets]);

  const mitreOptions = useMemo(() => {
    return mitreControls.map(c => `${c.controlId} - ${c.title}`);
  }, [mitreControls]);

  const filteredActors = useMemo(() => {
    let result = actors;
    if (actorTypeFilter !== 'all') result = result.filter(a => a.type === actorTypeFilter);
    if (actorSearch.trim()) {
      const q = actorSearch.trim().toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q)
        || a.motivation.toLowerCase().includes(q)
        || (a.description || '').toLowerCase().includes(q)
        || a.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [actors, actorTypeFilter, actorSearch]);

  const sortedActors = useMemo(() => {
    const list = [...filteredActors];
    const dir = actorSortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (actorSort) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'capability': cmp = a.capabilityLevel - b.capabilityLevel; break;
        case 'resources': {
          const order = ['very_low', 'low', 'moderate', 'high', 'very_high'];
          cmp = order.indexOf(a.resourceLevel) - order.indexOf(b.resourceLevel);
          break;
        }
        case 'motivation': cmp = a.motivation.localeCompare(b.motivation); break;
        case 'targetedAssets': cmp = a.targetedAssetIds.length - b.targetedAssetIds.length; break;
        case 'linkedScenarios': cmp = (scenariosByActorId.get(a.id)?.length || 0) - (scenariosByActorId.get(b.id)?.length || 0); break;
        case 'linkedRisks': cmp = (risksByActorId.get(a.id)?.length || 0) - (risksByActorId.get(b.id)?.length || 0); break;
        default: cmp = a.name.localeCompare(b.name);
      }
      return cmp * dir;
    });
    return list;
  }, [filteredActors, actorSort, actorSortDir, scenariosByActorId, risksByActorId]);

  const filteredScenarios = useMemo(() => {
    let result = scenarios;
    if (scenarioActorFilter !== 'all') result = result.filter(s => s.threatActorId === scenarioActorFilter);
    if (scenarioSearch.trim()) {
      const q = scenarioSearch.trim().toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q)
        || s.description.toLowerCase().includes(q)
        || s.attackTechniques.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [scenarios, scenarioActorFilter, scenarioSearch]);

  const sortedScenarios = useMemo(() => {
    const list = [...filteredScenarios];
    const dir = scenarioSortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (scenarioSort) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'actor': {
          const aName = actors.find(x => x.id === a.threatActorId)?.name || '';
          const bName = actors.find(x => x.id === b.threatActorId)?.name || '';
          cmp = aName.localeCompare(bName);
          break;
        }
        case 'techniques': cmp = a.attackTechniques.length - b.attackTechniques.length; break;
        case 'targetedAssets': cmp = a.targetedAssetIds.length - b.targetedAssetIds.length; break;
        case 'linkedRisks': cmp = a.linkedRiskIds.length - b.linkedRiskIds.length; break;
        case 'linkedAssessments': cmp = (a.linkedAssessmentIds?.length || 0) - (b.linkedAssessmentIds?.length || 0); break;
        case 'likelihood': cmp = (a.likelihood || '').localeCompare(b.likelihood || ''); break;
        case 'impact': cmp = (a.impact || '').localeCompare(b.impact || ''); break;
        default: cmp = a.title.localeCompare(b.title);
      }
      return cmp * dir;
    });
    return list;
  }, [filteredScenarios, scenarioSort, scenarioSortDir, actors]);

  const handleActorSort = useCallback((col: string) => {
    setActorSortDir(prev => actorSort === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setActorSort(col);
  }, [actorSort]);

  const handleScenarioSort = useCallback((col: string) => {
    setScenarioSortDir(prev => scenarioSort === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setScenarioSort(col);
  }, [scenarioSort]);

  const updateActor = useCallback((actorId: string, patch: Partial<GrcThreatActor>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      threatActors: actors.map(a => a.id === actorId ? { ...a, ...patch, updatedAt: now } : a)
    });
  }, [applyWorkspace, workspace, actors]);

  const updateScenario = useCallback((scenarioId: string, patch: Partial<GrcThreatScenario>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      threatScenarios: scenarios.map(s => s.id === scenarioId ? { ...s, ...patch, updatedAt: now } : s)
    });
  }, [applyWorkspace, workspace, scenarios]);

  const handleAddActor = useCallback(() => {
    const name = newActorName.trim();
    if (!name) { setStatusMessage({ severity: 'warning', text: 'Actor name is required.' }); return; }
    const now = new Date().toISOString();
    const actor: GrcThreatActor = {
      id: createId('actor'), name, type: newActorType,
      capabilityLevel: newActorCapability, resourceLevel: newActorResource,
      motivation: newActorMotivation.trim(),
      targetedAssetIds: [], tags: [],
      createdAt: now, updatedAt: now
    };
    applyWorkspace({ ...workspace, threatActors: [...actors, actor] });
    setNewActorName(''); setNewActorMotivation('');
    setNewActorCapability(3); setNewActorResource('moderate'); setNewActorType('opportunistic');
    setShowActorForm(false);
    setStatusMessage({ severity: 'success', text: `Added threat actor "${name}".` });
  }, [applyWorkspace, workspace, actors, newActorName, newActorType, newActorCapability, newActorResource, newActorMotivation, setStatusMessage]);

  const handleDeleteActor = useCallback((actorId: string) => {
    const actor = actors.find(a => a.id === actorId);
    const nextActors = actors.filter(a => a.id !== actorId);
    const nextScenarios = scenarios.map(s => s.threatActorId === actorId ? { ...s, threatActorId: '' } : s);
    const nextRisks = workspace.risks.map(r => {
      if (!r.threatActorIds?.includes(actorId)) return r;
      const filtered = r.threatActorIds.filter(id => id !== actorId);
      return { ...r, threatActorIds: filtered.length > 0 ? filtered : undefined };
    });
    const nextAssessments = workspace.assessments.map(a => {
      if (!a.threatActorIds?.includes(actorId)) return a;
      return { ...a, threatActorIds: a.threatActorIds.filter(id => id !== actorId) };
    });
    applyWorkspace({ ...workspace, threatActors: nextActors, threatScenarios: nextScenarios, risks: nextRisks, assessments: nextAssessments });
    setDeleteActorId(null);
    if (actor) setStatusMessage({ severity: 'success', text: `Deleted threat actor "${actor.name}".` });
  }, [applyWorkspace, workspace, actors, scenarios, setStatusMessage]);

  const handleAddScenario = useCallback(() => {
    const title = newScenarioTitle.trim();
    if (!title) { setStatusMessage({ severity: 'warning', text: 'Scenario title is required.' }); return; }
    const now = new Date().toISOString();
    const scenario: GrcThreatScenario = {
      id: createId('scenario'), title,
      description: newScenarioDescription.trim(),
      threatActorId: newScenarioActorId,
      targetedAssetIds: [], attackTechniques: [...newScenarioTechniques],
      linkedRiskIds: [],
      createdAt: now, updatedAt: now
    };
    applyWorkspace({ ...workspace, threatScenarios: [...scenarios, scenario] });
    setNewScenarioTitle(''); setNewScenarioDescription('');
    setNewScenarioActorId(''); setNewScenarioTechniques([]);
    setShowScenarioForm(false);
    setStatusMessage({ severity: 'success', text: `Added threat scenario "${title}".` });
  }, [applyWorkspace, workspace, scenarios, newScenarioTitle, newScenarioDescription, newScenarioActorId, newScenarioTechniques, setStatusMessage]);

  const handleDeleteScenario = useCallback((scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    applyWorkspace({ ...workspace, threatScenarios: scenarios.filter(s => s.id !== scenarioId) });
    setDeleteScenarioId(null);
    if (scenario) setStatusMessage({ severity: 'success', text: `Deleted scenario "${scenario.title}".` });
  }, [applyWorkspace, workspace, scenarios, setStatusMessage]);

  const actorToDelete = deleteActorId ? actors.find(a => a.id === deleteActorId) : null;
  const scenarioToDelete = deleteScenarioId ? scenarios.find(s => s.id === deleteScenarioId) : null;

  const renderActorCell = useCallback((colId: string, actor: GrcThreatActor) => {
    const typeColor = ACTOR_TYPE_COLORS[actor.type];
    const resColor = RESOURCE_COLORS[actor.resourceLevel];
    switch (colId) {
      case 'name':
        return (
          <TextField size="small" value={actor.name} variant="standard"
            sx={{ minWidth: 140 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value.trim()) updateActor(actor.id, { name: e.target.value });
            }} />
        );
      case 'type':
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44`
          }}>
            {actorTypeLabels[actor.type]}
          </Box>
        );
      case 'capability':
        return <Typography variant="body2">{actor.capabilityLevel}/5 {capabilityLabel(actor.capabilityLevel)}</Typography>;
      case 'resources':
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: resColor + '22', color: resColor
          }}>
            {resourceLabels[actor.resourceLevel]}
          </Box>
        );
      case 'motivation':
        return (
          <TextField size="small" value={actor.motivation} variant="standard"
            sx={{ minWidth: 120, maxWidth: 200 }}
            InputProps={{ disableUnderline: true, sx: { fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActor(actor.id, { motivation: e.target.value })} />
        );
      case 'targetedAssets': {
        const count = actor.targetedAssetIds.length;
        return count > 0
          ? <Tooltip title={actor.targetedAssetIds.map(id => assets.find(a => a.id === id)?.name || id).join(', ')} arrow>
              <Chip size="small" label={`${count} asset${count !== 1 ? 's' : ''}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'targetedDomains': {
        const domains = actor.targetedAssetDomains || [];
        return domains.length > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {domains.map(d => <Chip key={d} size="small" label={domainLabels[d]} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />)}
            </Box>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'linkedScenarios': {
        const linked = scenariosByActorId.get(actor.id) || [];
        return linked.length > 0
          ? <Tooltip title={linked.map(s => s.title).join(', ')} arrow>
              <Chip size="small" label={`${linked.length}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'linkedRisks': {
        const linked = risksByActorId.get(actor.id) || [];
        return linked.length > 0
          ? <Tooltip title={linked.map(r => r.title).join(', ')} arrow>
              <Chip size="small" label={`${linked.length}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'linkedAssessments': {
        const linked = assessmentsByActorId.get(actor.id) || [];
        return linked.length > 0
          ? <Tooltip title={linked.map(a => a.title).join(', ')} arrow>
              <Chip size="small" label={`${linked.length}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'tags': {
        const tags = actor.tags || [];
        return tags.length > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {tags.slice(0, 3).map(t => <Chip key={t} size="small" label={t} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />)}
              {tags.length > 3 && <Chip size="small" label={`+${tags.length - 3}`} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />}
            </Box>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'actions':
        return (
          <Tooltip title="Delete this threat actor" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteActorId(actor.id); }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default: return null;
    }
  }, [updateActor, assets, scenariosByActorId, risksByActorId, assessmentsByActorId]);

  const renderActorExpanded = useCallback((actor: GrcThreatActor) => {
    const linkedScenarios = scenariosByActorId.get(actor.id) || [];
    const linkedRisks = risksByActorId.get(actor.id) || [];
    const linkedAssessments = assessmentsByActorId.get(actor.id) || [];
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', overflow: 'hidden' }}>
          <Box sx={{ flex: 3, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Description</Typography>
            <TextField size="small" fullWidth multiline minRows={6} maxRows={12}
              value={actor.description || ''} placeholder="Detailed description of this threat actor"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActor(actor.id, { description: e.target.value || undefined })} />
          </Box>
          <Box sx={{ flex: 2, minWidth: 200, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', alignContent: 'start', overflow: 'hidden' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Type</Typography>
          <TextField size="small" fullWidth select value={actor.type}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActor(actor.id, { type: e.target.value as GrcThreatActorType })}>
            {(Object.keys(actorTypeLabels) as GrcThreatActorType[]).map(k => <MenuItem key={k} value={k}>{actorTypeLabels[k]}</MenuItem>)}
          </TextField>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Resource Level</Typography>
          <TextField size="small" fullWidth select value={actor.resourceLevel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActor(actor.id, { resourceLevel: e.target.value as GrcThreatActorResourceLevel })}>
            {(Object.keys(resourceLabels) as GrcThreatActorResourceLevel[]).map(k => <MenuItem key={k} value={k}>{resourceLabels[k]}</MenuItem>)}
          </TextField>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Capability Level: {actor.capabilityLevel}/5 ({capabilityLabel(actor.capabilityLevel)})
          </Typography>
          <TextField size="small" fullWidth select value={actor.capabilityLevel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActor(actor.id, { capabilityLevel: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>{v} – {capabilityLabel(v)}</MenuItem>)}
          </TextField>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Tags</Typography>
          <TextField size="small" fullWidth value={(actor.tags || []).join(', ')} placeholder="Comma-separated tags"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              updateActor(actor.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) });
            }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Targeted Assets</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Assets</InputLabel>
            <Select multiple value={actor.targetedAssetIds}
              onChange={e => updateActor(actor.id, { targetedAssetIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
              input={<OutlinedInput label="Assets" />}
              renderValue={sel => (sel as string[]).map(id => assets.find(a => a.id === id)?.name || id).join(', ')}>
              {assets.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Targeted Domains</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Domains</InputLabel>
            <Select multiple value={actor.targetedAssetDomains || []}
              onChange={e => updateActor(actor.id, { targetedAssetDomains: typeof e.target.value === 'string' ? e.target.value.split(',') as GrcAssetDomain[] : e.target.value as GrcAssetDomain[] })}
              input={<OutlinedInput label="Domains" />}
              renderValue={sel => (sel as string[]).map(d => domainLabels[d as GrcAssetDomain] || d).join(', ')}>
              {ALL_DOMAINS.map(d => <MenuItem key={d} value={d}>{domainLabels[d]}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        {linkedScenarios.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Scenarios</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {linkedScenarios.map(s => <Tooltip key={s.id} title={s.description || s.title} arrow><Chip size="small" label={s.title} variant="outlined" /></Tooltip>)}
            </Box>
          </Box>
        )}
        {linkedRisks.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Risks</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {linkedRisks.map(r => <Tooltip key={r.id} title={r.description || r.title} arrow><Chip size="small" label={r.title} variant="outlined" /></Tooltip>)}
            </Box>
          </Box>
        )}
        {linkedAssessments.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assessments</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {linkedAssessments.map(a => <Chip key={a.id} size="small" label={a.title} variant="outlined" />)}
            </Box>
          </Box>
        )}
          </Box>
        </Box>
        <Typography variant="caption" color="text.disabled">
          Created: {new Date(actor.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          {actor.updatedAt && ` | Updated: ${new Date(actor.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </Typography>
      </Box>
    );
  }, [updateActor, assets, scenariosByActorId, risksByActorId, assessmentsByActorId]);

  const renderScenarioCell = useCallback((colId: string, scenario: GrcThreatScenario) => {
    switch (colId) {
      case 'title':
        return (
          <TextField size="small" value={scenario.title} variant="standard"
            sx={{ minWidth: 160 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value.trim()) updateScenario(scenario.id, { title: e.target.value });
            }} />
        );
      case 'actor': {
        const actor = actors.find(a => a.id === scenario.threatActorId);
        return (
          <TextField size="small" select value={scenario.threatActorId} variant="standard"
            InputProps={{ disableUnderline: true }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScenario(scenario.id, { threatActorId: e.target.value })}>
            <MenuItem value=""><em>None</em></MenuItem>
            {actors.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </TextField>
        );
      }
      case 'techniques': {
        const techs = scenario.attackTechniques;
        if (techs.length === 0) return <Typography variant="caption" color="text.disabled">—</Typography>;
        const shown = techs.slice(0, 3);
        const overflow = techs.length - 3;
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
            {shown.map(t => <Chip key={t} size="small" label={t.length > 25 ? t.slice(0, 25) + '…' : t} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />)}
            {overflow > 0 && <Chip size="small" label={`+${overflow} more`} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />}
          </Box>
        );
      }
      case 'targetedAssets': {
        const count = scenario.targetedAssetIds.length;
        return count > 0
          ? <Tooltip title={scenario.targetedAssetIds.map(id => assets.find(a => a.id === id)?.name || id).join(', ')} arrow>
              <Chip size="small" label={`${count} asset${count !== 1 ? 's' : ''}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'linkedRisks': {
        const count = scenario.linkedRiskIds.length;
        return count > 0
          ? <Tooltip title={scenario.linkedRiskIds.map(id => risks.find(r => r.id === id)?.title || id).join(', ')} arrow>
              <Chip size="small" label={`${count}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'linkedAssessments': {
        const linked = scenario.linkedAssessmentIds || [];
        return linked.length > 0
          ? <Tooltip title={linked.map(id => assessments.find(a => a.id === id)?.title || id).join(', ')} arrow>
              <Chip size="small" label={`${linked.length}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'likelihood':
        return (
          <TextField size="small" value={scenario.likelihood || ''} variant="standard" placeholder="—"
            sx={{ maxWidth: 120 }}
            InputProps={{ disableUnderline: true, sx: { fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScenario(scenario.id, { likelihood: e.target.value || undefined })} />
        );
      case 'impact':
        return (
          <TextField size="small" value={scenario.impact || ''} variant="standard" placeholder="—"
            sx={{ maxWidth: 120 }}
            InputProps={{ disableUnderline: true, sx: { fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScenario(scenario.id, { impact: e.target.value || undefined })} />
        );
      case 'actions':
        return (
          <Tooltip title="Delete this scenario" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteScenarioId(scenario.id); }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default: return null;
    }
  }, [updateScenario, actors, assets, risks, assessments]);

  const renderScenarioExpanded = useCallback((scenario: GrcThreatScenario) => {
    const actor = actors.find(a => a.id === scenario.threatActorId);
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', overflow: 'hidden' }}>
          <Box sx={{ flex: 3, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Description</Typography>
            <TextField size="small" fullWidth multiline minRows={6} maxRows={12}
              value={scenario.description} placeholder="Detailed narrative of this attack scenario"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScenario(scenario.id, { description: e.target.value })} />
          </Box>
          <Box sx={{ flex: 2, minWidth: 200, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', alignContent: 'start', overflow: 'hidden' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Likelihood</Typography>
          <TextField size="small" fullWidth value={scenario.likelihood || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScenario(scenario.id, { likelihood: e.target.value || undefined })} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Impact</Typography>
          <TextField size="small" fullWidth value={scenario.impact || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScenario(scenario.id, { impact: e.target.value || undefined })} />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Attack Techniques {mitreControls.length > 0 && '(MITRE ATT&CK autocomplete available)'}
          </Typography>
          <Autocomplete
            multiple freeSolo size="small"
            options={mitreOptions}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue.trim()) return [];
              const q = inputValue.toLowerCase();
              return options.filter(o => o.toLowerCase().includes(q)).slice(0, 20);
            }}
            value={scenario.attackTechniques}
            onChange={(_e, newVal) => updateScenario(scenario.id, { attackTechniques: newVal as string[] })}
            renderTags={(value, getTagProps) =>
              value.map((opt, idx) => <Chip {...getTagProps({ index: idx })} key={opt} size="small" label={opt} variant="outlined" />)
            }
            renderInput={(params) => <TextField {...params} placeholder="Type technique ID or name..." />}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Targeted Assets</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Assets</InputLabel>
            <Select multiple value={scenario.targetedAssetIds}
              onChange={e => updateScenario(scenario.id, { targetedAssetIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
              input={<OutlinedInput label="Assets" />}
              renderValue={sel => (sel as string[]).map(id => assets.find(a => a.id === id)?.name || id).join(', ')}>
              {assets.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Risks</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Risks</InputLabel>
            <Select multiple value={scenario.linkedRiskIds}
              onChange={e => updateScenario(scenario.id, { linkedRiskIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
              input={<OutlinedInput label="Risks" />}
              renderValue={sel => (sel as string[]).map(id => risks.find(r => r.id === id)?.title || id).join(', ')}>
              {risks.map(r => <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assessments</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Assessments</InputLabel>
            <Select multiple value={scenario.linkedAssessmentIds || []}
              onChange={e => updateScenario(scenario.id, { linkedAssessmentIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
              input={<OutlinedInput label="Assessments" />}
              renderValue={sel => (sel as string[]).map(id => assessments.find(a => a.id === id)?.title || id).join(', ')}>
              {assessments.map(a => <MenuItem key={a.id} value={a.id}>{a.title}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        {actor && (
          <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Actor Summary</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{actor.name}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box component="span" sx={{
                px: 0.75, py: 0.125, borderRadius: 1, fontSize: '0.7rem', fontWeight: 600,
                bgcolor: ACTOR_TYPE_COLORS[actor.type] + '22', color: ACTOR_TYPE_COLORS[actor.type]
              }}>
                {actorTypeLabels[actor.type]}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Cap: {actor.capabilityLevel}/5 | Res: {resourceLabels[actor.resourceLevel]}
              </Typography>
            </Box>
          </Box>
        )}
          </Box>
        </Box>
        <Typography variant="caption" color="text.disabled">
          Created: {new Date(scenario.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          {scenario.updatedAt && ` | Updated: ${new Date(scenario.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </Typography>
      </Box>
    );
  }, [updateScenario, actors, assets, risks, assessments, mitreControls.length, mitreOptions]);

  if (actors.length === 0 && scenarios.length === 0 && !showActorForm && !showScenarioForm) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <Shield size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>No threat actors registered yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 1, lineHeight: 1.8 }}>
            Define the adversaries relevant to your organisation. Threat actors model the capability,
            resources, and motivation of potential attackers so risks and scenarios can be linked to
            real-world threat intelligence.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3, lineHeight: 1.8 }}>
            After registering actors, create threat scenarios that map attack techniques (MITRE ATT&CK)
            to targeted assets and link them to your risk register.
          </Typography>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowActorForm(true)}>
            Add First Actor
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* ACTORS SECTION */}
      <Paper sx={cardSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>Threat Actors</Typography>
            <Typography variant="body2" color="text.secondary">
              Adversary profiles with capability, resources, and motivation.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} size="small"
            onClick={() => setShowActorForm(!showActorForm)}>
            Add Actor
          </Button>
        </Box>

        <Collapse in={showActorForm} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
              <TextField size="small" label="Actor Name" value={newActorName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActorName(e.target.value)} />
              <TextField size="small" select label="Type" value={newActorType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActorType(e.target.value as GrcThreatActorType)}>
                {(Object.keys(actorTypeLabels) as GrcThreatActorType[]).map(k => <MenuItem key={k} value={k}>{actorTypeLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Capability" value={newActorCapability}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActorCapability(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>{v} – {capabilityLabel(v)}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Resource Level" value={newActorResource}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActorResource(e.target.value as GrcThreatActorResourceLevel)}>
                {(Object.keys(resourceLabels) as GrcThreatActorResourceLevel[]).map(k => <MenuItem key={k} value={k}>{resourceLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Motivation" value={newActorMotivation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActorMotivation(e.target.value)} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setShowActorForm(false)}>Cancel</Button>
              <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={handleAddActor}
                disabled={!newActorName.trim()}>Add Actor</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {actors.length > 0 && (
        <TableContainer component={Paper} sx={{ ...cardSx, overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField size="small" placeholder="Search actors..." value={actorSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActorSearch(e.target.value)} sx={{ minWidth: 180 }} />
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Type:</Typography>
              <Chip size="small" label="All"
                variant={actorTypeFilter === 'all' ? 'filled' : 'outlined'}
                color={actorTypeFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setActorTypeFilter('all')} />
              {(Object.keys(actorTypeLabels) as GrcThreatActorType[]).map(k => (
                <Chip key={k} size="small" label={actorTypeLabels[k]}
                  variant={actorTypeFilter === k ? 'filled' : 'outlined'}
                  color={actorTypeFilter === k ? 'primary' : 'default'}
                  onClick={() => setActorTypeFilter(k)} />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {sortedActors.length} of {actors.length} actors
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }}><Box sx={{ width: 28 }} /></TableCell>
                {actorColumnConfig.visibleColumns.map(col => (
                  <TableCell key={col.id}>
                    {ACTOR_SORTABLE.has(col.id) ? (
                      <TableSortLabel active={actorSort === col.id}
                        direction={actorSort === col.id ? actorSortDir : 'asc'}
                        onClick={() => handleActorSort(col.id)}>
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
                <TableCell padding="none" sx={{ width: 40 }}>
                  <TableColumnConfigPopover
                    allColumns={actorColumnConfig.allColumns}
                    visibleIds={actorColumnConfig.visibleIds}
                    onToggle={actorColumnConfig.toggleColumn}
                    onMove={actorColumnConfig.moveColumn}
                    onReset={actorColumnConfig.resetToDefaults} />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedActors.map(actor => {
                const isExpanded = expandedActorId === actor.id;
                return (
                  <React.Fragment key={actor.id}>
                    <TableRow id={`grc-actor-${actor.id}`} hover sx={{
                      cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                      ...(highlightId === actor.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                    }}
                      onClick={() => setExpandedActorId(isExpanded ? null : actor.id)}>
                      <TableCell padding="checkbox">
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                      </TableCell>
                      {actorColumnConfig.visibleColumns.map(col => (
                        <TableCell key={col.id} onClick={e => {
                          if (['name', 'motivation'].includes(col.id)) e.stopPropagation();
                        }}>
                          {renderActorCell(col.id, actor)}
                        </TableCell>
                      ))}
                      <TableCell padding="none" />
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={actorColumnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderActorExpanded(actor)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {sortedActors.length === 0 && actors.length > 0 && (
                <TableRow>
                  <TableCell colSpan={actorColumnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No actors match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* SCENARIOS SECTION */}
      {actors.length === 0 && scenarios.length === 0 && !showScenarioForm ? null : (
        <>
          <Paper sx={cardSx}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ mb: 0.5 }}>Threat Scenarios</Typography>
                <Typography variant="body2" color="text.secondary">
                  Attack scenarios linking actors, techniques, and targeted assets.
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<Plus size={16} />} size="small"
                onClick={() => setShowScenarioForm(!showScenarioForm)}>
                Add Scenario
              </Button>
            </Box>

            <Collapse in={showScenarioForm} timeout="auto" unmountOnExit>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, display: 'grid', gap: 1.5 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
                  <TextField size="small" label="Scenario Title" value={newScenarioTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScenarioTitle(e.target.value)} />
                  <TextField size="small" select label="Threat Actor" value={newScenarioActorId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScenarioActorId(e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {actors.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                  </TextField>
                </Box>
                <TextField size="small" label="Description" value={newScenarioDescription}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScenarioDescription(e.target.value)}
                  fullWidth multiline minRows={2} />
                <Autocomplete
                  multiple freeSolo size="small"
                  options={mitreOptions}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue.trim()) return [];
                    const q = inputValue.toLowerCase();
                    return options.filter(o => o.toLowerCase().includes(q)).slice(0, 20);
                  }}
                  value={newScenarioTechniques}
                  onChange={(_e, newVal) => setNewScenarioTechniques(newVal as string[])}
                  renderTags={(value, getTagProps) =>
                    value.map((opt, idx) => <Chip {...getTagProps({ index: idx })} key={opt} size="small" label={opt} variant="outlined" />)
                  }
                  renderInput={(params) => <TextField {...params} label="Attack Techniques" placeholder="Type technique ID or name..." />}
                />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={() => setShowScenarioForm(false)}>Cancel</Button>
                  <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={handleAddScenario}
                    disabled={!newScenarioTitle.trim()}>Add Scenario</Button>
                </Box>
              </Box>
            </Collapse>
          </Paper>

          {scenarios.length === 0 && !showScenarioForm && (
            <Paper sx={{ ...cardSx, textAlign: 'center', py: 4 }}>
              <Zap size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>No threat scenarios documented yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 2, lineHeight: 1.8 }}>
                Create scenarios to map attack techniques to targeted assets and link them to your risk register.
                Use MITRE ATT&CK technique IDs when control frameworks are loaded.
              </Typography>
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowScenarioForm(true)}>
                Add First Scenario
              </Button>
            </Paper>
          )}

          {scenarios.length > 0 && (
            <TableContainer component={Paper} sx={{ ...cardSx, overflow: 'hidden' }}>
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <TextField size="small" placeholder="Search scenarios..." value={scenarioSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScenarioSearch(e.target.value)} sx={{ minWidth: 180 }} />
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Actor:</Typography>
                  <Chip size="small" label="All"
                    variant={scenarioActorFilter === 'all' ? 'filled' : 'outlined'}
                    color={scenarioActorFilter === 'all' ? 'primary' : 'default'}
                    onClick={() => setScenarioActorFilter('all')} />
                  {actors.map(a => (
                    <Chip key={a.id} size="small" label={a.name}
                      variant={scenarioActorFilter === a.id ? 'filled' : 'outlined'}
                      color={scenarioActorFilter === a.id ? 'primary' : 'default'}
                      onClick={() => setScenarioActorFilter(a.id)} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {sortedScenarios.length} of {scenarios.length} scenarios
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ width: 40 }}><Box sx={{ width: 28 }} /></TableCell>
                    {scenarioColumnConfig.visibleColumns.map(col => (
                      <TableCell key={col.id}>
                        {SCENARIO_SORTABLE.has(col.id) ? (
                          <TableSortLabel active={scenarioSort === col.id}
                            direction={scenarioSort === col.id ? scenarioSortDir : 'asc'}
                            onClick={() => handleScenarioSort(col.id)}>
                            {col.label}
                          </TableSortLabel>
                        ) : col.label}
                      </TableCell>
                    ))}
                    <TableCell padding="none" sx={{ width: 40 }}>
                      <TableColumnConfigPopover
                        allColumns={scenarioColumnConfig.allColumns}
                        visibleIds={scenarioColumnConfig.visibleIds}
                        onToggle={scenarioColumnConfig.toggleColumn}
                        onMove={scenarioColumnConfig.moveColumn}
                        onReset={scenarioColumnConfig.resetToDefaults} />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedScenarios.map(scenario => {
                    const isExpanded = expandedScenarioId === scenario.id;
                    return (
                      <React.Fragment key={scenario.id}>
                        <TableRow id={`grc-scenario-${scenario.id}`} hover sx={{
                          cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                          ...(highlightId === scenario.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                        }}
                          onClick={() => setExpandedScenarioId(isExpanded ? null : scenario.id)}>
                          <TableCell padding="checkbox">
                            <IconButton size="small" sx={{ p: 0.25 }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </IconButton>
                          </TableCell>
                          {scenarioColumnConfig.visibleColumns.map(col => (
                            <TableCell key={col.id} onClick={e => {
                              if (['title', 'actor', 'likelihood', 'impact'].includes(col.id)) e.stopPropagation();
                            }}>
                              {renderScenarioCell(col.id, scenario)}
                            </TableCell>
                          ))}
                          <TableCell padding="none" />
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={scenarioColumnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                {renderScenarioExpanded(scenario)}
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {sortedScenarios.length === 0 && scenarios.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={scenarioColumnConfig.visibleColumns.length + 2}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No scenarios match the current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* DELETE DIALOGS */}
      <Dialog open={Boolean(actorToDelete)} onClose={() => setDeleteActorId(null)}>
        <DialogTitle>Delete Threat Actor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{actorToDelete?.name}"? Linked scenarios will lose their actor reference and linked risks/assessments will be unlinked.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteActorId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteActorId && handleDeleteActor(deleteActorId)}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(scenarioToDelete)} onClose={() => setDeleteScenarioId(null)}>
        <DialogTitle>Delete Threat Scenario</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete scenario "{scenarioToDelete?.title}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteScenarioId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteScenarioId && handleDeleteScenario(deleteScenarioId)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcThreatProfileTab;
