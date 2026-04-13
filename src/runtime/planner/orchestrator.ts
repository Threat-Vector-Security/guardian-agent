import type { ExecutionPlan, PlanNode } from './types.js';
import type { SemanticReflector } from './reflection.js';
import type { ReflectiveLearningQueue } from './learning-queue.js';

export class AssistantOrchestrator {
  constructor(
    private readonly executeNode: (node: PlanNode) => Promise<unknown>,
    private readonly reflector?: SemanticReflector,
    private readonly learningQueue?: ReflectiveLearningQueue
  ) {}

  async executePlan(plan: ExecutionPlan): Promise<void> {
    plan.status = 'executing';

    const nodes = Object.values(plan.nodes);
    let allCompleted = false;
    let hasFailures = false;

    // Simple DAG traversal: execute nodes with no pending dependencies
    while (!allCompleted && !hasFailures) {
      let progressMade = false;
      allCompleted = true;

      for (const node of nodes) {
        if (node.status === 'success' || node.status === 'failed') {
          continue; // Already finished
        }

        allCompleted = false;

        if (node.status === 'running') {
          continue; // Currently running (if we were async parallel, but we are simulating sequential here for simplicity)
        }

        // Check if dependencies are met
        const canRun = node.dependencies.every(depId => plan.nodes[depId]?.status === 'success');

        if (canRun) {
          node.status = 'running';
          progressMade = true;
          try {
            node.result = await this.executeNode(node);

            // Phase 2: Semantic Reflection
            if (this.reflector) {
              const reflection = await this.reflector.evaluateNode(plan.originalObjective, node);
              if (!reflection.success) {
                node.status = 'failed';
                node.result = { originalResult: node.result, reflectionReason: reflection.reason };
                hasFailures = true;
                break; // Stop on first semantic failure
              }
            }

            node.status = 'success';
          } catch (err) {
            node.status = 'failed';
            node.result = err;
            hasFailures = true;
            break; // Stop on first failure for now
          }
        }
      }

      if (!progressMade && !allCompleted && !hasFailures) {
        // Deadlock detected
        plan.status = 'failed';
        hasFailures = true;
        break;
      }
    }

    if (hasFailures) {
      plan.status = 'failed';
    } else if (allCompleted) {
      plan.status = 'completed';
    }

    // Phase 2: Post-trajectory evaluation via Learning Queue
    if (this.learningQueue) {
      // Fire and forget, or await depending on whether we want to block response
      await this.learningQueue.evaluateTrajectory(plan).catch(err => {
        console.error('ReflectiveLearningQueue: Failed to evaluate trajectory:', err);
      });
    }
  }
}
