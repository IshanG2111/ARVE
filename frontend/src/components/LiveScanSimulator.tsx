import React, { useState, useEffect } from 'react';
import { SpotlightCard } from './ui/SpotlightCard';
import { Play, CheckCircle2, AlertTriangle, ShieldCheck, Terminal, RefreshCw, Cpu, Code } from 'lucide-react';
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

const SAMPLE_FINDINGS: ScanFinding[] = [
  {
    id: 'f-1',
    ruleId: 'OWASP-A01-BROKEN-AUTH',
    severity: 'CRITICAL',
    title: 'Bypassable User Object Identifier Lookup',
    location: 'backend/app/api/routes/users.py:L42',
    snippet: `user = db.query(User).filter(User.id == request.params['id']).first()`,
    patch: `user = db.query(User).filter(User.id == current_user.id).first()`,
  },
  {
    id: 'f-2',
    ruleId: 'OWASP-A03-INJECTION',
    severity: 'HIGH',
    title: 'Raw Query Parameter Concatenation in Target Resolution',
    location: 'backend/app/services/scanner.py:L89',
    snippet: `query = f"SELECT * FROM targets WHERE domain = '{domain}'"`,
    patch: `query = "SELECT * FROM targets WHERE domain = :domain"`,
  },
  {
    id: 'f-3',
    ruleId: 'CORS-MISCONFIG',
    severity: 'MEDIUM',
    title: 'Overly Permissive CORS Headers Allowed Origin',
    location: 'backend/app/main.py:L18',
    snippet: `allow_origins=["*"]`,
    patch: `allow_origins=[settings.FRONTEND_URL]`,
  },
];

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
      { p: 35, msg: 'Tracing ingress parameters & authentication context...', log: '[INGRESS] Resolving API endpoint parameters: GET /api/users/:id' },
      { p: 60, msg: 'Simulating OWASP attack vectors against dynamic AST graph...', log: '[SIM] Testing BOLA/IDOR pattern against req.params.id...' },
      { p: 85, msg: 'Evaluating CORS & deployment header verification specs...', log: '[POLICY] Validating domain verification token header rules...' },
      { p: 100, msg: 'Scan complete! Synthesizing AST remediation diffs.', log: '[SUCCESS] Identified 3 security findings. Generated 1-click patches.' },
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
        setFindings(SAMPLE_FINDINGS);
        toast.success('AST Security Scan complete! Findings synthesized.');
      }
    }, 900);

    return () => clearInterval(timer);
  }, [scanning, toast]);

  const handleApplyPatch = (findingId: string) => {
    setApplyingPatch(findingId);
    setTimeout(() => {
      setFindings((prev) => prev.filter((f) => f.id !== findingId));
      setApplyingPatch(null);
      toast.success('Automated patch applied and verified successfully!');
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Scanner Control Banner */}
      <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.12)">
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '6px', borderRadius: '6px', background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                <Cpu size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)' }}>
                  Interactive Security AST Scanner
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--secondary)' }}>
                  Targeting: <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>{projectName}</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={startScan}
              disabled={scanning}
              style={{ padding: '9px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {scanning ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Scanning ({progress}%)
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run AST Security Scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan Progress bar */}
        {scanning && (
          <div style={{ padding: '0 24px 20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', marginBottom: '6px' }}>
              <span>{currentStep}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: '4px', background: 'var(--elevated)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--accent) 0%, var(--success) 100%)',
                  transition: 'width 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
                  boxShadow: '0 0 12px var(--accent)',
                }}
              />
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* Terminal Log Console */}
      <div
        style={{
          background: 'rgba(8, 11, 18, 0.95)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          fontFamily: 'var(--font-code)',
          fontSize: '12px',
          lineHeight: '1.7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <Terminal size={13} color="var(--accent)" /> Scan Console Telemetry
          </span>
          <span className="status-pulse" style={{ fontSize: '10px' }}>
            <span className="pulse-dot" /> {scanning ? 'Scanning' : scanComplete ? 'Scan Finished' : 'Idle'}
          </span>
        </div>

        <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.length === 0 ? (
            <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>Press "Run AST Security Scan" to execute AST engine evaluation.</span>
          ) : (
            logs.map((l, idx) => (
              <div key={idx} style={{ color: l.includes('SUCCESS') ? 'var(--success)' : l.includes('AST') ? 'var(--accent)' : 'var(--secondary)' }}>
                {l}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Findings List */}
      {scanComplete && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} color="var(--high)" />
              Detected Vulnerabilities ({findings.length})
            </h4>
            {findings.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> All clear! No vulnerabilities detected.
              </span>
            )}
          </div>

          {findings.map((f) => (
            <SpotlightCard key={f.id} spotlightColor={f.severity === 'CRITICAL' ? 'rgba(255, 107, 107, 0.12)' : 'rgba(255, 169, 77, 0.12)'}>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        className={`badge ${
                          f.severity === 'CRITICAL' ? 'badge-critical' : f.severity === 'HIGH' ? 'badge-warn' : 'badge-neutral'
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent)' }}>
                        {f.ruleId}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Code size={12} /> {f.location}
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '11.5px', padding: '6px 12px', borderColor: 'rgba(81, 207, 102, 0.3)', color: 'var(--success)' }}
                    onClick={() => handleApplyPatch(f.id)}
                    disabled={applyingPatch === f.id}
                  >
                    {applyingPatch === f.id ? (
                      <>
                        <RefreshCw size={12} className="spin" /> Applying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} /> Apply Patch
                      </>
                    )}
                  </button>
                </div>

                {/* Diff box */}
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-code)',
                    fontSize: '11.5px',
                  }}
                >
                  <div style={{ color: 'var(--critical)', textDecoration: 'line-through', opacity: 0.8 }}>
                    - {f.snippet}
                  </div>
                  <div style={{ color: 'var(--success)', marginTop: '4px' }}>
                    + {f.patch}
                  </div>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}
    </div>
  );
};
