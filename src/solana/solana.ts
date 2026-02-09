import { WasmFactory } from "@lightprotocol/hasher.rs";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  deposit,
  depositSPL,
  withdraw,
  withdrawSPL,
  EncryptionService,
  getUtxos,
  getBalanceFromUtxos,
  getUtxosSPL,
  getBalanceFromUtxosSPL,
} from "privacycash/utils";
import path from "node:path";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { jupSwap } from "./jupiter-swap";

const SOLANA_ADDRESS = "So11111111111111111111111111111111111111112";
const REFERRER_ADDRESS = "HCEv8CCq5i6ob7iXpHuGpv1L89pZStycPBeXSi37b7nH";
const swap_reserved_rent_fee = 0.0033;

const addr_to_symbol_map: Record<string, string> = {
  [SOLANA_ADDRESS]: "sol",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "usdt",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usdc",
};

export async function swapPrivately() {
  const connection = new Connection(
    "https://x-api.rubic.exchange/sol_rpc?apikey=sndfje3u4b3fnNSDNFUSDNVSunw345842hrnfd3b4nt4",
  );

  const srcAddr = document.querySelectorAll("input")[0].value;
  const dstAddr = document.querySelectorAll("input")[1].value;
  const srcAmount = document.querySelectorAll("input")[2].value;
  const srcDecimals = document.querySelectorAll("input")[3].value;

  const srcAmountWei = toWei(Number(srcAmount), Number(srcDecimals));

  const prices = await fetch("https://api3.privacycash.org/config")
    .then((r) => r.json())
    .then((data) => data.prices as Record<string, number>);

  const srcTokenUsdPricePerOne = prices[addr_to_symbol_map[srcAddr]];
  const srcTokenUsdAmount = srcTokenUsdPricePerOne * Number(srcAmount);

  console.log("[RUBIC] srcTokenUsdAmount ==>", srcTokenUsdAmount);

  if (srcAddr !== dstAddr && srcTokenUsdAmount < 10) {
    throw new Error("Amount should be more than 10$ for swap.");
  }

  console.log("[RUBIC] Signing message...");
  const signature = await signMessage();
  console.log("[RUBIC] Successfull sign!");

  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromSignature(signature);

  await makeDeposit(srcAddr, srcAmountWei, encryptionService, connection);
  if (srcAddr === dstAddr) {
    await makeDirectWithdraw(
      srcAddr,
      Number(srcDecimals),
      encryptionService,
      connection,
    );
  } else {
    await makeSwapAndWithdraw(encryptionService, connection, signature);
  }
}

async function makeDeposit(
  tokenAddr: string,
  depositAmountWei: number,
  encryptionService: EncryptionService,
  connection: Connection,
): Promise<void> {
  const wallet = window.solana;

  const lightWasm = await WasmFactory.getInstance();
  const pathToZkProof = path.join(
    import.meta.dirname,
    "..",
    "circuit2",
    "transaction2",
  );

  try {
    console.log(`[RUBIC] Start deposit ${tokenAddr}...`);
    if (tokenAddr === SOLANA_ADDRESS) {
      await deposit({
        lightWasm,
        amount_in_lamports: depositAmountWei,
        connection,
        encryptionService,
        publicKey: new PublicKey(wallet.publicKey.toBytes()),
        transactionSigner: async (tx: VersionedTransaction) => {
          return await window.solana.signTransaction(tx);
        },
        keyBasePath: pathToZkProof,
        storage: localStorage,
      });
    } else {
      await depositSPL({
        lightWasm,
        base_units: depositAmountWei,
        connection,
        encryptionService,
        publicKey: new PublicKey(wallet.publicKey.toBytes()),
        transactionSigner: async (tx: VersionedTransaction) => {
          return await window.solana.signTransaction(tx);
        },
        keyBasePath: pathToZkProof,
        storage: localStorage,
        mintAddress: tokenAddr,
      });
    }
    console.log("[RUBIC] ✅ Successfull deposit!");
  } catch (err) {
    console.log("[RUBIC] ❌ Failed deposit!");
    throw err;
  }
}

