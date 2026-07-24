# Cyber FPS — 多模式設計文件

> 目標：把現有的 raycasting FPS（波次打怪）擴充成 **四個模式**，並加入
> **無後端、可防作弊的雙人聯機**。參考站：
> `rivals-in-one-shot-production.up.railway.app`（First to 5 · 1v1 FPS）。

已拍板的方向：

- **引擎**：沿用現有 2.5D raycaster（`FPSGame.jsx`），不重寫成 Three.js。
- **打點電腦模式** = **打靶練習**（Aim Trainer）。
- **聯機牽線 (signaling)** = **免費公用 broker**（短代碼加入，體驗接近參考站）。
- **交付**：先出這份設計文件確認，再動工實作。

---

## 0. 四個模式一覽

| 模式 | 你的說法 | 內容 | 來源 |
|---|---|---|---|
| `survival` | 打怪模式 | 波次生存，殭屍圍剿（現有） | 已有，保留 |
| `aim` | 打點電腦模式 | 打靶練習：目標點冒出、練準度/反應、看命中率 | 新增 |
| `vs-ai` | 人機對決模式 | 1v1 對機器人，先得 5 分，Easy/Hard | 新增 |
| `online` | 雙人聯機 | Online 1v1，開房 / 輸入代碼，防作弊、無後端 | 新增（最難） |

四個模式共用同一個 raycasting 引擎與渲染器，只是「誰在提供輸入 / 目標怎麼產生」不同。

---

## 1. 整體架構

現況：`src/pages/FPSGame.jsx` 是一支 932 行的單檔，把「地圖、raycasting、AI、渲染、HUD、輸入」全部揉在一起。要支援四個模式，第一步是**把引擎核心抽出來共用**，避免四份複製貼上。

### 1.1 目標檔案結構

```
src/games/fps/
  engine/
    map.js          # 地圖資料、牆面顏色、OPEN_CELLS
    raycast.js      # castRay / hasLOS / computeFlow / 移動與碰撞
    rng.js          # 可設種子的 PRNG（mulberry32）— 決定論關鍵
    weapons.js      # 武器定義 + 開火判定
    render.js       # 共用畫布渲染：牆、精靈、准心、HUD 原件、小地圖
    input.js        # 鍵鼠/觸控 → InputState（每 tick 一份）
  sim/
    duelSim.js      # 決定論 1v1 模擬核心（VsAI 與 Online 共用）
  modes/
    Survival.jsx    # 打怪（由現有 FPSGame 重構而來）
    AimTrainer.jsx  # 打靶
    Duel.jsx        # 人機對決 + 雙人聯機共用的對戰畫面殼
  net/
    peer.js         # PeerJS 封裝：建房/加入/資料通道
    lockstep.js     # 輸入交換、tick 同步、緩衝
    anticheat.js    # 輸入合理性檢查 + 狀態雜湊比對
    protocol.js     # 訊息格式與版本號
  FPSShell.jsx      # 模式選單 + 子導覽（掛進 Playground）
```

> Playground 目前用 `/playground/:game`。FPS 底下再開一層模式：
> `/playground/fps`（選單）、`/playground/fps/survival`、`/aim`、`/vs-ai`、`/online`。
> 也可以維持單一路由、用內部 state 切模式；細節實作時再定。

### 1.2 為什麼 VsAI 與 Online 共用同一個 `duelSim`

1v1 的「世界規則」（移動、開火、命中、扣血、回合）兩個模式完全一樣，差別只在**輸入來源**：

- **人機對決**：玩家輸入 + **本機 bot 產生的輸入** → 餵給 `duelSim`。
- **雙人聯機**：玩家輸入 + **對方透過網路傳來的輸入** → 餵給同一個 `duelSim`。

好處：只維護一份對戰邏輯；而且因為 `duelSim` 從一開始就寫成**決定論**（見第 5 節），聯機才可能用 lockstep 防作弊。Bot 只是「把 AI 決策轉成跟人一樣的輸入」。

---

## 2. 共用引擎（從現有程式抽出）

直接沿用現有的高品質實作，只是搬到 `engine/`：

