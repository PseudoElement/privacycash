import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { SOLANA_ADDRESS } from "./solana";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

export async function revertTokens() {
  const tokenAddr: string = document.querySelectorAll("input")[6].value;
  const amount: string = document.querySelectorAll("input")[8].value;
  const receiverAddr: string = document.querySelectorAll("input")[9].value;

  if (tokenAddr === SOLANA_ADDRESS) {
    return revertNative(Number(amount), receiverAddr);
  }
  return revertSPL(tokenAddr, receiverAddr);
}

function getKeypairFromSecret(): Keypair | null {
  const burnerSecretKey = localStorage.getItem("PRIVATE_KEY");
  const array = burnerSecretKey.split(",").map((s) => parseInt(s, 10));
  const secretKey = Uint8Array.from(array);

  return Keypair.fromSecretKey(secretKey);
}

async function revertNative(amount: number, receiverAddr: string) {
  const connection = new Connection(
    "https://x-api.rubic.exchange/sol_rpc?apikey=sndfje3u4b3fnNSDNFUSDNVSunw345842hrnfd3b4nt4",
  );

  // 2. Load sender keypair (replace with actual secret key)
  const burnerKeypair = getKeypairFromSecret();
  const recipientAddress = new PublicKey(receiverAddr);

  // 3. Create transaction instruction
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: burnerKeypair.publicKey,
      toPubkey: recipientAddress,
      lamports: amount * LAMPORTS_PER_SOL, // Amount in SOL
    }),
  );

  // 4. Sign, send and confirm
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    burnerKeypair,
  ]);

  console.log("Transaction signature:", signature);
}

async function revertSPL(tokenAddr: string, receiverAddr: string) {
  const connection = new Connection(
    "https://x-api.rubic.exchange/sol_rpc?apikey=sndfje3u4b3fnNSDNFUSDNVSunw345842hrnfd3b4nt4",
  );

  const senderKeypair = getKeypairFromSecret();
  const recipientAddress = new PublicKey(receiverAddr);
  const mintAddress = new PublicKey(tokenAddr);

  const decimals: string = document.querySelectorAll("input")[7].value;
  const revertAmount: string = document.querySelectorAll("input")[8].value;

  const transferAmount = Number(revertAmount);
  const tokenDecimals = Number(decimals);

  console.log("START");

  try {
    console.log("Get or create the sender's Associated Token Account (ATA)");
    // 1. Get or create the sender's Associated Token Account (ATA)
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      senderKeypair, // Payer for potential ATA creation
      mintAddress,
      senderKeypair.publicKey, // Owner of the ATA
    );

    console.log("Get or create the recipient's Associated Token Account (ATA)");
    // 2. Get or create the recipient's Associated Token Account (ATA)
    // The sender's keypair will pay for the creation if the recipient's ATA doesn't exist
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      senderKeypair, // Payer
      mintAddress,
      recipientAddress, // Owner of the ATA
    );

    console.log(
      "Create the transfer instruction (using the high-level 'transfer' function for simplicity)",
    );
    // 3. Create the transfer instruction (using the high-level 'transfer' function for simplicity)
    const signature = await transfer(
      connection,
      senderKeypair, // Payer of the transaction
      fromTokenAccount.address, // Source ATA
      toTokenAccount.address, // Destination ATA
      senderKeypair.publicKey, // Owner of the source ATA (must sign)
      transferAmount * Math.pow(10, tokenDecimals), // Amount in raw integers (accounting for decimals)
    );

    console.log("Token Transfer successful!");
    console.log(`Transaction signature: ${signature}`);
    console.log(
      `View on Explorer: https://explorer.solana.com{signature}?cluster=devnet`,
    );
  } catch (error) {
    console.error("Token transfer failed:", error);
  }
}
