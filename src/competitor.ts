import { Sequence, parse, BlockMove, algToString, algCubingNetLink } from "cubing/alg";
import { Twisty } from "cubing/twisty";
import { BluetoothPuzzle, connect, debugKeyboardConnect, MoveEvent } from "cubing/bluetooth";
import { experimentalShowJumpingFlash } from "cubing/twisty";
import { Puzzles, KPuzzle } from "cubing/kpuzzle";
import { formatTime } from "./stats";

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
  moveCounter: number;
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
  resetElem: HTMLElement = document.createElement("button");
  counterElem: HTMLElement = document.createElement("counter");
  timeElem: HTMLElement = document.createElement("span");
  movesElem: HTMLAnchorElement = document.createElement("a");
  // TODO: Let `twisty.js` create its elem.
  twistyElem: HTMLElement = document.createElement("twisty");

  twisty: Twisty;
  bluetoothPuzzles: BluetoothPuzzle[] = [];
  private turnDoneHandler = this.turnDone.bind(this);

  constructor(private turnDoneKey: string, private turnDoneCallback: () => void) {
    experimentalShowJumpingFlash(false);
    this.twisty = new Twisty(this.twistyElem, {
      puzzle: def,
      alg: parse("R4"),
      playerConfig: {
        experimentalShowControls: false,
        experimentalCube3DViewConfig: {
          experimentalShowBackView: false
        }
      }
    });
    this.reset(0);

    const competitorControlBar = document.createElement("competitor-control-bar");
    this.element.appendChild(competitorControlBar);

    this.connectElem.textContent = "BT";
    this.connectElem.addEventListener("click", this.connect.bind(this, false));
    competitorControlBar.appendChild(this.connectElem);

    this.kbElem.textContent = "KB";
    this.kbElem.addEventListener("click", this.connect.bind(this, true));
    competitorControlBar.appendChild(this.kbElem);

    this.resetElem.textContent = "Reset";
    this.resetElem.addEventListener("click", this.reset.bind(this));
    competitorControlBar.appendChild(this.resetElem);

    this.timeElem.textContent = "0:00.0";

    competitorControlBar.appendChild(this.counterElem);
    competitorControlBar.appendChild(this.timeElem);
    competitorControlBar.appendChild(this.movesElem);
    this.movesElem.target = "_blank";

    this.element.appendChild(this.twistyElem);
  }

  public reset(timeLimitMs: number): void {
    console.log("reset");
    this.updateMoveCounter(0);
    this.sequence = new Sequence([]);
    this.movesElem.textContent = "";
    this.movesElem.href = "";
    this.puzzle = new KPuzzle(def);

    this.msRemaining = timeLimitMs;
    this.status = Status.Inactive;
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
        this.status = Status.Waiting;
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
        this.status = Status.Scrambling;
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
        this.status = Status.BeingScrambled;
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
        this.status = Status.TakingTurn;
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
        this.status = Status.Won;
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
        this.status = Status.Lost;
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
        this.status = Status.Tied;
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  public updateMoveCounter(n: number) {
    this.moveCounter = n;
    this.counterElem.textContent = this.moveCounter.toString();
  }

  private turnDone(event: KeyboardEvent): void {
    console.log(event.code);
    if (event.code === this.turnDoneKey) {
      switch (this.status) {
        case Status.Scrambling:
        case Status.TakingTurn:
          // this.status = Status.Waiting
          console.log("removing listener", this.turnDoneKey)
          window.removeEventListener("keyup", this.turnDoneHandler);
          this.turnDoneCallback();
          break;
        // default:
        //   throw new Error(`Unexpected status! ${this.status}`);
      }
    }
  }

  private listenForTurnDone(): void {
    console.log("listening", this.turnDoneKey);
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
        const currentTime = Date.now();
        this.msRemaining = this.msRemainingAtLastRunningStart - (currentTime - this.lastRunningStart);
        if (this.msRemaining <= 0) {
          this.msRemaining = 0;
          this.status = Status.Lost;
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
        this.timeElem.textContent = formatTime(this.msRemaining);
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  private stopTimer(): void {
    switch (this.status) {
      case Status.Inactive:
      case Status.BeingScrambled:
      case Status.Scrambling:
      case Status.TakingTurn:
      case Status.Lost:
      case Status.Waiting:
        this.updateTime();
        break;
      default:
        throw new Error(`Unexpected status! ${this.status}`);
    }
  }

  private onMove(moveEvent: MoveEvent) {
    this.puzzle.applyBlockMove(moveEvent.latestMove);
    this.twisty.experimentalAddMove(moveEvent.latestMove);
    switch (this.status) {
      case Status.Inactive: // TODO
      case Status.BeingScrambled:
        break;
      case Status.TakingTurn:
        this.turnDoneCallback();
        break;
      case Status.Waiting:
        this.setLost();
        break;
      case Status.Scrambling:
        this.setTied();
        break;
      default:
        console.error(new Error(`Unexpected status! ${this.status}`));
    }

  //   this.puzzle.applyBlockMove(moveEvent.latestMove);
  //   // this.svg.draw(def, this.puzzle.state);

  //   const newNestedUnits = this.sequence.nestedUnits.slice(0);
  //   const l = newNestedUnits.length;
  //   if (l > 0) {
  //     const move = newNestedUnits[l - 1] as BlockMove;
  //     // TODO: Check slices?
  //     if (move.family === moveEvent.latestMove.family && Math.sign(move.amount) === Math.sign(moveEvent.latestMove.amount)) {
  //       newNestedUnits.splice(-1);
  //       newNestedUnits.push(new BlockMove(
  //         move.outerLayer,
  //         move.innerLayer,
  //         move.family,
  //         move.amount + moveEvent.latestMove.amount
  //       ));
  //     } else {
  //       newNestedUnits.push(moveEvent.latestMove);
  //     }
  //   } else {
  //     newNestedUnits.push(moveEvent.latestMove);
  //   }
  //   this.sequence = new Sequence(newNestedUnits);
  //   this.twisty.experimentalSetAlg(this.sequence);
  //   this.updateMoveCounter(this.sequence.nestedUnits.length);
  //   this.movesElem.textContent = algToString(this.sequence);
  //   this.movesElem.href = algCubingNetLink({
  //     alg: this.sequence,
  //     title: "FMC Duel Test\n" + new Date().toString()
  //   })
  // }
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
