import { AnalysisContext } from '../types/AnalysisTypes';
import { DiagramSanitizer } from '../services/ClientDiagramSanitizer';

/**
 * Sanitize user message and analysis context before sending to a PUBLIC LLM.
 * Local LLM requests should bypass this to preserve fidelity.
 */
export function sanitizeRequest(
  message: string,
  context: AnalysisContext
): { message: string; context: AnalysisContext } {
  // Clone objects to avoid mutating original references
  const clonedContext: AnalysisContext = JSON.parse(JSON.stringify(context));

  // 1. Sanitize user message
  const sanitizedMessage = DiagramSanitizer.sanitizeContextText(message);
  const eventReplacements: Array<{type:string;count:number}> = [];
  if (sanitizedMessage !== message) {
    eventReplacements.push({ type: 'message', count: 1 });
  }

  // 2. Sanitize custom context (string or object)
  if (clonedContext.customContext) {
    if (typeof clonedContext.customContext === 'string') {
      const original = clonedContext.customContext;
      const sanitized = DiagramSanitizer.sanitizeContextText(original);
      clonedContext.customContext = {
        content: sanitized,
        sanitizedContent: sanitized,
        timestamp: new Date()
      } as any;
      if (sanitized !== original) {
        eventReplacements.push({ type: 'customContext', count: 1 });
      }
    } else {
      const original = clonedContext.customContext.content || '';
      const sanitized = DiagramSanitizer.sanitizeContextText(original);
      clonedContext.customContext.sanitizedContent = sanitized;
      if (sanitized !== original) {
        eventReplacements.push({ type: 'customContext', count: 1 });
      }
      // Keep original for local reference but never transmit
      delete (clonedContext.customContext as any).content;
    }
  }

  // 3. Sanitize diagram nodes/edges via ClientDiagramSanitizer
  if (clonedContext.diagram) {
    const sanitizedDiagram = DiagramSanitizer.sanitize(clonedContext.diagram);
    console.log('Diagram sanitization result:', {
      hasReplacements: sanitizedDiagram.metadata.replacements?.length > 0,
      replacements: sanitizedDiagram.metadata.replacements
    });
    
    clonedContext.diagram = {
      nodes: sanitizedDiagram.nodes,
      edges: sanitizedDiagram.edges,
      metadata: {
        ...sanitizedDiagram.metadata,
      },
    } as any;

    // Notify UI layer about sanitisation so it can show a toast
    if (typeof window !== 'undefined') {
      const rep = sanitizedDiagram.metadata.replacements || [];
      rep.forEach(r => eventReplacements.push(r));
    }

  }

  // Mark payload as sanitized so backend can trust
  if (!clonedContext.metadata) clonedContext.metadata = {} as any;
  (clonedContext.metadata as any).isSanitized = true;

  console.log('Total event replacements before dispatch:', eventReplacements);
  
  // Fallback: dispatch notice even if only message/context sanitized (no diagram change)
  if (typeof window !== 'undefined' && eventReplacements.length > 0) {
    console.log('Dispatching sanitization-notice event:', eventReplacements);
    window.dispatchEvent(new CustomEvent('sanitization-notice', { detail: eventReplacements }));
  }

  return { message: sanitizedMessage, context: clonedContext };
} 