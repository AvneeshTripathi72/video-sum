"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [statusClass, setStatusClass] = useState("status");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Since we migrated everything to Next.js, the backend is now hosted on the exact same server!
  const API_BASE = "";

  const fmtRange = (start: number, end: number) => {
    const s = Number(start) || 0;
    const e = Number(end) || s;
    const f = (sec: number) => {
      const t = Math.floor(sec);
      const m = Math.floor(t / 60);
      const r = t % 60;
      return m + ":" + String(r).padStart(2, "0");
    };
    return f(s) + " – " + f(e);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Fetching transcript and generating insights…");
    setStatusClass("status");
    setResults(null);
    setLoading(true);

    try {
      const res = await fetch(API_BASE + "/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const rawText = await res.text();
      let data: any = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(
            rawText.slice(0, 240) ||
              "Server returned non-JSON. Is the API running?"
          );
        }
      }

      if (!res.ok) {
        const msg = data.detail ?? data.message ?? rawText?.slice(0, 240) ?? `HTTP ${res.status}`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      setResults(data);
      setStatus("Done.");
      setStatusClass("status ok");
    } catch (err: any) {
      setStatus("Error: " + err.message);
      setStatusClass("status err");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap border-box">
      <h1>From link to takeaways</h1>
      <p className="sub">
        Paste a YouTube link. The server pulls the transcript and summarizes the{" "}
        <strong>5 most useful Q&amp;As</strong> plus a <strong>timeline</strong>.{" "}
        No API keys are stored or shown here.
      </p>

      <form onSubmit={handleAnalyze} className="flex flex-col gap-3">
        <label htmlFor="url" className="text-[0.72rem] uppercase tracking-[0.12em] text-muted">YouTube URL</label>
        <input
          id="url"
          name="url"
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          autoComplete="off"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-4 rounded-[10px] border border-border bg-surface text-text font-sans text-base focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(61,214,198,0.15)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="self-start mt-1 px-5 py-3 border-none rounded-[10px] bg-gradient-to-br from-accent to-accent-dim text-[#041312] font-semibold text-[0.9rem] cursor-pointer transition hover:brightness-108 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none"
        >
          Analyze video
        </button>
      </form>
      <p className={statusClass} aria-live="polite">
        {status}
      </p>

      {/* The paragraph containing backend details was removed as requested. */}

      {results && (
        <section className="results show mt-10" aria-label="Results">
          <h2>Top 5 questions &amp; answers</h2>
          <div className="flex flex-col gap-4">
            {results.qa_pairs?.map((item: any, i: number) => (
              <article key={i} className="qa-card">
                <div className="font-semibold mb-2 text-base">
                  {i + 1}. {item.question}
                </div>
                <div className="text-muted text-[0.92rem] mb-2">{item.answer}</div>
                <div className="text-[0.8rem] text-muted">
                  Time: {item.timestamp || fmtRange(item.start_sec, item.end_sec)}{" "}
                  ·{" "}
                  <a href={item.watch_url} target="_blank" rel="noopener noreferrer">
                    Watch at this section
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-9">
            <h2>Timeline</h2>
            <div>
              {results.timeline?.map((row: any, i: number) => (
                <div key={i} className="tl-row">
                  <div className="tl-time text-warn font-semibold tabular-nums whitespace-nowrap">
                    {fmtRange(row.start_sec, row.end_sec)}
                  </div>
                  <div>
                    <div className="font-semibold mb-1">{row.label}</div>
                    <div className="text-muted text-[0.88rem]">{row.summary}</div>
                    <a
                      href={row.watch_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.8rem] text-accent mt-1 inline-block"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="mt-12 text-[0.75rem] text-muted">
        Answers are model-generated from the transcript; verify important claims
        against the video.
      </footer>
    </div>
  );
}
