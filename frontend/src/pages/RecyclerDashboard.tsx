import { useState, useEffect } from "react";
import { xdr, Address } from "@stellar/stellar-sdk";
import { useWallet } from "../context/WalletContext";
import { invokeContract, addrVal, u64Val, boolVal, rpc, Contract, TransactionBuilder, BASE_FEE, RPC_URL, NETWORK, CONTRACT_ID } from "../lib/stellar";

interface Claim {
  id: bigint;
  submitter: string;
  kg_waste: number;
  waste_type: string;
  status: string;
  reward_tokens: bigint;
  recycler: string;
}

async function fetchClaims(recyclerAddr: string): Promise<Claim[]> {
  const server = new rpc.Server(RPC_URL);

  let total = 0n;
  try {
    const acct = await server.getAccount(recyclerAddr);
    const contract = new Contract(CONTRACT_ID);
    const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK })
      .addOperation(contract.call("claim_count"))
      .setTimeout(10)
      .build();
    const sim = await server.simulateTransaction(tx);
    if ("result" in sim && sim.result) {
      total = BigInt(sim.result.retval.u64().toString());
    }
  } catch {
    return [];
  }

  const claims: Claim[] = [];
  for (let i = 1n; i <= total; i++) {
    try {
      const acct = await server.getAccount(recyclerAddr);
      const contract = new Contract(CONTRACT_ID);
      const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK })
        .addOperation(contract.call("get_claim", xdr.ScVal.scvU64(xdr.Uint64.fromString(i.toString()))))
        .setTimeout(10)
        .build();
      const sim = await server.simulateTransaction(tx);
      if ("result" in sim && sim.result) {
        const map = sim.result.retval.map()!;
        const get = (k: string) => map.find((e: xdr.ScMapEntry) => e.key().sym().toString() === k)?.val();
        const recycler = Address.fromScVal(get("recycler")!).toString();
        if (recycler !== recyclerAddr) continue;
        const hi = BigInt(get("reward_tokens")!.i128().hi().toString());
        const lo = BigInt(get("reward_tokens")!.i128().lo().toString());
        claims.push({
          id: i,
          submitter: Address.fromScVal(get("submitter")!).toString(),
          kg_waste: get("kg_waste")!.u32(),
          waste_type: get("waste_type")!.str().toString(),
          status: get("status")!.switch().name,
          reward_tokens: (hi << 64n) | lo,
          recycler,
        });
      }
    } catch { /* skip bad claims */ }
  }
  return claims;
}

export default function RecyclerDashboard() {
  const { address, role } = useWallet();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (address && role === "recycler") {
      setLoading(true);
      fetchClaims(address).then(setClaims).finally(() => setLoading(false));
    }
  }, [address, role]);

  if (role !== "recycler") return <p className="p-6 text-gray-400">Switch role to "recycler" to access this dashboard.</p>;
  if (!address) return <p className="p-6 text-gray-400">Connect your wallet.</p>;

  async function review(claimId: bigint, approve: boolean) {
    const key = claimId.toString();
    setActionStatus((s) => ({ ...s, [key]: "loading" }));
    try {
      await invokeContract("review_claim", [addrVal(address!), u64Val(claimId), boolVal(approve)], address!);
      setActionStatus((s) => ({ ...s, [key]: approve ? "approved" : "rejected" }));
      setClaims((cs) => cs.map((c) => c.id === claimId ? { ...c, status: approve ? "Approved" : "Rejected" } : c));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      setActionStatus((s) => ({ ...s, [key]: "error: " + msg }));
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Recycler Dashboard</h2>
      {loading && <p className="text-gray-400">Loading claims…</p>}
      {!loading && claims.length === 0 && <p className="text-gray-400">No claims assigned to you.</p>}
      <div className="space-y-3">
        {claims.map((c) => (
          <ClaimCard
            key={c.id.toString()}
            claim={c}
            actionStatus={actionStatus[c.id.toString()]}
            onReview={review}
          />
        ))}
      </div>
    </div>
  );
}

function ClaimCard({
  claim,
  actionStatus,
  onReview,
}: {
  claim: Claim;
  actionStatus?: string;
  onReview: (id: bigint, approve: boolean) => void;
}) {
  const isPending = claim.status.toLowerCase().includes("pending");
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">Claim #{claim.id.toString()}</p>
          <p className="text-sm text-gray-400 font-mono">{claim.submitter.slice(0, 8)}…</p>
          <p className="text-sm mt-1">
            <span className="text-brand font-medium">{claim.kg_waste} kg</span>
            {" "}· {claim.waste_type}
            {" "}· <span className="text-yellow-400">{(Number(claim.reward_tokens) / 1e7).toFixed(1)} WNV</span>
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      {isPending && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={actionStatus === "loading"}
            onClick={() => onReview(claim.id, true)}
            className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
          >Approve</button>
          <button
            disabled={actionStatus === "loading"}
            onClick={() => onReview(claim.id, false)}
            className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
          >Reject</button>
        </div>
      )}
      {actionStatus && actionStatus !== "loading" && (
        <p className="mt-2 text-xs text-gray-400">{actionStatus}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s.includes("approv") ? "bg-green-900 text-green-300" :
    s.includes("reject") ? "bg-red-900 text-red-300" :
    s.includes("paid") ? "bg-blue-900 text-blue-300" :
    "bg-yellow-900 text-yellow-300";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}
