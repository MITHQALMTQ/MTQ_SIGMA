// POST /api/ai/screen
//
// Body: { text: string } (max 5000 chars).
// Returns named entities (PER/ORG/LOC/MISC) extracted by the Hugging Face
// Inference API + dbmdz/bert-large-cased-finetuned-conll03-english NER model
// (server-side). Output is labelled "AI-generated, informational only — not a
// substitute for OFAC/EU/UN sanctions list checks."
//
// This route is the ONLY /api/ai/* route that adds CORS headers
// (Access-Control-Allow-Origin: *) — it may be called from external screening
// tools. The other three are same-origin.
//
// If AI_SCREEN_ENABLED=false → HTTP 503 { model: "disabled" }.
// If HF errors / no key / cold-start → returns regex-fallback entities
// (model: "fallback-regex").

import { NextResponse } from "next/server";
import { screenText } from "@/lib/ai/sanctions-screen";
import { AI_SCREEN_ENABLED } from "@/lib/ai/keys";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!AI_SCREEN_ENABLED) {
    return NextResponse.json(
      { error: "AI feature disabled", model: "disabled" },
      { status: 503, headers: CORS_HEADERS },
    );
  }
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const text = typeof body?.text === "string" ? body.text : "";
    const result = await screenText(text);
    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), model: "error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
