/**
 * Multi-Agent Example — Two agents communicating through the EventBus.
 *
 * Agent A (Producer) emits events periodically.
 * Agent B (Consumer) listens for events and processes them.
 *
 * Run: npx tsx examples/multi-agent.ts
 */

import { Runtime } from '../src/runtime/runtime.js';
import { BaseAgent, createAgentDefinition } from '../src/agent/agent.js';
import type { AgentContext, AgentResponse, UserMessage } from '../src/agent/types.js';
import type { AgentEvent } from '../src/queue/event-bus.js';

// Producer agent: emits data events when messaged
class ProducerAgent extends BaseAgent {
  private batchCount = 0;

  constructor() {
    super('producer', 'Producer Agent', { handleMessages: true });
  }

  async onMessage(message: UserMessage, ctx: AgentContext): Promise<AgentResponse> {
    this.batchCount++;
    console.log(`[Producer] Received: "${message.content}" → emitting batch ${this.batchCount}`);

    await ctx.emit({
      type: 'data.produced',
      targetAgentId: 'consumer',
      payload: { value: this.batchCount * 10, batch: this.batchCount },
    });

    return { content: `Produced batch ${this.batchCount}` };
  }
}

// Consumer agent: processes events from producer
class ConsumerAgent extends BaseAgent {
  processedEvents: Array<{ value: number; batch: number }> = [];

  constructor() {
    super('consumer', 'Consumer Agent', { handleEvents: true, handleMessages: true });
  }

  async onEvent(event: AgentEvent, _ctx: AgentContext): Promise<void> {
    const payload = event.payload as { value: number; batch: number };
    console.log(`[Consumer] Processing event: value=${payload.value}, batch=${payload.batch}`);
    this.processedEvents.push(payload);
  }

  async onMessage(_message: UserMessage, _ctx: AgentContext): Promise<AgentResponse> {
    return {
      content: `Consumer has processed ${this.processedEvents.length} events`,
    };
  }
}

async function main(): Promise<void> {
  console.log('=== GuardianAgent Multi-Agent Example ===\n');

  const runtime = new Runtime();

  const producer = new ProducerAgent();
  const consumer = new ConsumerAgent();

  runtime.registerAgent(createAgentDefinition({ agent: producer }));
  runtime.registerAgent(createAgentDefinition({ agent: consumer }));

  await runtime.start();

  // Send messages to producer which will emit events to consumer
  for (let i = 1; i <= 3; i++) {
    const response = await runtime.dispatchMessage('producer', {
      id: String(i),
      userId: 'demo-user',
      channel: 'demo',
      content: `Produce item ${i}`,
      timestamp: Date.now(),
    });
    console.log(`  → Producer response: ${response.content}`);
    console.log();
  }

  // Give async events time to settle
  await new Promise(r => setTimeout(r, 50));

  // Check consumer's state
  console.log(`Consumer processed ${consumer.processedEvents.length} events`);
  for (const event of consumer.processedEvents) {
    console.log(`  - Batch ${event.batch}: value=${event.value}`);
  }

  await runtime.stop();
  console.log('\n=== Done ===');
}

main().catch(console.error);