- `castRay`（DDA、垂直投影、無魚眼）、`hasLOS`、`computeFlow`（BFS flow field）、`moveWithSlide`／`canStand`。
- 渲染：天花板/地板漸層、牆、精靈（含 z-buffer 遮擋裁切）、准心、槍口火光、受傷紅暈、小地圖、橫幅。

**要新增/改動：**

1. **`rng.js`**：`mulberry32(seed)`。現有程式用 `Math.random()`（敵人生成、命中機率），聯機模式**絕對不能**用它——改成從共享種子產生的 PRNG。
2. **`weapons.js`**：把武器抽成資料驅動（見第 6 節）。
3. **`input.js`**：把鍵鼠/觸控收斂成一份 `InputState`（見下），讓對戰模式可以序列化傳輸。

### 2.1 InputState（每 tick 一份，聯機的傳輸單位）

```js
// 一個 tick 的玩家意圖，全部是「有界、可驗證」的量
{
  tick:    number,   // 邏輯幀序號
  fwd:     -1|0|1,   // W/S
  strafe:  -1|0|1,   // A/D
  turn:    number,   // 這個 tick 的視角變化量（弧度，會被夾在合理範圍）
  fire:    boolean,
  reload:  boolean,
  weapon:  0..N,     // 選武器
  dash:    boolean,  // 取代參考站的 slide（2.5D 沒有垂直軸）
}
```

**關鍵設計**：聯機時網路上只傳這個 `InputState`，**不傳位置、不傳血量、不傳「我打中你了」**。位置與血量是雙方各自從輸入算出來的（決定論），誰都無法單方面宣告結果——這正是防作弊的地基。

---

## 3. 模式一：打靶練習（Aim Trainer）`aim`

單人練準度，不需要 AI 也不需要網路，最單純，建議**第一個做**（順便驗證抽出來的引擎）。

### 玩法
- 站在固定/可小幅移動的位置，四周牆面/空間隨機冒出**目標點**（發光球）。
- 滑鼠瞄準、點擊/空白鍵射擊；命中即消失、立刻補一個新目標。
- 目標有生存時間，太久沒打會消失並算 miss。

### 子玩法（選單切換）
- **Flick**：一次一個目標，隨機位置，練甩槍。
- **Tracking**：目標持續移動，要壓著它，計算「在目標上的時間比例」。
- **Grid / 反應**：多個目標同時在，打最亮的那顆。

### 計分與統計（練習模式的重點在數據）
- 命中率 `hits / shots`
- **KPM**（每分鐘擊殺）、平均**反應時間**（目標出現 → 命中的毫秒）
- 連擊 combo、最佳成績存 `localStorage`
- 60 秒一輪，結束顯示成績卡

### 實作重點
- 復用 raycaster 渲染牆與精靈；目標就是一種「不會攻擊、被打就消失」的實體。
- 命中判定復用現有 `shoot()` 的角錐 + LOS 邏輯。
- 幾乎不碰 AI／網路，風險最低。

---

## 4. 模式二：人機對決（VS AI）`vs-ai`

1v1、先得 5 分、對手是 bot。用 `duelSim` + 本機 bot。

### 對戰規則
- **First to 5**：一方陣亡 = 對方得 1 分；重生後開新回合；先到 5 分獲勝。
- 小型對稱競技場地圖（可新增一張 `duel` 專用地圖，比打怪的大房間小、多掩體）。
- 兩邊出生在對角，中場有掩體。
- 武器組見第 6 節；重生回滿血、可換武器。

### Bot AI（Easy / Hard，對應參考站）
Bot 每個 tick 輸出一份 `InputState`（不是直接改世界），行為由參數表驅動：

| 參數 | Easy | Hard |
|---|---|---|
| 反應延遲 | 300–450ms | 80–150ms |
| 瞄準誤差 | 大、會 miss | 小、會 peek |
| 移動 | 慢、少走位 | 積極、會找掩體/繞側 |
| 開火節奏 | 保守 | 壓槍 |

- **導航**：復用現有的 `computeFlow` flow field 走位、`hasLOS` 判斷交火。
- **決策**：狀態機（找目標 → 接近/保持距離 → 開火 → 沒血找掩體）。誤差用「在真實瞄準角上加一個隨難度縮放的噪聲」模擬，Easy 噪聲大。

