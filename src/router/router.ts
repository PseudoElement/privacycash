import { addRoute, listenClicks } from "../pack/event";

export async function routerManager(): Promise<void> {
  switch (window.location.pathname) {
    case "/login":
      return loginPage();
    default:
      return mainPage();
  }
}

async function mainPage(): Promise<void> {
  // listenClicks(document.querySelector(".deposit"));
  // listenClicks(document.querySelector(".withdraw"));
  // addRoute(document.querySelector(".withdraw"), "http://localhost:8080/login");
}

async function loginPage(): Promise<void> {
  console.log("we are on login page");
}
