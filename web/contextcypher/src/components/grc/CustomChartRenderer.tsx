import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Treemap
} from 'recharts';
import {
  CustomChartConfig, CustomChartDataSourceKey, CustomChartColorScheme,
  CustomChartTimeGranularity, GrcWorkspace
} from '../../types/GrcTypes';
import { LBL, PIE_PALETTE, SEVERITY_COLORS } from './grcShared';
import GrcChartTooltip from './GrcChartTooltip';

export interface ChartFieldDescriptor {
  fieldKey: string;
  label: string;
  accessor: (item: any) => string;
  colorMap?: Record<string, string>;
}

export interface ChartDataSourceDef {
  key: CustomChartDataSourceKey;
  label: string;
  workspaceKey: keyof GrcWorkspace;
  fields: ChartFieldDescriptor[];
}

const statusColorMap: Record<string, string> = {
  draft: '#94a3b8', assessed: '#3b82f6', treated: '#8b5cf6', accepted: '#16a34a', closed: '#6b7280',
  open: '#ef4444', in_review: '#f59e0b', mitigated: '#16a34a', dismissed: '#6b7280',
  active: '#16a34a', under_review: '#f59e0b', archived: '#6b7280', superseded: '#94a3b8',
  todo: '#94a3b8', in_progress: '#3b82f6', blocked: '#ef4444', done: '#16a34a',
  onboarding: '#3b82f6', offboarding: '#f59e0b', terminated: '#6b7280'
};

const implColorMap: Record<string, string> = {
  implemented: '#16a34a', in_progress: '#3b82f6', planned: '#ca8a04', not_implemented: '#94a3b8'
};

const priorityColorMap: Record<string, string> = {
  critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a'
};

