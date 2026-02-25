import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RulesService } from './rules.service';
import type { EvaluateRequest, EvaluateResponse } from './rules.service';
import { AiPromptsService } from '../ai-prompts/ai-prompts.service';

@Controller('rules')
export class RulesController {
  private readonly logger = new Logger(RulesController.name);

  constructor(
    private readonly rulesService: RulesService,
    private readonly aiPromptsService: AiPromptsService,
  ) {}

  @Get()
  findAll(@Query('productLineCode') productLineCode?: string) {
    return this.rulesService.findAll(productLineCode);
  }

  @Post()
  create(@Body() body: any) {
    const { conditions, actions, ...ruleData } = body;
    return this.rulesService.createWithRelations(ruleData, conditions, actions);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rulesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    const { conditions, actions, ...ruleData } = body;
    return this.rulesService.updateWithRelations(id, ruleData, conditions, actions);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.rulesService.delete(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.rulesService.activate(id);
  }

  @Post('evaluate')
  evaluate(@Body() body: EvaluateRequest): Promise<EvaluateResponse> {
    return this.rulesService.evaluate(body);
  }

  // ── Scope Tags ────────────────────────────────────────────────────────────

  @Get(':id/scope-tags')
  listScopeTags(@Param('id') id: string) {
    return this.rulesService.listScopeTags(id);
  }

  @Post(':id/scope-tags')
  addScopeTag(@Param('id') id: string, @Body() body: { scopeType: string; scopeValue: string }) {
    return this.rulesService.addScopeTag(id, body.scopeType, body.scopeValue);
  }

  @Delete(':id/scope-tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteScopeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.rulesService.deleteScopeTag(id, tagId);
  }

  // ── AI Rule Generation ────────────────────────────────────────────────────

  @Post('generate-ai')
  async generateWithAI(
    @Body() body: { requirements: string; productLineCode?: string; context?: string },
  ): Promise<{ rule: any; confidence: number }> {
    const desc = body.requirements ?? body.context ?? '';
    const plCode = body.productLineCode ?? 'UNKNOWN';

    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const awsSessionToken = process.env.AWS_SESSION_TOKEN;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    const useExplicitCreds = !!(awsKey && awsSecret);

    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
      const clientConfig: {
        region: string;
        credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
      } = { region: awsRegion };
      if (useExplicitCreds) {
        clientConfig.credentials = {
          accessKeyId: awsKey,
          secretAccessKey: awsSecret,
          ...(awsSessionToken && { sessionToken: awsSessionToken }),
        };
      }
      const client = new BedrockRuntimeClient(clientConfig);

        const prompt = await this.aiPromptsService.buildPrompt(
          'rule-generate',
          { productLine: plCode, description: desc },
          `You are an expert in insurance business rules and rating systems.
Convert this plain-English description into a structured insurance rule JSON.

Product Line Code: {{productLine}}
Description: "{{description}}"

Respond ONLY with valid JSON using this exact structure:
{
  "name": "Snake_Case_Rule_Name",
  "description": "one clear sentence describing the rule",
  "conditions": [
    { "field": "dot.path.field", "operator": "==", "value": "someValue" }
  ],
  "actions": [
    { "actionType": "surcharge", "targetField": "premium", "value": "0.05" }
  ],
  "confidence": 0.9
}

Rules:
- field uses dot notation (e.g. insured.state, building.yearBuilt, insured.annualRevenue, risk.claimCount)
- operator must be one of: ==, !=, >, >=, <, <=, contains, in, not_in, is_null, is_not_null
- actionType must be one of: surcharge, discount, multiply, set, add, subtract, reject
- value for surcharge/discount is a decimal (0.20 = 20%)
- for "in" operator, value is a comma-separated list: "CA,NY,NJ"
- multiple conditions are all ANDed together
- output only JSON, no explanation`,
        );

        const payload = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        };

        const cmd = new InvokeModelCommand({
          modelId,
          body: Buffer.from(JSON.stringify(payload)),
          contentType: 'application/json',
          accept: 'application/json',
        });

        const res = await client.send(cmd);
        const responseText = JSON.parse(new TextDecoder().decode(res.body)).content[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { rule: this.buildRuleFromParsed(parsed, plCode), confidence: parsed.confidence ?? 0.9 };
        }
    } catch (e: any) {
      this.logger.warn(`Bedrock call failed: ${e?.message ?? e} — falling back to heuristic`);
    }

