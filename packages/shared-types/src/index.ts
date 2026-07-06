/**
 * OpenStage domain model.
 *
 * Conventions:
 * - All ids are UUIDs (string).
 * - Stage coordinates are in meters. Origin is the upstage-left corner of the
 *   stage; x grows stage-right, y grows downstage (toward the audience).
 * - `rotation` is the performer's facing in degrees, 0 = facing the audience
 *   (downstage), clockwise positive on the top-down plan view.
 * - Times are milliseconds from the start of the performance audio.
 */

export type TransitionType = 'linear' | 'curve';

export type MemberRole = 'owner' | 'editor' | 'viewer';

export type MediaAssetType = 'audio' | 'image' | 'video';

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Performance {
  id: string;
  orgId: string;
  title: string;
  /** Stage width in meters (x axis). */
  stageWidth: number;
  /** Stage depth in meters (y axis). */
  stageHeight: number;
  bpm: number | null;
  audioAssetId: string | null;
  /** Manual beat markers, ms from audio start. Stored as JSONB server-side. */
  beatMarkersMs: number[];
}

export interface Formation {
  id: string;
  performanceId: string;
  orderIndex: number;
  /** When this formation is fully assembled, ms from audio start. */
  startTimeMs: number;
  /** How long the formation holds before transitioning to the next one. */
  durationMs: number;
  /** How performers travel to the NEXT formation. */
  transitionType: TransitionType;
  name: string;
}

export interface Performer {
  id: string;
  performanceId: string;
  name: string;
  /** Display color, hex like "#e05252". */
  color: string;
  role: string;
  avatarUrl: string | null;
}

export interface FormationPosition {
  formationId: string;
  performerId: string;
  x: number;
  y: number;
  /** Facing in degrees, 0 = facing audience. */
  rotation: number;
  /** Elevation in meters (lifts, platforms). Optional. */
  z?: number;
  /**
   * Bézier control points for a 'curve' transition OUT of this formation,
   * in stage meters. Absent or empty = straight line.
   */
  curveControlPoints?: readonly { x: number; y: number }[];
}

export interface Comment {
  id: string;
  formationId: string;
  /** Null = comment on the whole formation, otherwise on one performer. */
  performerId: string | null;
  authorId: string;
  text: string;
  createdAt: string;
}

/**
 * Comment as carried in the editor document (local doc / Yjs). Uses a free
 * author display name because the client may have no authenticated user;
 * the API maps this to `Comment.authorId` once accounts exist.
 */
export interface DocComment {
  id: string;
  formationId: string;
  /** Null = comment on the whole formation, otherwise on one performer. */
  performerId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface VersionSnapshot {
  id: string;
  performanceId: string;
  /** Base64-encoded Yjs document state. */
  yjsState: string;
  createdBy: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  performanceId: string;
  type: MediaAssetType;
  url: string;
  metadata: Record<string, unknown>;
}

/** Stage defaults used when creating a new performance (typical dance studio). */
export const DEFAULT_STAGE_WIDTH_M = 12;
export const DEFAULT_STAGE_HEIGHT_M = 8;
export const DEFAULT_FORMATION_DURATION_MS = 8_000;
export const DEFAULT_TRANSITION_MS = 4_000;

/** Palette assigned to performers in creation order (colorblind-safe). */
export const PERFORMER_COLORS: readonly string[] = [
  '#e8843c', // orange
  '#5b8ff0', // blue
  '#58b5a4', // teal
  '#d0668f', // pink
  '#8f7ee0', // violet
  '#b0a13f', // olive
  '#d95f5f', // red
  '#4fa3d1', // sky
  '#9d8556', // tan
  '#7f9e58', // green
];
