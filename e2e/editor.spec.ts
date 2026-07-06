import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Persisted doc shape (zustand persist envelope). */
interface PersistedDoc {
  state: {
    performance: { beatMarkersMs: number[]; bpm: number | null };
    performers: { id: string; name: string }[];
    formations: { id: string; orderIndex: number; startTimeMs: number }[];
    positions: Record<string, Record<string, { x: number; y: number; rotation: number }>>;
  };
}

async function readDoc(page: Page): Promise<PersistedDoc['state']> {
  const doc = await page.evaluate(
    () => JSON.parse(localStorage.getItem('openstage-doc') ?? 'null') as PersistedDoc | null,
  );
  if (doc === null) throw new Error('openstage-doc not in localStorage');
  return doc.state;
}

/** Stage-area layout mirror of the app: meters -> viewport px (12x8m stage). */
function meterToPx(xM: number, yM: number): { x: number; y: number } {
  const area = { x: 216, y: 46, w: 1440 - 216 - 248, h: 900 - 46 - 210 };
  const ppm = Math.min((area.w - 88) / 12, (area.h - 88) / 8);
  const ox = area.x + (area.w - 12 * ppm) / 2;
  const oy = area.y + (area.h - 8 * ppm) / 2;
  return { x: ox + xM * ppm, y: oy + yM * ppm };
}

/** 2s 16-bit mono WAV, 440Hz — in-memory upload fixture. */
function makeWav(): Buffer {
  const rate = 22050;
  const n = rate * 2;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 20000), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByText('Add performer').waitFor();
});

test('app shell renders', async ({ page }) => {
  await expect(page.locator('.wordmark')).toHaveText('OpenStage');
  await expect(page.getByLabel('Stage canvas')).toBeVisible();
  await expect(page.getByLabel('Timeline')).toBeVisible();
});

test('add, drag and rotate a performer; doc survives reload', async ({ page }) => {
  await page.getByText('Add performer').click();

  // drag Dancer 1 from its default spot to (6, 2)
  const from = meterToPx(1.5, 6.5);
  const to = meterToPx(6, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();

  await page.getByLabel('Facing degrees').fill('90');

  // keyboard nudge: blur the input first, then ArrowRight = +0.1m
  await page.getByLabel('Stage canvas').click({ position: { x: 10, y: 10 } });
  // clicking empty floor deselects; re-select via cast row
  await page.getByText('Dancer 1').first().click();
  await page.keyboard.press('ArrowRight');

  await page.reload();
  await page.getByText('Add performer').waitFor();

  const state = await readDoc(page);
  expect(state.performers).toHaveLength(1);
  const fid = state.formations[0]?.id ?? '';
  const pid = state.performers[0]?.id ?? '';
  const pos = state.positions[fid]?.[pid];
  expect(pos).toBeDefined();
  expect(Math.abs((pos?.x ?? 0) - 6.1)).toBeLessThan(0.3);
  expect(Math.abs((pos?.y ?? 0) - 2)).toBeLessThan(0.3);
  expect(pos?.rotation).toBe(90);
  await expect(page.getByText('Dancer 1').first()).toBeVisible();
});

test('second formation copies positions and edits independently', async ({ page }) => {
  await page.getByText('Add performer').click();
  await page.getByText('Add formation').click();

  const from = meterToPx(1.5, 6.5);
  const to = meterToPx(9, 4);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();

  const state = await readDoc(page);
  expect(state.formations).toHaveLength(2);
  const f1 = state.formations.find((f) => f.orderIndex === 0)?.id ?? '';
  const f2 = state.formations.find((f) => f.orderIndex === 1)?.id ?? '';
  const pid = state.performers[0]?.id ?? '';
  expect(Math.abs((state.positions[f1]?.[pid]?.x ?? 0) - 1.5)).toBeLessThan(0.1);
  expect(Math.abs((state.positions[f2]?.[pid]?.x ?? 0) - 9)).toBeLessThan(0.3);
});

test('playback without audio advances and pauses', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Pause' }).click();
  const timecode = await page.getByLabel('Playhead time').textContent();
  expect(timecode).not.toContain('0:00.0');
});

