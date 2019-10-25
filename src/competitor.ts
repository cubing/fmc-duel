import { Sequence, parse, BlockMove, algToString, algCubingNetLink } from "cubing/alg";
import { Twisty } from "cubing/twisty";
import { BluetoothPuzzle, connect, debugKeyboardConnect, MoveEvent } from "cubing/bluetooth";
import { experimentalShowJumpingFlash } from "cubing/twisty";
import { Puzzles, KPuzzle } from "cubing/kpuzzle";

const def = Puzzles["333"];

export class Competitor {
  moveCounter: number;
  sequence: Sequence;
  puzzle: KPuzzle;

  // state
  msRemaining: number = 0;
  lastRunningStart: number = 0;
  timeAtLastRunningStart: number = 0;
  running: boolean = false;

  element: HTMLElement = document.createElement("competitor");
  connectElem: HTMLElement = document.createElement("button");
  kbElem: HTMLElement = document.createElement("button");
  resetElem: HTMLElement = document.createElement("button");
  counterElem: HTMLElement = document.createElement("counter");
  movesElem: HTMLAnchorElement = document.createElement("a");
  // TODO: Let `twisty.js` create its elem.
  twistyElem: HTMLElement = document.createElement("twisty");

  twisty: Twisty;
  bluetoothPuzzles: BluetoothPuzzle[] = [];
  constructor() {
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
    competitorControlBar.appendChild(this.counterElem);
    competitorControlBar.appendChild(this.movesElem);
    this.movesElem.target = "_blank";

    this.element.appendChild(this.twistyElem);
  }

  reset(timeLimitMs: number) {
    this.updateMoveCounter(0);
    this.sequence = new Sequence([]);
    this.movesElem.textContent = "";
    this.movesElem.href = "";
    this.puzzle = new KPuzzle(def);

    this.msRemaining = timeLimitMs;
    this.running = false;
    this.twisty.experimentalSetAlg(this.sequence);
  }

  updateMoveCounter(n: number) {
    this.moveCounter = n;
    this.counterElem.textContent = this.moveCounter.toString();
  }

  async connect(keyboard: boolean) {
    console.log("connecting...")
    const bluetoothPuzzle = await (keyboard ? debugKeyboardConnect(this.twisty.experimentalGetPlayer().element) : connect());
    bluetoothPuzzle.addMoveListener(this.onmove.bind(this));
    this.bluetoothPuzzles.push(bluetoothPuzzle);
    console.log("connected!")
  }

  onmove(moveEvent: MoveEvent) {
    this.puzzle.applyBlockMove(moveEvent.latestMove);
    // this.svg.draw(def, this.puzzle.state);

    const newNestedUnits = this.sequence.nestedUnits.slice(0);
    const l = newNestedUnits.length;
    if (l > 0) {
      const move = newNestedUnits[l - 1] as BlockMove;
      // TODO: Check slices?
      if (move.family === moveEvent.latestMove.family && Math.sign(move.amount) === Math.sign(moveEvent.latestMove.amount)) {
        newNestedUnits.splice(-1);
        newNestedUnits.push(new BlockMove(
          move.outerLayer,
          move.innerLayer,
          move.family,
          move.amount + moveEvent.latestMove.amount
        ));
      } else {
        newNestedUnits.push(moveEvent.latestMove);
      }
    } else {
      newNestedUnits.push(moveEvent.latestMove);
    }
    this.sequence = new Sequence(newNestedUnits);
    this.twisty.experimentalSetAlg(this.sequence);
    this.updateMoveCounter(this.sequence.nestedUnits.length);
    this.movesElem.textContent = algToString(this.sequence);
    this.movesElem.href = algCubingNetLink({
      alg: this.sequence,
      title: "FMC Duel Test\n" + new Date().toString()
    })
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
