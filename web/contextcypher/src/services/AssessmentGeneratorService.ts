// src/services/AssessmentGeneratorService.ts
import { saveFile } from '../../../shared/file-dialogs';

import { 
  AdditionalContext, 
  CustomContext, 
  DiagramData,
  AnalysisResponse,
  AnalysisContext,
  AnalysisResult
} from '../types/AnalysisTypes';
import { ChatMessage } from '../types/ChatTypes';
import { ThreatIntelData } from '../types/ThreatIntelTypes';
import { SecurityZone, SecurityNodeData, SecurityNode } from '../types/SecurityTypes';
import { AlienVaultIndicator } from '../types/AlienVaultTypes';
import { AnalysisService } from './AnalysisService';

// File System Access API types are defined globally in src/types/file-system-access.d.ts

export interface SecurityAssessment {
  metadata: {
    date: string;
  };
  executiveSummary: string;
  systemDescription: {
    overview: string;
    components: Array<{
      type: string;
      count: number;
      securityProperties: string[];
    }>;
    zones: Array<{
      name: SecurityZone;
      components: number;
      connections: number;
    }>;
    dataFlows: Array<{
      source: string;
      target: string;
      protocol?: string;
      encryption?: string;
      securityControls: string[];
    }>;
  };
  risks: Array<{
    id: string;
    name: string;
    threatStatement: string;
    exampleScenario: string;
    attackVectors: Array<{
      technique: string;
      mitreRef: string;
      description: string;
    }>;
    vulnerabilityDetails: string;
    impact: {
      description: string;
      severity: 'Low' | 'Medium' | 'High' | 'Critical';
      affectedAssets: string[];
    };
    likelihood: 'Low' | 'Medium' | 'High';
    riskScore: number;
    mitigatingControls: Array<{
      control: string;
      framework: string;
      reference: string;
      status: 'Implemented' | 'Planned' | 'Recommended';
    }>;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    relatedRisks: string[];
    implementationGuidance: string;
  }>;
  appendices: {
    diagramState: string;
    userContext: string[];
    threatIntelSummary?: string;
    methodologyNotes: string;
  };
}

export class AssessmentGeneratorService {
  private static instance: AssessmentGeneratorService;

  private constructor() {}

  public static getInstance(): AssessmentGeneratorService {
    if (!AssessmentGeneratorService.instance) {
      AssessmentGeneratorService.instance = new AssessmentGeneratorService();
    }
    return AssessmentGeneratorService.instance;
  }

