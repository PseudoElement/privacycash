import { routerManager } from "./router/router";
import { swapPrivately } from "./solana/solana";

async function main(): Promise<void> {
  routerManager();

  await window.solana.connect();

  const swapBtn = document.querySelector(".btn-swap");
  swapBtn.addEventListener("click", () => {
    swapPrivately();
  });

  // listenClicks(document.querySelector(".btn-deposit"));
}

main().then().catch(console.error);
