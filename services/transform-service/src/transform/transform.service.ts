import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export interface TransformRequest {
  input: any;
  direction: 'json_to_xml' | 'xml_to_json' | 'json_to_soap' | 'soap_to_json';
  options?: Record<string, any>;
}

export interface TransformResponse {
  output: string | Record<string, unknown>;
  format: string;
  durationMs: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: () => false,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true,
});

@Injectable()
export class TransformService {
  transform(request: TransformRequest): TransformResponse {
    const start = Date.now();

    let output: string | Record<string, unknown>;
    let format: string;

    switch (request.direction) {
      case 'json_to_xml':
        output = this.jsonToXml(request.input, request.options);
        format = 'xml';
        break;
      case 'xml_to_json':
        output = this.xmlToJson(request.input, request.options);
        format = 'json';
        break;
      case 'json_to_soap':
        output = this.jsonToSoap(request.input, request.options);
        format = 'soap+xml';
        break;
      case 'soap_to_json':
        output = this.soapToJson(request.input, request.options);
        format = 'json';
        break;
      default:
        throw new BadRequestException(
          `Unsupported direction: ${(request as any).direction}`,
        );
    }

    const durationMs = Date.now() - start;
    return { output, format, durationMs };
  }

  private jsonToXml(input: any, options?: Record<string, any>): string {
    const rootTag = options?.rootTag || 'root';
    const wrapped = { [rootTag]: input };
    const xml = xmlBuilder.build(wrapped);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
  }

  private xmlToJson(input: any, _options?: Record<string, any>): Record<string, unknown> {
    const xmlString = typeof input === 'string' ? input : JSON.stringify(input);
    try {
      return xmlParser.parse(xmlString) as Record<string, unknown>;
    } catch (err) {
      throw new BadRequestException(`Failed to parse XML: ${err}`);
    }
  }

  private jsonToSoap(input: any, options?: Record<string, any>): string {
    const namespace = options?.namespace || 'http://example.com/rating';
    const action = options?.action || 'RateRequest';
    const bodyXml = xmlBuilder.build({ [action]: input });

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${namespace}">`,
      '  <soap:Header/>',
      '  <soap:Body>',
      `    ${bodyXml}`,
      '  </soap:Body>',
      '</soap:Envelope>',
    ].join('\n');
  }

  private soapToJson(input: any, _options?: Record<string, any>): Record<string, unknown> {
    const xmlString = typeof input === 'string' ? input : JSON.stringify(input);
    try {
      const parsed = xmlParser.parse(xmlString) as Record<string, unknown>;
      // Unwrap SOAP envelope if present
      const envelope =
        (parsed['soap:Envelope'] as Record<string, unknown>) ??
        (parsed['Envelope'] as Record<string, unknown>);
      if (envelope) {
        const body =
          (envelope['soap:Body'] as Record<string, unknown>) ??
          (envelope['Body'] as Record<string, unknown>);
        if (body) return body;
      }
      return parsed;
    } catch (err) {
      throw new BadRequestException(`Failed to parse SOAP: ${err}`);
    }
  }
}
