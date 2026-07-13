import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Stage, Layer, Rect, Line, Group, Wedge, Circle, Text, Shape } from 'react-konva';
import type Konva from 'konva';
import { useEditor } from '../state/store';
import { byOrder, posesAtTime } from '../state/interpolate';
import type { StagePose } from '../state/interpolate';
import { findCrossings } from '@openstage/path-planner';
import { isCollabActive, setAwarenessCursor } from '../collab/collab';
import { usePeers } from '../hooks/usePeers';
import { isViewMode } from '../state/viewMode';
import { useT } from '../i18n';

const CURSOR_BROADCAST_MS = 80;

const MARGIN_PX = 44;
const CROSS_ARM_M = 0.26;
const WEDGE_RADIUS_M = 0.85;
const WEDGE_ANGLE_DEG = 56;
const HIT_RADIUS_M = 0.45;

/**
 * rotation 0 = facing the audience (downstage = screen bottom), degrees
 * clockwise on the plan view. Konva angle 0 points screen-right, so the
 * facing direction on screen is rotation + 90. With the audience drawn at
 * the top the whole plan is rotated 180°, so the angle shifts by 180 too.
 */
function facingToScreenDeg(rotation: number, flip: boolean): number {
  return rotation + (flip ? 270 : 90);
}

interface CanvasSize {
  width: number;
  height: number;
}

