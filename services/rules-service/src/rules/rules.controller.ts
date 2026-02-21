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
} from '@nestjs/common';
import { RulesService, EvaluateRequest, EvaluateResponse } from './rules.service';
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

    const awsRegion = process.env.AWS_REGION;
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

    if (awsRegion && awsKey && awsSecret) {
      try {
        const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
        const client = new BedrockRuntimeClient({
          region: awsRegion,
          credentials: { accessKeyId: awsKey, secretAccessKey: awsSecret },
        });

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
        this.logger.warn(`Bedrock call failed: ${e.message} — falling back to heuristic`);
      }
    }

    return this.generateFromTemplate(desc, plCode);
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
