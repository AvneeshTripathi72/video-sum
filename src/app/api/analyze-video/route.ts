import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const MAX_TRANSCRIPT_CHARS = 190000;
const YOUTUBE_ID_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;

function extractYoutubeId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_RE);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  return null;
}

function secondsToTs(s: number): string {
  const t = Math.floor(s);
  const m = Math.floor(t / 60);
  const r = t % 60;
  return m + ':' + String(r).padStart(2, '0');
}

function getTopContentWords(text: string, n = 25): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "as", "is",
    "was", "are", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "shall", "can", "need", "that", "this",
    "these", "those", "it", "its", "with", "from", "by", "not", "no", "so", "if", "we", "you",
    "they", "he", "she", "i", "our", "your", "their", "what", "which", "who", "when", "where",
    "why", "how", "all", "each", "every", "both", "than", "then", "just", "also", "only", "very",
    "into", "about", "like", "get", "got", "one", "two", "some", "such", "there", "here", "more",
    "most", "other", "any", "same"
  ]);
  const words = (text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []).filter(w => !stop.has(w));
  const counts: Record<string, number> = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(x => x[0])
    .slice(0, n);
}

function buildAnalysisPrompt(vidId: string, transcriptBlock: string, frequentTerms: string[]) {
  return `You are a learning assistant. Given a YouTube video transcript, each line format:
[mm:ss | SECONDS] text

Video ID (for links): ${vidId}

Frequent substantive words (for coverage of main themes): ${frequentTerms.join(", ")}

Transcript:
${transcriptBlock}

Tasks:
1) Propose exactly 5 question–answer pairs that reflect the most important, recurring, or practically useful ideas in THIS video (not generic ML trivia). Answers must be faithful to the transcript.
2) For each Q&A, set start_sec and end_sec as integers (seconds) spanning the main passage that supports the answer (use the SECONDS values from lines).
3) Build a chronological timeline with 6–12 entries: each has start_sec, end_sec, label (short), summary (one line).

Return ONLY valid JSON with this structure (no markdown, no code fences):
{"video_id":"${vidId}","qa_pairs":[{"question":"...","answer":"...","start_sec":0,"end_sec":0,"timestamp":"m:ss – m:ss"}],"timeline":[{"start_sec":0,"end_sec":0,"label":"...","summary":"..."}]}
`;
}

function finalizeResult(data: any, vidId: string, frequentTerms: string[], source: string) {
  const qa = Array.isArray(data.qa_pairs) ? data.qa_pairs : [];
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const watchBase = `https://www.youtube.com/watch?v=${vidId}`;

  for (const item of qa) {
    const s = Math.floor(Number(item.start_sec) || 0);
    item.watch_url = `${watchBase}&t=${s}`;
  }
  for (const row of timeline) {
    const s = Math.floor(Number(row.start_sec) || 0);
    row.watch_url = `${watchBase}&t=${s}`;
  }

  return {
    video_id: data.video_id || vidId,
    watch_url: watchBase,
    qa_pairs: qa.slice(0, 5),
    timeline: timeline,
    frequent_terms_sample: frequentTerms.slice(0, 15),
    source: source
  };
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ detail: "No URL provided" }, { status: 400 });

    const vidId = extractYoutubeId(url);
    if (!vidId) return NextResponse.json({ detail: "Invalid YouTube URL" }, { status: 400 });

    const serpKey = process.env.SERP_API_KEY || "50793bbdbbd26bba2fbdc1b09ab861005e5f8da8b4ff09d8ba46bedc48b9b9ba";
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return NextResponse.json({ detail: "Server error: No AI API key provided for processing." }, { status: 500 });
    }

    // 1. Fetch Transcript from SerpApi
    const serpUrl = `https://serpapi.com/search.json?engine=youtube_video_transcript&v=${vidId}&api_key=${serpKey}`;
    const serpRes = await fetch(serpUrl);
    const serpData = await serpRes.json();

    if (!serpData.transcript) {
      const errorMsg = serpData.error || "No transcript found";
      return NextResponse.json({ detail: `Could not retrieve a transcript for the video via SerpApi! Error: ${errorMsg}` }, { status: 500 });
    }

    const segments = serpData.transcript.map((s: any) => ({
      text: (s.snippet || "").trim(),
      start: Number(s.start_ms || 0) / 1000.0,
      duration: (Number(s.end_ms || 0) - Number(s.start_ms || 0)) / 1000.0
    }));

    const lines = segments.map((seg: any) => `[${secondsToTs(seg.start)} | ${Math.floor(seg.start)}s] ${seg.text}`);
    let transcriptBlock = lines.join("\n");
    if (transcriptBlock.length > MAX_TRANSCRIPT_CHARS) {
      transcriptBlock = transcriptBlock.slice(0, MAX_TRANSCRIPT_CHARS) + "\n[... transcript truncated ...]";
    }

    const flat = segments.map((s: any) => s.text).join(" ");
    const frequentTerms = getTopContentWords(flat);
    const prompt = buildAnalysisPrompt(vidId, transcriptBlock, frequentTerms);

    // 2. Try Groq
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: "You reply with only a single JSON object matching the user's schema. No markdown." },
            { role: "user", content: prompt }
          ],
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 8192
        });

        let raw = completion.choices[0]?.message?.content || "";
        raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
        const data = JSON.parse(raw);
        return NextResponse.json(finalizeResult(data, vidId, frequentTerms, "groq"));
      } catch (e: any) {
        console.error("Groq fallback", e);
      }
    }

    // 3. Try Gemini
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        let raw = result.response.text() || "";
        raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
        const data = JSON.parse(raw);
        return NextResponse.json(finalizeResult(data, vidId, frequentTerms, "gemini"));
      } catch (e: any) {
        console.error("Gemini fallback", e);
      }
    }

    return NextResponse.json({ detail: "AI processing failed. Please check logs." }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
