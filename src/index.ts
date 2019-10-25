import {FMCDuelApp} from "./app"

declare global {
  interface Window {
    app: any
  }
}

window.addEventListener("load", function() {
  window.app = new FMCDuelApp();
});
