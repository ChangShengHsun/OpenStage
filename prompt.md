# Claude Code Prompt — OpenStage 專案初始化

> 用法：把下方 `====` 之間的整段內容貼進 Claude Code 作為第一個 prompt。
> 建議先在空目錄開啟 Claude Code（例如 `C:\Users\ivan_chang\openstage`），並確認已裝好 Node.js 20+、pnpm、Docker。

====

你是我的資深全端工程夥伴。我要從零打造一個名為 **OpenStage** 的開源舞台編排/隊形設計工具（協作式，對標同類商業產品但完全自行實作，不得複製任何第三方程式碼、商標或美術素材）。請依下列規格逐步建立專案。

## 產品定位
協作式隊形編排 + 音樂同步 + 舞台走位視覺化，使用者為編舞師、啦啦隊教練、舞台監督、舞蹈教室。

## 技術棧（必須遵守）
- Monorepo：pnpm workspaces，結構為 `apps/web`, `apps/api`, `apps/collab-server`, `packages/path-planner`, `packages/shared-types`
- 前端：React + TypeScript + Vite；2D 畫布用 react-konva；3D 預覽用 @react-three/fiber + three；狀態管理用 Zustand
- 即時協作：Yjs (CRDT) + y-websocket，awareness 顯示他人游標/選取
- 後端：NestJS (TypeScript)
- 資料庫：PostgreSQL（關聯資料 + JSONB 座標）；快取/pub-sub 用 Redis；物件儲存用 MinIO (S3 相容)
- 認證：JWT + Google/GitHub OAuth
- 部署：根目錄提供 docker-compose.yml（postgres, redis, minio, api, collab-server, web）
- CI：GitHub Actions（lint + type-check + Playwright e2e）
- 程式風格：ESLint + Prettier + Conventional Commits

## 資料模型（PostgreSQL）
- organization (1─* user, 1─* performance)
- performance: id, org_id, title, stage_width, stage_height, bpm, audio_asset_id
- formation: id, performance_id, order_index, start_time_ms, duration_ms, transition_type('linear'|'curve')
- performer: id, performance_id, name, color, role, avatar_url
- formation_position: formation_id, performer_id, x, y, rotation(朝向/角度), z(可選)
- comment: id, formation_id, performer_id(nullable), author_id, text
- version_snapshot: id, performance_id, yjs_state(bytea), created_by, created_at
- media_asset: id, performance_id, type, url, metadata

## 核心功能（對標既有產品）
1. 2D 俯視編排（主視圖）：拖放舞者、設定舞台尺寸、地板記號、道具
2. 3D 預覽（輔助）：依 2D 座標即時生成，非主要編輯介面
3. Formation Timeline：一個 performance 內多個 formation，可排序、設定過場時長
4. 音樂同步：上傳音檔、Web Audio API 波形、節拍標記、formation 對應時間軸
5. 即時多人協作（Yjs）：多人同編，游標/選取可見
6. 留言/註解：針對 formation 或個別 performer
7. 媒體上傳（存 MinIO）
8. 匯出 PDF（走位圖 + 名冊）
9. 隊形範本庫：V字/圓形/方陣等，依人數自動縮放
10. 權限：Owner/Editor/Viewer + 分享連結
11. 多 performance 管理

## 新增功能（差異化，優先實作標記於路線圖）
1. 版本快照與時光機（Version History）：類 Git snapshot，回溯/比較
2. 自動過場生成：給定前後兩隊形，用 Hungarian Algorithm 做最短總位移匹配，線段交叉檢測（sweep line）標出碰撞路徑警示 → 放在 `packages/path-planner`
3. **舞者朝向顯示**：formation_position 含 rotation 欄位，2D 用箭頭/扇形、3D 用面向渲染
4. **非線性移動路徑**：formation 過場支援 'curve'（貝茲曲線）與 'linear'，編輯器可拖控制點
5. **走位動畫匯出（MP4/GIF）**：依時間軸+過場路徑生成動畫，含指定 formation 區段匯出
6. CSV/Excel 名冊匯入
7. AI 隊形建議（先用規則式演算法佔位，介面預留未來接 ML）
8. PWA 離線模式
9. 自動 BPM 偵測
10. 無障礙：色盲友善、鍵盤導覽、螢幕閱讀器

## 法律紅線（嚴格遵守）
- 專案名一律 OpenStage，不得出現任何第三方商標名
- 不得複製任何第三方程式碼、UI 截圖臨摹、或使用其美術素材
- 所有 UI/圖示/範本自行設計實作

## 執行方式
1. 先產出完整專案結構樹與 README（含架構圖、快速開始、docker-compose 說明），讓我確認後再開始寫程式碼
2. 採漸進式：先 scaffold monorepo → 建 docker-compose 與資料庫 schema/migration → 後端 API 骨架 → 前端 2D 編輯器 MVP → Yjs 協作 → 其餘功能依路線圖
3. 每個里程碑結束時停下來讓我 review，不要一次生成全部
4. 用 TypeScript strict mode，型別要嚴謹（我習慣 mypy 等級的型別紀律，TS 這邊也請比照）
5. commit 訊息用 Conventional Commits

## 路線圖（實作順序）
- MVP：2D 編輯器（含朝向顯示）、Formation Timeline、音樂上傳+手動節拍、PDF 匯出
- V1：Yjs 協作、留言、範本庫、CSV 匯入、權限
- V2：3D 預覽、非線性路徑、自動過場+碰撞檢測、Version History
- V3：AI 隊形建議、動畫匯出（含指定區段）、PWA、自動 BPM
- V4：Plugin 架構、self-host 一鍵部署、社群範本市集

現在請從「步驟 1：產出專案結構樹與 README」開始，完成後停下來等我確認。

====
