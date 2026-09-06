// src/services/ThreatIntelExtractor.ts

import { DiagramData } from '../types/AnalysisTypes';
import { guardianOperation, runAI } from './guardianApi';

export interface ExtractedThreatIntel {
  rawIntelligence: string;
  recentCVEs: string;
  knownIOCs: string;
  campaignInfo: string;
  intelligenceDate: string;
  metadata: {
    totalImported: number;
    relevantExtracted: number;
    topThreats: string[];
    matchedComponents: string[];
    relevanceThreshold: number;
    tokenOptimized?: boolean;
    method?: 'direct_ai_processing' | 'langextract' | 'fallback';
    extractionMetadata?: {
      method?: 'direct_ai_processing' | 'langextract' | 'fallback';
      filtered_items?: number;
      matched_components?: string[];
      [key: string]: any;
    };
  };
}

export interface ThreatIntelItem {
  id?: string;
  type: 'cve' | 'ioc' | 'campaign' | 'technique' | 'threat-actor' | 'malware';
  title?: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  timestamp?: Date | string;
  relevanceScore?: number;
  
  // CVE specific
  cveId?: string;
  cvss?: number;
  score?: number | string;  // Added for CVSS or other scoring systems
  affectedProducts?: Array<{
    vendor: string;
    product: string;
    versions?: string[];
  }>;
  
  // IOC specific
  indicators?: Array<{
    type: 'domain' | 'ip' | 'hash' | 'email' | 'url';
    value: string;
    context?: string;
  }>;
  
  // Campaign specific
  campaignName?: string;
  threatActor?: string;
  ttps?: string[];
  
  // MITRE specific
  techniqueId?: string;
  tactics?: string[];
  
  // Mitigation information
  mitigation?: string;
  
  // Raw data
  rawData?: any;
}

export interface ParsedThreatIntel {
  items: ThreatIntelItem[];
  format: 'stix' | 'csv' | 'json' | 'misp' | 'unknown';
  timestamp: Date;
  source?: string;
  rawContent?: string;  // Original content if available
  metadata?: {          // Additional metadata
    [key: string]: any;
  };
}

export class ThreatIntelExtractor {
  private static instance: ThreatIntelExtractor;

  private constructor() {}

