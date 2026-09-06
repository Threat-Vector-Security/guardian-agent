import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { DiagramData } from '../types/AnalysisTypes';
import type { DiagramAttackPath } from '../types/GrcTypes';
import type { ManualAnalysisResult } from '../types/ManualAnalysisTypes';
import { prepareManualAnalysisInputs, runManualAnalysis } from '../services/ManualAnalysisService';

type DiagramWithAttackPaths = DiagramData & { attackPaths?: DiagramAttackPath[] };

interface ManualAnalysisContextValue extends ManualAnalysisResult {
  runAnalysis: (diagram: DiagramWithAttackPaths) => void;
  refreshAnalysis: () => void;
  getFindingsForNode: (nodeId: string) => ManualAnalysisResult['index']['nodeFindings'][string];
  getFindingsForEdge: (edgeId: string) => ManualAnalysisResult['index']['edgeFindings'][string];
  getFindingsForZone: (zoneId: string) => ManualAnalysisResult['index']['zoneFindings'][string];
  hasFindingsForNode: (nodeId: string) => boolean;
  hasFindingsForEdge: (edgeId: string) => boolean;
  hasFindingsForZone: (zoneId: string) => boolean;
}

const ManualAnalysisContext = createContext<ManualAnalysisContextValue | null>(null);

const emptyResult: ManualAnalysisResult = {
  findings: [],
  index: {
    nodeFindings: {},
    edgeFindings: {},
    zoneFindings: {}
  }
};

export const ManualAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [result, setResult] = useState<ManualAnalysisResult>(emptyResult);
  const lastDiagramRef = useRef<DiagramWithAttackPaths | null>(null);

  const runAnalysis = useCallback((diagram: DiagramWithAttackPaths) => {
    lastDiagramRef.current = diagram;
    const inputs = prepareManualAnalysisInputs(diagram.nodes, diagram.edges, diagram.attackPaths);
    const analysis = runManualAnalysis(inputs);
    setResult(analysis);
  }, []);

  const refreshAnalysis = useCallback(() => {
    if (!lastDiagramRef.current) return;
    const inputs = prepareManualAnalysisInputs(
      lastDiagramRef.current.nodes,
      lastDiagramRef.current.edges,
      lastDiagramRef.current.attackPaths
    );
    const analysis = runManualAnalysis(inputs);
    setResult(analysis);
  }, []);

  const getFindingsForNode = useCallback(
    (nodeId: string) => result.index.nodeFindings[nodeId] || [],
    [result.index.nodeFindings]
  );
  const getFindingsForEdge = useCallback(
    (edgeId: string) => result.index.edgeFindings[edgeId] || [],
    [result.index.edgeFindings]
  );
  const getFindingsForZone = useCallback(
    (zoneId: string) => result.index.zoneFindings[zoneId] || [],
    [result.index.zoneFindings]
  );

  const hasFindingsForNode = useCallback(
    (nodeId: string) => (result.index.nodeFindings[nodeId]?.length || 0) > 0,
    [result.index.nodeFindings]
  );
  const hasFindingsForEdge = useCallback(
    (edgeId: string) => (result.index.edgeFindings[edgeId]?.length || 0) > 0,
    [result.index.edgeFindings]
  );
  const hasFindingsForZone = useCallback(
    (zoneId: string) => (result.index.zoneFindings[zoneId]?.length || 0) > 0,
    [result.index.zoneFindings]
  );

  const value = useMemo(
    () => ({
      ...result,
      runAnalysis,
      refreshAnalysis,
      getFindingsForNode,
      getFindingsForEdge,
      getFindingsForZone,
      hasFindingsForNode,
      hasFindingsForEdge,
      hasFindingsForZone
    }),
    [
      result,
      runAnalysis,
      refreshAnalysis,
      getFindingsForNode,
      getFindingsForEdge,
      getFindingsForZone,
      hasFindingsForNode,
      hasFindingsForEdge,
      hasFindingsForZone
    ]
  );

  return (
    <ManualAnalysisContext.Provider value={value}>
      {children}
    </ManualAnalysisContext.Provider>
  );
};

export const useManualAnalysis = () => {
  const context = useContext(ManualAnalysisContext);
  if (!context) {
    throw new Error('useManualAnalysis must be used within a ManualAnalysisProvider');
  }
  return context;
};
