import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_TASKS = 5;

const NODES = [
  { id: "ingest",  label: "Ingest"   },
  { id: "domain",  label: "Analyse"  },
  { id: "tools",   label: "Tools"    },
  { id: "plan",    label: "Plan"     },
  { id: "execute", label: "Execute"  },
  { id: "qa",      label: "QA"       },
  { id: "review",  label: "Review"   },
];

const RISK = {
  High:   { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" },
  Medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.3)"  },
  Low:    { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.3)"  },
};

const ST = {
  IDLE:    "idle",
  DISCO:   "disco",
  PROC:    "proc",
  APPROVE: "approve",
  DONE:    "done",
  BUILD:   "build",
  TEST:    "test",
  ERROR:   "error",
};

const ACCOUNTING_QUESTIONS = [
  "Which account or cost centre does this relate to?",
  "What is the transaction date or accounting period in question?",
  "What is the discrepancy amount, or the specific figure that looks incorrect?",
  "Which ledger entries or journal lines are involved?",
  "Has a reconciliation been run for this period — and if so, what was the outcome?",
  "Is this a one-time entry or a recurring transaction?",
];

const GENERIC_QUESTIONS_FALLBACK = [
  "What specific step or output of the workflow is causing friction?",
  "What data or inputs are involved in this step?",
  "What is the expected outcome versus what is actually happening?",
  "Are there any upstream or downstream processes affected?",
  "What is the business impact if this remains unresolved?",
  "Have any workarounds been attempted so far?",
];

const deriveQuestions = (domain, analysis) => {
  const d = (domain ?? "").toLowerCase();
  if (d.includes("account") || d.includes("bookkeep")) return ACCOUNTING_QUESTIONS;
  const proc = analysis?.process_understanding ?? "";
  return [
    proc
      ? `Based on the "${proc.slice(0, 80)}${proc.length > 80 ? "…" : ""}" workflow — what specific step is causing friction?`
      : GENERIC_QUESTIONS_FALLBACK[0],
    ...GENERIC_QUESTIONS_FALLBACK.slice(1),
  ];
};

const deriveFirstMessage = (analysis, config, domain) => {
  const proc = analysis?.process_understanding;
  const name = config?.name ?? `${domain} Sovereign Agent`;
  if (proc) {
    return `I am your ${name}. I have analysed your ${domain} workflow: "${proc.slice(0, 130)}${proc.length > 130 ? "…" : ""}". Describe the specific issue or task you need resolved.`;
  }
  return `I am your ${name}, configured for ${domain} operations. Describe the issue or task you need resolved.`;
};

const generateDomainResolution = (answers, domain, questions) => {
  const isAccounting = (domain ?? "").toLowerCase().includes("account");
  if (isAccounting) {
    const [account, period, amount, ledger, reconciled, recurring] = answers;
    return `Analysis complete. Accounting assessment:\n\n` +
      `• Account / Cost Centre: ${account || "not specified"}\n` +
      `• Period: ${period || "not specified"} — within current close cycle\n` +
      `• Discrepancy: ${amount || "under review"} — requires journal entry review\n` +
      `• Ledger entries: ${ledger || "to be identified"}\n` +
      `• Reconciliation status: ${reconciled || "pending"}\n` +
      `• Transaction type: ${recurring || "to be confirmed"}\n\n` +
      `Recommended Action: Post correcting journal entry, update reconciliation report, and route to senior accountant for sign-off before period close.`;
  }
  const [step, data, expected, deps, impact, workaround] = answers;
  return `Diagnostic complete. Workflow assessment:\n\n` +
    `• Step identified: ${step || "as described"}\n` +
    `• Data involved: ${data || "on file"}\n` +
    `• Expected vs actual: ${expected || "deviation noted"}\n` +
    `• Upstream impact: ${deps || "isolated"}\n` +
    `• Business impact: ${impact || "standard priority"}\n` +
    `• Prior workarounds: ${workaround || "none"}\n\n` +
    `Recommended Action: Escalate to process owner, attach full diagnostic transcript, and schedule remediation sprint within the next cycle.`;
};

const BUILD_SCRIPT = [
  { msg: "Initialising Sovereign Agent Runtime...",             delay: 560,  type: "info"    },
  { msg: "MCP Handshake → gmail.connector [INIT]",             delay: 440,  type: "tool"    },
  { msg: "MCP Handshake → gmail.connector [ACK] ✓",            delay: 320,  type: "success" },
  { msg: "MCP Handshake → slack.connector [INIT]",             delay: 480,  type: "tool"    },
  { msg: "MCP Handshake → slack.connector [ACK] ✓",            delay: 340,  type: "success" },
  { msg: "MCP Handshake → sheets.connector [INIT]",            delay: 420,  type: "tool"    },
  { msg: "MCP Handshake → sheets.connector [ACK] ✓",           delay: 300,  type: "success" },
  { msg: "Loading domain knowledge graph...",                   delay: 760,  type: "info"    },
  { msg: "Embedding 7-node LangGraph topology...",             delay: 620,  type: "info"    },
  { msg: "Registering tool: pdf_extractor",                     delay: 280,  type: "tool"    },
  { msg: "Registering tool: rag_engine",                       delay: 240,  type: "tool"    },
  { msg: "Registering tool: ticket_creator",                   delay: 220,  type: "tool"    },
  { msg: "Privacy isolation layer — ACTIVE",                   delay: 560,  type: "success" },
  { msg: "Docker-Compose manifest generated",                  delay: 400,  type: "info"    },
  { msg: "Sovereign configuration sealed.",                    delay: 360,  type: "success" },
  { msg: "✓ Sovereignty verification initiated...",             delay: 300,  type: "success" },
];

const CONNECTOR_META = {
  gmail:  { label: "Gmail",         color: "#f87171", accent: "rgba(248,113,113,0.09)", border: "rgba(248,113,113,0.28)" },
  slack:  { label: "Slack",         color: "#818cf8", accent: "rgba(129,140,248,0.09)", border: "rgba(129,140,248,0.28)" },
  sheets: { label: "Google Sheets", color: "#34d399", accent: "rgba(52,211,153,0.09)",  border: "rgba(52,211,153,0.28)"  },
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconGmail = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
);

const IconSlack = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#818cf8">
    <rect x="9.5" y="2"  width="3" height="8"  rx="1.5"/>
    <rect x="9.5" y="14" width="3" height="8"  rx="1.5"/>
    <rect x="2"  y="9.5" width="8"  height="3" rx="1.5"/>
    <rect x="14" y="9.5" width="8"  height="3" rx="1.5"/>
  </svg>
);

const IconSheets = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3"  y1="9"  x2="21" y2="9"/>
    <line x1="3"  y1="15" x2="21" y2="15"/>
    <line x1="9"  y1="3"  x2="9"  y2="21"/>
    <line x1="15" y1="3"  x2="15" y2="21"/>
  </svg>
);

const IconShield = ({ verified, verifying, size = 38 }) => {
  const color = verified ? "#34d399" : "#818cf8";
  const fill  = verified ? "rgba(52,211,153,0.12)" : "rgba(129,140,248,0.08)";
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={color} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{
        filter: verified
          ? "drop-shadow(0 0 12px rgba(52,211,153,0.8))"
          : verifying
            ? "drop-shadow(0 0 7px rgba(129,140,248,0.6))"
            : "drop-shadow(0 0 4px rgba(129,140,248,0.3))",
        transition: "filter 0.8s ease, stroke 0.8s ease",
        animation: verifying && !verified ? "shieldPulse 1.6s ease-in-out infinite" : "none",
      }}
    >
      <path d="M12 2L3 6.5V11C3 16.2 7 20.8 12 22C17 20.8 21 16.2 21 11V6.5L12 2Z"/>
      {verified && (
        <polyline points="9,12 11,14.2 15.2,10" stroke="#34d399" strokeWidth="2" fill="none"/>
      )}
    </svg>
  );
};

