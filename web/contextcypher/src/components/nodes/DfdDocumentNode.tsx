/**
 * DfdDocumentNode - printable "document" style node renderer.
 *
 * When the active theme has `documentStyle` (the Document/DFD theme), nodes
 * render as traditional threat-model notation — ink shapes on paper with
 * reference codes — instead of the icon/neon presentation:
 *
 *   - dfdActor         -> rectangle           (A01)
 *   - dfdProcess       -> ellipse             (P01)
 *   - dfdDataStore     -> cylinder            (DS01)
 *   - dfdTrustBoundary -> dashed rounded rect (TB01)
 *   - any other type   -> rounded rectangle with a small type caption
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Theme } from '../../styles/Theme';
import { useDiagramLens, summarizeNodeFindings, severityColor } from '../../contexts/DiagramLensContext';

interface DfdDocumentNodeProps {
  nodeId: string;
  data: any;
  selected?: boolean;
  type: string;
  theme: Theme;
  isDrawingEditMode?: boolean;
}

const NODE_SIZES: Record<string, { width: number; height: number }> = {
  dfdActor: { width: 150, height: 64 },
  dfdProcess: { width: 130, height: 90 },
  dfdDataStore: { width: 140, height: 84 },
  dfdTrustBoundary: { width: 260, height: 170 },
  default: { width: 150, height: 64 }
};

const handleStyle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '50%',
  cursor: 'crosshair',
  zIndex: 10,
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'auto'
};

const NodeHandles: React.FC = () => (
  <>
    <Handle type="target" position={Position.Top} id="top" className="modern-handle" style={{ ...handleStyle, left: '50%', top: -5 }} />
    <Handle type="source" position={Position.Top} id="top" className="modern-handle" style={{ ...handleStyle, left: '50%', top: -5 }} />
    <Handle type="target" position={Position.Right} id="right" className="modern-handle" style={{ ...handleStyle, top: '50%', right: -5 }} />
    <Handle type="source" position={Position.Right} id="right" className="modern-handle" style={{ ...handleStyle, top: '50%', right: -5 }} />
    <Handle type="target" position={Position.Bottom} id="bottom" className="modern-handle" style={{ ...handleStyle, left: '50%', bottom: -5 }} />
    <Handle type="source" position={Position.Bottom} id="bottom" className="modern-handle" style={{ ...handleStyle, left: '50%', bottom: -5 }} />
    <Handle type="target" position={Position.Left} id="left" className="modern-handle" style={{ ...handleStyle, top: '50%', left: -5 }} />
    <Handle type="source" position={Position.Left} id="left" className="modern-handle" style={{ ...handleStyle, top: '50%', left: -5 }} />
  </>
);

/** Short human caption for non-DFD types shown under the label, e.g. "waf" -> "WAF". */
const typeCaption = (type: string): string =>
  type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());

