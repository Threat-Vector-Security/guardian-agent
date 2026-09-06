# Security testing

- [Prepublication review](PREPUBLICATION-2026-09-06.md): credential scans, dependency patches and dataset exclusions.
- [Functional checks](../test-results/README.md): recorded browser/API workflows.
- [Current security policy](../../SECURITY.md)
- [Known issues](../KNOWN-ISSUES.md)

Run `npm run test:security-workspace` and `npm audit` for the security service and complete dependency graph. See the [testing guide](../guides/INTEGRATION-TEST-HARNESS.md) for supporting checks.

Keep raw logs, screenshots containing local inventory, credentials and private evaluation inputs outside the published documentation. Record a sanitised summary of the evidence and its limits.
