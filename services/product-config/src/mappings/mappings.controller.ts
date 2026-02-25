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
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MappingsService } from './mappings.service';
import type {
  CreateMappingDto,
  UpdateMappingDto,
  CreateFieldMappingDto,
  UpdateFieldMappingDto,
} from './mappings.service';

/** Parse acceptance-criteria lines (source → target | direction | type) into a map for overriding AI suggestions. */
function parseAcceptanceCriteriaLines(text: string): Map<string, { reasoning: string; fieldDirection?: string; dataType?: string; format?: string; fieldIdentifier?: string; defaultValue?: string }> {
  const map = new Map<string, Record<string, string>>();
  const lines = text.split('\n').filter((l) => l.trim());
  const arrowPattern = /([^\s]+)\s*(→|->)\s*([^\s|]+)(?:\s*\|\s*([^|]+)\|\s*([^|]+(?:\s*,\s*default:\s*[^|]*)?))?/gi;
  for (const line of lines) {
    arrowPattern.lastIndex = 0;
    const m = arrowPattern.exec(line);
    if (!m) continue;
    const src = m[1].trim().replace(/^\$\./, '');
    const tgt = m[3].trim();
    if (!src || !tgt) continue;
    const key = `${src}|${tgt}`;
    const dirPart = m[4];
    const typePart = m[5];
    const dir = dirPart ? (dirPart.trim().toLowerCase() === 'input' ? 'input' : dirPart.trim().toLowerCase() === 'output' ? 'output' : 'both') : undefined;
    let dataType: string | undefined;
    let format: string | undefined;
    if (typePart) {
      const beforeDefault = typePart.split(/, default:/i)[0].trim();
      if (/^string$/i.test(beforeDefault)) dataType = 'string';
      else if (/^number$/i.test(beforeDefault)) dataType = 'number';
      else if (/^date\b/i.test(beforeDefault)) {
        dataType = 'date';
        const fmtMatch = beforeDefault.match(/\(([^)]+)\)/);
        if (fmtMatch) format = fmtMatch[1].trim();
      } else if (beforeDefault) dataType = beforeDefault;
    }
    const defaultMatch = typePart?.match(/, default:\s*(.+)$/i);
    const defaultValue = defaultMatch ? defaultMatch[1].trim() : undefined;
    map.set(key, {
      reasoning: line.trim(),
      ...(dir && { fieldDirection: dir }),
      ...(dataType && { dataType }),
      ...(format && { format }),
      fieldIdentifier: tgt,
      ...(defaultValue !== undefined && { defaultValue }),
    });
  }
  return map as Map<string, { reasoning: string; fieldDirection?: string; dataType?: string; format?: string; fieldIdentifier?: string; defaultValue?: string }>;
}

@Controller('mappings')
export class MappingsController {
  private readonly logger = new Logger(MappingsController.name);

  constructor(private readonly mappingsService: MappingsService) {}

  // --- Mappings ---

  @Get()
  findAll(@Query('productLineCode') productLineCode?: string) {
    return this.mappingsService.findAllMappings(productLineCode);
  }

  @Post()
  create(@Body() dto: CreateMappingDto) {
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    if (!name) {
      throw new BadRequestException('Mapping name is required.');
    }
    return this.mappingsService.createMapping({ ...dto, name });
  }

  // ── Parse text requirements → field suggestions ────────────────────────────
  // MUST be before @Get(':id') / @Post(':id/...) to avoid param collision