export const DfdDocumentNode: React.FC<DfdDocumentNodeProps> = ({
  nodeId,
  data,
  selected,
  type,
  theme,
  isDrawingEditMode
}) => {
  const colors = theme.colors as any;
  const { lens, pathNodeSteps, pathActive } = useDiagramLens();
  const findings = summarizeNodeFindings(data?.securityContext?.threats);
  const pathStep = pathNodeSteps.get(nodeId);
  const dimmedByPath = pathActive && pathStep === undefined;
  const ink: string = colors.ink || colors.textPrimary;
  const inkSecondary: string = colors.inkSecondary || colors.textSecondary;
  const paper: string = colors.paper || colors.nodeBg;
  const selectedColor: string = colors.primary;

  const size = NODE_SIZES[type] || NODE_SIZES.default;
  const label: string = data.label || type;
  const refCode: string = data.indexCode || '';
  const isBoundary = type === 'dfdTrustBoundary';
  const isDfd = type.startsWith('dfd');

  const strokeColor = selected ? selectedColor : ink;
  const strokeWidth = selected ? 2 : 1.25;

  // Lens overlays: finding badge (threats), treatment badge (controls),
  // numbered step marker + dimming (attackPath)
  const lensOverlays = (
    <>
      {lens === 'threats' && findings.count > 0 && (
        <div
          title={`${findings.count} finding${findings.count === 1 ? '' : 's'}`}
          style={{
            position: 'absolute',
            top: -9,
            right: -9,
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 9,
            backgroundColor: severityColor(findings.maxSeverity, colors),
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Helvetica, Arial, sans-serif',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
            zIndex: 5
          }}
        >
          {findings.count}
        </div>
      )}
      {lens === 'controls' && findings.count > 0 && (
        <div
          title={`${findings.mitigatedCount} mitigated · ${findings.acceptedCount} accepted · ${findings.openCount} open`}
          style={{
            position: 'absolute',
            top: -9,
            right: -9,
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 9,
            backgroundColor: findings.openCount === 0
              ? (findings.mitigatedCount > 0 ? (colors.severityLow || '#16A34A') : (colors.inkSecondary || '#6B7280'))
              : severityColor(findings.maxSeverity, colors),
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Helvetica, Arial, sans-serif',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
            zIndex: 5
          }}
        >
          {findings.openCount === 0 ? '✓' : findings.openCount}
        </div>
      )}
      {pathActive && pathStep !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: -11,
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: colors.scopeHighlight || '#990099',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Helvetica, Arial, sans-serif',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 6
          }}
        >
          {pathStep}
        </div>
      )}
    </>
  );

  const labelBlock = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '6px 10px',
        pointerEvents: 'none',
        fontFamily: 'Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
        color: ink,
        zIndex: 2
      }}
    >
      <div style={{ fontSize: 12, lineHeight: 1.25, wordBreak: 'break-word' }}>{label}</div>
      {refCode && (
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{refCode}</div>
      )}
      {!isDfd && (
        <div style={{ fontSize: 9, color: inkSecondary, marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {typeCaption(type)}
        </div>
      )}
    </div>
  );

  // Trust boundary: dashed translucent container, label pinned top-left.
  if (isBoundary) {
    return (
      <div
        className={`dfd-document-node ${selected ? 'selected' : ''}`}
        style={{
          width: size.width,
          height: size.height,
          position: 'relative',
          borderRadius: 10,
          border: `1.5px dashed ${selected ? selectedColor : colors.dfdBoundaryStroke || ink}`,
          backgroundColor: colors.dfdBoundaryFill || 'transparent',
          opacity: dimmedByPath ? 0.35 : 1,
          transition: 'opacity 0.2s ease',
          ...(isDrawingEditMode ? { pointerEvents: 'none', opacity: 0.7 } : {})
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 10,
            fontFamily: 'Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: colors.dfdBoundaryStroke || ink,
            pointerEvents: 'none'
          }}
        >
          {label}{refCode ? ` · ${refCode}` : ''}
        </div>
        {lensOverlays}
        <NodeHandles />
      </div>
    );
  }

  // Shape outline per element type
  let shapeSvg: React.ReactNode = null;
  if (type === 'dfdProcess') {
    shapeSvg = (
      <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <ellipse
          cx={size.width / 2}
          cy={size.height / 2}
          rx={size.width / 2 - 2}
          ry={size.height / 2 - 2}
          fill={paper}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  } else if (type === 'dfdDataStore') {
    const capH = 12; // cylinder cap height
    const w = size.width;
    const h = size.height;
    shapeSvg = (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <path
          d={`M 2 ${capH} A ${w / 2 - 2} ${capH - 2} 0 0 1 ${w - 2} ${capH} L ${w - 2} ${h - capH} A ${w / 2 - 2} ${capH - 2} 0 0 1 2 ${h - capH} Z`}
          fill={paper}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        <ellipse cx={w / 2} cy={capH} rx={w / 2 - 2} ry={capH - 2} fill={paper} stroke={strokeColor} strokeWidth={strokeWidth} />
      </svg>
    );
  }

  const isRectangle = !shapeSvg;

  return (
    <div
      className={`dfd-document-node ${selected ? 'selected' : ''}`}
      style={{
        width: size.width,
        height: size.height,
        position: 'relative',
        ...(isRectangle
          ? {
              borderRadius: 6,
              border: `${strokeWidth}px solid ${strokeColor}`,
              backgroundColor: paper,
              boxShadow: selected ? `0 0 0 3px ${selectedColor}22` : '0 1px 2px rgba(0,0,0,0.08)'
            }
          : {}),
        opacity: dimmedByPath ? 0.35 : 1,
        transition: 'opacity 0.2s ease',
        ...(isDrawingEditMode ? { pointerEvents: 'none', opacity: 0.7 } : {})
      }}
    >
      {shapeSvg}
      {labelBlock}
      {lensOverlays}
      <NodeHandles />
    </div>
  );
};

export default DfdDocumentNode;
