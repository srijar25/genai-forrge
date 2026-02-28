import React, { useState, useEffect, useRef } from "react";
import { chatAPI } from "../services/api";
import { Send, Plus, MessageCircle, Bot, User } from "lucide-react";
import toast from "react-hot-toast";

function PhotoResultsRow({ photos }) {
  if (!photos?.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      {photos.map(photo => (
        <img
          key={photo.id}
          src={photo.thumbnail}
          alt={photo.original_filename}
          style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 6, border: "1px solid var(--surface1)" }}
          onError={e => { e.target.src = `https://via.placeholder.com/70x70/313244/cdd6f4?text=📷`; }}
        />
      ))}
    </div>
  );
}

function Message({ msg, photos }) {
  const isUser = msg.role === "user";
  return (
    <div className={`chat-message ${isUser ? "user" : "assistant"}`}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: isUser ? "var(--accent)" : "var(--surface0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flex: "0 0 28px",
      }}>
        {isUser ? <User size={14} style={{ color: "var(--mantle)" }} /> : <Bot size={14} style={{ color: "var(--accent)" }} />}
      </div>
      <div>
        <div className="message-bubble">{msg.content}</div>
        {photos && <PhotoResultsRow photos={photos} />}
        {msg.action_type && msg.action_type !== "NONE" && (
          <div style={{ marginTop: 6 }}>
            <span className="badge badge-info">{msg.action_type}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Show me all photos from this month",
  "Find photos of my family",
  "Show photos with more than 2 people",
  "How many photos do I have?",
];

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [photoMap, setPhotoMap] = useState({}); // sessionMsgId -> photos
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    chatAPI.getSessions().then(res => {
      setSessions(res.data.sessions);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createSession = async () => {
    const res = await chatAPI.createSession();
    const id = res.data.session_id;
    setActiveSession(id);
    setMessages([]);
    setSessions(prev => [{ id, title: "New Chat", message_count: 0, updated_at: new Date().toISOString() }, ...prev]);
  };

  const loadSession = async (sessionId) => {
    setActiveSession(sessionId);
    try {
      const res = await chatAPI.getMessages(sessionId);
      setMessages(res.data.messages);
    } catch {
      setMessages([]);
    }
  };

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim() || sending) return;
    if (!activeSession) {
      await createSession();
      return; // Session creation will re-render; user can resend
    }

    setInput("");
    setSending(true);

    const tempUser = { id: Date.now(), role: "user", content: msg };
    setMessages(prev => [...prev, tempUser]);

    try {
      const res = await chatAPI.sendMessage(activeSession, msg);
      const assistantMsg = res.data.message;
      const photos = res.data.photos || [];

      setMessages(prev => [...prev, assistantMsg]);
      if (photos.length) {
        setPhotoMap(prev => ({ ...prev, [assistantMsg.id]: photos }));
      }

      // Update session list
      setSessions(prev => prev.map(s => s.id === activeSession
        ? { ...s, title: msg.slice(0, 60), message_count: s.message_count + 2 }
        : s
      ));
    } catch (err) {
      toast.error("Failed to send message");
      setMessages(prev => prev.filter(m => m.id !== tempUser.id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-layout" style={{ height: "calc(100vh)" }}>
      {/* Session Sidebar */}
      <div className="chat-sidebar">
        <div style={{ padding: "16px 12px", borderBottom: "1px solid var(--surface0)" }}>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={createSession}>
            <Plus size={13} /> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          {sessions.map(session => (
            <div
              key={session.id}
              className={`nav-item ${activeSession === session.id ? "active" : ""}`}
              onClick={() => loadSession(session.id)}
            >
              <MessageCircle size={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {session.title}
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", color: "var(--overlay0)", fontSize: 12 }}>
              No chats yet
            </div>
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div className="chat-main">
        {!activeSession ? (
          /* Welcome Screen */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, padding: 40 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>AI Photo Assistant</h2>
              <p style={{ color: "var(--overlay0)", fontSize: 14, maxWidth: 400 }}>
                Ask me anything about your photos. I can search, filter, and help you share memories.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 500, width: "100%" }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="card"
                  style={{ textAlign: "left", cursor: "pointer", fontSize: 12, color: "var(--subtext0)", border: "1px solid var(--surface0)" }}
                  onClick={async () => { await createSession(); sendMessage(s); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--overlay0)", fontSize: 13, padding: 32 }}>
                  Start the conversation...
                </div>
              )}
              {messages.map(msg => (
                <Message key={msg.id} msg={msg} photos={photoMap[msg.id]} />
              ))}
              {sending && (
                <div className="chat-message assistant">
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={14} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="message-bubble" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span className="pulse">●</span>
                    <span className="pulse" style={{ animationDelay: "0.2s" }}>●</span>
                    <span className="pulse" style={{ animationDelay: "0.4s" }}>●</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <input
                className="chat-input"
                placeholder='Try "Show photos of Priya from last month"'
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <button
                className="btn btn-primary"
                style={{ borderRadius: "50%", width: 42, height: 42, padding: 0, justifyContent: "center" }}
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
              >
                <Send size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
