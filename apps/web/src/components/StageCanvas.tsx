import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Stage, Layer, Rect, Line, Group, Wedge, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import { useEditor } from '../state/store';
import { byOrder, posesAtTime } from '../state/interpolate';
import type { StagePose } from '../state/interpolate';

const MARGIN_PX = 44;
const CROSS_ARM_M = 0.26;
const WEDGE_RADIUS_M = 0.85;
const WEDGE_ANGLE_DEG = 56;
const HIT_RADIUS_M = 0.45;

/**
 * rotation 0 = facing the audience (downstage = screen bottom), degrees
 * clockwise on the plan view. Konva angle 0 points screen-right, so the
 * facing direction on screen is rotation + 90.
 */
function facingToScreenDeg(rotation: number): number {
  return rotation + 90;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function StageCanvas(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  const performance = useEditor((s) => s.performance);
  const performers = useEditor((s) => s.performers);
  const formations = useEditor((s) => s.formations);
  const positions = useEditor((s) => s.positions);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const selectedPerformerIds = useEditor((s) => s.selectedPerformerIds);
  const isPlaying = useEditor((s) => s.isPlaying);
  const playheadMs = useEditor((s) => s.playheadMs);
  const setPosition = useEditor((s) => s.setPosition);
  const selectPerformer = useEditor((s) => s.selectPerformer);
  const clearPerformerSelection = useEditor((s) => s.clearPerformerSelection);

  useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const { stageWidth, stageHeight } = performance;
  const pxPerMeter =
    size.width > 0
      ? Math.min(
          (size.width - MARGIN_PX * 2) / stageWidth,
          (size.height - MARGIN_PX * 2) / stageHeight,
        )
      : 0;
  const floorW = stageWidth * pxPerMeter;
  const floorH = stageHeight * pxPerMeter;
  const offsetX = (size.width - floorW) / 2;
  const offsetY = (size.height - floorH) / 2;

  const toPx = (xM: number, yM: number): { x: number; y: number } => ({
    x: offsetX + xM * pxPerMeter,
    y: offsetY + yM * pxPerMeter,
  });
  const toMeters = (xPx: number, yPx: number): { x: number; y: number } => ({
    x: (xPx - offsetX) / pxPerMeter,
    y: (yPx - offsetY) / pxPerMeter,
  });

  // While playing (or scrubbing), poses come from the timeline; while editing,
  // straight from the selected formation.
  const livePoses: ReadonlyMap<string, StagePose> | null = isPlaying
    ? posesAtTime(formations, positions, playheadMs)
    : null;
  const editPositions = positions[selectedFormationId] ?? {};

  const ordered = byOrder(formations);
  const selectedIndex = ordered.findIndex((f) => f.id === selectedFormationId);
  const previous = selectedIndex > 0 ? ordered[selectedIndex - 1] : undefined;
  const previousPositions = previous !== undefined ? (positions[previous.id] ?? {}) : {};

  if (pxPerMeter <= 0 || !Number.isFinite(pxPerMeter)) {
    return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage() || e.target.name() === 'floor') {
            clearPerformerSelection();
          }
        }}
      >
        <Layer listening={false}>
          {/* Marley floor under a warm wash — the one lit surface. */}
          <Rect
            name="floor"
            x={offsetX}
            y={offsetY}
            width={floorW}
            height={floorH}
            fillRadialGradientStartPoint={{ x: floorW / 2, y: floorH * 0.35 }}
            fillRadialGradientEndPoint={{ x: floorW / 2, y: floorH * 0.35 }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndRadius={Math.max(floorW, floorH) * 0.75}
            fillRadialGradientColorStops={[0, '#39332c', 0.65, '#2e2a26', 1, '#262320']}
            stroke="#4a4038"
            strokeWidth={1.5}
          />
          {/* 1-meter grid */}
          {Array.from({ length: Math.floor(stageWidth) + 1 }, (_, i) => (
            <Line
              key={`v${i}`}
              points={[
                offsetX + i * pxPerMeter,
                offsetY,
                offsetX + i * pxPerMeter,
                offsetY + floorH,
              ]}
              stroke="#ffffff"
              opacity={0.045}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: Math.floor(stageHeight) + 1 }, (_, i) => (
            <Line
              key={`h${i}`}
              points={[
                offsetX,
                offsetY + i * pxPerMeter,
                offsetX + floorW,
                offsetY + i * pxPerMeter,
              ]}
              stroke="#ffffff"
              opacity={0.045}
              strokeWidth={1}
            />
          ))}
          {/* Center line — the center spike every stage has. */}
          <Line
            points={[offsetX + floorW / 2, offsetY, offsetX + floorW / 2, offsetY + floorH]}
            stroke="#e8d44c"
            opacity={0.22}
            strokeWidth={1}
            dash={[6, 8]}
          />
          <Text
            x={offsetX}
            y={offsetY + floorH + 10}
            width={floorW}
            align="center"
            text="AUDIENCE"
            fontFamily="'IBM Plex Mono', monospace"
            fontSize={11}
            letterSpacing={4}
            fill="#9a8f82"
          />
        </Layer>

        {/* Ghosts: where everyone stood in the previous formation. */}
        {!isPlaying && previous !== undefined && (
          <Layer listening={false} opacity={0.35}>
            {performers.map((p) => {
              const prev = previousPositions[p.id];
              const curr = editPositions[p.id];
              if (prev === undefined) return null;
              const prevPx = toPx(prev.x, prev.y);
              const currPx = curr !== undefined ? toPx(curr.x, curr.y) : null;
              return (
                <Group key={p.id}>
                  {currPx !== null && (
                    <Line
                      points={[prevPx.x, prevPx.y, currPx.x, currPx.y]}
                      stroke={p.color}
                      strokeWidth={1}
                      dash={[3, 5]}
                      opacity={0.7}
                    />
                  )}
                  <Circle x={prevPx.x} y={prevPx.y} radius={4} stroke={p.color} strokeWidth={1.5} />
                </Group>
              );
            })}
          </Layer>
        )}

        <Layer>
          {performers.map((p) => {
            const pose: StagePose | undefined = livePoses?.get(p.id) ?? {
              x: editPositions[p.id]?.x ?? NaN,
              y: editPositions[p.id]?.y ?? NaN,
              rotation: editPositions[p.id]?.rotation ?? 0,
            };
            if (!Number.isFinite(pose.x) || !Number.isFinite(pose.y)) return null;
            const px = toPx(pose.x, pose.y);
            const selected = selectedPerformerIds.includes(p.id);
            const arm = CROSS_ARM_M * pxPerMeter;
            return (
              <Group
                key={p.id}
                x={px.x}
                y={px.y}
                draggable={!isPlaying}
                dragBoundFunc={(pos) => ({
                  x: Math.min(offsetX + floorW, Math.max(offsetX, pos.x)),
                  y: Math.min(offsetY + floorH, Math.max(offsetY, pos.y)),
                })}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  const m = toMeters(e.target.x(), e.target.y());
                  setPosition(selectedFormationId, p.id, m.x, m.y);
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  selectPerformer(p.id, e.evt.shiftKey);
                }}
              >
                {/* Facing wedge — a light cone showing orientation. */}
                <Wedge
                  radius={WEDGE_RADIUS_M * pxPerMeter}
                  angle={WEDGE_ANGLE_DEG}
                  rotation={facingToScreenDeg(pose.rotation) - WEDGE_ANGLE_DEG / 2}
                  fill={p.color}
                  opacity={0.22}
                />
                {selected && (
                  <Circle
                    radius={HIT_RADIUS_M * pxPerMeter}
                    stroke="#e8a84c"
                    strokeWidth={1.5}
                    dash={[4, 4]}
                  />
                )}
                {/* Spike-tape cross in the performer's color. */}
                <Line
                  points={[-arm, -arm, arm, arm]}
                  stroke={p.color}
                  strokeWidth={3}
                  lineCap="round"
                />
                <Line
                  points={[-arm, arm, arm, -arm]}
                  stroke={p.color}
                  strokeWidth={3}
                  lineCap="round"
                />
                {/* Invisible hit area so small crosses stay grabbable. */}
                <Circle radius={HIT_RADIUS_M * pxPerMeter} fill="transparent" />
                <Text
                  x={-60}
                  y={arm + 6}
                  width={120}
                  align="center"
                  text={p.name}
                  fontFamily="'Instrument Sans Variable', sans-serif"
                  fontSize={11}
                  fill="#ece5db"
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