  public static getInstance(): ThreatIntelExtractor {
    if (!ThreatIntelExtractor.instance) {
      ThreatIntelExtractor.instance = new ThreatIntelExtractor();
    }
    return ThreatIntelExtractor.instance;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Optimize extracted intel for token limits
   */
  public optimizeForTokens(
    extractedIntel: ExtractedThreatIntel,
    maxTokens: number
  ): ExtractedThreatIntel {
    const currentTokens = 
      this.estimateTokens(extractedIntel.rawIntelligence) +
      this.estimateTokens(extractedIntel.recentCVEs) +
      this.estimateTokens(extractedIntel.knownIOCs) +
      this.estimateTokens(extractedIntel.campaignInfo);
    
    if (currentTokens <= maxTokens) {
      return extractedIntel;
    }

    // Need to trim - prioritize by importance
    const tokenBudget = {
      rawIntelligence: Math.floor(maxTokens * 0.4),
      recentCVEs: Math.floor(maxTokens * 0.3),
      knownIOCs: Math.floor(maxTokens * 0.15),
      campaignInfo: Math.floor(maxTokens * 0.15)
    };

    return {
      ...extractedIntel,
      rawIntelligence: this.truncateToTokenLimit(extractedIntel.rawIntelligence, tokenBudget.rawIntelligence),
      recentCVEs: this.truncateToTokenLimit(extractedIntel.recentCVEs, tokenBudget.recentCVEs),
      knownIOCs: this.truncateToTokenLimit(extractedIntel.knownIOCs, tokenBudget.knownIOCs),
      campaignInfo: this.truncateToTokenLimit(extractedIntel.campaignInfo, tokenBudget.campaignInfo),
      metadata: {
        ...extractedIntel.metadata,
        tokenOptimized: true
      }
    };
  }

  /**
   * Truncate text to fit within token limit
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    if (!text) return '';
    
    const estimatedLength = maxTokens * 4; // ~4 chars per token
    if (text.length <= estimatedLength) {
      return text;
    }

    // Try to truncate at a sensible boundary
    let truncated = text.substring(0, estimatedLength);
    
    // Find last complete line or sentence
    const lastNewline = truncated.lastIndexOf('\n');
    const lastPeriod = truncated.lastIndexOf('. ');
    
    const cutPoint = Math.max(lastNewline, lastPeriod);
    if (cutPoint > estimatedLength * 0.8) {
      truncated = text.substring(0, cutPoint + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Parse threat intelligence from various formats
   */
  public async parseThreatIntel(fileContent: string, fileName: string): Promise<ParsedThreatIntel> {
    const format = this.detectFormat(fileContent, fileName);
    
    switch (format) {
      case 'stix':
        return this.parseSTIX(fileContent);
      case 'csv':
        return this.parseCSV(fileContent);
      case 'misp':
        return this.parseMISP(fileContent);
      case 'json':
      default:
        return this.parseGenericJSON(fileContent);
    }
  }

  /**
   * Extract relevant threat intelligence based on diagram context
   * Now uses server-side LangExtract processing when available
   */
  public async extractRelevant(
    parsedIntel: ParsedThreatIntel,
    diagram: DiagramData,
    options: {
      maxItems?: number;
      timeWindow?: number; // days
      confidenceThreshold?: number;
    } = {}
  ): Promise<ExtractedThreatIntel> {
    const state = await guardianOperation('ai.providers.list');
    if (state.configuration?.configured) {
      const result = await runAI('analysis', 'Extract only intelligence from the supplied document that is relevant to this architecture. Do not invent indicators, dates, CVEs or citations. Return ONLY JSON with rawIntelligence, recentCVEs, knownIOCs, campaignInfo, intelligenceDate as strings, and matchedComponents as an array of component IDs.', {
        rawContent: parsedIntel.rawContent || this.convertParsedToRaw(parsedIntel), diagram,
      });
      const extracted = JSON.parse(result.content.replace(/^```(?:json)?\\s*/i, '').replace(/\\s*```$/, '').trim());
      if (['rawIntelligence','recentCVEs','knownIOCs','campaignInfo','intelligenceDate'].some(key => typeof extracted[key] !== 'string') ||
          !Array.isArray(extracted.matchedComponents) || extracted.matchedComponents.some((id: unknown) => typeof id !== 'string' || !diagram.nodes.some(node => node.id === id))) {
        throw new Error('The model returned invalid extracted intelligence. The imported document was not changed.');
      }
      return { ...extracted, metadata: { totalImported: parsedIntel.items.length, relevantExtracted: 0,
        topThreats: [], matchedComponents: extracted.matchedComponents, relevanceThreshold: options.confidenceThreshold ?? 0.5,
        method: 'direct_ai_processing', extractionMetadata: { method: 'direct_ai_processing' } } };
    }

    // Without a configured model, the original deterministic relevance matcher remains available.
    // Local relevance extraction
    const {
      maxItems = 50,
      timeWindow = 365, // 1 year default to catch more relevant CVEs
      confidenceThreshold = 0.5 // Increased from 0.3 to filter out more irrelevant items
    } = options;

    // Extract diagram components for matching
    const diagramContext = this.extractDiagramContext(diagram);
    
    // Score each threat intel item
    const scoredItems = parsedIntel.items.map(item => ({
      ...item,
      relevanceScore: this.calculateRelevanceScore(item, diagramContext, timeWindow)
    }));

    // Filter by threshold and sort by relevance
    const relevantItems = scoredItems
      .filter(item => item.relevanceScore >= confidenceThreshold)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxItems);

    // Group by type and format for output
    const groupedIntel = this.groupIntelByType(relevantItems);

    // Combine threat actors and campaigns for output
    const threatActorAndCampaignInfo = [
      ...this.formatThreatActors(groupedIntel.threatActors),
      ...this.formatCampaigns(groupedIntel.campaigns)
    ].filter(Boolean).join('\n\n');

    return {
      rawIntelligence: this.formatRawIntelligence(relevantItems),
      recentCVEs: this.formatCVEs(groupedIntel.cves),
      knownIOCs: this.formatIOCs(groupedIntel.iocs),
      campaignInfo: threatActorAndCampaignInfo,
      intelligenceDate: new Date().toISOString().split('T')[0],
      metadata: {
        totalImported: parsedIntel.items.length,
        relevantExtracted: relevantItems.length,
        topThreats: relevantItems.slice(0, 5).map(item =>
          item.title || item.cveId || item.threatActor || item.description.substring(0, 50) + '...'
        ),
        matchedComponents: Array.from(new Set(relevantItems
          .filter(item => item.affectedProducts)
          .flatMap(item => item.affectedProducts!.map(p => `${p.vendor} ${p.product}`))
        )),
        relevanceThreshold: confidenceThreshold,
        method: 'fallback'
      }
    };
  }

