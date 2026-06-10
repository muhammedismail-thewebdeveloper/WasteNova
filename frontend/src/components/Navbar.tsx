import { useWallet } from "../context/WalletContext";

const ROLES = ["user", "recycler", "admin"] as const;

export default function Navbar() {
  const { address, role, connect, disconnect, setRole } = useWallet();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
      <span className="text-xl font-bold text-brand">♻ WasteNova</span>
      <div className="flex items-center gap-4">
        {address && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="bg-gray-800 text-sm rounded px-2 py-1 text-gray-300"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        {address ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            <button
              onClick={disconnect}
              className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