export const CHART_DATA_SOURCE_REGISTRY: ChartDataSourceDef[] = [
  {
    key: 'risks', label: 'Risks', workspaceKey: 'risks',
    fields: [
      { fieldKey: 'status', label: 'Status', accessor: r => r.status, colorMap: statusColorMap },
      { fieldKey: 'ratingLabel', label: 'Rating', accessor: r => (r.inherentScore?.ratingLabel || 'unrated').toLowerCase(), colorMap: SEVERITY_COLORS },
      { fieldKey: 'treatmentStrategy', label: 'Treatment', accessor: r => r.treatmentStrategy },
      { fieldKey: 'owner', label: 'Owner', accessor: r => r.owner || 'Unassigned' },
      { fieldKey: 'tierLevel', label: 'Tier Level', accessor: r => {
        const tp = r.tierPath || {};
        if (tp.tier4) return 'Tier 4';
        if (tp.tier3) return 'Tier 3';
        if (tp.tier2) return 'Tier 2';
        return 'Unclassified';
      }},
      { fieldKey: 'tier1', label: 'Tier 1', accessor: r => (r.tierPath?.tier1 || 'Unclassified') },
      { fieldKey: 'tier2', label: 'Tier 2', accessor: r => (r.tierPath?.tier2 || 'Unclassified') },
      { fieldKey: 'tier3', label: 'Tier 3 Scenario', accessor: r => (r.tierPath?.tier3 || 'Unclassified') }
    ]
  },
  {
    key: 'assets', label: 'Assets', workspaceKey: 'assets',
    fields: [
      { fieldKey: 'domain', label: 'Domain', accessor: a => a.domain },
      { fieldKey: 'category', label: 'Category', accessor: a => a.category || 'Uncategorized' },
      { fieldKey: 'owner', label: 'Owner', accessor: a => a.owner || 'Unassigned' },
      { fieldKey: 'businessCriticality', label: 'Business Criticality', accessor: a => String(a.businessCriticality ?? 0) },
      { fieldKey: 'securityCriticality', label: 'Security Criticality', accessor: a => String(a.securityCriticality ?? 0) }
    ]
  },
  {
    key: 'findings', label: 'Findings', workspaceKey: 'findings',
    fields: [
      { fieldKey: 'severity', label: 'Severity', accessor: f => f.severity, colorMap: SEVERITY_COLORS },
      { fieldKey: 'status', label: 'Status', accessor: f => f.status, colorMap: statusColorMap },
      { fieldKey: 'type', label: 'Type', accessor: f => f.type },
      { fieldKey: 'source', label: 'Source', accessor: f => f.source },
      { fieldKey: 'owner', label: 'Owner', accessor: f => f.owner || 'Unassigned' }
    ]
  },
  {
    key: 'workflowTasks', label: 'Tasks', workspaceKey: 'workflowTasks',
    fields: [
      { fieldKey: 'status', label: 'Status', accessor: t => t.status, colorMap: statusColorMap },
      { fieldKey: 'priority', label: 'Priority', accessor: t => t.priority, colorMap: priorityColorMap },
      { fieldKey: 'type', label: 'Type', accessor: t => t.type },
      { fieldKey: 'owner', label: 'Owner', accessor: t => t.owner || 'Unassigned' }
    ]
  },
  {
    key: 'thirdParties', label: 'Third Parties', workspaceKey: 'thirdParties',
    fields: [
      { fieldKey: 'riskRating', label: 'Risk Rating', accessor: t => t.riskRating, colorMap: SEVERITY_COLORS },
      { fieldKey: 'category', label: 'Category', accessor: t => t.category },
      { fieldKey: 'status', label: 'Status', accessor: t => t.status, colorMap: statusColorMap },
      { fieldKey: 'dataClassification', label: 'Data Classification', accessor: t => t.dataClassification }
    ]
  },
  {
    key: 'governanceDocuments', label: 'Governance Docs', workspaceKey: 'governanceDocuments',
    fields: [
      { fieldKey: 'status', label: 'Status', accessor: d => d.status, colorMap: statusColorMap },
      { fieldKey: 'type', label: 'Type', accessor: d => d.type },
      { fieldKey: 'owner', label: 'Owner', accessor: d => d.owner || 'Unassigned' }
    ]
  },
  {
    key: 'threatActors', label: 'Threat Actors', workspaceKey: 'threatActors',
    fields: [
      { fieldKey: 'type', label: 'Type', accessor: a => a.type },
      { fieldKey: 'resourceLevel', label: 'Resource Level', accessor: a => a.resourceLevel }
    ]
  },
  {
    key: 'soaEntries', label: 'SoA Entries', workspaceKey: 'soaEntries',
    fields: [
      { fieldKey: 'applicability', label: 'Applicability', accessor: e => e.applicability },
      { fieldKey: 'implementationStatus', label: 'Implementation', accessor: e => e.implementationStatus, colorMap: implColorMap },
      { fieldKey: 'scopeType', label: 'Scope Type', accessor: e => e.scopeType }
    ]
  },
  {
    key: 'assessments', label: 'Assessments', workspaceKey: 'assessments',
    fields: [
      { fieldKey: 'status', label: 'Status', accessor: a => a.status, colorMap: statusColorMap },
      { fieldKey: 'owner', label: 'Owner', accessor: a => a.owner || 'Unassigned' },
      { fieldKey: 'scopeType', label: 'Scope Type', accessor: a => {
        const items = a.scopeItems || [];
        if (items.length === 0) return 'No scope';
        if (items.length === 1) return items[0].type || 'Unknown';
        return 'Multi-scope';
      }},
      { fieldKey: 'riskCount', label: 'Risk Count Band', accessor: a => {
        const n = (a.riskIds || []).length;
        if (n === 0) return '0 risks';
        if (n <= 5) return '1-5 risks';
        if (n <= 15) return '6-15 risks';
        return '16+ risks';
      }},
      { fieldKey: 'hasPlan', label: 'Has Plan', accessor: a => {
        const plan = a.riskManagementPlan;
        if (!plan || (!plan.objective && (plan.actions || []).length === 0)) return 'No plan';
        return 'Has plan';
      }},
      { fieldKey: 'threatActorCount', label: 'Threat Actor Coverage', accessor: a => {
        const n = (a.threatActorIds || []).length;
        if (n === 0) return 'No actors';
        if (n <= 2) return '1-2 actors';
        return '3+ actors';
      }}
    ]
  },
  {
    key: 'threatScenarios', label: 'Threat Scenarios', workspaceKey: 'threatScenarios',
    fields: [
      { fieldKey: 'likelihood', label: 'Likelihood', accessor: s => s.likelihood || 'Unknown' },
      { fieldKey: 'impact', label: 'Impact', accessor: s => s.impact || 'Unknown' }
    ]
  },
  {
    key: 'appetiteRules', label: 'Appetite Rules', workspaceKey: 'appetiteRules',
    fields: [
      { fieldKey: 'scopeAssetDomain', label: 'Asset Domain', accessor: r => r.scopeAssetDomain || 'All' }
    ]
  },
  {
    key: 'securityInitiatives', label: 'Security Initiatives', workspaceKey: 'securityInitiatives',
    fields: [
      { fieldKey: 'status', label: 'Status', accessor: i => i.status, colorMap: statusColorMap },
      { fieldKey: 'category', label: 'Category', accessor: i => i.category },
      { fieldKey: 'priority', label: 'Priority', accessor: i => i.priority, colorMap: priorityColorMap },
      { fieldKey: 'owner', label: 'Owner', accessor: i => i.owner || 'Unassigned' }
    ]
  },
  {
    key: 'implementedControls', label: 'Implemented Controls', workspaceKey: 'implementedControls',
    fields: [
      { fieldKey: 'status', label: 'Status', accessor: c => c.status, colorMap: statusColorMap },
      { fieldKey: 'controlType', label: 'Control Type', accessor: c => c.controlType },
      { fieldKey: 'category', label: 'Category', accessor: c => c.category },
      { fieldKey: 'automationLevel', label: 'Automation', accessor: c => c.automationLevel },
      { fieldKey: 'owner', label: 'Owner', accessor: c => c.owner || 'Unassigned' }
    ]
  }
];

