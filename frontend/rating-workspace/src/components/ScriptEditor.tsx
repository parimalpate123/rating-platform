import React from 'react';
import Editor from 'react-simple-code-editor';
import { Highlight, themes } from 'prism-react-renderer';
import { CheckCircle, XCircle } from 'lucide-react';
// Use only prism-react-renderer (it bundles Prism + common languages). Do not import prismjs/components — that expects global Prism and causes "Prism is not defined".

function highlightCode(code: string) {
  return (
    <Highlight theme={themes.nightOwl} code={code} language="javascript">
      {({ tokens, getLineProps, getTokenProps }) => (
        <>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </>
      )}
    </Highlight>
  );
}

export function validateScriptSyntax(scriptSource: string): { valid: boolean; error?: string } {
  const script = (scriptSource ?? '').trim();
  if (!script) {
    return { valid: false, error: 'Script is empty' };
  }
  try {
    const fn = new Function('request', 'working', 'response', 'scope', script);
    // Run once with empty context to catch reference errors (e.g. stray "s" or typos)
    const req = {};
    const work = {};
    const res = {};
    const scope = {};
    fn(req, work, res, scope);
    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}

export interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  onValidate?: (result: { valid: boolean; error?: string }) => void;
  showValidateButton?: boolean;
}

export function ScriptEditor({
  value,
  onChange,
  placeholder = '// JavaScript (request, working, response, scope)...',
  minHeight = 180,
  onValidate,
  showValidateButton = true,
}: ScriptEditorProps) {
  const [validationResult, setValidationResult] = React.useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  const handleValidate = () => {
    const result = validateScriptSyntax(value);
    setValidationResult(result);
    onValidate?.(result);
  };

  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border border-gray-700 overflow-hidden bg-[#0d1117] focus-within:ring-2 focus-within:ring-amber-500"
        style={{ minHeight }}
      >
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={highlightCode}
          placeholder={placeholder}
          padding={12}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            fontSize: 13,
            minHeight,
            color: '#e6edf3',
            caretColor: '#e6edf3',
          }}
          textareaClassName="focus:outline-none"
          preClassName="m-0"
        />
      </div>
      {showValidateButton && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleValidate}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Validate syntax
          </button>
          {validationResult !== null &&
            (validationResult.valid ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Syntax OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={validationResult.error}>
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[240px]">{validationResult.error}</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
