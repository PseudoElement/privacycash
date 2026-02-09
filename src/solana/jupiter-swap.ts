import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";

const swapAgentUrl = "https://api3.privacycash.org/swap";

export type JupSwapResp = {
  /**
   * destination token amount after swap
   */
  outAmount: string;
  /**
   * base64 data
   */
  transaction: string;
  requestId: string;
};

export async function jupSwap(
  inputMint: PublicKey,
  outputMint: PublicKey,
  base_unites: number,
  burnerKeypair: Keypair,
  connection: Connection,
): Promise<JupSwapResp> {
  console.log("[RUBIC] buildSwapTx params", {
    inputMint: inputMint.toString(),
    outputMint: outputMint.toString(),
    base_unites,
    burnerKeypair: burnerKeypair.publicKey.toString(),
  });
  let orderResponse: JupSwapResp = await buildSwapTx(
    base_unites,
    inputMint.toString(),
    outputMint.toString(),
    burnerKeypair.publicKey.toString(),
  );

  const transaction = VersionedTransaction.deserialize(
    Buffer.from(orderResponse.transaction, "base64"),
  );

  // sign tx
  transaction.sign([burnerKeypair]);
  const signedTxBase64 = Buffer.from(transaction.serialize()).toString(
    "base64",
  );

  console.log("[RUBIC] makeSwapTx params", {
    signedTxBase64,
    requestId: orderResponse.requestId,
    burnerKeypair: burnerKeypair.publicKey.toString(),
  });
  // swap execute
  let makeSwapResp = await makeSwapTx(
    signedTxBase64,
    orderResponse.requestId,
    burnerKeypair,
  );
  console.log("[RUBIC] jupSwap_makeSwapTx resp", makeSwapResp);

  // await connection.confirmTransaction(tx, "confirmed");

  return orderResponse;
}

// get swap quote
export async function buildSwapTx(
  baseUnites: number,
  inputMint: string,
  outputMint: string,
  takerAddress = "",
): Promise<JupSwapResp> {
  if (baseUnites <= 0) {
    throw new Error("baseUnites must be greater than 0");
  }
  let params = {
    step: "build_tx",
    baseUnites: Math.floor(baseUnites),
    inputMint,
    outputMint,
    taker: takerAddress,
  };
  console.log(`[RUBIC] fetching ${swapAgentUrl} with params:`, params);

  let res = await fetch(swapAgentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  console.log("got response");

  let json = await res.json();
  if (
    !json.success ||
    json.orderResponse.error ||
    !json.orderResponse.outAmount
  ) {
    console.log("[RUBIC] buildSwapTx error", json);
    await new Promise((res) => setTimeout(res, 1_000));
    console.log("[RUBIC] RETRYING buildSwapTx...");
    return buildSwapTx(baseUnites, inputMint, outputMint, takerAddress);
  }

  console.log("[RUBIC] buildSwapTx success", json.orderResponse);

  return json.orderResponse;
}

// make tx
async function makeSwapTx(
  signedTransaction: string,
  requestId: string,
  burnerKeypair: Keypair,
) {
  let res = await fetch(swapAgentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      step: "send_tx",
      requestId,
      signedTransaction,
      taker: burnerKeypair.publicKey.toString(),
    }),
  });

  let json = await res.json();
  if (!json.success) {
    await new Promise((res) => setTimeout(res, 1_000));
    console.log("[RUBIC] RETRYING makeSwapTx...");
    return makeSwapTx(signedTransaction, requestId, burnerKeypair);
  }

  console.log("[RUBIC] makeSwapTx success", json);

  return json.exeRes.signature;
}