export const COLOR_SCHEMES: Record<CustomChartColorScheme, string[]> = {
  default: PIE_PALETTE,
  severity: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#6b7280', '#94a3b8', '#3b82f6', '#8b5cf6', '#14b8a6'],
  cool: ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#14b8a6', '#0ea5e9', '#a78bfa', '#22d3ee', '#2dd4bf'],
  warm: ['#ef4444', '#f97316', '#f59e0b', '#dc2626', '#ea580c', '#fb923c', '#fbbf24', '#f87171', '#fdba74'],
  monochrome: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#4b5563', '#374151']
};

const getTimeBucket = (dateStr: string, granularity: CustomChartTimeGranularity): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  const y = d.getFullYear();
  if (granularity === 'quarter') return `${y} Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (granularity === 'month') return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const startOfYear = new Date(y, 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${y}-W${String(weekNum).padStart(2, '0')}`;
};

const buildTimeSeries = (
  items: any[],
  granularity: CustomChartTimeGranularity,
  secondaryAccessor?: (item: any) => string
): { data: any[]; seriesKeys: string[] } => {
  const buckets: Record<string, Record<string, number>> = {};
  const seriesSet = new Set<string>();
  for (const item of items) {
    const bucket = getTimeBucket(item.createdAt || '', granularity);
    if (!buckets[bucket]) buckets[bucket] = {};
    if (secondaryAccessor) {
      const s = secondaryAccessor(item);
      const key = LBL[s] || s;
      seriesSet.add(key);
      buckets[bucket][key] = (buckets[bucket][key] || 0) + 1;
    } else {
      buckets[bucket].count = (buckets[bucket].count || 0) + 1;
    }
  }
  const seriesKeys = secondaryAccessor ? Array.from(seriesSet) : ['count'];
  const data = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, vals]) => ({ timeBucket: bucket, ...vals }));
  return { data, seriesKeys };
};

interface Props {
  config: CustomChartConfig;
  workspace: GrcWorkspace;
}

const EmptyState: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
    <Typography variant="caption" color="text.disabled">No data</Typography>
  </Box>
);

