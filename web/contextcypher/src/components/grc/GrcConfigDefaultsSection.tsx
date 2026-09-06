import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import {
  assessmentScopeTypeLabels,
  buildRiskMatrix,
  getAIAssistConfig,
  getConfig,
  rescoreRisks
} from '../../services/GrcWorkspaceService';
import {
  AssessmentScopeType,
  GrcAssetCriticalityLevel,
  GrcAssetDomain,
  GrcProtocolOsiMapping,
  GrcWorkspaceConfig,
  RiskRatingBand
} from '../../types/GrcTypes';
import { downloadText, GrcTabProps } from './grcShared';

const MIN_RATING_BANDS = 2;
const MAX_RATING_BANDS = 10;
const MIN_ASSET_CRITICALITY_LEVELS = 2;
const MAX_ASSET_CRITICALITY_LEVELS = 10;

const clampThreshold = (value: number): number => Math.min(1, Math.max(0, value));

const fallbackBandColor = '#64748b';

const createRatingBandId = (): string => `rating-band-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type RatingPresetId = 'default6' | 'balanced5' | 'compact4';

interface RatingPreset {
  id: RatingPresetId;
  label: string;
  description: string;
  bands: Array<Omit<RiskRatingBand, 'id'>>;
}

const ratingPresets: RatingPreset[] = [
  {
    id: 'default6',
    label: 'Default 6-Level',
    description: 'Catastrophic to Negligible (recommended baseline)',
    bands: [
      { label: 'Catastrophic', value: 6, minScoreRatio: 0.90, color: '#7f1d1d' },
      { label: 'Severe', value: 5, minScoreRatio: 0.75, color: '#b91c1c' },
      { label: 'Major', value: 4, minScoreRatio: 0.60, color: '#ea580c' },
      { label: 'Moderate', value: 3, minScoreRatio: 0.45, color: '#d97706' },
      { label: 'Minor', value: 2, minScoreRatio: 0.25, color: '#65a30d' },
      { label: 'Negligible', value: 1, minScoreRatio: 0.00, color: '#16a34a' }
    ]
  },
  {
    id: 'balanced5',
    label: 'Balanced 5-Level',
    description: 'Critical, High, Medium, Low, Minimal',
    bands: [
      { label: 'Critical', value: 5, minScoreRatio: 0.85, color: '#991b1b' },
      { label: 'High', value: 4, minScoreRatio: 0.65, color: '#dc2626' },
      { label: 'Medium', value: 3, minScoreRatio: 0.45, color: '#d97706' },
      { label: 'Low', value: 2, minScoreRatio: 0.25, color: '#65a30d' },
      { label: 'Minimal', value: 1, minScoreRatio: 0.00, color: '#16a34a' }
    ]
  },
  {
    id: 'compact4',
    label: 'Compact 4-Level',
    description: 'Extreme, High, Medium, Low for simplified scoring',
    bands: [
      { label: 'Extreme', value: 4, minScoreRatio: 0.80, color: '#7f1d1d' },
      { label: 'High', value: 3, minScoreRatio: 0.55, color: '#dc2626' },
      { label: 'Medium', value: 2, minScoreRatio: 0.30, color: '#d97706' },
      { label: 'Low', value: 1, minScoreRatio: 0.00, color: '#16a34a' }
    ]
  }
];

const toPresetBands = (bands: Array<Omit<RiskRatingBand, 'id'>>): RiskRatingBand[] =>
  bands.map(item => ({
    ...item,
    id: createRatingBandId()
  }));

const normalizeBandsForSave = (bands: RiskRatingBand[]): RiskRatingBand[] =>
  bands
    .map((band, index) => ({
      id: band.id || `rating-band-${index + 1}`,
      label: band.label.trim() || `Rating ${index + 1}`,
      value: Math.max(1, Math.round(Number(band.value) || index + 1)),
      minScoreRatio: clampThreshold(Number(band.minScoreRatio) || 0),
      color: band.color?.trim() || fallbackBandColor
    }))
    .sort((a, b) => b.minScoreRatio - a.minScoreRatio || b.value - a.value);

const deriveLegacyRatingSettings = (normalizedBands: RiskRatingBand[]) => {
  const criticalThreshold = clampThreshold(normalizedBands[0]?.minScoreRatio ?? 0.75);
  const highThresholdRaw = clampThreshold(normalizedBands[Math.min(1, normalizedBands.length - 1)]?.minScoreRatio ?? 0.50);
  const mediumThresholdRaw = clampThreshold(
    normalizedBands[Math.min(Math.max(2, Math.floor(normalizedBands.length / 2)), normalizedBands.length - 1)]?.minScoreRatio ?? 0.25
  );
  const highThreshold = Math.max(0, Math.min(highThresholdRaw, criticalThreshold - 0.01));
  const mediumThreshold = Math.max(0, Math.min(mediumThresholdRaw, highThreshold - 0.01));

  const ratingThresholds = {
    criticalThreshold,
    highThreshold,
    mediumThreshold
  };

  const ratingColors = {
    critical: normalizedBands[0]?.color || fallbackBandColor,
    high: normalizedBands[Math.min(1, normalizedBands.length - 1)]?.color || fallbackBandColor,
    medium:
      normalizedBands[Math.min(Math.max(2, Math.floor(normalizedBands.length / 2)), normalizedBands.length - 1)]?.color || fallbackBandColor,
    low: normalizedBands[normalizedBands.length - 1]?.color || fallbackBandColor,
    unrated: '#64748b'
  };

  return { ratingThresholds, ratingColors };
};

const domainOptions: Array<{ value: GrcAssetDomain; label: string }> = [
  { value: 'it', label: 'IT' },
  { value: 'ot', label: 'OT' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'iot', label: 'IoT' },
  { value: 'application', label: 'Application' },
  { value: 'data', label: 'Data' },
  { value: 'network', label: 'Network' },
  { value: 'physical', label: 'Physical' },
  { value: 'people', label: 'People' }
];

const assessmentScopeTypeOptions: AssessmentScopeType[] = [
  'system',
  'diagram',
  'diagram_segment',
  'asset_group',
  'application',
  'osi_layer'
];

const normalizeAssetCriticalityScaleForSave = (
  scale: GrcAssetCriticalityLevel[]
): GrcAssetCriticalityLevel[] => {
  const parsed = scale
    .map((level, index) => ({
      value: Math.max(1, Math.round(Number(level.value) || index + 1)),
      label: level.label.trim() || `Level ${index + 1}`
    }))
    .filter(level => level.label.length > 0);

  const deduped = new Map<number, GrcAssetCriticalityLevel>();
  parsed.forEach(level => {
    if (!deduped.has(level.value)) {
      deduped.set(level.value, level);
    }
  });
  return Array.from(deduped.values()).sort((a, b) => a.value - b.value);
};

const normalizeAssetCategoriesForSave = (categories: GrcWorkspaceConfig['assetCategories']): GrcWorkspaceConfig['assetCategories'] => {
  const normalizeList = (values: string[]): string[] =>
    Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));

  return {
    it: normalizeList(categories.it),
    ot: normalizeList(categories.ot),
    cloud: normalizeList(categories.cloud),
    iot: normalizeList(categories.iot),
    application: normalizeList(categories.application),
    data: normalizeList(categories.data),
    network: normalizeList(categories.network),
    physical: normalizeList(categories.physical),
    people: normalizeList(categories.people)
  };
};

const normalizeScopeOptionsForSave = (values: string[]): string[] =>
  Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));

const parseProtocolOsiMappingsFromText = (value: string): GrcProtocolOsiMapping[] => {
  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const mappings: GrcProtocolOsiMapping[] = [];
  const seen = new Set<string>();
  lines.forEach(line => {
    const [protocolRaw, layerRaw] = line.split('=>').map(part => part.trim());
    if (!protocolRaw || !layerRaw) {
      return;
    }
    const key = protocolRaw.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    mappings.push({ protocol: protocolRaw, osiLayer: layerRaw });
  });
  return mappings;
};

const protocolOsiMappingsToText = (mappings: GrcProtocolOsiMapping[]): string =>
  mappings.map(mapping => `${mapping.protocol} => ${mapping.osiLayer}`).join('\n');

const GrcConfigDefaultsSection: React.FC<GrcTabProps> = ({ workspace, applyWorkspace, setStatusMessage }) => {
  const config = getConfig(workspace);

  const [ratingBands, setRatingBands] = useState<RiskRatingBand[]>(config.ratingBands);
  const [assetCategories, setAssetCategories] = useState(config.assetCategories);
  const [assetCriticalityScale, setAssetCriticalityScale] = useState<GrcAssetCriticalityLevel[]>(config.assetCriticalityScale);
  const [assessmentScopes, setAssessmentScopes] = useState(config.assessmentScopes);
  const [protocolOsiMapText, setProtocolOsiMapText] = useState(protocolOsiMappingsToText(config.assessmentScopes.protocolOsiMappings));
  const [defaults, setDefaults] = useState(config.recordDefaults);
  const [soaLabels, setSoaLabels] = useState(config.soaLabels);
  const [exportFilenames, setExportFilenames] = useState(config.exportFilenames);
  const [aiAssist, setAIAssist] = useState(getAIAssistConfig(workspace));
  const [businessUnits, setBusinessUnits] = useState<string[]>(config.businessUnits || []);
  const [newBusinessUnit, setNewBusinessUnit] = useState('');
  const [maturityLevels, setMaturityLevels] = useState<Array<{level: number; label: string}>>(
    config.maturityModels?.[0]?.levels?.map(l => ({ level: l.level, label: l.label })) ??
    [
      { level: 1, label: 'Initial' },
      { level: 2, label: 'Managed' },
      { level: 3, label: 'Defined' },
      { level: 4, label: 'Quantitatively Managed' },
      { level: 5, label: 'Optimizing' }
    ]
  );
  const [selectedPresetId, setSelectedPresetId] = useState<RatingPresetId>('default6');
  const [pendingPresetId, setPendingPresetId] = useState<RatingPresetId | null>(null);
  const [isPresetConfirmOpen, setIsPresetConfirmOpen] = useState(false);
  const skipWorkspaceSyncRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (skipWorkspaceSyncRef.current) {
      skipWorkspaceSyncRef.current = false;
      return;
    }
    const c = getConfig(workspace);
    setRatingBands(c.ratingBands);
    setAssetCategories(c.assetCategories);
    setAssetCriticalityScale(c.assetCriticalityScale);
    setAssessmentScopes(c.assessmentScopes);
    setProtocolOsiMapText(protocolOsiMappingsToText(c.assessmentScopes.protocolOsiMappings));
    setDefaults(c.recordDefaults);
    setSoaLabels(c.soaLabels);
    setExportFilenames(c.exportFilenames);
    setAIAssist(getAIAssistConfig(workspace));
    setBusinessUnits(c.businessUnits || []);
    setMaturityLevels(
      c.maturityModels?.[0]?.levels?.map(l => ({ level: l.level, label: l.label })) ??
      [
        { level: 1, label: 'Initial' },
        { level: 2, label: 'Managed' },
        { level: 3, label: 'Defined' },
        { level: 4, label: 'Quantitatively Managed' },
        { level: 5, label: 'Optimizing' }
      ]
    );
  }, [workspace]);

  const orderedPreviewBands = useMemo(
    () => [...ratingBands].sort((a, b) => b.minScoreRatio - a.minScoreRatio || b.value - a.value),
    [ratingBands]
  );
  const selectedPreset = useMemo(
    () => ratingPresets.find(item => item.id === selectedPresetId) || ratingPresets[0],
    [selectedPresetId]
  );
  const orderedAssetCriticalityScale = useMemo(
    () => [...assetCriticalityScale].sort((a, b) => a.value - b.value),
    [assetCriticalityScale]
  );
  const categoryOptionsForDefaultDomain = useMemo(
    () => assetCategories[defaults.assetDomain] || [],
    [assetCategories, defaults.assetDomain]
  );
  const enabledScopeTypeSet = useMemo(
    () => new Set(assessmentScopes.enabledTypes),
    [assessmentScopes.enabledTypes]
  );

  useEffect(() => {
    if (categoryOptionsForDefaultDomain.length === 0) {
      return;
    }
    if (!categoryOptionsForDefaultDomain.includes(defaults.assetCategory)) {
      setDefaults(current => ({
        ...current,
        assetCategory: categoryOptionsForDefaultDomain[0]
      }));
    }
  }, [categoryOptionsForDefaultDomain, defaults.assetCategory]);

  useEffect(() => {
    if (enabledScopeTypeSet.has(defaults.assessmentScopeType)) {
      return;
    }
    const fallback = assessmentScopes.enabledTypes[0] || 'system';
    setDefaults(current => ({
      ...current,
      assessmentScopeType: fallback
    }));
  }, [assessmentScopes.enabledTypes, defaults.assessmentScopeType, enabledScopeTypeSet]);

  const handleAddRatingBand = useCallback(() => {
    setRatingBands(current => {
      if (current.length >= MAX_RATING_BANDS) {
        setStatusMessage({ severity: 'warning', text: `Rating levels cannot exceed ${MAX_RATING_BANDS}.` });
        return current;
      }
      const highestValue = Math.max(...current.map(item => Number(item.value) || 0), 0);
      return [
        ...current,
        {
          id: createRatingBandId(),
          label: `Rating ${current.length + 1}`,
          value: highestValue + 1,
          minScoreRatio: 0.2,
          color: fallbackBandColor
        }
      ];
    });
  }, [setStatusMessage]);

  const handleRemoveRatingBand = useCallback((index: number) => {
    setRatingBands(current => {
      if (current.length <= MIN_RATING_BANDS) {
        setStatusMessage({ severity: 'warning', text: `At least ${MIN_RATING_BANDS} rating levels are required.` });
        return current;
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }, [setStatusMessage]);

  const handleAddAssetCriticalityLevel = useCallback(() => {
    setAssetCriticalityScale(current => {
      if (current.length >= MAX_ASSET_CRITICALITY_LEVELS) {
        setStatusMessage({ severity: 'warning', text: `Asset criticality levels cannot exceed ${MAX_ASSET_CRITICALITY_LEVELS}.` });
        return current;
      }
      const highestValue = Math.max(...current.map(item => Number(item.value) || 0), 0);
      return [...current, { value: highestValue + 1, label: `Level ${current.length + 1}` }];
    });
  }, [setStatusMessage]);

  const handleRemoveAssetCriticalityLevel = useCallback((index: number) => {
    setAssetCriticalityScale(current => {
      if (current.length <= MIN_ASSET_CRITICALITY_LEVELS) {
        setStatusMessage({
          severity: 'warning',
          text: `At least ${MIN_ASSET_CRITICALITY_LEVELS} asset criticality levels are required.`
        });
        return current;
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }, [setStatusMessage]);

  const handleRequestApplyPreset = useCallback(() => {
    setPendingPresetId(selectedPreset.id);
    setIsPresetConfirmOpen(true);
  }, [selectedPreset.id]);

  const handleCancelPresetApply = useCallback(() => {
    setIsPresetConfirmOpen(false);
    setPendingPresetId(null);
  }, []);

  const handleConfirmPresetApply = useCallback(() => {
    const preset = ratingPresets.find(item => item.id === pendingPresetId);
    if (!preset) {
      setIsPresetConfirmOpen(false);
      setPendingPresetId(null);
      return;
    }

    const normalizedBands = normalizeBandsForSave(toPresetBands(preset.bands));
    const { ratingThresholds, ratingColors } = deriveLegacyRatingSettings(normalizedBands);
    const currentConfig = getConfig(workspace);
    const nextConfig: GrcWorkspaceConfig = {
      ...currentConfig,
      ratingBands: normalizedBands,
      ratingThresholds,
      ratingColors
    };

    const nextWorkspace = rescoreRisks({
      ...workspace,
      riskModel: {
        ...workspace.riskModel,
        matrix: buildRiskMatrix(
          workspace.riskModel.likelihoodScale,
          workspace.riskModel.impactScale,
          workspace.riskModel.appetiteThresholdScore,
          nextConfig
        )
      },
      config: nextConfig
    });

    skipWorkspaceSyncRef.current = true;
    applyWorkspace(nextWorkspace);
    setRatingBands(normalizedBands);
    setIsPresetConfirmOpen(false);
    setPendingPresetId(null);
    setStatusMessage({
      severity: 'info',
      text: `Applied "${preset.label}" preset and updated the matrix preview.`
    });
  }, [applyWorkspace, pendingPresetId, setStatusMessage, workspace]);

  const handleExportConfig = useCallback(async () => {
    const configToExport = getConfig(workspace);
    if (!await downloadText('grc-config.json', JSON.stringify(configToExport, null, 2), 'application/json')) return;
    setStatusMessage({ severity: 'info', text: 'Configuration exported.' });
  }, [workspace, setStatusMessage]);

  const handleImportConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed || typeof parsed !== 'object' || !parsed.ratingBands) {
          setStatusMessage({ severity: 'error', text: 'Invalid configuration file: missing ratingBands.' });
          return;
        }
        const nextWorkspace = rescoreRisks({
          ...workspace,
          riskModel: {
            ...workspace.riskModel,
            matrix: buildRiskMatrix(
              workspace.riskModel.likelihoodScale,
              workspace.riskModel.impactScale,
              workspace.riskModel.appetiteThresholdScore,
              parsed as GrcWorkspaceConfig
            )
          },
          config: parsed as GrcWorkspaceConfig
        });
        skipWorkspaceSyncRef.current = true;
        applyWorkspace(nextWorkspace);
        setStatusMessage({ severity: 'success', text: 'Configuration imported and applied.' });
      } catch {
        setStatusMessage({ severity: 'error', text: 'Failed to parse configuration file.' });
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  }, [applyWorkspace, setStatusMessage, workspace]);

  const handleSave = useCallback(() => {
    if (ratingBands.length < MIN_RATING_BANDS || ratingBands.length > MAX_RATING_BANDS) {
      setStatusMessage({
        severity: 'warning',
        text: `Rating levels must contain ${MIN_RATING_BANDS}-${MAX_RATING_BANDS} entries.`
      });
      return;
    }

    const normalizedBands = normalizeBandsForSave(ratingBands);
    const labelSet = new Set(normalizedBands.map(item => item.label.trim().toLowerCase()));
    if (labelSet.size !== normalizedBands.length) {
      setStatusMessage({ severity: 'warning', text: 'Rating labels must be unique.' });
      return;
    }

    const valueSet = new Set(normalizedBands.map(item => item.value));
    if (valueSet.size !== normalizedBands.length) {
      setStatusMessage({ severity: 'warning', text: 'Rating numeric values must be unique.' });
      return;
    }

    for (let index = 1; index < normalizedBands.length; index += 1) {
      if (normalizedBands[index - 1].minScoreRatio <= normalizedBands[index].minScoreRatio) {
        setStatusMessage({
          severity: 'warning',
          text: 'Rating thresholds must be strictly descending from highest severity to lowest.'
        });
        return;
      }
    }

    const lowestBand = normalizedBands[normalizedBands.length - 1];
    if (Math.abs(lowestBand.minScoreRatio) > 0.0001) {
      setStatusMessage({
        severity: 'warning',
        text: 'The lowest severity threshold must be 0.00 so every score maps to a rating.'
      });
      return;
    }

    const normalizedAssetCategories = normalizeAssetCategoriesForSave(assetCategories);
    const coreDomains: Array<keyof typeof normalizedAssetCategories> = ['it', 'ot', 'application'];
    const emptyCore = coreDomains.filter(d => normalizedAssetCategories[d].length === 0);
    if (emptyCore.length > 0) {
      setStatusMessage({
        severity: 'warning',
        text: `${emptyCore.map(d => d.toUpperCase()).join(', ')} category lists must each contain at least one category.`
      });
      return;
    }

    if (assetCriticalityScale.length < MIN_ASSET_CRITICALITY_LEVELS || assetCriticalityScale.length > MAX_ASSET_CRITICALITY_LEVELS) {
      setStatusMessage({
        severity: 'warning',
        text: `Asset criticality levels must contain ${MIN_ASSET_CRITICALITY_LEVELS}-${MAX_ASSET_CRITICALITY_LEVELS} entries.`
      });
      return;
    }

    const normalizedAssetCriticalityScale = normalizeAssetCriticalityScaleForSave(assetCriticalityScale);
    if (normalizedAssetCriticalityScale.length < MIN_ASSET_CRITICALITY_LEVELS) {
      setStatusMessage({
        severity: 'warning',
        text: `At least ${MIN_ASSET_CRITICALITY_LEVELS} unique asset criticality levels are required.`
      });
      return;
    }

    const assetCriticalityLabelSet = new Set(
      normalizedAssetCriticalityScale.map(level => level.label.trim().toLowerCase())
    );
    if (assetCriticalityLabelSet.size !== normalizedAssetCriticalityScale.length) {
      setStatusMessage({ severity: 'warning', text: 'Asset criticality labels must be unique.' });
      return;
    }

    const allowedCriticalityValues = new Set(normalizedAssetCriticalityScale.map(level => level.value));
    const fallbackCriticalityValue =
      normalizedAssetCriticalityScale[Math.floor((normalizedAssetCriticalityScale.length - 1) / 2)]?.value || 3;
    const defaultCategoryOptions = normalizedAssetCategories[defaults.assetDomain] || [];
    if (defaultCategoryOptions.length === 0) {
      setStatusMessage({ severity: 'warning', text: 'Default asset domain must have at least one category.' });
      return;
    }

    const normalizedEnabledScopeTypes = Array.from(new Set(
      assessmentScopes.enabledTypes.filter(type => assessmentScopeTypeOptions.includes(type))
    ));
    if (normalizedEnabledScopeTypes.length === 0) {
      setStatusMessage({ severity: 'warning', text: 'Enable at least one assessment scope type.' });
      return;
    }

    const normalizedSystemScopeOptions = normalizeScopeOptionsForSave(assessmentScopes.systemScopeOptions);

    const normalizedApplicationScopeOptions = normalizeScopeOptionsForSave(assessmentScopes.applicationScopeOptions);
    if (normalizedApplicationScopeOptions.length === 0) {
      setStatusMessage({ severity: 'warning', text: 'Configure at least one application scope option.' });
      return;
    }

    const normalizedOsiScopeOptions = normalizeScopeOptionsForSave(assessmentScopes.osiLayerOptions);
    if (normalizedOsiScopeOptions.length === 0) {
      setStatusMessage({ severity: 'warning', text: 'Configure at least one OSI scope option.' });
      return;
    }

    const normalizedProtocolOsiMappings = parseProtocolOsiMappingsFromText(protocolOsiMapText);
    if (normalizedProtocolOsiMappings.length === 0) {
      setStatusMessage({
        severity: 'warning',
        text: 'Add at least one protocol-to-OSI mapping using the "Protocol => Layer" format.'
      });
      return;
    }

    const normalizedAssessmentScopes: GrcWorkspaceConfig['assessmentScopes'] = {
      enabledTypes: normalizedEnabledScopeTypes,
      systemScopeOptions: normalizedSystemScopeOptions,
      applicationScopeOptions: normalizedApplicationScopeOptions,
      osiLayerOptions: normalizedOsiScopeOptions,
      protocolOsiMappings: normalizedProtocolOsiMappings
    };

    const normalizedDefaultScopeType = normalizedEnabledScopeTypes.includes(defaults.assessmentScopeType)
      ? defaults.assessmentScopeType
      : normalizedEnabledScopeTypes[0];
    let normalizedDefaultScopeValue = defaults.assessmentScopeValue.trim() || defaults.assessmentScopeName.trim() || 'scope';
    if (normalizedDefaultScopeType === 'application' && normalizedApplicationScopeOptions.length > 0) {
      normalizedDefaultScopeValue = normalizedApplicationScopeOptions.includes(normalizedDefaultScopeValue)
        ? normalizedDefaultScopeValue
        : normalizedApplicationScopeOptions[0];
    }
    if (normalizedDefaultScopeType === 'osi_layer' && normalizedOsiScopeOptions.length > 0) {
      normalizedDefaultScopeValue = normalizedOsiScopeOptions.includes(normalizedDefaultScopeValue)
        ? normalizedDefaultScopeValue
        : normalizedOsiScopeOptions[0];
    }

    const normalizedDefaults = {
      ...defaults,
      assetCategory: defaultCategoryOptions.includes(defaults.assetCategory)
        ? defaults.assetCategory
        : defaultCategoryOptions[0],
      assetBusinessCriticality: allowedCriticalityValues.has(defaults.assetBusinessCriticality)
        ? defaults.assetBusinessCriticality
        : fallbackCriticalityValue,
      assetSecurityCriticality: allowedCriticalityValues.has(defaults.assetSecurityCriticality)
        ? defaults.assetSecurityCriticality
        : fallbackCriticalityValue,
      assessmentScopeType: normalizedDefaultScopeType,
      assessmentScopeValue: normalizedDefaultScopeValue,
      assessmentScopeName: defaults.assessmentScopeName.trim() || normalizedDefaultScopeValue,
      assessmentTierFilter: {
        tier1: defaults.assessmentTierFilter.tier1?.trim() || undefined,
        tier2: defaults.assessmentTierFilter.tier2?.trim() || undefined,
        tier3: defaults.assessmentTierFilter.tier3?.trim() || undefined,
        tier4: defaults.assessmentTierFilter.tier4?.trim() || undefined
      }
    };

    const { ratingThresholds, ratingColors } = deriveLegacyRatingSettings(normalizedBands);

    const maturityModelId = config.maturityModels?.[0]?.id || 'default-maturity';
    const nextConfig: GrcWorkspaceConfig = {
      ratingBands: normalizedBands,
      ratingThresholds,
      ratingColors,
      assetCategories: normalizedAssetCategories,
      assetCriticalityScale: normalizedAssetCriticalityScale,
      assessmentScopes: normalizedAssessmentScopes,
      recordDefaults: normalizedDefaults,
      soaLabels,
      exportFilenames,
      businessUnits: Array.from(new Set(businessUnits.map(s => s.trim()).filter(Boolean))),
      maturityModels: [{
        id: maturityModelId,
        name: 'Default',
        levels: maturityLevels
          .map(l => ({ level: Math.max(1, Math.round(Number(l.level) || 1)), label: l.label.trim() || `Level ${l.level}` }))
          .sort((a, b) => a.level - b.level)
      }],
      activeMaturityModelId: maturityModelId
    };

    const nextWorkspace = rescoreRisks({
      ...workspace,
      riskModel: {
        ...workspace.riskModel,
        matrix: buildRiskMatrix(
          workspace.riskModel.likelihoodScale,
          workspace.riskModel.impactScale,
          workspace.riskModel.appetiteThresholdScore,
          nextConfig
        )
      },
      config: nextConfig,
      aiAssist: {
        ...aiAssist,
        maxItemsPerSection: Math.min(100, Math.max(5, Math.round(aiAssist.maxItemsPerSection || 20)))
      }
    });
    applyWorkspace(nextWorkspace);
    setStatusMessage({ severity: 'success', text: 'Defaults, display, and AI assist settings saved.' });
  }, [
    aiAssist,
    applyWorkspace,
    assessmentScopes,
    assetCategories,
    assetCriticalityScale,
    businessUnits,
    defaults,
    exportFilenames,
    maturityLevels,
    protocolOsiMapText,
    ratingBands,
    setStatusMessage,
    soaLabels,
    workspace
  ]);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Risk Ratings & Thresholds</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
        Configure severity label, numeric value, and minimum score ratio (0.00-1.00). Default scale uses
        Catastrophic (6), Severe (5), Major (4), Moderate (3), Minor (2), Negligible (1).
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
        <Tooltip describeChild title="Choose a predefined risk rating model to replace current in-editor levels." arrow>
          <TextField
            size="small"
            select
            label="Rating Preset"
            value={selectedPresetId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedPresetId(e.target.value as RatingPresetId)}
            sx={{ minWidth: 230 }}
          >
            {ratingPresets.map(preset => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.label}
              </MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Apply the selected preset after confirmation." arrow>
          <Button
            variant="outlined"
            onClick={handleRequestApplyPreset}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Apply Preset
          </Button>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {selectedPreset.description}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 1.25, mb: 1.5 }}>
        {ratingBands.map((band, index) => (
          <Paper key={band.id} variant="outlined" sx={{ p: 1.25 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Tooltip describeChild title="Severity label shown in risk ratings." arrow>
                <TextField
                  size="small"
                  label={`Rating ${index + 1} Label`}
                  value={band.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRatingBands(current =>
                    current.map((row, rowIndex) => rowIndex === index ? { ...row, label: e.target.value } : row)
                  )}
                  sx={{ minWidth: 220 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Numeric severity rank for sorting and display." arrow>
                <TextField
                  size="small"
                  type="number"
                  label="Value"
                  value={band.value}
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRatingBands(current =>
                    current.map((row, rowIndex) => rowIndex === index ? { ...row, value: Number(e.target.value) || 1 } : row)
                  )}
                  sx={{ width: 120 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Minimum score ratio that maps into this rating band." arrow>
                <TextField
                  size="small"
                  type="number"
                  label="Threshold >="
                  value={band.minScoreRatio}
                  inputProps={{ min: 0, max: 1, step: 0.01 }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRatingBands(current =>
                    current.map((row, rowIndex) => rowIndex === index
                      ? { ...row, minScoreRatio: clampThreshold(Number(e.target.value) || 0) }
                      : row)
                  )}
                  sx={{ width: 150 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Hex or CSS color used for this rating badge and matrix cells." arrow>
                <TextField
                  size="small"
                  label="Color"
                  value={band.color}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRatingBands(current =>
                    current.map((row, rowIndex) => rowIndex === index ? { ...row, color: e.target.value } : row)
                  )}
                  sx={{ width: 170 }}
                  InputProps={{
                    startAdornment: (
                      <Box
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: band.color || fallbackBandColor,
                          mr: 1
                        }}
                      />
                    )
                  }}
                />
              </Tooltip>
              <Tooltip describeChild title="Remove rating level">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveRatingBand(index)}
                    disabled={ratingBands.length <= MIN_RATING_BANDS}
                    aria-label={`Remove rating level ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Preview order: {orderedPreviewBands.map(item => `${item.label} (${item.value})`).join(' -> ')}
        </Typography>
        <Tooltip describeChild title="Add another risk rating level row to the model." arrow>
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={14} />}
            onClick={handleAddRatingBand}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add Rating Level
          </Button>
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Asset Categories & Criticality</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Configure asset domain categories and the shared criticality rating scale used for business and security impact.
      </Typography>

      <Box sx={{ display: 'grid', gap: 1.25, mb: 1.5 }}>
        {assetCriticalityScale.map((level, index) => (
          <Paper key={`${level.value}-${index}`} variant="outlined" sx={{ p: 1.25 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Tooltip describeChild title="Numeric criticality value used in scoring and appetite rules." arrow>
                <TextField
                  size="small"
                  type="number"
                  label="Value"
                  value={level.value}
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAssetCriticalityScale(current =>
                      current.map((row, rowIndex) => rowIndex === index ? { ...row, value: Number(e.target.value) || 1 } : row)
                    )
                  }
                  sx={{ width: 130 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Display label shown for this criticality level in asset forms and reports." arrow>
                <TextField
                  size="small"
                  label="Label"
                  value={level.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAssetCriticalityScale(current =>
                      current.map((row, rowIndex) => rowIndex === index ? { ...row, label: e.target.value } : row)
                    )
                  }
                  sx={{ minWidth: 240 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Remove criticality level">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveAssetCriticalityLevel(index)}
                    disabled={assetCriticalityScale.length <= MIN_ASSET_CRITICALITY_LEVELS}
                    aria-label={`Remove asset criticality level ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Asset criticality scale: {orderedAssetCriticalityScale.map(level => `${level.value}:${level.label}`).join(' | ')}
        </Typography>
        <Tooltip describeChild title="Add another value/label level for asset business and security criticality ratings." arrow>
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={14} />}
            onClick={handleAddAssetCriticalityLevel}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add Asset Criticality Level
          </Button>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1.5, mb: 2 }}>
        {domainOptions.map(opt => (
          <Tooltip key={opt.value} describeChild title={`Define ${opt.label} asset category options available in the Assets tab.`} arrow>
            <TextField
              size="small"
              label={`${opt.label} Categories (comma separated)`}
              value={(assetCategories[opt.value] || []).join(', ')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAssetCategories(current => ({ ...current, [opt.value]: e.target.value.split(',').map(item => item.trim()) }))
              }
            />
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Business Units</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Define business units available as dropdown options in Assets, Risks, and Assessments tabs.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
        {businessUnits.map(bu => (
          <Chip
            key={bu}
            label={bu}
            size="small"
            onDelete={() => setBusinessUnits(current => current.filter(item => item !== bu))}
          />
        ))}
        {businessUnits.length === 0 && (
          <Typography variant="caption" color="text.secondary">No business units configured.</Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          label="New Business Unit"
          value={newBusinessUnit}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBusinessUnit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const trimmed = newBusinessUnit.trim();
              if (trimmed && !businessUnits.includes(trimmed)) {
                setBusinessUnits(current => [...current, trimmed]);
                setNewBusinessUnit('');
              }
            }
          }}
          sx={{ minWidth: 220 }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<Plus size={14} />}
          onClick={() => {
            const trimmed = newBusinessUnit.trim();
            if (!trimmed) return;
            if (businessUnits.includes(trimmed)) {
              setStatusMessage({ severity: 'info', text: `"${trimmed}" already exists.` });
              return;
            }
            setBusinessUnits(current => [...current, trimmed]);
            setNewBusinessUnit('');
          }}
          sx={{ textTransform: 'none' }}
        >
          Add
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Assessment Scope Catalog</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Configure which scope types are available in Assessments/SRMP plus the user-managed Application and OSI options.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {assessmentScopeTypeOptions.map(scopeType => (
          <Tooltip key={scopeType} describeChild title={`Enable ${assessmentScopeTypeLabels[scopeType]} as an assessment scope option.`} arrow>
            <FormControlLabel
              control={
                <Checkbox
                  checked={enabledScopeTypeSet.has(scopeType)}
                  onChange={(e) => setAssessmentScopes(current => ({
                    ...current,
                    enabledTypes: e.target.checked
                      ? Array.from(new Set([...current.enabledTypes, scopeType]))
                      : current.enabledTypes.filter(item => item !== scopeType)
                  }))}
                />
              }
              label={assessmentScopeTypeLabels[scopeType]}
            />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 1.5, mb: 2 }}>
        <Tooltip describeChild title="User-configurable system scope presets (e.g., Production, Development, DR). Available when Scope Type is System." arrow>
          <TextField
            size="small"
            label="System Scope Options (comma separated)"
            value={assessmentScopes.systemScopeOptions.join(', ')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssessmentScopes(current => ({
              ...current,
              systemScopeOptions: e.target.value.split(',').map(item => item.trim())
            }))}
          />
        </Tooltip>
        <Tooltip describeChild title="User-configurable application scope items available when creating assessment scope sets." arrow>
          <TextField
            size="small"
            label="Application Scope Options (comma separated)"
            value={assessmentScopes.applicationScopeOptions.join(', ')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssessmentScopes(current => ({
              ...current,
              applicationScopeOptions: e.target.value.split(',').map(item => item.trim())
            }))}
          />
        </Tooltip>
        <Tooltip describeChild title="Optional OSI layer scope options for protocol-layer focused assessments." arrow>
          <TextField
            size="small"
            label="OSI Scope Options (comma separated)"
            value={assessmentScopes.osiLayerOptions.join(', ')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssessmentScopes(current => ({
              ...current,
              osiLayerOptions: e.target.value.split(',').map(item => item.trim())
            }))}
          />
        </Tooltip>
        <Tooltip describeChild title={'Protocol-to-OSI mapping used to resolve OSI scope (format: Protocol => Layer, one per line).'} arrow>
          <TextField
            size="small"
            multiline
            minRows={6}
            label="Protocol to OSI Mapping"
            value={protocolOsiMapText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProtocolOsiMapText(e.target.value)}
          />
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Record Defaults</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Tooltip describeChild title="Default domain applied when creating new assets manually or via sync defaults." arrow>
          <TextField size="small" select label="Default Asset Domain" value={defaults.assetDomain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const domain = e.target.value as GrcAssetDomain;
              const domainCategories = assetCategories[domain] || [];
              setDefaults(d => ({
                ...d,
                assetDomain: domain,
                assetCategory: domainCategories.includes(d.assetCategory) ? d.assetCategory : (domainCategories[0] || d.assetCategory)
              }));
            }}
            sx={{ width: 220 }}>
            {domainOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default category applied to new asset records for the selected domain." arrow>
          <TextField size="small" select label="Default Asset Category" value={defaults.assetCategory}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, assetCategory: e.target.value }))}
            sx={{ width: 240 }}>
            {categoryOptionsForDefaultDomain.map(category => (
              <MenuItem key={category} value={category}>{category}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default business impact rating for newly created assets." arrow>
          <TextField size="small" select label="Default Business Criticality" value={defaults.assetBusinessCriticality}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, assetBusinessCriticality: Number(e.target.value) || d.assetBusinessCriticality }))}
            sx={{ width: 220 }}>
            {orderedAssetCriticalityScale.map(level => (
              <MenuItem key={`default-business-${level.value}`} value={level.value}>
                {level.value} - {level.label}
              </MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default security impact rating for newly created assets." arrow>
          <TextField size="small" select label="Default Security Criticality" value={defaults.assetSecurityCriticality}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, assetSecurityCriticality: Number(e.target.value) || d.assetSecurityCriticality }))}
            sx={{ width: 220 }}>
            {orderedAssetCriticalityScale.map(level => (
              <MenuItem key={`default-security-${level.value}`} value={level.value}>
                {level.value} - {level.label}
              </MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default lifecycle status for newly created risks." arrow>
          <TextField size="small" select label="Default Risk Status" value={defaults.riskStatus}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, riskStatus: e.target.value as typeof d.riskStatus }))}
            sx={{ width: 180 }}>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="assessed">Assessed</MenuItem>
            <MenuItem value="treated">Treated</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default treatment strategy preselected on new risks." arrow>
          <TextField size="small" select label="Default Treatment" value={defaults.treatmentStrategy}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, treatmentStrategy: e.target.value as typeof d.treatmentStrategy }))}
            sx={{ width: 180 }}>
            <MenuItem value="mitigate">Mitigate</MenuItem>
            <MenuItem value="transfer">Transfer</MenuItem>
            <MenuItem value="avoid">Avoid</MenuItem>
            <MenuItem value="accept">Accept</MenuItem>
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default Tier 1 label used when pre-populating new risk entries." arrow>
          <TextField size="small" label="Default Tier 1 Label" value={defaults.tier1Label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, tier1Label: e.target.value }))}
            sx={{ width: 200 }} />
        </Tooltip>
        <Tooltip describeChild title="Default scope type preselected when creating new assessments." arrow>
          <TextField size="small" select label="Default Assessment Scope Type" value={defaults.assessmentScopeType}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, assessmentScopeType: e.target.value as typeof d.assessmentScopeType }))}
            sx={{ width: 240 }}>
            {assessmentScopeTypeOptions.map(scopeType => (
              <MenuItem key={scopeType} value={scopeType}>{assessmentScopeTypeLabels[scopeType]}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Default scope value token stored in assessment scope items." arrow>
          <TextField size="small" label="Default Scope Value" value={defaults.assessmentScopeValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, assessmentScopeValue: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Default display name for the initial assessment scope item." arrow>
          <TextField size="small" label="Default Scope Name" value={defaults.assessmentScopeName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({ ...d, assessmentScopeName: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Default Tier 1 filter applied to new assessment scope queries (optional)." arrow>
          <TextField size="small" label="Default Assessment Tier 1 Filter" value={defaults.assessmentTierFilter.tier1 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({
              ...d,
              assessmentTierFilter: { ...d.assessmentTierFilter, tier1: e.target.value || undefined }
            }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Default Tier 2 filter applied to new assessment scope queries (optional)." arrow>
          <TextField size="small" label="Default Assessment Tier 2 Filter" value={defaults.assessmentTierFilter.tier2 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({
              ...d,
              assessmentTierFilter: { ...d.assessmentTierFilter, tier2: e.target.value || undefined }
            }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Default Tier 3 filter applied to new assessment scope queries (optional)." arrow>
          <TextField size="small" label="Default Assessment Tier 3 Filter" value={defaults.assessmentTierFilter.tier3 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({
              ...d,
              assessmentTierFilter: { ...d.assessmentTierFilter, tier3: e.target.value || undefined }
            }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Default Tier 4 filter applied to new assessment scope queries (optional)." arrow>
          <TextField size="small" label="Default Assessment Tier 4 Filter" value={defaults.assessmentTierFilter.tier4 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({
              ...d,
              assessmentTierFilter: { ...d.assessmentTierFilter, tier4: e.target.value || undefined }
            }))}
            sx={{ width: 220 }} />
        </Tooltip>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        CIA and business profile defaults (used as supplemental impact metadata on assets)
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {(Object.keys(defaults.assetCriticality) as Array<keyof typeof defaults.assetCriticality>).map(key => (
          <Tooltip key={key} describeChild title={`Default ${key} profile score used when initializing new assets.`} arrow>
            <TextField size="small" type="number" label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={defaults.assetCriticality[key]}
              inputProps={{ min: 1, max: 5 }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaults(d => ({
                ...d,
                assetCriticality: { ...d.assetCriticality, [key]: Math.min(5, Math.max(1, Number(e.target.value) || 1)) }
              }))}
              sx={{ width: 130 }} />
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>SoA Display Labels</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Applicability Labels</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        {(Object.keys(soaLabels.applicability) as Array<keyof typeof soaLabels.applicability>).map(key => (
          <Tooltip key={key} describeChild title={`Label shown for applicability value "${key}" in Compliance views.`} arrow>
            <TextField size="small" label={key} value={soaLabels.applicability[key]}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSoaLabels(s => ({
                ...s,
                applicability: { ...s.applicability, [key]: e.target.value }
              }))}
              sx={{ width: 200 }} />
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Implementation Status Labels</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {(Object.keys(soaLabels.implementationStatus) as Array<keyof typeof soaLabels.implementationStatus>).map(key => (
          <Tooltip key={key} describeChild title={`Label shown for implementation status "${key}" in Compliance views.`} arrow>
            <TextField size="small" label={key} value={soaLabels.implementationStatus[key]}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSoaLabels(s => ({
                ...s,
                implementationStatus: { ...s.implementationStatus, [key]: e.target.value }
              }))}
              sx={{ width: 200 }} />
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Maturity Levels</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Configure maturity levels used for SoA maturity assessment scoring.
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.25, mb: 1.5 }}>
        {maturityLevels.map((ml, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.25 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Tooltip describeChild title="Numeric maturity level value used for scoring." arrow>
                <TextField
                  size="small"
                  type="number"
                  label="Value"
                  value={ml.level}
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setMaturityLevels(current =>
                      current.map((row, rowIndex) => rowIndex === index ? { ...row, level: Number(e.target.value) || 1 } : row)
                    )
                  }
                  sx={{ width: 130 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Display label for this maturity level." arrow>
                <TextField
                  size="small"
                  label="Label"
                  value={ml.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setMaturityLevels(current =>
                      current.map((row, rowIndex) => rowIndex === index ? { ...row, label: e.target.value } : row)
                    )
                  }
                  sx={{ minWidth: 240 }}
                />
              </Tooltip>
              <Tooltip describeChild title="Remove maturity level">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setMaturityLevels(current => {
                      if (current.length <= 2) {
                        setStatusMessage({ severity: 'warning', text: 'At least 2 maturity levels are required.' });
                        return current;
                      }
                      return current.filter((_, rowIndex) => rowIndex !== index);
                    })}
                    disabled={maturityLevels.length <= 2}
                    aria-label={`Remove maturity level ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Paper>
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Tooltip describeChild title="Add another maturity level (max 10)." arrow>
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={14} />}
            onClick={() => setMaturityLevels(current => {
              if (current.length >= 10) {
                setStatusMessage({ severity: 'warning', text: 'Maturity levels cannot exceed 10.' });
                return current;
              }
              const highestValue = Math.max(...current.map(item => Number(item.level) || 0), 0);
              return [...current, { level: highestValue + 1, label: `Level ${current.length + 1}` }];
            })}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add Maturity Level
          </Button>
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Export Filenames</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Tooltip describeChild title="Filename used when exporting asset data from Reporting." arrow>
          <TextField size="small" label="Assets CSV" value={exportFilenames.assetsCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, assetsCsv: e.target.value }))}
            sx={{ width: 200 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting risk register data." arrow>
          <TextField size="small" label="Risks CSV" value={exportFilenames.risksCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, risksCsv: e.target.value }))}
            sx={{ width: 200 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting statement-of-applicability data." arrow>
          <TextField size="small" label="SoA CSV" value={exportFilenames.soaCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, soaCsv: e.target.value }))}
            sx={{ width: 200 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting workflow task data." arrow>
          <TextField size="small" label="Tasks CSV" value={exportFilenames.tasksCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, tasksCsv: e.target.value }))}
            sx={{ width: 200 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting assessment risk management plans." arrow>
          <TextField size="small" label="Plans CSV" value={exportFilenames.plansCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, plansCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting threat actors and scenarios." arrow>
          <TextField size="small" label="Threat Profiles CSV" value={exportFilenames.threatProfilesCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, threatProfilesCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting scoped risk appetite rules." arrow>
          <TextField size="small" label="Appetite Rules CSV" value={exportFilenames.appetiteRulesCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, appetiteRulesCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting security findings data." arrow>
          <TextField size="small" label="Findings CSV" value={exportFilenames.findingsCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, findingsCsv: e.target.value }))}
            sx={{ width: 200 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting governance documents registry." arrow>
          <TextField size="small" label="Governance Docs CSV" value={exportFilenames.governanceDocsCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, governanceDocsCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename used when exporting third-party vendor profiles." arrow>
          <TextField size="small" label="Third Parties CSV" value={exportFilenames.thirdPartiesCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, thirdPartiesCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename for the security initiatives CSV export." arrow>
          <TextField size="small" label="Initiatives CSV" value={exportFilenames.initiativesCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, initiativesCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
        <Tooltip describeChild title="Filename for the implemented controls CSV export." arrow>
          <TextField size="small" label="Implemented Controls CSV" value={exportFilenames.implementedControlsCsv}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilenames(f => ({ ...f, implementedControlsCsv: e.target.value }))}
            sx={{ width: 220 }} />
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>GRC AI Assist Context</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        Controls how much GRC workspace data is appended to chat prompts when using AI Analysis in GRC mode.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        <Tooltip describeChild title="Enable or disable GRC workspace context injection for AI prompts." arrow>
          <TextField
            size="small"
            select
            label="Enabled"
            value={aiAssist.enabled ? 'enabled' : 'disabled'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setAIAssist(current => ({ ...current, enabled: e.target.value === 'enabled' }))
            }
            sx={{ width: 160 }}
          >
            <MenuItem value="disabled">Disabled</MenuItem>
            <MenuItem value="enabled">Enabled</MenuItem>
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Choose whether AI receives only active-diagram-linked records or the full workspace." arrow>
          <TextField
            size="small"
            select
            label="Context Scope"
            value={aiAssist.contextScope}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setAIAssist(current => ({ ...current, contextScope: e.target.value as typeof current.contextScope }))
            }
            sx={{ width: 200 }}
          >
            <MenuItem value="linked">Linked to active diagram</MenuItem>
            <MenuItem value="workspace">Full workspace</MenuItem>
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Choose compact summary context or detailed record context." arrow>
          <TextField
            size="small"
            select
            label="Context Detail"
            value={aiAssist.contextDetail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setAIAssist(current => ({ ...current, contextDetail: e.target.value as typeof current.contextDetail }))
            }
            sx={{ width: 180 }}
          >
            <MenuItem value="summary">Summary</MenuItem>
            <MenuItem value="detailed">Detailed</MenuItem>
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Maximum number of records included per context section to control prompt size." arrow>
          <TextField
            size="small"
            type="number"
            label="Max Items / Section"
            value={aiAssist.maxItemsPerSection}
            inputProps={{ min: 5, max: 100, step: 1 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setAIAssist(current => ({ ...current, maxItemsPerSection: Number(e.target.value) || 20 }))
            }
            sx={{ width: 180 }}
          />
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Tooltip describeChild title="Include asset records in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeAssets}
                onChange={(e) => setAIAssist(current => ({ ...current, includeAssets: e.target.checked }))}
              />
            }
            label="Include Assets"
          />
        </Tooltip>
        <Tooltip describeChild title="Include risk register records in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeRisks}
                onChange={(e) => setAIAssist(current => ({ ...current, includeRisks: e.target.checked }))}
              />
            }
            label="Include Risks"
          />
        </Tooltip>
        <Tooltip describeChild title="Include statement-of-applicability entries in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeSoaEntries}
                onChange={(e) => setAIAssist(current => ({ ...current, includeSoaEntries: e.target.checked }))}
              />
            }
            label="Include SoA"
          />
        </Tooltip>
        <Tooltip describeChild title="Include workflow task records in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeTasks}
                onChange={(e) => setAIAssist(current => ({ ...current, includeTasks: e.target.checked }))}
              />
            }
            label="Include Tasks"
          />
        </Tooltip>
        <Tooltip describeChild title="Include assessment workspaces in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeAssessments}
                onChange={(e) => setAIAssist(current => ({ ...current, includeAssessments: e.target.checked }))}
              />
            }
            label="Include Assessments"
          />
        </Tooltip>
        <Tooltip describeChild title="Include threat actors and threat scenarios in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeThreatProfiles}
                onChange={(e) => setAIAssist(current => ({ ...current, includeThreatProfiles: e.target.checked }))}
              />
            }
            label="Include Threat Profiles"
          />
        </Tooltip>
        <Tooltip describeChild title="Include governance document records in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeGovernanceDocuments}
                onChange={(e) => setAIAssist(current => ({ ...current, includeGovernanceDocuments: e.target.checked }))}
              />
            }
            label="Include Governance Docs"
          />
        </Tooltip>
        <Tooltip describeChild title="Include scoped appetite rule records in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeAppetiteRules}
                onChange={(e) => setAIAssist(current => ({ ...current, includeAppetiteRules: e.target.checked }))}
              />
            }
            label="Include Appetite Rules"
          />
        </Tooltip>
        <Tooltip describeChild title="Include security findings in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeFindings}
                onChange={(e) => setAIAssist(current => ({ ...current, includeFindings: e.target.checked }))}
              />
            }
            label="Include Findings"
          />
        </Tooltip>
        <Tooltip describeChild title="Include third-party vendor profiles in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeThirdParties}
                onChange={(e) => setAIAssist(current => ({ ...current, includeThirdParties: e.target.checked }))}
              />
            }
            label="Include Third Parties"
          />
        </Tooltip>
        <Tooltip describeChild title="Include security initiatives and milestone progress in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeSecurityInitiatives}
                onChange={(e) => setAIAssist(current => ({ ...current, includeSecurityInitiatives: e.target.checked }))}
              />
            }
            label="Include Initiatives"
          />
        </Tooltip>
        <Tooltip describeChild title="Include implemented controls registry in AI context payloads." arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={aiAssist.includeImplementedControls}
                onChange={(e) => setAIAssist(current => ({ ...current, includeImplementedControls: e.target.checked }))}
              />
            }
            label="Implemented Controls"
          />
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Configuration Portability</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        Export or import GRC configuration settings for reuse across workspaces.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Tooltip describeChild title="Download current configuration as a JSON file." arrow>
          <Button variant="outlined" onClick={handleExportConfig} sx={{ textTransform: 'none' }}>
            Export Config
          </Button>
        </Tooltip>
        <Tooltip describeChild title="Load configuration from a previously exported JSON file." arrow>
          <Button variant="outlined" onClick={() => importInputRef.current?.click()} sx={{ textTransform: 'none' }}>
            Import Config
          </Button>
        </Tooltip>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportConfig}
        />
      </Box>

      <Tooltip describeChild title="Persist all configuration changes and rescore risk matrix outputs where needed." arrow>
        <Button variant="contained" onClick={handleSave}>Save Defaults, Display & AI Assist</Button>
      </Tooltip>

      <Dialog open={isPresetConfirmOpen} onClose={handleCancelPresetApply}>
        <DialogTitle>Apply Rating Preset?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Applying this preset will clear your current in-editor rating labels, values, thresholds, and colors.
            It will immediately update the matrix preview.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep current in-editor rating levels and close this dialog." arrow>
            <Button onClick={handleCancelPresetApply}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Replace in-editor rating levels with the selected preset." arrow>
            <Button onClick={handleConfirmPresetApply} variant="contained" color="warning">
              Apply Preset Changes
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcConfigDefaultsSection;
