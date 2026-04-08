import { useState, useEffect, useRef } from "react";

const ChatUI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [originalSOP, setOriginalSOP] = useState("");

  const [architecture, setArchitecture] = useState([]);
  const [generatedCode, setGeneratedCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingCode, setLoadingCode] = useState(false);

  const [showPanel, setShowPanel] = useState(false);

  const chatEndRef = useRef(null);

  const loadingMessages = [
    "Understanding your process...",
    "Breaking into steps...",
    "Evaluating automation...",
    "Preparing recommendations..."
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, analysis, loading]);

  // -------------------------------
  // ANALYZE (RESTORED FULLY)
  // -------------------------------
  const handleSend = async () => {
    if (!input && !file) return;

    setLoading(true);
    setLoadingStep(0);

    setTimeout(() => setLoadingStep(1), 800);
    setTimeout(() => setLoadingStep(2), 1600);
    setTimeout(() => setLoadingStep(3), 2400);

    let sopText = input;

    if (file) {
      sopText = await file.text();
    }

    setOriginalSOP(sopText);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: sopText })
      });

      const data = await res.json();
      const parsed = JSON.parse(data.analysis);

      setAnalysis(parsed);

      setMessages((prev) => [
        ...prev,
        { sender: "user", text: input || file?.name },
        { sender: "ai", text: "Analysis ready ↓" }
      ]);

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
    setInput("");
    setFile(null);
  };

  // -------------------------------
  // START AUTOMATION
  // -------------------------------
  const handleStartAutomation = async () => {
    const mappedSteps = analysis.steps.map((s) => ({
      name: s.step,
      type:
        s.automation === "Automatable"
          ? "automatable"
          : s.automation === "Needs clarity"
          ? "needs_clarity"
          : "manual"
    }));

    const res = await fetch(`${import.meta.env.VITE_API_URL}/automation/start-automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: mappedSteps })
    });

    const data = await res.json();
    setArchitecture(data.architecture);
  };

  // -------------------------------
  // FULL SYSTEM CODE
  // -------------------------------
  const handleGenerateFullCode = async () => {
    setLoadingCode(true);
    setShowPanel(true);
    setGeneratedCode("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/codegen/generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          architecture: architecture,
	  steps: analysis.steps,
	  process: originalSOP
        })
      });

      const data = await res.json();
      setGeneratedCode(data.code);

    } catch (err) {
      console.error(err);
    }

    setLoadingCode(false);
  };

  return (
    <div style={{ display: "flex" }}>

      {/* MAIN UI */}
      <div style={{ flex: 1, padding: "20px" }}>
	<div style={{ display: "flex", justifyContent: "space-between" }}>
  <h2>⚡ AI Automation Consultant</h2>

  {generatedCode && (
    <button onClick={() => setShowPanel(true)}>
      📂 View Generated Code
    </button>
  )}
</div>        

        {/* CHAT */}
        <div style={chatBox}>
          {messages.map((msg, i) => (
            <div key={i} style={{ textAlign: msg.sender === "user" ? "right" : "left" }}>
              <span style={msg.sender === "user" ? userBubble : aiBubble}>
                {msg.text}
              </span>
            </div>
          ))}

          {loading && (
            <div>
              <span style={aiBubble}>
                🔄 {loadingMessages[loadingStep]}
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* INPUT (RESTORED FILE UPLOAD) */}
        <div style={{ display: "flex", gap: "10px" }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe SOP"
            style={{ flex: 1 }}
          />

          <button onClick={handleSend}>
            Analyze
          </button>
        </div>

        {/* ANALYSIS */}
        {analysis && (
          <>
            <button onClick={handleStartAutomation}>
              Start Automation
            </button>

            <button onClick={handleGenerateFullCode}>
              🚀 Generate Full System
            </button>

            <div style={card}>
              <h3>🧠 Summary</h3>
              <p>{analysis.process_understanding}</p>
            </div>

            <div style={card}>
              <h3>⚙️ Steps</h3>
              {analysis.steps?.map((s, i) => (
                <div key={i}>
                  <strong>{s.step}</strong> — {s.automation}
                </div>
              ))}
            </div>

            {/* ARCHITECTURE */}
            {architecture.length > 0 && (
              <div style={card}>
                <h3>🏗️ Architecture</h3>
                {architecture.map((c, i) => (
                  <div key={i}>
                    <b>{c.name}</b>
                    <p>{c.description}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* SIDE PANEL */}
      {showPanel && (
        <div style={{
          width: "40%",
          borderLeft: "1px solid #eee",
          padding: "15px",
          background: "#fafafa",
          overflowY: "auto"
        }}>
	  <div style={{ display: "flex", justifyContent: "space-between" }}>
  <h3>💻 Generated System</h3>
  <button onClick={() => setShowPanel(false)}>❌</button>
</div>          

          <h3>💻 Generated System</h3>

          {loadingCode ? (
            <p>⚡ Building full system...</p>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {generatedCode}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

// styles
const chatBox = {
  height: "250px",
  overflowY: "auto",
  border: "1px solid #eee",
  padding: "10px",
  borderRadius: "10px",
  marginBottom: "15px"
};

const userBubble = {
  background: "#007bff",
  color: "white",
  padding: "8px",
  borderRadius: "10px"
};

const aiBubble = {
  background: "#f1f1f1",
  padding: "8px",
  borderRadius: "10px"
};

const card = {
  border: "1px solid #eee",
  padding: "10px",
  marginTop: "10px"
};

export default ChatUI;
