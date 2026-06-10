import {
  Networks,
  xdr,
  Address,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  rpc,
} from "@stellar/stellar-sdk";
import { requestAccess, signTransaction } from "@stellar/freighter-api";

export const NETWORK = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? "";

export async function getWallet(): Promise<string> {
  const { address } = await requestAccess();
  if (!address) throw new Error("Wallet access denied");
  return address;
}

export async function invokeContract(
  method: string,
  args: xdr.ScVal[],
  publicKey: string
): Promise<xdr.ScVal> {
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(publicKey);

  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK,
  });

  const { signedTxXdr } = signed as { signedTxXdr: string };
  const submittedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK);
  const result = await server.sendTransaction(submittedTx);

  if (result.status === "ERROR") throw new Error("Transaction failed");

  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "SUCCESS" && getResult.returnValue) {
    return getResult.returnValue;
  }
  throw new Error("Transaction did not succeed");
}

export function addrVal(addr: string): xdr.ScVal {
  return Address.fromString(addr).toScVal();
}

export function u32Val(n: number): xdr.ScVal {
  return xdr.ScVal.scvU32(n);
}

export function i128Val(n: bigint): xdr.ScVal {
  const hi = BigInt.asIntN(64, n >> 64n);
  const lo = BigInt.asUintN(64, n);
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({ hi: xdr.Int64.fromString(hi.toString()), lo: xdr.Uint64.fromString(lo.toString()) })
  );
}

export function strVal(s: string): xdr.ScVal {
  return xdr.ScVal.scvString(s);
}

export function u64Val(n: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(n.toString()));
}

export function boolVal(b: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(b);
}

export function parseI128(val: xdr.ScVal): bigint {
  const parts = val.i128();
  const hi = BigInt(parts.hi().toString());
  const lo = BigInt(parts.lo().toString());
  return (hi << 64n) | lo;
}

// Re-export for pages
export { rpc, Contract, TransactionBuilder, BASE_FEE };
