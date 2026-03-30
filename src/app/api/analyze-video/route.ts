import { NextResponse } from 'next/server';

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
    const { url } = await req.json();
    if (!url) return NextResponse.json({ detail: "No URL provided" }, { status: 400 });

    const vidId = extractYoutubeId(url);
    if (!vidId) return NextResponse.json({ detail: "Invalid YouTube URL" }, { status: 400 });

    const serpKey = process.env.SERP_API_KEY;
    if (!serpKey) {
      return NextResponse.json({ detail: "Server error: No SerpApi key provided." }, { status: 500 });
    }

    // Fetch Transcript from SerpApi
    console.log(`[API] Fetching transcript for: ${vidId}`);
    const serpUrl = `https://serpapi.com/search.json?engine=youtube_video_transcript&v=${vidId}&api_key=${serpKey}`;
    const serpRes = await fetch(serpUrl);
    const serpData = await serpRes.json();

    if (!serpData.transcript) {
      const errorMsg = serpData.error || "No transcript found";
      console.error(`[SerpApi Error] ${errorMsg}`);
      return NextResponse.json({ detail: `Could not retrieve a transcript for the video via SerpApi! Error: ${errorMsg}` }, { status: 500 });
    }

    const watchBase = `https://www.youtube.com/watch?v=${vidId}`;
    const transcript = serpData.transcript.map((s: any) => ({
      text: (s.snippet || "").trim(),
      start_sec: Math.floor(Number(s.start_ms || 0) / 1000.0),
      timestamp: secondsToTs(Number(s.start_ms || 0) / 1000.0),
      watch_url: `${watchBase}&t=${Math.floor(Number(s.start_ms || 0) / 1000.0)}`
    }));

    return NextResponse.json({
      video_id: vidId,
      watch_url: watchBase,
      transcript: transcript,
      source: "serpapi_direct"
    });
  } catch (err: any) {
    console.error("[General Error]", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
