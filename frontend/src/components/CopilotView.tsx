import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Sparkles, RefreshCw } from 'lucide-react';
import { queryCopilot } from '../services/api';

type Message = { role: 'user' | 'ai'; text: string; timestamp: string; isError?: boolean };

const QUICK_PROMPTS = [
  "How's my spending this month?",
  "Which category am I overspending in?",
  "What are my recurring expenses?",
  "Show my top expense categories",
  "Am I on track with my savings goal?",
  "Detect any unusual transactions",
];

export default function CopilotView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: "Hi! 👋 I'm your AI financial copilot. I analyze your real transaction data to answer questions about your spending, budgets, and savings. What would you like to know?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(m => [...m, { role: 'user', text: q, timestamp: now }]);
    setInput('');
    setLoading(true);

    try {
      const res = await queryCopilot(q);
      const aiText = res.answer || res.response || res.message || res.detail
        || (typeof res === 'string' ? res : JSON.stringify(res, null, 2));

      setMessages(m => [...m, {
        role: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (e) {
      setMessages(m => [...m, {
        role: 'ai',
        text: "Sorry, I couldn't connect to the backend. Please make sure the API server is running at http://localhost:8000.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'ai',
      text: "Chat cleared! How can I help you analyze your finances?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={24} color="white" />
            </div>
            <div>
              <h1 className="page-greeting" style={{ marginBottom: 2 }}>AI Copilot 🤖</h1>
              <p className="page-subtitle">SQL-grounded financial intelligence powered by your real transaction data.</p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={clearChat}>
            <RefreshCw size={14} /> Clear Chat
          </button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {QUICK_PROMPTS.map(q => (
          <button key={q} onClick={() => send(q)} disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 99, border: '1px solid var(--border)',
              background: 'white', fontSize: 12.5, color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)', transition: 'all 0.15s', opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget).style.background = 'var(--bg-hover)'; (e.currentTarget).style.color = 'var(--text-primary)'; }}}
            onMouseLeave={e => { (e.currentTarget).style.background = 'white'; (e.currentTarget).style.color = 'var(--text-secondary)'; }}
          >
            <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
            {q}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="copilot-chat-container">
        <div className="copilot-messages">
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === 'ai' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: m.isError ? '#fef2f2' : 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={12} color="white" />
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>AI Copilot</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{m.timestamp}</span>
                </div>
              )}
              <div className="chat-bubble"
                style={{ whiteSpace: 'pre-wrap', background: m.isError ? '#fef2f2' : undefined, borderColor: m.isError ? '#fecaca' : undefined }}>
                {m.text}
              </div>
              {m.role === 'user' && (
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>{m.timestamp}</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-msg ai">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={12} color="white" />
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>AI Copilot</span>
              </div>
              <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" />
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Querying your financial data...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="copilot-input-bar">
          <input
            className="copilot-input"
            placeholder="Ask about your finances... (Press Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
            disabled={loading}
          />
          <button className="copilot-send-btn" onClick={() => send()} disabled={!input.trim() || loading}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
