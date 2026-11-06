// Task 47 smoke — live consensus run through the real engine
import { runConsensus, getConsensusStatus } from "@/lib/ai/consensus";

async function main() {
  console.log("=== LIVE consensus smoke test (3 voters, field-majority) ===");
  const con = await runConsensus<Record<string, unknown>>({
    taskType: "adhoc",
    system:
      'You are a math cross-checker. Answer ONLY with JSON {"answer": string, "confidence": "high|medium|low", "caveat": string}.',
    user: "What is 17 * 23? Also state whether 291 is prime. Answer in the JSON fields.",
    mode: "field-majority",
    voters: 3,
    maxTokens: 300,
    temperature: 0.1,
  });
  console.log("status:", con.status, "| voters:", con.votersOk + "/" + con.votersAsked, "| agreement:", con.agreement);
  console.log("result:", JSON.stringify(con.result, null, 2));
  for (const v of con.votes) {
    console.log(`  vote ${v.provider}/${v.model} (${v.role}) ok=${v.ok} parsed=${v.parsed} ${v.latencyMs}ms${v.error ? " err=" + v.error.slice(0, 80) : ""}${v.fieldAgreement !== undefined ? " agree=" + v.fieldAgreement.toFixed(2) : ""}`);
  }
  console.log("runId:", con.runId);

  console.log("\n=== status view ===");
  const st = await getConsensusStatus();
  console.log("providers:", st.providers.map((p) => `${p.provider}:${p.keyPresent ? "key✅" : "key❌"}`).join(" "));
  console.log("roster size:", st.roster.length, "| catalog:", JSON.stringify(st.catalog));
  console.log("recent runs:", st.recentRuns.length ? st.recentRuns.map((r) => `${r.taskType}:${r.status}`).join(", ") : "(none before this smoke)");
}
main();
