/**
 * English UI strings — the source of truth for the Messages shape.
 *
 * Rules for every dictionary:
 * - Keys grouped by UI area. Add new strings HERE first; the compiler then
 *   forces every other locale to provide them (they are typed `Messages`).
 * - Strings with variables are functions, so word order can differ per
 *   language ("Imported 3 performers" vs 「已匯入 3 位舞者」).
 * - Language names (locale.*) stay in their own language in ALL dictionaries.
 */
export const en = {
  /** BCP-47 tag for Date/number formatting in this locale. */
  dateLocale: 'en-US',

  locale: {
    label: 'Language',
    english: 'English',
    chinese: '中文',
  },

  topbar: {
    performanceTitleAria: 'Performance title',
    undo: 'Undo',
    undoTitle: 'Undo (Ctrl+Z)',
    redo: 'Redo',
    redoTitle: 'Redo (Ctrl+Shift+Z)',
    peopleInSession: (n: number): string => `${n} people in session`,
    youTag: (name: string): string => `${name} (you)`,
    displayNameAria: 'Your display name',
    displayNameTitle: 'Your name on comments and live sessions',
    shareLive: 'Share live',
    copyLink: (room: string): string => `Copy link · ${room}`,
    linkCopied: 'Link copied',
    viewLink: 'View link',
    viewLinkTitle: 'Copy a view-only link (hides editing UI — not access control)',
    viewLinkCopied: 'View link copied',
    playheadAria: 'Playhead time',
    playbackSpeedAria: 'Playback speed',
    play: 'Play',
    pause: 'Pause',
    exportPdf: 'Export PDF',
    exportVideo: 'Export video',
    exportVideoTitle: 'Record the playback animation to a movie file (runs in real time)',
    videoModeAria: 'Video export view (2D or 3D)',
    exportVideoCancel: (percent: number): string => `Cancel ${percent}%`,
    videoExportFailed: 'Video export failed',
  },

  cast: {
    title: 'Cast',
    addPerformer: 'Add performer',
    importCsv: 'Import CSV',
    importCsvTitle: 'CSV columns: name, role, color (header row optional)',
    rosterFileAria: 'Roster CSV file',
    importEmpty: 'No rows found — expected: name, role, color',
    imported: (n: number): string => `Imported ${n} performer${n === 1 ? '' : 's'}`,
    emptyNote: 'No performers yet. Add one, then drag their mark onto the stage.',
    performersAria: 'Performers',
  },

  performer: {
    titleOne: 'Performer',
    titleMany: 'Performers',
    multiSelected: (n: number): string => `${n} selected. Arrow keys nudge, [ and ] rotate.`,
    tools: 'Tools',
    swap: 'Swap the two',
    swapTitle: 'Exchange these two performers’ spots in this formation',
    alignRow: 'Align row',
    alignRowTitle: 'Line the selected performers up horizontally (same depth)',
    alignCol: 'Align column',
    alignColTitle: 'Line the selected performers up vertically (same left-right)',
    distributeX: 'Space across',
    distributeXTitle: 'Space the selected performers evenly left-to-right',
    distributeY: 'Space depth',
    distributeYTitle: 'Space the selected performers evenly front-to-back',
    name: 'Name',
    role: 'Role',
    rolePlaceholder: 'e.g. captain, flyer',
    color: 'Color',
    xLabel: 'X (m)',
    yLabel: 'Y (m)',
    facingLabel: 'Facing (° — 0 = audience)',
    facingDegreesAria: 'Facing degrees',
    removeFromCast: 'Remove from cast',
  },

  formation: {
    title: 'Formation',
    name: 'Name',
    startLabel: 'Start (s)',
    holdLabel: 'Hold (s)',
    transitionLabel: 'Transition to next',
    transitionLinear: 'Linear (straight paths)',
    transitionCurve: 'Curve (drag the path handles)',
    earlier: '← Earlier',
    later: 'Later →',
    templateLabel: 'Template',
    templates: {
      line: 'Line',
      v: 'V shape',
      circle: 'Circle',
      grid: 'Grid',
    },
    apply: 'Apply',
    applyTitle: 'Arrange everyone into this shape',
    applyDisabledTitle: 'Add performers first',
    untangle: 'Untangle from previous',
    untangleFirstTitle: 'No previous formation to walk from',
    untangleTitle:
      'Swap who takes which spot so total walking distance is minimal (red paths = crossings)',
    mirror: 'Mirror left–right',
    mirrorTitle: 'Flip the whole formation across the stage center line',
    deleteFormation: 'Delete formation',
  },

  stage: {
    title: 'Stage',
    width: 'Width (m)',
    depth: 'Depth (m)',
    bpm: 'BPM (empty = unknown)',
    calibrateBpm: 'Calibrate BPM',
    calibrateBpmTitle:
      'Start on a downbeat and click once per beat — the tempo is measured from your taps',
    tapLabel: (n: number): string => `Tap ${n}`,
    tapHint: 'Keep tapping…',
    resetTap: 'Reset',
    applyBpm: (bpm: number): string => `Use ${bpm}`,
    canvasAria: 'Stage canvas',
    audience: 'AUDIENCE',
    loading3d: 'Loading 3D preview…',
    to3dTitle: '3D preview (view only)',
    to2dTitle: 'Back to the 2D editor',
    cameraLabel: 'Camera view',
    camAudience: 'Audience',
    camOverhead: 'Overhead',
    camSide: 'Side',
    followLabel: 'Follow a performer',
    followNone: 'Free camera',
    followPrefix: 'Follow',
    audioFileAria: 'Audio file',
  },

  history: {
    title: 'History',
    saveSnapshot: 'Save snapshot',
    noSnapshots: 'No snapshots yet.',
    deleteSnapshotAria: (name: string): string => `Delete snapshot ${name}`,
    restore: 'Restore',
  },

  comments: {
    title: 'Comments',
    none: 'No comments yet.',
    deleteAria: (excerpt: string): string => `Delete comment: ${excerpt}`,
    placeholderFormation: 'Note on this formation…',
    placeholderPerformer: 'Note on this performer…',
    newCommentAria: 'New comment',
    add: 'Add',
  },

  timeline: {
    panelAria: 'Timeline',
    addFormation: 'Add formation',
    uploadAudio: 'Upload audio',
    replaceAudio: 'Replace audio',
    removeAudio: 'Remove audio',
    tapBeat: 'Tap beat',
    tapBeatTitle: 'Drop a beat marker at the playhead (great while music plays)',
    addSection: 'Add section',
    addSectionTitle: 'Label the playhead position (verse, chorus…)',
    sectionDefault: 'Section',
    renameSectionAria: 'Section name',
    removeSectionAria: (name: string): string => `Remove section ${name}`,
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    playing: 'playing',
    hint: 'drag formations to move · Ctrl+scroll to zoom',
    playheadAria: 'Playhead position',
    removeBeatAria: (seconds: string): string => `Remove beat marker at ${seconds}s`,
    formationAria: (name: string, seconds: string): string =>
      `Formation ${name}, starts at ${seconds}s`,
  },

  videoExport: {
    errNothingToExport: 'Nothing to export — add a formation first',
    errUnsupported: 'This browser cannot record video',
  },

  layout: {
    resizeCast: 'Resize cast panel',
    resizeProps: 'Resize properties panel',
    resizeTimeline: 'Resize timeline height',
  },
};
