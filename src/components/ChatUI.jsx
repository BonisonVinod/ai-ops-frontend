import { useState, useEffect, useRef } from "react";

const RISK_CONFIG = {
  High:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  Medium: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  Low:    { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
};

const ChatUI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const handleSend = async () => {
    if (!input && !file) return;
    setLoading(true);
    const sopText = input || (file ? await file.text() : "");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sopText }),
      });
      const data = await res.json();
      setAnalysis(data.analysis);
      setMessages(prev => [
        ...prev,
        { sender: "user", text: input || `File: ${file?.name}` },
        { sender: "ai", text: "Analysis complete." },
      ]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setInput("");
    setFile(null);
  };

  const risk = analysis ? RISK_CONFIG[analysis.error_sensitivity] ?? RISK_CONFIG.Medium : null;

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: "20px" }}>Agentic Mind: Workforce Augmentation</h2>

      {/* Chat history */}
      <div style={chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === "user" ? "right" : "left", margin: "10px 0" }}>
            <span style={msg.sender === "user" ? userBubble : aiBubble}>{msg.text}</span>
          </div>
        ))}
        {loading && <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Analyzing...</p>}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Paste Job Description or SOP..."
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
        />
        <div style={fileUploadArea}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        </div>
        <button onClick={handleSend} disabled={loading} style={primaryBtn}>
          {loading ? "Analyzing..." : "Generate Business Case"}
        </button>
      </div>

      {/* Results dashboard */}
      {analysis && (
        <div style={dashboardCard}>

          {/* Header row: title + Risk badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ color: "#0f172a", margin: 0 }}>{analysis.type} Analysis</h3>
            <span style={{
              background: risk.bg, color: risk.color,
              border: `1px solid ${risk.border}`,
              padding: "4px 14px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "700",
            }}>
              {analysis.error_sensitivity} Risk
            </span>
          </div>

          {/* Human sign-off banner */}
          {analysis.human_approval_required && (
            <div style={signOffBanner}>
              <b>Action Required: Human Sign-off</b>
              <span style={{ fontWeight: 400, marginLeft: "8px" }}>
                All final outputs require human review before execution.
              </span>
            </div>
          )}

          {/* Efficiency KPIs */}
          <div style={statsGrid}>
            <div style={statItem}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.8rem", color: "#007bff" }}>
                {analysis.business_metrics.score}%
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Efficiency Gain</p>
            </div>
            <div style={statItem}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.4rem", color: "#0f172a" }}>
                {analysis.business_metrics.effort_level}
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Timeline</p>
            </div>
            <div style={statItem}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", color: "#166534" }}>
                {analysis.business_metrics.verdict}
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Verdict</p>
            </div>
          </div>

          {/* ROI & Pricing */}
          <div style={sectionCard}>
            <p style={sectionTitle}>ROI &amp; Pricing</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={priceItem}>
                <p style={priceLabel}>One-Time Setup Fee</p>
                <p style={priceValue}>{analysis.business_metrics.one_time_setup}</p>
                <p style={priceNote}>20% of annual CTC equivalent</p>
              </div>
              <div style={priceItem}>
                <p style={priceLabel}>Monthly Subscription</p>
                <p style={priceValue}>{analysis.business_metrics.monthly_subscription}</p>
                <p style={priceNote}>Standard / Pro / Enterprise tiers</p>
              </div>
            </div>
          </div>

          {/* Tech Blueprint */}
          <div style={sectionCard}>
            <p style={sectionTitle}>Tech Blueprint</p>

            {analysis.agent_skills?.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <p style={{ margin: "0 0 8px 0", fontSize: "0.8rem", color: "#64748b" }}>Required AI Skills</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {analysis.agent_skills.map((s, i) => (
                    <span key={i} style={skillTag}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {analysis.technical_feasibility != null && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#64748b", marginBottom: "6px" }}>
                  <span>Technical Feasibility</span>
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>{analysis.technical_feasibility}%</span>
                </div>
                <div style={meterTrack}>
                  <div style={{
                    ...meterFill,
                    width: `${analysis.technical_feasibility}%`,
                    background: analysis.technical_feasibility >= 70 ? "#22c55e" : analysis.technical_feasibility >= 40 ? "#f59e0b" : "#ef4444",
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Bundling advice */}
          {analysis.bundling_advice && (
            <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", color: "#475569" }}>
              <b>Bundling Advice:</b> {analysis.bundling_advice}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// --- STYLES ---
const chatBox = { height: "180px", overflowY: "auto", background: "#f8fafc", padding: "15px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #e2e8f0" };
const userBubble = { background: "#007bff", color: "white", padding: "8px 14px", borderRadius: "15px", display: "inline-block" };
const aiBubble = { background: "#fff", border: "1px solid #e2e8f0", padding: "8px 14px", borderRadius: "15px", display: "inline-block" };
const fileUploadArea = { background: "#fff", padding: "10px", borderRadius: "8px", border: "1px dashed #cbd5e1" };
const primaryBtn = { width: "100%", padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.95rem" };
const dashboardCard = { padding: "25px", borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: "16px" };
const signOffBanner = { padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", color: "#92400e", fontSize: "0.875rem" };
const statsGrid = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" };
const statItem = { background: "#f8fafc", padding: "16px", borderRadius: "8px", textAlign: "center" };
const sectionCard = { padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" };
const sectionTitle = { margin: "0 0 12px 0", fontWeight: "700", fontSize: "0.875rem", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" };
const priceItem = { background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" };
const priceLabel = { margin: "0 0 4px 0", fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const priceValue = { margin: "0 0 2px 0", fontSize: "1.2rem", fontWeight: "700", color: "#0f172a" };
const priceNote = { margin: 0, fontSize: "0.75rem", color: "#94a3b8" };
const skillTag = { background: "#fff", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", color: "#475569", border: "1px solid #e2e8f0" };
const meterTrack = { height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" };
const meterFill = { height: "100%", borderRadius: "4px", transition: "width 0.6s ease" };

export default ChatUI;
