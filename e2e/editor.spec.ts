import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Persisted doc shape (zustand persist envelope). */
interface PersistedDoc {
  state: {
    performance: { beatMarkersMs: number[]; bpm: number | null };
    performers: { id: string; name: string }[];
    formations: { id: string; orderIndex: number }[];
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
  await page.setInputFiles('input[type="file"]', {
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

test('PDF export downloads a file', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('walk-charts.pdf');
});
