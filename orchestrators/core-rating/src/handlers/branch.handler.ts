import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'node:vm';

@Injectable()
export class BranchHandler {
  readonly type = 'branch';
  private readonly logger = new Logger(BranchHandler.name);

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const branches = config.branches as Array<{
      label: string;
      conditionExpression: string;
      targetStepId: string;
    }> | undefined;

    if (!branches?.length) {
      return {
        status: 'completed',
        output: { message: 'No branches configured — falling through' },
        durationMs: Date.now() - start,
      };
    }

    const sandbox = vm.createContext({
      request: context.request ?? {},
      working: context.working ?? {},
    });

    for (const branch of branches) {
      try {
        const code = `(function() { return Boolean((${branch.conditionExpression})); })()`;
        const result = vm.runInNewContext(code, sandbox, {
          timeout: 100,
          displayErrors: true,
        });

        if (result === true) {
          this.logger.log(
            `Branch "${branch.label}" matched — jumping to step ${branch.targetStepId}`,
            context.correlationId,
          );
          return {
            status: 'completed',
            nextStepId: branch.targetStepId,
            branchDecision: {
              conditionEvaluated: branch.conditionExpression,
              result: true,
              branchLabel: branch.label,
              targetStepName: branch.targetStepId,
            },
            output: {
              branchLabel: branch.label,
              conditionEvaluated: branch.conditionExpression,
              result: true,
              targetStepId: branch.targetStepId,
              allBranches: branches.map((b) => b.label),
            },
            durationMs: Date.now() - start,
          };
        }
      } catch (err) {
        this.logger.warn(
          `Branch "${branch.label}" expression error: ${err instanceof Error ? err.message : String(err)}`,
          context.correlationId,
        );
      }
    }

    // No branch matched — use default target or fall through
    const defaultTarget = config.defaultTargetStepId as string | undefined;
    this.logger.log(
      `No branch matched — ${defaultTarget ? `using default target ${defaultTarget}` : 'falling through to next step by order'}`,
      context.correlationId,
    );

    return {
      status: 'completed',
      ...(defaultTarget && { nextStepId: defaultTarget }),
      branchDecision: {
        conditionEvaluated: 'none matched',
        result: false,
        branchLabel: 'default',
        targetStepName: defaultTarget ?? 'next-by-order',
      },
      output: {
        branchLabel: 'default (no match)',
        allBranches: branches.map((b) => b.label),
        defaultTargetStepId: defaultTarget,
      },
      durationMs: Date.now() - start,
    };
  }

  validate(config: any) {
    const branches = config?.branches;
    if (!branches || !Array.isArray(branches) || branches.length === 0) {
      return { valid: false, errors: ['Branch step must have at least one branch condition'] };
    }
    const errors: string[] = [];
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      if (!b.conditionExpression) errors.push(`Branch ${i}: conditionExpression is required`);
      if (!b.targetStepId) errors.push(`Branch ${i}: targetStepId is required`);
      if (!b.label) errors.push(`Branch ${i}: label is required`);
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
