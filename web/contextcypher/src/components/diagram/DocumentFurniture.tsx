/**
 * DocumentFurniture - on-canvas legend ("Key") and document info blocks for
 * the printable Document (DFD) theme, modeled on practitioner threat model
 * documents. Rendered as ReactFlow panels so they are always visible and are
 * captured by image exports.
 */

import React from 'react';
import { Panel } from '@xyflow/react';
import type { Theme } from '../../styles/Theme';

interface DocumentFurnitureProps {
  theme: Theme;
  systemName: string;
  showLegend?: boolean;
  showDocumentInfo?: boolean;
}

const blockStyle = (ink: string): React.CSSProperties => ({
  fontFamily: 'Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
  fontSize: 11,
  color: ink,
  background: '#ffffff',
  border: '1.5px solid #999999',
  borderRadius: 6,
  padding: '8px 12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  pointerEvents: 'none',
  userSelect: 'none'
});

const headingStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#00994D',
  fontSize: 11,
  marginBottom: 6,
  letterSpacing: '0.3px'
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4
};

export const DocumentFurniture: React.FC<DocumentFurnitureProps> = ({
  theme,
  systemName,
  showLegend = true,
  showDocumentInfo = true
}) => {
  const colors = theme.colors as any;
  const ink: string = colors.ink || '#3A414A';
  const boundary: string = colors.dfdBoundaryStroke || '#5B8DD9';
  const crossing: string = colors.flowCrossing || '#E81313';

  return (
    <>
      {showLegend && (
        <Panel position="bottom-left" style={{ margin: 12 }}>
          <div style={blockStyle(ink)} data-testid="document-legend">
            <div style={headingStyle}>Key</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 18 }}>
              <div>
                <div style={rowStyle}>
                  <span style={{ width: 22, height: 13, border: `1px solid ${ink}`, borderRadius: 2, flexShrink: 0 }} />
                  <span>Actor</span>
                </div>
                <div style={rowStyle}>
                  <span style={{ width: 18, height: 18, border: `1px solid ${ink}`, borderRadius: '50%', flexShrink: 0 }} />
                  <span>Process</span>
                </div>
                <div style={rowStyle}>
                  <svg width="20" height="18" viewBox="0 0 20 18" style={{ flexShrink: 0 }}>
                    <path d="M 1 4 A 9 3 0 0 1 19 4 L 19 14 A 9 3 0 0 1 1 14 Z" fill="none" stroke={ink} strokeWidth="1" />
                    <ellipse cx="10" cy="4" rx="9" ry="3" fill="none" stroke={ink} strokeWidth="1" />
                  </svg>
                  <span>Data Store</span>
                </div>
              </div>
              <div>
                <div style={rowStyle}>
                  <svg width="26" height="10" viewBox="0 0 26 10" style={{ flexShrink: 0 }}>
                    <line x1="0" y1="5" x2="20" y2="5" stroke={ink} strokeWidth="1.25" />
                    <path d="M 20 1.5 L 26 5 L 20 8.5 z" fill={ink} />
                  </svg>
                  <span>Data Flow</span>
                </div>
                <div style={rowStyle}>
                  <svg width="26" height="10" viewBox="0 0 26 10" style={{ flexShrink: 0 }}>
                    <line x1="0" y1="5" x2="26" y2="5" stroke={crossing} strokeWidth="2" strokeDasharray="5 4" />
                  </svg>
                  <span>Boundary Crossing</span>
                </div>
                <div style={rowStyle}>
                  <span style={{ width: 22, height: 13, border: `1.5px dashed ${boundary}`, borderRadius: 3, backgroundColor: colors.dfdBoundaryFill, flexShrink: 0 }} />
                  <span>Trust Boundary</span>
                </div>
                <div style={rowStyle}>
                  <span style={{ width: 22, height: 13, backgroundColor: colors.envControlled, border: '1px solid #6DB1FF', flexShrink: 0 }} />
                  <span>Controlled Env.</span>
                </div>
                <div style={rowStyle}>
                  <span style={{ width: 22, height: 13, backgroundColor: colors.envUncontrolled, border: '1px solid #FE7070', flexShrink: 0 }} />
                  <span>Uncontrolled Env.</span>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {showDocumentInfo && (
        <Panel position="bottom-right" style={{ margin: 12 }}>
          <div style={blockStyle(ink)} data-testid="document-info">
            <div style={headingStyle}>Document Information</div>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700, paddingRight: 12, paddingBottom: 2 }}>Project</td>
                  <td style={{ paddingBottom: 2 }}>{systemName || 'Untitled System'}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, paddingRight: 12, paddingBottom: 2 }}>Document Type</td>
                  <td style={{ paddingBottom: 2 }}>Cyber Security Threat Model</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, paddingRight: 12 }}>Last Updated</td>
                  <td>{new Date().toLocaleDateString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
};

export default DocumentFurniture;
