import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

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

export async function POST(req: Request) {
  try {
    const { url, method = 'serpapi' } = await req.json();
    if (!url) return NextResponse.json({ detail: "No URL provided" }, { status: 400 });

    const vidId = extractYoutubeId(url);
    if (!vidId) return NextResponse.json({ detail: "Invalid YouTube URL" }, { status: 400 });

    const watchBase = `https://www.youtube.com/watch?v=${vidId}`;
    let transcriptData: any[] = [];

    if (method === 'api') {
      // Method: Use youtube-transcript (JS local API)
      console.log(`[API] Fetching transcript via Local API for: ${vidId}`);
      try {
        const res = await YoutubeTranscript.fetchTranscript(vidId);
        transcriptData = res.map((s: any) => ({
          text: (s.text || "").trim(),
          start_sec: Math.floor(Number(s.offset || 0) / 1000.0),
          // Actually, youtube-transcript offset is in milliseconds so division by 1000 is usually needed
          timestamp: secondsToTs(Number(s.offset || 0) / 1000.0),
          watch_url: `${watchBase}&t=${Math.floor(Number(s.offset || 0) / 1000.0)}`
        }));
      } catch (e: any) {
        console.error(`[Local API Error] ${e.message}`);
        return NextResponse.json({ detail: `Local API failed to fetch transcript! Error: ${e.message}` }, { status: 500 });
      }
    } else {
      // Method: Use SerpApi (Default)
      const serpKey = process.env.SERP_API_KEY;
      if (!serpKey) {
        return NextResponse.json({ detail: "Server error: No SerpApi key provided." }, { status: 500 });
      }

      console.log(`[SerpApi] Fetching transcript for: ${vidId}`);
      const serpUrl = `https://serpapi.com/search.json?engine=youtube_video_transcript&v=${vidId}&api_key=${serpKey}`;
      const serpRes = await fetch(serpUrl);
      const serpData = await serpRes.json();

      if (!serpData.transcript) {
        const errorMsg = serpData.error || "No transcript found";
        console.error(`[SerpApi Error] ${errorMsg}`);
        return NextResponse.json({ detail: `SerpApi failed to fetch transcript! Error: ${errorMsg}` }, { status: 500 });
      }

      transcriptData = serpData.transcript.map((s: any) => ({
        text: (s.snippet || "").trim(),
        start_sec: Math.floor(Number(s.start_ms || 0) / 1000.0),
        timestamp: secondsToTs(Number(s.start_ms || 0) / 1000.0),
        watch_url: `${watchBase}&t=${Math.floor(Number(s.start_ms || 0) / 1000.0)}`
      }));
    }

    return NextResponse.json({
      video_id: vidId,
      watch_url: watchBase,
      transcript: transcriptData,
      source: method === 'api' ? "local_api" : "serpapi"
    });
  } catch (err: any) {
    console.error("[General Error]", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
