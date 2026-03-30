"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("serpapi"); // 'serpapi' or 'api'
  const [status, setStatus] = useState("");
  const [statusClass, setStatusClass] = useState("status");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const API_BASE = "";

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const methodLabel = method === 'serpapi' ? "SerpApi" : "Local API";
    setStatus(`Fetching transcript via ${methodLabel}…`);
    setStatusClass("status");
    setResults(null);
    setLoading(true);

    try {
      const res = await fetch(API_BASE + "/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method }),
      });

      const data: any = await res.json();

      if (!res.ok) {
        const msg = data.detail ?? data.message ?? `HTTP ${res.status}`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      setResults(data);
      setStatus(`Done! Fetched via ${data.source === 'local_api' ? 'Local API' : 'SerpApi'}.`);
      setStatusClass("status ok");
    } catch (err: any) {
      setStatus(`Error (${methodLabel}): ${err.message}`);
      setStatusClass("status err");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap border-box">
      <h1>YouTube Transcript Viewer</h1>
      <p className="sub">
        Choose a method and paste a YouTube link to pull the full transcript.
      </p>

      <div className="flex gap-4 mb-6 p-1 bg-surface-dim rounded-xl self-start">
        <button 
          onClick={() => setMethod("serpapi")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${method === 'serpapi' ? 'bg-accent text-[#041312] shadow-sm' : 'text-muted hover:text-text'}`}
        >
          SerpApi (Fast)
        </button>
        <button 
          onClick={() => setMethod("api")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${method === 'api' ? 'bg-accent text-[#041312] shadow-sm' : 'text-muted hover:text-text'}`}
        >
          Local API (Internal)
        </button>
      </div>

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
          {loading ? "Fetching..." : "Fetch Transcript"}
        </button>
      </form>
      <p className={statusClass} aria-live="polite">
        {status}
      </p>

      {results && results.transcript && (
        <section className="results show mt-10" aria-label="Transcript">
          <h2>Video Transcript ({results.source === 'local_api' ? 'Local API' : 'SerpApi'})</h2>
          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto p-4 rounded-[10px] border border-border bg-black/20">
            {results.transcript.length > 0 ? (
              results.transcript.map((item: any, i: number) => (
                <div key={i} className="flex gap-4 p-2 hover:bg-white/5 rounded transition text-[0.92rem]">
                  <a 
                    href={item.watch_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-accent font-mono shrink-0 w-[60px]"
                  >
                    [{item.timestamp}]
                  </a>
                  <span className="text-text">{item.text}</span>
                </div>
              ))
            ) : (
              <div className="p-4 text-muted">No transcript segments found.</div>
            )}
          </div>
          
          <div className="mt-4">
            <a 
              href={results.watch_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-muted underline decoration-accent/30 hover:text-accent transition"
            >
              Watch original video on YouTube
            </a>
          </div>
        </section>
      )}

      <footer className="mt-12 text-[0.75rem] text-muted">
        Transcripts can be pulled either via SerpApi or our internal Node.js wrapper.
      </footer>
    </div>
  );
}