async function makeDirectWithdraw(
  tokenAddr: string,
  tokenDecimals: number,
  encryptionService: EncryptionService,
  connection: Connection,
): Promise<void> {
  const wallet = window.solana;

  const receiverAddr = document.querySelectorAll("input")[5].value;

  const tokenPrivateBalanceWei = await getBalanceOnPrivateCash(
    tokenAddr,
    encryptionService,
    connection,
  );
  const tokenPrivateBalance = fromWei(
    tokenPrivateBalanceWei,
    Number(tokenDecimals),
  );

  console.log("[RUBIC] src balances:", {
    tokenPrivateBalanceWei,
    tokenPrivateBalance,
  });

  const publicKey = new PublicKey(wallet.publicKey.toBytes());
  const recipient = new PublicKey(receiverAddr);

  const lightWasm = await WasmFactory.getInstance();
  const pathToZkProof = path.join(
    import.meta.dirname,
    "..",
    "circuit2",
    "transaction2",
  );

  try {
    console.log("[RUBIC] Start withdraw...");
    if (tokenAddr === SOLANA_ADDRESS) {
      await withdraw({
        lightWasm,
        amount_in_lamports: tokenPrivateBalanceWei,
        connection,
        encryptionService,
        publicKey,
        recipient,
        keyBasePath: pathToZkProof,
        storage: localStorage,
      });
    } else {
      await withdrawSPL({
        lightWasm,
        base_units: tokenPrivateBalanceWei,
        connection,
        encryptionService,
        publicKey,
        recipient,
        keyBasePath: pathToZkProof,
        storage: localStorage,
        mintAddress: tokenAddr,
      });
    }
    console.log("[RUBIC] ✅ Successfull withdrawal!");
  } catch (err) {
    console.log("[RUBIC] ❌ Failed withdrawal!");
    throw err;
  }
}

async function makeSwapAndWithdraw(
  encryptionService: EncryptionService,
  connection: Connection,
  signature: Uint8Array<ArrayBufferLike>,
): Promise<void> {
  const wallet = window.solana;
  const publicKey = new PublicKey(wallet.publicKey.toBytes());

  const srcTokenAddr = document.querySelectorAll("input")[0].value;
  const dstTokenAddr = document.querySelectorAll("input")[1].value;
  const srcDecimals = document.querySelectorAll("input")[3].value;
  const dstDecimals = document.querySelectorAll("input")[4].value;

  const burnerKeypair = await deriveSolanaKeypairFromEncryptionKeyBase58(
    signature,
    publicKey,
    0,
  );

  await makeDirectWithdraw(
    srcTokenAddr,
    Number(srcDecimals),
    encryptionService,
    connection,
  );
  console.log("[RUBIC] after makeDirectWithdraw");

  const swapAmount = await getAmountForJupiterSwap(
    srcTokenAddr,
    encryptionService,
    connection,
  );
  console.log("[RUBIC] swapAmount ==>", swapAmount);

  const prevBurnerBalance = await getBurnerBalance(
    dstTokenAddr,
    burnerKeypair,
    connection,
  );
  console.log("[RUBIC] prevBurnerBalance ==>", prevBurnerBalance);

  console.log("[RUBIC] before jupSwap ==>", { srcTokenAddr, dstTokenAddr });

  await jupSwap(
    new PublicKey(srcTokenAddr),
    new PublicKey(dstTokenAddr),
    swapAmount,
    burnerKeypair,
    connection,
  );

  console.log("[RUBIC] after jupSwap ==>");

  const newBurnerBalance = await waitForUpdatedBurnerWalletBalance(
    dstTokenAddr,
    prevBurnerBalance,
    burnerKeypair,
    connection,
  );
  console.log("[RUBIC] newBurnerBalance ==>", newBurnerBalance);

  const finalDepositAmount =
    dstTokenAddr === SOLANA_ADDRESS
      ? newBurnerBalance - swap_reserved_rent_fee * 1e9
      : newBurnerBalance;
  console.log("[RUBIC] finalDepositAmount ==>", finalDepositAmount);

  await makeDeposit(
    dstTokenAddr,
    finalDepositAmount,
    encryptionService,
    connection,
  );
  console.log("[RUBIC] after final makeDeposit ==>", finalDepositAmount);

  await makeDirectWithdraw(
    dstTokenAddr,
    Number(dstDecimals),
    encryptionService,
    connection,
  );
  console.log("[RUBIC] after final makeDirectWithdraw ==>", finalDepositAmount);
}

function fromWei(weiAmount: number, decimals: number): number {
  return weiAmount / Math.pow(10, decimals);
}

function toWei(amount: number, decimals: number): number {
  return Number(amount) * Math.pow(10, Number(decimals));
}

/**
 * @returns wei balance on PrivacyCash relayer
 */
