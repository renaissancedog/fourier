// constants and variables
const SPEED=10; // period of the epicycles in seconds
const FPS=60;
let array = [];
let path = [];
let dftArray = [];
let drawing = false;
let t=0;

// setup and drawing code

function setup() {
  let cnv=createCanvas(800, 600);
  cnv.parent('canvas-container');
  background(0);
  strokeWeight(3);
  noFill();
  frameRate(FPS);
}

function clearCanvas() {
  background(0);
  array=[];
  path=[];
}

function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    drawing = true;
    clearCanvas();
  }
}

function mouseDragged() {
  if (!drawing) return;
  stroke(255);
  line(pmouseX, pmouseY, mouseX, mouseY);
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    drawing = false;
    return;
  }
  array.push([mouseX, mouseY]);
}

function mouseReleased() {
  if (!drawing) return;
  drawing = false;
  dftArray = dft(resample(array, array.length).map(([x, y]) => ({ x, y }))); 
  t=0;
  
  // update info and table
  document.getElementById("info").textContent = "Number of epicycles: " + dftArray.length;
  updateHtmlTable();
}

// draw loop
function draw() {
  if (drawing || array.length === 0) return;
  background(0);
  
  // redraw original path
  stroke(255,0,0);
  for (let i = 1; i < array.length; i++) {
    line(array[i - 1][0], array[i - 1][1], array[i][0], array[i][1]);
  }

  // draw the circles
  stroke(255);
  let x=0
  let y=0;
  t += (deltaTime / (SPEED * 1000)) * 2 * Math.PI;
  let currentPeriodTime = (millis() / 1000) % SPEED / SPEED * 2 * Math.PI;

  // the circle part
  for (let i = 0; i < dftArray.length; i++) {
    const amp = dftArray[i].amp;
    const freq = dftArray[i].freq;
    const phase = dftArray[i].phase;
    const N = dftArray.length;
    if (amp>1) {
      circle(x, y, amp * 2);
      line(x, y, x + amp * cos(-freq * t + phase), y + amp * sin(-freq * t + phase));
    }
    x += amp * cos(-freq * t + phase);
    y += amp * sin(-freq * t + phase);
  }
  path.push([x, y]);

  // draw the path
  stroke(0, 255, 0);
  for (let i = 1; i < path.length; i++) {
    line(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  }
  
  // reset path at end of cycle
  if (t > 2 * Math.PI && path.length > 10) { 
    path = [];
    t %= 2 * Math.PI;
  }
}

function updateHtmlTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  for (let i = 0; i < dftArray.length; i++) {
    const data = dftArray[i];
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${data.freq}</td>
      <td>${data.amp.toFixed(2)} px</td>
      <td>${data.phase.toFixed(4)} rad</td>
    `;
    tbody.appendChild(row);
  }
}

// resamples points equally along line
function resample(points, N) {
  // calculate total length of path 
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  
  let resampled=[];
  const segmentLength = totalLength / N;
  let currentLength = 0; // saves status for in btw points
  resampled.push(points[0]);

  // loop through points and resample
  for (let i=1; i<points.length; i++) {
    let x=points[i-1][0];
    let y=points[i-1][1];
    const dx=points[i][0] - x;
    const dy=points[i][1] - y;
    let length = Math.sqrt(dx*dx + dy*dy);

    if (segmentLength - currentLength > length) { // if current length is too short to fill in the gap
      currentLength += length;
      continue;
    } else { // otherwise, resolve current unfinished segment and add a new point
      x+=(segmentLength - currentLength)/length*dx;
      y+=(segmentLength - currentLength)/length*dy;
      resampled.push([x, y]);
      length-=(segmentLength - currentLength);
      currentLength = 0;
    }

    // fill in whole segments
    let numSegments = Math.floor(length/segmentLength);
    for (let j=0; j<numSegments; j++) {
      x+=(segmentLength/length)*dx;
      y+=(segmentLength/length)*dy;
      resampled.push([x, y]);
    }
    length = Math.sqrt((points[i][0] - x) ** 2 + (points[i][1] - y) ** 2);
    currentLength += length;
  }
  console.log(resampled);
  return resampled;
}

// the mathy part
// above N/2, the frequencies are actually negative, so we make that conversion here
function dft(path) {
  const N = path.length;
  let result = [];

  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;

    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // path[n] = {x, y} or {re, im}
      re += path[n].x * cos - path[n].y * sin;
      im += path[n].x * sin + path[n].y * cos;
    }

    let freq = k;
    if (freq > N / 2) {
      freq = freq - N;
    }
    result.push({
      freq: freq,
      amp: Math.sqrt(re*re + im*im) / N,
      phase: Math.atan2(im, re)
    });
  }

  result = result.sort((a, b) => b.amp - a.amp);
  console.log(result);
  return result;
}