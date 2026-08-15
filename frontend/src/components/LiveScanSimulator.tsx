import React, { useState, useEffect } from 'react';
import { SpotlightCard } from './ui/SpotlightCard';
import { Play, CheckCircle2, ShieldCheck, Terminal, RefreshCw, Cpu, Code } from 'lucide-react';
import { useToast } from './ui/ToastProvider';

interface ScanFinding {
  id: string;
  ruleId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  location: string;
  snippet: string;
  patch: string;
}

export const LiveScanSimulator: React.FC<{ projectName?: string }> = ({ projectName = 'ARVE Core Repository' }) => {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [applyingPatch, setApplyingPatch] = useState<string | null>(null);

  const startScan = () => {
    setScanning(true);
    setProgress(0);
    setLogs(['[SYS] Initializing ARVE AST Analysis Engine...']);
    setFindings([]);
    setScanComplete(false);
    toast.info(`Initiating deep AST scan for ${projectName}...`);
  };

  useEffect(() => {
    if (!scanning) return;

    const steps = [
      { p: 15, msg: 'Fetching repository AST tree node mappings...', log: '[AST] Parsing Python & TypeScript source AST trees...' },
      { p: 35, msg: 'Tracing ingress parameters & authentication context...', log: '[INGRESS] Resolving API endpoint parameters...' },
      { p: 60, msg: 'Simulating OWASP attack vectors against dynamic AST graph...', log: '[SIM] Testing security invariants against AST graph...' },
      { p: 85, msg: 'Evaluating CORS & deployment header verification specs...', log: '[POLICY] Validating domain verification token header rules...' },
      { p: 100, msg: 'Scan complete! Analysis finished.', log: '[SUCCESS] AST Invariant scan executed successfully.' },
    ];

    let current = 0;
    const timer = setInterval(() => {
      if (current < steps.length) {
        const s = steps[current];
        setProgress(s.p);
        setCurrentStep(s.msg);
        setLogs((prev) => [...prev, s.log]);
        current++;
      } else {
        clearInterval(timer);
        setScanning(false);
        setScanComplete(true);
        setFindings([]);
        toast.success('AST Security Scan complete!');
      }
    }, 800);

    return () => clearInterval(timer);
  }, [scanning, toast]);

  const handleApplyPatch = (findingId: string) => {
    setApplyingPatch(findingId);
    setTimeout(() => {
      setFindings((prev) => prev.filter((f) => f.id !== findingId));
      setApplyingPatch(null);
      toast.success('Automated patch applied and verified successfully!');
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Scanner Control Banner */}
      <SpotlightCard>
        <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-muted)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Cpu size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>
                  AST Live Security Scanner
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '1px' }}>
                  Target Repository: <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)', fontWeight: 550 }}>{projectName}</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={startScan}
              disabled={scanning}
              style={{ padding: '8px 16px', gap: '7px' }}
            >
              {scanning ? (
                <>
                  <RefreshCw size={13} className="spin" />
                  Scanning ({progress}%)
                </>
              ) : (
                <>
                  <Play size={13} />
                  Run AST Scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan Progress bar */}
        {scanning && (
          <div style={{ padding: '0 24px 18px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', marginBottom: '6px' }}>
              <span>{currentStep}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: '3px', background: 'var(--elevated)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* Terminal Log Console */}
      <SpotlightCard>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="var(--muted)" />
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            SCAN ENGINE EXECUTION LOGS
          </span>
        </div>
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--terminal-bg)',
            color: 'var(--terminal-text)',
            fontFamily: 'var(--font-code)',
            fontSize: '11.5px',
            minHeight: '140px',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {logs.length === 0 ? (
            <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>
              Ready to initialize AST analysis. Press "Run AST Scan" to begin.
            </span>
          ) : (
            logs.map((l, i) => (
              <div key={i} style={{ opacity: 0.9, lineHeight: '1.5' }}>
                {l}
              </div>
            ))
          )}
        </div>
      </SpotlightCard>

      {/* Findings Section */}
      {scanComplete && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
              Detected Vulnerability Findings ({findings.length})
            </h4>
          </div>

          {findings.length === 0 ? (
            <SpotlightCard>
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--success-bg)',
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                  No Security Vulnerabilities Detected
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  All AST security invariants and authorization rules passed for {projectName}.
                </p>
              </div>
            </SpotlightCard>
          ) : (
            findings.map((f) => (
              <SpotlightCard key={f.id}>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span
                          className={`badge ${
                            f.severity === 'CRITICAL'
                              ? 'badge-critical'
                              : f.severity === 'HIGH'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}
                        >
                          {f.severity}
                        </span>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent)', fontWeight: 550 }}>
                          {f.ruleId}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginBottom: '3px' }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Code size={11} /> {f.location}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '11.5px', padding: '5px 12px', borderColor: 'var(--success-border)', color: 'var(--success)' }}
                      onClick={() => handleApplyPatch(f.id)}
                      disabled={applyingPatch === f.id}
                    >
                      {applyingPatch === f.id ? (
                        <>
                          <RefreshCw size={11} className="spin" /> Applying…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} /> Apply Patch
                        </>
                      )}
                    </button>
                  </div>

                  {/* Diff Box */}
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      background: 'var(--elevated)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-code)',
                      fontSize: '11.5px',
                      lineHeight: '1.6',
                    }}
                  >
                    <div style={{ color: 'var(--critical)', textDecoration: 'line-through', opacity: 0.85 }}>
                      - {f.snippet}
                    </div>
                    <div style={{ color: 'var(--success)', marginTop: '2px' }}>
                      + {f.patch}
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LiveScanSimulator;
