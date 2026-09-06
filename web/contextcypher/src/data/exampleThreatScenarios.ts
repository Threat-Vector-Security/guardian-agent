// Example threat scenarios for targeted threat analysis
import { ThreatScenarioFile } from '../types/SecurityTypes';

export interface ExampleThreatScenario extends ThreatScenarioFile {
  id: string;
  recommendedSystem: string;
  systemName: string;
}

export const exampleThreatScenarios: ExampleThreatScenario[] = [
  {
    id: 'apt29-supply-chain',
    version: '1.0',
    name: 'APT29 (Cozy Bear) Supply Chain Attack',
    description: 'Analysis focused on APT29\'s sophisticated supply chain and cloud infrastructure attacks',
    targetedAnalysis: {
      threatActors: 'APT29 (Cozy Bear, The Dukes, YTTRIUM) - Russian state-sponsored threat group targeting government, diplomatic, and technology organizations',
      ttps: 'T1195 Supply Chain Compromise, T1199 Trusted Relationship, T1078.004 Valid Accounts: Cloud Accounts, T1550.001 Use Alternate Authentication Material: Application Access Token, T1606 Forge Web Credentials, T1484 Domain Policy Modification, T1098.001 Additional Cloud Credentials',
      vulnerabilities: 'SolarWinds Orion vulnerabilities, Log4j (CVE-2021-44228), ProxyShell (CVE-2021-34473), Azure AD misconfigurations, Weak service principal credentials, Missing cloud audit logging',
      focusAreas: 'CI/CD pipelines, Software supply chain, Cloud service principals, Azure/AWS admin interfaces, Development environments, Source code repositories',
      scenarioDescription: 'APT29 is known for sophisticated supply chain attacks and living-off-the-land techniques in cloud environments. They exploit trust relationships and compromise development infrastructure to gain persistent access. This scenario examines potential attack paths through development and cloud management systems based on their documented techniques.'
    },
    timestamp: '2024-01-15T10:30:00.000Z',
    recommendedSystem: 'supply-chain-dev',
    systemName: 'Software Supply Chain & Development - APT29'
  },
  {
    id: 'scattered-spider-identity',
    version: '1.0',
    name: 'Scattered Spider Identity Attack',
    description: 'Analysis focused on Scattered Spider threat group\'s identity-focused attack patterns',
    targetedAnalysis: {
      threatActors: 'Scattered Spider (UNC3944, 0ktapus, Roasted 0ktapus) - Financially motivated cybercriminal group known for social engineering and identity attacks',
      ttps: 'T1078 Valid Accounts, T1566.001 Spearphishing Attachment, T1621 Multi-Factor Authentication Request Generation, T1556.006 Multi-Factor Authentication, T1110 Brute Force, T1136.003 Create Cloud Account, T1098 Account Manipulation',
      vulnerabilities: 'Weak MFA enrollment processes, Lack of phishing-resistant authentication, Missing conditional access policies, Vulnerable identity federation configurations, Default privileged account settings',
      focusAreas: 'Identity and Access Management systems (Okta, Azure AD), vSphere/VMware infrastructure, Cloud admin portals, Privileged access management',
      scenarioDescription: 'Scattered Spider typically targets organizations through sophisticated social engineering to compromise identity systems. They are known for calling help desks to reset MFA, exploiting identity provider weaknesses, and moving laterally through cloud environments. This scenario analyzes how they might exploit identity and virtualization infrastructure based on their known tactics.'
    },
    timestamp: '2024-01-15T10:00:00.000Z',
    recommendedSystem: 'finance-identity',
    systemName: 'Financial Services Identity Infrastructure - Scattered Spider'
  },
  {
    id: 'ransomware-mass-exploitation',
    version: '1.0',
    name: 'Ransomware Groups Mass Exploitation',
    description: 'Analysis focused on common ransomware group tactics exploiting public-facing applications',
    targetedAnalysis: {
      threatActors: 'Various Ransomware Groups (LockBit, BlackCat/ALPHV, Clop, Play) - Financially motivated cybercriminals using ransomware-as-a-service models',
      ttps: 'T1190 Exploit Public-Facing Application, T1133 External Remote Services, T1021.001 Remote Desktop Protocol, T1486 Data Encrypted for Impact, T1490 Inhibit System Recovery, T1489 Service Stop, T1003 OS Credential Dumping',
      vulnerabilities: 'ProxyLogon/ProxyShell (Exchange), Log4j (CVE-2021-44228), Fortinet VPN vulnerabilities, Citrix Bleed (CVE-2023-4966), MOVEit Transfer SQL injection, ESXi ransomware vulnerabilities, Exposed RDP services',
      focusAreas: 'Internet-facing applications, VPN gateways, Remote access services, Backup systems, Virtualization infrastructure (VMware ESXi), File transfer applications',
      scenarioDescription: 'Ransomware groups continuously scan for and exploit vulnerabilities in internet-facing services. They target VPNs, web applications, and remote access to gain initial access, then move laterally to encrypt critical systems. This analysis focuses on common entry points and paths to business-critical infrastructure, particularly virtualization platforms and backup systems that maximize impact.'
    },
    timestamp: '2024-01-15T11:00:00.000Z',
    recommendedSystem: 'healthcare-ransomware',
    systemName: 'Healthcare System - Ransomware Groups'
  }
];