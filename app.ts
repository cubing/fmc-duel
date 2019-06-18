import {debugKeyboardConnect, connect, BluetoothPuzzle, MoveEvent} from "cuble"
import {invert, Sequence, BlockMove, algToString, algCubingNetLink, parse} from "alg"
import {Transformation, Puzzles, KPuzzle, EquivalentStates} from "kpuzzle"
import {Twisty, experimentalShowJumpingFlash} from "twisty"

const def = Puzzles["333"];

declare global {
  interface Window {
    app: any
  }
}

type Mode = "ready" | "running" | "done"
type AppState = {
  numPlayers: number
  mode: Mode
}

function isSolution(s: Transformation, a: Sequence): boolean {
  const puzzle = new KPuzzle(def);
  puzzle.applyAlg(invert(a));
  for (var i = 0; i < 6; i++) {
    puzzle.state["CENTER"].orientation[i] = 0;
    s["CENTER"].orientation[i] = 0;
  }
  return EquivalentStates(def, puzzle.state, s);
}

class Player {
  moveCounter: number;
  sequence: Sequence;
  puzzle: KPuzzle;

  element: HTMLElement = document.createElement("player");
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
      alg: parse("R4")
    });
    this.reset();
    this.connectElem.textContent = "BT";
    this.connectElem.addEventListener("click", this.connect.bind(this, false));
    this.element.appendChild(this.connectElem);
    this.kbElem.textContent = "KB";
    this.kbElem.addEventListener("click", this.connect.bind(this, true));
    this.element.appendChild(this.kbElem);
    this.resetElem.textContent = "Reset";
    this.resetElem.addEventListener("click", this.reset.bind(this));
    this.element.appendChild(this.resetElem);
    this.element.appendChild(this.counterElem);
    this.element.appendChild(this.movesElem);
    this.movesElem.target = "_blank";

    this.element.appendChild(this.twistyElem);
  }

  reset() {
    this.updateMoveCounter(0);
    this.sequence = new Sequence([]);
    this.movesElem.textContent = "";
    this.movesElem.href = "";
    this.puzzle = new KPuzzle(def);
  }

  updateMoveCounter(n: number) {
    this.moveCounter = n;
    this.counterElem.textContent = this.moveCounter.toString();
  }

  async connect(keyboard: boolean) {
    console.log("connecting...")
    const bluetoothPuzzle = await (keyboard ? debugKeyboardConnect() : connect());
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

export class FMCDuelApp {
  element: HTMLElement;
  playersElem: HTMLElement;
  state: AppState = {
    numPlayers: 0,
    mode: "ready"
  }
  players: Player[] = [];
  constructor() {
    this.element = document.querySelector("app");
    this.playersElem = this.element.querySelector("players");
    document.querySelector("#add-player").addEventListener("click", this.addPlayer.bind(this));

    this.addPlayer();
    this.players[0].connect(true);
  }

  async addPlayer() {
    const player = new Player();
    this.players.push(player);
    this.playersElem.appendChild(player.element);

    this.playersElem.style.gridTemplateColumns = (new Array(Math.ceil(Math.sqrt(this.players.length))).fill("1fr")).join(" ")
  }
}