-- OpenStage initial schema.
-- Coordinates are meters (see packages/shared-types); times are milliseconds.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

CREATE TABLE organization (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    email         text NOT NULL UNIQUE,
    display_name  text NOT NULL,
    avatar_url    text,
    -- OAuth identities; password-less by design.
    google_sub    text UNIQUE,
    github_id     text UNIQUE,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performance (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    title           text NOT NULL,
    stage_width     real NOT NULL CHECK (stage_width > 0),
    stage_height    real NOT NULL CHECK (stage_height > 0),
    bpm             real CHECK (bpm > 0),
    audio_asset_id  uuid,
    beat_markers_ms jsonb NOT NULL DEFAULT '[]',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performer (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_id  uuid NOT NULL REFERENCES performance(id) ON DELETE CASCADE,
    name            text NOT NULL,
    color           text NOT NULL,
    role            text NOT NULL DEFAULT '',
    avatar_url      text
);

CREATE TABLE formation (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_id   uuid NOT NULL REFERENCES performance(id) ON DELETE CASCADE,
    order_index      integer NOT NULL,
    start_time_ms    integer NOT NULL CHECK (start_time_ms >= 0),
    duration_ms      integer NOT NULL CHECK (duration_ms >= 0),
    transition_type  text NOT NULL DEFAULT 'linear'
                     CHECK (transition_type IN ('linear', 'curve')),
    name             text NOT NULL DEFAULT '',
    UNIQUE (performance_id, order_index) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE formation_position (
    formation_id   uuid NOT NULL REFERENCES formation(id) ON DELETE CASCADE,
    performer_id   uuid NOT NULL REFERENCES performer(id) ON DELETE CASCADE,
    x              real NOT NULL,
    y              real NOT NULL,
    rotation       real NOT NULL DEFAULT 0,
    z              real,
    -- Bézier control points for a 'curve' transition out of this formation.
    curve_control_points jsonb,
    PRIMARY KEY (formation_id, performer_id)
);

CREATE TABLE comment (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    formation_id  uuid NOT NULL REFERENCES formation(id) ON DELETE CASCADE,
    performer_id  uuid REFERENCES performer(id) ON DELETE CASCADE,
    author_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    text          text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE version_snapshot (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_id  uuid NOT NULL REFERENCES performance(id) ON DELETE CASCADE,
    yjs_state       bytea NOT NULL,
    created_by      uuid NOT NULL REFERENCES app_user(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_asset (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_id  uuid NOT NULL REFERENCES performance(id) ON DELETE CASCADE,
    type            text NOT NULL CHECK (type IN ('audio', 'image', 'video')),
    url             text NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE performance
    ADD CONSTRAINT performance_audio_asset_fk
    FOREIGN KEY (audio_asset_id) REFERENCES media_asset(id) ON DELETE SET NULL;

-- Membership/permissions: Owner/Editor/Viewer per performance (roadmap V1).
CREATE TABLE performance_member (
    performance_id  uuid NOT NULL REFERENCES performance(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    member_role     text NOT NULL CHECK (member_role IN ('owner', 'editor', 'viewer')),
    PRIMARY KEY (performance_id, user_id)
);

CREATE INDEX idx_performance_org ON performance(org_id);
CREATE INDEX idx_performer_performance ON performer(performance_id);
CREATE INDEX idx_formation_performance ON formation(performance_id, order_index);
CREATE INDEX idx_comment_formation ON comment(formation_id);
CREATE INDEX idx_snapshot_performance ON version_snapshot(performance_id, created_at DESC);
CREATE INDEX idx_media_performance ON media_asset(performance_id);
