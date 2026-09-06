import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, TextField, Typography
} from '@mui/material';
import {
  CustomChartConfig, CustomChartType, CustomChartDataSourceKey,
  CustomChartColorScheme, CustomChartTimeGranularity
} from '../../types/GrcTypes';
import { CHART_DATA_SOURCE_REGISTRY, COLOR_SCHEMES } from './CustomChartRenderer';
import { createId } from './grcShared';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (config: CustomChartConfig) => void;
  existingConfig?: CustomChartConfig | null;
}

const CHART_TYPES: { value: CustomChartType; label: string; icon: string }[] = [
  { value: 'bar', label: 'Bar', icon: '\u2587\u2585\u2583' },
  { value: 'horizontal_bar', label: 'H-Bar', icon: '\u2500\u2501\u2500' },
  { value: 'pie', label: 'Pie', icon: '\u25D4' },
  { value: 'donut', label: 'Donut', icon: '\u25CE' },
  { value: 'stacked_bar', label: 'Stacked', icon: '\u2587\u2587' },
  { value: 'line', label: 'Line', icon: '\u2571\u2572\u2571' },
  { value: 'area', label: 'Area', icon: '\u2583\u2585\u2587' },
  { value: 'radar', label: 'Radar', icon: '\u2B22' },
  { value: 'treemap', label: 'Treemap', icon: '\u25A6' }
];

const COLOR_SCHEME_OPTIONS: { value: CustomChartColorScheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'severity', label: 'Severity' },
  { value: 'cool', label: 'Cool' },
  { value: 'warm', label: 'Warm' },
  { value: 'monochrome', label: 'Mono' }
];

const TIME_GRANULARITY_OPTIONS: { value: CustomChartTimeGranularity; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' }
];

const needsSecondary = (ct: CustomChartType) => ct === 'stacked_bar';
const needsTimeGranularity = (ct: CustomChartType) => ct === 'line' || ct === 'area';