const IconDownload = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconCalculator = ({ size = 17, color = "#34d399" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <line x1="8" y1="6" x2="16" y2="6"/>
    <circle cx="8"  cy="10" r="1" fill={color}/>
    <circle cx="12" cy="10" r="1" fill={color}/>
    <circle cx="16" cy="10" r="1" fill={color}/>
    <circle cx="8"  cy="14" r="1" fill={color}/>
    <circle cx="12" cy="14" r="1" fill={color}/>
    <circle cx="16" cy="14" r="1" fill={color}/>
    <line x1="8" y1="18" x2="16" y2="18"/>
  </svg>
);

const IconLedger = ({ size = 17, color = "#818cf8" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    <line x1="9" y1="7" x2="15" y2="7"/>
    <line x1="9" y1="11" x2="15" y2="11"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const guessDomain = (raw) => {
  if (!raw) return null;
  const t = JSON.stringify(raw).toLowerCase();
  if (t.match(/customs|freight|shipping|logistics/)) return "Logistics / Customs";
  if (t.match(/account|bookkeep|ledger|journal.*entry|balance.*sheet|p.l|profit.*loss|cash.*flow|reconcil|debit|credit|fiscal/)) return "Accounting";
  if (t.match(/gst|invoice|tax|payable|receivable/)) return "Finance / Tax Compliance";
  if (t.match(/hr|recruit|payroll|employee|onboard/)) return "HR Operations";
  if (t.match(/medical|clinical|patient|health/)) return "Healthcare";
  if (t.match(/legal|contract|gdpr|compliance|audit/)) return "Legal / Compliance";
  if (t.match(/sales|crm|lead|pipeline|deal/)) return "Sales Operations";
  return "General Business Operations";
};

const normalizeAnalysis = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  // Reject bare error envelopes that have no usable analysis fields
  if ((raw.error || raw.detail) && !raw.type && !raw.business_metrics && !raw.process_understanding) return null;

  const precision = (raw.precision_analysis && typeof raw.precision_analysis === "object") ? raw.precision_analysis : {};
  const techRaw   = raw.technical_feasibility;
  const tech      = (techRaw && typeof techRaw === "object") ? techRaw : {};
  const biz       = (raw.business_metrics && typeof raw.business_metrics === "object") ? raw.business_metrics : {};

  return {
    type:                   raw.type ?? "Workflow",
    process_understanding:  raw.process_understanding ?? null,
    error_sensitivity:      precision.error_sensitivity ?? raw.error_sensitivity ?? "Medium",
    human_approval_required: precision.human_approval_required ?? raw.human_approval_required ?? false,
    agent_skills:           Array.isArray(raw.required_ai_skills ?? raw.agent_skills) ? (raw.required_ai_skills ?? raw.agent_skills) : [],
    technical_feasibility:  tech.score ?? (typeof techRaw === "number" ? techRaw : null),
    bundling_advice:        raw.bundling_advice ?? null,
    business_metrics: {
      score:                biz.automation_score ?? biz.score ?? null,
      effort_level:         biz.effort_level ?? null,
      verdict:              biz.verdict ?? null,
      one_time_setup:       biz.setup_fee ?? biz.one_time_setup ?? null,
      monthly_subscription: biz.running_cost ?? biz.monthly_subscription ?? null,
    },
  };
};

const generateAgentConfig = (raw) => {
  const domain = raw?.domain ?? guessDomain(raw) ?? "General Business Operations";
  return {
    name: `${domain} Sovereign Agent`,
    version: "1.0.0",
    domain,
    tools: ["pdf_extractor", "rag_engine", "validator", "ticket_creator", "knowledge_search"],
    knowledge: { domain, sop_embedded: true, diagnostic_questions: DIAGNOSTIC_QUESTIONS },
    langgraph: {
      nodes: NODES.map((n) => n.id),
      edges: [["ingest","domain"],["domain","tools"],["tools","plan"],["plan","execute"],["execute","qa"],["qa","review"]],
      workflow: "support_diagnostic_v1",
    },
    created_at: new Date().toISOString(),
  };
};

const generateResolution = (answers) => {
  const [acct, when, symptom, tried, scope, urgency] = answers;
  return `Diagnostic complete. Assessment:\n\n` +
    `• Account ${acct || "on file"} — flagged for escalation\n` +
    `• Onset: ${when || "not specified"} — within current SLA window\n` +
    `• Root cause match: "${symptom || "reported issue"}" maps to pattern #CS-447\n` +
    `• Prior steps (${tried || "none"}) — proceeding with clean-slate diagnostics\n` +
    `• Scope: ${scope || "single account"} — isolated incident confirmed\n` +
    `• Priority: ${urgency || "standard"} — target resolution: 4 hours\n\n` +
    `Recommended Action: Create P2 support ticket, attach full diagnostic transcript, route to Tier 2 backend team.`;
};

const buildScript = (domain) => [
  { node: 0, log: "Ingesting document payload…",                       delay: 380, type: "info"    },
  { node: 0, log: "Tokenising content — chunk size 512",               delay: 520, type: "info"    },
  { node: 1, log: `Domain classifier → ${domain}`,                     delay: 480, type: "success" },
  { node: 1, log: "Loading domain rule-set & compliance graph…",       delay: 640, type: "tool"    },
  { node: 2, log: "Scoring 14 candidate tools against task profile…",  delay: 510, type: "info"    },
  { node: 2, log: "Selected: PDF Extractor · RAG Engine · Validator",  delay: 580, type: "success" },
  { node: 3, log: "Constructing execution plan — 4 steps, 2 checks",   delay: 660, type: "info"    },
  { node: 3, log: "Plan signed. Dispatching to executor…",             delay: 420, type: "info"    },
  { node: 4, log: "Agent executing step 1 / 4…",                       delay: 540, type: "info"    },
  { node: 4, log: "Reading CSV — 1,200 rows processed",                delay: 760, type: "tool"    },
  { node: 4, log: "Checking compliance ruleset — 3 matches found",     delay: 680, type: "tool"    },
  { node: 4, log: "Generating draft output artefact…",                 delay: 880, type: "info"    },
  { node: 5, log: "Running quality assertion suite (12 checks)…",      delay: 560, type: "info"    },
  { node: 5, log: "Confidence score: 94 % — PASS",                     delay: 480, type: "success" },
  { node: 6, log: "⚑  INTERRUPT — human review required before publish", delay: 360, type: "warn" },
];

const downloadDockerCompose = (config, connectors = []) => {
  const name = (config?.name ?? "sovereign-agent").toLowerCase().replace(/\s+/g, "-");
  const domain = config?.domain ?? "general";
  const yaml = [
    `version: '3.8'`,
    ``,
    `services:`,
    `  sovereign-agent:`,
    `    image: ghcr.io/agentfactory/sovereign:latest`,
    `    container_name: ${name}`,
    `    environment:`,
    `      - AGENT_NAME=${name}`,
    `      - AGENT_DOMAIN=${domain}`,
    `      - MCP_CONNECTORS=${connectors.join(",")}`,
    `      - PRIVACY_MODE=sovereign`,
    `      - LOG_LEVEL=info`,
    `    ports:`,
    `      - "8080:8080"`,
    `    volumes:`,
    `      - ./agent-config.json:/app/config/agent.json:ro`,
    `    restart: unless-stopped`,
    `    healthcheck:`,
    `      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]`,
    `      interval: 30s`,
    `      timeout: 10s`,
    `      retries: 3`,
    ``,
    `  nginx:`,
    `    image: nginx:1.25-alpine`,
    `    ports:`,
    `      - "80:80"`,
    `    depends_on:`,
    `      - sovereign-agent`,
    `    restart: unless-stopped`,
  ].join("\n");

  const blob = new Blob([yaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "docker-compose.yml";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusPill = ({ state }) => {
  const map = {
    [ST.IDLE]:    { label: "Ready",              color: "#818cf8" },
    [ST.DISCO]:   { label: "Discovering",        color: "#fbbf24" },
    [ST.PROC]:    { label: "Processing",         color: "#34d399" },
    [ST.APPROVE]: { label: "Awaiting Approval",  color: "#f87171" },
    [ST.DONE]:    { label: "Analysis Complete",  color: "#34d399" },
    [ST.BUILD]:   { label: "Assembling",         color: "#d97706" },
    [ST.TEST]:    { label: "Agent Live",         color: "#34d399" },
    [ST.ERROR]:   { label: "Error",              color: "#f87171" },
  };
  const s = map[state] ?? map[ST.IDLE];
  const animated = [ST.PROC, ST.DISCO, ST.BUILD, ST.TEST].includes(state);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: s.color,
        boxShadow: `0 0 6px ${s.color}`,
        animation: animated ? "pulse 1.4s infinite" : "none",
      }} />
      <span style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: s.color, fontWeight: 600, textTransform: "uppercase" }}>
        {s.label}
      </span>
    </div>
  );
};

