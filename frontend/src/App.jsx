import { useState } from 'react';
import './App.css';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e.preventDefault();

    const text = input.trim();
    if (!text || loading) return;

    const updatedMessages = [...messages, { role: 'user', content: text }];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: data.reply },
      ]);
    } catch (error) {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="chat">
      <header>
        <h1>Claude Chat</h1>
        <p>A simple AI chatbot prototype</p>
      </header>

      <section className="messages">
        {messages.length === 0 && (
          <p className="empty">Start a conversation with Claude.</p>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <strong>{message.role === 'user' ? 'You' : 'Claude'}</strong>
            <p>{message.content}</p>
          </div>
        ))}

        {loading && (
          <div className="message assistant">Claude is thinking...</div>
        )}
      </section>

      <form onSubmit={sendMessage}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Claude something..."
          disabled={loading}
        />
        <button disabled={loading || !input.trim()}>Send</button>
      </form>
    </main>
  );
}