  @Post('parse-text')
  async parseText(
    @Body() body: { text: string; context?: { sourceSystem?: string; targetSystem?: string; productLine?: string } },
  ) {
    const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    const ctx = body.context ?? {};

    if (awsRegion) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const clientConfig: { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = { region: awsRegion };
        if (awsKey && awsSecret) clientConfig.credentials = { accessKeyId: awsKey, secretAccessKey: awsSecret };
        const client = new BedrockRuntimeClient(clientConfig);

        const prompt = `You are an expert in insurance data integration. Parse the following requirements and extract field mapping definitions.
Source System: ${ctx.sourceSystem ?? 'unknown'}
Target System: ${ctx.targetSystem ?? 'unknown'}
Product Line: ${ctx.productLine ?? 'general'}

Requirements text:
${body.text}

Extract all field mappings mentioned. For each, provide:
- sourcePath: JSONPath or field name from the source system (use $.fieldName format)
- targetPath: target field name or path (e.g. policy.quoteId)
- transformationType: one of direct, expression, lookup, conditional, constant, concatenate, split, multiply, divide, round, date, custom (use "date" for date fields)
- confidence: 0.0 to 1.0
- reasoning: use the EXACT line from the acceptance criteria (e.g. "quoteNumber → policy.quoteId | input | string"). Do not paraphrase.
- fieldDirection: when the line has | input |, | output |, or | both |, set to "input", "output", or "both"
- dataType: when the line has a type after the last pipe (e.g. string, date), set to "string", "number", "date", "boolean", "object", or "array"
- format: when dataType is "date" and the line specifies a format like (YYYY-MM-DD), set to "YYYY-MM-DD"
- fieldIdentifier: set to the target path (e.g. policy.quoteId)
- defaultValue: when the line has ", default: value", set to that value

Respond ONLY with a JSON array. Include fieldDirection, dataType, format, fieldIdentifier, defaultValue only when present in the requirements:
[
  {
    "sourcePath": "$.quoteNumber",
    "targetPath": "policy.quoteId",
    "transformationType": "direct",
    "confidence": 0.95,
    "reasoning": "quoteNumber → policy.quoteId | input | string",
    "fieldDirection": "input",
    "dataType": "string",
    "fieldIdentifier": "policy.quoteId"
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
          const suggestions = JSON.parse(jsonMatch[0]) as any[];
          // Override with parsed acceptance-criteria lines so description, dataType, fieldDirection, format align
          const lineOverrides = parseAcceptanceCriteriaLines(body.text);
          for (const s of suggestions) {
            const normSrc = (s.sourcePath ?? '').replace(/^\$\./, '');
            const key = `${normSrc}|${(s.targetPath ?? '').trim()}`;
            const override = lineOverrides.get(key) || lineOverrides.get(`${s.sourcePath}|${s.targetPath}`);
            if (override) {
              if (override.reasoning) s.reasoning = override.reasoning;
              if (override.fieldDirection) s.fieldDirection = override.fieldDirection;
              if (override.dataType) s.dataType = override.dataType;
              if (override.format) s.format = override.format;
              if (override.fieldIdentifier) s.fieldIdentifier = override.fieldIdentifier;
              if (override.defaultValue !== undefined) s.defaultValue = override.defaultValue;
            }
          }
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
      } catch (e) {
        this.logger.warn('parse-text Bedrock failed, using heuristic', e instanceof Error ? e.message : e);
      }
    }

    // Heuristic fallback: parse "map X to Y" and "X → Y" patterns (including "source → target | direction | dataType")
    const lines = body.text.split('\n').filter((l) => l.trim());
    const suggestions: any[] = [];
    const mapPattern = /map\s+([^\s]+)\s+to\s+([^\s,\n]+)/gi;
    const arrowPattern = /([^\s]+)\s*(→|->)\s*([^\s|]+)(?:\s*\|\s*([^|]+)\|\s*([^|]+(?:\s*,\s*default:\s*[^|]*)?))?/gi;

    function parseDirection(dir: string): 'input' | 'output' | 'both' {
      const d = (dir || '').trim().toLowerCase();
      if (d === 'input' || d === 'output') return d;
      return 'both';
    }
    function parseDataType(typePart: string): string {
      const t = (typePart || '').trim();
      const beforeDefault = t.split(/, default:/i)[0].trim();
      if (/^string$/i.test(beforeDefault)) return 'string';
      if (/^number$/i.test(beforeDefault)) return 'number';
      if (/^boolean$/i.test(beforeDefault)) return 'boolean';
      if (/^date\b/i.test(beforeDefault)) return 'date';
      if (/^object$/i.test(beforeDefault)) return 'object';
      if (/^array$/i.test(beforeDefault)) return 'array';
      return beforeDefault || '';
    }
    function parseDefaultValue(typePart: string): string | undefined {
      const m = (typePart || '').match(/, default:\s*(.+)$/i);
      return m ? m[1].trim() : undefined;
    }
    function parseDateFormat(typePart: string): string | undefined {
      if (!typePart || !/date\b/i.test(typePart)) return undefined;
      const beforeDefault = typePart.split(/, default:/i)[0].trim();
      const fmtMatch = beforeDefault.match(/\(([^)]+)\)/);
      return fmtMatch ? fmtMatch[1].trim() : undefined;
    }

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
          reasoning: line.trim(),
        });
      }
      arrowPattern.lastIndex = 0;
      while ((match = arrowPattern.exec(line)) !== null) {
        const src = match[1].trim();
        const tgt = match[3].trim();
        const dirPart = match[4];
        const typePart = match[5];
        if (src && tgt) {
          const suggestion: any = {
            sourcePath: src.startsWith('$') ? src : `$.${src}`,
            targetPath: tgt,
            transformationType: line.toLowerCase().includes('date') && (!typePart || /date/i.test(typePart)) ? 'date' : 'direct',
            confidence: 0.7,
            reasoning: line.trim(),
          };
          if (dirPart !== undefined) suggestion.fieldDirection = parseDirection(dirPart);
          if (typePart !== undefined) {
            suggestion.dataType = parseDataType(typePart);
            const def = parseDefaultValue(typePart);
            if (def !== undefined) suggestion.defaultValue = def;
            const fmt = parseDateFormat(typePart);
            if (fmt) suggestion.format = fmt;
          }
          suggestion.fieldIdentifier = tgt;
          suggestions.push(suggestion);
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
        transformConfig?: Record<string, unknown>;
        defaultValue?: string;
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
        transformConfig: f.transformConfig ?? {},
        defaultValue: f.defaultValue,
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

    const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

    if (awsRegion) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const clientConfig: { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = { region: awsRegion };
        if (awsKey && awsSecret) clientConfig.credentials = { accessKeyId: awsKey, secretAccessKey: awsSecret };
        const client = new BedrockRuntimeClient(clientConfig);

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
      } catch (e) {
        this.logger.warn('suggest-fields Bedrock failed, using default suggestions', e instanceof Error ? e.message : e);
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
