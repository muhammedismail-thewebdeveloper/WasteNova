import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { addrVal, parseI128, rpc, Contract, TransactionBuilder, BASE_FEE, RPC_URL, NETWORK, CONTRACT_ID } from "../lib/stellar";

interface MyStats { kg: number; tokens: number }

const CO2_PER_KG = 2.5;

async function fetchUserStats(address: string): Promise<MyStats> {
  const server = new rpc.Server(RPC_URL);
  const simCall = async (method: string) => {
    const acct = await server.getAccount(address);
    const contract = new Contract(CONTRACT_ID);
    const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK })
      .addOperation(contract.call(method, addrVal(address)))
      .setTimeout(10)
      .build();
    const sim = await server.simulateTransaction(tx);
    return "result" in sim && sim.result ? sim.result.retval : null;
  };
  const [kgVal, tokVal] = await Promise.all([simCall("total_kg_impact"), simCall("balance")]);
  return {
    kg: kgVal?.u32() ?? 0,
    tokens: tokVal ? Number(parseI128(tokVal)) / 1e7 : 0,
  };
}

async function fetchGlobalKg(address: string): Promise<number> {
  const server = new rpc.Server(RPC_URL);
  const acct = await server.getAccount(address);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call("global_kg"))
    .setTimeout(10)
    .build();
  const sim = await server.simulateTransaction(tx);
  if ("result" in sim && sim.result) return sim.result.retval.u32();
  return 0;
}

export default function Leaderboard() {
  const { address } = useWallet();
  const [myStats, setMyStats] = useState<(MyStats & { co2: number }) | null>(null);
  const [globalKg, setGlobalKg] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([fetchUserStats(address), fetchGlobalKg(address)])
      .then(([stats, gkg]) => {
        setMyStats({ ...stats, co2: stats.kg * CO2_PER_KG });
        setGlobalKg(gkg);
      })
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Environmental Impact</h2>
      <p className="text-gray-400 text-sm mb-6">Track the global impact of WasteNova recyclers.</p>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Waste Recycled" value={`${globalKg.toLocaleString()} kg`} color="text-brand" />
        <StatCard label="CO₂ Saved (est.)" value={`${(globalKg * CO2_PER_KG).toLocaleString()} kg`} color="text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold mb-3">Your Impact</h3>
      {!address && <p className="text-gray-400">Connect wallet to see your stats.</p>}
      {loading && <p className="text-gray-400">Loading…</p>}
      {myStats && !loading && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-3">
          <p className="text-xs text-gray-500 font-mono">{address}</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <StatCard label="Waste Recycled" value={`${myStats.kg} kg`} color="text-brand" />
            <StatCard label="WNV Earned" value={myStats.tokens.toFixed(2)} color="text-yellow-400" />
            <StatCard label="CO₂ Saved" value={`${myStats.co2.toFixed(1)} kg`} color="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Progress to Gold tier</p>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${Math.min((myStats.kg / 1000) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{myStats.kg}/1000 kg</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