test('audio upload, beat markers, waveform persistence', async ({ page }) => {
  await page.setInputFiles('input[aria-label="Audio file"]', {
    name: 'tone.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(),
  });
  await page.getByText('Replace audio').waitFor();

  await page.getByRole('button', { name: 'Play' }).click();
  // Audio needs a moment to buffer before its clock advances — wait until the
  // playhead passes 0.3s before tapping.
  await expect(page.getByLabel('Playhead time')).toHaveText(/0:00\.[3-9]|0:0[1-9]/, {
    timeout: 5000,
  });
  await page.getByRole('button', { name: 'Tap beat' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();

  const state = await readDoc(page);
  expect(state.performance.beatMarkersMs).toHaveLength(1);
  expect(state.performance.beatMarkersMs[0]).toBeGreaterThan(200);

  await page.reload();
  await expect(page.getByText('Replace audio')).toBeVisible();
});

test('drag a formation to reposition it in time; undo reverts in one step', async ({ page }) => {
  await page.getByText('Add formation').click(); // now 2 formations: 0s and 12s

  const content = page.locator('.timeline-content');
  const box = await content.boundingBox();
  if (box === null) throw new Error('no timeline content box');
  const totalMs = 30_000; // 2 formations end at 20s, clamped up to MIN 30s
  const px = (ms: number): number => box.x + (ms / totalMs) * box.width;
  const rowY = box.y + box.height - 8 - 22;

  let formations = (await readDoc(page)).formations;
  const f2 = formations.find((f) => f.orderIndex === 1);
  if (f2 === undefined) throw new Error('no second formation');

  await page.mouse.move(px(12500), rowY);
  await page.mouse.down();
  await page.mouse.move(px(6000), rowY, { steps: 12 });
  await page.mouse.up();

  formations = (await readDoc(page)).formations;
  const moved = formations.find((f) => f.id === f2.id);
  expect(moved).toBeDefined();
  // Was 12000ms, dragged toward 5.5s.
  expect(moved?.startTimeMs ?? 0).toBeLessThan(9000);
  expect(moved?.startTimeMs ?? 0).toBeGreaterThan(2000);

  await page.locator('.timeline-content').focus();
  await page.keyboard.press('Control+z');
  formations = (await readDoc(page)).formations;
  expect(formations.find((f) => f.id === f2.id)?.startTimeMs).toBe(12000);
});

test('zoom widens the timeline content', async ({ page }) => {
  const before = (await page.locator('.timeline-content').boundingBox())?.width ?? 0;
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const after = (await page.locator('.timeline-content').boundingBox())?.width ?? 0;
  expect(after).toBeGreaterThan(before * 1.8);
});

test('untangle swaps crossing walk paths to the minimal-travel assignment', async ({ page }) => {
  await page.getByText('Add performer').click(); // D1 @ (1.5, 6.5)
  await page.getByText('Add performer').click(); // D2 @ (3, 6.5)
  await page.getByText('Add formation').click(); // F2 copies F1

  const drag = async (fx: number, fy: number, tx: number, ty: number): Promise<void> => {
    const from = meterToPx(fx, fy);
    const to = meterToPx(tx, ty);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  };
  // Send D1 far right and D2 to the middle — their paths cross.
  await drag(1.5, 6.5, 9, 2);
  await drag(3, 6.5, 5, 2);

  // Deselect so the Formation section (with the button) is visible.
  await page.getByLabel('Stage canvas').click({ position: { x: 15, y: 15 } });
  await page.getByRole('button', { name: 'Untangle from previous' }).click();

  const state = await readDoc(page);
  const f2 = state.formations.find((f) => f.orderIndex === 1);
  const [d1, d2] = state.performers;
  if (f2 === undefined || d1 === undefined || d2 === undefined) throw new Error('setup failed');
  const p1 = state.positions[f2.id]?.[d1.id];
  const p2 = state.positions[f2.id]?.[d2.id];
  // Spots swapped: D1 takes (5,2), D2 takes (9,2) — no more crossing.
  expect(Math.abs((p1?.x ?? 0) - 5)).toBeLessThan(0.4);
  expect(Math.abs((p2?.x ?? 0) - 9)).toBeLessThan(0.4);
});

test('curve transition: dragging the handle stores a Bézier control point', async ({ page }) => {
  await page.getByText('Add performer').click(); // D1 @ (1.5, 6.5)
  await page.getByText('Add formation').click(); // F2 selected, copies F1

  // Move D1 in F2 so there is a real path: (1.5,6.5) -> (9,3)
  const from = meterToPx(1.5, 6.5);
  const to = meterToPx(9, 3);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  // Transition type lives on the formation being LEFT (F1).
  await page.getByLabel('Stage canvas').click({ position: { x: 15, y: 15 } });
  await page.getByRole('button', { name: /Formation 1/ }).click();
  await page.selectOption('#form-transition', 'curve');

  // Back to F2, select D1 so its handle (at the path midpoint) appears.
  await page.getByRole('button', { name: /Formation 2/ }).click();
  await page.getByText('Dancer 1').first().click();

  const mid = meterToPx((1.5 + 9) / 2, (6.5 + 3) / 2);
  const bent = meterToPx(5.25, 1.5);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(bent.x, bent.y, { steps: 8 });
  await page.mouse.up();

  const state = await readDoc(page);
  const f1 = state.formations.find((f) => f.orderIndex === 0);
  const d1 = state.performers[0];
  if (f1 === undefined || d1 === undefined) throw new Error('setup failed');
  const pos = state.positions[f1.id]?.[d1.id] as
    { curveControlPoints?: { x: number; y: number }[] } | undefined;
  const control = pos?.curveControlPoints?.[0];
  expect(control).toBeDefined();
  expect(Math.abs((control?.x ?? 0) - 5.25)).toBeLessThan(0.4);
  expect(Math.abs((control?.y ?? 0) - 1.5)).toBeLessThan(0.4);
});

test('view mode hides editing UI and blocks dragging', async ({ page }) => {
  await page.getByText('Add performer').click();
  await page.goto('/?mode=view');
  await page.locator('.wordmark').waitFor();

  await expect(page.getByText('Add performer')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  // Dragging the mark must not move it.
  const before = (await readDoc(page)).positions;
  const from = meterToPx(1.5, 6.5);
  const to = meterToPx(6, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const after = (await readDoc(page)).positions;
  expect(after).toEqual(before);
});

test('version history: snapshot, mutate, restore', async ({ page }) => {
  await page.getByText('Add performer').click();
  await page.getByLabel('Stage canvas').click({ position: { x: 15, y: 15 } });

  await page.getByRole('button', { name: 'Save snapshot' }).click();
  await page.getByRole('button', { name: 'Restore' }).waitFor();

  // Mutate: add two more performers.
  await page.getByText('Add performer').click();
  await page.getByText('Add performer').click();
  expect((await readDoc(page)).performers).toHaveLength(3);

  await page.getByLabel('Stage canvas').click({ position: { x: 15, y: 15 } });
  await page.getByRole('button', { name: 'Restore' }).click();
  expect((await readDoc(page)).performers).toHaveLength(1);

  // Restore is one undo step away from the pre-restore state.
  await page.keyboard.press('Control+z');
  expect((await readDoc(page)).performers).toHaveLength(3);
});

test('3D preview toggles on and back off', async ({ page }) => {
  await page.getByText('Add performer').click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  // three.js canvas appears (lazy chunk)
  await expect(page.locator('.stage-area canvas')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.getByRole('button', { name: '3D', exact: true })).toBeVisible();
});

test('PDF export downloads a file', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('walk-charts.pdf');
});
