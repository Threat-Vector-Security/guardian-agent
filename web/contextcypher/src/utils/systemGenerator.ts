/**
 * Advanced Protocols for Generating Security System Diagrams
 * 
 * 1. Zone Layout Protocol & Architecture Patterns:
 *    - **Multi-Dimensional Layout**: Zones can be arranged in horizontal, vertical, and hybrid layouts to optimize edge flow and demonstrate realistic security architectures.
 *    - **Architecture Pattern Templates**:
 *      a) **Traditional Enterprise**: Internet → DMZ → Internal → Restricted → Critical
 *      b) **DevOps Pipeline**: Development → Staging → Production → Trusted (with Cloud above)
 *      c) **Industrial/OT**: External → DMZ → OT → Critical (air-gapped) + Compliance
 *      d) **Zero Trust**: Multiple micro-zones with security checkpoints between each
 *      e) **Hybrid Cloud**: On-premises zones + multiple Cloud zones (AWS, Azure, GCP)
 *      f) **Service Mesh**: Container zones with sidecar security proxies
 *      g) **Hub-and-Spoke**: Central security services with application spokes
 *      h) **Layered Defense**: Multiple security zones in depth with overlapping controls
 *    - **Zone Relationship Rules**:
 *      a) **Internet/External** → Always connects through DMZ (never direct to Internal)
 *      b) **Development** → Should connect to Staging → Production (CI/CD flow)
 *      c) **OT/Critical** → Should have air-gapped options or heavily controlled connections
 *      d) **Compliance** → Isolated zones for regulated data (PCI, HIPAA, SOX)
 *      e) **Cloud** → Can be positioned above/below for hybrid architectures
 *      f) **Guest** → Typically below main flow for visitor/contractor access
 *    - **Available Security Zones**: Internet, External, DMZ, Internal, Trusted, Restricted, Critical, OT, Development, Staging, Production, Cloud, Guest, Compliance
 *    - **Standard zone dimensions**: 650px width × 1000px height (consistent for uniformity).
 *    - **Zone spacing**: 120px minimum between adjacent zones (horizontal and vertical).
 *    - **Layout Templates & Positioning**:
 *      a) **5-Zone Horizontal**: x: 50, 820, 1590, 2360, 3130 (enterprise progression)
 *      b) **Vertical Stack**: y: 50 (primary), -1070 (above), 1170 (below), 2290 (far below)
 *      c) **L-Shape**: Horizontal primary + vertical secondary (DevOps, Cloud hybrid)
 *      d) **Hub-Spoke**: Central zone at (1590, 50) with spokes at cardinal positions
 *      e) **Multi-tier**: 3 rows - Cloud(-1070), Primary(50), Management(1170)
 *      f) **Air-gapped**: Isolated zones with no connections (Critical systems)
 *    - **Zone Flow Patterns**:
 *      a) **Security Progression**: Lower trust → Higher trust (left to right)
 *      b) **Development Lifecycle**: Dev → Test → Prod (with approval gates)
 *      c) **Data Classification**: Public → Internal → Confidential → Restricted
 *      d) **Network Segmentation**: Perimeter → Application → Data → Management
 *    - **Auto-sizing**: Zones should expand to comfortably fit all assigned nodes with proper spacing.
 *    - **Zone Validation**: Ensure zones don't overlap and maintain minimum spacing.
 * 
 * 2. Enhanced Node Placement Protocol with Grid System:
 *    - **Grid System**: All nodes should align to a 50px grid for consistent spacing and professional appearance:
 *      a) Grid unit: 50px (all positions should be multiples of 50)
 *      b) Node dimensions: 150px width × 100px height (3×2 grid units)
 *      c) Grid columns per zone: 12 columns (650px zone width / 50px = 13 units)
 *      d) Usable columns: 12 (leaving 1 unit for margins)
 *    - **Critical Rule**: All nodes MUST be positioned within their designated security zone boundaries.
 *    - **Grid-aligned spacing**: 
 *      a) Minimum horizontal spacing: 200px (4 grid units)
 *      b) Minimum vertical spacing: 150px (3 grid units)
 *      c) Nodes with multiple connections: 250px (5 grid units) minimum
 *    - **Security controls positioning**: Firewalls and security devices should be positioned:
 *      a) On zone boundaries (at the edge between zones) when they control cross-zone traffic
 *      b) Within the zone they protect when they are zone-specific controls
 *    - **Grid-aligned component tiers**: Group by function on grid rows:
 *      a) Infrastructure components (routers, firewalls): y: 150-300px (rows 3-6)
 *      b) Application components (web servers, app servers): y: 350-600px (rows 7-12)
 *      c) Data components (databases, storage): y: 650-850px (rows 13-17)
 *      d) Monitoring/Support components: y: 900px+ (rows 18+)
 *    - **Grid positioning examples**:
 *      a) Left-aligned in zone: x: zone_x + 100 (2 grid units from edge)
 *      b) Center-aligned in zone: x: zone_x + 250 (centered with 5 units each side)
 *      c) Right-aligned in zone: x: zone_x + 400 (8 units from left, 2 from right)
 *    - **Zone compliance verification**: Before finalizing positions, verify each node's x-coordinate falls within its zone's boundaries and aligns to the 50px grid.
 *    - **Connection density consideration**: Nodes with 3+ connections need extra spacing (300px/6 grid units minimum).
 *    - **Edge Overlap Prevention**: 
 *      a) Offset nodes vertically by 50-100px (1-2 grid units) when they have parallel connections
 *      b) Use different handle positions (top/bottom vs left/right) for multiple connections
 *      c) Stagger node positions on different grid columns to create natural edge separation
 * 
 * 3. Connection Protocol:
 *    - All cross-zone traffic should pass through security controls.
 *    - **Multi-Directional Flow**: Connections can flow horizontally, vertically, and diagonally based on zone layout.
 *    - **Primary Flow Patterns**:
 *      a) Horizontal: Core security progression (Internet → DMZ → Internal)
 *      b) Vertical: Cloud services (Internal ↔ Cloud above) or Guest services (DMZ ↔ Guest below)
 *      c) Diagonal: Cross-quadrant connections (Guest to Cloud, OT to Cloud)
 *    - All connections must be clearly labeled with their purpose or protocol.
 *    - **Edge Crossing Minimization**:
 *      a) Position related zones closer together (e.g., Cloud above Internal/Production)
 *      b) Use vertical connections for zones positioned above/below each other
 *      c) Avoid routing connections through unrelated zones
 *    - **Parallel Edge Prevention**: When multiple edges go in the same direction:
 *      a) Use vertical offset between source nodes (minimum 50px)
 *      b) Alternate handle positions (top/bottom for vertical, left/right for horizontal)
 *      c) Consider using intermediate routing nodes for complex flows
 * 
 * 4. Enhanced Vulnerability Integration Philosophy:
 *    - **Primary Goal**: Create realistic example systems with inherent, subtle vulnerabilities that the AI can discover through analysis. The system should not explicitly state what is a vulnerability.
 *    - **Vulnerability Categories**: 
 *      a) **Configuration Weaknesses**: Default passwords, open ports, weak encryption
 *      b) **Architectural Flaws**: Missing segmentation, direct database access, bypass paths
 *      c) **Missing Controls**: No monitoring, weak authentication, unencrypted communications
 *      d) **Operational Gaps**: Shared accounts, excessive privileges, poor change management
 *      e) **Compliance Violations**: Regulatory requirement gaps, audit trail deficiencies
 *      f) **Zero Trust Violations**: Implicit trust relationships, lateral movement paths
 *    - **Realism Principles**:
 *      a) **Common Mistakes**: Reflect actual security incidents and penetration test findings
 *      b) **Legacy Integration**: Show challenges of integrating old and new systems
 *      c) **Operational Pressure**: Demonstrate security vs. usability trade-offs
 *      d) **Resource Constraints**: Show impact of limited security budgets and staffing
 *    - **Discovery Mechanisms**: The AI should identify vulnerabilities through:
 *      a) **Component Analysis**: Version checks, configuration review, protocol analysis
 *      b) **Connection Patterns**: Unusual flows, missing security controls, trust boundaries
 *      c) **Zone Violations**: Inappropriate cross-zone access, missing segmentation
 *      d) **Control Gaps**: Missing monitoring, logging, encryption, authentication
 *    - **Educational Value**: Systems should demonstrate both exemplary security practices and realistic improvement opportunities.
 *    - **Subtlety**: The aim is to have a mix of subtle and more apparent issues that a security professional would identify during a threat modeling exercise. Avoid making all issues obvious.
 *    - **Developer-Facing Comments**: Code comments within the example system TypeScript files that detail vulnerabilities are acceptable for developer reference, as they are not visible to the AI during analysis.
 *
 * 5. Custom Context Protocol:
 *    - **Perspective**: The `customContext` field provides a narrative for the system, written from the perspective of an architect or system owner.
 *    - **Content**: It should include system overview, technical architecture, business requirements, and operational considerations.
 *    - **Implicit Clues**: It must NOT explicitly list security issues or use the word "vulnerability". Instead, describe configurations factually. These descriptions can serve as clues. For example:
 *      - "- Default error pages enabled showing system information"
 *      - "- Shared admin account used for emergency access"
 *      - "- Remote debugging enabled on port 8000"
 *    - **Formatting**: Format as markdown for readability.
 *
 * 6. Handle Connection Protocol:
 *    - Each node and security zone has 4 handles for precise connections.
 *    - **Intelligent Handle Selection**: The system automatically selects the best handles based on node positions.
 *    - **Position-Based Logic**: For same-zone connections, handles are chosen based on relative positions (closest sides).
 *    - **Zone-Aware Logic**: For cross-zone connections, considers both zone flow and physical positioning.
 *    - Handle IDs follow the pattern: "{position}-{type}" (e.g., "right-source", "left-target").
 *    - **Manual Override**: Explicitly specify sourceHandle and targetHandle in connections to override automatic selection.
 *    - Connection Rules:
 *      - Only source → target connections are valid.
 *      - Same-node connections are not allowed.
 *      - Connections automatically choose the shortest visual path between nodes.
 *
 * 7. Advanced Layout Optimization & Common Mistakes:
 *    - **Zone Boundary Compliance**: Ensure all components are within their designated zone boundaries
 *    - **Edge Crossing Minimization**: Use strategic node placement and zone arrangement to reduce connection overlaps
 *    - **Density Management**: Maintain adequate spacing (200px horizontal, 150px vertical minimum)
 *    - **Grid Alignment**: All nodes must align to 50px grid system for professional appearance
 *    - **Connection Flow Logic**: Connections should follow realistic network paths and security policies
 *    - **Visual Hierarchy**: Use consistent spacing patterns and component grouping
 *    - **Zone Utilization**: Optimize zone space usage without overcrowding
 *    - **Security Control Placement**: Position firewalls and security devices at appropriate zone boundaries
 * 
 * 8. Architecture Pattern Examples:
 *    - **Enterprise Data Center**: External → DMZ → Internal → Restricted → Critical + Cloud above
 *    - **DevOps Platform**: Development → Staging → Production → Trusted + Guest below
 *    - **Industrial Control**: External → DMZ → OT → Critical (air-gapped) + Compliance
 *    - **Zero Trust Network**: Multiple micro-zones with security checkpoints
 *    - **Hybrid Cloud**: On-premises zones + AWS/Azure/GCP zones positioned strategically
 *    - **Service Mesh**: Container zones with sidecar proxies and central control plane
 * 
 * 9. Comprehensive Quality Checklist:
 *    - [ ] **Zone Layout**: All zones 650×1000px with 120px spacing, no overlaps
 *    - [ ] **Grid Alignment**: All nodes align to 50px grid (positions divisible by 50)
 *    - [ ] **Node Spacing**: 200px horizontal, 150px vertical minimum between nodes
 *    - [ ] **Security Progression**: Zone flow follows logical trust boundaries
 *    - [ ] **Component Tiers**: Infrastructure, application, data, management layers clearly defined
 *    - [ ] **Connection Logic**: All connections follow realistic network and security policies
 *    - [ ] **Edge Separation**: Multiple connections between nodes are visually distinct
 *    - [ ] **High-density Nodes**: Nodes with 3+ connections have 250-300px spacing
 *    - [ ] **Visual Clarity**: No congestion, all labels and edges readable
 *    - [ ] **Security Controls**: Firewalls, IDS/IPS positioned at appropriate boundaries
 *    - [ ] **Vulnerability Integration**: Realistic security gaps for AI discovery
 *    - [ ] **Architecture Pattern**: Follows established pattern (Enterprise, DevOps, Industrial, etc.)
 *    - [ ] **Node Type Registration**: All new node types are properly registered (see section 10)
 * 
 * 10. Node Type Registration Protocol (CRITICAL for new node types):
 *    When creating a new node type that hasn't been used before, you MUST register it in ALL of the following locations:
 *    
 *    a) **SecurityTypes.ts** - Add the node type to the appropriate type union:
 *       - InfrastructureNodeType (for infrastructure components like 'user')
 *       - ApplicationNodeType (for application components)
 *       - CloudNodeType (for cloud services like 'search')
 *       - OTNodeType (for OT/SCADA components)
 *       - AIMLNodeType (for AI/ML components)
 *       Also add default security settings in nodeSecurityDefaults
 *    
 *    b) **Theme.ts** - Add a color for the node type:
 *       - Add to the colors object (e.g., userColor: '#42a5f5')
 *       - Choose a distinct Material Design color that fits the category
 *    
 *    c) **materialIconMappings.ts** - Add icon mapping:
 *       - Import the appropriate Material-UI icon
 *       - Add to materialIconMappings object with icon, name, and category
 *    
 *    d) **NodeToolbox.tsx** - Add to the appropriate category:
 *       - Find the right category section (Infrastructure, Cloud Services, etc.)
 *       - Add node configuration with type, label, description, color, and icon
 *    
 *    e) **SecurityNodes.tsx** - Add to nodeTypeConfig and exports:
 *       - Add to nodeTypeConfig object with icon and color references
 *       - Add to the export destructuring list (e.g., UserNode, SearchNode)
 *       - Place in the appropriate section matching the node category
 *    
 *    **Example**: When adding 'user' and 'search' node types:
 *    - 'user' → InfrastructureNodeType, userColor, PersonIcon, Infrastructure category
 *    - 'search' → CloudNodeType, searchColor, SearchIcon, Cloud Services category
 *    
 *    **Verification**: After adding a new node type, run 'npm run build' to ensure:
 *    - TypeScript compilation succeeds
 *    - No missing icon or color references
 *    - Node appears correctly in the toolbox
 *    - Node renders with proper styling on the canvas
 */

