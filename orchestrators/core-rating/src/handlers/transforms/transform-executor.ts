// ─── Transform Executor ──────────────────────────────────────────────────────
// Applies a single field-level transformation to a value based on
// transformationType and transformConfig. Used by FieldMappingHandler.
//
// Error policy: if a transform fails, fall back to the raw value and record
// the error. Never halt execution.

import * as vm from 'node:vm';

export interface TransformContext {
  value: unknown;
  transformationType: string;
  transformConfig: Record<string, any>;
  defaultValue?: string;
  sourcePath: string;
  targetPath: string;
  fullContext?: Record<string, unknown>;
}

export interface TransformResult {
  value: unknown;
  applied: boolean;
  error?: string;
}

export function executeTransform(ctx: TransformContext): TransformResult {
  const { value, transformationType, transformConfig, fullContext } = ctx;

  try {
    switch (transformationType) {
      case 'direct':
      case undefined:
      case null:
      case '':
        return { value, applied: true };

      case 'constant':
        return { value: transformConfig['constantValue'] ?? value, applied: true };

      case 'multiply': {
        const factor = Number(transformConfig['factor']);
        if (isNaN(factor)) return { value, applied: false, error: 'multiply: factor is not a number' };
        const num = Number(value);
        if (isNaN(num)) return { value, applied: false, error: 'multiply: source value is not numeric' };
        return { value: num * factor, applied: true };
      }

      case 'divide': {
        const divisor = Number(transformConfig['divisor']);
        if (isNaN(divisor)) return { value, applied: false, error: 'divide: divisor is not a number' };
        if (divisor === 0) return { value, applied: false, error: 'divide: division by zero' };
        const num = Number(value);
        if (isNaN(num)) return { value, applied: false, error: 'divide: source value is not numeric' };
        return { value: num / divisor, applied: true };
      }

      case 'round': {
        const decimals = transformConfig['decimals'] != null ? Number(transformConfig['decimals']) : 0;
        const num = Number(value);
        if (isNaN(num)) return { value, applied: false, error: 'round: source value is not numeric' };
        const factor = Math.pow(10, decimals);
        return { value: Math.round(num * factor) / factor, applied: true };
      }

      case 'per_unit': {
        const unitSize = Number(transformConfig['unitSize']);
        if (isNaN(unitSize) || unitSize === 0) return { value, applied: false, error: 'per_unit: unitSize is invalid' };
        const num = Number(value);
        if (isNaN(num)) return { value, applied: false, error: 'per_unit: source value is not numeric' };
        return { value: num / unitSize, applied: true };
      }

      case 'number_format': {
        const num = Number(value);
        if (isNaN(num)) return { value, applied: false, error: 'number_format: source value is not numeric' };
        const locale = transformConfig['locale'] ?? 'en-US';
        const precision = transformConfig['precision'] != null ? Number(transformConfig['precision']) : undefined;
        const opts: Intl.NumberFormatOptions = precision != null
          ? { minimumFractionDigits: precision, maximumFractionDigits: precision }
          : {};
        return { value: num.toLocaleString(locale, opts), applied: true };
      }

      case 'date': {
        const format = transformConfig['format'] ?? 'YYYY-MM-DD';
        const raw = String(value ?? '');
        if (!raw) return { value, applied: false, error: 'date: empty value' };

        let d: Date;
        const inputFormat = transformConfig['inputFormat'];
        if (inputFormat === 'epoch' || inputFormat === 'timestamp') {
          d = new Date(Number(raw));
        } else {
          // ISO date-only strings (YYYY-MM-DD) are parsed as UTC midnight by the
          // Date constructor, causing a 1-day rollback in negative-offset timezones.
          // Parse them manually so they stay in local time.
          const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateOnly) {
            d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
          } else {
            d = new Date(raw);
          }
        }
        if (isNaN(d.getTime())) return { value, applied: false, error: `date: cannot parse "${raw}"` };

        const pad = (n: number, len = 2) => String(n).padStart(len, '0');
        const yr = d.getFullYear();
        const mo = pad(d.getMonth() + 1);
        const dy = pad(d.getDate());

        let formatted: string;
        switch (format) {
          case 'YYYY-MM-DD':  formatted = `${yr}-${mo}-${dy}`; break;
          case 'MM/DD/YYYY':  formatted = `${mo}/${dy}/${yr}`; break;
          case 'DD/MM/YYYY':  formatted = `${dy}/${mo}/${yr}`; break;
          case 'MM-DD-YYYY':  formatted = `${mo}-${dy}-${yr}`; break;
          case 'ISO':         formatted = d.toISOString(); break;
          case 'timestamp':   formatted = String(d.getTime()); break;
          case 'epoch':       formatted = String(Math.floor(d.getTime() / 1000)); break;
          default:
            // Generic token replacement: YYYY MM DD
            formatted = format
              .replace('YYYY', String(yr))
              .replace('MM', mo)
              .replace('DD', dy);
        }
        return { value: formatted, applied: true };
      }

      case 'boolean': {
        const trueValues = (transformConfig['trueValues'] as string[] | undefined) ?? ['true', 'yes', '1', 'on'];
        if (typeof value === 'boolean') return { value, applied: true };
        const strVal = String(value ?? '').toLowerCase().trim();
        return { value: trueValues.map((v) => v.toLowerCase()).includes(strVal), applied: true };
      }

      case 'concatenate': {
        const fields = transformConfig['fields'] as string[] | undefined;
        const separator = transformConfig['separator'] ?? '';
        if (!fields?.length) return { value, applied: false, error: 'concatenate: no fields defined' };
        const parts = fields.map((f) => {
          const v = f.split('.').reduce((o: any, k) => o?.[k], fullContext ?? {});
          return v != null ? String(v) : '';
        });
        return { value: parts.join(separator), applied: true };
      }

      case 'split': {
        const delimiter = transformConfig['delimiter'] ?? ',';
        const index = transformConfig['index'];
        const parts = String(value ?? '').split(delimiter);
        if (index != null) {
          return { value: parts[Number(index)] ?? '', applied: true };
        }
        return { value: parts, applied: true };
      }

      case 'expression': {
        const expression = transformConfig['expression'] as string | undefined;
        if (!expression) return { value, applied: false, error: 'expression: no expression provided' };
        const code = `(function() { return (${expression}); })()`;
        const sandbox = vm.createContext({ value, working: fullContext ?? {}, request: fullContext ?? {} });
        const result = vm.runInNewContext(code, sandbox, { timeout: 100 });
        return { value: result, applied: true };
      }

      case 'conditional': {
        const { condition, thenValue, elseValue } = transformConfig as {
          condition?: { field: string; operator: string; value: unknown };
          thenValue?: unknown;
          elseValue?: unknown;
        };
        if (!condition) return { value, applied: false, error: 'conditional: no condition defined' };
        const fieldVal = condition.field
          .split('.')
          .reduce((o: any, k) => o?.[k], (fullContext ?? {}) as any);
        const met = evalSimpleCondition(fieldVal, condition.operator, condition.value);
        return { value: met ? thenValue : elseValue, applied: true };
      }

      case 'aggregate': {
        const { operation, arrayPath, fieldPath } = transformConfig as {
          operation?: 'sum' | 'avg' | 'min' | 'max';
          arrayPath?: string;
          fieldPath?: string;
        };
        if (!arrayPath) return { value, applied: false, error: 'aggregate: no arrayPath defined' };
        const arr = arrayPath.split('.').reduce((o: any, k) => o?.[k], (fullContext ?? {}) as any);
        if (!Array.isArray(arr)) return { value, applied: false, error: 'aggregate: arrayPath does not resolve to array' };
        const nums = arr.map((item) =>
          fieldPath ? Number(fieldPath.split('.').reduce((o: any, k) => o?.[k], item)) : Number(item),
        ).filter((n) => !isNaN(n));
        if (nums.length === 0) return { value: 0, applied: true };
        let result: number;
        switch (operation) {
          case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
          case 'avg': result = nums.reduce((a, b) => a + b, 0) / nums.length; break;
          case 'min': result = Math.min(...nums); break;
          case 'max': result = Math.max(...nums); break;
          default:    result = nums.reduce((a, b) => a + b, 0);
        }
        return { value: result, applied: true };
      }

      case 'custom': {
        const functionBody = transformConfig['functionBody'] as string | undefined;
        if (!functionBody) return { value, applied: false, error: 'custom: no functionBody provided' };
        const code = `(function(value, working, request) { ${functionBody} })`;
        const sandbox = vm.createContext({});
        const fn = vm.runInNewContext(code, sandbox, { timeout: 100 });
        const result = fn(value, fullContext ?? {}, fullContext ?? {});
        return { value: result, applied: true };
      }

      default:
        return { value, applied: false, error: `Unknown transformationType: "${transformationType}"` };
    }
  } catch (err) {
    return {
      value,
      applied: false,
      error: `${transformationType}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Simple condition evaluator for the 'conditional' transform type
function evalSimpleCondition(fieldValue: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
    case '==':
    case 'equals':        return fieldValue == expected;
    case 'neq':
    case '!=':
    case 'not_equals':    return fieldValue != expected;
    case 'gt':
    case '>':             return Number(fieldValue) > Number(expected);
    case 'gte':
    case '>=':            return Number(fieldValue) >= Number(expected);
    case 'lt':
    case '<':             return Number(fieldValue) < Number(expected);
    case 'lte':
    case '<=':            return Number(fieldValue) <= Number(expected);
    case 'in':            return Array.isArray(expected) && expected.includes(fieldValue);
    case 'exists':        return fieldValue !== undefined && fieldValue !== null;
    default:              return false;
  }
}
