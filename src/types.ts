import {
  Connection,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

export interface SolanaWallet {
  publicKey?: { toBytes(): Uint8Array };
  isConnected: boolean;
  isXDEFI?: boolean;
  signTransaction(
    transaction: VersionedTransaction,
  ): Promise<VersionedTransaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signMessage(
    message: Uint8Array,
    encoding: string,
  ): Promise<{ signature: Uint8Array }>;
  sendTransaction(
    transaction: Transaction,
    connection?: Connection,
    options?: {},
  ): Promise<TransactionSignature>;
  request<T>(args: { method: string; params: { message: string } }): Promise<T>;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  signAndSendTransaction(
    transaction: Transaction,
  ): Promise<{ signature: string }>;
  on: (event: string, callback: (...args: unknown[]) => void) => unknown;
  off: (event: string, callback: () => void) => unknown;
}

export interface PhantomWallet extends SolanaWallet {
  isPhantom?: boolean;
  _handleDisconnect(...args: unknown[]): unknown;
}

export interface SolflareWallet extends SolanaWallet {
  isSolflare?: boolean;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
    solflare?: SolflareWallet;
  }
}
