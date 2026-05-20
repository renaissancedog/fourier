// constants and variables
const FPS=240;
const ANIMATE_THRESHOLD = 0.5; // amplitude at below which we don't animate the specific circle
let amp_threshold=0.99; // after finding all dft amplitudes, only take those with cumulative sum greater than this
let speed=10; // period of the epicycles in seconds
let mouseArray = []; // array of mouse coordinates
let path = []; // path of the epicycles
let dftArray = []; // array of dft results
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
  mouseArray=[];
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
    mouseReleased();
    return;
  }
  mouseArray.push([mouseX, mouseY]);
}

function mouseReleased() {
  if (!drawing) return;
  drawing = false;
  amp_threshold = document.getElementById('accuracy_slider').value;
  speed = document.getElementById('speed_slider').value;
  dftArray = dft(resample(mouseArray, mouseArray.length).map(([x, y]) => ({ x, y })), amp_threshold); 
  t=0;
  path=[];
  
  // update info and table
  document.getElementById("info").textContent = "Number of epicycles: " + dftArray.length;
  updateHtmlTable();
}

// mobile support
function touchEnded() { mouseReleased(); return false;}
function touchStarted() {
  if (touches[0].x > 0 && touches[0].x < width && 
      touches[0].y > 0 && touches[0].y < height) {
    mousePressed();
    return false;
  }
  return;
}

function touchMoved() {
  if (!drawing) return;
  mouseDragged();
  return false;
}

// draw loop
function draw() {
  if (drawing || mouseArray.length === 0) return;
  background(0);
  
  // redraw original path
  stroke(255,0,0);
  for (let i = 1; i < mouseArray.length; i++) {
    line(mouseArray[i - 1][0], mouseArray[i - 1][1], mouseArray[i][0], mouseArray[i][1]);
  }

  // draw the circles
  stroke(255);
  let x=0
  let y=0;
  t += (deltaTime / (speed * 1000)) * 2 * Math.PI;
  let currentPeriodTime = (millis() / 1000) % speed / speed * 2 * Math.PI;

  // the circle part
  for (let i = 0; i < dftArray.length; i++) {
    const amp = dftArray[i].amp;
    const freq = dftArray[i].freq;
    const phase = dftArray[i].phase;
    const N = dftArray.length;
    if (amp>ANIMATE_THRESHOLD) {
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
      <td>${data.amp.toFixed(4)} px</td>
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
  return resampled;
}

// the mathy part
// above N/2, we represent the frequencies as a small negative instead of a large positive, so we make that conversion here
function dft(path, amp_threshold) {
  const N = path.length;
  let result = [];

  // for every frequency
  for (let f = 0; f < N; f++) {
    let re = 0, im = 0;

    // for every point in the path given
    for (let n = 0; n < N; n++) {
      // calculate angle
      const angle = -2 * Math.PI * f * n / N;

      // now we do f(x) * path[n] = (x+i*y)(cos+i*sin) = (x*cos-y*sin + i*(x*sin+y*cos))
      // this is because of dft math
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      re += path[n].x * cos - path[n].y * sin;
      im += path[n].x * sin + path[n].y * cos;
    }
    re /= N;
    im /= N;

    let freq = f;
    if (freq > N / 2) {
      freq = freq - N;
    }
    result.push({
      freq: freq,
      amp: Math.sqrt(re*re + im*im),
      phase: Math.atan2(im, re)
    });
  }

  result = result.sort((a, b) => b.amp - a.amp);
  totalAmp = result.reduce((sum, val) => sum + val.amp, 0);
  cutoff = amp_threshold * totalAmp;
  let cumulativeAmp = 0;
  result = result.filter((val) => {
    cumulativeAmp += val.amp;
    return cumulativeAmp <= cutoff;
  });

  return result;
}

document.getElementById('accuracy_slider').oninput = function() {
  drawing = true;
  document.getElementById('accuracy_out').textContent = Math.round(this.value * 1000)/10 + '%';
  mouseReleased(); // recalculate DFT with new threshold
}

document.getElementById('speed_slider').oninput = function() {
  drawing = true;
  document.getElementById('speed_out').textContent = Math.round(this.value * 10)/10 + ' seconds';
  mouseReleased(); // rerun drawing loop
}