import { resolveCodeSessionTarget } from './src/runtime/code-session-targets.js';

const sessions = [
  { id: '24745176-9267-47ae-97e9-3c05bc874f52', title: 'Test Tactical Game App', workspaceRoot: 'S:\\Development\\TestApp' },
  { id: 'da47084e-7fde-4638-b77c-3f0bbb5c3684', title: 'Guardian Agent', workspaceRoot: 'S:\\Development\\GuardianAgent' }
];

console.log(resolveCodeSessionTarget('Guardian Agent', sessions));
