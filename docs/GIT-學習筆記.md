# Git 學習筆記 + 狀態檢查 Template

> 自用筆記。兩部分：
> - **Part A** — 一個可以 copy-paste 嘅「git 狀態檢查」template（做危險動作前先跑）
> - **Part B** — 概念學習筆記（branch / HEAD / stash / push 流程…）

---

## Part A — 狀態檢查 Template（只讀，唔會改任何嘢）

### 幾時要跑

喺做**危險動作之前**先跑一次，確認自己「而家喺邊、有冇嘢未存、同 remote 差幾多」：
- 切 branch / merge / pull / reset 之前
- 啱啱 copy 咗人哋啲嘢落嚟、唔知狀態
- 準備 push 之前

### 指令（一次過 copy 落 terminal）

```bash
git branch --show-current                     # 1. 我而家喺邊條 branch
git rev-parse HEAD                            # 2. 我 HEAD 嘅完整 commit ID
git log --oneline -1                          # 3. HEAD commit 簡述
git fetch origin                              # 4. 抓最新 remote（唔會改本地檔）
git rev-parse origin/main                     # 5. remote main 嘅 commit ID
git status                                    # 6. 未提交嘅改動（已追蹤）
git status --short --untracked-files=all      # 7. 完整未提交改動（含未追蹤新檔）
git stash list                                # 8. 有冇 stash 起咗嘅嘢
git rev-list --left-right --count HEAD...origin/main   # 9. 我 vs origin/main 領先/落後幾多
```

### 睇 output 要答嘅問題（判斷清單）

| 睇邊項 | 要確認 |
|--------|--------|
| 1 branch | 我係咪喺**啱嘅 branch**？（唔好改錯線）|
| 2 HEAD ID | 同我預期 / 同事講嘅 commit ID **對唔對得上**？|
| 5 vs 2 | 本地 HEAD 同 `origin/main` 一唔一樣？|
| 9 ahead/behind | `0  0` = 同步；左邊>0 = 我**領先**（有嘢未 push）；右邊>0 = 我**落後**（要先 pull）|
| 6/7 status | 有冇改咗未 commit？新檔（`??`）定已追蹤改動（`M`）？|
| 8 stash | 有冇暫存住嘅半成品？|

> ⚠️ 重點：`git push` 前如果**落後**（第 9 項右邊 > 0），要先 `git pull` 再 push，否則會被 git 拒絕（防止你蓋過人哋啲 commit）。

---

## Part B — 概念學習筆記

### 1. Commit ID 係咩 / 對唔上點算

- Commit ID（40 字 hash，例 `67b7b25…`）= **每個版本獨一無二嘅指紋**。
- 兩個 ID 唔同 = 指住唔同版本。
- 同事畀嘅 ID 同自己對唔上時，**先問**：「你個 ID 係邊個 repo、邊條 branch？」唔好亂 reset。
- 可能原因：唔同 repo / 唔同 branch / 一方未 pull 或未 push / 打錯。

### 2. 點解要 check 呢啲（開車前望油錶比喻）

| 查咩 | 解答緊咩問題 | 唔查嘅後果 |
|------|------------|-----------|
| branch | 我啲改動會落去邊條線？ | 改錯 branch，污染 main |
| HEAD | 我企喺邊個版本？ | 同人對唔上、唔知自己舊咗 |
| vs origin/main | 同雲端差幾多？ | 唔 pull 就改 → 撞 conflict |
| status | 有冇嘢改咗未存？ | 切 branch / reset 時整丟改動 |
| stash | 有冇暫存未攞返嘅嘢？ | 改動好似「消失咗」|

### 3. Branch（分支）

- **= 一條獨立工作線。** main = 主幹（穩定、可上線）；branch = 杈，喺上面試嘢唔搞亂主幹。
- 各人開自己 branch（你 page 1~3、同事 page 4~6），做好再 **merge 返 main**。
- 好處：main 永遠可 deploy；branch 出事掉咗都唔影響 main；配合 PR review。
- 睇 branch：`git branch`（本地，`*` = 而家企緊）／`git branch -a`（含 remote）。
- **只見到已 push 上 remote 嘅 branch**；人哋純本地未 push 嘅你睇唔到。
- 切去人哋條 branch 睇/測 OK；**直接喺人哋條 branch push 要先夾過**。

### 4. HEAD

- **= 「我而家企喺邊個 commit」嘅指針**，唔等於「main 嘅最新版」。
- 喺 main 又最新 → HEAD = 最新 main（巧合重合）。
- 落後咗 → HEAD = 舊版 main。
- 切咗去另一條 branch → HEAD = 嗰條 branch 嘅 tip。

### 5. Push 工作流（標準做法）

```bash
git pull     # 攞 remote 新版落嚟同自己改動 merge（有衝突就解 conflict）
# 解完、測好
git push     # 先 push 得上
```

- 落後時 `git push` 會被拒（`non-fast-forward`）→ 強制你先 pull，防止蓋過同事 commit。
- ⚠️ 禁忌：唔好 `git push --force` 硬蓋，除非你好清楚自己做緊咩。

### 6. Stash（暫存抽屜）

- **= 將「改咗一半、未想 commit」嘅嘢暫時收起，working tree 即刻變乾淨。**
- `git stash`（收入抽屜）→ 做急事 → `git stash pop`（攞返出嚟繼續）。
- `git stash list` = 睇抽屜有冇嘢。

**例子**：喺 main 寫緊 page 2 寫到一半，老闆叫你即刻改 page 1 錯字 →
`git stash` 收起 page 2 → 改 page 1、commit、push → `git stash pop` 攞返 page 2 繼續。

常見時機：想快速切 branch 但唔想 commit 半成品；`git pull` 前有未存改動阻住。

### 7. 自己一個幾時用 branch

- 細修補：直接落 main 通常 OK。
- **高風險 / 實驗性嘢就開 branch**（換 AI 引擎、大改 schema、刪檔 script…），當「試衰咗有得反悔」嘅安全網。

```bash
git switch -c feature/xxx     # 開新 branch 試
# 試 work → 合返 main：
git switch main && git merge feature/xxx
# 試衰 → 直接掉咗，main 零污染：
git branch -D feature/xxx
```

---

## 相關

- 部署 / URL / 上雲：見 [DEPLOYMENT.md](./DEPLOYMENT.md)
- 本機環境 / 換機：見 [SETUP.md](./SETUP.md) / [MIGRATION.md](./MIGRATION.md)
