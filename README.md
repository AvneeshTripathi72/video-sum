# RAG Eval — Next.js Edition

A full-stack Next.js application that analyzes YouTube videos to summarize the 5 most useful Q&As and generate a comprehensive timeline.

Built exclusively with **Next.js (App Router)** and integrates directly with **Gemini / Groq + SERP API**.

## 🛠 Setup

1. **Install dependencies:**
   ```powershell
   cd frontend
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env.local` file in the root of the project with the following keys:
   - `SERP_API_KEY` (Required for transcripts)
   - `GROQ_API_KEY` (Required for fast summarization)
   - `GEMINI_API_KEY` (Optional fallback for Groq summarization)
   - `GROQ_MODEL` (Optional, defaults to `llama-3.3-70b-versatile`)

3. **Run the local development server:**
   ```powershell
   npm run dev
   ```
   Open `http://localhost:3000` inside your browser.

## 🚀 Deployment (Vercel)

Ensure all variables exist within Vercel's Environment Variables panel before deploying. Because this app is now structured entirely via Next.js App Router, you can easily deploy it by bridging it to **Vercel** with zero extra config!

No Python background service is required anymore!
