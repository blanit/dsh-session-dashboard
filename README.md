# dsh-session-dashboard

DeepSeek Harness Web GUI 插件：在**左侧边栏常驻一张会话状态卡片**（位于 Settings 上方），不用点开页面就能随时看到最近会话在做什么。

信息结构：

- **常驻卡片**：侧栏展开时显示在底部、Settings 之上；侧栏收起为 56px 轨道时变成一个脉冲图标按钮，有「需要你」时显示橙色数字角标，有运行中/完成未查看时显示绿点
- **状态图标**：蓝色旋转 = 运行中；橙色问号 = 等待你处理（审批 / 计划审核 / 回答）；绿色对勾 = 已完成但未查看；灰色圆环 = 空闲
- **每行**：标题 + 一行「当前在做什么」+ 相对时间
  - Waiting for approval / Plan awaiting review / Waiting for an answer
  - Working on: <当前 todo 或本轮指令>
  - Completed · N turns · unread（完成但未查看）
  - Last: <上一条指令>
- **筛选**：All / Needs you / Running / Done，带实时计数（Done = 完成但还没查看）
- 点击任意行直接进入该会话；`+` 新建会话；「展开 / 收起」在 5 行与 10 行之间切换
- 默认隐藏归档会话、空白会话和子 agent 会话
- 排序：待你处理 → 运行中 → 完成未查看 → 空闲，各自按最近活动时间倒序（保证需要你/运行中/完成未查看的会话一定出现在卡片前几行）
- **状态相关文案固定英文**（Waiting for approval / Working on / Completed / Idle、All / Needs you / Running 等）；卡片标题「会话」、展开/收起等界面文案跟随 GUI 语言

已在 DSH `0.2.1-rc.2` 的 Web profile 与 `0.2.1-rc.3` 的 Desktop profile 中验证：官方 `dsh plugin` 安装（Web 用本地目录、Desktop 用 tarball）、`--dump-config` 出现 `# == dsh-session-dashboard` 层、client-modules 正常下发 bundle、侧栏位置与筛选/跳转/新建/收起态角标可用，控制台无插件报错。

## 官方插件形态

这是一个标准的 DSH **bundle**（组合包），不是宿主的私有扩展：

| 官方要求 | 本包 |
|---|---|
| `dsh.bundle.patch` 指向配置层 | `./cordis.patch.yml`，把本包按包名插入 Loader |
| `dsh.client.platform: "web"` + `exports["./client"]` | 指向 `client/client.js`（预构建的 `__ModuleLoader__` 工厂） |
| `engines.dsh` 声明兼容范围 | `>=0.2.0 <0.3.0`（0.2.1-rc.2 / rc.3 均通过校验） |
| 安装到 profile 的 `bundles` 列表 | `dsh plugin add` 自动追加，或手动写 profile manifest |
| 分发预构建产物 / 无需安装期构建 | 纯 JS，无 `prepare`/build 脚本，git/tarball/npm 安装都不需要构建授权 |
| `license`、`icon`、`files` | MIT、`icon.svg`、发布文件清单齐全 |

官方文档：[打包与安装插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish.md)。

## 安装

插件是纯前端（浏览器侧）插件，没有 Host 服务、没有配置项、没有后台任务；安装/卸载全部走官方 `dsh plugin`（pnpm + profile manifest），不需要手工改 profile 或 node_modules。

### 1. 打包发布产物

在插件目录中执行：

```powershell
pnpm pack --pack-destination <输出目录>
# 产出 dsh-session-dashboard-<version>.tgz
```

### 2. Desktop profile（当前桌面端）

`desktop` profile 由 Electron 拥有，npm 全局 CLI 会拒绝管理它；改用桌面端自带的命令运行时安装 tarball：

