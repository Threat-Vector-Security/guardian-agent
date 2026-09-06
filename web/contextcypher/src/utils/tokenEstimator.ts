// Global context window for fallback usage across estimations
// Default to 128k as minimum for modern models
let GLOBAL_CONTEXT_WINDOW = 131072;

export const setGlobalContextWindow = (tokens: number) => {
  if (Number.isFinite(tokens) && tokens > 0) {
    GLOBAL_CONTEXT_WINDOW = Math.floor(tokens);
  }
};

export const getGlobalContextWindow = (): number => GLOBAL_CONTEXT_WINDOW;

export const estimateDiagramTokens = (
  nodes: number,
  edges: number,
  perNode = 50,
  perEdge = 20
): number => nodes * perNode + edges * perEdge;

// New function for node-by-node analysis estimation
export const estimateNodeByNodeTokens = (
  nodes: number,
  edges: number,
  includesSystemAnalysis: boolean = true
): { nodeAnalysis: number; systemAnalysis: number; total: number } => {
  // Phase 1: Individual node analysis
  // Each node gets analyzed with its connections (~150 tokens per node)
  const nodeAnalysis = nodes * 150;
  
  // Phase 2: System-level analysis
  // Consolidates all threats and generates attack paths (~500 tokens base + 50 per node)
  const systemAnalysis = includesSystemAnalysis ? 500 + (nodes * 50) : 0;
  
  // Total
  const total = nodeAnalysis + systemAnalysis;
  
  return {
    nodeAnalysis,
    systemAnalysis,
    total
  };
};

// Time estimation for node-by-node analysis
export const estimateNodeByNodeTime = (
  nodes: number,
  provider: string = 'local'
): { nodeAnalysis: number; systemAnalysis: number; total: number } => {
  // Time per node varies by provider
  const timePerNode = provider === 'local' ? 3 : 2; // seconds
  const systemAnalysisTime = provider === 'local' ? 15 : 10; // seconds
  
  // Phase 1: Node analysis
  const nodeAnalysis = nodes * timePerNode;
  
  // Phase 2: System analysis (fixed time)
  const systemAnalysis = systemAnalysisTime;
  
  // Add overhead
  const overhead = 3;
  const total = nodeAnalysis + systemAnalysis + overhead;
  
  return {
    nodeAnalysis,
    systemAnalysis,
    total
  };
};

// Check if estimated tokens fit within context window
export const checkTokenFit = (
  estimatedTokens: number,
  maxContextTokens?: number,
  bufferPercentage: number = 0.9 // Use 90% of context to leave room
): { fits: boolean; percentage: number; availableTokens: number } => {
  const context = maxContextTokens ?? GLOBAL_CONTEXT_WINDOW;
  const availableTokens = Math.floor(context * bufferPercentage);
  const percentage = (estimatedTokens / availableTokens) * 100;
  
  return {
    fits: estimatedTokens <= availableTokens,
    percentage: Math.min(percentage, 100),
    availableTokens
  };
};

// Estimate how many nodes can fit in a given context window
export const estimateMaxNodes = (
  maxContextTokens: number,
  averageEdgesPerNode: number = 3,
  bufferPercentage: number = 0.9
): number => {
  const availableTokens = Math.floor(maxContextTokens * bufferPercentage);
  
  // Account for system analysis overhead (500 tokens base)
  const systemOverhead = 500;
  const tokensForNodes = availableTokens - systemOverhead;
  
  // Each node takes ~150 tokens + its edges (20 tokens each)
  const tokensPerNode = 150 + (averageEdgesPerNode * 20);
  
  return Math.max(1, Math.floor(tokensForNodes / tokensPerNode));
}; 