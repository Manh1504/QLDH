import { NextRequest, NextResponse } from 'next/server';

// Proxy /api/* -> backend NestJS. API_INTERNAL_URL đọc lúc runtime
// (dev: http://localhost:8010, docker: http://api:8010) nên đổi đâu cũng không cần build lại web.
const TARGET = () => process.env.API_INTERNAL_URL || 'http://localhost:8010';

async function forward(req: NextRequest, path: string[]) {
  const url = `${TARGET()}/api/${path.join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  const init: RequestInit = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method)) {
    const buf = await req.arrayBuffer();
    init.body = buf;
  }
  const res = await fetch(url, init);
  const body = await res.arrayBuffer();
  const out = new Headers();
  const outCt = res.headers.get('content-type');
  if (outCt) out.set('content-type', outCt);
  return new NextResponse(body, { status: res.status, headers: out });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
