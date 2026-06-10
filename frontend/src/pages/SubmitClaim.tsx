import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { invokeContract, addrVal, u32Val, strVal } from "../lib/stellar";

const WASTE_TYPES = ["Plastic", "Glass", "Metal", "Paper", "E-Waste", "Organic"];

export default function SubmitClaim() {
  const { address } = useWallet();
  const [form, setForm] = useState({
    recycler: "",
    kg: "",
    wasteType: WASTE_TYPES[0],
    photoHash: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [claimId, setClaimId] = useState<string>("");
  const [error, setError] = useState("");

  if (!address) return <p className="p-6 text-gray-400">Connect your wallet to submit a claim.</p>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const result = await invokeContract("submit_claim", [
        addrVal(address!),
        addrVal(form.recycler),
        u32Val(parseInt(form.kg)),
        strVal(form.wasteType),
        strVal(form.photoHash || "0x0"),
      ], address!);
      setClaimId(result.u64().toString());
      setStatus("ok");
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setStatus("err");
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Submit Waste Pickup Claim</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Recycler Address">
          <input
            required
            className="input"
            placeholder="G…"
            value={form.recycler}
            onChange={(e) => setForm({ ...form, recycler: e.target.value })}
          />
        </Field>
        <Field label="Waste Type">
          <select
            className="input"
            value={form.wasteType}
            onChange={(e) => setForm({ ...form, wasteType: e.target.value })}
          >
            {WASTE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Weight (kg)">
          <input
            required
            type="number"
            min="1"
            className="input"
            value={form.kg}
            onChange={(e) => setForm({ ...form, kg: e.target.value })}
          />
        </Field>
        <Field label="Photo Hash (optional)">
          <input
            className="input"
            placeholder="IPFS CID or hash"
            value={form.photoHash}
            onChange={(e) => setForm({ ...form, photoHash: e.target.value })}
          />
        </Field>
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded disabled:opacity-50"
        >
          {status === "loading" ? "Submitting…" : "Submit Claim"}
        </button>
      </form>

      {status === "ok" && (
        <div className="mt-4 p-3 bg-green-900/40 border border-green-700 rounded text-green-300">
          ✓ Claim #{claimId} submitted! Reward: {parseInt(form.kg) * 10} WNV tokens pending approval.
        </div>
      )}
      {status === "err" && (
        <div className="mt-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
