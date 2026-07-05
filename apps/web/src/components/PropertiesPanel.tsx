import type { ReactElement } from 'react';
import { useEditor } from '../state/store';

/** Parse a number input, returning null for empty/invalid text. */
function num(value: string): number | null {
  const n = Number(value);
  return value.trim() === '' || Number.isNaN(n) ? null : n;
}

function PerformerSection(): ReactElement | null {
  const performers = useEditor((s) => s.performers);
  const selectedPerformerIds = useEditor((s) => s.selectedPerformerIds);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const positions = useEditor((s) => s.positions);
  const updatePerformer = useEditor((s) => s.updatePerformer);
  const removePerformer = useEditor((s) => s.removePerformer);
  const setPosition = useEditor((s) => s.setPosition);
  const setRotation = useEditor((s) => s.setRotation);

  const performerId = selectedPerformerIds[0];
  if (performerId === undefined) return null;
  const performer = performers.find((p) => p.id === performerId);
  if (performer === undefined) return null;
  if (selectedPerformerIds.length > 1) {
    return (
      <>
        <div className="panel-title">Performers</div>
        <p className="empty-note">
          {selectedPerformerIds.length} selected. Arrow keys nudge, [ and ] rotate.
        </p>
      </>
    );
  }
  const pos = positions[selectedFormationId]?.[performerId];

  return (
    <>
      <div className="panel-title">Performer</div>
      <div className="panel-section">
        <div className="field">
          <label htmlFor="perf-name">Name</label>
          <input
            id="perf-name"
            type="text"
            value={performer.name}
            onChange={(e) => updatePerformer(performer.id, { name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="perf-role">Role</label>
          <input
            id="perf-role"
            type="text"
            value={performer.role}
            placeholder="e.g. captain, flyer"
            onChange={(e) => updatePerformer(performer.id, { role: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="perf-color">Color</label>
          <input
            id="perf-color"
            type="color"
            value={performer.color}
            onChange={(e) => updatePerformer(performer.id, { color: e.target.value })}
          />
        </div>
        {pos !== undefined && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="pos-x">X (m)</label>
                <input
                  id="pos-x"
                  type="number"
                  step={0.1}
                  value={Number(pos.x.toFixed(2))}
                  onChange={(e) => {
                    const v = num(e.target.value);
                    if (v !== null) setPosition(selectedFormationId, performer.id, v, pos.y);
                  }}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="pos-y">Y (m)</label>
                <input
                  id="pos-y"
                  type="number"
                  step={0.1}
                  value={Number(pos.y.toFixed(2))}
                  onChange={(e) => {
                    const v = num(e.target.value);
                    if (v !== null) setPosition(selectedFormationId, performer.id, pos.x, v);
                  }}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pos-rot">Facing (° — 0 = audience)</label>
              <input
                id="pos-rot"
                type="range"
                min={0}
                max={359}
                value={Math.round(pos.rotation)}
                onChange={(e) => {
                  const v = num(e.target.value);
                  if (v !== null) setRotation(selectedFormationId, performer.id, v);
                }}
              />
              <input
                type="number"
                aria-label="Facing degrees"
                min={0}
                max={359}
                value={Math.round(pos.rotation)}
                onChange={(e) => {
                  const v = num(e.target.value);
                  if (v !== null) setRotation(selectedFormationId, performer.id, v);
                }}
              />
            </div>
          </>
        )}
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removePerformer(performer.id)}
        >
          Remove from cast
        </button>
      </div>
    </>
  );
}

function FormationSection(): ReactElement | null {
  const formations = useEditor((s) => s.formations);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const updateFormation = useEditor((s) => s.updateFormation);
  const setFormationStart = useEditor((s) => s.setFormationStart);
  const removeFormation = useEditor((s) => s.removeFormation);
  const moveFormation = useEditor((s) => s.moveFormation);

  const formation = formations.find((f) => f.id === selectedFormationId);
  if (formation === undefined) return null;

  return (
    <>
      <div className="panel-title">Formation</div>
      <div className="panel-section">
        <div className="field">
          <label htmlFor="form-name">Name</label>
          <input
            id="form-name"
            type="text"
            value={formation.name}
            onChange={(e) => updateFormation(formation.id, { name: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="form-start">Start (s)</label>
            <input
              id="form-start"
              type="number"
              min={0}
              step={0.1}
              value={Number((formation.startTimeMs / 1000).toFixed(1))}
              onChange={(e) => {
                const v = num(e.target.value);
                if (v !== null) setFormationStart(formation.id, v * 1000);
              }}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="form-dur">Hold (s)</label>
            <input
              id="form-dur"
              type="number"
              min={0}
              step={0.1}
              value={Number((formation.durationMs / 1000).toFixed(1))}
              onChange={(e) => {
                const v = num(e.target.value);
                if (v !== null)
                  updateFormation(formation.id, { durationMs: Math.max(0, v * 1000) });
              }}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="form-transition">Transition to next</label>
          <select
            id="form-transition"
            value={formation.transitionType}
            onChange={(e) =>
              updateFormation(formation.id, {
                transitionType: e.target.value === 'curve' ? 'curve' : 'linear',
              })
            }
          >
            <option value="linear">Linear (straight paths)</option>
            <option value="curve">Curve (coming in V2)</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => moveFormation(formation.id, -1)}>
            ← Earlier
          </button>
          <button type="button" className="btn" onClick={() => moveFormation(formation.id, 1)}>
            Later →
          </button>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removeFormation(formation.id)}
        >
          Delete formation
        </button>
      </div>
    </>
  );
}

function StageSection(): ReactElement {
  const performance = useEditor((s) => s.performance);
  const setStageSize = useEditor((s) => s.setStageSize);
  const setBpm = useEditor((s) => s.setBpm);

  return (
    <>
      <div className="panel-title">Stage</div>
      <div className="panel-section">
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="stage-w">Width (m)</label>
            <input
              id="stage-w"
              type="number"
              min={2}
              max={60}
              value={performance.stageWidth}
              onChange={(e) => {
                const v = num(e.target.value);
                if (v !== null) setStageSize(v, performance.stageHeight);
              }}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="stage-h">Depth (m)</label>
            <input
              id="stage-h"
              type="number"
              min={2}
              max={60}
              value={performance.stageHeight}
              onChange={(e) => {
                const v = num(e.target.value);
                if (v !== null) setStageSize(performance.stageWidth, v);
              }}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="stage-bpm">BPM (empty = unknown)</label>
          <input
            id="stage-bpm"
            type="number"
            min={20}
            max={300}
            value={performance.bpm ?? ''}
            onChange={(e) => setBpm(num(e.target.value))}
          />
        </div>
      </div>
    </>
  );
}

export function PropertiesPanel(): ReactElement {
  const hasPerformerSelection = useEditor((s) => s.selectedPerformerIds.length > 0);

  return (
    <aside className="props-panel side-panel">
      {hasPerformerSelection ? <PerformerSection /> : <FormationSection />}
      <StageSection />
    </aside>
  );
}
