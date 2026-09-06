// Ported from ContextCypher NodeToolbox; source labels and complete category membership retained.
export const NODE_CATALOG = [
  {
    "title": "Threat Modeling (DFD)",
    "nodes": [
      {
        "type": "dfdActor",
        "label": "DFD External Entity",
        "description": "External entity (user, web app, REST API, Lambda function, mobile app, third-party service)"
      },
      {
        "type": "dfdProcess",
        "label": "DFD Process",
        "description": "Processing element (application, service, function, microservice)"
      },
      {
        "type": "dfdDataStore",
        "label": "DFD Data Store",
        "description": "Data storage (database, file system, cache, queue, blob storage)"
      },
      {
        "type": "dfdTrustBoundary",
        "label": "DFD Trust Boundary",
        "description": "Trust boundary between different security contexts (network, process, privilege)"
      }
    ]
  },
  {
    "title": "Security Zones",
    "nodes": [
      {
        "type": "securityZone",
        "label": "Internet Zone",
        "description": "Public internet zone, least trusted, exposed to external users",
        "zoneType": "Internet"
      },
      {
        "type": "securityZone",
        "label": "External Network",
        "description": "Third-party services, partner connections, external APIs",
        "zoneType": "External"
      },
      {
        "type": "securityZone",
        "label": "DMZ",
        "description": "Buffer zone for internet-accessible services",
        "zoneType": "DMZ"
      },
      {
        "type": "securityZone",
        "label": "Internal Network",
        "description": "Main network for internal users and operations",
        "zoneType": "Internal"
      },
      {
        "type": "securityZone",
        "label": "Trusted Zone",
        "description": "Secure area within internal network",
        "zoneType": "Trusted"
      },
      {
        "type": "securityZone",
        "label": "Restricted Zone",
        "description": "Highly controlled zone with strict access",
        "zoneType": "Restricted"
      },
      {
        "type": "securityZone",
        "label": "Critical Zone",
        "description": "Mission-critical systems requiring highest security",
        "zoneType": "Critical"
      },
      {
        "type": "securityZone",
        "label": "Development",
        "description": "Isolated environment for development and testing",
        "zoneType": "Development"
      },
      {
        "type": "securityZone",
        "label": "Staging",
        "description": "Pre-production testing environment",
        "zoneType": "Staging"
      },
      {
        "type": "securityZone",
        "label": "Production",
        "description": "Live environment with strict security controls",
        "zoneType": "Production"
      },
      {
        "type": "securityZone",
        "label": "Cloud Services",
        "description": "Cloud environments and services",
        "zoneType": "Cloud"
      },
      {
        "type": "securityZone",
        "label": "Hybrid Zone",
        "description": "Hybrid cloud connectivity zone",
        "zoneType": "Hybrid"
      },
      {
        "type": "securityZone",
        "label": "Multi-Cloud Zone",
        "description": "Multi-cloud integration zone",
        "zoneType": "MultiCloud"
      },
      {
        "type": "securityZone",
        "label": "Edge Zone",
        "description": "Edge computing and CDN nodes",
        "zoneType": "Edge"
      },
      {
        "type": "securityZone",
        "label": "Guest Zone",
        "description": "Limited access for unmanaged devices",
        "zoneType": "Guest"
      },
      {
        "type": "securityZone",
        "label": "Partner Zone",
        "description": "Partner/vendor access zone",
        "zoneType": "Partner"
      },
      {
        "type": "securityZone",
        "label": "Third Party Zone",
        "description": "Third party integrations and services",
        "zoneType": "ThirdParty"
      },
      {
        "type": "securityZone",
        "label": "OT Zone",
        "description": "Industrial Control Systems and SCADA environment",
        "zoneType": "OT"
      },
      {
        "type": "securityZone",
        "label": "Management Zone",
        "description": "Network management and administrative access",
        "zoneType": "Management"
      },
      {
        "type": "securityZone",
        "label": "Compliance Zone",
        "description": "Systems handling regulated data (PCI, HIPAA, GDPR)",
        "zoneType": "Compliance"
      },
      {
        "type": "securityZone",
        "label": "Control Plane",
        "description": "Network control plane (routing, switching control)",
        "zoneType": "ControlPlane"
      },
      {
        "type": "securityZone",
        "label": "Data Plane",
        "description": "Network data plane (actual data forwarding)",
        "zoneType": "DataPlane"
      },
      {
        "type": "securityZone",
        "label": "Service Mesh",
        "description": "Service mesh control and data plane",
        "zoneType": "ServiceMesh"
      },
      {
        "type": "securityZone",
        "label": "Back Office",
        "description": "Back office operations and support systems",
        "zoneType": "BackOffice"
      },
      {
        "type": "securityZone",
        "label": "Quarantine Zone",
        "description": "Isolated systems for security analysis",
        "zoneType": "Quarantine"
      },
      {
        "type": "securityZone",
        "label": "Recovery Zone",
        "description": "Disaster recovery and backup systems",
        "zoneType": "Recovery"
      },
      {
        "type": "securityZone",
        "label": "Red Team Zone",
        "description": "Red team acts as attackers, simulating real-world cyberattacks to identify vulnerabilities",
        "zoneType": "RedTeam"
      },
      {
        "type": "securityZone",
        "label": "Blue Team Zone",
        "description": "Blue team focuses on defending systems and networks, implementing security controls and monitoring",
        "zoneType": "BlueTeam"
      },
      {
        "type": "securityZone",
        "label": "Purple Team Zone",
        "description": "Purple team bridges red and blue teams, facilitating communication and collaborative improvement",
        "zoneType": "PurpleTeam"
      },
      {
        "type": "securityZone",
        "label": "Yellow Team Zone",
        "description": "Yellow team focuses on building secure applications from the ground up with DevSecOps practices",
        "zoneType": "YellowTeam"
      },
      {
        "type": "securityZone",
        "label": "Green Team Zone",
        "description": "Green team works with developers to implement secure coding practices and security monitoring",
        "zoneType": "GreenTeam"
      },
      {
        "type": "securityZone",
        "label": "Orange Team Zone",
        "description": "Orange team conducts security awareness training for developers, focusing on attack vectors",
        "zoneType": "OrangeTeam"
      },
      {
        "type": "securityZone",
        "label": "White Team Zone",
        "description": "White team provides objective assessment of red and blue team activities, ensuring fair execution",
        "zoneType": "WhiteTeam"
      }
    ]
  },
  {
    "title": "Security Components",
    "nodes": [
      {
        "type": "firewall",
        "label": "Firewall",
        "description": "Network firewall"
      },
      {
        "type": "vpnGateway",
        "label": "VPN Gateway",
        "description": "VPN Gateway"
      },
      {
        "type": "ids",
        "label": "IDS",
        "description": "Intrusion Detection System"
      },
      {
        "type": "ips",
        "label": "IPS",
        "description": "Intrusion Prevention System"
      },
      {
        "type": "waf",
        "label": "WAF",
        "description": "Web Application Firewall"
      },
      {
        "type": "proxy",
        "label": "Proxy",
        "description": "Network proxy server"
      },
      {
        "type": "reverseProxy",
        "label": "Reverse Proxy",
        "description": "Reverse proxy server"
      },
      {
        "type": "monitor",
        "label": "Monitor",
        "description": "Network monitoring system"
      },
      {
        "type": "siem",
        "label": "SIEM",
        "description": "Security Information and Event Management"
      },
      {
        "type": "soar",
        "label": "SOAR",
        "description": "Security Orchestration, Automation and Response"
      },
      {
        "type": "xdr",
        "label": "XDR",
        "description": "Extended Detection and Response"
      },
      {
        "type": "edr",
        "label": "EDR",
        "description": "Endpoint Detection and Response"
      },
      {
        "type": "ndr",
        "label": "NDR",
        "description": "Network Detection and Response"
      },
      {
        "type": "casb",
        "label": "CASB",
        "description": "Cloud Access Security Broker"
      },
      {
        "type": "sase",
        "label": "SASE",
        "description": "Secure Access Service Edge"
      },
      {
        "type": "ztna",
        "label": "ZTNA",
        "description": "Zero Trust Network Access"
      },
      {
        "type": "dlp",
        "label": "DLP",
        "description": "Data Loss Prevention"
      },
      {
        "type": "dam",
        "label": "DAM",
        "description": "Database Activity Monitoring"
      },
      {
        "type": "pam",
        "label": "PAM",
        "description": "Privileged Access Management"
      },
      {
        "type": "hsm",
        "label": "HSM",
        "description": "Hardware Security Module"
      },
      {
        "type": "kms",
        "label": "KMS",
        "description": "Key Management Service"
      },
      {
        "type": "secretsManager",
        "label": "Secrets Manager",
        "description": "Secrets and credential storage"
      },
      {
        "type": "certificateAuthority",
        "label": "CA",
        "description": "Certificate Authority"
      },
      {
        "type": "mfa",
        "label": "MFA",
        "description": "Multi-Factor Authentication"
      },
      {
        "type": "sso",
        "label": "SSO",
        "description": "Single Sign-On"
      },
      {
        "type": "ldap",
        "label": "LDAP",
        "description": "Lightweight Directory Access Protocol"
      },
      {
        "type": "radiusServer",
        "label": "RADIUS",
        "description": "Remote Authentication Dial-In User Service"
      },
      {
        "type": "honeypot",
        "label": "Honeypot",
        "description": "Decoy system to attract attackers"
      },
      {
        "type": "honeynet",
        "label": "Honeynet",
        "description": "Network of honeypots"
      },
      {
        "type": "deceptionSystem",
        "label": "Deception",
        "description": "Advanced deception technology"
      },
      {
        "type": "networkTap",
        "label": "Network TAP",
        "description": "Network test access point"
      },
      {
        "type": "packetCapture",
        "label": "Packet Capture",
        "description": "Network packet capture tool"
      },
      {
        "type": "vulnerabilityScanner",
        "label": "Vuln Scanner",
        "description": "Vulnerability assessment tool"
      },
      {
        "type": "patchManagement",
        "label": "Patch Mgmt",
        "description": "Patch management system"
      },
      {
        "type": "configManagement",
        "label": "Config Mgmt",
        "description": "Configuration management"
      },
      {
        "type": "complianceScanner",
        "label": "Compliance",
        "description": "Compliance scanning tool"
      },
      {
        "type": "penTestTool",
        "label": "Pen Test",
        "description": "Penetration testing tools"
      },
      {
        "type": "staticAnalysis",
        "label": "SAST",
        "description": "Static Application Security Testing"
      },
      {
        "type": "dynamicAnalysis",
        "label": "DAST",
        "description": "Dynamic Application Security Testing"
      },
      {
        "type": "containerScanner",
        "label": "Container Scan",
        "description": "Container security scanner"
      },
      {
        "type": "k8sAdmissionController",
        "label": "K8s Admission",
        "description": "Kubernetes admission controller"
      },
      {
        "type": "meshProxy",
        "label": "Mesh Proxy",
        "description": "Service mesh security proxy"
      },
      {
        "type": "apiSecurity",
        "label": "API Security",
        "description": "API security gateway"
      },
      {
        "type": "botProtection",
        "label": "Bot Protection",
        "description": "Bot detection and mitigation"
      },
      {
        "type": "ddosProtection",
        "label": "DDoS Protection",
        "description": "DDoS mitigation service"
      },
      {
        "type": "emailSecurity",
        "label": "Email Security",
        "description": "Email security gateway"
      },
      {
        "type": "webFilter",
        "label": "Web Filter",
        "description": "Web content filtering"
      },
      {
        "type": "sandboxAnalyzer",
        "label": "Sandbox",
        "description": "Malware sandbox analyzer"
      },
      {
        "type": "threatIntelPlatform",
        "label": "Threat Intel",
        "description": "Threat intelligence platform"
      },
      {
        "type": "forensicsStation",
        "label": "Forensics",
        "description": "Digital forensics workstation"
      },
      {
        "type": "incidentResponsePlatform",
        "label": "IR Platform",
        "description": "Incident response platform"
      },
      {
        "type": "backupSystem",
        "label": "Backup",
        "description": "Backup system"
      },
      {
        "type": "disasterRecovery",
        "label": "DR System",
        "description": "Disaster recovery system"
      },
      {
        "type": "encryptionGateway",
        "label": "Encryption GW",
        "description": "Encryption gateway"
      },
      {
        "type": "tokenizer",
        "label": "Tokenizer",
        "description": "Data tokenization service"
      },
      {
        "type": "riskAnalytics",
        "label": "Risk Analytics",
        "description": "Risk analysis platform"
      },
      {
        "type": "identityGovernance",
        "label": "Identity Gov",
        "description": "Identity governance platform"
      },
      {
        "type": "cloudSecurityPosture",
        "label": "CSPM",
        "description": "Cloud Security Posture Management"
      },
      {
        "type": "workloadProtection",
        "label": "CWPP",
        "description": "Cloud Workload Protection Platform"
      },
      {
        "type": "runtimeProtection",
        "label": "Runtime",
        "description": "Runtime application protection"
      },
      {
        "type": "supplychainSecurity",
        "label": "Supply Chain",
        "description": "Software supply chain security"
      },
      {
        "type": "codeRepository",
        "label": "Code Repo",
        "description": "Secure code repository"
      },
      {
        "type": "cicdSecurity",
        "label": "CI/CD Security",
        "description": "CI/CD pipeline security"
      },
      {
        "type": "secretScanner",
        "label": "Secret Scanner",
        "description": "Secrets detection in code"
      },
      {
        "type": "sbom",
        "label": "SBOM",
        "description": "Software Bill of Materials"
      },
      {
        "type": "dependencyScanner",
        "label": "Dependency Scan",
        "description": "Dependency vulnerability scanner"
      },
      {
        "type": "infrastructureAsCode",
        "label": "IaC Security",
        "description": "Infrastructure as Code security"
      },
      {
        "type": "policyAsCode",
        "label": "Policy as Code",
        "description": "Security policy as code"
      },
      {
        "type": "cloudAccessBroker",
        "label": "Cloud Broker",
        "description": "Cloud access broker"
      },
      {
        "type": "remoteAccessGateway",
        "label": "Remote Access",
        "description": "Remote access gateway"
      },
      {
        "type": "bastionHost",
        "label": "Bastion Host",
        "description": "Secure jump server"
      },
      {
        "type": "jumpServer",
        "label": "Jump Server",
        "description": "Administrative access point"
      },
      {
        "type": "aiSecurityGateway",
        "label": "AI Security",
        "description": "AI/ML security gateway"
      },
      {
        "type": "quantumKeyDistribution",
        "label": "Quantum KD",
        "description": "Quantum key distribution"
      },
      {
        "type": "blockchainSecurity",
        "label": "Blockchain",
        "description": "Blockchain security node"
      },
      {
        "type": "otSecurityGateway",
        "label": "OT Security",
        "description": "OT/ICS security gateway"
      },
      {
        "type": "iotSecurityGateway",
        "label": "IoT Security",
        "description": "IoT security gateway"
      },
      {
        "type": "physicalAccessControl",
        "label": "Physical Access",
        "description": "Physical access control system"
      },
      {
        "type": "videoSurveillance",
        "label": "Video Surveillance",
        "description": "Security camera system"
      },
      {
        "type": "securityOrchestrator",
        "label": "Orchestrator",
        "description": "Security orchestration platform"
      },
      {
        "type": "applicationDeliveryController",
        "label": "ADC / Gateway",
        "description": "Application Delivery Controller"
      },
      {
        "type": "identityProvider",
        "label": "Identity Provider",
        "description": "Authentication / IdP service"
      }
    ]
  },
  {
    "title": "Infrastructure",
    "nodes": [
      {
        "type": "user",
        "label": "User",
        "description": "System user or identity"
      },
      {
        "type": "server",
        "label": "Server",
        "description": "Physical or virtual server"
      },
      {
        "type": "workstation",
        "label": "Workstation",
        "description": "End-user computer"
      },
      {
        "type": "endpoint",
        "label": "Endpoint",
        "description": "Generic endpoint device"
      },
      {
        "type": "desktop",
        "label": "Desktop",
        "description": "Desktop computer"
      },
      {
        "type": "laptop",
        "label": "Laptop",
        "description": "Laptop computer"
      },
      {
        "type": "tablet",
        "label": "Tablet",
        "description": "Tablet device"
      },
      {
        "type": "smartphone",
        "label": "Smartphone",
        "description": "Mobile phone device"
      },
      {
        "type": "printer",
        "label": "Printer",
        "description": "Network printer"
      },
      {
        "type": "router",
        "label": "Router",
        "description": "Network router"
      },
      {
        "type": "switch",
        "label": "Switch",
        "description": "Network switch"
      },
      {
        "type": "coreRouter",
        "label": "Core Router",
        "description": "High-capacity backbone router"
      },
      {
        "type": "edgeRouter",
        "label": "Edge Router",
        "description": "Network edge router"
      },
      {
        "type": "accessPoint",
        "label": "Access Point",
        "description": "Wireless access point"
      },
      {
        "type": "wirelessController",
        "label": "Wireless Controller",
        "description": "Centralized Wi-Fi management"
      },
      {
        "type": "gateway",
        "label": "Gateway",
        "description": "Network gateway"
      },
      {
        "type": "modem",
        "label": "Modem",
        "description": "Internet modem"
      },
      {
        "type": "networkBridge",
        "label": "Network Bridge",
        "description": "Network bridge device"
      },
      {
        "type": "networkHub",
        "label": "Network Hub",
        "description": "Legacy network hub"
      },
      {
        "type": "dns",
        "label": "DNS Server",
        "description": "Domain Name System server"
      },
      {
        "type": "dhcp",
        "label": "DHCP Server",
        "description": "Dynamic Host Configuration Protocol server"
      },
      {
        "type": "ntpServer",
        "label": "NTP Server",
        "description": "Network Time Protocol server"
      },
      {
        "type": "proxyCache",
        "label": "Proxy Cache",
        "description": "Caching proxy server"
      },
      {
        "type": "voipPhone",
        "label": "VoIP Phone",
        "description": "Voice over IP phone"
      },
      {
        "type": "pbx",
        "label": "PBX",
        "description": "Private Branch Exchange"
      },
      {
        "type": "sipServer",
        "label": "SIP Server",
        "description": "Session Initiation Protocol server"
      },
      {
        "type": "conferenceSystem",
        "label": "Conference System",
        "description": "Video/audio conferencing system"
      },
      {
        "type": "san",
        "label": "SAN",
        "description": "Storage Area Network"
      },
      {
        "type": "nas",
        "label": "NAS",
        "description": "Network Attached Storage"
      },
      {
        "type": "storageArray",
        "label": "Storage Array",
        "description": "Enterprise storage array"
      },
      {
        "type": "tapeLibrary",
        "label": "Tape Library",
        "description": "Backup tape library"
      },
      {
        "type": "ups",
        "label": "UPS",
        "description": "Uninterruptible Power Supply"
      },
      {
        "type": "pdu",
        "label": "PDU",
        "description": "Power Distribution Unit"
      },
      {
        "type": "hvac",
        "label": "HVAC",
        "description": "Heating, Ventilation, Air Conditioning"
      },
      {
        "type": "rackServer",
        "label": "Rack Server",
        "description": "Rack-mounted server"
      },
      {
        "type": "bladeServer",
        "label": "Blade Server",
        "description": "Blade server chassis"
      },
      {
        "type": "loadBalancerHw",
        "label": "HW Load Balancer",
        "description": "Hardware load balancer appliance"
      },
      {
        "type": "wanOptimizer",
        "label": "WAN Optimizer",
        "description": "WAN optimization appliance"
      },
      {
        "type": "networkProbe",
        "label": "Network Probe",
        "description": "Network monitoring probe"
      },
      {
        "type": "packetBroker",
        "label": "Packet Broker",
        "description": "Network packet broker"
      },
      {
        "type": "fiberTerminal",
        "label": "Fiber Terminal",
        "description": "Fiber optic terminal"
      },
      {
        "type": "multiplexer",
        "label": "Multiplexer",
        "description": "Network multiplexer"
      },
      {
        "type": "mediaConverter",
        "label": "Media Converter",
        "description": "Network media converter"
      },
      {
        "type": "terminalServer",
        "label": "Terminal Server",
        "description": "Remote access terminal server"
      },
      {
        "type": "cellTower",
        "label": "Cell Tower",
        "description": "Cellular network tower"
      },
      {
        "type": "wirelessBridge",
        "label": "Wireless Bridge",
        "description": "Point-to-point wireless bridge"
      },
      {
        "type": "meshNode",
        "label": "Mesh Node",
        "description": "Wireless mesh network node"
      },
      {
        "type": "repeater",
        "label": "Repeater",
        "description": "Network signal repeater"
      },
      {
        "type": "edgeServer",
        "label": "Edge Server",
        "description": "Edge computing server"
      },
      {
        "type": "fogNode",
        "label": "Fog Node",
        "description": "Fog computing node"
      },
      {
        "type": "microDatacenter",
        "label": "Micro DC",
        "description": "Micro datacenter"
      },
      {
        "type": "kvm",
        "label": "KVM Switch",
        "description": "Keyboard, Video, Mouse switch"
      },
      {
        "type": "serialConsole",
        "label": "Serial Console",
        "description": "Serial console server"
      },
      {
        "type": "timeClock",
        "label": "Time Clock",
        "description": "Network time clock"
      },
      {
        "type": "environmentSensor",
        "label": "Env Sensor",
        "description": "Environmental monitoring sensor"
      },
      {
        "type": "thinClient",
        "label": "Thin Client",
        "description": "Zero / thin client terminal"
      },
      {
        "type": "virtualDesktopHost",
        "label": "VDI Host",
        "description": "Virtual desktop infrastructure host"
      },
      {
        "type": "sdwanGateway",
        "label": "SD-WAN Gateway",
        "description": "SD-WAN edge gateway"
      }
    ]
  },
  {
    "title": "Applications",
    "nodes": [
      {
        "type": "application",
        "label": "Application",
        "description": "Generic application"
      },
      {
        "type": "database",
        "label": "Database",
        "description": "Database server"
      },
      {
        "type": "loadBalancer",
        "label": "Load Balancer",
        "description": "Load balancer"
      },
      {
        "type": "apiGateway",
        "label": "API Gateway",
        "description": "API Gateway"
      },
      {
        "type": "webServer",
        "label": "Web Server",
        "description": "Web server"
      },
      {
        "type": "authServer",
        "label": "Auth Server",
        "description": "Authentication server"
      },
      {
        "type": "messageBroker",
        "label": "Message Broker",
        "description": "Message broker"
      },
      {
        "type": "api",
        "label": "API Service",
        "description": "RESTful API service"
      },
      {
        "type": "service",
        "label": "Service",
        "description": "Microservice or business service"
      },
      {
        "type": "containerizedService",
        "label": "Containerized Service",
        "description": "Docker/Kubernetes containerized service"
      },
      {
        "type": "cache",
        "label": "Cache",
        "description": "Caching layer"
      },
      {
        "type": "storage",
        "label": "Storage",
        "description": "Data storage system"
      },
      {
        "type": "vault",
        "label": "Vault",
        "description": "Credential and secret storage"
      },
      {
        "type": "identity",
        "label": "Identity Provider",
        "description": "Identity and access management"
      },
      {
        "type": "logging",
        "label": "Logging",
        "description": "Log aggregation and analysis"
      }
    ]
  },
  {
    "title": "Application Architecture",
    "nodes": [
      {
        "type": "memoryPool",
        "label": "Memory Pool",
        "description": "Application memory allocation and management"
      },
      {
        "type": "executionContext",
        "label": "Execution Context",
        "description": "Runtime execution context and thread management"
      },
      {
        "type": "sessionStore",
        "label": "Session Store",
        "description": "User session data storage and management"
      },
      {
        "type": "inputBuffer",
        "label": "Input Buffer",
        "description": "Input data buffering and preprocessing"
      },
      {
        "type": "outputBuffer",
        "label": "Output Buffer",
        "description": "Output data buffering and postprocessing"
      },
      {
        "type": "configManager",
        "label": "Config Manager",
        "description": "Application configuration and settings management"
      },
      {
        "type": "cryptoModule",
        "label": "Crypto Module",
        "description": "Cryptographic operations and key management"
      },
      {
        "type": "tokenValidator",
        "label": "Token Validator",
        "description": "Authentication token validation and parsing"
      },
      {
        "type": "permissionEngine",
        "label": "Permission Engine",
        "description": "Authorization and permission checking logic"
      },
      {
        "type": "auditLogger",
        "label": "Audit Logger",
        "description": "Security event logging and audit trail"
      },
      {
        "type": "kernelModule",
        "label": "Kernel Module",
        "description": "Operating system kernel module or driver code running in ring 0"
      },
      {
        "type": "deviceDriver",
        "label": "Device Driver",
        "description": "Hardware device driver interacting with kernel and firmware"
      },
      {
        "type": "hypervisor",
        "label": "Hypervisor",
        "description": "Virtualization layer controlling guest VMs and hardware isolation"
      },
      {
        "type": "firmware",
        "label": "Firmware",
        "description": "System firmware such as UEFI/BIOS controlling hardware initialization"
      },
      {
        "type": "secureEnclave",
        "label": "Secure Enclave",
        "description": "Hardware-based isolated execution environment (e.g., SGX, SEV, TEE)"
      },
      {
        "type": "tpm",
        "label": "TPM",
        "description": "Trusted Platform Module for attestation and secure key storage"
      },
      {
        "type": "microcode",
        "label": "Microcode",
        "description": "CPU microcode layer controlling low-level processor behavior"
      }
    ]
  },
  {
    "title": "Cloud Services",
    "nodes": [
      {
        "type": "cloudService",
        "label": "Cloud Service",
        "description": "Generic cloud service"
      },
      {
        "type": "containerRegistry",
        "label": "Container Registry",
        "description": "Container image registry"
      },
      {
        "type": "kubernetesPod",
        "label": "K8s Pod",
        "description": "Kubernetes pod"
      },
      {
        "type": "kubernetesService",
        "label": "K8s Service",
        "description": "Kubernetes service"
      },
      {
        "type": "storageAccount",
        "label": "Storage",
        "description": "Cloud storage"
      },
      {
        "type": "functionApp",
        "label": "Function",
        "description": "Serverless function"
      },
      {
        "type": "apiManagement",
        "label": "API Management",
        "description": "API management service"
      },
      {
        "type": "cloudLoadBalancer",
        "label": "Cloud LB",
        "description": "Cloud load balancer"
      },
      {
        "type": "cloudFirewall",
        "label": "Cloud Firewall",
        "description": "Cloud firewall"
      },
      {
        "type": "cloudDatabase",
        "label": "Cloud DB",
        "description": "Cloud database"
      },
      {
        "type": "search",
        "label": "Search Service",
        "description": "Cloud search and indexing service"
      }
    ]
  },
  {
    "title": "AWS Services",
    "nodes": [
      {
        "type": "awsEC2",
        "label": "EC2",
        "description": "Elastic Compute Cloud - Virtual Servers"
      },
      {
        "type": "awsLambda",
        "label": "Lambda",
        "description": "Serverless compute service"
      },
      {
        "type": "awsElasticBeanstalk",
        "label": "Elastic Beanstalk",
        "description": "Easy-to-use service for deploying applications"
      },
      {
        "type": "awsECS",
        "label": "ECS",
        "description": "Elastic Container Service"
      },
      {
        "type": "awsEKS",
        "label": "EKS",
        "description": "Elastic Kubernetes Service"
      },
      {
        "type": "awsFargate",
        "label": "Fargate",
        "description": "Serverless compute for containers"
      },
      {
        "type": "awsS3",
        "label": "S3",
        "description": "Simple Storage Service - Object storage"
      },
      {
        "type": "awsEBS",
        "label": "EBS",
        "description": "Elastic Block Store"
      },
      {
        "type": "awsEFS",
        "label": "EFS",
        "description": "Elastic File System"
      },
      {
        "type": "awsGlacier",
        "label": "Glacier",
        "description": "Archive storage service"
      },
      {
        "type": "awsRDS",
        "label": "RDS",
        "description": "Relational Database Service"
      },
      {
        "type": "awsDynamoDB",
        "label": "DynamoDB",
        "description": "NoSQL database service"
      },
      {
        "type": "awsElastiCache",
        "label": "ElastiCache",
        "description": "In-memory caching service"
      },
      {
        "type": "awsRedshift",
        "label": "Redshift",
        "description": "Data warehouse service"
      },
      {
        "type": "awsAurora",
        "label": "Aurora",
        "description": "MySQL and PostgreSQL compatible database"
      },
      {
        "type": "awsVPC",
        "label": "VPC",
        "description": "Virtual Private Cloud"
      },
      {
        "type": "awsCloudFront",
        "label": "CloudFront",
        "description": "Content Delivery Network"
      },
      {
        "type": "awsRoute53",
        "label": "Route 53",
        "description": "DNS web service"
      },
      {
        "type": "awsDirectConnect",
        "label": "Direct Connect",
        "description": "Dedicated network connection"
      },
      {
        "type": "awsTransitGateway",
        "label": "Transit Gateway",
        "description": "Network transit hub"
      },
      {
        "type": "awsAPIGateway",
        "label": "API Gateway",
        "description": "Create, publish, and secure APIs"
      },
      {
        "type": "awsSNS",
        "label": "SNS",
        "description": "Simple Notification Service"
      },
      {
        "type": "awsSQS",
        "label": "SQS",
        "description": "Simple Queue Service"
      },
      {
        "type": "awsEventBridge",
        "label": "EventBridge",
        "description": "Serverless event bus"
      },
      {
        "type": "awsIAM",
        "label": "IAM",
        "description": "Identity and Access Management"
      },
      {
        "type": "awsCognito",
        "label": "Cognito",
        "description": "User authentication and authorization"
      },
      {
        "type": "awsSSO",
        "label": "SSO",
        "description": "Single Sign-On"
      },
      {
        "type": "awsSecretsManager",
        "label": "Secrets Manager",
        "description": "Secrets management"
      },
      {
        "type": "awsKMS",
        "label": "KMS",
        "description": "Key Management Service"
      },
      {
        "type": "awsACM",
        "label": "ACM",
        "description": "Certificate Manager"
      },
      {
        "type": "awsDirectory",
        "label": "Directory Service",
        "description": "Managed Active Directory"
      },
      {
        "type": "awsGuardDuty",
        "label": "GuardDuty",
        "description": "Threat detection service"
      },
      {
        "type": "awsSecurityHub",
        "label": "Security Hub",
        "description": "Security posture management"
      },
      {
        "type": "awsWAF",
        "label": "WAF",
        "description": "Web Application Firewall"
      },
      {
        "type": "awsShield",
        "label": "Shield",
        "description": "DDoS protection"
      },
      {
        "type": "awsInspector",
        "label": "Inspector",
        "description": "Vulnerability assessment"
      },
      {
        "type": "awsDetective",
        "label": "Detective",
        "description": "Security investigation"
      },
      {
        "type": "awsFirewallManager",
        "label": "Firewall Manager",
        "description": "Centralized firewall management"
      },
      {
        "type": "awsNetworkFirewall",
        "label": "Network Firewall",
        "description": "Network traffic filtering"
      },
      {
        "type": "awsConfig",
        "label": "Config",
        "description": "Configuration monitoring"
      },
      {
        "type": "awsCloudTrail",
        "label": "CloudTrail",
        "description": "Audit logging"
      },
      {
        "type": "awsCloudWatch",
        "label": "CloudWatch",
        "description": "Monitoring and observability"
      },
      {
        "type": "awsMacie",
        "label": "Macie",
        "description": "Data security and privacy"
      },
      {
        "type": "awsSecurityLake",
        "label": "Security Lake",
        "description": "Security data lake"
      },
      {
        "type": "awsAccessAnalyzer",
        "label": "Access Analyzer",
        "description": "Resource access analysis"
      },
      {
        "type": "awsCodePipeline",
        "label": "CodePipeline",
        "description": "Continuous delivery service"
      },
      {
        "type": "awsCodeBuild",
        "label": "CodeBuild",
        "description": "Build and test service"
      },
      {
        "type": "awsCodeDeploy",
        "label": "CodeDeploy",
        "description": "Automated deployment"
      },
      {
        "type": "awsCodeCommit",
        "label": "CodeCommit",
        "description": "Source control service"
      },
      {
        "type": "awsXRay",
        "label": "X-Ray",
        "description": "Distributed tracing"
      },
      {
        "type": "awsCloudWatchLogs",
        "label": "CloudWatch Logs",
        "description": "Log management"
      }
    ]
  },
  {
    "title": "Azure Services",
    "nodes": [
      {
        "type": "azureVM",
        "label": "Virtual Machines",
        "description": "Scalable virtual machines"
      },
      {
        "type": "azureAppService",
        "label": "App Service",
        "description": "Build and host web applications"
      },
      {
        "type": "azureFunctions",
        "label": "Functions",
        "description": "Serverless compute service"
      },
      {
        "type": "azureKubernetesService",
        "label": "AKS",
        "description": "Azure Kubernetes Service"
      },
      {
        "type": "azureContainerInstances",
        "label": "Container Instances",
        "description": "Run containers without managing servers"
      },
      {
        "type": "azureContainerApps",
        "label": "Container Apps",
        "description": "Serverless containers"
      },
      {
        "type": "azureBatch",
        "label": "Batch",
        "description": "Cloud-scale job scheduling"
      },
      {
        "type": "azureBlobStorage",
        "label": "Blob Storage",
        "description": "Object storage for unstructured data"
      },
      {
        "type": "azureFileStorage",
        "label": "File Storage",
        "description": "Managed file shares"
      },
      {
        "type": "azureManagedDisks",
        "label": "Managed Disks",
        "description": "High-performance block storage"
      },
      {
        "type": "azureStorage",
        "label": "Storage Account",
        "description": "General purpose storage"
      },
      {
        "type": "azureDataLakeStorage",
        "label": "Data Lake Storage",
        "description": "Analytics data lake"
      },
      {
        "type": "azureSQLDatabase",
        "label": "SQL Database",
        "description": "Managed relational database"
      },
      {
        "type": "azureCosmosDB",
        "label": "Cosmos DB",
        "description": "Globally distributed NoSQL database"
      },
      {
        "type": "azureRedisCache",
        "label": "Redis Cache",
        "description": "In-memory data store"
      },
      {
        "type": "azureSynapseAnalytics",
        "label": "Synapse Analytics",
        "description": "Analytics service"
      },
      {
        "type": "azureDatabaseForPostgreSQL",
        "label": "PostgreSQL",
        "description": "Managed PostgreSQL"
      },
      {
        "type": "azureDatabaseForMySQL",
        "label": "MySQL",
        "description": "Managed MySQL"
      },
      {
        "type": "azureVirtualNetwork",
        "label": "Virtual Network",
        "description": "Private network in Azure"
      },
      {
        "type": "azureLoadBalancer",
        "label": "Load Balancer",
        "description": "High availability load balancing"
      },
      {
        "type": "azureApplicationGateway",
        "label": "Application Gateway",
        "description": "Web traffic load balancer"
      },
      {
        "type": "azureFrontDoor",
        "label": "Front Door",
        "description": "Global load balancing and CDN"
      },
      {
        "type": "azureVPNGateway",
        "label": "VPN Gateway",
        "description": "Cross-premises connectivity"
      },
      {
        "type": "azureExpressRoute",
        "label": "ExpressRoute",
        "description": "Private connection to Azure"
      },
      {
        "type": "azureTrafficManager",
        "label": "Traffic Manager",
        "description": "DNS-based traffic routing"
      },
      {
        "type": "azureDNS",
        "label": "DNS",
        "description": "DNS hosting"
      },
      {
        "type": "azureActiveDirectory",
        "label": "Azure AD",
        "description": "Identity and access management"
      },
      {
        "type": "azureADB2C",
        "label": "Azure AD B2C",
        "description": "Customer identity management"
      },
      {
        "type": "azureManagedIdentity",
        "label": "Managed Identity",
        "description": "Managed identities for Azure resources"
      },
      {
        "type": "azureKeyVault",
        "label": "Key Vault",
        "description": "Secure key management"
      },
      {
        "type": "azureInformationProtection",
        "label": "Information Protection",
        "description": "Data classification and protection"
      },
      {
        "type": "azurePrivilegedIdentityManagement",
        "label": "PIM",
        "description": "Privileged access management"
      },
      {
        "type": "azureSecurityCenter",
        "label": "Security Center",
        "description": "Unified security management"
      },
      {
        "type": "azureSentinel",
        "label": "Sentinel",
        "description": "Cloud-native SIEM"
      },
      {
        "type": "azureDefender",
        "label": "Defender",
        "description": "Threat protection"
      },
      {
        "type": "azureFirewall",
        "label": "Firewall",
        "description": "Cloud-native firewall"
      },
      {
        "type": "azureDDoSProtection",
        "label": "DDoS Protection",
        "description": "DDoS mitigation"
      },
      {
        "type": "azureBastion",
        "label": "Bastion",
        "description": "Secure RDP/SSH connectivity"
      },
      {
        "type": "azurePrivateLink",
        "label": "Private Link",
        "description": "Private connectivity"
      },
      {
        "type": "azurePolicy",
        "label": "Policy",
        "description": "Governance and compliance"
      },
      {
        "type": "azureBlueprints",
        "label": "Blueprints",
        "description": "Environment orchestration"
      },
      {
        "type": "azureArc",
        "label": "Arc",
        "description": "Hybrid and multi-cloud management"
      },
      {
        "type": "azureMonitor",
        "label": "Monitor",
        "description": "Full-stack monitoring"
      },
      {
        "type": "azureLogAnalytics",
        "label": "Log Analytics",
        "description": "Log aggregation and analysis"
      },
      {
        "type": "azureApplicationInsights",
        "label": "Application Insights",
        "description": "Application performance monitoring"
      },
      {
        "type": "azureAutomation",
        "label": "Automation",
        "description": "Process automation"
      },
      {
        "type": "azureDevOps",
        "label": "DevOps",
        "description": "Development collaboration"
      },
      {
        "type": "azureArtifacts",
        "label": "Artifacts",
        "description": "Package management"
      },
      {
        "type": "azurePipelines",
        "label": "Pipelines",
        "description": "CI/CD pipelines"
      }
    ]
  },
  {
    "title": "GCP Services",
    "nodes": [
      {
        "type": "gcpComputeEngine",
        "label": "Compute Engine",
        "description": "Virtual machines in Google's data center"
      },
      {
        "type": "gcpAppEngine",
        "label": "App Engine",
        "description": "Fully managed serverless platform"
      },
      {
        "type": "gcpCloudFunctions",
        "label": "Cloud Functions",
        "description": "Event-driven serverless compute"
      },
      {
        "type": "gcpCloudRun",
        "label": "Cloud Run",
        "description": "Fully managed containerized apps"
      },
      {
        "type": "gcpGKE",
        "label": "GKE",
        "description": "Google Kubernetes Engine"
      },
      {
        "type": "gcpBatch",
        "label": "Batch",
        "description": "Batch processing service"
      },
      {
        "type": "gcpCloudStorage",
        "label": "Cloud Storage",
        "description": "Object storage service"
      },
      {
        "type": "gcpPersistentDisk",
        "label": "Persistent Disk",
        "description": "Block storage for VM instances"
      },
      {
        "type": "gcpFilestore",
        "label": "Filestore",
        "description": "Managed file storage"
      },
      {
        "type": "gcpContainerRegistry",
        "label": "Container Registry",
        "description": "Store and manage Docker images"
      },
      {
        "type": "gcpArtifactRegistry",
        "label": "Artifact Registry",
        "description": "Universal package manager"
      },
      {
        "type": "gcpCloudSQL",
        "label": "Cloud SQL",
        "description": "Fully managed relational database"
      },
      {
        "type": "gcpFirestore",
        "label": "Firestore",
        "description": "NoSQL document database"
      },
      {
        "type": "gcpBigQuery",
        "label": "BigQuery",
        "description": "Serverless data warehouse"
      },
      {
        "type": "gcpBigtable",
        "label": "Bigtable",
        "description": "Scalable NoSQL wide-column database"
      },
      {
        "type": "gcpSpanner",
        "label": "Spanner",
        "description": "Globally distributed database"
      },
      {
        "type": "gcpMemorystore",
        "label": "Memorystore",
        "description": "Managed Redis and Memcached"
      },
      {
        "type": "gcpVPC",
        "label": "VPC",
        "description": "Virtual Private Cloud networking"
      },
      {
        "type": "gcpCloudLoadBalancing",
        "label": "Load Balancing",
        "description": "High performance load balancing"
      },
      {
        "type": "gcpCloudCDN",
        "label": "Cloud CDN",
        "description": "Content delivery network"
      },
      {
        "type": "gcpCloudDNS",
        "label": "Cloud DNS",
        "description": "DNS service"
      },
      {
        "type": "gcpCloudVPN",
        "label": "Cloud VPN",
        "description": "Managed VPN service"
      },
      {
        "type": "gcpCloudInterconnect",
        "label": "Cloud Interconnect",
        "description": "Private connection"
      },
      {
        "type": "gcpCloudArmor",
        "label": "Cloud Armor",
        "description": "DDoS protection and WAF"
      },
      {
        "type": "gcpIAM",
        "label": "IAM",
        "description": "Identity and Access Management"
      },
      {
        "type": "gcpIdentityPlatform",
        "label": "Identity Platform",
        "description": "Customer identity management"
      },
      {
        "type": "gcpCloudIdentity",
        "label": "Cloud Identity",
        "description": "Identity as a Service"
      },
      {
        "type": "gcpSecretManager",
        "label": "Secret Manager",
        "description": "Secrets management"
      },
      {
        "type": "gcpCloudKMS",
        "label": "Cloud KMS",
        "description": "Key management service"
      },
      {
        "type": "gcpCertificateAuthority",
        "label": "Certificate Authority",
        "description": "Private CA service"
      },
      {
        "type": "gcpSecurityCommandCenter",
        "label": "Security Command Center",
        "description": "Security and risk management"
      },
      {
        "type": "gcpWebSecurityScanner",
        "label": "Web Security Scanner",
        "description": "Web vulnerability scanner"
      },
      {
        "type": "gcpCloudIDS",
        "label": "Cloud IDS",
        "description": "Intrusion detection system"
      },
      {
        "type": "gcpBinaryAuthorization",
        "label": "Binary Authorization",
        "description": "Deploy-time security"
      },
      {
        "type": "gcpContainerAnalysis",
        "label": "Container Analysis",
        "description": "Container vulnerability scanning"
      },
      {
        "type": "gcpCloudDLP",
        "label": "Cloud DLP",
        "description": "Data loss prevention"
      },
      {
        "type": "gcpVPCServiceControls",
        "label": "VPC Service Controls",
        "description": "Service perimeter security"
      },
      {
        "type": "gcpAccessContextManager",
        "label": "Access Context Manager",
        "description": "Context-aware access"
      },
      {
        "type": "gcpPolicyIntelligence",
        "label": "Policy Intelligence",
        "description": "IAM policy insights"
      },
      {
        "type": "gcpVertexAI",
        "label": "Vertex AI",
        "description": "Unified ML platform"
      },
      {
        "type": "gcpAutoML",
        "label": "AutoML",
        "description": "Automated machine learning"
      },
      {
        "type": "gcpAIPlatform",
        "label": "AI Platform",
        "description": "Machine learning platform"
      },
      {
        "type": "gcpCloudMonitoring",
        "label": "Cloud Monitoring",
        "description": "Infrastructure monitoring"
      },
      {
        "type": "gcpCloudLogging",
        "label": "Cloud Logging",
        "description": "Log management"
      },
      {
        "type": "gcpCloudTrace",
        "label": "Cloud Trace",
        "description": "Distributed tracing"
      },
      {
        "type": "gcpCloudProfiler",
        "label": "Cloud Profiler",
        "description": "Application profiling"
      },
      {
        "type": "gcpCloudBuild",
        "label": "Cloud Build",
        "description": "Continuous integration"
      },
      {
        "type": "gcpCloudDeploy",
        "label": "Cloud Deploy",
        "description": "Continuous delivery"
      },
      {
        "type": "gcpCloudSourceRepositories",
        "label": "Source Repositories",
        "description": "Git repositories"
      }
    ]
  },
  {
    "title": "IBM Cloud",
    "nodes": [
      {
        "type": "ibmVirtualServer",
        "label": "Virtual Server",
        "description": "Provisioned compute instances"
      },
      {
        "type": "ibmBareMetalServer",
        "label": "Bare Metal Server",
        "description": "Dedicated physical servers"
      },
      {
        "type": "ibmCodeEngine",
        "label": "Code Engine",
        "description": "Serverless platform for containerized workloads"
      },
      {
        "type": "ibmCloudFunctions",
        "label": "Cloud Functions",
        "description": "Serverless functions as a service"
      },
      {
        "type": "ibmKubernetes",
        "label": "Kubernetes Service",
        "description": "Managed Kubernetes clusters"
      },
      {
        "type": "ibmRedHatOpenShift",
        "label": "Red Hat OpenShift",
        "description": "Enterprise Kubernetes platform"
      },
      {
        "type": "ibmObjectStorage",
        "label": "Object Storage",
        "description": "Durable object storage"
      },
      {
        "type": "ibmBlockStorage",
        "label": "Block Storage",
        "description": "High-performance block storage"
      },
      {
        "type": "ibmFileStorage",
        "label": "File Storage",
        "description": "Network-attached file storage"
      },
      {
        "type": "ibmDatabase",
        "label": "Database",
        "description": "Managed database services"
      },
      {
        "type": "ibmCloudant",
        "label": "Cloudant",
        "description": "NoSQL JSON database"
      },
      {
        "type": "ibmDB2",
        "label": "DB2",
        "description": "Relational database service"
      },
      {
        "type": "ibmDatabases",
        "label": "Databases for...",
        "description": "Managed database services"
      },
      {
        "type": "ibmVPC",
        "label": "VPC",
        "description": "Virtual Private Cloud networking"
      },
      {
        "type": "ibmLoadBalancer",
        "label": "Load Balancer",
        "description": "Application load balancing"
      },
      {
        "type": "ibmCloudInternetServices",
        "label": "Cloud Internet Services",
        "description": "DDoS protection and CDN"
      },
      {
        "type": "ibmDirectLink",
        "label": "Direct Link",
        "description": "Dedicated network connection"
      },
      {
        "type": "ibmTransitGateway",
        "label": "Transit Gateway",
        "description": "Connect VPCs and on-premises networks"
      },
      {
        "type": "ibmCloudIAM",
        "label": "Cloud IAM",
        "description": "Identity and Access Management"
      },
      {
        "type": "ibmAppID",
        "label": "App ID",
        "description": "Application user authentication"
      },
      {
        "type": "ibmKeyProtect",
        "label": "Key Protect",
        "description": "Key management service"
      },
      {
        "type": "ibmSecretsManager",
        "label": "Secrets Manager",
        "description": "Centralized secrets management"
      },
      {
        "type": "ibmSecurityGateway",
        "label": "Security Gateway",
        "description": "Perimeter and access control"
      },
      {
        "type": "ibmSecurityAdvisor",
        "label": "Security and Compliance Center",
        "description": "Security posture management"
      },
      {
        "type": "ibmCertificateManager",
        "label": "Certificate Manager",
        "description": "SSL/TLS certificate management"
      },
      {
        "type": "ibmHyperProtect",
        "label": "Hyper Protect",
        "description": "Keep Your Own Key encryption"
      },
      {
        "type": "ibmCloudFirewall",
        "label": "Cloud Firewall",
        "description": "Network security firewall"
      },
      {
        "type": "ibmCloudMonitoring",
        "label": "Cloud Monitoring",
        "description": "Infrastructure and application monitoring"
      },
      {
        "type": "ibmLogAnalysis",
        "label": "Log Analysis",
        "description": "Centralized log management"
      },
      {
        "type": "ibmActivityTracker",
        "label": "Activity Tracker",
        "description": "Audit and compliance tracking"
      },
      {
        "type": "ibmWatsonStudio",
        "label": "Watson Studio",
        "description": "AI and machine learning platform"
      },
      {
        "type": "ibmWatsonAssistant",
        "label": "Watson Assistant",
        "description": "Conversational AI chatbot"
      },
      {
        "type": "ibmWatsonDiscovery",
        "label": "Watson Discovery",
        "description": "AI-powered search and analytics"
      },
      {
        "type": "ibmContinuousDelivery",
        "label": "Continuous Delivery",
        "description": "DevOps toolchain and pipeline"
      },
      {
        "type": "ibmCloudShell",
        "label": "Cloud Shell",
        "description": "Browser-based shell environment"
      }
    ]
  },
  {
    "title": "OT/SCADA",
    "nodes": [
      {
        "type": "plc",
        "label": "PLC",
        "description": "Programmable Logic Controller"
      },
      {
        "type": "hmi",
        "label": "HMI",
        "description": "Human Machine Interface"
      },
      {
        "type": "historian",
        "label": "Historian",
        "description": "Data historian"
      },
      {
        "type": "rtu",
        "label": "RTU",
        "description": "Remote Terminal Unit"
      },
      {
        "type": "sensor",
        "label": "Sensor",
        "description": "Industrial sensor"
      },
      {
        "type": "actuator",
        "label": "Actuator",
        "description": "Industrial actuator"
      },
      {
        "type": "scadaServer",
        "label": "SCADA Server",
        "description": "SCADA control server"
      },
      {
        "type": "industrialFirewall",
        "label": "Industrial FW",
        "description": "Industrial firewall"
      },
      {
        "type": "safetySystem",
        "label": "Safety System",
        "description": "Safety instrumented system"
      },
      {
        "type": "industrialNetwork",
        "label": "Industrial Net",
        "description": "Industrial network"
      }
    ]
  },
  {
    "title": "AI/ML",
    "nodes": [
      {
        "type": "aiGateway",
        "label": "AI Gateway",
        "description": "API gateway for AI services with authentication and rate limiting"
      },
      {
        "type": "inferenceEngine",
        "label": "Inference Engine",
        "description": "AI model inference service for real-time predictions"
      },
      {
        "type": "modelRegistry",
        "label": "Model Registry",
        "description": "Central repository for trained AI models and metadata"
      },
      {
        "type": "aiWorkbench",
        "label": "AI Workbench",
        "description": "Development environment for data scientists and ML engineers"
      },
      {
        "type": "mlPipeline",
        "label": "ML Pipeline",
        "description": "Automated ML training and deployment pipeline"
      },
      {
        "type": "aiModel",
        "label": "AI Model Store",
        "description": "Secure storage for proprietary AI models and weights"
      },
      {
        "type": "vectorDatabase",
        "label": "Vector Database",
        "description": "High-performance vector database for embeddings and similarity search"
      },
      {
        "type": "dataLake",
        "label": "Data Lake",
        "description": "Secure data lake containing training datasets and sensitive information"
      },
      {
        "type": "featureStore",
        "label": "Feature Store",
        "description": "Centralized repository for ML features with lineage tracking"
      },
      {
        "type": "llmService",
        "label": "LLM Service",
        "description": "Self-hosted large language model for sensitive operations"
      },
      {
        "type": "ai",
        "label": "AI System",
        "description": "Generic AI/ML system or service"
      },
      {
        "type": "mlInference",
        "label": "ML Inference",
        "description": "GPU-accelerated model serving and inference engine"
      },
      {
        "type": "notebookServer",
        "label": "Notebook Server",
        "description": "Interactive notebook environment for data science and ML development"
      },
      {
        "type": "computeCluster",
        "label": "Compute Cluster",
        "description": "Distributed computing cluster for model training and batch processing"
      },
      {
        "type": "modelVault",
        "label": "Model Vault",
        "description": "Secure storage for proprietary models and encryption keys"
      },
      {
        "type": "securityScanner",
        "label": "Security Scanner",
        "description": "Vulnerability and security scanner for threat analysis"
      }
    ]
  },
  {
    "title": "Cybercrime & Fraud",
    "nodes": [
      {
        "type": "fraudDetection",
        "label": "Fraud Detection",
        "description": "System for detecting fraudulent transactions and activities"
      },
      {
        "type": "transactionMonitor",
        "label": "Transaction Monitor",
        "description": "Real-time transaction monitoring and alerting"
      },
      {
        "type": "antiMalware",
        "label": "Anti-Malware",
        "description": "Malware detection and prevention system"
      },
      {
        "type": "honeypot",
        "label": "Honeypot",
        "description": "Decoy system to attract and analyze attackers"
      },
      {
        "type": "threatFeed",
        "label": "Threat Intelligence",
        "description": "External threat intelligence feed"
      },
      {
        "type": "sandboxEnv",
        "label": "Sandbox",
        "description": "Isolated environment for malware analysis"
      },
      {
        "type": "forensicsWorkstation",
        "label": "Forensics Station",
        "description": "Digital forensics workstation for incident analysis"
      },
      {
        "type": "incidentResponse",
        "label": "Incident Response",
        "description": "Incident response management system"
      },
      {
        "type": "cyberInsurance",
        "label": "Cyber Insurance",
        "description": "Cyber insurance policy and claims management"
      },
      {
        "type": "fraudAnalytics",
        "label": "Fraud Analytics",
        "description": "Advanced analytics for fraud pattern detection"
      }
    ]
  },
  {
    "title": "Privacy & Data Protection",
    "nodes": [
      {
        "type": "dataClassifier",
        "label": "Data Classifier",
        "description": "Automatically classifies data based on sensitivity"
      },
      {
        "type": "consentManager",
        "label": "Consent Manager",
        "description": "Manages user consent and preferences"
      },
      {
        "type": "dataMapper",
        "label": "Data Mapper",
        "description": "Maps data flows and lineage across systems"
      },
      {
        "type": "privacyScanner",
        "label": "Privacy Scanner",
        "description": "Scans systems for privacy compliance issues"
      },
      {
        "type": "dataRetention",
        "label": "Data Retention",
        "description": "Manages data retention policies and deletion"
      },
      {
        "type": "dataAnonymizer",
        "label": "Data Anonymizer",
        "description": "Anonymizes or pseudonymizes personal data"
      },
      {
        "type": "gdprCompliance",
        "label": "GDPR Compliance",
        "description": "GDPR compliance monitoring and reporting"
      },
      {
        "type": "dataBreach",
        "label": "Breach Detection",
        "description": "Data breach detection and notification system"
      },
      {
        "type": "privacyImpact",
        "label": "Privacy Impact",
        "description": "Privacy impact assessment tools"
      },
      {
        "type": "dataSubjectRights",
        "label": "Data Subject Rights",
        "description": "Handles data subject access and deletion requests"
      }
    ]
  },
  {
    "title": "Red Teaming",
    "nodes": [
      {
        "type": "attackBox",
        "label": "Attack Box",
        "description": "Red team operator workstation for attack simulation"
      },
      {
        "type": "payloadServer",
        "label": "Payload Server",
        "description": "Server hosting malicious payloads and exploits"
      },
      {
        "type": "c2Server",
        "label": "C2 Server",
        "description": "Command and control server for managing compromised systems"
      },
      {
        "type": "implant",
        "label": "Implant",
        "description": "Malicious code or backdoor installed on target system"
      },
      {
        "type": "phishingServer",
        "label": "Phishing Server",
        "description": "Server hosting phishing campaigns and credential harvesting"
      },
      {
        "type": "exfilChannel",
        "label": "Exfiltration Channel",
        "description": "Covert channel for data exfiltration and communication"
      },
      {
        "type": "pivotPoint",
        "label": "Pivot Point",
        "description": "Compromised system used as stepping stone for lateral movement"
      },
      {
        "type": "credentialHarvester",
        "label": "Credential Harvester",
        "description": "Tool or technique for collecting user credentials"
      },
      {
        "type": "lateralMovement",
        "label": "Lateral Movement",
        "description": "Technique for moving through network after initial compromise"
      },
      {
        "type": "persistenceMechanism",
        "label": "Persistence",
        "description": "Method for maintaining access to compromised system"
      }
    ]
  },
  {
    "title": "Security Operations",
    "nodes": [
      {
        "type": "socWorkstation",
        "label": "SOC Workstation",
        "description": "Security analyst workstation for monitoring and investigation"
      },
      {
        "type": "threatHuntingPlatform",
        "label": "Threat Hunting Platform",
        "description": "Platform for proactive threat hunting and analysis"
      },
      {
        "type": "ctiFeed",
        "label": "CTI Feed",
        "description": "Cyber threat intelligence feed aggregator"
      },
      {
        "type": "attackSurfaceMonitor",
        "label": "Attack Surface Monitor",
        "description": "External attack surface monitoring service"
      },
      {
        "type": "deceptionToken",
        "label": "Deception Token",
        "description": "Canary token or honey file for detection"
      },
      {
        "type": "behaviorAnalytics",
        "label": "Behavior Analytics",
        "description": "User and entity behavior analytics platform"
      },
      {
        "type": "networkForensics",
        "label": "Network Forensics",
        "description": "Network traffic capture and forensics appliance"
      },
      {
        "type": "malwareRepository",
        "label": "Malware Repository",
        "description": "Secure storage for malware samples and analysis"
      },
      {
        "type": "indicatorStore",
        "label": "Indicator Store",
        "description": "IoC management and correlation platform"
      },
      {
        "type": "playbookEngine",
        "label": "Playbook Engine",
        "description": "Security orchestration and automated response"
      }
    ]
  }
] as const;
