import { useState, useEffect, useRef } from "react";

const ChatUI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [llmChoice, setLlmChoice] = useState("prepaid");
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const handleSend = async () => {
    if (!input && !file) return;
    setLoading(true);
    let sopText = input || (file ? await file.text() : "");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sopText })
      });
      const data = await res.json();
      setAnalysis(data.analysis);
      setMessages([...messages, { sender: "user", text: input || `File: ${file?.name}` }, { sender: "ai", text: "Strategic Analysis Complete." }]);
    } catch (err) { console.error(err); }
    setLoading(false); setInput(""); setFile(null);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2>⚡ Agentic Mind: Workforce Augmentation</h2>

      <div style={chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === "user" ? "right" : "left", margin: "10px 0" }}>
            <span style={msg.sender === "user" ? userBubble : aiBubble}>{msg.text}</span>
          </div>
        ))}
        {loading && <p>🔍 Calculating ROI & Salary Benchmarks...</p>}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste JD or SOP..." style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }} />
        <div style={fileUploadArea}><input type="file" onChange={(e) => setFile(e.target.files[0])} /></div>
        <button onClick={handleSend} style={primaryBtn}>Generate Business Case</button>
      </div>

      {analysis && (
        <div style={dashboardCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ color: "#007bff", margin: 0 }}>📊 {analysis.type} Analysis</h3>
            <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold" }}>
              {analysis.business_metrics.verdict}
            </span>
          </div>

          {/* BUNDLING ADVICE (The Upsell) */}
          <div style={{ margin: "15px 0", padding: "12px", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", color: "#92400e", fontSize: "0.9rem" }}>
            💡 <b>Maxmize ROI:</b> {analysis.bundling_advice}
          </div>

          <div style={statsGrid}>
            <div style={statItem}><h3>{analysis.business_metrics.score}%</h3><p>Efficiency Gain</p></div>
            <div style={statItem}><h3>{analysis.business_metrics.one_time_setup}</h3><p>Setup Fee (20% ROI)</p></div>
            <div style={statItem}><h3>{analysis.business_metrics.effort_level}</h3><p>Timeline</p></div>
          </div>

          {analysis.agent_skills && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", fontSize: "0.9rem" }}>Digital Skills Covered:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {analysis.agent_skills.map((s, i) => <span key={i} style={skillTag}>{s}</span>)}
              </div>
            </div>
          )}

          <div style={billingSection}>
            <p><b>Monthly Subscription:</b> {analysis.business_metrics.monthly_subscription}</p>
            <p style={{ fontSize: "0.85rem", color: "#666" }}><b>LLM Credits:</b> {analysis.business_metrics.llm_option}</p>
          </div>

          <button onClick={() => window.alert("Initiating Deployment...")} style={deployBtn}>
            Deploy Digital Co-worker
          </button>
        </div>
      )}
    </div>
  );
};

// --- STYLES ---
const chatBox = { height: "180px", overflowY: "auto", background: "#f8fafc", padding: "15px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #e2e8f0" };
const userBubble = { background: "#007bff", color: "white", padding: "10px", borderRadius: "15px" };
const aiBubble = { background: "#fff", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "15px" };
const dashboardCard = { padding: "25px", borderRadius: "12px", background: "#fff", border: "1px solid #007bff", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" };
const statsGrid = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", margin: "15px 0" };
const statItem = { background: "#f8fafc", padding: "15px", borderRadius: "8px", textAlign: "center" };
const skillTag = { background: "#f1f5f9", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", color: "#475569", border: "1px solid #e2e8f0" };
const billingSection = { textAlign: "left", margin: "15px 0", borderTop: "1px solid #f1f5f9", paddingTop: "15px" };
const fileUploadArea = { background: "#fff", padding: "10px", borderRadius: "8px", border: "1px dashed #ccc", marginBottom: "10px" };
const primaryBtn = { width: "100%", padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deployBtn = { width: "100%", padding: "15px", background: "#0f172a", color: "white", border: "none", borderRadius: "8px", fontSize: "18px", fontWeight: "bold", cursor: "pointer" };

export default ChatUI;