export function StageCanvas(): ReactElement {
  const t = useT();
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
  const setPositionLive = useEditor((s) => s.setPositionLive);
  const setCurveControl = useEditor((s) => s.setCurveControl);
  const pushHistory = useEditor((s) => s.pushHistory);
  const selectPerformer = useEditor((s) => s.selectPerformer);
  const setPerformerSelection = useEditor((s) => s.setPerformerSelection);
  const clearPerformerSelection = useEditor((s) => s.clearPerformerSelection);
  const pathPerformerId = useEditor((s) => s.pathPerformerId);
  const peers = usePeers();
  const lastCursorSentRef = useRef(0);

  // Marquee (rubber-band) selection: press on empty floor, drag, release.
  // A plain click (no movement past the threshold) still just deselects.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const marqueeRef = useRef<{ x0: number; y0: number; moved: boolean } | null>(null);
  // Group drag: where every OTHER selected performer stood when the drag began.
  const groupDragRef = useRef<{
    startM: { x: number; y: number };
    origins: Map<string, { x: number; y: number }>;
  } | null>(null);

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

  // Audience at the top = the plan rotated 180° (performers' perspective).
  // Only these two mappings flip; stored coordinates never change.
  const flip = performance.audienceAt === 'top';
  const toPx = (xM: number, yM: number): { x: number; y: number } => ({
    x: offsetX + (flip ? stageWidth - xM : xM) * pxPerMeter,
    y: offsetY + (flip ? stageHeight - yM : yM) * pxPerMeter,
  });
  const toMeters = (xPx: number, yPx: number): { x: number; y: number } => {
    const x = (xPx - offsetX) / pxPerMeter;
    const y = (yPx - offsetY) / pxPerMeter;
    return flip ? { x: stageWidth - x, y: stageHeight - y } : { x, y };
  };

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
            const pointer = e.target.getStage()?.getPointerPosition();
            if (pointer != null && !isPlaying) {
              marqueeRef.current = { x0: pointer.x, y0: pointer.y, moved: false };
            } else {
              clearPerformerSelection();
            }
          }
        }}
        onMouseMove={(e) => {
          const pointer = e.target.getStage()?.getPointerPosition();
          const drag = marqueeRef.current;
          if (drag !== null && pointer != null) {
            if (
              drag.moved ||
              Math.abs(pointer.x - drag.x0) > 4 ||
              Math.abs(pointer.y - drag.y0) > 4
            ) {
              drag.moved = true;
              setMarquee({ x0: drag.x0, y0: drag.y0, x1: pointer.x, y1: pointer.y });
            }
          }
          if (!isCollabActive()) return;
          const now = Date.now();
          if (now - lastCursorSentRef.current < CURSOR_BROADCAST_MS) return;
          lastCursorSentRef.current = now;
          if (pointer == null) return;
          const m = toMeters(pointer.x, pointer.y);
          setAwarenessCursor(
            m.x >= 0 && m.x <= stageWidth && m.y >= 0 && m.y <= stageHeight ? m : null,
          );
        }}
        onMouseUp={() => {
          const drag = marqueeRef.current;
          marqueeRef.current = null;
          setMarquee(null);
          if (drag === null) return;
          if (!drag.moved) {
            clearPerformerSelection();
            return;
          }
          if (isViewMode || marquee === null) return;
          // Corners land swapped when the plan is flipped — sort in meters.
          const c1 = toMeters(Math.min(marquee.x0, marquee.x1), Math.min(marquee.y0, marquee.y1));
          const c2 = toMeters(Math.max(marquee.x0, marquee.x1), Math.max(marquee.y0, marquee.y1));
          const a = { x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y) };
          const b = { x: Math.max(c1.x, c2.x), y: Math.max(c1.y, c2.y) };
          const inside = performers
            .filter((p) => {
              const pos = editPositions[p.id];
              return (
                pos !== undefined && pos.x >= a.x && pos.x <= b.x && pos.y >= a.y && pos.y <= b.y
              );
            })
            .map((p) => p.id);
          setPerformerSelection(inside);
        }}
        onMouseLeave={() => {
          marqueeRef.current = null;
          setMarquee(null);
          if (isCollabActive()) setAwarenessCursor(null);
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
            y={flip ? offsetY - 21 : offsetY + floorH + 10}
            width={floorW}
            align="center"
            text={t.stage.audience}
            fontFamily="'IBM Plex Mono', monospace"
            fontSize={11}
            letterSpacing={4}
            fill="#9a8f82"
          />
        </Layer>

        {/* Ghosts: where everyone stood in the previous formation. Linear
            transitions get crossing warnings; curve transitions draw the
            Bézier and (for selected performers) a draggable control handle. */}
        {!isPlaying &&
          previous !== undefined &&
          (() => {
            const isCurve = previous.transitionType === 'curve';
            const walkers = performers.filter(
              (p) => previousPositions[p.id] !== undefined && editPositions[p.id] !== undefined,
            );
            const paths = walkers.map((p) => {
              const from = previousPositions[p.id];
              const to = editPositions[p.id];
              return {
                from: { x: from?.x ?? 0, y: from?.y ?? 0 },
                to: { x: to?.x ?? 0, y: to?.y ?? 0 },
              };
            });
            // ponytail: crossing detection is straight-line only; curved
            // paths would need sampled-segment checks.
            const crossing = isCurve ? new Set<number>() : new Set(findCrossings(paths).flat());
            return (
              <>
                <Layer listening={false}>
                  {performers.map((p) => {
                    const prev = previousPositions[p.id];
                    if (prev === undefined) return null;
                    const prevPx = toPx(prev.x, prev.y);
                    const walkerIndex = walkers.findIndex((w) => w.id === p.id);
                    const curr = editPositions[p.id];
                    const currPx = curr !== undefined ? toPx(curr.x, curr.y) : null;
                    const collides = walkerIndex !== -1 && crossing.has(walkerIndex);
                    const control = prev.curveControlPoints?.[0];
                    const controlPx =
                      isCurve && currPx !== null
                        ? control !== undefined
                          ? toPx(control.x, control.y)
                          : { x: (prevPx.x + currPx.x) / 2, y: (prevPx.y + currPx.y) / 2 }
                        : null;
                    return (
                      <Group key={p.id} opacity={collides ? 0.9 : 0.35}>
                        {currPx !== null &&
                          (isCurve && controlPx !== null ? (
                            <Shape
                              stroke={p.color}
                              strokeWidth={1}
                              dash={[3, 5]}
                              opacity={0.8}
                              sceneFunc={(ctx, shape) => {
                                ctx.beginPath();
                                ctx.moveTo(prevPx.x, prevPx.y);
                                ctx.quadraticCurveTo(controlPx.x, controlPx.y, currPx.x, currPx.y);
                                ctx.fillStrokeShape(shape);
                              }}
                            />
                          ) : (
                            <Line
                              points={[prevPx.x, prevPx.y, currPx.x, currPx.y]}
                              stroke={collides ? '#d95f5f' : p.color}
                              strokeWidth={collides ? 2 : 1}
                              dash={collides ? undefined : [3, 5]}
                              opacity={0.8}
                            />
                          ))}
                        <Circle
                          x={prevPx.x}
                          y={prevPx.y}
                          radius={4}
                          stroke={collides ? '#d95f5f' : p.color}
                          strokeWidth={1.5}
                        />
                      </Group>
                    );
                  })}
                </Layer>
                {/* Curve control handles: draggable, for selected performers. */}
                {isCurve && !isViewMode && (
                  <Layer>
                    {performers
                      .filter((p) => selectedPerformerIds.includes(p.id))
                      .map((p) => {
                        const prev = previousPositions[p.id];
                        const curr = editPositions[p.id];
                        if (prev === undefined || curr === undefined) return null;
                        const prevPx = toPx(prev.x, prev.y);
                        const currPx = toPx(curr.x, curr.y);
                        const control = prev.curveControlPoints?.[0];
                        const handlePx =
                          control !== undefined
                            ? toPx(control.x, control.y)
                            : { x: (prevPx.x + currPx.x) / 2, y: (prevPx.y + currPx.y) / 2 };
                        return (
                          <Circle
                            key={`handle-${p.id}`}
                            x={handlePx.x}
                            y={handlePx.y}
                            radius={6}
                            fill="#e8d44c"
                            stroke="#191512"
                            strokeWidth={1.5}
                            draggable
                            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                              const m = toMeters(e.target.x(), e.target.y());
                              setCurveControl(previous.id, p.id, m.x, m.y);
                            }}
                          />
                        );
                      })}
                  </Layer>
                )}
              </>
            );
          })()}

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
                draggable={!isPlaying && !isViewMode}
                dragBoundFunc={(pos) => ({
                  x: Math.min(offsetX + floorW, Math.max(offsetX, pos.x)),
                  y: Math.min(offsetY + floorH, Math.max(offsetY, pos.y)),
                })}
                onDragStart={(e: Konva.KonvaEventObject<DragEvent>) => {
                  // One undo step per drag; frames below skip history.
                  pushHistory();
                  // Dragging a member of a multi-selection moves the group.
                  if (selectedPerformerIds.includes(p.id) && selectedPerformerIds.length > 1) {
                    const origins = new Map<string, { x: number; y: number }>();
                    for (const id of selectedPerformerIds) {
                      if (id === p.id) continue;
                      const pos = editPositions[id];
                      if (pos !== undefined) origins.set(id, { x: pos.x, y: pos.y });
                    }
                    groupDragRef.current = {
                      startM: toMeters(e.target.x(), e.target.y()),
                      origins,
                    };
                  } else {
                    groupDragRef.current = null;
                  }
                }}
                onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                  const m = toMeters(e.target.x(), e.target.y());
                  const group = groupDragRef.current;
                  if (group !== null) {
                    const dx = m.x - group.startM.x;
                    const dy = m.y - group.startM.y;
                    setPositionLive(selectedFormationId, p.id, m.x, m.y);
                    for (const [id, origin] of group.origins) {
                      setPositionLive(selectedFormationId, id, origin.x + dx, origin.y + dy);
                    }
                    return;
                  }
                  // Solo drag: live-sync only for collaborators (local render
                  // follows the Konva node, no store churn needed).
                  if (!isCollabActive()) return;
                  const now = Date.now();
                  if (now - lastCursorSentRef.current < CURSOR_BROADCAST_MS) return;
                  lastCursorSentRef.current = now;
                  setPositionLive(selectedFormationId, p.id, m.x, m.y);
                }}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  const m = toMeters(e.target.x(), e.target.y());
                  const group = groupDragRef.current;
                  if (group !== null) {
                    const dx = m.x - group.startM.x;
                    const dy = m.y - group.startM.y;
                    for (const [id, origin] of group.origins) {
                      setPositionLive(selectedFormationId, id, origin.x + dx, origin.y + dy);
                    }
                    groupDragRef.current = null;
                  }
                  setPositionLive(selectedFormationId, p.id, m.x, m.y);
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  // Clicking an already-selected mark keeps the selection, so
                  // grabbing one member drags the whole group.
                  if (e.evt.shiftKey) selectPerformer(p.id, true);
                  else if (!selectedPerformerIds.includes(p.id)) selectPerformer(p.id, false);
                }}
              >
                {/* Facing wedge — a light cone showing orientation. */}
                <Wedge
                  radius={WEDGE_RADIUS_M * pxPerMeter}
                  angle={WEDGE_ANGLE_DEG}
                  rotation={facingToScreenDeg(pose.rotation, flip) - WEDGE_ANGLE_DEG / 2}
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
                {peers
                  .filter((peer) => peer.selectedPerformerIds.includes(p.id))
                  .map((peer) => (
                    <Circle
                      key={peer.clientId}
                      radius={(HIT_RADIUS_M + 0.12) * pxPerMeter}
                      stroke={peer.color}
                      strokeWidth={1.5}
                      dash={[2, 4]}
                      listening={false}
                    />
                  ))}
                {/* Mark: a circled badge when one is set, else spike-tape cross. */}
                {(p.badge ?? '') !== '' ? (
                  <>
                    <Circle
                      radius={0.32 * pxPerMeter}
                      fill="#191512"
                      stroke={p.color}
                      strokeWidth={2.5}
                    />
                    <Text
                      x={-0.32 * pxPerMeter}
                      y={-0.32 * pxPerMeter}
                      width={0.64 * pxPerMeter}
                      height={0.64 * pxPerMeter}
                      align="center"
                      verticalAlign="middle"
                      text={p.badge ?? ''}
                      fontStyle="bold"
                      fontFamily="'Instrument Sans Variable', sans-serif"
                      fontSize={
                        (p.badge ?? '').length <= 1
                          ? 0.36 * pxPerMeter
                          : (p.badge ?? '').length <= 2
                            ? 0.27 * pxPerMeter
                            : 0.17 * pxPerMeter
                      }
                      fill={p.color}
                      listening={false}
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
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

        {/* Whole-show walk path for one performer: numbered stops, dashed legs. */}
        {!isPlaying &&
          pathPerformerId !== null &&
          (() => {
            const walker = performers.find((p) => p.id === pathPerformerId);
            if (walker === undefined) return null;
            const stops: {
              formationId: string;
              pos: NonNullable<(typeof editPositions)[string]>;
            }[] = [];
            for (const f of ordered) {
              const pos = positions[f.id]?.[walker.id];
              if (pos !== undefined) stops.push({ formationId: f.id, pos });
            }
            if (stops.length === 0) return null;
            return (
              <Layer listening={false}>
                {stops.slice(0, -1).map((stop, i) => {
                  const next = stops[i + 1];
                  if (next === undefined) return null;
                  const fromPx = toPx(stop.pos.x, stop.pos.y);
                  const nextPx = toPx(next.pos.x, next.pos.y);
                  const formation = ordered.find((f) => f.id === stop.formationId);
                  const control =
                    formation?.transitionType === 'curve'
                      ? stop.pos.curveControlPoints?.[0]
                      : undefined;
                  const controlPx = control !== undefined ? toPx(control.x, control.y) : null;
                  return controlPx !== null ? (
                    <Shape
                      key={`leg-${stop.formationId}`}
                      stroke={walker.color}
                      strokeWidth={2}
                      dash={[7, 5]}
                      opacity={0.9}
                      sceneFunc={(ctx, shape) => {
                        ctx.beginPath();
                        ctx.moveTo(fromPx.x, fromPx.y);
                        ctx.quadraticCurveTo(controlPx.x, controlPx.y, nextPx.x, nextPx.y);
                        ctx.fillStrokeShape(shape);
                      }}
                    />
                  ) : (
                    <Line
                      key={`leg-${stop.formationId}`}
                      points={[fromPx.x, fromPx.y, nextPx.x, nextPx.y]}
                      stroke={walker.color}
                      strokeWidth={2}
                      dash={[7, 5]}
                      opacity={0.9}
                    />
                  );
                })}
                {stops.map((stop, i) => {
                  const px = toPx(stop.pos.x, stop.pos.y);
                  return (
                    <Group key={`stop-${stop.formationId}`} x={px.x} y={px.y}>
                      <Circle radius={9} fill="#191512" stroke={walker.color} strokeWidth={1.5} />
                      <Text
                        x={-9}
                        y={-9}
                        width={18}
                        height={18}
                        align="center"
                        verticalAlign="middle"
                        text={String(i + 1)}
                        fontFamily="'IBM Plex Mono', monospace"
                        fontSize={10}
                        fill="#ece5db"
                      />
                    </Group>
                  );
                })}
              </Layer>
            );
          })()}

        {/* Marquee selection rectangle */}
        {marquee !== null && (
          <Layer listening={false}>
            <Rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(232, 168, 76, 0.08)"
              stroke="#e8a84c"
              strokeWidth={1}
              dash={[4, 4]}
            />
          </Layer>
        )}

        {/* Remote collaborators' cursors */}
        {peers.length > 0 && (
          <Layer listening={false}>
            {peers.map((peer) => {
              if (peer.cursor === null) return null;
              const px = toPx(peer.cursor.x, peer.cursor.y);
              return (
                <Group key={peer.clientId} x={px.x} y={px.y}>
                  <Circle radius={4} fill={peer.color} stroke="#191512" strokeWidth={1} />
                  <Text
                    x={7}
                    y={-5}
                    text={peer.name}
                    fontFamily="'Instrument Sans Variable', sans-serif"
                    fontSize={10}
                    fill={peer.color}
                  />
                </Group>
              );
            })}
          </Layer>
        )}
      </Stage>
    </div>
  );
}
