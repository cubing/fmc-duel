// Code adapted from timer.cubing.net

function pad(number: number, numDigitsAfterPadding: number)
{
  var output = "" + number;
  while (output.length < numDigitsAfterPadding) {
    output = "0" + output;
  }
  return output;
}

function timeParts(time: number) {
  // Each entry is [minimum number of digits if not first, separator before, value]
  var hours   = Math.floor(time / (60 * 60 * 1000));
  var minutes = Math.floor(time / (     60 * 1000)) % 60;
  var seconds = Math.floor(time / (          1000)) % 60;

  var secFirstString = "";
  var secRestString;
  if (hours > 0) {
    secRestString = "" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2);
  } else if (minutes > 0) {
    secRestString = "" +                           minutes     + ":" + pad(seconds, 2);
  } else {
    secRestString = "" +                                                   seconds    ;
    if (secRestString[0] === "1") {
      secFirstString = "1";
      secRestString = secRestString.substr(1);
    }
  }

  var deciseconds = Math.floor((time % 1000) / 100);

  return {
    secFirst: secFirstString,
    secRest: secRestString,
    deciseconds: deciseconds
  };
}


export function formatTime(time: number | null): string {
  if (time === null) {
    return "---"
  }

  var parts = timeParts(time);
  return parts.secFirst + parts.secRest + "." + parts.deciseconds;
}