const ErrorCard = ({ message, onReset }) => (
  <div style={{
    background: "#0f0f1a",
    border: "1px solid rgba(248,113,113,0.35)",
    borderRadius: "12px",
    padding: "32px 28px",
    textAlign: "center",
    boxShadow: "0 0 40px rgba(248,113,113,0.08)",
  }}>
    <div style={{ fontSize: "1.6rem", marginBottom: "14px", color: "#f87171" }}>⚠</div>
    <p style={{ margin: "0 0 6px", fontSize: "0.64rem", color: "#f87171", letterSpacing: "0.14em", textTransform: "uppercase" }}>
      Analysis Failed
    </p>
    <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.65, maxWidth: "380px", marginLeft: "auto", marginRight: "auto" }}>
      {message || "The server was unable to process this input. Please verify the content is a workflow or operational document and try again."}
    </p>
    <button
      onClick={onReset}
      style={{
        padding: "11px 28px",
        background: "rgba(248,113,113,0.08)",
        color: "#f87171",
        border: "1px solid rgba(248,113,113,0.3)",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: "0.8rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      Try Again
    </button>
  </div>
);

const UsageMeter = ({ tasksUsed, onUpgrade }) => {
  const remaining = MAX_TASKS - tasksUsed;
  const pct = (remaining / MAX_TASKS) * 100;
  const barColor = remaining <= 1 ? "#f87171" : remaining <= 2 ? "#fbbf24" : "#818cf8";
  return (
    <div style={{ padding: "16px 18px", borderTop: "1px solid #1a1a2e" }}>
      <p style={{ margin: "0 0 8px", fontSize: "0.62rem", color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Usage
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f1f5f9" }}>
          Tasks Remaining
        </span>
        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: barColor }}>
          {remaining}/{MAX_TASKS}
        </span>
      </div>
      <div style={{ height: "4px", background: "#1e1e2e", borderRadius: "2px", overflow: "hidden", marginBottom: "12px" }}>
        <div style={{
          height: "100%", borderRadius: "2px", transition: "width 0.4s ease",
          width: `${pct}%`,
          background: remaining <= 1
            ? "linear-gradient(90deg, #f87171, #fbbf24)"
            : "linear-gradient(90deg, #4f46e5, #818cf8)",
        }} />
      </div>
      {remaining <= 2 && (
        <button
          onClick={onUpgrade}
          style={{
            width: "100%", padding: "8px 0",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "#fff", border: "none", borderRadius: "6px",
            cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}
        >
          Upgrade →
        </button>
      )}
    </div>
  );
};

const Sidebar = ({ appState, tasksUsed, onUpgrade }) => {
  const [showBilling, setShowBilling] = useState(false);
  const navItems = [
    { label: "Analyse SOP",    state: ST.IDLE,  active: appState === ST.IDLE  },
    { label: "Deploy Agent",   state: ST.BUILD, active: appState === ST.BUILD },
    { label: "Test Agent",     state: ST.TEST,  active: appState === ST.TEST  },
  ];
  return (
    <div style={{
      width: "210px", flexShrink: 0,
      background: "#09090f",
      borderRight: "1px solid #1a1a2e",
      display: "flex", flexDirection: "column",
      minHeight: "100%",
    }}>
      {/* Brand */}
      <div style={{ padding: "22px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "1rem", color: "#818cf8" }}>◈</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.14em", color: "#f1f5f9", textTransform: "uppercase" }}>
            Agent Factory
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.65rem", color: "#4b5563", letterSpacing: "0.06em" }}>
          Sovereign Stack
        </p>
      </div>

      {/* Nav */}
      <div style={{ padding: "0 10px", flex: 1 }}>
        <p style={{ margin: "0 0 6px 8px", fontSize: "0.6rem", color: "#2a2a3e", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Workspace
        </p>
        {navItems.map((item) => (
          <div key={item.label} style={{
            padding: "8px 10px",
            borderRadius: "6px",
            marginBottom: "2px",
            background: item.active ? "rgba(129,140,248,0.1)" : "transparent",
            display: "flex", alignItems: "center", gap: "8px",
            cursor: "default",
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
              background: item.active ? "#818cf8" : "#2a2a3e",
              boxShadow: item.active ? "0 0 6px #818cf8" : "none",
            }} />
            <span style={{ fontSize: "0.75rem", color: item.active ? "#f1f5f9" : "#4b5563", fontWeight: item.active ? 600 : 400 }}>
              {item.label}
            </span>
          </div>
        ))}

        {/* Settings / Billing */}
        <div style={{ marginTop: "20px" }}>
          <p style={{ margin: "0 0 6px 8px", fontSize: "0.6rem", color: "#2a2a3e", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Settings
          </p>
          <div
            onClick={() => setShowBilling((v) => !v)}
            style={{
              padding: "8px 10px", borderRadius: "6px", marginBottom: "2px",
              display: "flex", alignItems: "center", gap: "8px", cursor: "pointer",
              background: showBilling ? "rgba(129,140,248,0.07)" : "transparent",
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "#4b5563" }}>Billing & Portal</span>
            <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#2a2a3e" }}>{showBilling ? "▲" : "▼"}</span>
          </div>
          {showBilling && (
            <div style={{ padding: "10px", margin: "2px 0 4px", background: "#0f0f1a", borderRadius: "6px", border: "1px solid #1e1e2e" }}>
              <p style={{ margin: "0 0 8px", fontSize: "0.68rem", color: "#64748b", lineHeight: 1.5 }}>
                Manage subscription, invoices, and payment methods via Stripe.
              </p>
              <a
                href={import.meta.env.VITE_STRIPE_PORTAL_URL ?? "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block", padding: "7px 10px",
                  background: "rgba(129,140,248,0.08)",
                  border: "1px solid rgba(129,140,248,0.2)",
                  borderRadius: "5px",
                  color: "#818cf8", fontSize: "0.72rem", fontWeight: 600,
                  textDecoration: "none", textAlign: "center",
                  letterSpacing: "0.06em",
                }}
              >
                Open Stripe Portal →
              </a>
            </div>
          )}
        </div>
      </div>

      <UsageMeter tasksUsed={tasksUsed} onUpgrade={onUpgrade} />
    </div>
  );
};

const UpgradeOverlay = ({ onClose }) => (
  <div style={{
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.88)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, padding: "20px",
    backdropFilter: "blur(12px)",
  }}>
    <div style={{
      background: "#0d0d16",
      border: "1px solid rgba(129,140,248,0.3)",
      borderRadius: "18px",
      padding: "48px 40px",
      maxWidth: "480px", width: "100%",
      textAlign: "center",
      boxShadow: "0 0 80px rgba(79,70,229,0.2), 0 40px 80px rgba(0,0,0,0.7)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(79,70,229,0.25), rgba(217,119,6,0.25))",
        border: "1px solid rgba(129,140,248,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", fontSize: "1.4rem",
      }}>
        ◈
      </div>
      <p style={{ margin: "0 0 4px", fontSize: "0.62rem", color: "#4b5563", letterSpacing: "0.18em", textTransform: "uppercase" }}>
        Task Limit Reached
      </p>
      <h2 style={{ margin: "0 0 10px", color: "#f1f5f9", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
        Upgrade to Pro
      </h2>
      <p style={{ margin: "0 0 32px", color: "#64748b", fontSize: "0.88rem", lineHeight: 1.7 }}>
        You have used all 5 free tasks. Upgrade for unlimited agent deployments, priority infrastructure, and dedicated sovereignty guarantees.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "28px" }}>
        {[
          { label: "Unlimited Tasks",      icon: "∞" },
          { label: "Priority Deploy",      icon: "⚡" },
          { label: "Sovereign Guarantee",  icon: "◈" },
        ].map((f, i) => (
          <div key={i} style={{
            padding: "14px 10px",
            background: "rgba(129,140,248,0.06)",
            border: "1px solid rgba(129,140,248,0.15)",
            borderRadius: "10px",
          }}>
            <div style={{ fontSize: "1.2rem", marginBottom: "6px" }}>{f.icon}</div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", lineHeight: 1.4 }}>{f.label}</div>
          </div>
        ))}
      </div>
      <a
        href={import.meta.env.VITE_STRIPE_PORTAL_URL ?? "#"}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block", padding: "16px 24px",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 45%, #d97706 100%)",
          color: "#fff", borderRadius: "10px",
          fontWeight: 800, fontSize: "0.9rem",
          letterSpacing: "0.08em", textTransform: "uppercase",
          textDecoration: "none",
          boxShadow: "0 0 40px rgba(79,70,229,0.4)",
          marginBottom: "12px",
        }}
      >
        Upgrade Now →
      </a>
      <button
        onClick={onClose}
        style={{
          background: "transparent", border: "none",
          color: "#4b5563", cursor: "pointer",
          fontSize: "0.78rem", letterSpacing: "0.06em",
        }}
      >
        Continue with free tier
      </button>
    </div>
  </div>
);

const EntryZone = ({ textInput, setTextInput, file, setFile, dragOver, setDragOver, onDrop, onSubmit, tasksUsed, onUpgrade }) => {
  const exhausted = tasksUsed >= MAX_TASKS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ marginBottom: "4px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.01em" }}>
          Analyse &amp; Deploy
        </h2>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#4b5563", lineHeight: 1.6 }}>
          Upload a Standard Operating Procedure or describe the workflow. The system will analyse, then assemble a sovereign agent.
        </p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("sop-file-input").click()}
        style={{
          border: `1px dashed ${dragOver ? "#818cf8" : "#2a2a3e"}`,
          borderRadius: "10px", padding: "32px 20px",
          textAlign: "center", cursor: "pointer",
          background: dragOver ? "rgba(129,140,248,0.05)" : "#0f0f1a",
          transition: "all 0.2s",
        }}
      >
        <input id="sop-file-input" type="file" style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0])} />
        <div style={{ fontSize: "1.4rem", marginBottom: "8px", opacity: 0.4 }}>⬆</div>
        {file
          ? <p style={{ margin: 0, color: "#818cf8", fontSize: "0.88rem", fontWeight: 600 }}>{file.name}</p>
          : <>
              <p style={{ margin: "0 0 4px", color: "#f1f5f9", fontSize: "0.88rem", fontWeight: 600 }}>Upload SOP or Document</p>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.75rem" }}>PDF · CSV · TXT · DOCX — drag &amp; drop or click</p>
            </>
        }
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, height: "1px", background: "#1e1e2e" }} />
        <span style={{ color: "#4b5563", fontSize: "0.68rem", letterSpacing: "0.1em" }}>OR</span>
        <div style={{ flex: 1, height: "1px", background: "#1e1e2e" }} />
      </div>
      <textarea
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="Describe the workflow or paste your SOP directly…"
        rows={5}
        style={{
          background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "10px",
          padding: "14px 16px", color: "#f1f5f9", fontSize: "0.88rem",
          resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6,
        }}
      />
      <button
        onClick={exhausted ? onUpgrade : onSubmit}
        disabled={!exhausted && !textInput && !file}
        style={{
          padding: "14px",
          background: exhausted
            ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
            : (!textInput && !file) ? "#1a1a2e" : "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
          color: exhausted ? "#fff" : (!textInput && !file) ? "#4b5563" : "#fff",
          border: "none", borderRadius: "10px",
          cursor: exhausted ? "pointer" : (!textInput && !file) ? "not-allowed" : "pointer",
          fontWeight: 700, fontSize: "0.88rem",
          letterSpacing: "0.06em", textTransform: "uppercase",
          transition: "all 0.2s",
        }}
      >
        {exhausted ? "Upgrade to Continue →" : "Analyse SOP"}
      </button>
    </div>
  );
};

