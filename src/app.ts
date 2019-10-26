import ResizeObserver from "resize-observer-polyfill";

(window as any).ResizeObserver = ResizeObserver;

import { Competitor, Status } from "./competitor";

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

enum Phase {
  Ready = "ready",
  Scrambling = "scrambling",
  Solving = "solving"
}
type AppState = {
  currentCompetitor: 0,
  phase: Phase
}

export class FMCDuelApp {
  element: HTMLElement;
  competitorsElem: HTMLElement;
  currentCompetitorIdx: number = 0;
  phase: Phase = Phase.Ready;
  competitors: Competitor[] = [];
  constructor() {
    this.element = document.querySelector("app");
    this.competitorsElem = this.element.querySelector("competitors");
    document.querySelector("#add-competitor").addEventListener("click", this.addCompetitor.bind(this));
    document.querySelector("#reset").addEventListener("click", this.reset.bind(this));
    document.querySelector("#start").addEventListener("click", this.startRound.bind(this));

    (async () => {
      for (let i = 0; i < initialNumCompetitors; i++) {
        this.addCompetitor();
      }
    })();
  }

  reset(): void {
    for (const competitor of this.competitors) {
      competitor.reset(initialTimeLimitMs);
    }
    this.currentCompetitorIdx = 0;
    this.phase = Phase.Ready;
  }

  incrementCompetitorIdx(): void {
    this.currentCompetitorIdx = (this.currentCompetitorIdx + 1) % this.competitors.length
  }

  competitorDeltaFromCurrent(delta: number): Competitor {
    return this.competitors[(this.currentCompetitorIdx + this.competitors.length + delta) % this.competitors.length];
  }

  startRound(): void {
    if (this.competitors.length < 2) {
      throw new Error("Need at least two competitors.");
    }
    this.reset(); // TODO: Can we eliminate this?
    this.competitorDeltaFromCurrent(-1).setBeingScrambled();
    this.competitorDeltaFromCurrent(0).setScrambling();
    this.phase = Phase.Scrambling;
    requestAnimationFrame(this.animFrame.bind(this));
    this.debugLog(0);
  }

  animFrame(): void {
    this.competitors.map(c => {
      switch (c.status) {
        case Status.Scrambling:
        case Status.TakingTurn:
          c.updateTime()
          break;
        default:
          // Nothing
          break;
      }
    });
    requestAnimationFrame(this.animFrame.bind(this));
  }

  turnDone(competitorIdx: number): void {
    if (this.currentCompetitorIdx !== competitorIdx) {
      console.log("Unexpected competitor index:", competitorIdx);
      return;
    }

    switch (this.phase) {
      case Phase.Scrambling:
        if (this.currentCompetitorIdx < this.competitors.length - 1) {
          if (this.competitors.length > 2) {
            this.competitorDeltaFromCurrent(-1).setWaiting();
          }
          this.competitorDeltaFromCurrent(0).setBeingScrambled();
          this.competitorDeltaFromCurrent(1).setScrambling();
          this.incrementCompetitorIdx();
        } else {
          if (this.competitors.length > 2) {
            this.competitorDeltaFromCurrent(-1).setWaiting();
          }
          this.competitorDeltaFromCurrent(0).setWaiting();
          this.competitorDeltaFromCurrent(1).setTakingTurn();
          this.phase = Phase.Solving;
          this.incrementCompetitorIdx();
        }
        break;
      case Phase.Solving:
        this.competitorDeltaFromCurrent(0).setWaiting();
        this.competitorDeltaFromCurrent(1).setTakingTurn();
        this.incrementCompetitorIdx();
        break;
      default:
        throw new Error("Unimplemented");
    }
    this.debugLog(competitorIdx);
  }

  debugLog(competitorIdx: number) {
    console.table({
      phase: this.phase,
      currentCompetitorIdx: this.currentCompetitorIdx,
      competitorIdx: competitorIdx,
      statuses: this.competitors.map(c => c.status),
      msRemainings: this.competitors.map(c => c.msRemaining)
    })
  }

  async addCompetitor(): Promise<Competitor> {
    const competitor = new Competitor("Space", this.turnDone.bind(this, this.competitors.length));
    this.competitors.push(competitor);
    this.competitorsElem.appendChild(competitor.element);

    this.competitorsElem.style.gridTemplateColumns = (new Array(Math.ceil(Math.sqrt(this.competitors.length))).fill("1fr")).join(" ")
    return competitor;
  }
}
