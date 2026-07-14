import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import type { TemplateKind } from '../state/templates';
import { suggestFormations } from '../state/suggest';
import type { Suggestion } from '../state/suggest';
import { deleteSnapshot, listSnapshots, saveSnapshot } from '../state/history';
import type { Snapshot } from '../state/history';
import { CommentsSection } from './CommentsSection';
import { useT } from '../i18n';
import { appendTap, bpmFromTaps, MIN_TAPS_TO_APPLY } from '../audio/tapTempo';
import { byOrder, showEndMs } from '../state/interpolate';
import { audioDurationMs } from '../audio/audioPlayer';
import { normalizeBadge } from '../state/badge';

/** Parse a number input, returning null for empty/invalid text. */
function num(value: string): number | null {
  const n = Number(value);
  return value.trim() === '' || Number.isNaN(n) ? null : n;
}

/** "front, flyers" -> unique trimmed group names (CJK commas count too). */
function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,，、]/).map((part) => part.trim()))].filter((tag) => tag !== '');
}

function PerformerSection(): ReactElement | null {
  const t = useT();
  const performers = useEditor((s) => s.performers);
  const selectedPerformerIds = useEditor((s) => s.selectedPerformerIds);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const positions = useEditor((s) => s.positions);
  const updatePerformer = useEditor((s) => s.updatePerformer);
  const removePerformer = useEditor((s) => s.removePerformer);
  const setPosition = useEditor((s) => s.setPosition);
  const setRotation = useEditor((s) => s.setRotation);
  const pathPerformerId = useEditor((s) => s.pathPerformerId);
  const setPathPerformer = useEditor((s) => s.setPathPerformer);

  const performerId = selectedPerformerIds[0];
  if (performerId === undefined) return null;
  const performer = performers.find((p) => p.id === performerId);
  if (performer === undefined) return null;
  if (selectedPerformerIds.length > 1) {
    return <MultiSelectSection count={selectedPerformerIds.length} />;
  }
  const pos = positions[selectedFormationId]?.[performerId];

  return (
    <>
      <div className="panel-title">{t.performer.titleOne}</div>
      <div className="panel-section">
        <div className="field">
          <label htmlFor="perf-name">{t.performer.name}</label>
          <input
            id="perf-name"
            type="text"
            value={performer.name}
            onChange={(e) => updatePerformer(performer.id, { name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="perf-role">{t.performer.role}</label>
          <input
            id="perf-role"
            type="text"
            value={performer.role}
            placeholder={t.performer.rolePlaceholder}
            onChange={(e) => updatePerformer(performer.id, { role: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="perf-color">{t.performer.color}</label>
          <input
            id="perf-color"
            type="color"
            value={performer.color}
            onChange={(e) => updatePerformer(performer.id, { color: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="perf-badge" title={t.performer.badgeTitle}>
            {t.performer.badgeLabel}
          </label>
          <input
            id="perf-badge"
            type="text"
            title={t.performer.badgeTitle}
            value={performer.badge ?? ''}
            onChange={(e) =>
              updatePerformer(performer.id, { badge: normalizeBadge(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="perf-tags" title={t.performer.tagsTitle}>
            {t.performer.tagsLabel}
          </label>
          <input
            id="perf-tags"
            key={performer.id}
            type="text"
            title={t.performer.tagsTitle}
            defaultValue={(performer.tags ?? []).join(', ')}
            placeholder={t.performer.tagsPlaceholder}
            onBlur={(e) => updatePerformer(performer.id, { tags: parseTags(e.target.value) })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={pathPerformerId === performer.id}
            onChange={(e) => setPathPerformer(e.target.checked ? performer.id : null)}
          />
          {t.performer.showPath}
        </label>
        {pos !== undefined && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="pos-x">{t.performer.xLabel}</label>
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
                <label htmlFor="pos-y">{t.performer.yLabel}</label>
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
              <label htmlFor="pos-rot">{t.performer.facingLabel}</label>
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
                aria-label={t.performer.facingDegreesAria}
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
          {t.performer.removeFromCast}
        </button>
      </div>
      <CommentsSection performerId={performer.id} />
    </>
  );
}

function MultiSelectSection({ count }: { count: number }): ReactElement {
  const t = useT();
  const swapSelected = useEditor((s) => s.swapSelected);
  const alignSelected = useEditor((s) => s.alignSelected);
  const distributeSelected = useEditor((s) => s.distributeSelected);

  return (
    <>
      <div className="panel-title">{t.performer.titleMany}</div>
      <div className="panel-section">
        <p className="empty-note">{t.performer.multiSelected(count)}</p>
        <span className="field-label">{t.performer.tools}</span>
        {count === 2 && (
          <button
            type="button"
            className="btn"
            title={t.performer.swapTitle}
            onClick={swapSelected}
          >
            {t.performer.swap}
          </button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            title={t.performer.alignRowTitle}
            onClick={() => alignSelected('row')}
          >
            {t.performer.alignRow}
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            title={t.performer.alignColTitle}
            onClick={() => alignSelected('col')}
          >
            {t.performer.alignCol}
          </button>
        </div>
        {count >= 3 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              title={t.performer.distributeXTitle}
              onClick={() => distributeSelected('x')}
            >
              {t.performer.distributeX}
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              title={t.performer.distributeYTitle}
              onClick={() => distributeSelected('y')}
            >
              {t.performer.distributeY}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Tiny stage plan of one suggestion: the stage box plus one dot per spot. */
function SuggestionPreview({ suggestion }: { suggestion: Suggestion }): ReactElement {
  const stageWidth = useEditor((s) => s.performance.stageWidth);
  const stageHeight = useEditor((s) => s.performance.stageHeight);
  const W = 72;
  const H = Math.round((W * stageHeight) / stageWidth);
  return (
    <svg
      width={W}
      height={H}
      aria-hidden="true"
      style={{ background: 'var(--house)', border: '1px solid var(--panel-edge)', flexShrink: 0 }}
    >
      {Object.values(suggestion.positions).map((spot, i) => (
        <circle
          key={i}
          cx={(spot.x / stageWidth) * W}
          cy={(spot.y / stageHeight) * H}
          r={2}
          fill="var(--tungsten)"
        />
      ))}
    </svg>
  );
}

function FormationSection(): ReactElement | null {
  const t = useT();
  const formations = useEditor((s) => s.formations);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const updateFormation = useEditor((s) => s.updateFormation);
  const setFormationStart = useEditor((s) => s.setFormationStart);
  const removeFormation = useEditor((s) => s.removeFormation);
  const moveFormation = useEditor((s) => s.moveFormation);
  const applyTemplate = useEditor((s) => s.applyTemplate);
  const untangleFromPrevious = useEditor((s) => s.untangleFromPrevious);
  const mirrorFormation = useEditor((s) => s.mirrorFormation);
  const copyPositionsFrom = useEditor((s) => s.copyPositionsFrom);
  const applySuggestedPositions = useEditor((s) => s.applySuggestedPositions);
  const hasPerformers = useEditor((s) => s.performers.length > 0);
  const [templateKind, setTemplateKind] = useState<TemplateKind>('line');
  const [copySourceId, setCopySourceId] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  const onSuggest = (): void => {
    // Read once on click — suggestions should not churn while dragging.
    const s = useEditor.getState();
    const ordered = byOrder(s.formations);
    const index = ordered.findIndex((f) => f.id === s.selectedFormationId);
    const previous = index > 0 ? ordered[index - 1] : undefined;
    const previousSpots = previous !== undefined ? (s.positions[previous.id] ?? null) : null;
    setSuggestions(
      suggestFormations(
        s.performers.map((p) => p.id),
        previousSpots,
        s.performance.stageWidth,
        s.performance.stageHeight,
      ),
    );
  };

  const formation = formations.find((f) => f.id === selectedFormationId);
  if (formation === undefined) return null;
  const isFirst = ![...formations].some((f) => f.orderIndex < formation.orderIndex);

  return (
    <>
      <div className="panel-title">{t.formation.title}</div>
      <div className="panel-section">
        <div className="field">
          <label htmlFor="form-name">{t.formation.name}</label>
          <input
            id="form-name"
            type="text"
            value={formation.name}
            onChange={(e) => updateFormation(formation.id, { name: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="form-start">{t.formation.startLabel}</label>
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
            <label htmlFor="form-dur">{t.formation.holdLabel}</label>
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
          <label htmlFor="form-transition">{t.formation.transitionLabel}</label>
          <select
            id="form-transition"
            value={formation.transitionType}
            onChange={(e) =>
              updateFormation(formation.id, {
                transitionType: e.target.value === 'curve' ? 'curve' : 'linear',
              })
            }
          >
            <option value="linear">{t.formation.transitionLinear}</option>
            <option value="curve">{t.formation.transitionCurve}</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => moveFormation(formation.id, -1)}>
            {t.formation.earlier}
          </button>
          <button type="button" className="btn" onClick={() => moveFormation(formation.id, 1)}>
            {t.formation.later}
          </button>
        </div>
        <div className="field">
          <label htmlFor="form-template">{t.formation.templateLabel}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              id="form-template"
              value={templateKind}
              onChange={(e) => setTemplateKind(e.target.value as TemplateKind)}
            >
              {Object.entries(t.formation.templates).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              disabled={!hasPerformers}
              title={hasPerformers ? t.formation.applyTitle : t.formation.applyDisabledTitle}
              onClick={() => applyTemplate(templateKind)}
            >
              {t.formation.apply}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          disabled={isFirst || !hasPerformers}
          title={isFirst ? t.formation.untangleFirstTitle : t.formation.untangleTitle}
          onClick={untangleFromPrevious}
        >
          {t.formation.untangle}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!hasPerformers}
          title={t.formation.mirrorTitle}
          onClick={mirrorFormation}
        >
          {t.formation.mirror}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!hasPerformers}
          title={t.suggest.buttonTitle}
          onClick={onSuggest}
        >
          {t.suggest.button}
        </button>
        {suggestions !== null && suggestions.length > 0 && (
          <div className="field" aria-label={t.suggest.listAria}>
            {suggestions.map((suggestion) => (
              <div key={suggestion.kind} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <SuggestionPreview suggestion={suggestion} />
                <span style={{ flex: 1, fontSize: 12 }}>{t.suggest.kinds[suggestion.kind]}</span>
                <button
                  type="button"
                  className="btn"
                  title={t.suggest.applyTitle}
                  onClick={() => applySuggestedPositions(suggestion.positions)}
                >
                  {t.suggest.apply}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="field">
          <label htmlFor="form-copy-from">{t.formation.copyFromLabel}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              id="form-copy-from"
              aria-label={t.formation.copyFromAria}
              value={copySourceId}
              onChange={(e) => setCopySourceId(e.target.value)}
            >
              <option value="">—</option>
              {byOrder(formations)
                .filter((f) => f.id !== formation.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn"
              disabled={copySourceId === ''}
              title={t.formation.copyFromTitle}
              onClick={() => copyPositionsFrom(copySourceId)}
            >
              {t.formation.copyFrom}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removeFormation(formation.id)}
        >
          {t.formation.deleteFormation}
        </button>
      </div>
      <CommentsSection performerId={null} />
    </>
  );
}

function StageSection(): ReactElement {
  const t = useT();
  const performance = useEditor((s) => s.performance);
  const setStageSize = useEditor((s) => s.setStageSize);
  const setAudienceAt = useEditor((s) => s.setAudienceAt);
  const setBpm = useEditor((s) => s.setBpm);
  const addCountSegment = useEditor((s) => s.addCountSegment);
  const updateCountSegment = useEditor((s) => s.updateCountSegment);
  const removeCountSegment = useEditor((s) => s.removeCountSegment);

  const onAddCountSegment = (): void => {
    // Playhead read on click only — subscribing would re-render every frame.
    const s = useEditor.getState();
    const startMs = s.playheadMs;
    const endMs = Math.max(showEndMs(s.formations), audioDurationMs(), startMs + 8000);
    addCountSegment(startMs, endMs);
  };

  // Tap-tempo calibration: the button is the tap target; Date.now() because
  // the local `performance` above shadows window.performance here.
  const [taps, setTaps] = useState<number[]>([]);
  const liveBpm = bpmFromTaps(taps);
  const onTap = (): void => setTaps((prev) => appendTap(prev, Date.now()));

  return (
    <>
      <div className="panel-title">{t.stage.title}</div>
      <div className="panel-section">
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="stage-w">{t.stage.width}</label>
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
            <label htmlFor="stage-h">{t.stage.depth}</label>
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
          <label htmlFor="stage-audience">{t.stage.audiencePosition}</label>
          <select
            id="stage-audience"
            value={performance.audienceAt ?? 'bottom'}
            onChange={(e) => setAudienceAt(e.target.value === 'top' ? 'top' : 'bottom')}
          >
            <option value="bottom">{t.stage.audienceBottom}</option>
            <option value="top">{t.stage.audienceTop}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="stage-bpm">{t.stage.bpm}</label>
          <input
            id="stage-bpm"
            type="number"
            min={20}
            max={300}
            value={performance.bpm ?? ''}
            onChange={(e) => setBpm(num(e.target.value))}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn edit-only"
            title={t.stage.calibrateBpmTitle}
            onClick={onTap}
          >
            {taps.length === 0 ? t.stage.calibrateBpm : t.stage.tapLabel(taps.length)}
          </button>
          {taps.length > 0 && (
            <>
              <span className="mono" role="status">
                {liveBpm !== null ? `≈ ${Math.round(liveBpm)} BPM` : t.stage.tapHint}
              </span>
              {liveBpm !== null && taps.length >= MIN_TAPS_TO_APPLY && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setBpm(Math.round(liveBpm));
                    setTaps([]);
                  }}
                >
                  {t.stage.applyBpm(Math.round(liveBpm))}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setTaps([])}>
                {t.stage.resetTap}
              </button>
            </>
          )}
        </div>
        <div className="field">
          <span className="field-label">{t.stage.countSegments}</span>
          {performance.countSegments.length === 0 && (
            <span className="mono">{t.stage.countSegmentsNote}</span>
          )}
          {performance.countSegments.map((seg, i) => (
            <div key={seg.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                aria-label={t.stage.segStartAria(i + 1)}
                min={0}
                step={0.1}
                style={{ flex: 1 }}
                value={Number((seg.startMs / 1000).toFixed(1))}
                onChange={(e) => {
                  const v = num(e.target.value);
                  if (v !== null) updateCountSegment(seg.id, { startMs: v * 1000 });
                }}
              />
              <button
                type="button"
                className="btn"
                title={t.stage.segAtPlayheadTitle}
                onClick={() =>
                  updateCountSegment(seg.id, { startMs: useEditor.getState().playheadMs })
                }
              >
                @
              </button>
              <span className="mono">–</span>
              <input
                type="number"
                aria-label={t.stage.segEndAria(i + 1)}
                min={0}
                step={0.1}
                style={{ flex: 1 }}
                value={Number((seg.endMs / 1000).toFixed(1))}
                onChange={(e) => {
                  const v = num(e.target.value);
                  if (v !== null) updateCountSegment(seg.id, { endMs: v * 1000 });
                }}
              />
              <button
                type="button"
                className="btn"
                title={t.stage.segAtPlayheadTitle}
                onClick={() =>
                  updateCountSegment(seg.id, { endMs: useEditor.getState().playheadMs })
                }
              >
                @
              </button>
              <button
                type="button"
                className="comment-delete"
                aria-label={t.stage.removeSegmentAria(i + 1)}
                onClick={() => removeCountSegment(seg.id)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn edit-only"
            title={t.stage.addCountSegmentTitle}
            onClick={onAddCountSegment}
          >
            {t.stage.addCountSegment}
          </button>
        </div>
      </div>
    </>
  );
}

function HistorySection(): ReactElement {
  const t = useT();
  const restoreDoc = useEditor((s) => s.restoreDoc);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const refresh = useCallback(() => {
    void listSnapshots().then(setSnapshots);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <div className="panel-title">{t.history.title}</div>
      <div className="panel-section">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const s = useEditor.getState();
            const name = `${s.performance.title} · ${new Date().toLocaleTimeString()}`;
            void saveSnapshot(name, {
              performance: s.performance,
              performers: s.performers,
              formations: s.formations,
              positions: s.positions,
              comments: s.comments,
            }).then(refresh);
          }}
        >
          {t.history.saveSnapshot}
        </button>
        {snapshots.length === 0 && <span className="mono">{t.history.noSnapshots}</span>}
        {snapshots.map((snap) => (
          <div key={snap.id} className="comment-row">
            <div className="comment-head">
              <span className="comment-author">
                {new Date(snap.createdAt).toLocaleString(t.dateLocale, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <button
                type="button"
                className="comment-delete"
                aria-label={t.history.deleteSnapshotAria(snap.name)}
                onClick={() => {
                  void deleteSnapshot(snap.id).then(refresh);
                }}
              >
                ×
              </button>
            </div>
            <div className="comment-text">{snap.name}</div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 4 }}
              onClick={() => restoreDoc(snap.doc)}
            >
              {t.history.restore}
            </button>
          </div>
        ))}
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
      <HistorySection />
    </aside>
  );
}
