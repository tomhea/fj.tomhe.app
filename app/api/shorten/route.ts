import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Proxy POST /api/shorten → spoo.me to avoid CORS restrictions in the browser. */
export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = (await req.json()) as { url?: unknown };
    if (typeof body.url !== 'string' || !body.url.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    url = body.url;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const res = await fetch('https://spoo.me/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url }),
    });

    const data = await res.json() as { short_url?: string; error?: string };

    if (!res.ok || !data.short_url) {
      return NextResponse.json(
        { error: data.error ?? `spoo.me returned ${res.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ short_url: data.short_url });
  } catch (err) {
    console.error('shorten proxy error:', err);
    return NextResponse.json({ error: 'Failed to reach spoo.me' }, { status: 502 });
  }
}