//src/utils/systemGenerator.ts
import { 
  SecurityNode, 
  SecurityEdge, 
  SecurityZone,
  DataClassification 
} from '../types/SecurityTypes';

interface ZoneLayout {
  id: string;
  zoneType: SecurityZone;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
}

interface NodePlacement {
  id: string;
  type: string;
  x: number;
  y: number;
  data: {
    label: string;
    description: string;
    zone: SecurityZone;
    // securityLevel removed - no longer part of the data model
    dataClassification: DataClassification;
    [key: string]: any;
  };
}

interface Connection {
  source: string;
  target: string;
  sourceHandle?: string;  // Optional: Specify exact handle for source
  targetHandle?: string;  // Optional: Specify exact handle for target
  label: string;
  protocol?: string;
  encryption?: string;
  description?: string;
  portRange?: string;
  dataClassification?: string;
  securityControls?: string[];
  bandwidth?: string;
  latency?: string;
  redundancy?: boolean;
}

export function generateSecuritySystem(
  name: string,
  description: string,
  zoneLayouts: ZoneLayout[],
  nodePlacements: NodePlacement[],
  connections: Connection[]
) {
  // Minimum dimensions for zones to ensure they are always resizable and edit button is accessible
  const MIN_ZONE_WIDTH = 300;
  const MIN_ZONE_HEIGHT = 200;
  
  // Generate security zones with validated dimensions
  const zones = zoneLayouts.map(zone => ({
    id: zone.id,
    type: 'securityZone' as const,
    position: { x: zone.x, y: zone.y },
    data: {
      label: zone.zoneType,
      zoneType: zone.zoneType,
      description: zone.description
    },
    style: {
      width: Math.max(MIN_ZONE_WIDTH, zone.width),
      height: Math.max(MIN_ZONE_HEIGHT, zone.height),
      zIndex: -1
    }
  })) as SecurityNode[];

  // Generate nodes
  const nodes = nodePlacements.map(node => ({
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    data: node.data
  })) as SecurityNode[];

  // Enhanced zone spacing for better edge visibility
  // const ZONE_SPACING = 120; // Increased from 100px to 120px for busy diagrams - Not currently used
  // const NODE_SPACING_MIN = 200; // Minimum horizontal spacing between nodes - Not currently used
  // const NODE_SPACING_VERTICAL = 150; // Minimum vertical spacing between nodes - Not currently used
  // const BUSY_NODE_SPACING = 250; // Extra spacing for nodes with multiple connections - Not currently used

  // Intelligent connection handle selection based on node positions
  const getConnectionHandles = (
    sourceNode: NodePlacement,
    targetNode: NodePlacement
  ): { sourceHandle: string; targetHandle: string } => {
    const dx = targetNode.x - sourceNode.x;  // Horizontal distance
    const dy = targetNode.y - sourceNode.y;  // Vertical distance
    
    // Determine primary direction (horizontal vs vertical)
    const isHorizontalPrimary = Math.abs(dx) > Math.abs(dy);
    
    let sourceHandle: string;
    let targetHandle: string;
    
    if (isHorizontalPrimary) {
      // Horizontal connection is primary
      if (dx > 0) {
        // Target is to the right of source
        sourceHandle = 'right';
        targetHandle = 'left';
      } else {
        // Target is to the left of source
        sourceHandle = 'left';
        targetHandle = 'right';
      }
    } else {
      // Vertical connection is primary
      if (dy > 0) {
        // Target is below source
        sourceHandle = 'bottom';
        targetHandle = 'top';
      } else {
        // Target is above source
        sourceHandle = 'top';
        targetHandle = 'bottom';
      }
    }
    
    return { sourceHandle, targetHandle };
  };

  // Enhanced zone-aware connection logic for cross-zone traffic
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getZoneAwareHandles = (
    sourceNode: NodePlacement,
    targetNode: NodePlacement
  ): { sourceHandle: string; targetHandle: string } => {
    const sourceZone = sourceNode.data.zone;
    const targetZone = targetNode.data.zone;
    
    // If same zone, use position-based logic
    if (sourceZone === targetZone) {
      return getConnectionHandles(sourceNode, targetNode);
    }
    
    // For cross-zone connections, consider zone flow and position
    const zoneOrder = ['Internet', 'External', 'Guest', 'DMZ', 'Internal', 'Trusted', 'OT', 'Development', 'Staging', 'Production', 'Restricted', 'Critical', 'Cloud', 'Compliance'];
    const sourceIndex = zoneOrder.indexOf(sourceZone);
    const targetIndex = zoneOrder.indexOf(targetZone);
    
    // If zones are in logical order, prefer horizontal flow
    if (sourceIndex !== -1 && targetIndex !== -1 && Math.abs(sourceIndex - targetIndex) <= 2) {
      if (targetIndex > sourceIndex) {
        // Moving right in logical zone flow
        return {
          sourceHandle: 'right',
          targetHandle: 'left'
        };
      } else {
        // Moving left in logical zone flow
        return {
          sourceHandle: 'left',
          targetHandle: 'right'
        };
      }
    }
    
    // Fallback to position-based logic for non-sequential zones
    return getConnectionHandles(sourceNode, targetNode);
  };

  // Update the edge generation with intelligent handle selection
  const edges = connections.map((conn, index) => {
    const sourceNode = nodePlacements.find(n => n.id === conn.source);
    const targetNode = nodePlacements.find(n => n.id === conn.target);
    
    if (!sourceNode || !targetNode) {
      console.warn(`Missing node for connection: ${conn.source} -> ${conn.target}`);
      // Fallback handles
      return {
        id: `edge-${index}`,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle || undefined,
        targetHandle: conn.targetHandle || undefined,
        type: 'securityEdge',
        data: {
          label: conn.label,
          protocol: conn.protocol || 'any',
          encryption: conn.encryption || 'none',
          description: conn.description,
          dataClassification: conn.dataClassification || 'Internal',
          portRange: conn.portRange,
          securityControls: conn.securityControls,
          bandwidth: conn.bandwidth,
          latency: conn.latency,
          redundancy: conn.redundancy,
          zone: 'Internal'
        }
      };
    }
    
    // Use intelligent handle selection based on node positions
    const handles = conn.sourceHandle && conn.targetHandle 
      ? { sourceHandle: conn.sourceHandle, targetHandle: conn.targetHandle }
      : getConnectionHandles(sourceNode, targetNode);

    // Determine edge zone using proper cross-zone rules
    const getEdgeZone = (sourceZone: SecurityZone, targetZone: SecurityZone): SecurityZone => {
      // If same zone, use that zone
      if (sourceZone === targetZone) {
        return sourceZone;
      }
      
      // For cross-zone connections, use the more secure/restricted zone
      const zoneHierarchy: Record<string, number> = {
        'Internet': 0, 'External': 1, 'Guest': 2, 'DMZ': 3, 
        'Internal': 4, 'Trusted': 5, 'Development': 6, 'Staging': 7,
        'Production': 8, 'OT': 9, 'Restricted': 10, 'Critical': 11,
        'Cloud': 5, 'Compliance': 10, 'Generic': 4
      };
      
      const sourceLevel = zoneHierarchy[sourceZone] ?? 4;
      const targetLevel = zoneHierarchy[targetZone] ?? 4;
      
      // Return the zone with higher security level (more restricted)
      return sourceLevel > targetLevel ? sourceZone : targetZone;
    };

    const edgeZone = getEdgeZone(sourceNode.data.zone, targetNode.data.zone);
    
    return {
      id: `edge-${index}`,
      source: conn.source,
      target: conn.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'securityEdge',
      data: {
        label: conn.label,
        protocol: conn.protocol || 'any',
        encryption: conn.encryption || 'none',
        description: conn.description,
        dataClassification: conn.dataClassification || 'Internal',
        portRange: conn.portRange,
        securityControls: conn.securityControls,
        bandwidth: conn.bandwidth,
        latency: conn.latency,
        redundancy: conn.redundancy,
        zone: edgeZone
      }
    };
  }) as SecurityEdge[];

  return {
    nodes: [...zones, ...nodes],
    edges
  };
}

