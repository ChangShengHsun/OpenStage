import type { Messages } from './index';

/**
 * Traditional Chinese (繁體中文) dictionary. Every value is translated from
 * `en.ts`; keys, function signatures, `dateLocale`, and the language names
 * (`locale.english` / `locale.chinese`) stay as-is, and technical notation
 * (BPM, CSV, "X (m)" units) is kept while the surrounding words are Chinese.
 *
 * Glossary: performer 舞者 / formation 隊形 / transition 走位（隊形轉換）/
 * stage 舞台 / audience 觀眾席 / beat marker 節拍標記 / snapshot 快照 /
 * playhead 播放頭.
 */
export const zh: Messages = {
  dateLocale: 'zh-TW',

  locale: {
    label: '語言',
    english: 'English',
    chinese: '中文',
  },

  topbar: {
    performanceTitleAria: '演出標題',
    undo: '復原',
    undoTitle: '復原 (Ctrl+Z)',
    redo: '重做',
    redoTitle: '重做 (Ctrl+Shift+Z)',
    peopleInSession: (n: number): string => `協作中共 ${n} 人`,
    youTag: (name: string): string => `${name}（你）`,
    displayNameAria: '你的顯示名稱',
    displayNameTitle: '你在留言與即時協作中顯示的名稱',
    shareLive: '即時共編',
    copyLink: (room: string): string => `複製連結 · ${room}`,
    linkCopied: '已複製連結',
    viewLink: '檢視連結',
    viewLinkTitle: '複製唯讀連結（隱藏編輯介面，但不是權限控管）',
    viewLinkCopied: '已複製檢視連結',
    playheadAria: '播放頭時間',
    playbackSpeedAria: '播放速度',
    play: '播放',
    pause: '暫停',
    exportPdf: '匯出 PDF',
    exportVideo: '匯出影片',
    exportVideoTitle: '把播放動畫錄製成影片檔（即時錄製，需與演出等長的時間）',
    exportVideoCancel: (percent: number): string => `取消 ${percent}%`,
    videoExportFailed: '影片匯出失敗',
  },

  cast: {
    title: '演出者',
    addPerformer: '新增舞者',
    importCsv: '匯入 CSV',
    importCsvTitle: 'CSV 欄位：姓名、角色、顏色（標題列可省略）',
    rosterFileAria: '名單 CSV 檔案',
    importEmpty: '找不到資料列 — 需要欄位：姓名、角色、顏色',
    imported: (n: number): string => `已匯入 ${n} 位舞者`,
    emptyNote: '尚無舞者。新增一位，再把標記拖到舞台上。',
    performersAria: '舞者',
  },

  performer: {
    titleOne: '舞者',
    titleMany: '舞者',
    multiSelected: (n: number): string => `已選取 ${n} 位。方向鍵微調位置，[ 和 ] 旋轉。`,
    tools: '工具',
    swap: '交換兩人',
    swapTitle: '在這個隊形中交換這兩位舞者的站位',
    alignRow: '對齊成排',
    alignRowTitle: '把選取的舞者對齊成水平一排（相同前後深度）',
    alignCol: '對齊成列',
    alignColTitle: '把選取的舞者對齊成垂直一列（相同左右位置）',
    distributeX: '水平均分',
    distributeXTitle: '把選取的舞者左右等距分佈',
    distributeY: '前後均分',
    distributeYTitle: '把選取的舞者前後等距分佈',
    name: '姓名',
    role: '角色',
    rolePlaceholder: '例如：隊長、flyer',
    color: '顏色',
    xLabel: 'X (m)',
    yLabel: 'Y (m)',
    facingLabel: '面向（° — 0 = 觀眾席）',
    facingDegreesAria: '面向角度',
    removeFromCast: '從名單移除',
  },

  formation: {
    title: '隊形',
    name: '名稱',
    startLabel: '開始 (秒)',
    holdLabel: '停留 (秒)',
    transitionLabel: '轉換到下一個隊形',
    transitionLinear: '直線（直接路徑）',
    transitionCurve: '曲線（拖曳路徑控制點）',
    earlier: '← 提前',
    later: '延後 →',
    templateLabel: '範本',
    templates: {
      line: '直線',
      v: 'V 字形',
      circle: '圓形',
      grid: '方陣',
    },
    apply: '套用',
    applyTitle: '把所有人排成這個隊形',
    applyDisabledTitle: '請先新增舞者',
    untangle: '與前一隊形解交叉',
    untangleFirstTitle: '沒有前一個隊形可作為走位起點',
    untangleTitle: '交換各舞者的站位，使總走位距離最短（紅色路徑＝交叉）',
    mirror: '左右鏡像',
    mirrorTitle: '整個隊形沿舞台中線左右翻轉',
    deleteFormation: '刪除隊形',
  },

  stage: {
    title: '舞台',
    width: '寬度 (m)',
    depth: '深度 (m)',
    bpm: 'BPM（留空 = 未知）',
    calibrateBpm: '校正 BPM',
    calibrateBpmTitle: '從起拍點開始，跟著節拍每拍點一下，會從你的點擊算出 BPM',
    tapLabel: (n: number): string => `打拍 ${n}`,
    tapHint: '繼續點擊…',
    resetTap: '重來',
    applyBpm: (bpm: number): string => `套用 ${bpm}`,
    canvasAria: '舞台畫布',
    audience: '觀眾席',
    loading3d: '正在載入 3D 預覽…',
    to3dTitle: '3D 預覽（僅檢視）',
    to2dTitle: '返回 2D 編輯器',
    cameraLabel: '鏡頭視角',
    camAudience: '觀眾席',
    camOverhead: '俯視',
    camSide: '側面',
    audioFileAria: '音訊檔案',
  },

  history: {
    title: '歷史版本',
    saveSnapshot: '儲存快照',
    noSnapshots: '尚無快照。',
    deleteSnapshotAria: (name: string): string => `刪除快照 ${name}`,
    restore: '還原',
  },

  comments: {
    title: '留言',
    none: '尚無留言。',
    deleteAria: (excerpt: string): string => `刪除留言：${excerpt}`,
    placeholderFormation: '為這個隊形留言…',
    placeholderPerformer: '為這位舞者留言…',
    newCommentAria: '新留言',
    add: '新增',
  },

  timeline: {
    panelAria: '時間軸',
    addFormation: '新增隊形',
    uploadAudio: '上傳音訊',
    replaceAudio: '更換音訊',
    removeAudio: '移除音訊',
    tapBeat: '標記節拍',
    tapBeatTitle: '在播放頭處放下節拍標記（播放音樂時特別好用）',
    addSection: '加段落',
    addSectionTitle: '在播放頭位置加上段落標籤（主歌、副歌…）',
    sectionDefault: '段落',
    renameSectionAria: '段落名稱',
    removeSectionAria: (name: string): string => `移除段落 ${name}`,
    zoomOut: '縮小',
    zoomIn: '放大',
    playing: '播放中',
    hint: '拖曳隊形以移動 · Ctrl+滾輪縮放',
    playheadAria: '播放頭位置',
    removeBeatAria: (seconds: string): string => `移除 ${seconds} 秒處的節拍標記`,
    formationAria: (name: string, seconds: string): string =>
      `隊形 ${name}，開始於 ${seconds} 秒`,
  },

  videoExport: {
    errNothingToExport: '沒有可匯出的內容 — 請先新增一個隊形',
    errUnsupported: '這個瀏覽器無法錄製影片',
  },

  layout: {
    resizeCast: '調整演出者面板寬度',
    resizeProps: '調整屬性面板寬度',
    resizeTimeline: '調整時間軸高度',
  },
};
