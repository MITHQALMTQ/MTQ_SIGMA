const raw = await new Promise<string>((r) => {
  let s = "";
  process.stdin.on("data", (c) => (s += c)).on("end", () => r(s));
});
const d = JSON.parse(raw.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"'));
for (const s of d) {
  if (s.error) { console.log(`${s.section} ERROR ${s.error}`); continue; }
  console.log(
    `${s.section.padEnd(20)} checked=${String(s.checked).padEnd(5)} flagged=${String(s.flagged).padEnd(4)} tiny<9px=${String(s.tiny).padEnd(4)} worst=${s.worst ?? "-"}`
  );
  if (s.samples) for (const f of s.samples.slice(0, 4)) {
    console.log(`    [${f.ratio}] ${String(f.fs).padStart(5)}px ${f.tag} "${f.text}" ${f.color}`);
  }
}
