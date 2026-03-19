let drops = [];
let rippleGraphics;
let bgGraphics;

let audioCtx = null;
let lastHoverSound = 0;
let hoverWasInside = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  rippleGraphics = createGraphics(width, height);
  rippleGraphics.pixelDensity(1);

  bgGraphics = createGraphics(width, height);
  bgGraphics.pixelDensity(1);
  drawBackground();

  for (let i = 0; i < 24; i++) {
    addDrop(random(width), random(height * 0.35, height * 0.92), random(0.2, 1.6));
  }
}

function draw() {
  image(bgGraphics, 0, 0);

  drawRain();

  if (random() < 0.22) {
    addDrop(random(width), random(height * 0.4, height * 0.92), random(0.6, 1.2));
  }

  rippleGraphics.clear();

  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].update();
    drops[i].display(rippleGraphics);
    if (drops[i].dead) drops.splice(i, 1);
  }

  image(rippleGraphics, 0, 0);

  drawSurfaceGlow();
  drawVignette();

  let inside = insidePuddle(mouseX, mouseY);
  if (inside && !hoverWasInside) {
    playDropletSound(0.9);
  }
  hoverWasInside = inside;
}

function mouseMoved() {
  ensureAudio();

  if (insidePuddle(mouseX, mouseY) && frameCount % 2 === 0) {
    addDrop(mouseX + random(-6, 6), mouseY + random(-4, 4), random(0.9, 1.4));

    if (millis() - lastHoverSound > 65) {
      playDropletSound(random(0.5, 1.0));
      lastHoverSound = millis();
    }
  }
}

function mouseDragged() {
  ensureAudio();

  if (insidePuddle(mouseX, mouseY)) {
    addDrop(mouseX + random(-8, 8), mouseY + random(-5, 5), random(1.0, 1.5));

    if (millis() - lastHoverSound > 55) {
      playDropletSound(random(0.55, 1.05));
      lastHoverSound = millis();
    }
  }
}

function mousePressed() {
  ensureAudio();
  if (insidePuddle(mouseX, mouseY)) {
    addDrop(mouseX, mouseY, 1.25);
    playDropletSound(1.1);
  }
}

function touchStarted() {
  ensureAudio();
  if (insidePuddle(mouseX, mouseY)) {
    addDrop(mouseX, mouseY, 1.25);
    playDropletSound(1.1);
  }
  return false;
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playDropletSound(intensity = 1) {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0, now);
  master.connect(audioCtx.destination);

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(random(700, 1400), now);
  bandpass.Q.setValueAtTime(1.4, now);
  bandpass.connect(master);

  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(500, now);
  hp.connect(bandpass);

  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.8);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.connect(hp);

  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(random(900, 1500), now);
  osc.frequency.exponentialRampToValueAtTime(random(280, 450), now + 0.09);
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.exponentialRampToValueAtTime(0.05 * intensity, now + 0.006);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  osc.connect(oscGain);
  oscGain.connect(master);

  master.gain.linearRampToValueAtTime(0.08 * intensity, now + 0.004);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  noise.start(now);
  noise.stop(now + 0.08);

  osc.start(now);
  osc.stop(now + 0.11);
}

function addDrop(x, y, strength = 1) {
  drops.push(new Ripple(x, y, strength));
}

function insidePuddle(x, y) {
  let cx = width * 0.5;
  let cy = height * 0.68;
  let rx = width * 0.42;
  let ry = height * 0.2;

  let dx = (x - cx) / rx;
  let dy = (y - cy) / ry;
  return dx * dx + dy * dy < 1;
}

class Ripple {
  constructor(x, y, strength) {
    this.x = x;
    this.y = y;
    this.strength = strength;
    this.rings = [];
    this.age = 0;
    this.maxAge = int(random(80, 130) * strength);

    let ringCount = int(random(2, 4));
    for (let i = 0; i < ringCount; i++) {
      this.rings.push({
        r: i * random(3, 7),
        speed: random(1.3, 2.3) * strength,
        alpha: random(70, 120),
        weight: random(0.7, 1.6),
        stretchX: random(1.2, 1.65),
        stretchY: random(0.55, 0.9)
      });
    }

    this.splashAlpha = 120 * strength;
    this.dead = false;
  }

  update() {
    this.age++;

    for (let ring of this.rings) {
      ring.r += ring.speed;
      ring.alpha *= 0.972;
    }

    this.splashAlpha *= 0.92;

    if (this.age > this.maxAge) {
      this.dead = true;
    }
  }

