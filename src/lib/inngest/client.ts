// MTQΣ — Inngest Client
//
// Inngest is the event-driven job orchestration layer that connects
// Vercel (serverless), Turso (edge DB), and Neon (analytical DB).
//
// Events flow: Vercel API → Inngest Cloud → Vercel /api/inngest (execute)
// Jobs: keeper ticks, Turso→Neon sync, backups, alerts, oracle monitoring

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "mtq-sigma",
  name: "MTQΣ Protocol Engine",
  eventKey: process.env.INNGEST_EVENT_KEY ?? "mtq-local-dev-key",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
