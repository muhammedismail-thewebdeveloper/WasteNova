import React, { createContext, useContext, useState, useCallback } from "react";
import { getWallet } from "../lib/stellar";

type Role = "user" | "recycler" | "admin";

interface WalletCtx {
  address: string | null;
  role: Role;
  connect: () => Promise<void>;
  disconnect: () => void;
  setRole: (r: Role) => void;
}

const Ctx = createContext<WalletCtx>({
  address: null,
  role: "user",
  connect: async () => {},
  disconnect: () => {},
  setRole: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("user");

  const connect = useCallback(async () => {
    const addr = await getWallet();
    setAddress(addr);
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  return (
    <Ctx.Provider value={{ address, role, connect, disconnect, setRole }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWallet = () => useContext(Ctx);
