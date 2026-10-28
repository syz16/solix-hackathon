require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk').default;

const app = express();
const port = process.env.PORT || 3001;

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY in backend/.env');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 30 ||
      messages.some(
        (m) =>
          !m ||
          !['user', 'assistant'].includes(m.role) ||
          typeof m.content !== 'string' ||
          !m.content.trim() ||
          m.content.length > 10000,
      ) ||
      messages[messages.length - 1].role !== 'user'
    ) {
      return res.status(400).json({ error: 'Invalid messages.' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 800,
      messages: messages.map(({ role, content }) => ({
        role,
        content,
      })),
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ reply });
  } catch (error) {
    console.error('Claude API request failed:', error.message);
    res.status(500).json({
      error: "Sorry, I couldn't get a response. Please try again.",
    });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