### 為什麼 bot 也走 `InputState`
這樣 `duelSim` 不用管對手是人是機器；等於**先在單機把聯機的資料流跑通**，聯機只是把「bot 的 InputState」換成「網路來的 InputState」。VsAI 做完，Online 就完成了一大半。

---

## 5. 模式三：雙人聯機（Online 1v1）`online` — 最難的部分

### 5.1 傳輸層：WebRTC P2P + 免費 broker 牽線

- **資料傳輸**：WebRTC `DataChannel`（P2P、UDP-like、低延遲），玩家對玩家直連，資料**不經過任何伺服器**。
- **牽線 (signaling)**：只有「交換連線資訊」這一步需要中介。用 **PeerJS** 的免費公用 broker（`0.peerjs.com`）：
  - 建房方拿到一個 peer id（轉成短房號顯示）。
  - 加入方輸入房號 → broker 幫兩邊交換 SDP/ICE → 之後直連，broker 就退場。
  - **你自己沒有任何後端**；GitHub Pages 純靜態即可。
- 風險：公用 broker 可能不穩或有速率限制。緩解：
  - 加「連線失敗重試 / 顯示錯誤」。
  - 保留一個**手動代碼複製貼上**的後備（零依賴 signaling），broker 掛掉時仍能玩。
  - 之後想更穩可換自架的極小 signaling（但那就不是「無後端」了，非現在範圍）。

### 5.2 連線流程（房號制，像參考站）

```
房主：CREATE ROOM → 顯示 4 碼房號 → 等待
加入：輸入房號 → JOIN → broker 交換 → DataChannel open
兩邊：交換 handshake（見下）→ 倒數 → 開打
```

### 5.3 網路模型：**決定論 Lockstep**（防作弊的核心）

這是整個「無後端還能防作弊」的關鍵決定，先講清楚 **為什麼選它、代價是什麼**。

**核心想法**：兩台電腦跑**完全一樣的決定論模擬**，網路上**只交換輸入**（第 2.1 的 `InputState`），命中/扣血/勝負都是**雙方各自算出來的**，沒有人「宣告」結果。

- 每個邏輯 tick（建議 30Hz），雙方交換該 tick 的 `InputState`。
- 收齊「自己 + 對方」的輸入後，才推進模擬一格 → 兩邊世界永遠一致。
- 為吸收延遲，採 **input delay**：第 T tick 送出的輸入，在第 T+2（約 66ms）才生效，讓對方的輸入有時間到達。

**這樣能防什麼（真的有效）：**
- ✅ **假裝打中你 / 宣告假擊殺**：命中不是傳過來的，是雙方各自算的。你無法叫對方的電腦說「你死了」。
- ✅ **無敵 / 改血量**：血量沒有在網路上傳，是算出來的。決定論下你被打中就是被打中，改不了自己的血。
- ✅ **瞬移 / 改分數 / 改位置**：位置由輸入推導，不能塞假座標。
- ✅ **速度掛 / 連射掛 / 超速轉頭**：對方的 `InputState` 進來時先過**合理性檢查**（第 5.5），超出人類物理上限就拒收 → 判對方作弊、中止對局。

**這樣防不了什麼（誠實說）：**
- ❌ **自瞄 / 觸發機器人**：那是「合法但超人的輸入」，客戶端無伺服器根本無法可靠分辨是玩家準還是外掛準。
- ❌ **穿牆視覺**：讀自己本機狀態，屬視覺層，無伺服器擋不了。

> 一句話：lockstep 讓**沒有人能對『共同世界的結果』說謊**，這是無後端能做到的最強防護；但它擋不了「輸入本身是外掛產生的」（aim/wallhack）。這是物理限制，不是實作偷懶。

**代價（要接受的取捨）：**
- **輸入延遲**：input delay + RTT 會讓操作手感有 ~66–150ms 遲滯。1v1「一擊命中」的節奏可接受，但不如本機順。
- **決定論很嚴格**：模擬過程**不能有任何非決定來源**——
  - 不能用 `Math.random()`，改用雙方 handshake 約定同一個 `seed` 的 `mulberry32`。
  - 固定時間步長（fixed timestep），不吃 `requestAnimationFrame` 的浮動 dt。
  - 小心浮點：同樣的 JS 引擎（都是 Chrome/V8）下同運算順序通常一致；仍以**定期雜湊比對**當保險（第 5.4）。

