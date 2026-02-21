import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MappingsService } from './mappings.service';
import type {
  CreateMappingDto,
  UpdateMappingDto,
  CreateFieldMappingDto,
  UpdateFieldMappingDto,
} from './mappings.service';

@Controller('mappings')
export class MappingsController {
  constructor(private readonly mappingsService: MappingsService) {}

  // --- Mappings ---

  @Get()
  findAll(@Query('productLineCode') productLineCode?: string) {
    return this.mappingsService.findAllMappings(productLineCode);
  }

  @Post()
  create(@Body() dto: CreateMappingDto) {
    return this.mappingsService.createMapping(dto);
  }

  // ── Parse text requirements → field suggestions ────────────────────────────
  // MUST be before @Get(':id') / @Post(':id/...) to avoid param collision

  @Post('parse-text')
  async parseText(
    @Body() body: { text: string; context?: { sourceSystem?: string; targetSystem?: string; productLine?: string } },
  ) {
    const awsRegion = process.env.AWS_REGION;
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    const ctx = body.context ?? {};

    if (awsRegion && awsKey && awsSecret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const client = new BedrockRuntimeClient({
          region: awsRegion,
          credentials: { accessKeyId: awsKey, secretAccessKey: awsSecret },
        });

        const prompt = `You are an expert in insurance data integration. Parse the following requirements and extract field mapping definitions.
Source System: ${ctx.sourceSystem ?? 'unknown'}
Target System: ${ctx.targetSystem ?? 'unknown'}
Product Line: ${ctx.productLine ?? 'general'}

Requirements text:
${body.text}

Extract all field mappings mentioned. For each, provide:
- sourcePath: JSONPath or field name from the source system (use $.FieldName format)
- targetPath: target field name or path
- transformationType: one of direct, expression, lookup, conditional, constant, concatenate, split, multiply, divide, round, date, custom
- confidence: 0.0 to 1.0
- reasoning: brief explanation

Respond ONLY with a JSON array:
[
  {
    "sourcePath": "$.Quote.QuoteNumber",
    "targetPath": "policy.quoteId",
    "transformationType": "direct",
    "confidence": 0.95,
    "reasoning": "Direct mapping of quote number to policy ID"
  }
]`;

        const payload = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        };
        const cmd = new InvokeModelCommand({
          modelId,
          body: Buffer.from(JSON.stringify(payload)),
          contentType: 'application/json',
          accept: 'application/json',
        });
        const res = await client.send(cmd);
        const text = JSON.parse(new TextDecoder().decode(res.body)).content[0].text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);
          const highCount = suggestions.filter((s: any) => s.confidence >= 0.8).length;
          const avgConf = Math.round(
            suggestions.reduce((sum: number, s: any) => sum + s.confidence * 100, 0) / suggestions.length,
          );
          return {
            suggestions,
            totalSuggestions: suggestions.length,
            highConfidenceCount: highCount,
            averageConfidence: avgConf,
            method: 'ai',
          };
        }
      } catch (_e) {
        // Fall through to heuristic
      }
    }

    // Heuristic fallback: parse "map X to Y" and "X → Y" patterns
    const lines = body.text.split('\n').filter((l) => l.trim());
    const suggestions: any[] = [];
    const mapPattern = /map\s+([^\s]+)\s+to\s+([^\s,\n]+)/gi;
    const arrowPattern = /([^\s]+)\s*(→|->)\s*([^\s,\n]+)/gi;

    for (const line of lines) {
      let match;
      mapPattern.lastIndex = 0;
      while ((match = mapPattern.exec(line)) !== null) {
        const src = match[1].replace(/^['"]|['"]$/g, '');
        const tgt = match[2].replace(/^['"]|['"]$/g, '');
        const type = line.toLowerCase().includes('lookup')
          ? 'lookup'
          : line.toLowerCase().includes('date')
            ? 'date'
            : 'direct';
        suggestions.push({
          sourcePath: src.startsWith('$') ? src : `$.${src}`,
          targetPath: tgt,
          transformationType: type,
          confidence: 0.75,
          reasoning: `Parsed from: "${line.trim().substring(0, 80)}"`,
        });
      }
      arrowPattern.lastIndex = 0;
      while ((match = arrowPattern.exec(line)) !== null) {
        const src = match[1].trim();
        const tgt = match[3].trim();
        if (src && tgt) {
          suggestions.push({
            sourcePath: src.startsWith('$') ? src : `$.${src}`,
            targetPath: tgt,
            transformationType: 'direct',
            confidence: 0.7,
            reasoning: `Arrow mapping from: "${line.trim().substring(0, 80)}"`,
          });
        }
      }
    }

    if (suggestions.length === 0) {
      return {
        suggestions: [
          { sourcePath: '$.Quote.QuoteNumber', targetPath: 'policy.quoteId', transformationType: 'direct', confidence: 0.8, reasoning: 'Standard quote ID mapping' },
          { sourcePath: '$.Quote.EffectiveDate', targetPath: 'policy.effectiveDate', transformationType: 'date', confidence: 0.8, reasoning: 'Policy effective date' },
          { sourcePath: '$.Insured.Name', targetPath: 'insured.name', transformationType: 'direct', confidence: 0.85, reasoning: 'Insured name' },
          { sourcePath: '$.Quote.Premium', targetPath: 'rating.totalPremium', transformationType: 'direct', confidence: 0.9, reasoning: 'Total premium amount' },
        ],
        totalSuggestions: 4,
        highConfidenceCount: 4,
        averageConfidence: 84,
        method: 'heuristic',
      };
    }

    const highCount = suggestions.filter((s) => s.confidence >= 0.8).length;
    const avgConf = Math.round(
      suggestions.reduce((sum, s) => sum + s.confidence * 100, 0) / suggestions.length,
    );
    return { suggestions, totalSuggestions: suggestions.length, highConfidenceCount: highCount, averageConfidence: avgConf, method: 'heuristic' };
  }

  // ── Parse CSV/Excel file → field suggestions ───────────────────────────────

  @Post('parse-excel')
  @UseInterceptors(FileInterceptor('file'))
  async parseExcel(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');

    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n').filter((l: string) => l.trim());
    const suggestions: any[] = [];

    const firstLine = (lines[0] ?? '').toLowerCase();
    const startIdx = firstLine.includes('source') || firstLine.includes('field') || firstLine.includes('path') ? 1 : 0;

    const validTypes = ['direct', 'expression', 'lookup', 'conditional', 'constant', 'concatenate', 'split', 'multiply', 'divide', 'round', 'date', 'custom'];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(/[,\t]/).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 2 && cols[0] && cols[1]) {
        const src = cols[0];
        const tgt = cols[1];
        const rawType = (cols[2] ?? 'direct').toLowerCase();
        const description = cols[3] ?? '';
        suggestions.push({
          sourcePath: src.startsWith('$') ? src : `$.${src}`,
          targetPath: tgt,
          transformationType: validTypes.includes(rawType) ? rawType : 'direct',
          confidence: 0.85,
          reasoning: description || `Imported from ${file.originalname} row ${i + 1}`,
        });
      }
    }

    const highCount = suggestions.filter((s) => s.confidence >= 0.8).length;
    const avgConf = suggestions.length
      ? Math.round(suggestions.reduce((sum, s) => sum + s.confidence * 100, 0) / suggestions.length)
      : 0;
    return {
      suggestions,
      totalSuggestions: suggestions.length,
      highConfidenceCount: highCount,
      averageConfidence: avgConf,
      filename: file.originalname,
    };
  }

  // ── Create mapping atomically with pre-generated fields ────────────────────

  @Post('create-with-fields')
  async createWithFields(
    @Body() body: {
      name: string;
      productLineCode?: string;
      direction?: string;
      status?: string;
      fields?: Array<{
        sourcePath: string;
        targetPath: string;
        transformationType?: string;
        description?: string;
      }>;
    },
  ) {
    const { fields = [], ...mappingData } = body;
    const mapping = await this.mappingsService.createMapping({
      ...mappingData,
      status: mappingData.status ?? 'draft',
    });
    for (const f of fields) {
      await this.mappingsService.createFieldMapping(mapping.id, {
        sourcePath: f.sourcePath,
        targetPath: f.targetPath,
        transformationType: f.transformationType ?? 'direct',
        description: f.description,
      });
    }
    return mapping;
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.mappingsService.findMappingById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMappingDto) {
    return this.mappingsService.updateMapping(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.mappingsService.deleteMapping(id);
  }

  // ── AI: suggest additional fields for an existing mapping ──────────────────

  @Post(':id/suggest-fields')
  async suggestFields(@Param('id') id: string, @Body() body: { context?: string }) {
    const mapping = await this.mappingsService.findMappingById(id);
    const existingFields = await this.mappingsService.findFieldsByMappingId(id);

    const awsRegion = process.env.AWS_REGION;
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

    if (awsRegion && awsKey && awsSecret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const client = new BedrockRuntimeClient({
          region: awsRegion,
          credentials: { accessKeyId: awsKey, secretAccessKey: awsSecret },
        });

        const existingStr = existingFields.map((f) => `${f.sourcePath} → ${f.targetPath}`).join('\n');
        const prompt = `You are an expert in insurance data integration.
Suggest additional field mappings for the mapping "${mapping.name}" (direction: ${mapping.direction ?? 'request'}, product: ${mapping.productLineCode ?? 'general'}).
${existingStr ? `\nExisting mappings:\n${existingStr}\n` : ''}${body.context ? `\nAdditional context: ${body.context}\n` : ''}
Suggest 5-8 additional field mappings that would be useful for this integration.
Respond ONLY with a JSON array:
[
  {
    "sourcePath": "$.Quote.Premium",
    "targetPath": "rating.basePremium",
    "transformationType": "direct",
    "confidence": 0.95,
    "reasoning": "Direct premium amount mapping"
  }
]
transformationType must be one of: direct, expression, lookup, conditional, constant, concatenate, split, multiply, divide, round, date, custom`;

        const payload = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        };
        const cmd = new InvokeModelCommand({
          modelId,
          body: Buffer.from(JSON.stringify(payload)),
          contentType: 'application/json',
          accept: 'application/json',
        });
        const res = await client.send(cmd);
        const text = JSON.parse(new TextDecoder().decode(res.body)).content[0].text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return { suggestions: JSON.parse(jsonMatch[0]) };
        }
      } catch (_e) {
        // Fall through to generic suggestions
      }
    }

    return {
      suggestions: [
        { sourcePath: '$.Quote.QuoteNumber', targetPath: 'policy.quoteId', transformationType: 'direct', confidence: 0.9, reasoning: 'Standard quote ID mapping' },
        { sourcePath: '$.Quote.EffectiveDate', targetPath: 'policy.effectiveDate', transformationType: 'date', confidence: 0.85, reasoning: 'Policy effective date' },
        { sourcePath: '$.Insured.Name', targetPath: 'insured.name', transformationType: 'direct', confidence: 0.9, reasoning: 'Insured name from account holder' },
        { sourcePath: '$.Quote.Premium', targetPath: 'rating.totalPremium', transformationType: 'direct', confidence: 0.95, reasoning: 'Total premium amount' },
        { sourcePath: '$.Quote.State', targetPath: 'insured.state', transformationType: 'direct', confidence: 0.85, reasoning: 'State code standardization' },
      ],
    };
  }

  // --- Field Mappings ---

  @Get(':id/fields')
  findFields(@Param('id') id: string) {
    return this.mappingsService.findFieldsByMappingId(id);
  }

  @Post(':id/fields')
  createField(@Param('id') id: string, @Body() dto: CreateFieldMappingDto) {
    return this.mappingsService.createFieldMapping(id, dto);
  }

  @Put(':id/fields/:fieldId')
  updateField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldMappingDto,
  ) {
    return this.mappingsService.updateFieldMapping(id, fieldId, dto);
  }

  @Delete(':id/fields/:fieldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteField(@Param('id') id: string, @Param('fieldId') fieldId: string) {
    await this.mappingsService.deleteFieldMapping(id, fieldId);
  }
}
