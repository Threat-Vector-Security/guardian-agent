/**
 * DiagramLensContext - one active annotation "lens" at a time so the base
 * diagram stays clean (v2 plan Phase 3):
 *
 *   model      - plain diagram, no annotations
 *   threats    - finding-count badges on affected elements
 *   attackPath - selected path highlighted with numbered steps, rest dimmed
 *   controls   - treatment state per element (mitigated / accepted / open)
 *
 * Node and edge renderers consume this context; the provider lives in
 * DiagramEditor. Context (not node data) is used so switching lenses never
 * mutates the diagram model.
 */

import React, { createContext, useContext } from 'react';

export type DiagramLens = 'model' | 'threats' | 'attackPath' | 'controls';

export interface DiagramLensState {
  lens: DiagramLens;
  /** Node id -> 1-based step number for the selected attack path. */
  pathNodeSteps: ReadonlyMap<string, number>;
  /** True when the attackPath lens is active AND a path is selected (dim the rest). */
  pathActive: boolean;
}

const DEFAULT_STATE: DiagramLensState = {
  lens: 'model',
  pathNodeSteps: new Map(),
  pathActive: false
};

const DiagramLensContext = createContext<DiagramLensState>(DEFAULT_STATE);

export const DiagramLensProvider = DiagramLensContext.Provider;

export const useDiagramLens = (): DiagramLensState => useContext(DiagramLensContext);

/** Severity ranking used to pick a badge colour for a set of findings. */
const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export interface NodeFindingSummary {
  count: number;
  maxSeverity: 'critical' | 'high' | 'medium' | 'low' | null;
  openCount: number;
  mitigatedCount: number;
  acceptedCount: number;
}

/** Summarize a node's structured threats (data.securityContext.threats). */
export const summarizeNodeFindings = (threats: any[] | undefined | null): NodeFindingSummary => {
  const list = Array.isArray(threats) ? threats : [];
  let maxRank = 0;
  let maxSeverity: NodeFindingSummary['maxSeverity'] = null;
  let openCount = 0;
  let mitigatedCount = 0;
  let acceptedCount = 0;
  for (const t of list) {
    const sev = String(t?.severity || '').toLowerCase();
    const rank = SEVERITY_RANK[sev] || 0;
    if (rank > maxRank) {
      maxRank = rank;
      maxSeverity = sev as NodeFindingSummary['maxSeverity'];
    }
    const status = String(t?.status || 'identified').toLowerCase();
    if (status === 'mitigated') mitigatedCount += 1;
    else if (status === 'accepted' || status === 'transferred') acceptedCount += 1;
    else openCount += 1;
  }
  return { count: list.length, maxSeverity, openCount, mitigatedCount, acceptedCount };
};

export const severityColor = (severity: string | null, colors: any): string => {
  switch (severity) {
    case 'critical': return colors.severityCritical || '#DC2626';
    case 'high': return colors.severityHigh || '#EA580C';
    case 'medium': return colors.severityMedium || '#CA8A04';
    case 'low': return colors.severityLow || '#16A34A';
    default: return colors.inkSecondary || '#6B7280';
  }
};