> 備選模型（不推薦，但寫下來讓你知道我比較過）：**各自對自己權威 + 驗證對方宣告**（self-authoritative）。手感較好（自己動作零延遲），但有個無法根治的漏洞——作弊者對「自己的血量」是權威的，可以拒絕死亡（無敵）。要在無伺服器下堵這個洞，最後還是得走 lockstep 那套「結果用算的、不用宣告的」。所以**防作弊優先 → 選 lockstep**。

### 5.4 狀態雜湊比對（決定論的保險絲）

- 每 N 個 tick（如每 30 tick），雙方各自算一次**世界狀態的雜湊**（兩玩家位置、血量、彈藥、tick、seed 進度…量化後 hash）並交換。
- 雜湊不一致 = 兩邊世界分歧（純技術 desync 或有人竄改）→ 顯示「連線不同步／偵測到異常」並中止該局，不採計比分。
- 這同時是抓竄改，也是抓 bug 的除錯利器。

### 5.5 輸入合理性檢查（`anticheat.js`）

收到對方 `InputState` 時，推進模擬前先驗證（違規即中止對局）：

- `fwd/strafe ∈ {-1,0,1}`、`weapon` 在合法範圍。
- `|turn|` ≤ 單 tick 最大轉速。
- 開火要遵守該武器 `fireCooldown`（連射掛在此被擋）。
- `tick` 必須連續遞增、不能跳號或回頭。
- 訊息頻率上限（洪水攻擊保護）。

### 5.6 額外硬化（提高作弊成本，非保證）

- production build 本來就 minify；關鍵物件 `Object.freeze`。
- 對局用 seed + 版本號綁定，開局 handshake 不合就拒連。
- 這些只是提高門檻，擋不了決心夠的人——但對「隨手改控制台」等級足夠。

### 5.7 斷線處理
- DataChannel 斷 → 顯示「對手離線」，判定/暫停。
- 有 heartbeat/timeout；重連採「回大廳」，不做局內熱重連（範圍太大）。

---

## 6. 武器系統（`weapons.js`，對戰模式共用）

參考站有 AR / Handgun / Fists / Grenade / RPG。2.5D 沒有垂直軸，跳/滑鏟/二段跳無法照搬，做等價調整：

| 鍵 | 武器 | 2.5D 調整 |
|---|---|---|
| 1 | Assault Rifle | 連發、中傷、有散布 |
| 2 | Handgun | 半自動、精準、快切 |
| 3 | Fists（近戰） | 近距離高傷；二段跳 → 改成短衝刺 dash |
| 4 | Grenade | 拋物projectile、範圍傷害（用簡化拋射 + 落點 AoE） |
| 5 | RPG | 慢速projectile、命中/近爆大範圍 |

- 資料驅動：`{ name, key, auto, damage, spread, fireCooldown, magSize, reload, projectile?, aoe? }`。
- 打怪與打靶目前的「即時射線 hitscan」是特例（AR/HG/Fists）；Grenade/RPG 需要在模擬裡加**projectile 實體**（位置、速度、生命、爆炸）——決定論下 projectile 也要用共享 seed，不能有隨機亂數。
- **移動**：WASD + 左右平移 + `dash`（取代 slide）；**不做跳躍**（raycaster 無高度）。這點與參考站的最大差異，先接受。

---

## 7. 進場 UI（FPSShell）

模式選單（風格對齊參考站的霓虹卡片，但用你網站的 `--accent-*` 變數）：

```
CYBER FPS
 ├─ 打怪 SURVIVAL      → 現有波次生存
 ├─ 打靶 AIM TRAINER   → Flick / Tracking / Grid
 ├─ 人機對決 VS AI      → Easy / Hard，First to 5
 └─ 雙人聯機 ONLINE     → CREATE ROOM / 輸入房號 JOIN
```

- 沿用現有 `SectionViewer`、`cyber-btn`、字型與配色。
- 手機：保留現有觸控搖桿；聯機/對戰模式手機體驗較弱，先標示「建議電腦」。

---