const CustomChartRenderer: React.FC<Props> = ({ config, workspace }) => {
  const palette = COLOR_SCHEMES[config.colorScheme] || COLOR_SCHEMES.default;

  const sourceDef = useMemo(
    () => CHART_DATA_SOURCE_REGISTRY.find(s => s.key === config.dataSource),
    [config.dataSource]
  );

  const items = useMemo(() => {
    if (!sourceDef) return [];
    return (workspace[sourceDef.workspaceKey] as any[]) || [];
  }, [workspace, sourceDef]);

  const primaryField = useMemo(
    () => sourceDef?.fields.find(f => f.fieldKey === config.groupByField),
    [sourceDef, config.groupByField]
  );

  const secondaryField = useMemo(
    () => config.secondaryGroupByField
      ? sourceDef?.fields.find(f => f.fieldKey === config.secondaryGroupByField)
      : undefined,
    [sourceDef, config.secondaryGroupByField]
  );

  const countData = useMemo(() => {
    if (!primaryField || items.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const item of items) {
      const k = primaryField.accessor(item);
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).map(([k, v]) => ({ name: LBL[k] || k, value: v, _key: k }));
  }, [items, primaryField]);

  const stackedData = useMemo(() => {
    if (!primaryField || !secondaryField || items.length === 0) return { data: [] as any[], secondaryKeys: [] as string[] };
    const grid: Record<string, Record<string, number>> = {};
    const secSet = new Set<string>();
    for (const item of items) {
      const pk = LBL[primaryField.accessor(item)] || primaryField.accessor(item);
      const sk = LBL[secondaryField.accessor(item)] || secondaryField.accessor(item);
      secSet.add(sk);
      if (!grid[pk]) grid[pk] = {};
      grid[pk][sk] = (grid[pk][sk] || 0) + 1;
    }
    const secondaryKeys = Array.from(secSet);
    const data = Object.entries(grid).map(([pk, vals]) => ({ name: pk, ...vals }));
    return { data, secondaryKeys };
  }, [items, primaryField, secondaryField]);

  const timeSeries = useMemo(() => {
    if ((config.chartType !== 'line' && config.chartType !== 'area') || items.length === 0) {
      return { data: [], seriesKeys: [] };
    }
    return buildTimeSeries(
      items,
      config.timeGranularity || 'month',
      secondaryField ? secondaryField.accessor : undefined
    );
  }, [items, config.chartType, config.timeGranularity, secondaryField]);

  if (items.length === 0) return <EmptyState />;

  const getColor = (entry: { _key?: string }, index: number): string => {
    if (primaryField?.colorMap && entry._key && primaryField.colorMap[entry._key]) {
      return primaryField.colorMap[entry._key];
    }
    return palette[index % palette.length];
  };

  switch (config.chartType) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={countData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip content={<GrcChartTooltip />} />
            <Bar dataKey="value">
              {countData.map((d, i) => <Cell key={i} fill={getColor(d, i)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'horizontal_bar':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={countData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
            <RechartsTooltip content={<GrcChartTooltip />} />
            <Bar dataKey="value">
              {countData.map((d, i) => <Cell key={i} fill={getColor(d, i)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={countData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
              {countData.map((d, i) => <Cell key={i} fill={getColor(d, i)} />)}
            </Pie>
            <RechartsTooltip content={<GrcChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'donut':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={countData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
              {countData.map((d, i) => <Cell key={i} fill={getColor(d, i)} />)}
            </Pie>
            <RechartsTooltip content={<GrcChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'stacked_bar':
      if (stackedData.data.length === 0) return <EmptyState />;
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stackedData.data} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip content={<GrcChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {stackedData.secondaryKeys.map((sk, i) => (
              <Bar key={sk} dataKey={sk} name={sk} stackId="a" fill={palette[i % palette.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      if (timeSeries.data.length === 0) return <EmptyState />;
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timeSeries.data} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeBucket" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip content={<GrcChartTooltip />} />
            {timeSeries.seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {timeSeries.seriesKeys.map((sk, i) => (
              <Line key={sk} type="monotone" dataKey={sk} stroke={palette[i % palette.length]} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      if (timeSeries.data.length === 0) return <EmptyState />;
      return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timeSeries.data} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeBucket" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip content={<GrcChartTooltip />} />
            {timeSeries.seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {timeSeries.seriesKeys.map((sk, i) => (
              <Area key={sk} type="monotone" dataKey={sk} stroke={palette[i % palette.length]}
                fill={palette[i % palette.length]} fillOpacity={0.3} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'radar': {
      const AngleAxis = PolarAngleAxis as any;
      return (
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={countData} cx="50%" cy="50%" outerRadius={70}>
            <PolarGrid />
            <AngleAxis dataKey="name" tick={{ fontSize: 10 }} />
            <Radar dataKey="value" stroke={palette[0]} fill={palette[0]} fillOpacity={0.4} />
            <RechartsTooltip content={<GrcChartTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    case 'treemap': {
      const treemapData = countData.map((d, i) => ({ ...d, fill: getColor(d, i) }));
      return (
        <ResponsiveContainer width="100%" height={220}>
          <Treemap
            data={treemapData}
            dataKey="value"
            nameKey="name"
            stroke="#fff"
            content={({ x, y, width, height, name, fill }: any) => (
              <g>
                <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" />
                {width > 40 && height > 20 && (
                  <text x={x + width / 2} y={y + height / 2} textAnchor="middle"
                    dominantBaseline="central" fontSize={10} fill="#fff">
                    {name}
                  </text>
                )}
              </g>
            )}
          />
        </ResponsiveContainer>
      );
    }

    default:
      return <EmptyState />;
  }
};

export default CustomChartRenderer;
