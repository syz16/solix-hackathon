# FalsifyRx

FalsifyRx pressure-tests drug-repurposing hypotheses. Give it a drug, a disease, and a proposed mechanism, and it searches the literature (via Europe PMC), classifies the retrieved evidence as supporting, challenging, or neutral, maps out where the hypothesis is weakest, and recommends the single experiment most likely to falsify it.

This is research support, not medical advice.

## How it works

1. **Input** — enter a drug, disease, and (optionally) a proposed mechanism.
2. **Investigate** — the backend queries Europe PMC for the drug–disease pair, deduplicates results, and sends the retrieved abstracts to Claude for extraction and classification.
3. **Explore** — a knowledge graph links the drug/disease to extracted claims and the papers that support or challenge each one; an evidence split and uncertainty grid summarize what's known and unknown.
4. **Verdict** — a final call (challenged / not challenged / insufficient evidence), the strongest challenge to the hypothesis, its untested assumptions, and one concrete recommended next experiment with branching predicted outcomes.

If the backend is unreachable, the frontend falls back to a labeled sample dataset so the UI remains demoable offline.

## Prerequisites

Before getting started, install:

- [Node.js](https://nodejs.org/) (version 20 or later)
- npm (included with Node.js)
- An [Anthropic API key](https://platform.claude.com/)

**Note:** Anthropic API usage may incur charges. Each developer should configure their own API key. Europe PMC's REST API is free and requires no key.

## Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd solix-hackathon
```

### 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and add your own Anthropic API key:

```env
ANTHROPIC_API_KEY=your_actual_api_key_here
PORT=3001
```

Never commit your `.env` file or share your API key publicly.

### 3. Configure the frontend

```bash
cd frontend
npm install
```

### 4. Start the backend

```bash
cd backend
npm start
```

The backend should start at `http://localhost:3001`.

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Troubleshooting

- **Missing API key:** Make sure `backend/.env` exists and contains a valid API key.
- **Authentication error:** Check that your API key is correct and your Anthropic account has API access and billing configured.
- **Sample data tag always showing:** The backend is unreachable, returned an error, or Europe PMC returned no abstracts for the pair you entered — the frontend falls back to the sample dataset.
- **Model error:** Check that the model ID configured in `backend/analyze.js` is supported by your Anthropic API account.
- **Missing dependencies:** Run `npm install` inside the relevant `backend` or `frontend` directory.

## Project Structure

```text
solix-hackathon/
├── README.md
├── backend/
│   ├── server.js        # Express app: /api/analyze, /api/chat
│   ├── analyze.js        # Pipeline: search -> dedupe -> extract -> compare -> recommend
│   ├── europepmc.js       # Europe PMC REST client
│   ├── package.json
│   ├── .env.example
│   └── .env
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js              # Calls POST /api/analyze; falls back to sample data
    │   ├── data/analysis.js     # Sample fixture used for offline demo + stage labels
    │   └── components/          # HypothesisForm, KnowledgeGraph, Verdict, etc.
    ├── package.json
    └── index.html
```

## Tech Stack

- React, Vite, Framer Motion
- Node.js, Express
- Anthropic Claude API (evidence extraction, classification, verdict generation)
- Europe PMC REST API (literature search)

## Security

API keys must remain in the backend environment and must never be exposed in frontend code or committed to version control.

This project is intended as a development prototype. Additional security measures are needed before deploying it publicly.
