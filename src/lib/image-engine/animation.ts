export function animationFrame(elapsed: number, delays: number[], iterations: number) {
  const durations = delays.map(delay => delay < 20 ? 100 : delay);
  const duration = durations.reduce((sum, delay) => sum + delay, 0);
  const finished = iterations > 0 && elapsed >= duration * iterations;
  if (finished) return { index: Math.max(0, delays.length - 1), finished: true };
  let remaining = elapsed % duration;
  let index = 0;
  while (index < durations.length - 1 && remaining >= durations[index]) { remaining -= durations[index]; index++; }
  return { index, finished: false };
}
export function scaledFrameDelay(delay: number, speed: number) {
  if (speed === 100) return delay;
  const duration = delay < 20 ? 100 : delay;
  return Math.max(20, Math.round(duration * 100 / Math.max(1, speed) / 10) * 10);
}
