import {
  Controller,
  Post,
  Body,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const SCRIPT_CONTRACT = `You generate the body of a JavaScript function for **request payload transformation** in a rating pipeline — e.g. reshaping or normalizing an incoming **Guidewire PolicyCenter** (or other source) request so it fits what downstream steps expect.

Use this step for: renaming or moving fields from the request, normalizing dates/codes, flattening or nesting structures, or deriving values from the request. Do NOT use it for: field-by-field mapping (use the Field Mapping step) or rating logic like surcharges/discounts (use the Rules step).

Signature: the code runs as the body of a function (request, working, response, scope) => { ... }.
- request: original incoming payload (e.g. Guidewire request JSON) — read-only.
- working: pipeline state; MUTATE IN PLACE to pass transformed data to the next step. Often starts as a copy of request.
- response: output object; MUTATE IN PLACE if you need to set response fields from request/working.
- scope: scope context (state, coverage type, etc.).

Rules:
- Output ONLY the JavaScript function body. No markdown, no code fences, no explanation, no \`\`\`.
- Mutate only working and/or response in place. No return statement for the whole script.
- No require(), process, global, or I/O. Only request, working, response, scope are available.
- Use optional chaining: request?.Policy?.EffectiveDate, working?.policy?.effectiveDate.`;

const EXAMPLES = `
Example 1 — normalize Guidewire Policy effective date and copy policy number into working:
working.policy = working.policy || {};
working.policy.effectiveDate = request?.Policy?.EffectiveDate ? new Date(request.Policy.EffectiveDate).toISOString().slice(0, 10) : undefined;
working.policy.policyNumber = request?.Policy?.PolicyNumber;

Example 2 — copy first location building number from GW request into working for downstream:
const loc = request?.Locations?.[0] || request?.Policy?.Locations?.[0];
working.locationId = loc?.BuildingNumber ?? loc?.LocationNumber;
`;

@Controller('script')
export class ScriptController {
  private readonly logger = new Logger(ScriptController.name);

  @Post('generate')
  async generate(
    @Body()
    body: {
      prompt: string;
      productLineCode?: string;
      contextSample?: Record<string, unknown>;
    },
  ): Promise<{ scriptSource: string; confidence?: number }> {
    const prompt = (body.prompt ?? '').trim();
    if (!prompt) {
      throw new ServiceUnavailableException('prompt is required');
    }

    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const awsSessionToken = process.env.AWS_SESSION_TOKEN;
    const modelId =
      process.env.BEDROCK_MODEL_ID ??
      'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    const useExplicitCreds = !!(awsKey && awsSecret);

    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import(
        '@aws-sdk/client-bedrock-runtime'
      );
      const clientConfig: {
        region: string;
        credentials?: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken?: string;
        };
      } = { region: awsRegion };
      if (useExplicitCreds) {
        clientConfig.credentials = {
          accessKeyId: awsKey!,
          secretAccessKey: awsSecret!,
          ...(awsSessionToken && { sessionToken: awsSessionToken }),
        };
      }
      const client = new BedrockRuntimeClient(clientConfig);

      let userContent = `What the script should do:\n"${prompt}"`;
      if (body.contextSample && Object.keys(body.contextSample).length > 0) {
        userContent += `\n\nExample context shape (use these field names if relevant):\n${JSON.stringify(body.contextSample, null, 2)}`;
      }
      if (body.productLineCode) {
        userContent += `\nProduct line: ${body.productLineCode}`;
      }

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        system: SCRIPT_CONTRACT + EXAMPLES,
        messages: [{ role: 'user', content: userContent }],
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
        typeof content?.text === 'string'
          ? content.text.trim()
          : JSON.stringify(bodyJson).slice(0, 1000);

      if (!responseText) {
        throw new ServiceUnavailableException(
          'Bedrock returned an empty response.',
        );
      }

      let scriptSource = responseText
        .replace(/^```(?:js|javascript)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();

      if (scriptSource.length > 50000) {
        scriptSource = scriptSource.slice(0, 50000);
      }

      this.logger.log('Script generated with Bedrock');
      return { scriptSource, confidence: 0.9 };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      this.logger.warn(`Script generate failed: ${msg}`);
      throw new ServiceUnavailableException(
        `AI script generation failed. ${msg}. Check AWS Bedrock credentials and rules-service.`,
      );
    }
  }
}
