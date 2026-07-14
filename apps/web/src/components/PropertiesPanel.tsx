import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import type { TemplateKind } from '../state/templates';
import { suggestFormations } from '../state/suggest';
import type { Suggestion } from '../state/suggest';
import { deleteSnapshot, listSnapshots, saveSnapshot } from '../state/history';
import {
  applyPresetToCast,
  deleteFormationPreset,
  listFormationPresets,
  saveFormationPreset,
} from '../state/formationPresets';
import type { FormationPreset } from '../state/formationPresets';
import type { Snapshot } from '../state/history';
import { CommentsSection } from './CommentsSection';
import { StageSettingsDialog } from './StageSettingsDialog';
import { useT } from '../i18n';
import { byOrder } from '../state/interpolate';
import { normalizeBadge } from '../state/badge';
import { analyzeTransition } from '@openstage/path-planner';
import type { WalkPath } from '@openstage/path-planner';

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
        <div className="field expert-only-ui">
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
        <div className="field expert-only-ui">
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
        <label
          className="expert-only-ui"
          style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}
        >
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
        <span className="field-label expert-only-ui">{t.performer.tools}</span>
        {count === 2 && (
          <button
            type="button"
            className="btn expert-only-ui"
            title={t.performer.swapTitle}
            onClick={swapSelected}
          >
            {t.performer.swap}
          </button>
        )}
        <div className="expert-only-ui" style={{ display: 'flex', gap: 8 }}>
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
          <div className="expert-only-ui" style={{ display: 'flex', gap: 8 }}>
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
  const performers = useEditor((s) => s.performers);
  const positions = useEditor((s) => s.positions);
  const [templateKind, setTemplateKind] = useState<TemplateKind>('line');
  const [copySourceId, setCopySourceId] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [presets, setPresets] = useState<FormationPreset[]>(() => listFormationPresets());
  const [presetId, setPresetId] = useState('');

  const onSavePreset = (): void => {
    const s = useEditor.getState();
    const name = window.prompt(t.presets.savePrompt, t.presets.defaultName);
    if (name === null || name.trim() === '') return;
    saveFormationPreset(
      name.trim(),
      s.performers.map((p) => p.id),
      s.positions[s.selectedFormationId] ?? {},
      s.performance.stageWidth,
      s.performance.stageHeight,
    );
    setPresets(listFormationPresets());
  };

  const onApplyPreset = (): void => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset === undefined) return;
    const s = useEditor.getState();
    applySuggestedPositions(
      applyPresetToCast(
        preset,
        s.performers.map((p) => p.id),
        s.positions[s.selectedFormationId] ?? {},
        s.performance.stageWidth,
        s.performance.stageHeight,
      ),
    );
  };

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

  // Virtual clinic: analyze the transition INTO this formation — dancers
  // who would meet mid-walk, and dancers who have to run to make it.
  const issues = ((): {
    collisions: [string, string][];
    tooFast: { name: string; speed: number }[];
  } | null => {
    if (isFirst) return null;
    const ordered = byOrder(formations);
    const previous = ordered[ordered.findIndex((f) => f.id === selectedFormationId) - 1];
    if (previous === undefined) return null;
    const prevPos = positions[previous.id] ?? {};
    const currPos = positions[selectedFormationId] ?? {};
    const walkers: string[] = [];
    const paths: WalkPath[] = [];
    for (const p of performers) {
      const from = prevPos[p.id];
      const to = currPos[p.id];
      if (from === undefined || to === undefined) continue;
      const control =
        previous.transitionType === 'curve' ? from.curveControlPoints?.[0] : undefined;
      walkers.push(p.name);
      paths.push({
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        ...(control !== undefined ? { control: { x: control.x, y: control.y } } : {}),
      });
    }
    const durationMs = formation.startTimeMs - (previous.startTimeMs + previous.durationMs);
    const result = analyzeTransition(paths, durationMs);
    if (result.collisions.length === 0 && result.tooFast.length === 0) return null;
    return {
      collisions: result.collisions.map(([i, j]) => [walkers[i] ?? '?', walkers[j] ?? '?']),
      tooFast: result.tooFast.map((f) => ({ name: walkers[f.index] ?? '?', speed: f.speedMps })),
    };
  })();

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
        <div className="field expert-only-ui">
          <label htmlFor="form-preset">{t.presets.label}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              id="form-preset"
              aria-label={t.presets.selectAria}
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
            >
              <option value="">—</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.spots.length}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              disabled={presetId === '' || !hasPerformers}
              title={t.presets.applyTitle}
              onClick={onApplyPreset}
            >
              {t.presets.apply}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              disabled={!hasPerformers}
              title={t.presets.saveTitle}
              onClick={onSavePreset}
            >
              {t.presets.save}
            </button>
            {presetId !== '' && (
              <button
                type="button"
                className="btn"
                aria-label={t.presets.deleteAria}
                onClick={() => {
                  deleteFormationPreset(presetId);
                  setPresetId('');
                  setPresets(listFormationPresets());
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        {issues !== null && (
          <div className="field expert-only-ui" role="status" aria-label={t.analyzer.aria}>
            {issues.collisions.map(([a, b]) => (
              <span key={`c-${a}-${b}`} className="analyzer-warn">
                {t.analyzer.collision(a, b)}
              </span>
            ))}
            {issues.tooFast.map((f) => (
              <span key={`s-${f.name}`} className="analyzer-warn">
                {t.analyzer.tooFast(f.name, f.speed.toFixed(1))}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn expert-only-ui"
          disabled={isFirst || !hasPerformers}
          title={isFirst ? t.formation.untangleFirstTitle : t.formation.untangleTitle}
          onClick={untangleFromPrevious}
        >
          {t.formation.untangle}
        </button>
        <button
          type="button"
          className="btn expert-only-ui"
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
        <div className="field expert-only-ui">
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
              props: s.props,
              formations: s.formations,
              positions: s.positions,
              comments: s.comments,
              annotations: s.annotations,
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

function PropSection(): ReactElement | null {
  const t = useT();
  const props = useEditor((s) => s.props);
  const selectedPropId = useEditor((s) => s.selectedPropId);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const positions = useEditor((s) => s.positions);
  const updateProp = useEditor((s) => s.updateProp);
  const removeProp = useEditor((s) => s.removeProp);
  const setRotation = useEditor((s) => s.setRotation);

  const prop = props.find((p) => p.id === selectedPropId);
  if (prop === undefined) return null;
  const rotation = positions[selectedFormationId]?.[prop.id]?.rotation ?? 0;

  return (
    <>
      <div className="panel-title">{t.props.sectionTitle}</div>
      <div className="panel-section">
        <div className="field">
          <label htmlFor="prop-name">{t.props.name}</label>
          <input
            id="prop-name"
            type="text"
            value={prop.name}
            onChange={(e) => updateProp(prop.id, { name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="prop-kind">{t.props.kind}</label>
          <select
            id="prop-kind"
            value={prop.kind}
            onChange={(e) => {
              const kind = e.target.value;
              if (kind === 'rect' || kind === 'circle' || kind === 'triangle')
                updateProp(prop.id, { kind });
            }}
          >
            <option value="rect">{t.props.kindRect}</option>
            <option value="circle">{t.props.kindCircle}</option>
            <option value="triangle">{t.props.kindTriangle}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="prop-color">{t.props.color}</label>
          <input
            id="prop-color"
            type="color"
            value={prop.color}
            onChange={(e) => updateProp(prop.id, { color: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="prop-width">{t.props.widthLabel}</label>
            <input
              id="prop-width"
              type="number"
              min={0.2}
              max={30}
              step={0.1}
              value={prop.width}
              onChange={(e) => {
                const w = num(e.target.value);
                if (w !== null) updateProp(prop.id, { width: Math.max(0.2, w) });
              }}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="prop-height">{t.props.heightLabel}</label>
            <input
              id="prop-height"
              type="number"
              min={0.2}
              max={30}
              step={0.1}
              value={prop.height}
              onChange={(e) => {
                const h = num(e.target.value);
                if (h !== null) updateProp(prop.id, { height: Math.max(0.2, h) });
              }}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="prop-rotation">{t.props.rotationLabel}</label>
          <input
            id="prop-rotation"
            type="number"
            step={5}
            value={rotation}
            onChange={(e) => {
              const deg = num(e.target.value);
              if (deg !== null) setRotation(selectedFormationId, prop.id, deg);
            }}
          />
        </div>
        <button type="button" className="btn" onClick={() => removeProp(prop.id)}>
          {t.props.remove}
        </button>
      </div>
    </>
  );
}

export function PropertiesPanel(): ReactElement {
  const t = useT();
  const hasPerformerSelection = useEditor((s) => s.selectedPerformerIds.length > 0);
  const hasPropSelection = useEditor((s) => s.selectedPropId !== null);

  return (
    <aside className="props-panel side-panel">
      {hasPropSelection ? (
        <PropSection />
      ) : hasPerformerSelection ? (
        <PerformerSection />
      ) : (
        <FormationSection />
      )}
      <StageSettingsDialog />
      <details className="panel-fold expert-only-ui">
        <summary>{t.history.title}</summary>
        <HistorySection />
      </details>
    </aside>
  );
}