  /**
   * Detect file format from content and filename
   */
  private detectFormat(content: string, fileName: string): ParsedThreatIntel['format'] {
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.csv')) return 'csv';

    try {
      const parsed = JSON.parse(content);

      // Check for NVD JSON format
      if (parsed.format === 'NVD_CVE' && parsed.vulnerabilities) {
        return 'json'; // Will be handled by parseNVDJSON
      }

      // Check for STIX 2.1 indicators
      if (parsed.type === 'bundle' || parsed.objects || parsed.spec_version?.startsWith('2.')) {
        return 'stix';
      }

      // Check for MISP format
      if (parsed.Event || parsed.response?.Event) {
        return 'misp';
      }

      return 'json';
    } catch {
      // If not valid JSON, check if it might be CSV
      if (content.includes(',') && content.includes('\n')) {
        return 'csv';
      }
      return 'unknown';
    }
  }

  /**
   * Parse STIX 2.1 format
   */
  private async parseSTIX(content: string): Promise<ParsedThreatIntel> {
    const items: ThreatIntelItem[] = [];
    const stixData = JSON.parse(content);
    
    const objects = stixData.objects || [stixData];
    
    for (const obj of objects) {
      switch (obj.type) {
        case 'indicator':
          items.push({
            type: 'ioc',
            description: obj.description || obj.pattern || '',
            timestamp: obj.created || obj.modified,
            indicators: this.parseSTIXPattern(obj.pattern)
          });
          break;
          
        case 'vulnerability':
          items.push({
            type: 'cve',
            cveId: obj.external_references?.find((r: any) => r.source_name === 'cve')?.external_id,
            description: obj.description || '',
            timestamp: obj.created
          });
          break;
          
        case 'campaign':
          items.push({
            type: 'campaign',
            campaignName: obj.name,
            description: obj.description || '',
            timestamp: obj.created,
            threatActor: obj.attributed_to_refs?.[0]
          });
          break;
          
        case 'attack-pattern':
          items.push({
            type: 'technique',
            techniqueId: obj.external_references?.find((r: any) => r.source_name === 'mitre-attack')?.external_id,
            description: obj.description || '',
            timestamp: obj.created
          });
          break;
      }
    }
    
    return {
      items,
      format: 'stix',
      timestamp: new Date(),
      source: 'STIX Import'
    };
  }

  /**
   * Parse CSV format
   */
  private async parseCSV(content: string): Promise<ParsedThreatIntel> {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { items: [], format: 'csv', timestamp: new Date() };

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const items: ThreatIntelItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Try to map common CSV formats
      const item: ThreatIntelItem = {
        type: this.inferTypeFromCSVRow(row),
        description: row.description || row.details || row.summary || '',
        timestamp: row.date || row.timestamp || row.created || row.first_seen || new Date(),
        severity: this.normalizeSeverity(row.severity || row.priority || row.risk)
      };

      // Map CVE specific fields
      if (row.cve || row.cve_id) {
        item.cveId = row.cve || row.cve_id;
        item.cvss = parseFloat(row.cvss || row.score || '0');
      }

      // Map IOC fields
      if (row.indicator || row.ioc || row.ip_address || row.malware_md5_hash) {
        const value = row.indicator || row.ioc || row.ip_address || row.malware_md5_hash;
        item.indicators = [{
          type: this.inferIOCType(value),
          value: value,
          context: row.context || row.malware || ''
        }];
      }

      // Map threat actor fields
      if (row.actor_name || row.threat_actor) {
        item.type = 'threat-actor';
        item.title = row.actor_name || row.threat_actor;
        item.threatActor = row.actor_name || row.threat_actor;
        if (row.aliases) {
          item.description = `Aliases: ${row.aliases}. ${item.description}`;
        }
        if (row.ttps) {
          item.ttps = row.ttps.split('|').map((t: string) => t.trim());
        }
      }

      items.push(item);
    }

