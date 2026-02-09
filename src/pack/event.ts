export function listenClicks(target: HTMLElement): void {
  target.addEventListener("click", (e) => {
    console.log(`${target.className} clicked`, {
      x: e.clientX,
      y: e.clientY,
    });
  });
}

export function addRoute(el: HTMLElement, url: string): void {
  el.addEventListener("click", (e) => {
    window.location.assign(url);
  });
}