// Example usage with multi-dimensional layout:
// const hybridCloudSystem = generateSecuritySystem( // Not currently used - example code
//   'Hybrid Cloud Platform',
//   'Multi-tier application with cloud services integration',
//   [
//     // Primary horizontal flow
//     {
//       id: 'internet-zone',
//       zoneType: 'Internet',
//       x: 50,
//       y: 50,
//       width: 650,
//       height: 1000,
//       description: 'External network zone'
//     },
//     {
//       id: 'dmz-zone',
//       zoneType: 'DMZ',
//       x: 820,  // 50 + 650 + 120
//       y: 50,
//       width: 650,
//       height: 1000,
//       description: 'Demilitarized zone'
//     },
//     {
//       id: 'internal-zone',
//       zoneType: 'Internal',
//       x: 1590, // 820 + 650 + 120
//       y: 50,
//       width: 650,
//       height: 1000,
//       description: 'Internal network zone'
//     },
//     // Cloud zone positioned above Internal to minimize edge crossings
//     {
//       id: 'cloud-zone',
//       zoneType: 'Cloud',
//       x: 1590, // Same x as Internal zone
//       y: -1070, // Above Internal zone (50 - 1000 - 120)
//       width: 650,
//       height: 1000,
//       description: 'Cloud services zone'
//     },
//     // Guest zone positioned below DMZ for public services
//     {
//       id: 'guest-zone',
//       zoneType: 'Guest',
//       x: 820, // Same x as DMZ zone
//       y: 1170, // Below DMZ zone (50 + 1000 + 120)
//       width: 650,
//       height: 1000,
//       description: 'Public guest services zone'
//     }
//   ],
//   [
//     // Network Infrastructure
//     {
//       id: 'edge-router',
//       type: 'router',
//       x: 350,  // Grid aligned: centered in 650px zone (x: 50 + 300)
//       y: 200,  // Grid aligned: infrastructure tier
//       data: {
//         label: 'Edge Router',
//         description: 'Internet Gateway',
//         zone: 'Internet',
//         // securityLevel removed - no longer part of the data model
//         dataClassification: 'Internal'
//       }
//     },
//     // ... more nodes
//   ],
//   [
//     // Connection examples - handles are automatically selected based on node positions
//     {
//       source: 'edge-router',
//       target: 'dmz-firewall',
//       label: 'Internet Traffic',
//       protocol: 'any',
//       encryption: 'none'
//       // No manual handles - automatically selects right-source -> left-target
//     },
//     {
//       source: 'web-server',
//       target: 'app-server',
//       label: 'HTTP/HTTPS',
//       protocol: 'TCP/443',
//       encryption: 'TLS'
//       // Automatically determines best handles based on node positions
//     },
//     {
//       source: 'app-server',
//       target: 'database',
//       label: 'Database Connection',
//       protocol: 'TCP/5432',
//       encryption: 'TLS'
//       // Uses zone-aware logic for cross-zone connections
//     },
//     {
//       source: 'load-balancer',
//       target: 'web-server',
//       sourceHandle: 'bottom',  // Manual override example
//       targetHandle: 'top',     // Explicitly specify handles when needed
//       label: 'Load Balanced Traffic',
//       protocol: 'HTTP',
//       encryption: 'none'
//     }
//   ]
// ); // End of commented hybridCloudSystem example 