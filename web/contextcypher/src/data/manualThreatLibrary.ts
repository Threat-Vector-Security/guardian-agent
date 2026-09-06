import threatPatternData from './manualThreatPatterns.json';

export type ThreatPattern = {
  id: string;
  name: string;
  description: string;
  category?: string;
  severity?: string;
  likelihood?: string;
  impact?: string;
  commonTargets?: string[];
  mitreTechniques?: string[];
  owaspCategories?: string[];
  mitigations?: string[];
  stride?: string[];
  matchKeywords?: string[];
};

const customThreatPatterns: ThreatPattern[] = [
  {
    id: 'TM-AI-001',
    name: 'Prompt Injection',
    description: 'Attackers manipulate AI model inputs to bypass safety controls, extract sensitive information, or cause unintended behavior.',
    category: 'Execution',
    severity: 'CRITICAL',
    likelihood: 'HIGH',
    impact: 'HIGH',
    stride: ['Tampering', 'Information Disclosure', 'Elevation of Privilege'],
    mitreTechniques: ['T1059'],
    mitigations: [
      'Implement prompt input validation and sanitization.',
      'Use system prompts that establish clear behavioral boundaries.',
      'Filter model outputs to prevent sensitive data leakage.',
      'Monitor and log AI interactions for anomalous patterns.',
      'Apply rate limiting per user and session.'
    ],
    matchKeywords: [
      'llm', 'prompt', 'chatbot', 'model', 'embedding', 'vector', 'rag',
      'machine learning', 'ml model',
      'sagemaker', 'bedrock', 'openai', 'anthropic', 'vertex', 'gemini', 'claude', 'gpt'
    ]
  }
];

export const threatPatternLibrary: ThreatPattern[] = [
  ...((threatPatternData as { patterns?: ThreatPattern[] }).patterns || []),
  ...customThreatPatterns
];

export const getThreatPatternById = (id: string): ThreatPattern | undefined =>
  threatPatternLibrary.find(pattern => pattern.id === id);
