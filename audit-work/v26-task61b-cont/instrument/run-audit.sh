#!/bin/bash
# MTQΣ Task 61b continuation — full 27-section + landing WCAG audit driver (v3)
# v3: scroll-stepped incremental auditing (reveal animations need content in
#     view); inner scroll containers also swept; section switch verified via
#     aria-current; results double-parsed (eval prints JSON-quoted strings).
set -u
cd /home/z/my-project
RUN="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"
OUT="audit-work/v26-task61b-cont/audit-runs/$RUN"
mkdir -p "$OUT"
INSTRUMENT="audit-work/v26-task61b-cont/instrument/wcag-auditor.js"
STEPWAIT=0.4

echo "== opening app =="
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
sleep 2

echo "== entering PCC =="
agent-browser eval "var b=document.querySelector('button[aria-label=\"Launch the MTQΣ Pilot Command Center (testnet pilot terminal)\"]'); if(b){b.click();'entered'}else{document.querySelector('.mtqs-sidebar')?'already':'MISS-launch'}"
sleep 4

audit_view () {
  # $1 = label for results; scrolls through the page + inner panes,
  # running the incremental auditor at every step, then finalizes.
  agent-browser eval "window.__mtqsAudit=null; window.__mtqsAuditFinal=false; 'reset'" >/dev/null 2>&1
  agent-browser eval "window.scrollTo(0,0); 'top'" >/dev/null 2>&1
  sleep 0.6
  N=$(agent-browser eval "Math.max(1, Math.ceil((document.documentElement.scrollHeight - innerHeight) / (innerHeight * 0.6)))" 2>/dev/null | tr -d '"')
  for ((i=0; i<=N; i++)); do
    agent-browser eval "window.scrollTo(0, Math.min($i * innerHeight * 0.6, document.documentElement.scrollHeight)); 's$i'" >/dev/null 2>&1
    sleep $STEPWAIT
    agent-browser eval "$(cat "$INSTRUMENT")" >/dev/null 2>&1
  done
  # inner scroll panes (overflow-y-auto lists etc.)
  agent-browser eval "(() => { for (const el of document.querySelectorAll('*')) { const c = getComputedStyle(el); if ((c.overflowY==='auto'||c.overflowY==='scroll') && el.scrollHeight > el.clientHeight + 40 && el.clientHeight > 100) { el.scrollTop = el.scrollHeight; } } return 'inner-bottom'; })()" >/dev/null 2>&1
  sleep 0.4
  agent-browser eval "$(cat "$INSTRUMENT")" >/dev/null 2>&1
  agent-browser eval "(() => { for (const el of document.querySelectorAll('*')) { const c = getComputedStyle(el); if ((c.overflowY==='auto'||c.overflowY==='scroll') && el.scrollHeight > el.clientHeight + 40 && el.clientHeight > 100) { el.scrollTop = 0; } } return 'inner-top'; })()" >/dev/null 2>&1
  agent-browser eval "window.scrollTo(0, document.documentElement.scrollHeight); 'bottom'" >/dev/null 2>&1
  sleep 0.5
  agent-browser eval "$(cat "$INSTRUMENT")" >/dev/null 2>&1
  agent-browser eval "window.scrollTo(0,0); 'top2'" >/dev/null 2>&1
  sleep 0.5
  SUM=$(agent-browser eval "window.__mtqsAuditFinal=true; $(cat "$INSTRUMENT")" 2>/dev/null)
  agent-browser eval "JSON.stringify(window.__mtqsAuditLast)" > "$OUT/$1.json" 2>/dev/null
  echo "  audit($1): $SUM"
}

SECTIONS=(
  "overview|Overview"
  "network|Network NOC"
  "explorer|Chain Explorer"
  "reference|Reference Index"
  "reserve|Reserve Vault"
  "risk|Risk State"
  "rebalancing|Rebalancing"
  "transparency|Transparency"
  "governance|Governance"
  "validation|Validation"
  "evidence|Evidence Package"
  "developers|Developers"
  "mint|Mint"
  "redeem|Redeem"
  "wallet|Devnet Wallet"
  "staking|Staking & Gov"
  "portfolio|Dashboard"
  "activity|Activity"
  "simulation|Simulation Lab"
  "constituency|Constituency"
  "issuance|Issuance Lab"
  "docs|Blueprint & Docs"
  "security|Security"
  "contracts|Contracts & Chains"
  "authorization|Authorization Audit"
  "faucet|Faucet"
  "investors|Investor Dashboard"
)

