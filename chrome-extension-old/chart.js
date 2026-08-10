function numberCalculations(best8, all20, worst8, drop8, range, stddev) {
  document.getElementById("best8").textContent = best8;
  document.getElementById("all20").value = all20;
  document.getElementById("drop8").value = drop8;
  document.getElementById("worst8").value = worst8;
  document.getElementById("range").value = range;
  document.getElementById("stddev").value = stddev;
  let wPos = (drop8 - best8) / range;
  let yPos = (worst8 - drop8) / range;
  setDotPositions(wPos, yPos);
}

// Define a function to set dot positions
function setDotPositions(whitePosition, yellowPosition) {
  document.documentElement.style.setProperty(
    "--dot-position-white",
    whitePosition
  );
  document.documentElement.style.setProperty(
    "--dot-position-yellow",
    yellowPosition
  );
}

// Add an event listener for DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
  numberCalculations(5.1, 8.4, 11.8, 8.5, 15.2, 3.6);
});

// Example logic to calculate positions
function calculateWhitePosition() {
  // Replace with your logic to determine whitePosition
  return "25%";
}

function calculateYellowPosition() {
  // Replace with your logic to determine yellowPosition
  return "10%";
}