## 8. 實作階段（建議順序，逐步可玩、風險遞增）

| 階段 | 內容 | 產出 |
|---|---|---|
| **P0** | 把 `FPSGame.jsx` 引擎抽到 `engine/`，現有打怪改用它 | 重構，功能不變 |
| **P1** | 打靶練習 `aim` | 第一個新模式，驗證引擎抽離 |
| **P2** | `weapons.js` + `duelSim`（決定論）+ Bot → 人機對決 `vs-ai` | 對戰核心 + 決定論就緒 |
| **P3** | `net/`：PeerJS 建房/加入、DataChannel、handshake | 兩台機器能連上、能互傳輸入 |
| **P4** | Lockstep + 輸入驗證 + 狀態雜湊 → 雙人聯機 `online` | 可玩、有防作弊 |
| **P5** | 打磨：斷線、UI、手機提示、手動代碼後備 signaling | 收尾 |

> P2 一旦 `duelSim` 決定論化並讓 bot 走 `InputState`，P4 的聯機就是「把 bot 換成網路輸入 + 加同步層」，難度大幅下降。這是整個排序的用意。

---

## 9. 風險與取捨（攤開講）

1. **無後端的防作弊有天花板**：擋得住結果竄改（假擊殺/無敵/瞬移/速度掛），擋不住 aim/wallhack。要 100% 防外掛只能有可信伺服器——與「無後端」互斥。已選擇在此天花板內做到最好。
2. **Lockstep 有輸入延遲**：手感不如本機。對「一擊命中」的慢節奏 1v1 可接受。
3. **公用 broker 依賴第三方**：可能限流/不穩；用手動代碼 signaling 當後備。
4. **決定論很挑細節**：任何漏網的 `Math.random`、浮點順序差異都會 desync；靠雜湊比對及早抓出。
5. **2.5D 的先天限制**：無跳躍/無高低差，武器與移動需簡化，體驗不會 1:1 等於參考的 3D 站。
6. **工作量**：P0–P5 是實打實的重構 + 新功能 + 網路 + 防作弊，屬大工程；分階段交付、每階段可玩可驗收。

---

## 10. 需要你確認 / 之後再定的細節

- 路由要「多一層子路由」還是「單頁內部切模式」？（實作時定，不影響架構）
- 打靶要不要三種子玩法都做，還是先 Flick 一種？
- 對戰地圖：沿用打怪那張大房間，還是新畫一張小型競技場？（建議新畫一張）
- 武器先做幾把？（建議 P2 先 AR + Handgun，projectile 類 Grenade/RPG 放 P5）

---

*確認這份設計後，我會從 **P0（引擎抽離）** 開始，一階段一階段做進 Playground。*

---

## 11. 實作狀態（已完成）

四個模式全部實作完成並整合進 `/playground/fps`（`src/games/fps/`）：

- **P0 引擎抽離** ✅ `engine/`（geometry / render / rng / weapons / input / maps）。舊 `src/pages/FPSGame.jsx` 已移除。
- **P1 打靶** ✅ `modes/AimTrainer.jsx`（Flick / Tracking / Grid、命中率 / KPM / 反應時間、成績存 localStorage）。
- **P2 人機對決** ✅ `modes/VsAI.jsx` + `sim/duelSim.js`（決定論）+ `sim/bot.js`（Easy/Hard，走 InputState）。
- **P3–P4 雙人聯機** ✅ `modes/Online.jsx` + `net/`（peer.js PeerJS 建房/加入、lockstep.js 決定論 lockstep、anticheat.js 輸入驗證、protocol.js）。
- **P5 打磨** ✅ 斷線提示、手機觸控、`conn.send` 開啟守衛。

**驗證**：Survival / Aim / VsAI 於瀏覽器實測遊玩正常；Online 於 production build（`vite preview`）兩分頁實測，建房→輸入房號加入→雙方進場→連線穩定、無崩潰。

> ⚠️ **測試聯機務必用 `vite build && vite preview`，不要用 `vite dev`**：dev 的 HMR 熱更新若改到 hook 簽章會讓已掛載的元件「Rendered more hooks」崩潰、連帶關閉 P2P 連線（假象，非真 bug）。production 無 HMR 不會發生。