  public async generateAssessment(
    diagram: DiagramData,
    messages: ChatMessage[],
    customContext: CustomContext | null
  ): Promise<boolean> {
    try {
      // Reserve the destination on the initiating click; cancellation performs no AI requests.
      return await saveFile(`security-assessment-${new Date().toISOString().split('T')[0]}.txt`, async () => {
      console.log('Starting assessment generation...', {
        nodeCount: diagram.nodes.length,
        edgeCount: diagram.edges.length,
        messageCount: messages.length,
        hasCustomContext: !!customContext
      });

      // Get analysis from backend which includes threat intel
      const analysisService = AnalysisService.getInstance();
      const analysisContext: AnalysisContext = {
        diagram,
        messageHistory: messages,
        customContext,
        metadata: {
          timestamp: new Date()
        }
      };
      
      const analysisResponse: AnalysisResponse = await analysisService.analyze(analysisContext);

      // Transform the threat intel data with proper type checking
      const threatIntelData: ThreatIntelData | null = analysisResponse.metadata?.threatIntelSources ? {
        mitreAttack: {
          techniques: [],
          lastUpdated: new Date().toISOString()
        },
        githubAdvisories: {
          vulnerabilities: [],
          lastUpdated: new Date().toISOString()
        },
        nvdVulnerabilities: {
          vulnerabilities: [],
          lastUpdated: new Date().toISOString()
        },
        alienVault: {
          indicators: [],
          pulses: [],
          lastUpdated: new Date().toISOString()
        },
        nodeAnalysis: {},
        connectionAnalysis: {},
        metadata: {
          sources: {
            mitre: analysisResponse.metadata.threatIntelSources.mitre,
            github: analysisResponse.metadata.threatIntelSources.github,
            alienVault: analysisResponse.metadata.threatIntelSources.alienVault,
            nvd: analysisResponse.metadata.threatIntelSources.nvd
          },
          timestamp: analysisResponse.metadata.timestamp
        }
      } : null;

      const additionalContext: AdditionalContext = {
        customContext,
        messageHistory: messages,
        threatIntel: threatIntelData
      };

      // Generate assessment using AI analysis
      const assessment = await this.analyzeWithContext(
        diagram,
        messages,
        additionalContext
      );

      return new Blob([this.formatReport(assessment, diagram, customContext)], { type: 'text/plain' });
      });

    } catch (error) {
      console.error('Assessment generation failed:', error);
      throw new Error(`Failed to generate assessment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeWithContext(
    diagram: DiagramData,
    messages: ChatMessage[],
    additionalContext: AdditionalContext
  ): Promise<SecurityAssessment> {
    try {
      const systemContext = this.buildSystemContext(diagram);
      const threatContext = additionalContext.threatIntel ? 
        this.buildThreatContext(additionalContext.threatIntel) : 
        'No threat intelligence data available.';
      
      const prompt = `Generate a comprehensive security assessment for the following system:

System Context:
${systemContext}

Threat Intelligence Context:
${threatContext}

${additionalContext.customContext?.sanitizedContent ? `
Additional Context:
${additionalContext.customContext.sanitizedContent}
` : ''}

Previous Analysis History:
${this.formatMessageHistory(messages)}

Please provide a detailed security assessment using the PASTA (Process for Attack Simulation and Threat Analysis) methodology including:
1. Executive Summary
2. System Overview and Business Impact Analysis
3. Threat Analysis using PASTA framework:
   - MITRE ATT&CK techniques identified
   - GitHub security advisories relevant to components
   - AlienVault threat indicators
4. Vulnerability Analysis and Attack Modeling
5. Risk Analysis and Countermeasures
`;

      const analysisContext: AnalysisContext = {
        diagram,
        customContext: additionalContext.customContext || null,
        messageHistory: messages,
        metadata: {
          lastModified: new Date(),
          version: diagram.metadata?.version,
          isInitialSystem: additionalContext.metadata?.isInitialSystem,
          isSanitized: additionalContext.metadata?.isSanitized,
          systemType: additionalContext.metadata?.systemType
        }
      };

      // Update the diagram analysis call
      const analysisService = AnalysisService.getInstance();
      const analysisResponse = await analysisService.analyze(analysisContext);

      if (!analysisResponse?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from AI service');
      }

      // Convert the response to an AnalysisResult
      const analysisResult: AnalysisResult = {
        id: `analysis_${Date.now()}`,
        timestamp: new Date(),
        content: analysisResponse.choices[0].message.content,
        type: 'security',
        metadata: analysisResponse.metadata
      };

      const response = analysisResult;

      if (!response?.content) {
        throw new Error('Invalid response from AI service');
      }

      return this.parseAIResponse(response.content, diagram);

    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  }

  private formatReport(
    assessment: SecurityAssessment,
    diagram: DiagramData,
    customContext: CustomContext | null
  ): string {
    let report = '';

    // Header
    report += `SECURITY ASSESSMENT REPORT\n`;
    report += `===============================\n\n`;
    report += `Generated: ${new Date(assessment.metadata.date).toLocaleString()}\n\n`;

    // Add custom context if available
    if (customContext) {
      report += `Context Notes:\n`;
      report += `${customContext.content}\n\n`;
    }

    // Executive Summary
    report += `EXECUTIVE SUMMARY\n`;
    report += `${assessment.executiveSummary}\n\n`;

    // System Description
    report += `SYSTEM DESCRIPTION\n`;
    report += `${assessment.systemDescription.overview}\n\n`;

    // Components
    report += `Components:\n`;
    assessment.systemDescription.components.forEach(comp => {
      report += `- ${comp.type} (${comp.count})\n`;
      if (comp.securityProperties.length > 0) {
        report += `  Security Properties: ${comp.securityProperties.join(', ')}\n`;
      }
    });
    report += '\n';

    // Security Zones
    report += `Security Zones:\n`;
    assessment.systemDescription.zones.forEach(zone => {
      report += `- ${zone.name}: ${zone.components} components, ${zone.connections} connections\n`;
    });
    report += '\n';

    // Data Flows
    report += `Data Flows:\n`;
    assessment.systemDescription.dataFlows.forEach(flow => {
      report += `- ${flow.source} -> ${flow.target}\n`;
      if (flow.protocol) report += `  Protocol: ${flow.protocol}\n`;
      if (flow.encryption) report += `  Encryption: ${flow.encryption}\n`;
      if (flow.securityControls.length > 0) {
        report += `  Controls: ${flow.securityControls.join(', ')}\n`;
      }
    });
    report += '\n';

    // Risks
    report += `RISKS\n`;
    assessment.risks.forEach((risk, index) => {
      report += `${index + 1}. ${risk.name}\n`;
      report += `   Threat: ${risk.threatStatement}\n`;
      report += `   Scenario: ${risk.exampleScenario}\n`;
      report += `   Attack Vectors:\n`;
      risk.attackVectors.forEach(av => {
        report += `   - ${av.technique} (${av.mitreRef})\n     ${av.description}\n`;
      });
      report += `   Vulnerability: ${risk.vulnerabilityDetails}\n`;
      report += `   Impact: ${risk.impact.description}\n`;
      report += `   Severity: ${risk.impact.severity}\n`;
      report += `   Likelihood: ${risk.likelihood}\n`;
      report += `   Risk Score: ${risk.riskScore}\n`;
      report += `   Mitigating Controls:\n`;
      risk.mitigatingControls.forEach(mc => {
        report += `   - ${mc.control} (${mc.framework}: ${mc.reference})\n     Status: ${mc.status}\n`;
      });
      report += '\n';
    });

    // Recommendations
    report += `RECOMMENDATIONS\n`;
    assessment.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec.title}\n`;
      report += `   Priority: ${rec.priority}\n`;
      report += `   Description: ${rec.description}\n`;
      report += `   Implementation: ${rec.implementationGuidance}\n`;
      if (rec.relatedRisks.length > 0) {
        report += `   Related Risks: ${rec.relatedRisks.join(', ')}\n`;
      }
      report += '\n';
    });

    // Appendices
    report += `APPENDICES\n`;
    if (assessment.appendices.threatIntelSummary) {
      report += `Threat Intelligence Summary:\n${assessment.appendices.threatIntelSummary}\n\n`;
    }
    report += `Methodology Notes:\n${assessment.appendices.methodologyNotes}\n`;

    return report;
  }