async function getBalanceOnPrivateCash(
  tokenAddr: string,
  encryptionService: EncryptionService,
  connection: Connection,
): Promise<number> {
  const wallet = window.solana;
  const publicKey = new PublicKey(wallet.publicKey.toBytes());

  try {
    if (tokenAddr === SOLANA_ADDRESS) {
      const utxos = await getUtxos({
        publicKey,
        connection,
        encryptionService,
        storage: localStorage,
      });
      const res = getBalanceFromUtxos(utxos);
      console.log("✅ Successfull getBalance!");

      return res.lamports;
    }

    const utxos = await getUtxosSPL({
      publicKey,
      connection,
      encryptionService,
      storage: localStorage,
      mintAddress: tokenAddr,
    });
    const res = getBalanceFromUtxosSPL(utxos);
    console.log("✅ Successfull getBalance!");

    return res.base_units;
  } catch (err) {
    console.log("❌ Failed getBalance!");
    throw err;
  }
}

async function signMessage(): Promise<Uint8Array<ArrayBufferLike>> {
  const wallet = window.solana;

  const encodedMessage = new TextEncoder().encode(
    `Privacy Money account sign in`,
  );

  try {
    const resp = await wallet.signMessage(encodedMessage, "utf8");
    return resp.signature;
  } catch (err: any) {
    throw new Error("Failed to sign message: " + err.message);
  }
}

export async function deriveSolanaKeypairFromEncryptionKeyBase58(
  ikm: Uint8Array,
  publicKey: PublicKey,
  index: number,
): Promise<Keypair> {
  let saltContext = "privacycash:v1:" + publicKey.toBase58();

  if (index < 0 || !Number.isInteger(index))
    throw new Error("index must be a non-negative integer");
  if (ikm.length < 32) {
    throw new Error(`Decoded encryptionKey is only ${ikm.length} bytes (<32).`);
  }

  const msgBuffer = new TextEncoder().encode(saltContext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const salt = new Uint8Array(hashBuffer);
  const info = new TextEncoder().encode(
    `privacycash:solana:wallet:v1:${index}`,
  );

  const seed = await hkdf(ikm, salt, info, 32);

  return Keypair.fromSeed(new Uint8Array(seed));
}

async function getAmountForJupiterSwap(
  tokenAddr: string,
  encryptionService: EncryptionService,
  connection: Connection,
): Promise<number> {
  const srcTokenPrivateBalance = await getBalanceOnPrivateCash(
    tokenAddr,
    encryptionService,
    connection,
  );

  if (tokenAddr === SOLANA_ADDRESS) {
    const swapAmount =
      srcTokenPrivateBalance - (swap_reserved_rent_fee + 0.002) * 1e9;
    return swapAmount;
  }

  return srcTokenPrivateBalance;
}

/**
 * @TODO restrict retries
 */
async function waitForUpdatedBurnerWalletBalance(
  dstTokenAddr: string,
  prevBurnerBalance: number,
  burnerKeypair: Keypair,
  connection: Connection,
): Promise<number> {
  while (true) {
    await new Promise((res) => setTimeout(res, 5_000));
    const newBurnerBalance = await getBurnerBalance(
      dstTokenAddr,
      burnerKeypair,
      connection,
    );
    if (newBurnerBalance > prevBurnerBalance) return newBurnerBalance;
  }
}

async function getBurnerBalance(
  tokenAddr: string,
  burnerKeypair: Keypair,
  connection: Connection,
): Promise<number> {
  if (tokenAddr === SOLANA_ADDRESS) {
    const nativeBalance = await connection.getBalanceAndContext(
      burnerKeypair.publicKey,
      "confirmed",
    );
    return nativeBalance.value;
  } else {
    const ata = getAssociatedTokenAddressSync(
      new PublicKey(tokenAddr),
      burnerKeypair.publicKey,
    );
    const balanceRes = await connection
      .getTokenAccountBalance(ata)
      .catch(() => ({ value: { amount: "0" } }));
    return parseInt(balanceRes.value.amount);
  }
}

export async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Create new ArrayBuffers to avoid TypeScript issues
  const saltArrayBuffer = new Uint8Array(salt).buffer;
  const ikmArrayBuffer = new Uint8Array(ikm).buffer;
  const infoArrayBuffer = new Uint8Array(info).buffer;

  const baseKey = await crypto.subtle.importKey(
    "raw",
    ikmArrayBuffer,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltArrayBuffer,
      info: infoArrayBuffer,
    },
    baseKey,
    length * 8,
  );

  return new Uint8Array(derivedBits);
}