    return this.generateFromTemplate(desc, plCode);
  }

  /** Generate a step run-condition JavaScript expression from plain-English description. */
  @Post('generate-condition-expression')
  async generateConditionExpression(
    @Body() body: { description: string; stepName?: string; stepType?: string; productLineCode?: string },
  ): Promise<{ expression: string; source: 'bedrock' | 'heuristic' }> {
    const desc = body.description?.trim() ?? '';
    const stepName = body.stepName ?? 'this step';
    const stepType = body.stepType ?? '';
    const productLine = body.productLineCode ?? '';

    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const awsSessionToken = process.env.AWS_SESSION_TOKEN;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

    // Use Bedrock when we have a region. Credentials: from .env if set, otherwise SDK default chain (~/.aws/credentials, AWS_PROFILE, etc.)
    const useExplicitCreds = !!(awsKey && awsSecret);
    if (useExplicitCreds) {
      this.logger.log('Generate condition: using Bedrock (credentials from .env)');
    } else {
      this.logger.log('Generate condition: using Bedrock (credentials from default chain: ~/.aws/credentials or env)');
    }

    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
      const clientConfig: {
        region: string;
        credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
      } = { region: awsRegion };
      if (useExplicitCreds) {
        clientConfig.credentials = {
          accessKeyId: awsKey,
          secretAccessKey: awsSecret,
          ...(awsSessionToken && { sessionToken: awsSessionToken }),
        };
      }
      const client = new BedrockRuntimeClient(clientConfig);

      const systemPrompt = `You generate exactly one JavaScript expression for a step "run condition". No other text.

Context:
- request = original request payload (object)
- working = current pipeline state after previous steps (object)

Rules:
- Output ONLY the expression. No explanation, no markdown, no code fence, no "return", no semicolon.
- Use optional chaining: working?.policy?.field, request?.scope?.type.
- Expression must evaluate to true (run) or false (skip). For "X is present" use !!working?.path or Boolean(working?.path).
- Only use request and working; no require, no async.

Examples:
- "if policy.dunsNumber is present" -> !!working?.policy?.dunsNumber
- "when request has state" -> !!request?.state
- "only if working has coverage type" -> !!working?.coverage?.type`;

      const userPrompt = `Step: ${stepName}${stepType ? ` (${stepType})` : ''}${productLine ? ` | Product: ${productLine}` : ''}

When should this step run?
"${desc}"

Output only the single JavaScript expression, nothing else.`;

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      };

      const cmd = new InvokeModelCommand({
        modelId,
        body: Buffer.from(JSON.stringify(payload)),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const res = await client.send(cmd);
      const bodyJson = JSON.parse(new TextDecoder().decode(res.body));
      const content = bodyJson?.content?.[0];
      const responseText =
        typeof content?.text === 'string' ? content.text.trim() : JSON.stringify(bodyJson).slice(0, 500);
      if (!responseText) {
        throw new ServiceUnavailableException('Bedrock returned an empty response.');
      }
      // Strip markdown code block if present
      let expression = responseText
        .replace(/^```(?:js|javascript)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .replace(/^\s*return\s+/i, '')
        .replace(/;+\s*$/, '')
        .trim();
      if (!expression) {
        expression = responseText.trim();
      }
      // Reject clearly broken or incomplete output (e.g. "working?.if" or truncated)
      if (!this.isReasonableConditionExpression(expression)) {
        this.logger.warn(`Bedrock condition expression rejected as invalid: "${expression}" — using heuristic`);
        const fallback = this.generateConditionExpressionFromDescription(desc);
        return { expression: fallback, source: 'heuristic' };
      }
      // Normalize "is present" logic: !! = run when present; ! or !!! invert it. Use exactly !! for path checks.
      expression = this.normalizeConditionExpressionNegation(expression);
      this.logger.log('Condition expression generated with Bedrock');
      return { expression: expression || 'true', source: 'bedrock' };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const code = err?.name ?? err?.Code ?? '';
      this.logger.warn(
        `Bedrock condition-expression failed: ${msg}${code ? ` (${code})` : ''} — falling back to heuristic`,
      );
      if (err?.stack) this.logger.debug(err.stack);
    }

    this.logger.log('Condition expression generated with heuristic (Bedrock not configured or unavailable)');
    return { expression: this.generateConditionExpressionFromDescription(desc), source: 'heuristic' };
  }

  /**
   * Ensure "is present" style checks use !! (run when present), not ! or !!! (which invert logic).
   * Bedrock sometimes returns !!!request?.policy?.dunsNumber; we normalize to !!request?.policy?.dunsNumber.
   */
  private normalizeConditionExpressionNegation(expression: string): string {
    const m = expression.match(/^(!+)\s*((?:request|working)\?\..+)$/);
    if (!m) return expression;
    const leading = m[1];
    const rest = m[2];
    // Odd number of ! means "run when absent" — wrong for "is present". Use exactly !! so step runs when value is present.
    if (leading.length % 2 === 1) {
      return `!!${rest}`;
    }
    // Even (e.g. !! or !!!!) — keep !! for clarity
    return leading.length >= 2 ? `!!${rest}` : expression;
  }

  /** Reject truncated or nonsensical Bedrock output so we can fall back to heuristic. */
  private isReasonableConditionExpression(expression: string): boolean {
    const s = expression.trim();
    if (!s || s.length < 3) return false;
    // Incomplete optional chain (e.g. "working?.if" or "working?.")
    if (s.endsWith('?.') || /\?\.(?:if|else|return|function)\b/.test(s)) return false;
    // Should look like a boolean expression: references request/working or is literal true/false
    const hasRef = /\b(?:request|working)\b/.test(s) || /^\s*(?:true|false)\s*$/.test(s);
    const noInvalid = !/\b(?:return|await|require|import)\b/.test(s);
    return hasRef && noInvalid;
  }

  /** Path must be a real field path, not the words "if" or "when". */
  private static readonly CONDITION_PATH_BLACKLIST = /\b(?:if|when|then|else|request|working)\b/i;

  /**
   * Heuristic fallback when Bedrock is not configured or fails (same pattern as rule generate-ai).
   * Extracts field paths from "X is present" / "if X" style descriptions and returns a simple expression.
   */
  private generateConditionExpressionFromDescription(desc: string): string {
    const lower = desc.toLowerCase();
    const useRequest = /\b(request\.|in request|from request)\b/.test(lower);
    const root = useRequest ? 'request' : 'working';

    // Prefer a dotted path (e.g. policy.dunsNumber) — most reliable and can't be "if"/"when"
    const dottedPath = desc.match(/\b([a-zA-Z_$][a-zA-Z0-9_]*\.[a-zA-Z0-9_$.]+)\b/);
    if (dottedPath) {
      const path = dottedPath[1].trim();
      if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(path)) {
        const chain = path.split('.').map((p) => p.trim()).filter(Boolean).join('?.');
        return `!!${root}?.${chain}`;
      }
    }

    // Match "policy.dunsNumber is present" or "dunsNumber present" (path not the word "if"/"when")
    const pathPresentMatch = desc.match(/([a-zA-Z_$][a-zA-Z0-9_$.]+)\s*(?:is\s+)?(?:present|exists)/i);
    if (pathPresentMatch) {
      const path = pathPresentMatch[1].trim();
      if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(path) && !RulesController.CONDITION_PATH_BLACKLIST.test(path)) {
        const chain = path.split('.').map((p) => p.trim()).filter(Boolean).join('?.');
        return `!!${root}?.${chain}`;
      }
    }

    // Match "if X" / "when X" and take the next identifier or dotted path; reject "if"/"when" as path
    const whenMatch = desc.match(/(?:when|if)\s+([a-zA-Z_$][a-zA-Z0-9_$.]+)(?:\s+(?:is\s+)?(?:present|exists))?/i);
    if (whenMatch) {
      const path = whenMatch[1].trim();
      if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(path) && !RulesController.CONDITION_PATH_BLACKLIST.test(path)) {
        const chain = path.split('.').map((p) => p.trim()).filter(Boolean).join('?.');
        return `!!${root}?.${chain}`;
      }
    }

    return 'true';
  }

  private buildRuleFromParsed(parsed: any, plCode: string): any {
    return {
      name: parsed.name ?? 'Generated_Rule',
      description: parsed.description ?? '',
      productLineCode: plCode,
      isActive: false,
      conditions: (parsed.conditions ?? []).map((c: any, i: number) => ({
        field: c.field ?? c.fieldPath,
        operator: c.operator,
        value: c.value,
        logicalGroup: 0,
      })),
      actions: (parsed.actions ?? []).map((a: any, i: number) => ({
        actionType: a.actionType ?? a.type,
        targetField: a.targetField ?? a.field,
        value: a.value,
        sortOrder: i,
      })),
    };
  }

  private generateFromTemplate(desc: string, plCode: string): { rule: any; confidence: number } {
    const lower = desc.toLowerCase();

    // Extract percentage
    const pctMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    const pct = pctMatch ? parseFloat(pctMatch[1]) / 100 : 0.05;

    // Determine primary action — surcharge/discount/multiply take priority over reject
    // because prompts often say "apply X% ... and reject if Y" (two separate intents)
    const hasDiscount = /discount|reduce|lower|decrease/.test(lower);
    const hasMultiply = /multiply|times|factor/.test(lower);
    const hasSet = /\bset\b|assign/.test(lower);
    const hasReject = /reject|decline|deny/.test(lower);
    const hasSurcharge = /surcharge|increase|load/.test(lower) || (pctMatch !== null && !hasDiscount);

    let primaryAction = 'surcharge';
    if (hasDiscount) primaryAction = 'discount';
    else if (hasMultiply) primaryAction = 'multiply';
    else if (hasSet) primaryAction = 'set';
    else if (hasReject && !hasSurcharge) primaryAction = 'reject';

    // Build conditions from heuristics
    const conditions: any[] = [];

    // State condition — match on original `desc` (case-sensitive) so the English word
    // "or" in "NY or NJ" is not mistakenly matched as state code OR (Oregon)
    const stateMatch = desc.match(
      /\b(CA|NY|NJ|TX|FL|IL|PA|OH|GA|NC|MI|WA|AZ|CO|TN|MO|MA|MD|MN|WI|VA|AL|SC|KY|LA|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|RI|MT|DE|SD|ND|AK|VT|WY|DC|IN|OR)\b/g,
    );
    if (stateMatch) {
      // Deduplicate and filter out common English words that happen to be state codes
      const skipWords = new Set(['IN', 'OR', 'DE', 'ME', 'HI']); // ambiguous with prepositions
      const states = [...new Set(stateMatch.map((s) => s.toUpperCase()))].filter((s) => {
        // Only include ambiguous codes when they appear next to other state codes or after "state is/in"
        if (!skipWords.has(s)) return true;
        // Accept if it appears in context like "state is OR" or alongside unambiguous state codes
        const idx = desc.toUpperCase().indexOf(s);
        const before = desc.slice(Math.max(0, idx - 15), idx).toLowerCase();
        return /state\s+(is|in|=)|,\s*$/.test(before) || stateMatch.length > 1;
      });
      if (states.length === 1) {
        conditions.push({ field: 'insured.state', operator: '==', value: states[0], logicalGroup: 0 });
      } else if (states.length > 1) {
        conditions.push({ field: 'insured.state', operator: 'in', value: states.join(','), logicalGroup: 0 });
      }
    }

    // Revenue condition
    const revMatch = lower.match(/revenue[^0-9]*(\d[\d,]*)/) ?? lower.match(/(\d[\d,]*)\s*(?:million|m)\b/i);
    if (revMatch) {
      const amount = parseInt(revMatch[1].replace(/,/g, '')) * (lower.includes('million') ? 1000000 : 1);
      conditions.push({ field: 'insured.annualRevenue', operator: '>', value: amount, logicalGroup: 0 });
    }

    // Employee count condition
    const empMatch = lower.match(/(?:employees?|headcount|staff)[^0-9]*(\d[\d,]*)/i) ??
      lower.match(/(?:number of employees|employee count)[^0-9]*(\d[\d,]*)/i);
    if (empMatch) {
      const count = parseInt(empMatch[1].replace(/,/g, ''));
      conditions.push({ field: 'insured.employeeCount', operator: '>', value: count, logicalGroup: 0 });
    }

    // Building age condition
    const ageMatch = lower.match(/(?:building|structure)[^0-9]*(\d+)\s*years?/i) ??
      lower.match(/over\s+(\d+)\s*years?\s*old/i);
    if (ageMatch) {
      conditions.push({
        field: 'building.yearBuilt',
        operator: '<',
        value: new Date().getFullYear() - parseInt(ageMatch[1]),
        logicalGroup: 0,
      });
    }

    // Fallback condition
    if (conditions.length === 0) {
      conditions.push({ field: 'insured.state', operator: '==', value: 'XX', logicalGroup: 0 });
    }

    // Build name from first 6 meaningful words
    const nameParts = desc
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('_');
    const name = nameParts.replace(/[^A-Za-z0-9_]/g, '');

    // Build actions — reject uses an empty targetField and a short reason string
    const actions: any[] = [];
    if (primaryAction === 'reject') {
      actions.push({ actionType: 'reject', targetField: '', value: 'Submission rejected', sortOrder: 0 });
    } else {
      actions.push({ actionType: primaryAction, targetField: 'premium', value: String(pct), sortOrder: 0 });
    }

    return {
      rule: {
        name: name || 'Generated_Rule',
        description: desc,
        productLineCode: plCode,
        isActive: false,
        conditions,
        actions,
      },
      confidence: 0.6,
    };
  }
}
