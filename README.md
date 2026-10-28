# Claude Chatbot

A simple AI chatbot built with React, Vite, Node.js, Express, and Anthropic's Claude API.

## Features

- Chat with Claude through a web interface
- Maintain conversation context across messages
- Keep the Anthropic API key on the backend
- Simple local development setup

## Prerequisites

Before getting started, install:

- [Node.js](https://nodejs.org/) (version 20 or later)
- npm (included with Node.js)
- An [Anthropic API key](https://platform.claude.com/)

**Note:** Anthropic API usage may incur charges. Each developer should configure their own API key.

## Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd claude-chatbot
```

Replace `<YOUR_GITHUB_REPOSITORY_URL>` with the URL of this repository.

### 2. Configure the backend

Open a terminal in the project root and run:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory by copying the example:

```bash
cp .env.example .env
```

Open `backend/.env` and add your own Anthropic API key:

```env
ANTHROPIC_API_KEY=your_actual_api_key_here
PORT=3001
```

Never commit your `.env` file or share your API key publicly.

### 3. Configure the frontend

Open a second terminal in the project root and run:

```bash
cd frontend
npm install
```

### 4. Start the backend

In the first terminal:

```bash
cd backend
npm start
```

The backend should start at `http://localhost:3001`.

### 5. Start the frontend

In the second terminal:

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite, usually:

`http://localhost:5173`

You can now start chatting with Claude!

## Troubleshooting

- **Missing API key:** Make sure `backend/.env` exists and contains a valid API key.
- **Authentication error:** Check that your API key is correct and your Anthropic account has API access and billing configured.
- **Failed to fetch:** Make sure both the backend and frontend are running on their expected ports.
- **Model error:** Check that the model ID configured in `backend/server.js` is supported by your Anthropic API account.
- **Missing dependencies:** Run `npm install` inside the relevant `backend` or `frontend` directory.

## Project Structure

```text
claude-chatbot/
├── README.md
├── .gitignore
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── .env
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── App.css
    ├── package.json
    └── index.html
```

## Tech Stack

- React
- Vite
- Node.js
- Express
- Anthropic Claude API

## Security

API keys must remain in the backend environment and must never be exposed in frontend code or committed to version control.

This project is intended as a development prototype. Additional security measures are needed before deploying it publicly.
