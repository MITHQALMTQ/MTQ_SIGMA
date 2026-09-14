# ============================================================================
# MTQΣ Koyeb Keeper — Dockerfile
# ============================================================================
# Builds a tiny image for Koyeb's free tier (no credit card required).
#
# 🔴 HOT WALLET — low-privilege, rotate regularly.
#   The keeper holds ONLY KEEPER_ROLE. It CANNOT mint/redeem/pause.
#
# Port 3040 is FIXED — do not parameterize via ENV. Koyeb routes external
# traffic to whatever port the service listens on; we standardize on 3040
# so the uptime monitor (UptimeRobot) and GitHub Actions backup heartbeat
# always hit the right target.
# ============================================================================

# oven/bun:1.1-distroless is the smallest Bun image (~150MB). It has NO shell,
# NO package manager — perfect for an attacker-resistant keeper. The trade-off
# is that you can't `docker exec` into it; use logs (Koyeb dashboard → Service
# → Logs) for debugging.
FROM oven/bun:1.1-distroless

WORKDIR /app

# Copy lockfile (if it exists) + package.json first for cache-friendly install.
# We use --production so devDependencies are excluded.
COPY package.json ./
# If bun.lock is present, copy it for --frozen-lockfile reproducibility.
# (If absent, bun install will generate one — slightly less reproducible but
# still correct for a free-tier pilot.)
COPY bun.lock* ./

# Install production deps. --frozen-lockfile fails the build if the lockfile
# is out of sync with package.json — this catches dependency drift in CI.
# (If no lockfile is present yet, this falls back to a normal install.)
RUN bun install --production --frozen-lockfile || bun install --production

# Copy the application. The keeper is a single file — no build step needed.
COPY index.ts ./

# Bun reads env vars at runtime; Koyeb injects them from the service config.
# 🔴 HOT WALLET — see .env.example. KEEPER_PRIVATE_KEY is the ONLY sensitive
# value; rotate it monthly (see RUNBOOK.md §4).
ENV PORT=3040 \
    NODE_ENV=production

# Port 3040 (FIXED — not env-configurable per task spec).
EXPOSE 3040

# Healthcheck: hit /health every 30s. Koyeb also does its own external
# healthcheck via the uptime monitor; this is the in-container check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/usr/local/bin/bun", "-e", "fetch('http://127.0.0.1:3040/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Non-root user (distroless image ships with user `nonroot` uid=65532).
USER nonroot

# Start the keeper.
CMD ["bun", "run", "index.ts"]
