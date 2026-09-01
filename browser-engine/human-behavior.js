// ═══════════════════════════════════════════════════
// Human Behavior Simulation — Engine Side
// Ported from base44/shared/humanBehavior.ts
// Used by engine for bezier mouse movements + typing jitter
// ═══════════════════════════════════════════════════

// Cubic bezier curve interpolation
function cubicBezier(p0, p1, p2, p3, t) {
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

/**
 * Generate a natural mouse path from start to end using bezier curves with jitter
 */
export function generateMousePath(start, end, options = {}) {
  const steps = options.steps ?? 25;
  const jitter = options.jitter ?? 8;
  const curvature = options.curvature ?? 0.5;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = dist * curvature;

  const p1 = {
    x: start.x + dx * 0.3 + (Math.random() - 0.5) * offset,
    y: start.y + dy * 0.3 + (Math.random() - 0.5) * offset,
  };
  const p2 = {
    x: start.x + dx * 0.7 + (Math.random() - 0.5) * offset,
    y: start.y + dy * 0.7 + (Math.random() - 0.5) * offset,
  };

  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = cubicBezier(start, p1, p2, end, t);
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

/**
 * Generate human-like typing delays (ms) for a given text
 */
export function generateTypingDelays(text, options = {}) {
  const baseDelay = options.baseDelay ?? 80;
  const jitter = options.jitter ?? 40;
  const pauseChance = options.pauseChance ?? 0.05;

  const delays = [];
  for (let i = 0; i < text.length; i++) {
    let delay = baseDelay + (Math.random() - 0.5) * jitter;
    if (Math.random() < pauseChance) {
      delay += 200 + Math.random() * 500;
    }
    const char = text[i];
    if (char === ' ' || char === '.' || char === ',') {
      delay += 50 + Math.random() * 100;
    }
    delays.push(Math.round(delay));
  }
  return delays;
}

/**
 * Generate human-like scroll positions with ease-in-out
 */
export function generateScrollPath(startScroll, endScroll, options = {}) {
  const steps = options.steps ?? 10;
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const position = startScroll + (endScroll - startScroll) * eased;
    if (i > 0 && i < steps) {
      path.push(Math.round(position + (Math.random() - 0.5) * 3));
    } else {
      path.push(Math.round(position));
    }
  }
  return path;
}

/**
 * Generate a random delay with jitter (for click/hover waits)
 */
export function humanDelay(baseMs, jitterMs) {
  const jitter = jitterMs ?? baseMs * 0.3;
  return Math.round(baseMs + (Math.random() - 0.5) * jitter);
}

/**
 * Apply human-like mouse movement before a click
 * @param {import('playwright').Page} page
 * @param {string} selector - CSS selector to click
 * @param {string} behaviorLevel - 'high', 'medium', 'low'
 */
export async function humanClick(page, selector, behaviorLevel = 'medium') {
  const steps = behaviorLevel === 'high' ? 35 : behaviorLevel === 'medium' ? 20 : 10;
  const jitter = behaviorLevel === 'high' ? 12 : behaviorLevel === 'medium' ? 8 : 4;

  try {
    const element = await page.$(selector);
    if (!element) {
      await page.click(selector);
      return;
    }

    const box = await element.boundingBox();
    if (!box) {
      await page.click(selector);
      return;
    }

    // Get current mouse position (or start from a random edge)
    const start = { x: Math.random() * (box.x + box.width + 100), y: Math.random() * 100 };
    const end = {
      x: box.x + box.width * (0.3 + Math.random() * 0.4),
      y: box.y + box.height * (0.3 + Math.random() * 0.4),
    };

    const path = generateMousePath(start, end, { steps, jitter });

    // Move along the path
    await page.mouse.move(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      await page.mouse.move(path[i].x, path[i].y);
      await page.waitForTimeout(humanDelay(15, 10));
    }

    // Small pause before click (human hesitation)
    await page.waitForTimeout(humanDelay(100, 50));

    // Click
    await page.mouse.click(end.x, end.y, { delay: 50 + Math.random() * 50 });

    // Small pause after click
    await page.waitForTimeout(humanDelay(200, 100));
  } catch (e) {
    // Fallback to direct click
    await page.click(selector).catch(() => {});
  }
}

/**
 * Type text with human-like jitter
 * @param {import('playwright').Page} page
 * @param {string} selector - CSS selector for input
 * @param {string} text - Text to type
 * @param {string} behaviorLevel - 'high', 'medium', 'low'
 */
export async function humanType(page, selector, text, behaviorLevel = 'medium') {
  const baseDelay = behaviorLevel === 'high' ? 100 : behaviorLevel === 'medium' ? 80 : 50;
  const jitter = behaviorLevel === 'high' ? 60 : behaviorLevel === 'medium' ? 40 : 20;
  const pauseChance = behaviorLevel === 'high' ? 0.08 : behaviorLevel === 'medium' ? 0.05 : 0.02;

  try {
    await page.click(selector);
    await page.waitForTimeout(humanDelay(200, 100));

    const delays = generateTypingDelays(text, { baseDelay, jitter, pauseChance });

    for (let i = 0; i < text.length; i++) {
      await page.keyboard.type(text[i]);
      await page.waitForTimeout(delays[i]);
    }
  } catch (e) {
    // Fallback to direct fill
    await page.fill(selector, text).catch(() => {});
  }
}
