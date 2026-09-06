import { SecurityNode, SecurityEdge, ThreatData } from '../types/SecurityTypes';
import { runAI } from './guardianApi';

export async function analyzeThreats(nodes: SecurityNode[], edges: SecurityEdge[], componentIds: string[], analysisType: 'node' | 'edge', context: Record<string, unknown>, signal?: AbortSignal) {
  const result = await runAI('analysis', `Analyse the selected components and their architecture for security threats.
Return ONLY a JSON object with:
content: a readable Markdown security report;
systemAnalysis: {systemOverview:{description:string,keyFindings:string[],criticalComponents:string[]},
componentThreats:{[componentId]:[{type:"threat"|"vulnerability"|"risk",title:string,description:string,severity:"CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"UNKNOWN",mitigation:string}]},
attackPaths:[], vulnerabilities:[], recommendations:[{priority:string,title:string,description:string}], analyzedComponents:[{nodeId:string,nodeName:string,analysis:string}]}.
Only use selected component IDs as componentThreats keys. Every selected ID must be represented, even when its array is empty.
Separate evidence-backed vulnerabilities from hypotheses. Do not invent CVEs, references, observed telemetry or control verification. Do not claim live web research.`,
  { diagram: { nodes, edges }, componentIds, analysisType, ...context }, signal);
  const data = JSON.parse(result.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
  const analysis = data.systemAnalysis;
  if (typeof data.content !== 'string' || !analysis || !analysis.componentThreats || Array.isArray(analysis.componentThreats)) throw new Error('The model returned an invalid threat analysis structure.');
  const selected = new Set(componentIds);
  const componentThreats: Record<string, ThreatData[]> = {};
  for (const id of componentIds) if (!Array.isArray(analysis.componentThreats[id])) throw new Error('The analysis omitted a selected component. No results have been applied.');
  for (const [id, threats] of Object.entries(analysis.componentThreats)) {
    if (!selected.has(id) || !Array.isArray(threats) || threats.length > 100) throw new Error('The model returned invalid component threats.');
    componentThreats[id] = threats.map(item => {
      if (!item || !['threat', 'vulnerability', 'risk'].includes(item.type) || !['CRITICAL','HIGH','MEDIUM','LOW','UNKNOWN'].includes(item.severity)
        || typeof item.title !== 'string' || typeof item.description !== 'string' || (item.mitigation !== undefined && typeof item.mitigation !== 'string')) throw new Error('The model returned an invalid threat. No results have been applied.');
      return { ...item, id: crypto.randomUUID(), source: 'auto-analysis', status: 'identified', createdAt: new Date(), updatedAt: new Date() };
    });
  }
  for (const field of ['attackPaths', 'vulnerabilities', 'recommendations', 'analyzedComponents']) {
    if (!Array.isArray(analysis[field])) throw new Error(`The model returned invalid ${field}.`);
  }
  analysis.componentThreats = componentThreats;
  return {
    threats: Object.values(componentThreats).flat(), detailedAnalysis: data.content, systemAnalysis: analysis,
    componentThreats, attackPaths: analysis.attackPaths, vulnerabilities: analysis.vulnerabilities,
    recommendations: analysis.recommendations,
    diagram: { nodes: nodes.map(node => {
      const entry = analysis.analyzedComponents.find((item: any) => item.nodeId === node.id);
      return selected.has(node.id) && typeof entry?.analysis === 'string' ? { ...node, data: { ...node.data, additionalContext: entry.analysis } } : node;
    }), edges },
  };
}