  display(g) {
    g.push();
    g.noFill();
    g.translate(this.x, this.y);

    if (this.splashAlpha > 2) {
      g.noStroke();
      g.fill(210, 228, 240, this.splashAlpha * 0.45);
      g.ellipse(0, 0, 3 + this.age * 0.08, 1.8 + this.age * 0.04);
    }

    for (let ring of this.rings) {
      g.stroke(190, 212, 225, ring.alpha);
      g.strokeWeight(ring.weight);
      g.ellipse(0, 0, ring.r * 2 * ring.stretchX, ring.r * 2 * ring.stretchY);

      g.stroke(120, 145, 165, ring.alpha * 0.35);
      g.strokeWeight(ring.weight * 0.6);
      g.ellipse(0, 1.4, ring.r * 2 * ring.stretchX * 0.98, ring.r * 2 * ring.stretchY * 0.82);
    }

    g.pop();
  }
}

function drawBackground() {
  bgGraphics.clear();

  for (let y = 0; y < height; y++) {
    let t = y / height;
    let c = lerpColor(color(38, 48, 58), color(78, 96, 112), t);
    bgGraphics.stroke(c);
    bgGraphics.line(0, y, width, y);
  }

  bgGraphics.noStroke();
  for (let i = 0; i < 2200; i++) {
    let x = random(width);
    let y = random(height);
    let a = random(4, 12);
    bgGraphics.fill(255, a);
    bgGraphics.circle(x, y, random(1, 3));
  }

  let cx = width * 0.5;
  let cy = height * 0.68;
  let rw = width * 0.84;
  let rh = height * 0.4;

  for (let i = 26; i > 0; i--) {
    let t = i / 26;
    let c = lerpColor(color(20, 30, 38, 60), color(20, 30, 38, 0), 1 - t);
    bgGraphics.noStroke();
    bgGraphics.fill(c);
    bgGraphics.ellipse(cx, cy + 10, rw * (1.02 + t * 0.04), rh * (0.98 + t * 0.02));
  }

  for (let i = 28; i > 0; i--) {
    let t = i / 28;
    let c = lerpColor(color(32, 52, 66, 170), color(102, 132, 154, 24), 1 - t);
    bgGraphics.noStroke();
    bgGraphics.fill(c);
    bgGraphics.ellipse(cx, cy - t * 1.5, rw * t, rh * t);
  }

  for (let i = 0; i < 15; i++) {
    let yy = cy - rh * 0.12 + i * 3.2;
    let alpha = map(i, 0, 14, 34, 2);
    bgGraphics.stroke(195, 215, 228, alpha);
    bgGraphics.line(cx - rw * 0.24, yy, cx + rw * 0.18, yy);
  }

  bgGraphics.noFill();
  bgGraphics.stroke(18, 28, 38, 90);
  bgGraphics.strokeWeight(2);
  bgGraphics.ellipse(cx, cy, rw, rh);

  bgGraphics.stroke(170, 192, 208, 18);
  bgGraphics.strokeWeight(1.2);
  bgGraphics.ellipse(cx, cy - 2, rw * 0.98, rh * 0.96);
}

function drawRain() {
  strokeWeight(1);
  for (let i = 0; i < 90; i++) {
    let x = (frameCount * 2 + i * 47) % (width + 120) - 60;
    let y = (frameCount * 11 + i * 71) % (height + 200) - 100;
    let len = 8 + ((i * 13) % 11);
    stroke(200, 220, 235, 16);
    line(x, y, x - 4, y + len);
  }
}

function drawSurfaceGlow() {
  push();
  noStroke();

  let cx = width * 0.5;
  let cy = height * 0.6;

  for (let i = 0; i < 14; i++) {
    let a = map(i, 0, 13, 20, 0);
    fill(180, 205, 220, a);
    ellipse(cx, cy, width * (0.5 + i * 0.04), height * (0.04 + i * 0.008));
  }
  pop();
}

function drawVignette() {
  push();
  noFill();
  for (let i = 0; i < 40; i++) {
    stroke(10, 16, 22, 7);
    strokeWeight(20);
    rect(-i, -i, width + i * 2, height + i * 2, 20);
  }
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  rippleGraphics = createGraphics(width, height);
  rippleGraphics.pixelDensity(1);

  bgGraphics = createGraphics(width, height);
  bgGraphics.pixelDensity(1);
  drawBackground();

  drops = [];
  for (let i = 0; i < 20; i++) {
    addDrop(random(width), random(height * 0.35, height * 0.92), random(0.4, 1.4));
  }
}