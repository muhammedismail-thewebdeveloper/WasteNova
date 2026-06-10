import { useState } from "react";
import "./App.css";
import { WalletProvider } from "./context/WalletContext";
import Navbar from "./components/Navbar";
import SubmitClaim from "./pages/SubmitClaim";
import RecyclerDashboard from "./pages/RecyclerDashboard";
import AdminPanel from "./pages/AdminPanel";
import Leaderboard from "./pages/Leaderboard";
import Wallet from "./pages/Wallet";

type Page = "submit" | "recycler" | "admin" | "leaderboard" | "wallet";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "submit", label: "Submit Claim" },
  { id: "recycler", label: "Recycler Dashboard" },
  { id: "admin", label: "Admin Panel" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "wallet", label: "My Wallet" },
];

function App() {
  const [page, setPage] = useState<Page>("submit");

  return (
    <WalletProvider>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-52 min-h-screen bg-gray-900 border-r border-gray-800 pt-6 px-3">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    page === item.id
                      ? "bg-brand text-white font-medium"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
          {/* Main */}
          <main className="flex-1 p-2">
            {page === "submit" && <SubmitClaim />}
            {page === "recycler" && <RecyclerDashboard />}
            {page === "admin" && <AdminPanel />}
            {page === "leaderboard" && <Leaderboard />}
            {page === "wallet" && <Wallet />}
          </main>
        </div>
      </div>
    </WalletProvider>
  );
}

export default App;
