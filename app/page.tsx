export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            MTQ Σ
          </h1>
          <h2 className="text-2xl font-semibold mb-6 text-slate-300">
            The Global Purchasing Power Unit
          </h2>
          
          <div className="bg-slate-800/50 rounded-lg p-6 mb-8 border border-slate-700">
            <p className="text-lg mb-4 text-slate-200">
              MTQ Σ (Mithqal) is a non-USD, multi-currency reference unit backed by a 110%+ collateralized 
              reserve of stablecoins and tokenized gold.
            </p>
            <p className="text-slate-300">
              Unlike traditional stablecoins that peg to a single fiat currency (like the USD), MTQ Σ is 
              priced against the GFB Index—a fixed-quantity basket of the world's five major currencies 
              (USD, EUR, GBP, JPY, CNY). This ensures the token maintains global purchasing power, 
              independent of any single nation's monetary policy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h3 className="text-xl font-semibold mb-3 text-blue-400">Status</h3>
              <p className="text-yellow-400 font-semibold mb-2">⚠️ TESTNET CANDIDATE</p>
              <p className="text-slate-300 text-sm">Not Production-Authorized</p>
              <p className="text-slate-400 text-sm mt-2">Version: Σ-v1.2 (FINAL CLOSED-LOOP)</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h3 className="text-xl font-semibold mb-3 text-purple-400">Technology</h3>
              <ul className="text-slate-300 text-sm space-y-1">
                <li>• Networks: Arc, Monad, Solana</li>
                <li>• Oracles: Chainlink, Pyth, Chronicle</li>
                <li>• Languages: Solidity & Rust</li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 text-green-400">Key Features</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Asset-Backed Reserve with 110% collateralization target</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Smart Rebalancing Engine with cost-benefit optimization</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Multi-Source Oracle Architecture (Chainlink, Pyth, Chronicle)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Six-State Risk Management System</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Four-Layer Governance Framework</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Sharia-Ready Design (certification pending)</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 bg-blue-900/20 rounded-lg p-6 border border-blue-700/50">
            <h3 className="text-xl font-semibold mb-3 text-blue-300">GFB Index Composition</h3>
            <p className="text-slate-300 text-sm mb-4">Fixed Basket Quantities per 1 MTQ Unit:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div className="bg-slate-800/50 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">38.90%</div>
                <div className="text-sm text-slate-400">USD</div>
              </div>
              <div className="bg-slate-800/50 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">27.80%</div>
                <div className="text-sm text-slate-400">EUR</div>
              </div>
              <div className="bg-slate-800/50 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">16.69%</div>
                <div className="text-sm text-slate-400">GBP</div>
              </div>
              <div className="bg-slate-800/50 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">11.11%</div>
                <div className="text-sm text-slate-400">JPY</div>
              </div>
              <div className="bg-slate-800/50 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">5.50%</div>
                <div className="text-sm text-slate-400">CNY</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