    return {
      items,
      format: 'csv',
      timestamp: new Date(),
      source: 'CSV Import'
    };
  }

  /**
   * Parse MISP format
   */
  private async parseMISP(content: string): Promise<ParsedThreatIntel> {
    const mispData = JSON.parse(content);
    const items: ThreatIntelItem[] = [];
    
    const events = mispData.Event ? [mispData.Event] : (mispData.response?.Event || []);
    
    for (const event of events) {
      // Process attributes
      if (event.Attribute) {
        for (const attr of event.Attribute) {
          items.push({
            type: this.mapMISPTypeToIntelType(attr.type),
            description: attr.comment || attr.value || '',
            timestamp: attr.timestamp,
            indicators: [{
              type: this.mapMISPTypeToIOCType(attr.type),
              value: attr.value,
              context: attr.category
            }]
          });
        }
      }
      
      // Process objects
      if (event.Object) {
        for (const obj of event.Object) {
          if (obj.name === 'vulnerability') {
            items.push({
              type: 'cve',
              description: obj.comment || '',
              timestamp: obj.timestamp,
              cveId: obj.Attribute?.find((a: any) => a.type === 'vulnerability')?.value
            });
          }
        }
      }
    }
    
    return {
      items,
      format: 'misp',
      timestamp: new Date(),
      source: 'MISP Import'
    };
  }

  /**
   * Parse generic JSON format
   */
  private async parseGenericJSON(content: string): Promise<ParsedThreatIntel> {
    const data = JSON.parse(content);
    const items: ThreatIntelItem[] = [];

    // Check if this is NVD JSON format
    if (data.format === 'NVD_CVE' && data.vulnerabilities) {
      return this.parseNVDJSON(content);
    }

    // Handle array of items
    const itemsArray = Array.isArray(data) ? data : (data.items || data.data || [data]);

    for (const item of itemsArray) {
      const threatItem: ThreatIntelItem = {
        type: this.inferTypeFromObject(item),
        description: item.description || item.details || item.summary || JSON.stringify(item),
        timestamp: item.timestamp || item.date || item.created || new Date(),
        severity: this.normalizeSeverity(item.severity || item.priority || item.risk || 'medium'),
        rawData: item
      };

      // Try to extract specific fields
      if (item.cve || item.cveId || item.CVE) {
        threatItem.cveId = item.cve || item.cveId || item.CVE;
        threatItem.type = 'cve';
      }

      if (item.ioc || item.indicator || item.indicators) {
        threatItem.type = 'ioc';
        const indicators = Array.isArray(item.indicators) ? item.indicators : [item.ioc || item.indicator];
        threatItem.indicators = indicators.map((ind: any) => ({
          type: this.inferIOCType(typeof ind === 'string' ? ind : ind.value),
          value: typeof ind === 'string' ? ind : ind.value,
          context: typeof ind === 'object' ? ind.context : ''
        }));
      }

      if (item.campaign || item.campaignName) {
        threatItem.type = 'campaign';
        threatItem.campaignName = item.campaign || item.campaignName;
        threatItem.threatActor = item.actor || item.threatActor;
      }

      items.push(threatItem);
    }

    return {
      items,
      format: 'json',
      timestamp: new Date(),
      source: 'JSON Import',
      rawContent: content // Keep raw content for LangExtract
    };
  }

  /**
   * Parse NVD JSON format (National Vulnerability Database)
   */
  private async parseNVDJSON(content: string): Promise<ParsedThreatIntel> {
    const nvdData = JSON.parse(content);
    const items: ThreatIntelItem[] = [];

    if (!nvdData.vulnerabilities || !Array.isArray(nvdData.vulnerabilities)) {
      return {
        items,
        format: 'json',
        timestamp: new Date(),
        source: 'NVD Import',
        rawContent: content
      };
    }

    // Process each vulnerability entry
    for (const vuln of nvdData.vulnerabilities) {
      if (!vuln.cve) continue;

      const cve = vuln.cve;
      const cveId = cve.id;

      // Extract descriptions
      const description = cve.descriptions?.find((d: any) => d.lang === 'en')?.value ||
                         cve.descriptions?.[0]?.value ||
                         'No description available';

      // Extract CVSS scores and severity
      let cvssScore = 0;
      let severity: ThreatIntelItem['severity'] = 'medium';

      // Check CVSS v3 metrics first
      if (cve.metrics?.cvssMetricV31) {
        const metrics = cve.metrics.cvssMetricV31[0];
        if (metrics?.cvssData) {
          cvssScore = metrics.cvssData.baseScore || 0;
          severity = this.normalizeSeverity(metrics.baseSeverity);
        }
      } else if (cve.metrics?.cvssMetricV30) {
        const metrics = cve.metrics.cvssMetricV30[0];
        if (metrics?.cvssData) {
          cvssScore = metrics.cvssData.baseScore || 0;
          severity = this.normalizeSeverity(metrics.baseSeverity);
        }
      } else if (cve.metrics?.cvssMetricV2) {
        const metrics = cve.metrics.cvssMetricV2[0];
        if (metrics?.cvssData) {
          cvssScore = metrics.cvssData.baseScore || 0;
          severity = this.normalizeSeverity(metrics.baseSeverity);
        }
      }

      // Extract affected products from CPE configurations
      const affectedProducts: ThreatIntelItem['affectedProducts'] = [];

      if (cve.configurations) {
        for (const config of cve.configurations) {
          if (config.nodes) {
            for (const node of config.nodes) {
              if (node.cpeMatch) {
                for (const cpeMatch of node.cpeMatch) {
                  if (cpeMatch.vulnerable && cpeMatch.criteria) {
                    // Parse CPE string: cpe:2.3:part:vendor:product:version:...
                    const cpeParts = cpeMatch.criteria.split(':');
                    if (cpeParts.length >= 5) {
                      const vendor = cpeParts[3] || 'unknown';
                      const product = cpeParts[4] || 'unknown';
                      const version = cpeParts[5] || '*';

                      // Check if we already have this product
                      const existingProduct = affectedProducts.find(
                        p => p.vendor === vendor && p.product === product
                      );

                      if (existingProduct) {
                        if (!existingProduct.versions?.includes(version)) {
                          existingProduct.versions?.push(version);
                        }
                      } else {
                        affectedProducts.push({
                          vendor: vendor.replace(/_/g, ' '),
                          product: product.replace(/_/g, ' '),
                          versions: [version]
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Create threat intel item
      const threatItem: ThreatIntelItem = {
        type: 'cve',
        cveId,
        description,
        severity,
        cvss: cvssScore,
        score: cvssScore.toString(),
        timestamp: cve.published || cve.lastModified || new Date(),
        affectedProducts,
        rawData: vuln
      };

      items.push(threatItem);
    }

    return {
      items,
      format: 'json',
      timestamp: new Date(),
      source: `NVD Import (${nvdData.totalResults} total CVEs)`,
      rawContent: content,
      metadata: {
        totalResults: nvdData.totalResults,
        resultsPerPage: nvdData.resultsPerPage,
        startIndex: nvdData.startIndex,
        nvdVersion: nvdData.version
      }
    };
  }

  /**
   * Extract context from diagram for relevance matching
   */
  private extractDiagramContext(diagram: DiagramData) {
    const context = {
      vendors: new Set<string>(),
      products: new Set<string>(),
      versions: new Set<string>(),
      nodeTypes: new Set<string>(),
      zones: new Set<string>(),
      protocols: new Set<string>(),
      labels: new Set<string>(),
      technologies: new Set<string>()
    };

    // Extract from nodes
    diagram.nodes.forEach(node => {
      const data = node.data as any;

      if (data.vendor) context.vendors.add(data.vendor.toLowerCase());
      if (data.product) context.products.add(data.product.toLowerCase());
      if (data.version) context.versions.add(data.version);
      if (data.zone) context.zones.add(data.zone.toLowerCase());
      if (data.label) {
        context.labels.add(data.label.toLowerCase());

        // Extract technology information from labels
        const label = data.label.toLowerCase();

        // Common web server patterns
        if (label.includes('apache')) {
          context.vendors.add('apache');
          context.products.add('http server');
          context.technologies.add('apache');

          // Extract version from label like "Apache 2.4.29"
          const versionMatch = label.match(/apache\s*(?:httpd?|server)?\s*v?(\d+\.\d+(?:\.\d+)?)/i);
          if (versionMatch) {
            context.versions.add(versionMatch[1]);
          }
        }

        // Tomcat patterns
        if (label.includes('tomcat')) {
          context.vendors.add('apache');
          context.products.add('tomcat');
          context.technologies.add('tomcat');

          const versionMatch = label.match(/tomcat\s*v?(\d+\.\d+(?:\.\d+)?)/i);
          if (versionMatch) {
            context.versions.add(versionMatch[1]);
          }
        }

        // MySQL patterns
        if (label.includes('mysql')) {
          context.vendors.add('mysql');
          context.vendors.add('oracle');
          context.products.add('mysql');
          context.technologies.add('mysql');

          const versionMatch = label.match(/mysql\s*v?(\d+\.\d+(?:\.\d+)?)/i);
          if (versionMatch) {
            context.versions.add(versionMatch[1]);
          }
        }

        // Other common technologies
        if (label.includes('nginx')) {
          context.vendors.add('nginx');
          context.products.add('nginx');
          context.technologies.add('nginx');
        }

        if (label.includes('wordpress')) {
          context.products.add('wordpress');
          context.technologies.add('wordpress');
        }

        if (label.includes('redis')) {
          context.products.add('redis');
          context.technologies.add('redis');
        }
      }

      if (node.type) context.nodeTypes.add(node.type.toLowerCase());

      if (data.protocols?.length) {
        data.protocols.forEach((p: string) => context.protocols.add(p.toLowerCase()));
      }
    });

    // Extract from edges
    diagram.edges.forEach(edge => {
      const data = edge.data as any;
      if (data.protocol) context.protocols.add(data.protocol.toLowerCase());
    });

    return {
      vendors: Array.from(context.vendors),
      products: Array.from(context.products),
      versions: Array.from(context.versions),
      nodeTypes: Array.from(context.nodeTypes),
      zones: Array.from(context.zones),
      protocols: Array.from(context.protocols),
      labels: Array.from(context.labels),
      technologies: Array.from(context.technologies)
    };
  }

  /**
   * Calculate relevance score for a threat intel item
   */
  private calculateRelevanceScore(
    item: ThreatIntelItem,
    diagramContext: ReturnType<typeof this.extractDiagramContext>,
    timeWindow: number
  ): number {
    let score = 0;

    // 1. Direct component match (50% weight) - increased from 40%
    if (item.affectedProducts) {
      for (const product of item.affectedProducts) {
        const vendorLower = product.vendor.toLowerCase();
        const productLower = product.product.toLowerCase();

        // Exact vendor match
        if (diagramContext.vendors.includes(vendorLower)) {
          score += 0.15;
        }

        // Exact product match
        if (diagramContext.products.includes(productLower)) {
          score += 0.15;
        }

        // Technology matching (e.g., apache httpd matches apache)
        if (diagramContext.technologies.some(tech =>
          vendorLower.includes(tech) || productLower.includes(tech)
        )) {
          score += 0.1;
        }

        // Version matching - critical for accuracy
        if (product.versions && diagramContext.versions.length > 0) {
          for (const version of product.versions) {
            if (version === '*' || version === '-') {
              // Wildcard version, small score boost
              score += 0.02;
            } else if (diagramContext.versions.includes(version)) {
              // Exact version match - high score
              score += 0.2;
            } else {
              // Check for version range matching
              const versionParts = version.split('.');
              const matchingVersion = diagramContext.versions.find(v => {
                const vParts = v.split('.');
                // Match major.minor at least
                return vParts[0] === versionParts[0] &&
                       (vParts[1] === versionParts[1] || versionParts[1] === undefined);
              });
              if (matchingVersion) {
                score += 0.1;
              }
            }
          }
        }
      }
    }

    // 2. Time relevance (15% weight) - reduced from 20%
    if (item.timestamp) {
      const itemDate = new Date(item.timestamp);
      const daysSince = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince <= timeWindow) {
        const timeScore = Math.max(0, 1 - (daysSince / timeWindow)) * 0.15;
        score += timeScore;
      }
    }

    // 3. Severity/Impact (20% weight)
    if (item.severity) {
      const severityScores = { critical: 0.2, high: 0.15, medium: 0.1, low: 0.05 };
      score += severityScores[item.severity] || 0;
    }

    // 4. Text matching in description (10% weight)
    const description = (item.description || '').toLowerCase();
    let textMatchScore = 0;

    // Check for technology mentions in description
    diagramContext.technologies.forEach(tech => {
      if (description.includes(tech)) textMatchScore += 0.03;
    });

    diagramContext.vendors.forEach(vendor => {
      if (description.includes(vendor)) textMatchScore += 0.02;
    });

    diagramContext.products.forEach(product => {
      if (description.includes(product)) textMatchScore += 0.02;
    });

    // Special boost for exact version mentions in description
    diagramContext.versions.forEach(version => {
      if (description.includes(version)) textMatchScore += 0.03;
    });

    score += Math.min(textMatchScore, 0.1);

    // Special handling for threat actors - they are relevant if they target similar systems
    if (item.type === 'threat-actor') {
      // Look for TTPs that match common web application attacks
      if (item.ttps && item.ttps.length > 0) {
        const webAttackTTPs = ['T1190', 'T1055', 'T1003', 'T1021', 'T1566', 'T1059', 'T1105'];
        const hasRelevantTTPs = item.ttps.some(ttp => webAttackTTPs.includes(ttp));
        if (hasRelevantTTPs) {
          score += 0.3; // Boost score for threat actors with relevant TTPs
        }
      }

      // Check if description mentions web technologies
      const webKeywords = ['web', 'server', 'database', 'application', 'retail', 'e-commerce', 'financial'];
      const hasWebKeywords = webKeywords.some(keyword => description.includes(keyword));
      if (hasWebKeywords) {
        score += 0.2;
      }
    }

    // 5. Protocol/Service match (5% weight)
    if (item.type === 'technique' && item.ttps) {
      const ttpMatch = item.ttps.some(ttp =>
        diagramContext.protocols.some(protocol =>
          ttp.toLowerCase().includes(protocol)
        )
      );
      if (ttpMatch) score += 0.05;
    }

    // 6. Zero score if no product match at all (filtering out completely irrelevant CVEs)
    if (item.affectedProducts && item.affectedProducts.length > 0) {
      const hasAnyRelevance = item.affectedProducts.some(product => {
        const vendorLower = product.vendor.toLowerCase();
        const productLower = product.product.toLowerCase();

        return diagramContext.vendors.includes(vendorLower) ||
               diagramContext.products.includes(productLower) ||
               diagramContext.technologies.some(tech =>
                 vendorLower.includes(tech) || productLower.includes(tech)
               ) ||
               diagramContext.labels.some(label =>
                 label.includes(vendorLower) || label.includes(productLower)
               );
      });

      if (!hasAnyRelevance) {
        return 0; // Completely irrelevant
      }
    }

    return Math.min(score, 1); // Cap at 1.0
  }

  /**
   * Group intelligence items by type
   */
  private groupIntelByType(items: ThreatIntelItem[]) {
    return {
      cves: items.filter(i => i.type === 'cve'),
      iocs: items.filter(i => i.type === 'ioc'),
      campaigns: items.filter(i => i.type === 'campaign'),
      techniques: items.filter(i => i.type === 'technique'),
      threatActors: items.filter(i => i.type === 'threat-actor'),
      others: items.filter(i => !['cve', 'ioc', 'campaign', 'technique', 'threat-actor'].includes(i.type))
    };
  }

  /**
   * Convert parsed intel back to raw format for LangExtract
   */
  private convertParsedToRaw(parsedIntel: ParsedThreatIntel): string {
    const sections: string[] = [];
    
    parsedIntel.items.forEach(item => {
      let section = '';
      
      if (item.title) section += `Title: ${item.title}\n`;
      if (item.description) section += `Description: ${item.description}\n`;
      if (item.cveId) section += `CVE: ${item.cveId}\n`;
      if (item.severity) section += `Severity: ${item.severity}\n`;
      if (item.score) section += `Score: ${item.score}\n`;
      
      if (item.affectedProducts && item.affectedProducts.length > 0) {
        section += 'Affected Products:\n';
        item.affectedProducts.forEach(product => {
          section += `  - ${product.vendor} ${product.product}`;
          if (product.versions && product.versions.length > 0) {
            section += ` (versions: ${product.versions.join(', ')})`;
          }
          section += '\n';
        });
      }
      
      if (item.indicators && item.indicators.length > 0) {
        section += 'Indicators:\n';
        item.indicators.forEach(indicator => {
          section += `  - ${indicator.type}: ${indicator.value}`;
          if (indicator.context) {
            section += ` (${indicator.context})`;
          }
          section += '\n';
        });
      }
      
      if (item.ttps && item.ttps.length > 0) {
        section += `TTPs: ${item.ttps.join(', ')}\n`;
      }
      
      if (item.mitigation) {
        section += `Mitigation: ${item.mitigation}\n`;
      }
      
      sections.push(section);
    });
    
    return sections.join('\n---\n\n');
  }

  /**
   * Format raw intelligence for display
   */
  private formatRawIntelligence(items: ThreatIntelItem[]): string {
    if (items.length === 0) return '';
    
    const summaries = items.slice(0, 10).map(item => {
      const severity = item.severity ? `[${item.severity.toUpperCase()}] ` : '';
      const type = `(${item.type})`;
      const title = item.title || item.cveId || item.campaignName || 'Threat Intel';
      
      return `${severity}${title} ${type}: ${item.description.substring(0, 150)}...`;
    });
    
    return summaries.join('\n\n');
  }

  /**
   * Format CVEs for display
   */
  private formatCVEs(cves: ThreatIntelItem[]): string {
    if (cves.length === 0) return '';
    
    return cves.map(cve => {
      const cvss = cve.cvss ? ` (CVSS: ${cve.cvss})` : '';
      const products = cve.affectedProducts 
        ? `\nAffects: ${cve.affectedProducts.map(p => `${p.vendor} ${p.product}`).join(', ')}`
        : '';
      
      return `${cve.cveId}${cvss}: ${cve.description.substring(0, 200)}...${products}`;
    }).join('\n\n');
  }

  /**
   * Format IOCs for display
   */
  private formatIOCs(iocs: ThreatIntelItem[]): string {
    if (iocs.length === 0) return '';
    
    const allIndicators: string[] = [];
    
    iocs.forEach(item => {
      if (item.indicators) {
        item.indicators.forEach(ind => {
          allIndicators.push(`${ind.type}: ${ind.value}${ind.context ? ` (${ind.context})` : ''}`);
        });
      }
    });
    
    return allIndicators.join('\n');
  }

  /**
   * Format campaigns for display
   */
  private formatCampaigns(campaigns: ThreatIntelItem[]): string[] {
    if (campaigns.length === 0) return [];

    return campaigns.map(campaign => {
      const actor = campaign.threatActor ? ` by ${campaign.threatActor}` : '';
      const ttps = campaign.ttps?.length ? `\nTTPs: ${campaign.ttps.join(', ')}` : '';

      return `${campaign.campaignName || campaign.title || 'Unknown Campaign'}${actor}: ${campaign.description.substring(0, 200)}...${ttps}`;
    });
  }

  /**
   * Format threat actors for display
   */
  private formatThreatActors(threatActors: ThreatIntelItem[]): string[] {
    if (threatActors.length === 0) return [];

    return threatActors.map(actor => {
      const ttps = actor.ttps?.length ? `\nTTPs: ${actor.ttps.join(', ')}` : '';
      const severity = actor.severity ? ` [${actor.severity.toUpperCase()}]` : '';

      return `Threat Actor: ${actor.title || actor.threatActor || 'Unknown'}${severity}\n${actor.description.substring(0, 200)}...${ttps}`;
    });
  }

  // Helper methods
  
  private parseSTIXPattern(pattern: string): ThreatIntelItem['indicators'] {
    const indicators: ThreatIntelItem['indicators'] = [];
    
    // Simple pattern parsing - can be enhanced
    const matches = pattern.match(/\[([^\]]+)\]/g);
    if (matches) {
      matches.forEach(match => {
        if (match.includes('ipv4-addr')) {
          const ip = match.match(/value = '([^']+)'/)?.[1];
          if (ip) indicators.push({ type: 'ip', value: ip });
        } else if (match.includes('domain-name')) {
          const domain = match.match(/value = '([^']+)'/)?.[1];
          if (domain) indicators.push({ type: 'domain', value: domain });
        }
      });
    }
    
    return indicators.length > 0 ? indicators : undefined;
  }

  private inferTypeFromCSVRow(row: any): ThreatIntelItem['type'] {
    if (row.cve || row.cve_id) return 'cve';
    if (row.actor_name || row.threat_actor) return 'threat-actor';
    if (row.ioc || row.indicator || row.ip_address || row.malware_md5_hash) return 'ioc';
    if (row.campaign) return 'campaign';
    if (row.technique || row.mitre) return 'technique';
    return 'ioc'; // default
  }

  private inferTypeFromObject(obj: any): ThreatIntelItem['type'] {
    if (obj.cve || obj.cveId || obj.CVE) return 'cve';
    if (obj.ioc || obj.indicator || obj.indicators) return 'ioc';
    if (obj.campaign || obj.campaignName) return 'campaign';
    if (obj.technique || obj.techniqueId || obj.mitre) return 'technique';
    if (obj.actor || obj.threatActor) return 'threat-actor';
    if (obj.malware || obj.malwareName) return 'malware';
    return 'ioc'; // default
  }

  private inferIOCType(value: string): 'domain' | 'ip' | 'hash' | 'email' | 'url' {
    // IP address pattern
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)) return 'ip';
    
    // Domain pattern
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(value)) return 'domain';
    
    // URL pattern
    if (/^https?:\/\//.test(value)) return 'url';
    
    // Email pattern
    if (/@/.test(value)) return 'email';
    
    // Hash (MD5, SHA1, SHA256)
    if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(value)) return 'hash';
    
    return 'domain'; // default
  }

  private normalizeSeverity(value: string): ThreatIntelItem['severity'] {
    const normalized = value?.toLowerCase() || '';
    
    if (normalized.includes('critical') || normalized.includes('extreme')) return 'critical';
    if (normalized.includes('high')) return 'high';
    if (normalized.includes('medium') || normalized.includes('moderate')) return 'medium';
    if (normalized.includes('low') || normalized.includes('minor')) return 'low';
    
    return 'medium'; // default
  }

  private mapMISPTypeToIntelType(type: string): ThreatIntelItem['type'] {
    if (type.includes('vulnerability')) return 'cve';
    if (type.includes('campaign')) return 'campaign';
    return 'ioc';
  }

  private mapMISPTypeToIOCType(type: string): 'domain' | 'ip' | 'hash' | 'email' | 'url' {
    if (type === 'ip-src' || type === 'ip-dst') return 'ip';
    if (type === 'domain') return 'domain';
    if (type === 'url') return 'url';
    if (type === 'email-src' || type === 'email-dst') return 'email';
    if (type.includes('hash') || type === 'md5' || type === 'sha1' || type === 'sha256') return 'hash';
    
    return 'domain'; // default
  }
}

// Export singleton instance
export const threatIntelExtractor = ThreatIntelExtractor.getInstance();