  private buildSystemContext(diagram: DiagramData): string {
    let context = `Components: ${diagram.nodes.length}\n`;
    context += `Connections: ${diagram.edges.length}\n`;
    
    // Add node types summary
    const nodeTypes = new Map<string, number>();
    diagram.nodes.forEach(node => {
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    });
    
    context += '\nComponent Types:\n';
    nodeTypes.forEach((count, type) => {
      context += `- ${type}: ${count}\n`;
    });

    return context;
  }

  private buildThreatContext(threatIntel: ThreatIntelData): string {
    let context = 'Relevant Threat Intelligence:\n';
    
    // Add MITRE ATT&CK techniques
    if (threatIntel.mitreAttack.techniques.length > 0) {
      context += '\nMITRE ATT&CK Techniques:\n';
      threatIntel.mitreAttack.techniques.forEach(technique => {
        context += `- ${technique.id}: ${technique.name}\n`;
      });
    }

    // Add GitHub security advisories
    if (threatIntel.githubAdvisories.vulnerabilities.length > 0) {
      context += '\nRelevant Security Advisories:\n';
      threatIntel.githubAdvisories.vulnerabilities.forEach(vuln => {
        context += `- ${vuln.id}: ${vuln.summary} (Severity: ${vuln.severity})\n`;
      });
    }

    // AlienVault indicators with proper type casting
    if (threatIntel.alienVault.indicators.length > 0) {
      context += '\nAlienVault Threat Intelligence:\n';
      threatIntel.alienVault.indicators.forEach((indicator) => {
        context += `- ${indicator.id}: ${indicator.title}`;
        if (indicator.description) {
          context += ` - ${indicator.description}`;
        }
        context += '\n';
      });
    }

    return context;
  }

  private formatMessageHistory(messages: ChatMessage[]): string {
    return messages
      .map(msg => `${msg.timestamp.toISOString()}: ${msg.content}`)
      .join('\n');
  }

  private parseAIResponse(content: string, diagram: DiagramData): SecurityAssessment {
    try {
      const sections = content.split(/(?=\n\d+\.\s+[A-Z])/);
      const assessment: SecurityAssessment = {
        metadata: {
          date: new Date().toISOString()
        },
        executiveSummary: '',
        systemDescription: {
          overview: '',
          components: [],
          zones: [],
          dataFlows: []
        },
        risks: [],
        recommendations: [],
        appendices: {
          diagramState: JSON.stringify(diagram),
          userContext: [],
          methodologyNotes: 'Assessment generated using PASTA (Process for Attack Simulation and Threat Analysis) methodology with AI-assisted analysis'
        }
      };

      // Parse each section based on content
      sections.forEach(section => {
        if (section.includes('Executive Summary')) {
          assessment.executiveSummary = this.extractSection(section);
        } else if (section.includes('System Description') || section.includes('System Overview')) {
          this.parseSystemDescription(section, assessment, diagram);
        } else if (section.includes('Risk Assessment') || section.includes('Risk Analysis') || section.includes('Vulnerability Analysis')) {
          this.parseRisks(section, assessment);
        } else if (section.includes('Recommendations') || section.includes('Countermeasures')) {
          this.parseRecommendations(section, assessment);
        }
      });

      return assessment;
    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error('Failed to parse assessment response');
    }
  }

