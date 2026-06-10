import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { invokeContract, addrVal, i128Val, parseI128, rpc, Contract, TransactionBuilder, BASE_FEE, RPC_URL, NETWORK, CONTRACT_ID } from "../lib/stellar";

async function fetchBalance(address: string): Promise<number> {
  const server = new rpc.Server(RPC_URL);
  const acct = await server.getAccount(address);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call("balance", addrVal(address)))
    .setTimeout(10)
    .build();
  const sim = await server.simulateTransaction(tx);
  if ("result" in sim && sim.result) return Number(parseI128(sim.result.retval)) / 1e7;
  return 0;
}

export default function Wallet() {
  const { address } = useWallet();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (address) fetchBalance(address).then(setBalance);
  }, [address]);

  if (!address) return <p className="p-6 text-gray-400">Connect wallet to view balance.</p>;

  async function redeem() {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setStatus("loading");
    setMsg("");
    try {
      await invokeContract("redeem", [addrVal(address!), i128Val(BigInt(Math.round(n * 1e7)))], address!);
      setMsg(`Redeem submitted. ${n} WNV will be settled as USDC off-chain.`);
      setStatus("ok");
      setBalance((b) => b - n);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Error");
      setStatus("err");
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">My Wallet</h2>
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <p className="text-sm text-gray-400">WNV Balance</p>
        <p className="text-4xl font-bold text-yellow-400 mt-1">{balance.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-1">≈ ${(balance * 0.1).toFixed(2)} USDC</p>
      </div>
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-3">
        <h3 className="font-semibold">Redeem for USDC</h3>
        <input
          type="number"
          className="input"
          placeholder="Amount (WNV)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          max={balance}
        />
        <button
          disabled={status === "loading" || !amount}
          onClick={redeem}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 rounded disabled:opacity-50"
        >
          {status === "loading" ? "Processing…" : "Redeem WNV → USDC"}
        </button>
        {msg && (
          <p className={`text-sm ${status === "ok" ? "text-green-400" : "text-red-400"}`}>{msg}</p>
        )}
      </div>
    </div>
  );
}