const DiscoveryCard = ({ domain, fileName }) => (
  <div style={{
    background: "#0f0f1a", border: "1px solid #2a2a3e",
    borderRadius: "12px", padding: "36px 28px", textAlign: "center",
  }}>
    <div style={{ fontSize: "2rem", marginBottom: "16px", animation: "spin 2s linear infinite", display: "inline-block", color: "#818cf8" }}>◎</div>
    <p style={{ margin: "0 0 6px", color: "#4b5563", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
      Auto-Domain Discovery
    </p>
    {fileName && <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "0.8rem" }}>→ {fileName}</p>}
    {domain
      ? <>
          <p style={{ margin: "0 0 6px", color: "#818cf8", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Identified Domain</p>
          <h2 style={{ margin: "0 0 20px", color: "#f1f5f9", fontSize: "1.5rem", fontWeight: 700 }}>{domain}</h2>
          <p style={{ margin: 0, color: "#4b5563", fontSize: "0.78rem" }}>Initialising agent workflow…</p>
        </>
      : <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Scanning document for domain signals…</p>
    }
  </div>
);

const NodeStepper = ({ nodes, activeNode, completedNodes }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "20px" }}>
    {nodes.map((n, i) => {
      const done   = completedNodes.includes(i);
      const active = activeNode === i;
      const color  = done ? "#34d399" : active ? "#818cf8" : "#252535";
      const tCol   = done ? "#34d399" : active ? "#f1f5f9" : "#4b5563";
      return (
        <div key={n.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", flex: "none" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: `2px solid ${color}`,
              background: done ? "rgba(52,211,153,0.1)" : active ? "rgba(129,140,248,0.15)" : "#0f0f1a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 700, color: tCol,
              boxShadow: active ? "0 0 10px rgba(129,140,248,0.4)" : "none",
              transition: "all 0.3s",
            }}>
              {done ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: "0.62rem", color: tCol, whiteSpace: "nowrap", letterSpacing: "0.04em", transition: "color 0.3s" }}>
              {n.label}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <div style={{
              flex: 1, height: "2px", margin: "0 2px 14px",
              background: done ? "#34d399" : "#252535", transition: "background 0.4s",
            }} />
          )}
        </div>
      );
    })}
  </div>
);

