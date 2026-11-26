// The lamp's pull-switch click, made with the Web Audio API, so there is no sound file to load.
// "down" is the switch catching as the cord is pulled; "up" is the softer clack as the cord goes back.
// The audio context is created on the first click (browsers only allow sound after a user gesture).

let context: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

/** A short burst of noise that dies away fast: the mechanical part of the click. */
function noiseBurst(ctx: AudioContext, seconds: number, decay: number) {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
  return buffer;
}

export function playSwitch(kind: "down" | "up") {
  try {
    const ctx = audio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const down = kind === "down";

    const out = ctx.createGain();
    out.gain.value = down ? 0.32 : 0.18;
    out.connect(ctx.destination);

    // The click: filtered noise, brighter on the way down.
    const click = ctx.createBufferSource();
    click.buffer = noiseBurst(ctx, 0.04, down ? 0.0035 : 0.0025);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = down ? 3200 : 2300;
    band.Q.value = 0.9;
    click.connect(band).connect(out);
    click.start(now);

    // The body: a quick low knock from the switch housing.
    const knock = ctx.createOscillator();
    knock.type = "sine";
    knock.frequency.setValueAtTime(down ? 210 : 160, now);
    knock.frequency.exponentialRampToValueAtTime(70, now + 0.05);
    const knockGain = ctx.createGain();
    knockGain.gain.setValueAtTime(down ? 0.5 : 0.3, now);
    knockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    knock.connect(knockGain).connect(out);
    knock.start(now);
    knock.stop(now + 0.07);
  } catch {
    // Sound is a nicety; never let it break the switch.
  }
}
