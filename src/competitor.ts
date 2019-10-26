import { Sequence, parse, BlockMove, algToString, algCubingNetLink } from "cubing/alg";
import { Twisty } from "cubing/twisty";
import { BluetoothPuzzle, connect, debugKeyboardConnect, MoveEvent } from "cubing/bluetooth";
import { experimentalShowJumpingFlash } from "cubing/twisty";
import { Puzzles, KPuzzle, EquivalentStates, Transformation } from "cubing/kpuzzle";
import { formatTime } from "./stats";
import { FMCDuelApp, debug } from "./app";

const def = Puzzles["333"];

export enum Status {
  Inactive = "inactive",
  BeingScrambled = "beingScrambled",
  Scrambling = "scrambling",
  Waiting = "waiting",
  TakingTurn = "takingTurn",
  Won = "won",
  Lost = "lost",
  Tied = "tied"
}

export class Competitor {
  moveCounter: number = 0;
  sequence: Sequence;
  puzzle: KPuzzle;

  // state
  status: Status = Status.Inactive;
  msRemaining: number = 0;
  lastRunningStart: number = 0;
  msRemainingAtLastRunningStart: number = 0;

  element: HTMLElement = document.createElement("competitor");
  connectElem: HTMLElement = document.createElement("button");
  kbElem: HTMLElement = document.createElement("button");
  counterElem: HTMLElement = document.createElement("counter");
  timeElem: HTMLElement = document.createElement("time");
  // movesElem: HTMLAnchorElement = document.createElement("a");
  // TODO: Let `twisty.js` create its elem.
  twistyElem: HTMLElement = document.createElement("twisty");

  twisty: Twisty;
  bluetoothPuzzles: BluetoothPuzzle[] = [];
  private turnDoneHandler = this.turnDone.bind(this);
  currentMove: BlockMove | null = null;

  constructor(private app: FMCDuelApp, private idx: number, private turnDoneKey: string, initialTimeLimitMs: number) {
    experimentalShowJumpingFlash(false);
    this.twisty = new Twisty(this.twistyElem, {
      puzzle: def,
      alg: parse(""),
      playerConfig: {
        experimentalShowControls: false,
        experimentalCube3DViewConfig: {
          experimentalShowBackView: false
        }
      }
    });
    this.reset(initialTimeLimitMs);

    const competitorControlBar = document.createElement("competitor-control-bar");
    this.element.appendChild(competitorControlBar);
    this.displayTime();

    competitorControlBar.appendChild(this.counterElem);
    competitorControlBar.appendChild(this.timeElem);

    this.element.appendChild(this.twistyElem);
  }

  public reset(timeLimitMs: number): void {
    console.log("reset");
    this.updateMoveCounter(0);
    this.sequence = new Sequence([]);
    this.puzzle = new KPuzzle(def);

    this.msRemaining = timeLimitMs;
    this.setStatus(Status.Inactive);
    this.twisty.experimentalSetAlg(this.sequence);
    this.displayTime();
  }

  public async connect(keyboard: boolean) {
    console.log("connecting...")
    const bluetoothPuzzle = await (keyboard ? debugKeyboardConnect(this.twisty.experimentalGetPlayer().element) : connect());
    bluetoothPuzzle.addMoveListener(this.onMove.bind(this));
    this.bluetoothPuzzles.push(bluetoothPuzzle);
    console.log("connected!")
  }

