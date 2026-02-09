import { revertTokens } from "./solana/revert";
import { swapPrivately } from "./solana/solana";

async function main(): Promise<void> {
  await window.solana.connect();

  const swapBtn = document.querySelector(".btn-swap");
  const revertBtn = document.querySelector(".btn-revert");
  swapBtn.addEventListener("click", () => {
    swapPrivately();
  });
  revertBtn.addEventListener("click", () => {
    revertTokens();
  });
}

main().then().catch(console.error);