```powershell
$dsh = "<DeepSeek Harness 安装目录>\resources\runtime\cli\bin\dsh.cmd"
& $dsh plugin --profile desktop add <输出目录>\dsh-session-dashboard-<version>.tgz
& $dsh plugin --profile desktop --dump-config   # 可选：确认出现 "# == dsh-session-dashboard"
```

安装会写入 profile 的 `dependencies`（`file:...tgz`）和 `dsh.profile.bundles`，由 pnpm 落盘到 `node_modules`（真实目录，不是目录联接）。**tarball 必须保留**：profile dependency 指向它，移动或删除后需要重新 `add`。

升级：提升 `version` → 重新 `pnpm pack` → 再执行一次 `add`。卸载：

```powershell
& $dsh plugin --profile desktop remove dsh-session-dashboard
```

重载桌面窗口（`Ctrl+R`）或重启应用；live patch reload 生效时刷新即可。

### 3. Web profile

```powershell
dsh plugin --profile web add <插件目录>
dsh --profile web --dump-config
dsh plugin --profile web remove dsh-session-dashboard
```

`dsh plugin` 会把本地包解析为 pnpm `link:` 依赖并自动追加 bundle；重启 `dsh web`（或刷新页面）生效。

## 数据来源

不自行请求 Host，也不保存任何会话状态。卡片是 root-scoped 侧栏 footer seat 的占位者，直接使用 slot 系统给所有 root 槽的标准 seat：

| seat / 数据 | 用途 |
|---|---|
| `useSessions` | 会话目录、`displayTitle`、`updatedAt`、`blank`/`origin`、`projectionsBySession` |
| `useSessionStatus` | `running`、`pendingInteraction`（`approval` / `plan-review` / `question`）、`completionUnread` |
| `useWorkspaces` | `archivedSessionIds`（默认隐藏归档会话） |
| `projectionsBySession[*].values` | `todos`（当前进行中的 todo）、`turnOutline`（本轮指令与轮数）、`sessionStats` |

打开会话走 `ctx.uiWorkspace.openSession(id)`，新建走 `ctx.uiWorkspace.startSession()`，收起态点击图标走 `ctx.layout.toggleSidebar()`。

## 结构

```
package.json          # dsh.bundle.patch + dsh.client（platform: web）+ engines.dsh
cordis.patch.yml      # 把本包作为 Loader entry 插入 profile
lib/index.js          # Host 侧空插件（只为让 Loader 持有 fiber，client-modules 才会发现浏览器半）
client/client.js      # 整个 UI：__ModuleLoader__ 工厂 + React 卡片 + 主题化 CSS
icon.svg              # 插件管理器展示图标
LICENSE               # MIT
```

`client/client.js` 是手写的 CJS-in-loader 工厂（`window.__ModuleLoader__.load({ id, factory })`），**不需要构建**：改完直接刷新页面。唯一运行时依赖是平台基线里的 `react`；样式使用宿主主题变量 `--dsw-alias-*`，亮/暗主题自动适配。

## 已知边界

- 卡片占用侧栏底部空间（默认 5 行 + 头部/筛选；展开最多 10 行），侧栏的 Workspaces 区域会相应缩短，但不会覆盖它。
- 归档会话默认不显示（读取 Workspace 归档集过滤，与侧栏默认一致）；本版不提供「显示归档」开关。
- 卡片内不提供搜索与分组（空间受限）；搜索仍走侧栏原有的会话搜索。
- 副标题里的「正在执行 / 上次」文案与「已完成 · N 轮」计数来自 projection（`todos` / `turnOutline` / `sessionStats`），没有 projection 缓存时降级为「处理中… / 空闲 / 已完成」；状态图标与筛选由运行状态/pending interaction 直接决定。
- 不提供会话管理动作（重命名 / 归档 / pin）；行点击只做进入会话，管理仍走侧栏。
- 依赖侧栏的 `sidebar.footer.action` seat；若未来的侧栏实现取消该 seat，卡片不会出现（不会影响其它 UI）。
