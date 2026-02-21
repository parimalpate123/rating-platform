import { Injectable, BadRequestException } from '@nestjs/common';

export interface TransformRequest {
  input: any;
  direction: 'json_to_xml' | 'xml_to_json' | 'json_to_soap' | 'soap_to_json';
  options?: Record<string, any>;
}

export interface TransformResponse {
  output: string;
  format: string;
  durationMs: number;
}

@Injectable()
export class TransformService {
  transform(request: TransformRequest): TransformResponse {
    const start = Date.now();

    let output: string;
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
          `Unsupported direction: ${request.direction}`
        );
    }

    const durationMs = Date.now() - start;
    return { output, format, durationMs };
  }

  private jsonToXml(
    input: any,
    options?: Record<string, any>
  ): string {
    const rootTag = options?.rootTag || 'root';
    const xml = this.objectToXml(input, rootTag);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
  }

  private objectToXml(obj: any, tagName: string): string {
    if (obj === null || obj === undefined) {
      return `<${tagName}/>`;
    }

    if (typeof obj !== 'object') {
      return `<${tagName}>${this.escapeXml(String(obj))}</${tagName}>`;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.objectToXml(item, tagName)).join('\n');
    }

    const children = Object.entries(obj)
      .map(([key, value]) => this.objectToXml(value, key))
      .join('\n');

    return `<${tagName}>\n${children}\n</${tagName}>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private xmlToJson(
    input: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: Record<string, any>
  ): string {
    // Placeholder: full XML parsing will be added in Phase 2
    return JSON.stringify({
      _placeholder: true,
      _message:
        'XML to JSON conversion will use a full XML parser in Phase 2',
      rawInput: typeof input === 'string' ? input.substring(0, 200) : input,
    });
  }

  private jsonToSoap(
    input: any,
    options?: Record<string, any>
  ): string {
    const namespace = options?.namespace || 'http://example.com/rating';
    const action = options?.action || 'RateRequest';
    const bodyXml = this.objectToXml(input, action);

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

  private soapToJson(
    input: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: Record<string, any>
  ): string {
    // Placeholder: full SOAP parsing will be added in Phase 2
    return JSON.stringify({
      _placeholder: true,
      _message:
        'SOAP to JSON conversion will use a full XML/SOAP parser in Phase 2',
      rawInput: typeof input === 'string' ? input.substring(0, 200) : input,
    });
  }
}
