import { WasmFactory } from "@lightprotocol/hasher.rs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
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
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { jupSwap } from "./jupiter-swap";

export const SOLANA_ADDRESS = "So11111111111111111111111111111111111111112";
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
  const receiver = document.querySelectorAll("input")[5].value;

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

  const wallet = window.solana;
  const walletPK = new PublicKey(wallet.publicKey.toBytes());

  await makeDeposit(
    srcAddr,
    srcAmountWei,
    encryptionService,
    connection,
    walletPK,
    async (tx: VersionedTransaction) => {
      return await wallet.signTransaction(tx);
    },
  );
  if (srcAddr === dstAddr) {
    await makeDirectWithdraw(
      srcAddr,
      Number(srcDecimals),
      encryptionService,
      connection,
      walletPK,
      new PublicKey(receiver),
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
  depositorWalletPK: PublicKey,
  transactionSignerFn: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>,
): Promise<void> {
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
        publicKey: depositorWalletPK,
        signer: depositorWalletPK,
        transactionSigner: transactionSignerFn,
        keyBasePath: pathToZkProof,
        storage: localStorage,
      });
    } else {
      await depositSPL({
        lightWasm,
        base_units: depositAmountWei,
        connection,
        encryptionService,
        publicKey: depositorWalletPK,
        signer: depositorWalletPK,
        transactionSigner: transactionSignerFn,
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
  srcWalletPK: PublicKey,
  recipientPK: PublicKey,
): Promise<void> {
  const tokenPrivateBalanceWei = await getBalanceOnPrivateCash(
    tokenAddr,
    encryptionService,
    connection,
    srcWalletPK,
  );
  const tokenPrivateBalance = fromWei(
    tokenPrivateBalanceWei,
    Number(tokenDecimals),
  );

  console.log(`[RUBIC] ${tokenAddr} private balance to withdraw:`, {
    tokenPrivateBalanceWei,
    tokenPrivateBalance,
    srcWallet: srcWalletPK.toBase58(),
    recipientWallet: recipientPK.toBase58(),
  });

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
        publicKey: srcWalletPK,
        recipient: recipientPK,
        keyBasePath: pathToZkProof,
        storage: localStorage,
      });
    } else {
      await withdrawSPL({
        lightWasm,
        base_units: tokenPrivateBalanceWei,
        connection,
        encryptionService,
        publicKey: srcWalletPK,
        recipient: recipientPK,
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
  const srcTokenAddr = document.querySelectorAll("input")[0].value;
  const dstTokenAddr = document.querySelectorAll("input")[1].value;
  const srcDecimals = document.querySelectorAll("input")[3].value;
  const dstDecimals = document.querySelectorAll("input")[4].value;
  const receiver = document.querySelectorAll("input")[5].value;

  const userWalletPK = new PublicKey(window.solana.publicKey.toBytes());
  const receiverPK = new PublicKey(receiver);

  const burnerKeypair = await deriveSolanaKeypairFromEncryptionKeyBase58(
    signature,
    userWalletPK,
    0,
  );
  console.log(`[RUBIC] burnerKeypair generated ==>`, {
    publicKey: burnerKeypair.publicKey.toBase58(),
    secretKey: burnerKeypair.secretKey.toString(),
    secretBuffer: JSON.stringify(burnerKeypair.secretKey.buffer),
  });
  localStorage.setItem("PRIVATE_KEY", burnerKeypair.secretKey.toString());

  const srcTokenBurnerBalanceBeforeWithdraw = await getBurnerBalance(
    srcTokenAddr,
    burnerKeypair,
    connection,
  );
  console.log(
    "[RUBIC] srcTokenBurnerBalanceBeforeWithdraw before withdraw ==>",
    srcTokenBurnerBalanceBeforeWithdraw,
  );

  // withdraw src coin to burner wallet
  await makeDirectWithdraw(
    srcTokenAddr,
    Number(srcDecimals),
    encryptionService,
    connection,
    userWalletPK,
    burnerKeypair.publicKey,
  );
  console.log("[RUBIC] after withdraw ==>", {
    from: userWalletPK.toBase58(),
    to: burnerKeypair.publicKey.toBase58(),
  });

  // const srcTokenBurnerBalance = await getBurnerBalance(
  //   srcTokenAddr,
  //   burnerKeypair,
  //   connection,
  // );
  const srcTokenBurnerBalance = await waitForUpdatedBurnerWalletBalance(
    srcTokenAddr,
    srcTokenBurnerBalanceBeforeWithdraw,
    burnerKeypair,
    connection,
  );
  console.log(
    `[RUBIC] srcTokenBurnerBalance after withdraw ==>`,
    srcTokenBurnerBalance,
  );

  const dstTokenBurnerBalance = await getBurnerBalance(
    dstTokenAddr,
    burnerKeypair,
    connection,
  );
  console.log(
    `[RUBIC] dstTokenBurnerBalance ${dstTokenBurnerBalance} ==>`,
    dstTokenBurnerBalance,
  );

  const swapAmount = await getAmountWithoutFees(
    srcTokenAddr,
    srcTokenBurnerBalance,
  );
  console.log("[RUBIC] swapAmount ==>", swapAmount);

  // if (swapAmount > srcTokenBurnerBalance) {
  //   console.log("[RUBIC] FAIL: swapAmount > srcTokenBurnerBalance");
  //   console.log("Making withdrawal...");
  //   await makeDirectWithdraw(
  //     srcTokenAddr,
  //     Number(srcDecimals),
  //     encryptionService,
  //     connection,
  //     burnerKeypair.publicKey,
  //     userWalletPK,
  //   );
  //   console.log("Successfull withdrawal!");
  //   return;
  // }

  console.log("[RUBIC] before jupSwap ==>", {
    fromToken: srcTokenAddr,
    toToken: dstTokenAddr,
    srcWallet: burnerKeypair.publicKey.toBase58(),
    recepientWallet: burnerKeypair.publicKey.toBase58(),
  });
  // swap on burner wallet srcToken -> dstToken
  const swapResp = await jupSwap(
    new PublicKey(srcTokenAddr),
    new PublicKey(dstTokenAddr),
    swapAmount,
    burnerKeypair,
    connection,
  );
  console.log("[RUBIC] after jupSwap ==>", swapResp);

  const newBurnerBalance = await waitForUpdatedBurnerWalletBalance(
    dstTokenAddr,
    dstTokenBurnerBalance,
    burnerKeypair,
    connection,
  );
  console.log("[RUBIC] newBurnerBalance ==>", newBurnerBalance);

  const dstTokenDepositAmount = await getAmountWithoutFees(
    dstTokenAddr,
    newBurnerBalance,
  );
  console.log("[RUBIC] dstTokenDepositAmount ==>", dstTokenDepositAmount);

  await new Promise((res) => setTimeout(res, 15_000));

  // deposit destination token from burner wallet
  await makeDeposit(
    dstTokenAddr,
    dstTokenDepositAmount,
    encryptionService,
    connection,
    burnerKeypair.publicKey,
    (tx: VersionedTransaction) => {
      tx.sign([burnerKeypair]);
      return Promise.resolve(tx);
    },
  );
  console.log(
    "[RUBIC] after deposit from ==>",
    burnerKeypair.publicKey.toBase58(),
  );

  // withdraw from burner to target receiver address
  await makeDirectWithdraw(
    dstTokenAddr,
    Number(dstDecimals),
    encryptionService,
    connection,
    burnerKeypair.publicKey,
    receiverPK,
  );
  console.log("[RUBIC] after final makeDirectWithdraw ==>");
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
  walletPK: PublicKey,
): Promise<number> {
  try {
    if (tokenAddr === SOLANA_ADDRESS) {
      const utxos = await getUtxos({
        publicKey: walletPK,
        connection,
        encryptionService,
        storage: localStorage,
      });
      const res = getBalanceFromUtxos(utxos);
      console.log("✅ Successfull getBalance!");

      return res.lamports;
    }

    const utxos = await getUtxosSPL({
      publicKey: walletPK,
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

async function getAmountWithoutFees(
  tokenAddr: string,
  tokenBurnerWalletBalanceWei: number,
  // encryptionService: EncryptionService,
  // connection: Connection,
  // burnerKeypair: Keypair,
): Promise<number> {
  // const srcTokenPrivateBalance = await getBalanceOnPrivateCash(
  //   tokenAddr,
  //   encryptionService,
  //   connection,
  //   burnerKeypair.publicKey,
  // );

  if (tokenAddr === SOLANA_ADDRESS) {
    const swapAmount =
      tokenBurnerWalletBalanceWei - (swap_reserved_rent_fee + 0.002) * 1e9;
    return swapAmount;
  }

  return tokenBurnerWalletBalanceWei;
}

/**
 * @TODO restrict retries
 */
async function waitForUpdatedBurnerWalletBalance(
  tokenAddr: string,
  prevBurnerBalance: number,
  burnerKeypair: Keypair,
  connection: Connection,
): Promise<number> {
  while (true) {
    console.log("[RUBIC] WAIT FOR BALANCE UPDATED");
    await new Promise((res) => setTimeout(res, 5_000));
    const newBurnerBalance = await getBurnerBalance(
      tokenAddr,
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
    // const ata = getAssociatedTokenAddressSync(
    //   new PublicKey(tokenAddr),
    //   burnerKeypair.publicKey,
    // );
    // const balanceRes = await connection
    //   .getTokenAccountBalance(ata)
    //   .catch((err) => {
    //     console.log("[RUBIC] ERROR ATA getTokenAccountBalance", {
    //       ata: ata.toBase58(),
    //       err,
    //     });
    //     return { value: { amount: "0" } };
    //   });
    // console.log("[RUBIC] ATA getTokenAccountBalance", {});
    // return parseInt(balanceRes.value.amount);
    return getTokenBalance(
      burnerKeypair.publicKey.toBase58(),
      tokenAddr,
      connection,
    );
  }
}

async function getTokenBalance(
  address: string,
  tokenAddr: string,
  connection: Connection,
): Promise<number> {
  try {
    const resp = await (
      connection as Connection & {
        _rpcRequest: (owner: string, data: unknown[]) => any;
      }
    )._rpcRequest("getTokenAccountsByOwner", [
      address,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: "jsonParsed" },
    ]);

    const found = resp.result.value.find(
      (el: any) =>
        el.account.data.parsed.info.mint.toLowerCase() ===
        tokenAddr.toLowerCase(),
    );

    console.log(
      `[RUB] found token balance ${tokenAddr} of wallet ${address}`,
      found,
    );

    return parseInt(found.account.data.parsed.info.tokenAmount.amount);
  } catch (err) {
    console.log("[RUBIC] getTokenBalance ERROR ==>", err);
    return 0;
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
