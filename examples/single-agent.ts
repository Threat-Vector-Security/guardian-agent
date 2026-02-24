/**
 * Single Agent Example — Event-Driven
 *
 * Demonstrates: agent registration, message dispatch, lifecycle.
 *
 * Run: npx tsx examples/single-agent.ts
 */

import { Runtime } from '../src/runtime/runtime.js';
import { BaseAgent, createAgentDefinition } from '../src/agent/agent.js';
import type { AgentContext, AgentResponse, UserMessage } from '../src/agent/types.js';

// A simple greeting agent that responds to messages
class GreetingAgent extends BaseAgent {
  private greetCount = 0;

  constructor() {
    super('greeter', 'Greeting Agent', { handleMessages: true });
  }

  async onStart(ctx: AgentContext): Promise<void> {
    console.log(`[${this.name}] Started! LLM provider: ${ctx.llm?.name ?? 'none'}`);
  }

  async onStop(): Promise<void> {
    console.log(`[${this.name}] Stopped after ${this.greetCount} greetings.`);
  }

  async onMessage(message: UserMessage, _ctx: AgentContext): Promise<AgentResponse> {
    this.greetCount++;
    return {
      content: `Hello, ${message.userId}! You said: "${message.content}" (greeting #${this.greetCount})`,
    };
  }
}

async function main(): Promise<void> {
  console.log('=== GuardianAgent Single Agent Example ===\n');

  const runtime = new Runtime();

  // Register our agent
  const agent = new GreetingAgent();
  runtime.registerAgent(createAgentDefinition({ agent }));

  // Start the runtime
  await runtime.start();

  // Simulate some messages
  const messages = ['Hi there!', 'How are you?', 'Goodbye!'];

  for (const content of messages) {
    const response = await runtime.dispatchMessage('greeter', {
      id: String(Date.now()),
      userId: 'demo-user',
      channel: 'demo',
      content,
      timestamp: Date.now(),
    });
    console.log(`User: ${content}`);
    console.log(`Agent: ${response.content}`);
    console.log();
  }

  // Check agent state
  const instance = runtime.registry.get('greeter');
  console.log(`Agent state: ${instance?.state}`);

  // Graceful shutdown
  await runtime.stop();
  console.log('\n=== Done ===');
}

main().catch(console.error);