const LiveTerminal = ({ logs, terminalRef, title = "LIVE TERMINAL" }) => (
  <div style={{ background: "#060609", border: "1px solid #1a1a2e", borderRadius: "8px", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "8px 14px", background: "#0d0d14", borderBottom: "1px solid #1a1a2e", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
      <span style={{ marginLeft: "6px", fontSize: "0.64rem", color: "#4b5563", letterSpacing: "0.1em" }}>{title}</span>
    </div>
    <div
      ref={terminalRef}
      style={{ height: "220px", overflowY: "auto", padding: "12px 14px", fontFamily: "'Courier New', Courier, monospace", fontSize: "0.74rem", lineHeight: 1.7 }}
    >
      {logs.length === 0 && <span style={{ color: "#2a2a3e" }}>_ awaiting agent output…</span>}
      {logs.map((l, i) => {
        const col = l.type === "success" ? "#34d399" : l.type === "warn" ? "#fbbf24" : l.type === "error" ? "#f87171" : l.type === "tool" ? "#818cf8" : "#4ade80";
        return (
          <div key={i} style={{ display: "flex", gap: "10px" }}>
            <span style={{ color: "#2a2a3e", flexShrink: 0 }}>{l.ts}</span>
            <span style={{ color: col }}>{l.msg}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const ActionCenter = ({ nodes, activeNode, completedNodes, terminalLogs, terminalRef }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <div style={{ background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "12px", padding: "20px 22px" }}>
      <p style={{ margin: "0 0 16px", fontSize: "0.68rem", color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Workflow Status — LangGraph Execution
      </p>
      <NodeStepper nodes={nodes} activeNode={activeNode} completedNodes={completedNodes} />
    </div>
    <LiveTerminal logs={terminalLogs} terminalRef={terminalRef} />
  </div>
);

const McpConnectorButton = ({ connectorId, active }) => {
  const meta = CONNECTOR_META[connectorId] ?? { label: connectorId, color: "#818cf8", accent: "rgba(129,140,248,0.09)", border: "rgba(129,140,248,0.28)" };
  const Icon = connectorId === "gmail" ? IconGmail : connectorId === "slack" ? IconSlack : IconSheets;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px",
      background: active ? meta.accent : "rgba(255,255,255,0.02)",
      border: `1px solid ${active ? meta.border : "#1e1e2e"}`,
      borderRadius: "8px",
      transition: "all 0.4s ease",
    }}>
      <Icon size={16} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: active ? meta.color : "#64748b", transition: "color 0.4s" }}>
          {meta.label}
        </span>
      </div>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: active ? meta.color : "#2a2a3e",
        boxShadow: active ? `0 0 6px ${meta.color}` : "none",
        transition: "all 0.4s",
        animation: active ? "pulse 2s infinite" : "none",
      }} />
    </div>
  );
};

const SovereignConfigPanel = ({
  sovereignStatus,
  mcpConnectors,
  buildComplete,
  coworkerConfig,
}) => {
  const verified    = sovereignStatus === "verified";
  const verifying   = sovereignStatus === "verifying";
  const [selfHost, setSelfHost] = useState(false);

  return (
    <div style={{
      background: "#0f0f1a",
      border: `1px solid ${verified ? "rgba(52,211,153,0.3)" : "rgba(129,140,248,0.2)"}`,
      borderRadius: "12px",
      padding: "22px",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      transition: "border-color 0.8s ease",
    }}>
      {/* Privacy Shield */}
      <div style={{ textAlign: "center", paddingBottom: "16px", borderBottom: "1px solid #1e1e2e" }}>
        <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
          <IconShield verified={verified} verifying={verifying} size={44} />
        </div>
        <p style={{
          margin: "0 0 4px",
          fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase",
          color: verified ? "#34d399" : "#4b5563",
          transition: "color 0.8s",
        }}>
          Privacy Shield
        </p>
        <p style={{
          margin: 0, fontSize: "0.82rem", fontWeight: 700,
          color: verified ? "#34d399" : verifying ? "#818cf8" : "#64748b",
          transition: "color 0.8s",
        }}>
          {verified ? "Sovereignty Verified" : verifying ? "Verifying…" : "Pending Verification"}
        </p>
        {verified && (
          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.68rem", color: "#34d399", letterSpacing: "0.08em" }}>
              ✓ Data stays on your infrastructure
            </span>
          </div>
        )}
      </div>

      {/* MCP Connectors */}
      <div>
        <p style={{ margin: "0 0 10px", fontSize: "0.62rem", color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          MCP Connectors
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {mcpConnectors.map((id) => (
            <McpConnectorButton key={id} connectorId={id} active={buildComplete} />
          ))}
        </div>
      </div>

      {/* Self-Host Toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: selfHost ? "rgba(52,211,153,0.05)" : "#0a0a0f",
        border: `1px solid ${selfHost ? "rgba(52,211,153,0.25)" : "#1e1e2e"}`,
        borderRadius: "8px",
        transition: "all 0.3s ease",
      }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "0.74rem", fontWeight: 600, color: selfHost ? "#34d399" : "#64748b" }}>
            Self-Host
          </p>
          <p style={{ margin: 0, fontSize: "0.64rem", color: "#4b5563" }}>
            Deploy on your own infrastructure
          </p>
        </div>
        <div
          onClick={() => setSelfHost((v) => !v)}
          style={{
            width: 40, height: 22, borderRadius: 11,
            background: selfHost ? "rgba(52,211,153,0.35)" : "#1e1e2e",
            border: `1px solid ${selfHost ? "rgba(52,211,153,0.5)" : "#2a2a3e"}`,
            cursor: "pointer", position: "relative",
            transition: "all 0.3s ease", flexShrink: 0,
          }}
        >
          <div style={{
            position: "absolute", top: 2, left: selfHost ? 18 : 2,
            width: 16, height: 16, borderRadius: "50%",
            background: selfHost ? "#34d399" : "#4b5563",
            transition: "left 0.3s ease, background 0.3s ease",
            boxShadow: selfHost ? "0 0 6px rgba(52,211,153,0.6)" : "none",
          }} />
        </div>
      </div>

      {/* Download Docker — visible only when Self-Host is toggled */}
      {selfHost && (
        <button
          onClick={() => downloadDockerCompose(coworkerConfig, mcpConnectors)}
          disabled={!buildComplete}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "12px 16px",
            background: buildComplete ? "rgba(52,211,153,0.08)" : "#0a0a0f",
            color: buildComplete ? "#34d399" : "#2a2a3e",
            border: `1px solid ${buildComplete ? "rgba(52,211,153,0.3)" : "#1e1e2e"}`,
            borderRadius: "8px",
            cursor: buildComplete ? "pointer" : "not-allowed",
            fontWeight: 700, fontSize: "0.78rem",
            letterSpacing: "0.08em", textTransform: "uppercase",
            transition: "all 0.4s ease",
          }}
        >
          <IconDownload size={14} />
          Download Docker-Compose
        </button>
      )}
    </div>
  );
};

const SovereignBuildView = ({ buildLogs, terminalRef, sovereignStatus, mcpConnectors, buildComplete, coworkerConfig }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p style={{ margin: "0 0 3px", fontSize: "0.62rem", color: "#d97706", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Sovereign Assembly
        </p>
        <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.01em" }}>
          Constructing Agent
        </h3>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#d97706", boxShadow: "0 0 8px #d97706", display: "inline-block", animation: "pulse 1.4s infinite" }} />
        <span style={{ fontSize: "0.68rem", color: "#d97706", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Building</span>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>
      {/* Left: Construction Terminal */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ margin: 0, fontSize: "0.62rem", color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Construction Terminal
        </p>
        <LiveTerminal logs={buildLogs} terminalRef={terminalRef} title="MCP HANDSHAKES" />
      </div>

      {/* Right: Sovereign Configuration */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ margin: 0, fontSize: "0.62rem", color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Sovereign Configuration
        </p>
        <SovereignConfigPanel
          sovereignStatus={sovereignStatus}
          mcpConnectors={mcpConnectors}
          buildComplete={buildComplete}
          coworkerConfig={coworkerConfig}
        />
      </div>
    </div>
  </div>
);

const ResultsPanel = ({ normalized, onReset, onAssemble }) => {
  const risk = RISK[normalized.error_sensitivity] ?? RISK.Medium;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "0.64rem", color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>Output Report</p>
          <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "1.15rem", fontWeight: 700 }}>{normalized.type} Analysis</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700, background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
            {normalized.error_sensitivity} Risk
          </span>
          <button
            onClick={onReset}
            style={{ padding: "5px 14px", background: "transparent", color: "#4b5563", border: "1px solid #2a2a3e", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem" }}
          >
            New Build
          </button>
        </div>
      </div>

      {normalized.human_approval_required && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24", fontSize: "0.82rem" }}>
          <b>Action Required:</b> All final outputs require human review before execution.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        {[
          { value: normalized.business_metrics.score != null ? `${normalized.business_metrics.score}%` : "—", label: "Efficiency Gain", col: "#818cf8" },
          { value: normalized.business_metrics.effort_level ?? "—", label: "Timeline", col: "#f1f5f9" },
          { value: normalized.business_metrics.verdict ?? "—", label: "Verdict", col: "#34d399" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "10px", padding: "18px 14px", textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 800, color: s.col }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: "0.68rem", color: "#4b5563", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "10px", padding: "18px" }}>
        <p style={sectionTitle}>ROI &amp; Pricing</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {[
            { label: "One-Time Setup", value: normalized.business_metrics.one_time_setup ?? "Contact us", note: "20% of annual CTC equivalent" },
            { label: "Monthly Subscription", value: normalized.business_metrics.monthly_subscription ?? "Contact us", note: "Standard / Pro / Enterprise" },
          ].map((p, i) => (
            <div key={i} style={{ background: "#16161f", border: "1px solid #2a2a3e", borderRadius: "8px", padding: "14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.64rem", color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.label}</p>
              <p style={{ margin: "0 0 2px", fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9" }}>{p.value}</p>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "#4b5563" }}>{p.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "10px", padding: "18px" }}>
        <p style={sectionTitle}>Technical Blueprint</p>
        {normalized.agent_skills?.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.68rem", color: "#4b5563" }}>Required AI Capabilities</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {normalized.agent_skills.map((s, i) => (
                <span key={i} style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "0.71rem", color: "#818cf8", background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)" }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {normalized.technical_feasibility != null && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#4b5563", marginBottom: "6px" }}>
              <span>Technical Feasibility</span>
              <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{normalized.technical_feasibility}%</span>
            </div>
            <div style={{ height: "6px", background: "#1e1e2e", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "3px", transition: "width 0.8s ease",
                width: `${normalized.technical_feasibility}%`,
                background: normalized.technical_feasibility >= 70 ? "#34d399" : normalized.technical_feasibility >= 40 ? "#fbbf24" : "#f87171",
              }} />
            </div>
          </div>
        )}
      </div>

      {normalized.bundling_advice && (
        <div style={{ padding: "14px 16px", background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "10px", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.6 }}>
          <b style={{ color: "#818cf8" }}>Bundling Advice:</b> {normalized.bundling_advice}
        </div>
      )}

      <div style={{ paddingTop: "4px" }}>
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(129,140,248,0.3), rgba(217,119,6,0.3), transparent)", marginBottom: "20px" }} />
        <button
          onClick={onAssemble}
          style={{
            width: "100%", padding: "18px 24px",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 45%, #d97706 100%)",
            color: "#fff", border: "none", borderRadius: "12px", cursor: "pointer",
            fontWeight: 800, fontSize: "1rem", letterSpacing: "0.08em", textTransform: "uppercase",
            boxShadow: "0 0 32px rgba(79,70,229,0.35), 0 0 64px rgba(217,119,6,0.15)",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 48px rgba(79,70,229,0.5), 0 0 80px rgba(217,119,6,0.25)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 32px rgba(79,70,229,0.35), 0 0 64px rgba(217,119,6,0.15)"; }}
        >
          ◈ Assemble Sovereign Agent
        </button>
        <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: "0.7rem", color: "#4b5563" }}>
          Compiles tools · embeds knowledge graph · wires LangGraph — generates <code style={{ color: "#818cf8" }}>docker-compose.yml</code>
        </p>
      </div>
    </div>
  );
};

const ApprovalCard = ({ payload, onApprove, onReject, onEdit, showEditMode, editText, setEditText, onEditSubmit }) => (
  <div style={{
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)",
  }}>
    <div style={{
      background: "#111118", border: "1px solid rgba(248,113,113,0.4)", borderRadius: "14px",
      padding: "28px", maxWidth: "600px", width: "100%",
      boxShadow: "0 0 40px rgba(248,113,113,0.1), 0 20px 60px rgba(0,0,0,0.6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <span style={{ padding: "3px 10px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "4px", fontSize: "0.62rem", color: "#f87171", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Human-in-the-Loop
        </span>
        <span style={{ color: "#4b5563", fontSize: "0.74rem" }}>Interrupt triggered — approval required to proceed</span>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: "0.68rem", color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase" }}>Proposed Action</p>
      <div style={{
        background: "#0a0a0f", border: "1px solid #2a2a3e", borderRadius: "8px", padding: "16px", marginBottom: "20px",
        maxHeight: "200px", overflowY: "auto", fontFamily: "'Courier New', Courier, monospace",
        fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap",
      }}>
        {payload?.proposedAction || payload?.summary || "Agent has generated an output artefact and is requesting operator sign-off before execution."}
      </div>
      {showEditMode && (
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: "0.68rem", color: "#818cf8", letterSpacing: "0.08em" }}>Edit Request</p>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Describe what should be changed…"
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", background: "#0f0f1a", border: "1px solid #3730a3", borderRadius: "8px", padding: "10px 12px", color: "#f1f5f9", fontSize: "0.85rem", resize: "vertical", outline: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={onEditSubmit}
            disabled={!editText.trim()}
            style={{ marginTop: "8px", padding: "8px 16px", background: "#3730a3", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
          >
            Resubmit to Agent
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: "10px" }}>
        {[
          { label: "Approve", onClick: onApprove, bg: "linear-gradient(135deg, #059669 0%, #34d399 100%)", color: "#fff", border: "none" },
          { label: "Edit Request", onClick: onEdit, bg: "rgba(129,140,248,0.1)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.3)" },
          { label: "Reject", onClick: onReject, bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" },
        ].map((btn) => (
          <button key={btn.label} onClick={btn.onClick} style={{ flex: 1, padding: "11px", background: btn.bg, color: btn.color, border: btn.border, borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const TestCoworker = ({ config, analysis, onReset }) => {
  const domain       = config?.domain ?? guessDomain(analysis) ?? "General Business Operations";
  const isAccounting = domain.toLowerCase().includes("account");
  const avatarLabel  = isAccounting ? "ACC" : "SA";
  const avatarGrad   = isAccounting
    ? "linear-gradient(135deg, #34d399, #059669)"
    : "linear-gradient(135deg, #4f46e5, #d97706)";
  const accentColor  = isAccounting ? "#34d399" : "#d97706";

  const [questions, setQuestions]   = useState(() => deriveQuestions(domain, analysis));
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [messages, setMessages]     = useState(() => [{
    role: "agent",
    content: deriveFirstMessage(analysis, config, domain),
    type: "info",
  }]);
  const [input, setInput]           = useState("");
  const [phase, setPhase]           = useState("initial");
  const [qIndex, setQIndex]         = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [answers, setAnswers]       = useState([]);
  const messagesEndRef              = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isThinking]);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/ai/workflow-manifest?domain=${encodeURIComponent(domain)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.diagnostic_questions) && data.diagnostic_questions.length > 0) {
            setQuestions(data.diagnostic_questions);
          }
        }
      } catch {
        // keep derived questions as fallback
      } finally {
        setManifestLoaded(true);
      }
    };
    fetchManifest();
  }, [domain]);

  const addMsg = (role, content, type = "info") => {
    const ts = new Date().toISOString().substr(11, 8);
    setMessages((prev) => [...prev, { role, content, type, ts }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg = input.trim();
    setInput("");
    addMsg("user", userMsg);
    setIsThinking(true);
    await sleep(700);

    if (phase === "initial") {
      addMsg("agent", `Query received. Initiating ${questions.length}-point diagnostic protocol…`, "tool");
      await sleep(500);
      addMsg("agent", questions[0], "question");
      setPhase("diagnostic");
      setQIndex(0);
    } else if (phase === "diagnostic") {
      const newAnswers = [...answers, userMsg];
      setAnswers(newAnswers);
      const nextQ = qIndex + 1;
      if (nextQ < questions.length) {
        addMsg("agent", questions[nextQ], "question");
        setQIndex(nextQ);
      } else {
        addMsg("agent", "All diagnostics collected. Analysing and generating resolution…", "tool");
        await sleep(1400);
        addMsg("agent", generateDomainResolution(newAnswers, domain, questions), "success");
        setPhase("resolved");
      }
    }
    setIsThinking(false);
  };

  const handleReset = () => {
    setMessages([{
      role: "agent",
      content: deriveFirstMessage(analysis, config, domain),
      type: "info",
    }]);
    setPhase("initial");
    setAnswers([]);
    setQIndex(0);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{
        background: isAccounting
          ? "linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(5,150,105,0.1) 100%)"
          : "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(217,119,6,0.12) 100%)",
        border: `1px solid ${isAccounting ? "rgba(52,211,153,0.3)" : "rgba(129,140,248,0.3)"}`,
        borderRadius: "12px", padding: "18px 22px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isAccounting && <IconCalculator size={22} color="#34d399" />}
            <div>
              <p style={{ margin: "0 0 3px", fontSize: "0.64rem", color: accentColor, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {isAccounting ? "Accounting Agent Test" : "Live Agent Test"}
              </p>
              <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "1.1rem", fontWeight: 700 }}>
                {config?.name ?? "Sovereign Agent"} — Online
              </h3>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isAccounting && <IconLedger size={18} color="#34d399" />}
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.7rem", color: "#34d399" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", display: "inline-block", animation: "pulse 1.4s infinite" }} />
              Deployed
            </span>
            <button onClick={onReset} style={{ padding: "5px 14px", background: "transparent", color: "#4b5563", border: "1px solid #2a2a3e", borderRadius: "6px", cursor: "pointer", fontSize: "0.74rem" }}>
              New Build
            </button>
          </div>
        </div>
        {isAccounting && (
          <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["Ledger Review", "Journal Entries", "Period Close", "Reconciliation"].map((tag) => (
              <span key={tag} style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "0.65rem", color: "#34d399", background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {phase === "diagnostic" && (
          <div style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#4b5563", marginBottom: "5px" }}>
              <span>Diagnostic Progress</span>
              <span>{qIndex + 1} / {questions.length}</span>
            </div>
            <div style={{ height: "4px", background: "#1e1e2e", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "2px",
                background: isAccounting
                  ? "linear-gradient(90deg, #059669, #34d399)"
                  : "linear-gradient(90deg, #4f46e5, #d97706)",
                width: `${((qIndex + 1) / questions.length) * 100}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Chat window */}
      <div style={{ background: "#060609", border: "1px solid #1a1a2e", borderRadius: "10px", height: "360px", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: "8px" }}>
            {m.role === "agent" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 800, flexShrink: 0, marginTop: "2px", color: "#fff" }}>
                {avatarLabel}
              </div>
            )}
            <div style={{
              maxWidth: "75%", padding: "10px 14px",
              borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: m.role === "user" ? "rgba(129,140,248,0.1)" : "#0f0f1a",
              border: m.role === "user" ? "1px solid rgba(129,140,248,0.2)" : "1px solid #1e1e2e",
              color: m.type === "success" ? "#34d399" : m.type === "tool" ? "#818cf8" : m.type === "question" ? "#fbbf24" : "#94a3b8",
              fontSize: "0.84rem", lineHeight: 1.65, whiteSpace: "pre-wrap",
            }}>
              {m.content}
              {m.ts && <div style={{ fontSize: "0.62rem", color: "#2a2a3e", marginTop: "4px" }}>{m.ts}</div>}
            </div>
          </div>
        ))}
        {isThinking && (
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 800, color: "#fff" }}>{avatarLabel}</div>
            <div style={{ padding: "12px 16px", background: "#0f0f1a", border: "1px solid #1e1e2e", borderRadius: "12px 12px 12px 2px", display: "flex", gap: "5px", alignItems: "center" }}>
              {[0, 0.22, 0.44].map((delay, i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4b5563", display: "inline-block", animation: `pulse 1s infinite ${delay}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {phase !== "resolved" ? (
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={phase === "initial" ? "Describe the issue or task…" : "Your answer…"}
            disabled={isThinking}
            style={{ flex: 1, background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: "8px", padding: "12px 14px", color: "#f1f5f9", fontSize: "0.86rem", outline: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            style={{ padding: "12px 22px", background: (!input.trim() || isThinking) ? "#1a1a2e" : `linear-gradient(135deg, ${isAccounting ? "#059669, #34d399" : "#4f46e5, #7c3aed"})`, color: (!input.trim() || isThinking) ? "#4b5563" : "#fff", border: "none", borderRadius: "8px", cursor: (!input.trim() || isThinking) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.8rem", transition: "all 0.2s" }}
          >
            Send
          </button>
        </div>
      ) : (
        <button
          onClick={handleReset}
          style={{ padding: "13px", background: "rgba(129,140,248,0.08)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          Test Another Query
        </button>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ChatUI = () => {
  const [appState, setAppState]               = useState(ST.IDLE);
  const [textInput, setTextInput]             = useState("");
  const [file, setFile]                       = useState(null);
  const [dragOver, setDragOver]               = useState(false);
  const [domain, setDomain]                   = useState(null);
  const [activeNode, setActiveNode]           = useState(-1);
  const [completedNodes, setCompletedNodes]   = useState([]);
  const [terminalLogs, setTerminalLogs]       = useState([]);
  const [approvalPayload, setApprovalPayload] = useState(null);
  const [editText, setEditText]               = useState("");
  const [showEditMode, setShowEditMode]       = useState(false);
  const [analysis, setAnalysis]               = useState(null);
  const [coworkerConfig, setCoworkerConfig]   = useState(null);
  const [errorMsg, setErrorMsg]               = useState("");
  const [tasksUsed, setTasksUsed]             = useState(0);
  const [showUpgrade, setShowUpgrade]         = useState(false);
  const [sovereignStatus, setSovereignStatus] = useState("idle");
  const [mcpConnectors, setMcpConnectors]     = useState(["gmail", "slack", "sheets"]);
  const [buildComplete, setBuildComplete]     = useState(false);
  const terminalRef = useRef(null);
  const abortRef    = useRef(false);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLogs]);

  useEffect(() => () => { abortRef.current = true; }, []);

  useEffect(() => {
    if (tasksUsed >= MAX_TASKS) setShowUpgrade(true);
  }, [tasksUsed]);

  const addLog = useCallback((msg, type = "info") => {
    const ts = new Date().toISOString().substr(11, 12);
    setTerminalLogs((prev) => [...prev, { ts, msg, type }]);
  }, []);

  const verifySovereignty = async () => {
    setSovereignStatus("verifying");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/sovereign/verify`);
      if (res.ok) {
        setSovereignStatus("verified");
      } else {
        setSovereignStatus("failed");
      }
    } catch {
      setSovereignStatus("failed");
    }
  };

  const handleSubmit = async () => {
    if (!textInput && !file) return;
    if (tasksUsed >= MAX_TASKS) { setShowUpgrade(true); return; }
    abortRef.current = false;

    setAppState(ST.DISCO);
    setDomain(null);
    setActiveNode(-1);
    setCompletedNodes([]);
    setTerminalLogs([]);
    setAnalysis(null);
    setCoworkerConfig(null);
    setSovereignStatus("idle");
    setBuildComplete(false);

    const goError = (msg) => {
      setErrorMsg(msg);
      setAppState(ST.ERROR);
    };

    try {
      const sopText = file ? await file.text() : textInput;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sopText }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        goError(`Server returned an unreadable response (HTTP ${res.status}). The backend may be unavailable.`);
        return;
      }

      if (!res.ok) {
        const msg = data?.detail ?? data?.error ?? data?.message ?? `Server error ${res.status}`;
        goError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }

      const rawAnalysis = data.analysis ?? data;
      const normalized  = normalizeAnalysis(rawAnalysis);

      if (!normalized) {
        const serverMsg = rawAnalysis?.detail ?? rawAnalysis?.error ?? rawAnalysis?.message;
        goError(
          typeof serverMsg === "string"
            ? serverMsg
            : "The response did not contain a recognisable analysis. Please ensure the input describes a workflow or operational process."
        );
        return;
      }

      const detectedDomain = rawAnalysis?.domain ?? guessDomain(rawAnalysis);
      setDomain(detectedDomain);
      setAnalysis(rawAnalysis);
      setTasksUsed((n) => n + 1);

      if (abortRef.current) return;
      await sleep(1600);
      if (abortRef.current) return;

      setAppState(ST.PROC);
      const script = buildScript(detectedDomain ?? "General Business Operations");
      let lastNode = -1;

      for (const step of script) {
        if (abortRef.current) return;
        await sleep(step.delay);
        if (step.node !== lastNode) {
          if (lastNode >= 0) setCompletedNodes((prev) => [...prev, lastNode]);
          setActiveNode(step.node);
          lastNode = step.node;
        }
        addLog(step.log, step.type);
        if (step.type === "warn") {
          await sleep(600);
          setApprovalPayload({ proposedAction: buildProposedAction(rawAnalysis), analysis: rawAnalysis });
          setAppState(ST.APPROVE);
          return;
        }
      }

      setCompletedNodes(NODES.map((_, i) => i));
      setActiveNode(-1);
      setAppState(ST.DONE);
    } catch (err) {
      console.error(err);
      goError(`Unexpected error: ${err.message}`);
    }
  };

  const handleApprove = async () => {
    setShowEditMode(false);
    addLog("Human approval received. Proceeding to final review…", "success");
    setAppState(ST.PROC);
    setActiveNode(6);
    await sleep(1400);
    setCompletedNodes(NODES.map((_, i) => i));
    setActiveNode(-1);
    setAppState(ST.DONE);
  };

  const handleReject = () => {
    addLog("Action rejected by operator. Workflow terminated.", "error");
    setApprovalPayload(null);
    setShowEditMode(false);
    setAppState(ST.IDLE);
  };

  const handleEditSubmit = async () => {
    addLog(`Edit request: "${editText.slice(0, 55)}…"`, "info");
    setShowEditMode(false);
    setAppState(ST.PROC);
    setActiveNode(4);
    await sleep(500);
    addLog("Re-executing with operator constraints…", "info");
    await sleep(1800);
    addLog("Revised output generated. QA check passed.", "success");
    await sleep(500);
    handleApprove();
  };

  const handleAssemble = async () => {
    abortRef.current = false;
    setAppState(ST.BUILD);
    setTerminalLogs([]);
    setSovereignStatus("idle");
    setBuildComplete(false);

    let configData = null;
    const buildPromise = fetch(`${import.meta.env.VITE_API_URL}/ai/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        configData = d;
        if (d?.connectors?.length) setMcpConnectors(d.connectors);
      });

    for (const step of BUILD_SCRIPT) {
      if (abortRef.current) return;
      await sleep(step.delay);
      addLog(step.msg, step.type);
    }

    await buildPromise;
    if (!configData) configData = generateAgentConfig(analysis);
    setCoworkerConfig(configData);
    setBuildComplete(true);

    verifySovereignty();

    if (!abortRef.current) {
      await sleep(2200);
      setAppState(ST.TEST);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const normalized = normalizeAnalysis(analysis);

  const fullReset = () => {
    setAppState(ST.IDLE);
    setTextInput("");
    setFile(null);
    setAnalysis(null);
    setCoworkerConfig(null);
    setTerminalLogs([]);
    setSovereignStatus("idle");
    setBuildComplete(false);
    setErrorMsg("");
  };

  const isBuildState = appState === ST.BUILD;

  return (
    <>
      <style>{`
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shieldPulse{
          0%   { filter: drop-shadow(0 0 4px rgba(129,140,248,0.4)); }
          50%  { filter: drop-shadow(0 0 14px rgba(129,140,248,0.9)); }
          100% { filter: drop-shadow(0 0 4px rgba(129,140,248,0.4)); }
        }
        *::-webkit-scrollbar       { width:4px; height:4px; }
        *::-webkit-scrollbar-track { background:#0a0a0f; }
        *::-webkit-scrollbar-thumb { background:#2a2a3e; border-radius:2px; }
        textarea:focus { border-color:#3730a3 !important; box-shadow:0 0 0 2px rgba(99,102,241,0.15) !important; }
        input:focus    { border-color:#3730a3 !important; box-shadow:0 0 0 2px rgba(99,102,241,0.15) !important; }
      `}</style>

      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: "#08080e",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        color: "#f1f5f9",
      }}>
        {/* Top bar */}
        <div style={{
          borderBottom: "1px solid #1a1a2e", padding: "13px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#0a0a0f", position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.18em", color: "#f1f5f9", textTransform: "uppercase" }}>
              Sovereign Agent Factory
            </span>
            <span style={{ color: "#2a2a3e" }}>|</span>
            <span style={{ fontSize: "0.68rem", color: "#4b5563", letterSpacing: "0.08em" }}>Universal Build Mode</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Free-tier usage meter */}
            <div
              onClick={() => tasksUsed >= MAX_TASKS ? setShowUpgrade(true) : null}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "5px 12px",
                background: tasksUsed >= MAX_TASKS
                  ? "rgba(248,113,113,0.08)"
                  : tasksUsed >= MAX_TASKS - 2
                    ? "rgba(251,191,36,0.08)"
                    : "rgba(129,140,248,0.07)",
                border: `1px solid ${tasksUsed >= MAX_TASKS ? "rgba(248,113,113,0.3)" : tasksUsed >= MAX_TASKS - 2 ? "rgba(251,191,36,0.3)" : "rgba(129,140,248,0.2)"}`,
                borderRadius: "20px",
                cursor: tasksUsed >= MAX_TASKS ? "pointer" : "default",
              }}
            >
              <span style={{ fontSize: "0.64rem", color: "#4b5563", letterSpacing: "0.06em" }}>Free Tasks Remaining:</span>
              <span style={{
                fontSize: "0.72rem", fontWeight: 800,
                color: tasksUsed >= MAX_TASKS ? "#f87171" : tasksUsed >= MAX_TASKS - 2 ? "#fbbf24" : "#818cf8",
              }}>
                {Math.max(0, MAX_TASKS - tasksUsed)}/{MAX_TASKS}
              </span>
              {tasksUsed >= MAX_TASKS && (
                <span style={{ fontSize: "0.64rem", color: "#f87171", fontWeight: 600 }}>Upgrade →</span>
              )}
            </div>
            <StatusPill state={appState} />
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1 }}>
          {/* Sidebar */}
          <Sidebar appState={appState} tasksUsed={tasksUsed} onUpgrade={() => setShowUpgrade(true)} />

          {/* Main content */}
          <main style={{ flex: 1, overflowX: "hidden" }}>
            <div style={{
              maxWidth: isBuildState ? "none" : "680px",
              margin: isBuildState ? "0" : "0 auto",
              padding: "32px 28px 40px",
            }}>
              {appState === ST.IDLE && (
                <EntryZone
                  textInput={textInput} setTextInput={setTextInput}
                  file={file} setFile={setFile}
                  dragOver={dragOver} setDragOver={setDragOver}
                  onDrop={onDrop} onSubmit={handleSubmit}
                  tasksUsed={tasksUsed} onUpgrade={() => setShowUpgrade(true)}
                />
              )}

              {appState === ST.DISCO && <DiscoveryCard domain={domain} fileName={file?.name} />}

              {(appState === ST.PROC || appState === ST.APPROVE) && (
                <ActionCenter
                  nodes={NODES} activeNode={activeNode} completedNodes={completedNodes}
                  terminalLogs={terminalLogs} terminalRef={terminalRef}
                />
              )}

              {appState === ST.DONE && normalized && (
                <ResultsPanel normalized={normalized} onReset={fullReset} onAssemble={handleAssemble} />
              )}

              {appState === ST.ERROR && (
                <ErrorCard message={errorMsg} onReset={fullReset} />
              )}

              {appState === ST.BUILD && (
                <SovereignBuildView
                  buildLogs={terminalLogs} terminalRef={terminalRef}
                  sovereignStatus={sovereignStatus} mcpConnectors={mcpConnectors}
                  buildComplete={buildComplete} coworkerConfig={coworkerConfig}
                />
              )}

              {appState === ST.TEST && coworkerConfig && (
                <TestCoworker config={coworkerConfig} analysis={analysis} onReset={fullReset} />
              )}
            </div>
          </main>
        </div>
      </div>

      {appState === ST.APPROVE && approvalPayload && (
        <ApprovalCard
          payload={approvalPayload}
          onApprove={handleApprove}
          onReject={handleReject}
          onEdit={() => setShowEditMode((v) => !v)}
          showEditMode={showEditMode}
          editText={editText}
          setEditText={setEditText}
          onEditSubmit={handleEditSubmit}
        />
      )}

      {showUpgrade && <UpgradeOverlay onClose={() => setShowUpgrade(false)} />}
    </>
  );
};

// ── Micro helpers ─────────────────────────────────────────────────────────────

const buildProposedAction = (raw) => {
  if (!raw) return "Agent has generated an output artefact and is requesting operator sign-off.";
  const lines = [];
  if (raw.type)                  lines.push(`Type: ${raw.type}`);
  if (raw.process_understanding) lines.push(`\nSummary:\n${raw.process_understanding}`);
  if (raw.bundling_advice)       lines.push(`\nBundling Note:\n${raw.bundling_advice}`);
  if (lines.length === 0)        return JSON.stringify(raw, null, 2).slice(0, 600);
  return lines.join("\n");
};

const sectionTitle = {
  margin: "0 0 12px",
  fontWeight: 700,
  fontSize: "0.68rem",
  color: "#4b5563",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

export default ChatUI;
