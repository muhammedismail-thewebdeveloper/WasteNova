import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { invokeContract, u64Val, boolVal } from "../lib/stellar";

export default function AdminPanel() {
  const { address, role } = useWallet();
  const [claimId, setClaimId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (role !== "admin") return <p className="p-6 text-gray-400">Admin access only.</p>;
  if (!address) return <p className="p-6 text-gray-400">Connect your wallet.</p>;

  async function moderate(approve: boolean) {
    if (!claimId) return;
    setStatus("loading");
    setMsg("");
    try {
      await invokeContract("admin_moderate", [u64Val(BigInt(claimId)), boolVal(approve)], address!);
      setMsg(`Claim #${claimId} ${approve ? "approved" : "rejected"} by admin.`);
      setStatus("ok");
    } catch (e: any) {
      setMsg(e.message ?? "Error");
      setStatus("err");
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Admin Moderation</h2>
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Claim ID</label>
          <input
            type="number"
            min="1"
            className="input"
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="e.g. 42"
          />
        </div>
        <div className="flex gap-3">
          <button
            disabled={status === "loading" || !claimId}
            onClick={() => moderate(true)}
            className="flex-1 bg-brand hover:bg-brand-dark text-white py-2 rounded disabled:opacity-50"
          >
            Force Approve
          </button>
          <button
            disabled={status === "loading" || !claimId}
            onClick={() => moderate(false)}
            className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded disabled:opacity-50"
          >
            Force Reject
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${status === "ok" ? "text-green-400" : "text-red-400"}`}>{msg}</p>
        )}
      </div>
    </div>
  );
}
