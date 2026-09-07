import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("force") === "1") {
    const { runAllTests } = await import("@/lib/mtq/monte-carlo");
    return NextResponse.json({ ...runAllTests(), cached: false });
  }
  try {
    if (!existsSync("src/lib/mtq/test-results.json")) return NextResponse.json({ error: "Run tests first" }, { status: 503 });
    return NextResponse.json({ ...JSON.parse(readFileSync("src/lib/mtq/test-results.json", "utf8")), cached: true });
  } catch (e: any) { return NextResponse.json({ error: e.message?.slice(0,200) }, { status: 500 }); }
}