const CustomChartBuilderDialog: React.FC<Props> = ({ open, onClose, onSave, existingConfig }) => {
  const [dataSource, setDataSource] = useState<CustomChartDataSourceKey | ''>('');
  const [groupByField, setGroupByField] = useState('');
  const [secondaryGroupByField, setSecondaryGroupByField] = useState('');
  const [chartType, setChartType] = useState<CustomChartType>('bar');
  const [title, setTitle] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [colorScheme, setColorScheme] = useState<CustomChartColorScheme>('default');
  const [timeGranularity, setTimeGranularity] = useState<CustomChartTimeGranularity>('month');

  useEffect(() => {
    if (open) {
      if (existingConfig) {
        setDataSource(existingConfig.dataSource);
        setGroupByField(existingConfig.groupByField);
        setSecondaryGroupByField(existingConfig.secondaryGroupByField || '');
        setChartType(existingConfig.chartType);
        setTitle(existingConfig.title);
        setTitleManuallyEdited(true);
        setColorScheme(existingConfig.colorScheme);
        setTimeGranularity(existingConfig.timeGranularity || 'month');
      } else {
        setDataSource('');
        setGroupByField('');
        setSecondaryGroupByField('');
        setChartType('bar');
        setTitle('');
        setTitleManuallyEdited(false);
        setColorScheme('default');
        setTimeGranularity('month');
      }
    }
  }, [open, existingConfig]);

  const sourceDef = useMemo(
    () => CHART_DATA_SOURCE_REGISTRY.find(s => s.key === dataSource),
    [dataSource]
  );

  const availableFields = useMemo(() => sourceDef?.fields || [], [sourceDef]);

  const secondaryFields = useMemo(
    () => availableFields.filter(f => f.fieldKey !== groupByField),
    [availableFields, groupByField]
  );

  useEffect(() => {
    if (!titleManuallyEdited && dataSource && groupByField) {
      const srcLabel = sourceDef?.label || dataSource;
      const fieldLabel = availableFields.find(f => f.fieldKey === groupByField)?.label || groupByField;
      setTitle(`${srcLabel} by ${fieldLabel}`);
    }
  }, [dataSource, groupByField, titleManuallyEdited, sourceDef, availableFields]);

  const handleDataSourceChange = useCallback((val: string) => {
    setDataSource(val as CustomChartDataSourceKey);
    setGroupByField('');
    setSecondaryGroupByField('');
    if (!titleManuallyEdited) setTitle('');
  }, [titleManuallyEdited]);

  const isValid = useMemo(() => {
    if (!dataSource || !groupByField || !chartType || !title.trim()) return false;
    if (needsSecondary(chartType) && !secondaryGroupByField) return false;
    if (needsTimeGranularity(chartType) && !timeGranularity) return false;
    return true;
  }, [dataSource, groupByField, chartType, title, secondaryGroupByField, timeGranularity]);

  const handleSave = useCallback(() => {
    if (!isValid) return;
    const now = new Date().toISOString();
    onSave({
      id: existingConfig?.id || createId('cchart'),
      title: title.trim(),
      chartType,
      dataSource: dataSource as CustomChartDataSourceKey,
      groupByField,
      secondaryGroupByField: needsSecondary(chartType) ? secondaryGroupByField : undefined,
      timeGranularity: needsTimeGranularity(chartType) ? timeGranularity : undefined,
      colorScheme,
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now
    });
  }, [isValid, existingConfig, title, chartType, dataSource, groupByField, secondaryGroupByField, timeGranularity, colorScheme, onSave]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existingConfig ? 'Edit Custom Chart' : 'Add Custom Chart'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>
        {/* Row 1: Data Source + Group By */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Data Source</InputLabel>
            <Select value={dataSource} label="Data Source"
              onChange={e => handleDataSourceChange(e.target.value)}>
              {CHART_DATA_SOURCE_REGISTRY.map(ds => (
                <MenuItem key={ds.key} value={ds.key}>{ds.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth disabled={!dataSource}>
            <InputLabel>Group By</InputLabel>
            <Select value={groupByField} label="Group By"
              onChange={e => setGroupByField(e.target.value)}>
              {availableFields.map(f => (
                <MenuItem key={f.fieldKey} value={f.fieldKey}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Row 2: Chart Type Picker (3x3 grid) */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Chart Type</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {CHART_TYPES.map(ct => (
              <Box
                key={ct.value}
                onClick={() => setChartType(ct.value)}
                sx={{
                  p: 1, textAlign: 'center', cursor: 'pointer', borderRadius: 1,
                  border: '2px solid',
                  borderColor: chartType === ct.value ? 'primary.main' : 'divider',
                  bgcolor: chartType === ct.value ? 'action.selected' : 'background.paper',
                  '&:hover': { borderColor: 'primary.light' },
                  transition: 'all 0.15s'
                }}
              >
                <Typography variant="body1" sx={{ fontSize: 18, lineHeight: 1.2 }}>{ct.icon}</Typography>
                <Typography variant="caption">{ct.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Row 3 (conditional): Secondary group-by or time granularity */}
        {needsSecondary(chartType) && (
          <FormControl size="small" fullWidth>
            <InputLabel>Secondary Group By</InputLabel>
            <Select value={secondaryGroupByField} label="Secondary Group By"
              onChange={e => setSecondaryGroupByField(e.target.value)}>
              {secondaryFields.map(f => (
                <MenuItem key={f.fieldKey} value={f.fieldKey}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {needsTimeGranularity(chartType) && (
          <FormControl size="small" fullWidth>
            <InputLabel>Time Granularity</InputLabel>
            <Select value={timeGranularity} label="Time Granularity"
              onChange={e => setTimeGranularity(e.target.value as CustomChartTimeGranularity)}>
              {TIME_GRANULARITY_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Row 4: Title */}
        <TextField
          size="small" fullWidth label="Chart Title" value={title}
          onChange={e => { setTitle(e.target.value); setTitleManuallyEdited(true); }}
        />

        {/* Row 5: Color Scheme */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Color Scheme</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {COLOR_SCHEME_OPTIONS.map(cs => (
              <Box
                key={cs.value}
                onClick={() => setColorScheme(cs.value)}
                sx={{
                  flex: 1, p: 0.75, textAlign: 'center', cursor: 'pointer', borderRadius: 1,
                  border: '2px solid',
                  borderColor: colorScheme === cs.value ? 'primary.main' : 'divider',
                  transition: 'all 0.15s'
                }}
              >
                <Box sx={{ display: 'flex', gap: '2px', justifyContent: 'center', mb: 0.5 }}>
                  {COLOR_SCHEMES[cs.value].slice(0, 5).map((c, i) => (
                    <Box key={i} sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: c }} />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ fontSize: 10 }}>{cs.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!isValid} onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomChartBuilderDialog;