SUMMARY="$OUT/summary.tsv"
echo -e "section\tnodes\tflags\tbelow3.6\tband3.6-4.5\tlargeFail\ttiny\tnonTextChecked\tnonTextFlags" > "$SUMMARY"

for entry in "${SECTIONS[@]}"; do
  id="${entry%%|*}"
  label="${entry#*|}"
  agent-browser eval "window.__mtqsAuditSection='$id'; 'set'" >/dev/null 2>&1
  CLICK=$(agent-browser eval "var b=document.querySelector('button[aria-label=\"$label section\"],button[aria-label=\"$label (current section)\"]'); if(b){b.click();'ok'}else{'MISS'}" 2>/dev/null)
  CLICK=$(printf '%s' "$CLICK" | tr -d '"')
  sleep 1.5
  ACTIVE=$(agent-browser eval "var a=document.querySelector('.mtqs-sb-item-active, [aria-current=page]'); a ? (a.getAttribute('aria-label')||'').replace(' (current section)','').replace(' section','') : 'none'" 2>/dev/null)
  ACTIVE=$(printf '%s' "$ACTIVE" | tr -d '"')
  if [ "$ACTIVE" != "$label" ]; then
    echo "[$id] SKIP — click=$CLICK active='$ACTIVE'"
    echo -e "$id\tSKIPPED\t-\t-\t-\t-\t-\t-\t-" >> "$SUMMARY"
    continue
  fi
  echo "[$id] active=$ACTIVE click=$CLICK"
  audit_view "$id"
  if [ -s "$OUT/$id.json" ]; then
    LINE=$(bun -e "let raw=require('fs').readFileSync('$OUT/$id.json','utf8'); let d=null; try { d=JSON.parse(raw); if (typeof d==='string') d=JSON.parse(d); } catch(e) {} if(!d){console.log('$id\tPARSE-FAIL\t-\t-\t-\t-\t-\t-\t-'); process.exit(0);} console.log([d.section,d.nodes,d.flags.length,d.flags.filter(f=>f.r<3.6).length,d.flags.filter(f=>!f.large&&f.r>=3.6&&f.r<4.5).length,d.flags.filter(f=>f.large).length,d.tiny.length,d.nonText.checked,d.nonText.flags.length].join('\t'));" 2>/dev/null)
    echo -e "$LINE" >> "$SUMMARY"
  else
    echo "[$id] FAILED (no results)"
    echo -e "$id\t-\t-\t-\t-\t-\t-\t-\t-" >> "$SUMMARY"
  fi
done

echo "== landing =="
agent-browser eval "window.__mtqsAuditSection='landing'; 'set'" >/dev/null 2>&1
agent-browser eval "var b=document.querySelector('button[aria-label=\"Back to the landing site\"]'); if(b){b.click();'exit'}else{'MISS-exit'}"
sleep 2.5
audit_view "landing"
if [ -s "$OUT/landing.json" ]; then
  LINE=$(bun -e "let raw=require('fs').readFileSync('$OUT/landing.json','utf8'); let d=null; try { d=JSON.parse(raw); if (typeof d==='string') d=JSON.parse(d); } catch(e) {} if(!d){console.log('landing\tPARSE-FAIL'); process.exit(0);} console.log([d.section,d.nodes,d.flags.length,d.flags.filter(f=>f.r<3.6).length,d.flags.filter(f=>!f.large&&f.r>=3.6&&f.r<4.5).length,d.flags.filter(f=>f.large).length,d.tiny.length,d.nonText.checked,d.nonText.flags.length].join('\t'));" 2>/dev/null)
  echo -e "$LINE" >> "$SUMMARY"
fi

echo "== run complete: $OUT =="
cat "$SUMMARY"
