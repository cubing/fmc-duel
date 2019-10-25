import ResizeObserver from "resize-observer-polyfill";

(window as any).ResizeObserver = ResizeObserver;

import { Competitor } from "./competitor";

let initialNumCompetitors = parseFloat(new URL(location.href).searchParams.get("numCompetitors") || "2");
if (isNaN(initialNumCompetitors)) {
  initialNumCompetitors = 2;
}

let initialTimeLimitSeconds = parseFloat(new URL(location.href).searchParams.get("timeLimit") || "120");
if (isNaN(initialTimeLimitSeconds)) {
  initialTimeLimitSeconds = 120;
}
const initialTimeLimitMs = initialTimeLimitSeconds * 1000;

declare global {
  interface Window {
    app: any
  }
}

type Phase = "ready" | "scrambling" | "solving";
type AppState = {
  currentCompetitor: 0,
  phase: Phase
}

export class FMCDuelApp {
  element: HTMLElement;
  competitorsElem: HTMLElement;
  state: AppState = {
    currentCompetitor: 0,
    phase: "ready"
  }
  competitors: Competitor[] = [];
  constructor() {
    this.element = document.querySelector("app");
    this.competitorsElem = this.element.querySelector("competitors");
    document.querySelector("#add-competitor").addEventListener("click", this.addCompetitor.bind(this));
    document.querySelector("#reset").addEventListener("click", this.reset.bind(this));

    (async () => {
      for (let i = 0; i < initialNumCompetitors; i++) {
        this.addCompetitor();
      }
    })();
  }

  async reset() {
    for (const competitor of this.competitors) {
      competitor.reset(initialTimeLimitMs);
    }
  }

  async addCompetitor(): Promise<Competitor> {
    const competitor = new Competitor();
    this.competitors.push(competitor);
    this.competitorsElem.appendChild(competitor.element);

    this.competitorsElem.style.gridTemplateColumns = (new Array(Math.ceil(Math.sqrt(this.competitors.length))).fill("1fr")).join(" ")
    return competitor;
  }
}
