// Human Behavior Simulation — generates natural-looking mouse movements, typing patterns,
// and scroll behavior using bezier curves, jitter, and timing variation to mimic human users.

export interface Point { x: number; y: number; }

// Cubic bezier curve interpolation between 4 control points
function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

// Generate a natural mouse path from start to end using bezier curves with jitter
export function generateMousePath(
  start: Point,
  end: Point,
  options?: { steps?: number; jitter?: number; curvature?: number }
): Point[] {
  const steps = options?.steps ?? 25;
  const jitter = options?.jitter ?? 8;
  const curvature = options?.curvature ?? 0.5;

  // Control points with random offset for natural curvature
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = dist * curvature;

  const p1: Point = {
    x: start.x + dx * 0.3 + (Math.random() - 0.5) * offset,
    y: start.y + dy * 0.3 + (Math.random() - 0.5) * offset,
  };
  const p2: Point = {
    x: start.x + dx * 0.7 + (Math.random() - 0.5) * offset,
    y: start.y + dy * 0.7 + (Math.random() - 0.5) * offset,
  };

  const path: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = cubicBezier(start, p1, p2, end, t);
    // Add small jitter to each point (except start and end)
    if (i > 0 && i < steps) {
      path.push({
        x: point.x + (Math.random() - 0.5) * jitter,
        y: point.y + (Math.random() - 0.5) * jitter,
      });
    } else {
      path.push(point);
    }
  }
  return path;
}

// Generate human-like typing delays (ms) for a given text
export function generateTypingDelays(
  text: string,
  options?: { baseDelay?: number; jitter?: number; pauseChance?: number }
): number[] {
  const baseDelay = options?.baseDelay ?? 80;
  const jitter = options?.jitter ?? 40;
  const pauseChance = options?.pauseChance ?? 0.05;

  const delays: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let delay = baseDelay + (Math.random() - 0.5) * jitter;

    // Occasional longer pause (thinking)
    if (Math.random() < pauseChance) {
      delay += 200 + Math.random() * 500;
    }

    // Slower on special characters
    const char = text[i];
    if (char === ' ' || char === '.' || char === ',') {
      delay += 50 + Math.random() * 100;
    }

    delays.push(Math.round(delay));
  }
  return delays;
}

// Generate human-like scroll positions
export function generateScrollPath(
  startScroll: number,
  endScroll: number,
  options?: { steps?: number }
): number[] {
  const steps = options?.steps ?? 10;
  const path: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease-in-out function for smooth scrolling
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const position = startScroll + (endScroll - startScroll) * eased;
    // Small jitter — but not on first and last points (exact start/end)
    if (i > 0 && i < steps) {
      path.push(Math.round(position + (Math.random() - 0.5) * 3));
    } else {
      path.push(Math.round(position));
    }
  }
  return path;
}

// Generate a random delay with jitter (for click/hover waits)
export function humanDelay(baseMs: number, jitterMs?: number): number {
  const jitter = jitterMs ?? baseMs * 0.3;
  return Math.round(baseMs + (Math.random() - 0.5) * jitter);
}