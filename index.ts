import {debugKeyboardConnect} from "cuble"
import {Transformation} from "kpuzzle"

console.log("foo")


function print(t: Transformation) {
    console.log(
  '%c██%c██%c%c██%c\n%c██%c%c██',
  'border: 1px solid #fff; background: white; color: white',
  'border: 1px solid black; background: red; color: red',
  '',
  'border: 1px solid black; background: blue; color: blue',
  '',
  'border: 1px solid black; background: orange; color: orange',
  ' ',
  'border: 1px solid black; background: #DDDDDD; color: #DDDDDD');
}

declare global {
  interface Window {
    puzzle1: any
  }
}

async function main() { 
  const puzzle1 = await debugKeyboardConnect();
  window.puzzle1 = puzzle1;
}

window.addEventListener("load", main);