  public setWaiting(): void {
    switch (this.status) {
      case Status.Inactive:
      case Status.BeingScrambled:
      case Status.Scrambling:
      case Status.TakingTurn:
      case Status.Waiting:
        this.stopTimer();
        this.setStatus(Status.Waiting);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public setScrambling(): void {
    switch (this.status) {
      case Status.Inactive:
      case Status.BeingScrambled:
      case Status.Waiting:
        this.startTimer();
        this.setStatus(Status.Scrambling);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public setBeingScrambled(): void {
    switch (this.status) {
      case Status.Inactive:
      case Status.Waiting:
      case Status.Scrambling:
        this.setStatus(Status.BeingScrambled);
        if (debug) {
          this.twisty.experimentalGetPlayer().cube3DView.element.focus()
        }
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public setTakingTurn(): void {
    switch (this.status) {
      case Status.Waiting:
      case Status.Scrambling:
      case Status.BeingScrambled:
        this.startTimer();
        this.setStatus(Status.TakingTurn);
        if (debug) {
          this.twisty.experimentalGetPlayer().cube3DView.element.focus()
        }
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public setWon(): void {
    switch (this.status) {
      case Status.TakingTurn:
      case Status.Waiting:
        this.stopTimer();
        this.setStatus(Status.Won);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public setLost(): void {
    switch (this.status) {
      case Status.TakingTurn:
      case Status.Waiting:
        this.stopTimer();
        this.setStatus(Status.Lost);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public setTied(): void {
    switch (this.status) {
      case Status.Waiting:
      case Status.Scrambling:
      case Status.BeingScrambled:
      case Status.TakingTurn:
        this.stopTimer();
        this.setStatus(Status.Tied);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  private setStatus(status: Status): void {
    this.status = status;
    this.element.setAttribute("class", ""); // TODO: Leave unknown classes untouched.
    this.element.classList.add(status);
  }

  private updateMoveCounter(n: number) {
    this.moveCounter = n;
    this.counterElem.textContent = this.moveCounter.toString();
  }

  private turnDone(event: KeyboardEvent): void {
    console.log(event.code);
    if (event.code === this.turnDoneKey) {
      switch (this.status) {
        case Status.Scrambling:
        case Status.TakingTurn:
          event.preventDefault();
          this.setStatus(Status.Waiting);
          console.log("removing listener", this.turnDoneKey)
          window.removeEventListener("keyup", this.turnDoneHandler);
          this.currentMove = null;
          this.app.turnDone(this.idx);
          break;
        // default:
        //   throw new Error(`Unexpected status! ${this.status}`);
      }
    }
  }

  private listenForTurnDone(): void {
    console.log("listening", this.msRemaining, this.turnDoneKey);
    window.addEventListener("keyup", this.turnDoneHandler)
  }

  private startTimer(): void {
    switch (this.status) {
      case Status.Inactive:
      case Status.BeingScrambled:
      case Status.TakingTurn:
      case Status.Waiting:
        this.lastRunningStart = Date.now();
        this.msRemainingAtLastRunningStart = this.msRemaining;
        console.log({
          lastRunningStart: this.lastRunningStart,
          msRemainingAtLastRunningStart: this.msRemainingAtLastRunningStart
        })
        this.listenForTurnDone();
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public updateTime(): void {
    switch (this.status) {
      case Status.Scrambling:
      case Status.TakingTurn:
      case Status.Waiting:
        const currentTime = Date.now();
        this.msRemaining = this.msRemainingAtLastRunningStart - (currentTime - this.lastRunningStart);
        if (this.msRemaining <= 0) {
          this.msRemaining = 0;
          this.setStatus(Status.Lost);
        }
        this.displayTime();
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  private displayTime(): void {
    switch (this.status) {
      case Status.Inactive:
      case Status.BeingScrambled:
      case Status.Scrambling:
      case Status.TakingTurn:
      case Status.Lost:
      case Status.Waiting:
        this.timeElem.textContent = formatTime(this.msRemaining);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  private stopTimer(): void {
    switch (this.status) {
      case Status.Waiting:
      case Status.Scrambling:
      case Status.BeingScrambled:
      case Status.TakingTurn:
        this.updateTime();
        break;
      case Status.Inactive:
      case Status.Lost:
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  private incrementMoveCounter(): void {
    this.updateMoveCounter(this.moveCounter + 1);
    this.displayMoveCounter();
  }

  private displayMoveCounter(): void {
    this.counterElem.textContent = this.moveCounter.toString();
  }

  private isSolved(): boolean {
    const state: Transformation = this.puzzle.state;
    // TODO: Implement a proper comparison that ignores center orientation.
    for (var i = 0; i < 6; i++) {
      state["CENTER"].orientation[i] = 0;
    }
    return EquivalentStates(Puzzles["333"], state, Puzzles["333"].startPieces);
  }

  private onMove(moveEvent: MoveEvent) {
    this.puzzle.applyBlockMove(moveEvent.latestMove);
    this.twisty.experimentalAddMove(moveEvent.latestMove);
    switch (this.status) {
      case Status.Inactive: // TODO
      case Status.BeingScrambled:
        break;
      case Status.TakingTurn:
        if (this.currentMove === null) {
          this.incrementMoveCounter();
          this.currentMove = moveEvent.latestMove
        } else {
          // TODO: This assumes that we're only using outer slices.
          if (this.currentMove.family !== moveEvent.latestMove.family) {
            this.setLost();
            this.app.setLost(this.idx);
          }
        }
        if (this.isSolved()) {
          this.setWon();
          this.app.setWon(this.idx);
        }
        break;
      case Status.Waiting:
        this.setLost();
        this.app.setLost(this.idx);
        break;
      case Status.Scrambling:
        this.setTied();
        this.app.setTied(this.idx);
        break;
      default:
        console.error(new Error(`Unexpected status! ${this.status}`));
    }
  }
}

// function isSolution(s: Transformation, a: Sequence): boolean {
//   const puzzle = new KPuzzle(def);
//   puzzle.applyAlg(invert(a));
//   for (var i = 0; i < 6; i++) {
//     puzzle.state["CENTER"].orientation[i] = 0;
//     s["CENTER"].orientation[i] = 0;
//   }
//   return EquivalentStates(def, puzzle.state, s);
// }
