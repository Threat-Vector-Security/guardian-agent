import type { StrideCategory } from '../types/ThreatIntelTypes';

export interface NodeTypeContextHint {
  ruleId: string;
  title: string;
  description: string;
  strideCategories: StrideCategory[];
  recommendations: string[];
}

// Keyed by node.type (specific) or DFD category string (fallback).
// The lookup order in Pass 2.5 is: specific node.type → DFD category fallback.
export const nodeTypeContextHints: Record<string, NodeTypeContextHint> = {

  // ── Cloud / Object Storage ───────────────────────────────────────────────
  storage: {
    ruleId: 'CTX-STORAGE',
    title: 'Object/File Storage: Key STRIDE Threat Areas',
    description:
      'Object and file storage services are high-value data-at-rest targets. ' +
      'They are prone to Information Disclosure through misconfigured access control policies or overly ' +
      'permissive permissions, Tampering through unrestricted write/delete access, and Repudiation if ' +
      'granular access audit logging is absent.',
    strideCategories: ['Information Disclosure', 'Tampering', 'Repudiation'],
    recommendations: [
      'Disable public access; enforce private-only access policies by default.',
      'Enable encryption at rest using platform-managed or customer-managed encryption keys.',
      'Enable granular access audit logging (reads, writes, deletes) for all sensitive stored data.',
      'Enable object versioning and deletion protection controls where the storage platform supports them.',
      'Use private network endpoints to avoid routing storage traffic over the public internet where possible.',
      'Apply least-privilege access policies; audit permissions regularly and remove stale access grants.',
    ],
  },

  // ── Relational / NoSQL Databases ────────────────────────────────────────
  database: {
    ruleId: 'CTX-DB',
    title: 'Database: Key STRIDE Threat Areas',
    description:
      'Databases are primary targets for Tampering (unauthorized writes/deletes), Information Disclosure ' +
      '(SQL/NoSQL injection, over-privileged queries), and Elevation of Privilege (database admin account abuse). ' +
      'Lack of auditing also creates Repudiation risk.',
    strideCategories: ['Tampering', 'Information Disclosure', 'Elevation of Privilege', 'Repudiation'],
    recommendations: [
      'Use parameterized queries / prepared statements to prevent SQL/NoSQL injection.',
      'Apply least-privilege database accounts; separate read, write, and admin roles.',
      'Enable database auditing and query logging; ship logs to a SIEM.',
      'Encrypt data at rest (TDE or column-level encryption for sensitive fields).',
      'Restrict network access to known application subnets; disable public endpoints.',
      'Rotate database credentials and avoid embedding them in application code or environment files.',
    ],
  },

  // ── Bulk / Archive Storage (SAN, NAS, tape, backup targets) ─────────────
  fileServer: {
    ruleId: 'CTX-BULK-STORE',
    title: 'File/Bulk Storage: Key STRIDE Threat Areas',
    description:
      'File servers, NAS, SAN, and backup repositories store large volumes of data and are attractive targets ' +
      'for ransomware (Tampering/Denial of Service), mass data exfiltration (Information Disclosure), and ' +
      'Repudiation where file-level audit trails are absent.',
    strideCategories: ['Tampering', 'Information Disclosure', 'Denial of Service', 'Repudiation'],
    recommendations: [
      'Enforce strict ACLs and share-level permissions; regularly audit with access reports.',
      'Enable file audit logging (creation, modification, deletion) and ship to SIEM.',
      'Protect backup repositories with immutable storage or WORM policies to resist ransomware.',
      'Encrypt stored data and backup media in transit and at rest.',
      'Isolate backup networks from production to limit blast radius of ransomware spread.',
    ],
  },

  // ── Cache / In-Memory Stores ─────────────────────────────────────────────
  cache: {
    ruleId: 'CTX-CACHE',
    title: 'Cache/In-Memory Store: Key STRIDE Threat Areas',
    description:
      'Caches (Redis, Memcached, session stores) often hold sensitive in-flight data — session tokens, ' +
      'user objects, transient PII — making them targets for Information Disclosure and Tampering (cache ' +
      'poisoning). Lack of persistence controls also introduces Denial of Service risk.',
    strideCategories: ['Information Disclosure', 'Tampering', 'Denial of Service'],
    recommendations: [
      'Require authentication and disable anonymous access to the cache service.',
      'Bind cache services to internal interfaces only; never expose to the internet.',
      'Enable TLS for in-transit data between application and cache.',
      'Validate all values retrieved from cache before use to defend against cache poisoning.',
      'Set TTLs on all cached items to limit the exposure window of stale or sensitive data.',
      'Monitor cache capacity and configure eviction policies to prevent out-of-memory conditions.',
    ],
  },

  // ── Web Servers ───────────────────────────────────────────────────────────
  webServer: {
    ruleId: 'CTX-WEB',
    title: 'Web Server: Key STRIDE Threat Areas',
    description:
      'Web servers are internet-facing and targeted for Tampering (content injection, defacement), ' +
      'Information Disclosure (directory traversal, server banner disclosure, verbose errors), ' +
      'Elevation of Privilege (web-shell upload, server-side template injection), and ' +
      'Denial of Service (HTTP floods, slow-loris attacks).',
    strideCategories: ['Tampering', 'Information Disclosure', 'Elevation of Privilege', 'Denial of Service'],
    recommendations: [
      'Suppress server version banners and verbose error pages in production.',
      'Implement a WAF to filter injection attacks, XSS, and path traversal.',
      'Restrict file upload paths and validate MIME types; never execute uploaded content.',
      'Configure strict Content Security Policy (CSP), HSTS, and X-Frame-Options headers.',
      'Rate-limit connections and apply DDoS mitigation (CDN, anycast scrubbing).',
      'Harden the underlying OS and web server software; apply patches promptly.',
    ],
  },

  // ── Application Servers / Microservices ──────────────────────────────────
  application: {
    ruleId: 'CTX-APP',
    title: 'Application/Service: Key STRIDE Threat Areas',
    description:
      'Application servers and microservices handle business logic and are targets for Elevation of Privilege ' +
      '(broken access control, IDOR), Tampering (logic manipulation, deserialization attacks), ' +
      'Spoofing (forged tokens, SSRF), and Information Disclosure (verbose errors, internal endpoint exposure).',
    strideCategories: ['Elevation of Privilege', 'Tampering', 'Spoofing', 'Information Disclosure'],
    recommendations: [
      'Enforce authorization checks on every endpoint; do not rely solely on UI-layer controls.',
      'Validate and sanitize all inputs; use allowlists rather than denylists.',
      'Implement SSRF protections: restrict outbound URLs to an allowlist, block metadata endpoints.',
      'Use short-lived, signed tokens (JWT, OAuth 2.0) and validate signatures rigorously.',
      'Return generic error messages to clients; log full details internally.',
      'Apply least-privilege to service accounts and container runtime permissions.',
    ],
  },

  // ── API Gateways ──────────────────────────────────────────────────────────
  apiGateway: {
    ruleId: 'CTX-APIGW',
    title: 'API Gateway: Key STRIDE Threat Areas',
    description:
      'API gateways are single ingress points and are targeted for Spoofing (credential stuffing, token forgery), ' +
      'Elevation of Privilege (broken object-level authorization, mass assignment), and ' +
      'Denial of Service (API rate exhaustion, resource-intensive queries without throttling).',
    strideCategories: ['Spoofing', 'Elevation of Privilege', 'Denial of Service'],
    recommendations: [
      'Enforce strong API key or OAuth 2.0 / JWT authentication on all routes.',
      'Apply per-consumer and global rate limiting and quota policies.',
      'Validate and enforce API schema (OpenAPI/JSON Schema) to reject malformed requests.',
      'Implement object-level authorization; do not expose internal IDs without RBAC checks.',
      'Log all API calls including caller identity, response codes, and latency.',
      'Enable mutual TLS for service-to-service API calls in high-trust contexts.',
    ],
  },

  // ── Message Brokers / Queues ──────────────────────────────────────────────
  messageQueue: {
    ruleId: 'CTX-MSG',
    title: 'Message Broker/Queue: Key STRIDE Threat Areas',
    description:
      'Message brokers (Kafka, RabbitMQ, SQS, Service Bus) relay sensitive data between services. ' +
      'Spoofing (unauthorized producers), Tampering (message content manipulation), Repudiation (missing ' +
      'message audit trail), and Denial of Service (queue flooding) are the primary concerns.',
    strideCategories: ['Spoofing', 'Tampering', 'Repudiation', 'Denial of Service'],
    recommendations: [
      'Authenticate producers and consumers using strong credentials or mutual TLS.',
      'Encrypt message payloads in transit and at rest, especially for sensitive data.',
      'Implement message signing to detect tampering before processing.',
      'Enforce topic/queue-level access controls; separate producer and consumer credentials.',
      'Set consumer quotas and produce rate limits to prevent queue flooding.',
      'Enable audit logging for administrative actions (topic creation, access control changes).',
    ],
  },

  // ── Firewalls / WAF ───────────────────────────────────────────────────────
  firewall: {
    ruleId: 'CTX-FW',
    title: 'Firewall/Security Control: Key STRIDE Threat Areas',
    description:
      'Firewalls and WAFs are critical chokepoints. Attackers target Elevation of Privilege ' +
      '(admin interface compromise, misconfigured rule bypass), Tampering (rule set modification), ' +
      'and Repudiation (disabled or tampered logging). A compromised firewall impacts the entire perimeter.',
    strideCategories: ['Elevation of Privilege', 'Tampering', 'Repudiation'],
    recommendations: [
      'Restrict management interface access to a dedicated, isolated management VLAN.',
      'Require MFA for all administrative access to firewall and WAF consoles.',
      'Export firewall logs to an external, write-protected SIEM; treat log deletion as a critical alert.',
      'Version-control firewall rule sets and require change-management approval for modifications.',
      'Disable unused management protocols (Telnet, HTTP); use SSH/HTTPS only.',
      'Regularly audit firewall rules to remove stale or over-permissive entries.',
    ],
  },

  // ── Load Balancers / CDNs ─────────────────────────────────────────────────
  loadBalancer: {
    ruleId: 'CTX-LB',
    title: 'Load Balancer/CDN: Key STRIDE Threat Areas',
    description:
      'Load balancers and CDNs terminate SSL/TLS and distribute traffic. They are targeted for ' +
      'Denial of Service (volumetric attacks reaching origin), Spoofing (header injection, IP spoofing ' +
      'through X-Forwarded-For manipulation), and Elevation of Privilege (admin console compromise).',
    strideCategories: ['Denial of Service', 'Spoofing', 'Elevation of Privilege'],
    recommendations: [
      'Enable DDoS scrubbing and rate limiting at the CDN/LB layer before traffic reaches origin.',
      'Validate and strip or sanitize X-Forwarded-For / X-Real-IP headers at the LB.',
      'Configure origin IP allowlisting so origin servers only accept traffic from the LB.',
      'Enforce HTTPS termination with strong TLS settings (TLS 1.2+, strong cipher suites).',
      'Restrict LB management console to a dedicated IP range with MFA.',
      'Enable access logging for all requests; monitor for anomalous traffic patterns.',
    ],
  },

  // ── Routers / Switches / DNS ──────────────────────────────────────────────
  router: {
    ruleId: 'CTX-ROUTER',
    title: 'Router/Network Device: Key STRIDE Threat Areas',
    description:
      'Routers, switches, and DNS servers control network path selection. Spoofing (BGP hijacking, ' +
      'ARP poisoning, DNS cache poisoning), Tampering (routing table manipulation), and ' +
      'Information Disclosure (traffic interception) are the primary threat concerns.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Enable RPKI/ROA validation to prevent BGP route hijacking.',
      'Use Dynamic ARP Inspection (DAI) and DHCP snooping to prevent ARP poisoning.',
      'Deploy DNSSEC on authoritative zones; validate DNSSEC on resolvers.',
      'Disable unused router services (Telnet, HTTP, SNMP v1/v2); use SSH and SNMPv3.',
      'Restrict router management to a dedicated OOB network with strong authentication.',
      'Segment network with VLANs and apply ACLs to limit lateral movement.',
    ],
  },

  // ── Monitoring / SIEM / Logging ───────────────────────────────────────────
  monitor: {
    ruleId: 'CTX-MONITOR',
    title: 'Monitoring/SIEM: Key STRIDE Threat Areas',
    description:
      'Monitoring and SIEM systems receive sensitive log and telemetry data. Tampering ' +
      '(log forging, alert suppression) and Repudiation (deleted audit trails) undermine the entire ' +
      'security operations function. Information Disclosure through aggregated logs is also a concern.',
    strideCategories: ['Tampering', 'Repudiation', 'Information Disclosure'],
    recommendations: [
      'Write logs to an append-only or immutable store; require elevated approval to delete records.',
      'Implement integrity verification (hash chains or write-once storage) on critical audit logs.',
      'Restrict who can modify alert rules, disable detection rules, or suppress notifications.',
      'Encrypt sensitive log data (PII, credentials, tokens) at rest and in transit to the SIEM.',
      'Alert on anomalous log gaps, source silences, or bulk deletion of historical records.',
      'Use a dedicated log transport account with write-only permissions from log sources.',
    ],
  },

  // ── Key Management / HSM / Secrets ───────────────────────────────────────
  keyManagement: {
    ruleId: 'CTX-KMS',
    title: 'Key Management/HSM: Key STRIDE Threat Areas',
    description:
      'Key management services and HSMs protect the cryptographic root of trust. ' +
      'Information Disclosure (key exfiltration) and Elevation of Privilege (unauthorized key usage or admin ' +
      'access) can break the security of every system that trusts those keys.',
    strideCategories: ['Information Disclosure', 'Elevation of Privilege', 'Repudiation'],
    recommendations: [
      'Enforce HSM-backed key storage; avoid software key stores for high-value keys.',
      'Apply envelope encryption: use a key-encryption key (KEK) hierarchy managed by the KMS.',
      'Require dual authorization (two-person integrity) for destructive key operations (deletion, disable).',
      'Log all key usage events and ship to an external, tamper-evident audit store.',
      'Rotate encryption keys on a schedule; enable automatic rotation where the platform supports it.',
      'Restrict KMS admin roles with tight IAM policies and hardware MFA.',
    ],
  },

  // ── Identity Providers / Auth / SSO / MFA ────────────────────────────────
  identityProvider: {
    ruleId: 'CTX-IAM',
    title: 'Identity Provider/Auth Service: Key STRIDE Threat Areas',
    description:
      'Identity providers, SSO, and MFA services are the gatekeepers to all authenticated resources. ' +
      'Spoofing (phishing, credential stuffing, MFA bypass), Elevation of Privilege (IdP admin compromise), ' +
      'and Repudiation (failed login audit gaps) are the highest-priority concerns.',
    strideCategories: ['Spoofing', 'Elevation of Privilege', 'Repudiation'],
    recommendations: [
      'Enforce phishing-resistant MFA (FIDO2/WebAuthn, hardware tokens) for all privileged accounts.',
      'Implement adaptive authentication and anomaly detection (impossible travel, new device alerts).',
      'Log all authentication events (success, failure, MFA challenge); retain for 12+ months.',
      'Apply brute-force protection: account lockout, exponential back-off, CAPTCHA.',
      'Regularly audit IdP admin roles and API integrations for least-privilege.',
      'Disable legacy authentication protocols (Basic Auth, NTLM) that bypass MFA.',
    ],
  },

  // ── Proxy / Reverse Proxy ─────────────────────────────────────────────────
  proxy: {
    ruleId: 'CTX-PROXY',
    title: 'Proxy/Reverse Proxy: Key STRIDE Threat Areas',
    description:
      'Proxies mediate traffic and can introduce Spoofing (header smuggling, request forgery through ' +
      'proxy misconfigurations), Information Disclosure (TLS interception of sensitive data), and ' +
      'Elevation of Privilege (SSRF through proxy abuse to reach internal services).',
    strideCategories: ['Spoofing', 'Information Disclosure', 'Elevation of Privilege'],
    recommendations: [
      'Validate and normalize request headers; reject malformed or smuggled headers (CL.TE / TE.CL).',
      'Restrict CONNECT method to allowlisted destinations to prevent SSRF via proxy tunneling.',
      'Enforce egress filtering on forward proxies; block access to internal RFC-1918 ranges.',
      'Log all proxied requests including destination, client identity, and response code.',
      'Disable open proxy behavior; require authenticated access for forward proxy use.',
      'Audit TLS inspection policies; ensure decrypted traffic is handled securely and compliantly.',
    ],
  },

  // ── VPN / ZTNA / SASE ─────────────────────────────────────────────────────
  vpn: {
    ruleId: 'CTX-VPN',
    title: 'VPN/ZTNA: Key STRIDE Threat Areas',
    description:
      'VPN gateways and ZTNA controllers authenticate remote access. Spoofing (credential theft, ' +
      'split-tunnel abuse), Elevation of Privilege (overly broad network access post-authentication), ' +
      'and Denial of Service (VPN concentrator exhaustion) are key concerns.',
    strideCategories: ['Spoofing', 'Elevation of Privilege', 'Denial of Service'],
    recommendations: [
      'Enforce certificate-based or FIDO2 authentication on the VPN gateway; avoid password-only auth.',
      'Implement micro-segmentation: grant post-VPN access only to required resources, not full LAN.',
      'Apply device posture checks (patch level, EDR presence) before granting VPN access.',
      'Rate-limit failed authentication attempts and alert on brute-force patterns.',
      'Monitor VPN session anomalies (unusual hours, large data egress, split-tunnel abuse).',
      'Keep VPN gateway firmware patched promptly; CVEs in major VPN products are frequently weaponized.',
    ],
  },

  // ── IDS / IPS / NDR / XDR / EDR ──────────────────────────────────────────
  ids: {
    ruleId: 'CTX-IDS',
    title: 'IDS/IPS/Detection Sensor: Key STRIDE Threat Areas',
    description:
      'Detection sensors (IDS, IPS, NDR, XDR, EDR) are high-value targets for attackers seeking to ' +
      'blind defenders. Tampering (signature update poisoning, sensor bypass), Repudiation ' +
      '(suppressed alerts), and Elevation of Privilege (sensor management console compromise) are key risks.',
    strideCategories: ['Tampering', 'Repudiation', 'Elevation of Privilege'],
    recommendations: [
      'Protect sensor management interfaces with MFA and restrict to management-plane networks.',
      'Verify integrity of signature/rule updates before applying (code signing, hash verification).',
      'Alert on sensor silence or gaps in telemetry as potential evasion indicators.',
      'Log sensor administrative actions (rule changes, exclusions, disables) to external SIEM.',
      'Deploy sensors in passive tap mode where possible to reduce attack surface of inline deployments.',
      'Regularly test detection coverage with purple team exercises or SIEM detection validation tools.',
    ],
  },

  // ── Bastion Hosts / Jump Servers / PAM ───────────────────────────────────
  bastionHost: {
    ruleId: 'CTX-PAM',
    title: 'Bastion Host/Jump Server: Key STRIDE Threat Areas',
    description:
      'Bastion hosts and PAM solutions are choke points for privileged access. Spoofing (credential ' +
      'theft targeting shared admin accounts), Elevation of Privilege (lateral movement from bastion into ' +
      'internal network), and Repudiation (absent session recording) are critical concerns.',
    strideCategories: ['Spoofing', 'Elevation of Privilege', 'Repudiation'],
    recommendations: [
      'Require phishing-resistant MFA for all bastion/jump server sessions.',
      'Enable full session recording with tamper-evident storage for privileged sessions.',
      'Apply just-in-time (JIT) access: grant bastion credentials for a time-limited window on demand.',
      'Prevent direct SSH/RDP access to production hosts; route all traffic through the bastion.',
      'Harden the bastion host: no persistent admin sessions, no outbound internet, minimal software.',
      'Monitor bastion sessions in real time; alert on anomalous commands or unusual target systems.',
    ],
  },

  // ── CI/CD Pipelines / Code Repositories ─────────────────────────────────
  cicdPipeline: {
    ruleId: 'CTX-CICD',
    title: 'CI/CD Pipeline: Key STRIDE Threat Areas',
    description:
      'CI/CD pipelines have privileged access to production environments. Tampering (build artifact ' +
      'poisoning, dependency confusion), Elevation of Privilege (pipeline credential theft leads to ' +
      'production deployment access), and Repudiation (missing build provenance) are primary concerns.',
    strideCategories: ['Tampering', 'Elevation of Privilege', 'Repudiation'],
    recommendations: [
      'Use short-lived, scoped credentials for deployments; avoid long-lived static secrets in pipelines.',
      'Pin all dependencies to specific versions or hashes (lockfiles, SBOM); scan for dependency confusion.',
      'Sign build artifacts and verify signatures at deployment time to ensure supply chain integrity.',
      'Restrict pipeline permissions with least-privilege; separate build, test, and deploy stages.',
      'Enable branch protection rules and require code review before pipeline triggers.',
      'Log all pipeline runs with artifact hashes, signer identity, and deployment targets.',
    ],
  },

  // ── VMs / Containers / Serverless / Compute ──────────────────────────────
  virtualMachine: {
    ruleId: 'CTX-COMPUTE',
    title: 'Compute/Virtual Machine: Key STRIDE Threat Areas',
    description:
      'Compute instances (VMs, containers, serverless functions) run workloads and are targeted for ' +
      'Elevation of Privilege (container escape, hypervisor breakout, OS privilege escalation), ' +
      'Tampering (malicious code injection, rootkit), and Information Disclosure (metadata service SSRF, ' +
      'credential exfiltration from instance storage).',
    strideCategories: ['Elevation of Privilege', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Run containers as non-root; apply read-only root filesystems and drop unnecessary OS capabilities.',
      'Restrict access to the instance metadata service from workloads that do not require it.',
      'Use minimal base images; scan images for CVEs before deployment; enforce image signing.',
      'Apply OS hardening baselines and enable host-based intrusion detection and audit logging.',
      'Isolate workloads with network policies and access controls; avoid shared tenancy for sensitive loads.',
      'Rotate instance credentials and secrets regularly; use workload identity or managed identity where available.',
    ],
  },

  // ── OT / ICS / SCADA / PLC / RTU ─────────────────────────────────────────
  plc: {
    ruleId: 'CTX-OT',
    title: 'OT/ICS Device: Key STRIDE Threat Areas',
    description:
      'Operational Technology devices (PLCs, RTUs, SCADA HMIs) control physical processes. ' +
      'Tampering (unauthorized setpoint changes, firmware modification) and Denial of Service ' +
      '(process disruption causing safety incidents) can have safety-critical consequences beyond IT.',
    strideCategories: ['Tampering', 'Denial of Service', 'Spoofing'],
    recommendations: [
      'Apply strict OT network segmentation (Purdue Model / IEC 62443 zones and conduits).',
      'Use data diodes or one-way gateways for any IT-to-OT data flows.',
      'Disable unused OT protocols and communication ports; whitelist permitted traffic.',
      'Require authenticated change management for PLC logic or setpoint modifications.',
      'Monitor OT traffic for anomalous or unexpected commands using OT/ICS-aware network monitoring.',
      'Maintain offline backups of PLC/RTU logic and configurations for rapid recovery.',
    ],
  },

  // ── AI / ML Models / LLM Services ────────────────────────────────────────
  aiModel: {
    ruleId: 'CTX-AI',
    title: 'AI/ML Model: Key STRIDE Threat Areas',
    description:
      'AI and ML model endpoints have novel threat surfaces. Spoofing via prompt injection (attacker ' +
      'manipulates model output), Information Disclosure via training data extraction or membership inference, ' +
      'and Elevation of Privilege via model-as-a-vector for downstream system compromise are key concerns.',
    strideCategories: ['Spoofing', 'Information Disclosure', 'Tampering'],
    recommendations: [
      'Implement prompt injection defences: structured prompting, output parsing, privilege separation.',
      'Do not embed sensitive data in system prompts that could be extracted by an adversarial user.',
      'Apply output filtering to detect and block disclosure of training data or system internals.',
      'Treat model inputs as untrusted; validate and sanitize before downstream use.',
      'Log model inputs and outputs for anomaly detection; redact PII before logging.',
      'Apply model access controls: authenticate and authorize API access; rate-limit per consumer.',
    ],
  },

  // ── Vector Databases / Data Lakes / Data Warehouses ──────────────────────
  vectorDatabase: {
    ruleId: 'CTX-VECDB',
    title: 'Vector Database/Data Lake: Key STRIDE Threat Areas',
    description:
      'Vector databases and data lakes aggregate large volumes of potentially sensitive embeddings ' +
      'and raw data. Information Disclosure (cross-tenant query leakage, embedding inversion attacks), ' +
      'Tampering (poisoning indexed data to manipulate retrieval), and Repudiation are key concerns.',
    strideCategories: ['Information Disclosure', 'Tampering', 'Repudiation'],
    recommendations: [
      'Enforce namespace/tenant isolation; validate that queries cannot return cross-tenant vectors.',
      'Apply access controls at the collection/namespace level; use separate API keys per consumer.',
      'Validate and sanitize documents before ingestion to prevent embedding poisoning.',
      'Log all query and ingestion operations with caller identity for audit purposes.',
      'Encrypt stored embeddings at rest; review whether stored embeddings can be inverted to source data.',
      'Implement input rate limiting and query depth limits to prevent resource exhaustion.',
    ],
  },

  // ── Endpoints / Workstations / User Devices ───────────────────────────────
  workstation: {
    ruleId: 'CTX-ENDPOINT',
    title: 'Endpoint/Workstation: Key STRIDE Threat Areas',
    description:
      'User endpoints are frequent initial access vectors. Spoofing (phishing leading to credential ' +
      'theft), Tampering (malware, rootkit, supply-chain implant), and Information Disclosure ' +
      '(credential harvesting, keylogging, clipboard capture) are primary endpoint threats.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Deploy endpoint detection and response (EDR) with behavioral detection across all managed devices.',
      'Enforce application allowlisting and restrict script interpreter and macro execution.',
      'Require phishing-resistant MFA for all corporate accounts accessible from endpoints.',
      'Apply OS hardening baselines; enable Secure Boot and OS-level credential protection features.',
      'Enable full-disk encryption and enforce remote-wipe capability for managed devices.',
      'Monitor for credential-dumping and in-memory credential theft techniques and alert the SOC.',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Additional specific node types that share a template
  // ─────────────────────────────────────────────────────────────────────────

  // Additional database types → CTX-DB
  dataWarehouse: {
    ruleId: 'CTX-DB',
    title: 'Data Warehouse: Key STRIDE Threat Areas',
    description:
      'Data warehouses consolidate enterprise data and are high-value Information Disclosure targets. ' +
      'Tampering (unauthorized ETL pipeline manipulation) and Elevation of Privilege (warehouse admin abuse) ' +
      'are also significant concerns.',
    strideCategories: ['Information Disclosure', 'Tampering', 'Elevation of Privilege'],
    recommendations: [
      'Apply column-level and row-level security policies to restrict data access by role.',
      'Audit all query activity; alert on bulk data exports or unusual query patterns.',
      'Use dedicated ETL service accounts with least-privilege; avoid shared admin credentials.',
      'Encrypt sensitive columns and enable transparent data encryption at rest.',
      'Restrict network access to the warehouse endpoint to known internal subnets.',
    ],
  },

  // Additional endpoints → CTX-ENDPOINT
  laptop: {
    ruleId: 'CTX-ENDPOINT',
    title: 'Endpoint/Workstation: Key STRIDE Threat Areas',
    description:
      'User endpoints are frequent initial access vectors. Spoofing (phishing leading to credential ' +
      'theft), Tampering (malware, rootkit, supply-chain implant), and Information Disclosure ' +
      '(credential harvesting, keylogging, clipboard capture) are primary endpoint threats.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Deploy endpoint detection and response (EDR) with behavioral detection across all managed devices.',
      'Enforce application allowlisting and restrict script interpreter and macro execution.',
      'Require phishing-resistant MFA for all corporate accounts accessible from endpoints.',
      'Apply OS hardening baselines; enable Secure Boot and OS-level credential protection features.',
      'Enable full-disk encryption and enforce remote-wipe capability for managed devices.',
      'Monitor for credential-dumping and in-memory credential theft techniques and alert the SOC.',
    ],
  },
  endpoint: {
    ruleId: 'CTX-ENDPOINT',
    title: 'Endpoint/Workstation: Key STRIDE Threat Areas',
    description:
      'User endpoints are frequent initial access vectors. Spoofing (phishing leading to credential ' +
      'theft), Tampering (malware, rootkit, supply-chain implant), and Information Disclosure ' +
      '(credential harvesting, keylogging, clipboard capture) are primary endpoint threats.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Deploy endpoint detection and response (EDR) with behavioral detection across all managed devices.',
      'Enforce application allowlisting and restrict script interpreter and macro execution.',
      'Require phishing-resistant MFA for all corporate accounts accessible from endpoints.',
      'Apply OS hardening baselines; enable Secure Boot and OS-level credential protection features.',
      'Enable full-disk encryption and enforce remote-wipe capability for managed devices.',
      'Monitor for credential-dumping and in-memory credential theft techniques and alert the SOC.',
    ],
  },
  desktop: {
    ruleId: 'CTX-ENDPOINT',
    title: 'Endpoint/Workstation: Key STRIDE Threat Areas',
    description:
      'User endpoints are frequent initial access vectors. Spoofing (phishing leading to credential ' +
      'theft), Tampering (malware, rootkit, supply-chain implant), and Information Disclosure ' +
      '(credential harvesting, keylogging, clipboard capture) are primary endpoint threats.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Deploy endpoint detection and response (EDR) with behavioral detection across all managed devices.',
      'Enforce application allowlisting and restrict script interpreter and macro execution.',
      'Require phishing-resistant MFA for all corporate accounts accessible from endpoints.',
      'Apply OS hardening baselines; enable Secure Boot and OS-level credential protection features.',
      'Enable full-disk encryption and enforce remote-wipe capability for managed devices.',
      'Monitor for credential-dumping and in-memory credential theft techniques and alert the SOC.',
    ],
  },
  smartphone: {
    ruleId: 'CTX-ENDPOINT',
    title: 'Mobile Device: Key STRIDE Threat Areas',
    description:
      'Mobile endpoints are frequent initial access vectors via phishing and malicious apps. ' +
      'Spoofing (credential theft via mobile phishing), Tampering (malicious app sideloading), and ' +
      'Information Disclosure (clipboard capture, screen recording malware) are primary threats.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Enforce MDM enrollment with remote-wipe and screen lock policy.',
      'Require approved app store sources only; block sideloading on managed devices.',
      'Apply conditional access: require device compliance before granting corporate resource access.',
      'Deploy mobile threat defence (MTD) for behavioral anomaly detection.',
      'Encrypt device storage and enforce biometric or strong PIN authentication.',
    ],
  },
  tablet: {
    ruleId: 'CTX-ENDPOINT',
    title: 'Mobile Device: Key STRIDE Threat Areas',
    description:
      'Mobile endpoints are frequent initial access vectors via phishing and malicious apps. ' +
      'Spoofing (credential theft via mobile phishing), Tampering (malicious app sideloading), and ' +
      'Information Disclosure (clipboard capture, screen recording malware) are primary threats.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Enforce MDM enrollment with remote-wipe and screen lock policy.',
      'Require approved app store sources only; block sideloading on managed devices.',
      'Apply conditional access: require device compliance before granting corporate resource access.',
      'Deploy mobile threat defence (MTD) for behavioral anomaly detection.',
      'Encrypt device storage and enforce biometric or strong PIN authentication.',
    ],
  },

  // Container runtime → CTX-COMPUTE
  container: {
    ruleId: 'CTX-COMPUTE',
    title: 'Container: Key STRIDE Threat Areas',
    description:
      'Containers share a host kernel and are targeted for Elevation of Privilege (container escape), ' +
      'Tampering (malicious image layers, runtime filesystem changes), and Information Disclosure ' +
      '(shared volume misconfigurations, metadata service SSRF).',
    strideCategories: ['Elevation of Privilege', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Run containers as non-root; apply read-only root filesystems and drop unnecessary OS capabilities.',
      'Restrict access to the instance metadata service from containers that do not require it.',
      'Scan container images for CVEs before deployment; enforce image signing and admission control.',
      'Use OS-level syscall restriction profiles to minimize the container attack surface.',
      'Isolate workloads with network policies and access controls.',
      'Rotate secrets and avoid baking credentials into image layers.',
    ],
  },

  // Server variants → shared with CTX-COMPUTE (they are process nodes)
  server: {
    ruleId: 'CTX-COMPUTE',
    title: 'Server/Compute: Key STRIDE Threat Areas',
    description:
      'Servers are targeted for Elevation of Privilege (OS privilege escalation, service account abuse), ' +
      'Tampering (rootkit implantation, unauthorized software installation), and Information Disclosure ' +
      '(credential files, memory scraping, unprotected admin interfaces).',
    strideCategories: ['Elevation of Privilege', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Apply OS hardening baselines and patch on a defined cadence.',
      'Enable host-based intrusion detection and audit logging.',
      'Restrict remote admin access to management bastion hosts; disable direct internet-facing admin ports.',
      'Remove or disable unused services, protocols, and local admin accounts.',
      'Monitor for privilege escalation indicators: unexpected privilege use, new system binaries, unauthorized service modifications.',
      'Use workload identity or managed identity for cloud credentials; avoid static key files.',
    ],
  },

  // Additional network devices → CTX-ROUTER
  switch: {
    ruleId: 'CTX-ROUTER',
    title: 'Network Switch: Key STRIDE Threat Areas',
    description:
      'Network switches control traffic within segments. Spoofing (ARP poisoning, MAC flooding), ' +
      'Tampering (VLAN hopping, STP manipulation), and Information Disclosure (traffic interception) ' +
      'are the primary concerns on switch infrastructure.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Enable Dynamic ARP Inspection (DAI) and port security (MAC limiting) on all access ports.',
      'Enable DHCP snooping and disable untrusted uplinks from STP root election.',
      'Configure private VLANs to limit inter-host communication where appropriate.',
      'Disable unused switch ports and assign them to a quarantine VLAN.',
      'Require SNMPv3 authentication; disable SNMPv1/v2 community strings.',
      'Restrict management access (SSH, HTTPS only) to a dedicated management VLAN.',
    ],
  },
  dns: {
    ruleId: 'CTX-ROUTER',
    title: 'DNS Server: Key STRIDE Threat Areas',
    description:
      'DNS is a critical name resolution service and a frequent attack target. Spoofing (DNS cache ' +
      'poisoning, DNS hijacking), Tampering (zone data modification), and Information Disclosure ' +
      '(DNS zone transfer, DNS tunnelling for data exfiltration) are key concerns.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Deploy DNSSEC on authoritative zones and validate on resolvers.',
      'Restrict zone transfers to known secondary servers by IP allowlist.',
      'Monitor DNS query logs for signs of tunnelling (high-entropy subdomains, large TXT records).',
      'Use response rate limiting (RRL) to mitigate DNS amplification attacks.',
      'Separate internal and external DNS resolvers; do not expose internal zone data externally.',
      'Alert on unauthorised zone record changes or SOA serial changes.',
    ],
  },

  // Additional storage variants → CTX-STORAGE
  cloudStorage: {
    ruleId: 'CTX-STORAGE',
    title: 'Object/File Storage: Key STRIDE Threat Areas',
    description:
      'Object and file storage services are high-value data-at-rest targets prone to Information Disclosure ' +
      'through misconfigured access control policies or overly permissive permissions, Tampering through ' +
      'unrestricted write/delete access, and Repudiation when granular access audit logging is absent.',
    strideCategories: ['Information Disclosure', 'Tampering', 'Repudiation'],
    recommendations: [
      'Disable public access; enforce private-only access policies by default.',
      'Enable encryption at rest using platform-managed or customer-managed encryption keys.',
      'Enable granular access audit logging (reads, writes, deletes) for all sensitive stored data.',
      'Enable object versioning and deletion protection controls where the storage platform supports them.',
      'Use private network endpoints to avoid routing storage traffic over the public internet where possible.',
      'Apply least-privilege access policies; audit permissions regularly and remove stale access grants.',
    ],
  },

  // OT variants → CTX-OT
  rtu: {
    ruleId: 'CTX-OT',
    title: 'OT/ICS Device: Key STRIDE Threat Areas',
    description:
      'RTUs and field devices control physical processes. Tampering (unauthorized command injection, ' +
      'firmware modification) and Denial of Service (process disruption) can have safety-critical ' +
      'consequences beyond IT systems.',
    strideCategories: ['Tampering', 'Denial of Service', 'Spoofing'],
    recommendations: [
      'Apply strict OT network segmentation (IEC 62443 zones and conduits).',
      'Use data diodes or one-way gateways for any IT-to-OT data flows.',
      'Disable unused OT protocols and communication ports; whitelist permitted traffic.',
      'Require authenticated change management for RTU setpoint modifications.',
      'Monitor OT traffic for anomalous commands using OT-aware IDS.',
    ],
  },
  scada: {
    ruleId: 'CTX-OT',
    title: 'SCADA/HMI: Key STRIDE Threat Areas',
    description:
      'SCADA and HMI systems provide visibility and control over physical processes. Spoofing (fake ' +
      'sensor data, unauthorized operator sessions), Tampering (unauthorized setpoint changes), and ' +
      'Information Disclosure (process data to competitors) are key concerns.',
    strideCategories: ['Spoofing', 'Tampering', 'Information Disclosure'],
    recommendations: [
      'Require operator authentication and session logging for all HMI interactions.',
      'Segment HMI networks from IT networks; enforce strict firewall rules for any cross-boundary flows.',
      'Validate sensor data integrity to detect spoofed readings (range checks, redundant sensors).',
      'Apply change management controls for SCADA configuration changes.',
      'Monitor HMI access patterns and alert on after-hours or unexpected location access.',
    ],
  },

  // AI variants → CTX-AI
  llmService: {
    ruleId: 'CTX-AI',
    title: 'LLM/AI Service: Key STRIDE Threat Areas',
    description:
      'LLM API services have novel threat surfaces including prompt injection (Spoofing), training data ' +
      'extraction (Information Disclosure), and output manipulation to facilitate downstream attacks (Tampering).',
    strideCategories: ['Spoofing', 'Information Disclosure', 'Tampering'],
    recommendations: [
      'Implement prompt injection defences: structured prompting, output parsing, privilege separation.',
      'Do not embed sensitive data in system prompts that could be extracted by adversarial users.',
      'Apply output filtering to detect and block disclosure of training data or system internals.',
      'Log model inputs and outputs for anomaly detection; redact PII before logging.',
      'Apply model access controls: authenticate and authorize API access; rate-limit per consumer.',
      'Treat model outputs as untrusted; validate before using in downstream automated actions.',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DFD category fallbacks (used when node.type has no specific entry above)
  // ─────────────────────────────────────────────────────────────────────────

  dataStore: {
    ruleId: 'CTX-DATASTORE',
    title: 'Data Store: Key STRIDE Threat Areas',
    description:
      'Data stores persist and retrieve information that often has high sensitivity. ' +
      'Tampering (unauthorized writes or deletes), Information Disclosure (uncontrolled reads), ' +
      'Denial of Service (unavailability of stored data), and Repudiation (absent access audit trail) ' +
      'are the STRIDE categories most applicable to any data storage element.',
    strideCategories: ['Tampering', 'Information Disclosure', 'Denial of Service', 'Repudiation'],
    recommendations: [
      'Apply strict access controls: authenticate all reads and writes; enforce least-privilege roles.',
      'Encrypt data at rest and in transit to and from the store.',
      'Enable audit logging of all access (read, write, delete) to support non-repudiation.',
      'Implement backup and recovery procedures and test them regularly.',
      'Monitor for anomalous access patterns (bulk reads, off-hours access, unusual client IPs).',
    ],
  },

  process: {
    ruleId: 'CTX-PROCESS',
    title: 'Process/Service: Key STRIDE Threat Areas',
    description:
      'Processes transform or relay data and are targeted for Spoofing (impersonation of the process), ' +
      'Tampering (injection attacks against business logic), Elevation of Privilege (leveraging the process ' +
      'to gain broader system access), and Denial of Service (resource exhaustion).',
    strideCategories: ['Spoofing', 'Tampering', 'Elevation of Privilege', 'Denial of Service'],
    recommendations: [
      'Validate and sanitize all inputs before processing; use allowlists for expected value ranges.',
      'Run the process under a least-privilege service account with no unnecessary OS permissions.',
      'Implement robust error handling that does not leak internal state or stack traces externally.',
      'Apply rate limiting and resource quotas to prevent resource exhaustion attacks.',
      'Use signed tokens or mutual TLS for service-to-service authentication.',
    ],
  },

  actor: {
    ruleId: 'CTX-ACTOR',
    title: 'External Actor: Key STRIDE Threat Areas',
    description:
      'External actors (users, partners, systems) interact with your system from outside your trust ' +
      'boundary. Spoofing (impersonation, credential theft), Repudiation (denying performed actions), ' +
      'and Information Disclosure (over-exposure of data to the actor) are key concerns.',
    strideCategories: ['Spoofing', 'Repudiation', 'Information Disclosure'],
    recommendations: [
      'Authenticate all external actors; apply strong authentication (MFA) for high-trust operations.',
      'Log all interactions with sufficient detail to support non-repudiation investigations.',
      'Apply the principle of least privilege: expose only the data and functions the actor needs.',
      'Monitor for anomalous actor behaviour (impossible travel, unusual access times, bulk operations).',
      'Implement consent and data minimisation controls where actors interact with personal data.',
    ],
  },
};
