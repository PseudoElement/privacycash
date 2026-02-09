import { swapPrivately } from "./solana/solana";

async function main(): Promise<void> {
  await window.solana.connect();

  const swapBtn = document.querySelector(".btn-swap");
  swapBtn.addEventListener("click", () => {
    swapPrivately();
  });
}

main().then().catch(console.error);
