import { describe, expect, it } from 'vitest';
import { shoulderRotation } from './pose';
import { solveHomography } from './homography';
import type { Homography } from './homography';

// Identity-like homography: image pixels ARE stage meters (100px = 1m would
// complicate nothing — use 1:1 for readable tests, camera at the audience).
function identityHomography(): Homography {
  const square = [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 8 },
    { x: 0, y: 8 },
  ];
  const h = solveHomography(square, square);
  if (h === null) throw new Error('identity homography failed');
  return h;
}

describe('shoulderRotation', () => {
  const h = identityHomography();

  it('facing the audience: shoulders level, mirrored left/right', () => {
    // Viewer sees the dancer's LEFT shoulder on the RIGHT of the image.
    const rotation = shoulderRotation({ x: 7, y: 4 }, { x: 5, y: 4 }, h);
    expect(rotation).toBeCloseTo(0, 4);
  });

  it('back to the audience: shoulders level, unmirrored', () => {
    const rotation = shoulderRotation({ x: 5, y: 4 }, { x: 7, y: 4 }, h);
    expect(rotation).toBeCloseTo(180, 4);
  });

  it('profile facing stage-left: shoulder line along y', () => {
    // Dancer turned 90° clockwise from the audience: facing -x (stage left
    // from the audience view). Shoulder line runs along the y axis; the
    // left shoulder is the downstage one for this turn.
    const rotation = shoulderRotation({ x: 6, y: 5 }, { x: 6, y: 3 }, h);
    expect(rotation).toBeCloseTo(90, 4);
  });

  it('returns null for coincident shoulders (bad keypoints)', () => {
    expect(shoulderRotation({ x: 6, y: 4 }, { x: 6, y: 4 }, h)).toBeNull();
  });
});
