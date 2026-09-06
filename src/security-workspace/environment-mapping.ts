import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { AwsSecurityReport } from './aws-security.js';
import type { CollectorTelemetry } from './collectors.js';
import type { ContextDocument, ContextEdge, ContextNode } from './contextcypher.js';

export interface EnvironmentMapPreview {
  source: 'local' | 'aws';
  scope: string;
  collectedAt: number;
  coverage: Array<{ id: string; name: string; status: string; description: string }>;
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
  document: ContextDocument;
}

const text = (value: unknown): string => typeof value === 'string' ? value.slice(0, 500) : '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const stableId = (...parts: string[]) => `discovered-${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)}`;
const MAX_NEIGHBORS = 1000;

function node(id: string, type: string, label: string, index: number, evidence: ContextDocument): ContextNode {
  return { id, type, position: { x: (index % 5) * 320, y: Math.floor(index / 5) * 200 }, data: { label, description: 'Observed inventory. Review source evidence before drawing security conclusions.', discovery: evidence } };
}

function preview(source: 'local' | 'aws', scope: string, name: string, collectedAt: number, nodes: ContextNode[], edges: ContextEdge[], coverage: EnvironmentMapPreview['coverage'], warnings: string[]): EnvironmentMapPreview {
  return { source, scope, collectedAt, nodeCount: nodes.length, edgeCount: edges.length, coverage, warnings,
    document: { systemName: name, nodes, edges, metadata: { discovery: { source, scope, collectedAt, warnings, snapshot: true, relationshipSemantics: 'Only explicitly recorded associations are drawn. Edges do not prove traffic flow or reachability.' } } } };
}

/** Passive cache entries establish observations, not physical topology or a complete LAN. */
export function buildLocalEnvironmentMap(network: CollectorTelemetry, device: { id: string; name: string; platform: string }): EnvironmentMapPreview {
  if (!device.id || !Number.isFinite(network.collectedAt)) throw new Error('A recorded device identity and collection time are required.');
  const scope = `device:${device.id}`;
  const coverage = [{ id: 'network.neighbors', name: 'Passive neighbor cache', status: network.status, description: network.description }];
  const warnings = ['This is a passive neighbor-cache snapshot, not a complete LAN map. Device roles, gateways, switches, reachability and security posture are not inferred.', 'Cache entries can be stale. Multicast, unspecified and incomplete entries are omitted. Socket peers are not assumed to be LAN devices.'];
  const data = record(network.data);
  if (!Array.isArray(data.neighbors)) throw new Error('No neighbor inventory is available. Run a workstation check and review its coverage first.');
  const nodes: ContextNode[] = [node(stableId(scope, 'host'), 'workstation', device.name, 0, { source: 'guardian.device', sourceId: device.id, platform: device.platform, observedAt: network.collectedAt })];
  const edges: ContextEdge[] = [];
  const unique = new Set<string>();
  const neighbors = data.neighbors.map(record).sort((a, b) => JSON.stringify([a.IPAddress ?? a.address ?? a.dst, a.InterfaceIndex ?? a.interface ?? a.dev]).localeCompare(JSON.stringify([b.IPAddress ?? b.address ?? b.dst, b.InterfaceIndex ?? b.interface ?? b.dev])));
  for (const item of neighbors) {
    const address = text(item.IPAddress ?? item.address ?? item.dst);
    const ipVersion = isIP(address);
    const states = Array.isArray(item.state) ? item.state.map(text).join(',') : String(item.State ?? item.state ?? '').slice(0, 100);
    const mac = text(item.LinkLayerAddress ?? item.linkLayerAddress ?? item.lladdr);
    // Windows State is serialized either as its enum name or numeric value.
    if (!ipVersion || /incomplete|unreachable|failed/i.test(states) || states === '0' || states === '1') continue;
    if (address === '::' || address === '::1' || /^ff/i.test(address) || (ipVersion === 4 && (+address.split('.')[0] >= 224 || /^(0|127)\./.test(address)))) continue;
    if (!mac || /^(00[:-]){5}00$|^(ff[:-]){5}ff$/i.test(mac)) continue;
    const interfaceId = String(item.InterfaceIndex ?? item.interface ?? item.dev ?? 'unknown').slice(0, 100);
    const id = stableId(scope, interfaceId, address);
    if (unique.has(id)) continue;
    if (unique.size >= MAX_NEIGHBORS) { warnings.push(`The map is limited to ${MAX_NEIGHBORS} unique neighbors; more were observed.`); break; }
    unique.add(id);
    nodes.push(node(id, 'generic', address, nodes.length, { source: 'os.neighbor-cache', sourceId: `${interfaceId}:${address}`, observedAt: network.collectedAt, address, mac, interface: interfaceId, state: states, relationship: 'cache observation' }));
    edges.push({ id: stableId(scope, 'cache-entry', id), source: nodes[0].id, target: id, label: `Cached on interface ${interfaceId}`, data: { relationship: 'cache observation', observedAt: network.collectedAt, description: 'Entry in this workstation’s neighbor cache; not a physical cable or verified traffic flow.' } });
  }
  if (nodes.length === 1) warnings.push('No usable neighbor entries were observed. This does not mean that the LAN has no other devices.');
  return preview('local', scope, `${device.name} — observed local network`, network.collectedAt, nodes, edges, coverage, warnings);
}

