# MTQΣ Wallet — The Global Purchasing Power Unit

Mobile app (React Native / Expo) for the MTQΣ protocol.

## Features
- Multi-currency display (7 currencies: USD/EUR/GBP/JPY/CNY/CHF/Gold)
- Mint/Redeem interface (via API)
- GFB Index live ticker (polls /api/metrics every 4s)
- Portfolio tracking
- Push notifications for risk state changes

## Getting Started
```bash
cd mobile
npm install
npx expo start
```

## API
The app uses the MTQΣ public API at `https://mtq-sigma.vercel.app/api/*`:
- `GET /api/metrics` — live monetary state
- `GET /api/gfb` — GFB Index public API
- `POST /api/simulate/mint` — mint simulation
- `POST /api/simulate/redeem` — redeem simulation

## Sharia Compliance
This app does NOT implement any interest-bearing features. The MTQΣ protocol is designed for Sharia review — it is asset-backed, non-speculative, and does not charge or pay interest (Riba). The "Reserve Yield" module (Aave integration) was deliberately excluded per Sharia compliance requirements.
