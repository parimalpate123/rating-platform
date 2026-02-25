import { useEffect, useRef, useState } from 'react';

const PLATFORM_DIAGRAM = `
flowchart TB
  subgraph client[" "]
    UI[Rating Workspace]
  end

  subgraph platform["InsuRateConnect Platform"]
    CR[Core Rating\nOrchestrator]
    LR[Line Rating\nflow definitions]
    PC[Product Config\nMapper]
    TR[Transform Service]
    RS[Rating Rules Service]
    SS[Status Service]
    DB[(Database)]
  end

  subgraph adapters["Adapters"]
    KF[Adapter Kafka]
    DN[Adapter DNB]
    GW[Adapter GW]
  end

  subgraph external["External Systems"]
    SRC[Source Systems]
    TGT[Target Systems]
  end

  UI --> CR
  CR --> LR
  CR --> SS
  CR --> PC
  CR --> TR
  CR --> RS
  LR --> DB
  PC --> DB
  RS --> DB
  SS --> DB
  CR --> KF
  CR --> DN
  CR --> GW
  KF --> SRC
  DN --> TGT
  GW --> TGT
`;

const PER_PRODUCT_LINE_DIAGRAM = `
flowchart LR
  subgraph plconfig["Per product line"]
    OF([Orchestration Flow])
    MP[/Mappings/]
    RU{{Rating Rules}}
    SC{Scopes}
  end

  LR[Line Rating]
  PC[Product Config]
  RS[Rating Rules Service]

  OF --> LR
  MP --> PC
  RU --> RS
  SC --> PC
`;

export function Architecture() {
  const platformRef = useRef<HTMLDivElement>(null);
  const plConfigRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
          flowchart: { useMaxWidth: true, htmlLabels: true },
          themeVariables: { fontSize: '12px', fontFamily: 'inherit' },
        });
        if (cancelled) return;
        if (platformRef.current) {
          const { svg } = await mermaid.render('arch-platform', PLATFORM_DIAGRAM);
          if (cancelled) return;
          platformRef.current.innerHTML = svg;
        }
        if (plConfigRef.current) {
          const { svg } = await mermaid.render('arch-plconfig', PER_PRODUCT_LINE_DIAGRAM);
          if (cancelled) return;
          plConfigRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to render diagram');
      }
    }

    render();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Platform Architecture</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          InsuRateConnect rating orchestration — services and data flow.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
          This architecture is in draft and in progress.
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 overflow-x-auto">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 mb-4">
            {error}
          </div>
        )}
        <div
          ref={platformRef}
          className="mermaid-arch flex justify-center min-h-[320px] [&>svg]:max-w-full"
        />
        <div
          ref={plConfigRef}
          className="mermaid-arch mermaid-plconfig flex justify-center min-h-[120px] mt-6 [&>svg]:max-w-full"
        />
      </div>
    </div>
  );
}

export default Architecture;