/** Maps only the enrolled account/region and relationships present in collected EC2 records. */
export function buildAwsEnvironmentMap(report: AwsSecurityReport, scope: { accountId: string; region: string }): EnvironmentMapPreview {
  if (!/^\d{12}$/.test(scope.accountId) || report.accountId !== scope.accountId || report.region !== scope.region) throw new Error('AWS inventory does not match the enrolled account and region.');
  if (!report.coverage.some(item => item.id === 'aws.identity' && item.status === 'available')) throw new Error('AWS account identity was not verified. Collect the enrolled account first.');
  if (!report.resources || !Number.isFinite(report.collectedAt)) throw new Error('No AWS resource snapshot is available. Run AWS collection first.');
  const target = `aws:${scope.accountId}:${scope.region}`;
  const nodes: ContextNode[] = [];
  const edges: ContextEdge[] = [];
  const warnings = ['This regional snapshot covers collected EC2 instances and security groups. It does not include all AWS services, routes, NACLs or verified reachability.', 'Security-group attachment edges describe configuration associations, not traffic flow. Save a new snapshot to preserve existing manual edits.'];
  const ids = new Set<string>();
  for (const group of report.resources.securityGroups.slice(0, 1000)) {
    if (!group.GroupId || group.OwnerId !== scope.accountId) continue;
    const id = stableId(target, 'security-group', group.GroupId);
    if (ids.has(id)) continue;
    ids.add(id);
    nodes.push(node(id, 'firewall', text(group.GroupName) || group.GroupId, nodes.length, { source: 'ec2.DescribeSecurityGroups', sourceId: group.GroupId, accountId: scope.accountId, region: scope.region, observedAt: report.collectedAt, vpcId: group.VpcId ?? '', description: text(group.Description) }));
  }
  for (const instance of report.resources.instances.slice(0, 1000)) {
    if (!instance.InstanceId) continue;
    const id = stableId(target, 'instance', instance.InstanceId);
    if (ids.has(id)) continue;
    ids.add(id);
    nodes.push(node(id, 'awsEC2', text(instance.Tags?.find(tag => tag.Key === 'Name')?.Value) || instance.InstanceId, nodes.length, { source: 'ec2.DescribeInstances', sourceId: instance.InstanceId, accountId: scope.accountId, region: scope.region, observedAt: report.collectedAt, privateAddress: instance.PrivateIpAddress ?? '', publicAddress: instance.PublicIpAddress ?? '', vpcId: instance.VpcId ?? '', subnetId: instance.SubnetId ?? '', state: instance.State?.Name ?? 'unknown', instanceType: instance.InstanceType ?? '' }));
    const groups = new Set((instance.SecurityGroups ?? []).map(group => group.GroupId).filter((group): group is string => !!group));
    for (const groupId of groups) {
      const group = stableId(target, 'security-group', groupId);
      if (ids.has(group)) edges.push({ id: stableId(target, 'attachment', id, group), source: id, target: group, label: 'Security group attached', data: { relationship: 'security group attachment', source: 'ec2.DescribeInstances', observedAt: report.collectedAt } });
    }
  }
  if (report.resources.instances.length > 1000 || report.resources.securityGroups.length > 1000) warnings.push('Map truncated at 1000 instances and 1000 security groups.');
  for (const error of report.errors) warnings.push(`${error.source}: ${error.message}`);
  if (!nodes.length) warnings.push('No resources were returned in this scope. Review collection coverage; empty results do not establish an empty or secure account.');
  return preview('aws', target, `AWS ${scope.accountId} — ${scope.region}`, report.collectedAt, nodes, edges, report.coverage, warnings);
}