  private extractSection(text: string): string {
    return text.split('\n').slice(1).join('\n').trim();
  }

  private parseSystemDescription(
    section: string,
    assessment: SecurityAssessment,
    diagram: DiagramData
  ): void {
    // Basic implementation - can be enhanced based on AI response format
    assessment.systemDescription.overview = this.extractSection(section);
  }

  private parseRisks(section: string, assessment: SecurityAssessment): void {

  }

  private parseRecommendations(section: string, assessment: SecurityAssessment): void {

  }

  private formatThreatIntelContext(threatIntel: ThreatIntelData): string {
    let context = '';

    // Add MITRE ATT&CK techniques
    if (threatIntel.mitreAttack.techniques.length > 0) {
      context += '\nMITRE ATT&CK Techniques:\n';
      threatIntel.mitreAttack.techniques.forEach(technique => {
        context += `- [${technique.id}] ${technique.name}: ${technique.description}\n`;
        if (technique.tactics.length > 0) {
          context += `  Tactics: ${technique.tactics.join(', ')}\n`;
        }
      });
    }

    // Add GitHub advisories
    if (threatIntel.githubAdvisories.vulnerabilities.length > 0) {
      context += '\nGitHub Security Advisories:\n';
      threatIntel.githubAdvisories.vulnerabilities.forEach(advisory => {
        context += `- ${advisory.id}: ${advisory.summary}\n`;
        if (advisory.severity) {
          context += `  Severity: ${advisory.severity}\n`;
        }
      });
    }

    // Add AlienVault indicators (replacing OSV)
    if (threatIntel.alienVault.indicators.length > 0) {
      context += '\nAlienVault Threat Intelligence:\n';
      threatIntel.alienVault.indicators.forEach((indicator: AlienVaultIndicator) => {
        context += `- [${indicator.type}] ${indicator.title}\n`;
        if (indicator.description) {
          context += `  Description: ${indicator.description}\n`;
        }
        if (indicator.relatedPulses?.length) {
          context += `  Related Pulses: ${indicator.relatedPulses.length}\n`;
        }
      });
    }

    return context;
  }

  private async generateAssessmentPrompt(
    diagram: DiagramData,
    threatIntel: ThreatIntelData
  ): Promise<string> {
    let prompt = 'Generate a comprehensive security assessment report for the following system:\n\n';

    // Add diagram context
    prompt += this.formatDiagramContext(diagram);

    // Add threat intelligence context
    prompt += '\nThreat Intelligence Context:\n';
    prompt += this.formatThreatIntelContext(threatIntel);

    // Add assessment requirements
    prompt += `\nPlease provide a detailed security assessment using the PASTA (Process for Attack Simulation and Threat Analysis) methodology including:
1. Executive Summary
2. System Overview and Business Impact Analysis
3. Threat Analysis using PASTA framework:
   - MITRE ATT&CK techniques identified
   - GitHub security advisories relevant to components
   - AlienVault threat indicators
4. Vulnerability Analysis and Attack Modeling
5. Risk Analysis and Countermeasures
`;

    return prompt;
  }

  private formatDiagramContext(diagram: DiagramData): string {
    let context = `System Components:\n`;
    
    // Add node summary
    context += `Total Components: ${diagram.nodes.length}\n`;
    context += `Total Connections: ${diagram.edges.length}\n\n`;
    
    // Group nodes by type
    const nodesByType = diagram.nodes.reduce((acc, node) => {
      const type = node.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(node);
      return acc;
    }, {} as Record<string, SecurityNode[]>);

    // Add component breakdown
    context += 'Component Breakdown:\n';
    Object.entries(nodesByType).forEach(([type, nodes]) => {
      context += `- ${type}: ${nodes.length}\n`;
    });

    // Add security zones if present
    const zones = new Set(diagram.nodes
      .map(node => (node.data as SecurityNodeData).zone)
      .filter(Boolean));

    if (zones.size > 0) {
      context += '\nSecurity Zones:\n';
      zones.forEach(zone => {
        const nodesInZone = diagram.nodes.filter(
          node => (node.data as SecurityNodeData).zone === zone
        );
        context += `- ${zone}: ${nodesInZone.length} components\n`;
      });
    }

    // Add connection summary
    if (diagram.edges.length > 0) {
      context += '\nConnections:\n';
      diagram.edges.forEach(edge => {
        const source = diagram.nodes.find(n => n.id === edge.source);
        const target = diagram.nodes.find(n => n.id === edge.target);
        if (source && target) {
          context += `- ${source.data.label} → ${target.data.label}`;
          if (edge.data?.protocol) {
            context += ` (${edge.data.protocol})`;
          }
          context += '\n';
        }
      });
    }

    return context;
  }
}

export default AssessmentGeneratorService;
