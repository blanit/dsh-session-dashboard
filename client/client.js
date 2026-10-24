/**
 * dsh-session-dashboard — browser half.
 *
 * A persistent Session status card in the Web GUI's left sidebar. The card
 * lives in the sidebar foot's action seat (`sidebar.footer.action`), above the
 * Settings row, so recent Session status is visible at all times instead of
 * behind a page navigation:
 *
 *   - Needs you / Running / All filter chips with live counts;
 *   - the newest few Sessions (pending interactions and running work first),
 *     each with a status glyph, title, one-line "what is it doing" subtitle and
 *     relative activity time;
 *   - click a row to open that Session, `+` starts a new one;
 *   - when the sidebar is collapsed, a 36px rail button with a needs-you badge
 *     (clicking it re-expands the sidebar).
 *
 * Everything reads the Client sources the host already maintains through the
 * standard root seat hooks: `useSessions` (catalog + projections),
 * `useSessionStatus` (running / pending interaction / unread completion) and
 * `useWorkspaces` (archive set). Opening and creating Sessions delegate to
 * `ctx.uiWorkspace`; re-expanding the rail delegates to `ctx.layout`.
 *
 * The bundle is hand-written in the `window.__ModuleLoader__` factory form the
 * Web shell expects (no build step). React is the only module it requires, and
 * every visual decision rides the host theme's `--dsw-alias-*` tokens so light
 * and dark themes both work.
 */

window.__ModuleLoader__.load({
  id: 'dsh-session-dashboard',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var h = React.createElement
    var useEffect = React.useEffect
    var useMemo = React.useMemo
    var useState = React.useState

    //#region locales
    var NS = 'session-dashboard'

    var en = {
      panel: 'Sessions',
      title: 'Sessions',
      newSession: 'New session',
      filters: 'Session filters',
      filterAll: 'All',
      filterNeeds: 'Needs you',
      filterRunning: 'Running',
      filterDone: 'Done',
      loading: 'Loading…',
      empty: 'No sessions',
      noMatches: 'No matching sessions',
      seatsUnavailable: 'Sessions unavailable: the Session plugins are not loaded',
      expand: 'Show more',
      collapse: 'Show less',
      openSession: 'Open session: {title}',
      railLabel: 'Sessions: {needs} need you, {running} running, {done} done',
      statusApproval: 'Waiting for approval',
      statusPlanReview: 'Plan awaiting review',
      statusAnswer: 'Waiting for an answer',
      statusWorkingOn: 'Working on: {task}',
      statusWorking: 'Working…',
      statusCompleted: 'Completed · {count} turns',
      statusCompletedPlain: 'Completed',
      statusCompletedUnread: 'Completed · {count} turns · unread',
      statusCompletedUnreadPlain: 'Completed · unread',
      statusLastTask: 'Last: {task}',
      statusIdle: 'Idle',
      timeNow: 'now',
      timeMinutes: '{n}m',
      timeHours: '{n}h',
      timeDays: '{n}d',
      settingsTitle: 'Sessions card',
      collapseCard: 'Collapse',
      expandCard: 'Expand',
      settingsIntro: 'Sidebar card appearance and behavior.',
      settingsLanguage: 'Language',
      settingsRows: 'Default rows',
      settingsRowsHint: 'Rows shown before expanding; the expanded card shows up to 10.',
      settingsHint: 'Changes apply immediately.',
      langEn: 'English',
      langZh: '中文',
      rowOption: '{n} rows',
    }

    var zh = {
      panel: '会话',
      title: '会话',
      newSession: '新建会话',
      filters: '会话筛选',
      filterAll: '全部',
      filterNeeds: '需要你',
      filterRunning: '运行中',
      filterDone: '已完成',
      loading: '加载中…',
      empty: '暂无会话',
      noMatches: '没有匹配的会话',
      seatsUnavailable: '会话卡片不可用：Session 插件未加载',
      expand: '展开',
      collapse: '收起',
      openSession: '打开会话：{title}',
      railLabel: '会话：{needs} 需要你，{running} 运行中，{done} 已完成',
      statusApproval: '等待审批',
      statusPlanReview: '计划待审核',
      statusAnswer: '等待回答',
      statusWorkingOn: '正在执行：{task}',
      statusWorking: '处理中…',
      statusCompleted: '已完成 · {count} 轮',
      statusCompletedPlain: '已完成',
      statusCompletedUnread: '已完成 · {count} 轮 · 未读',
      statusCompletedUnreadPlain: '已完成 · 未读',
      statusLastTask: '上次：{task}',
      statusIdle: '空闲',
      timeNow: '现在',
      timeMinutes: '{n}分',
      timeHours: '{n}时',
      timeDays: '{n}天',
      settingsTitle: '会话卡片',
      collapseCard: '收起',
      expandCard: '展开',
      settingsIntro: '侧栏卡片的外观与行为。',
      settingsLanguage: '语言',
      settingsRows: '默认条目数',
      settingsRowsHint: '展开前显示的行数；展开后最多 10 行。',
      settingsHint: '修改立即生效。',
      langEn: 'English',
      langZh: '中文',
      rowOption: '{n} 行',
    }

    var DICTS = { en: en, zh: zh }

    function formatText(template, vars) {
      if (vars === undefined) return template
      return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, name) {
        var value = vars[name]
        return value === undefined ? match : String(value)
      })
    }

    function translate(lang, key, vars) {
      var dict = DICTS[lang] || en
      var template = dict[key]
      if (template === undefined) template = en[key]
      return template === undefined ? key : formatText(template, vars)
    }
    //#endregion

    //#region settings store
    var SETTINGS_KEY = 'dsh-session-dashboard/settings/v1'
    var ROW_OPTIONS = [3, 5, 8, 10]
    var DEFAULT_SETTINGS = { lang: 'en', rows: 5, collapsed: false }
    var settingsListeners = new Set()

    function normalizeRows(value) {
      var n = Number(value)
      return ROW_OPTIONS.indexOf(n) === -1 ? DEFAULT_SETTINGS.rows : n
    }

    function readSettings() {
      try {
        var raw = window.localStorage.getItem(SETTINGS_KEY)
        if (raw === null) return { lang: DEFAULT_SETTINGS.lang, rows: DEFAULT_SETTINGS.rows, collapsed: DEFAULT_SETTINGS.collapsed }
        var parsed = JSON.parse(raw)
        var lang = parsed && parsed.lang === 'zh' ? 'zh' : 'en'
        return { lang: lang, rows: normalizeRows(parsed && parsed.rows), collapsed: parsed !== null && typeof parsed === 'object' && parsed.collapsed === true }
      } catch (_error) {
        return { lang: DEFAULT_SETTINGS.lang, rows: DEFAULT_SETTINGS.rows, collapsed: DEFAULT_SETTINGS.collapsed }
      }
    }

    function writeSettings(patch) {
      var next = Object.assign({}, readSettings(), patch)
      next.rows = normalizeRows(next.rows)
      next.lang = next.lang === 'zh' ? 'zh' : 'en'
      next.collapsed = next.collapsed === true
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch (_error) {
        // Storage can be unavailable; the in-memory listeners still update.
      }
      settingsListeners.forEach(function (listener) { listener() })
    }

    function subscribeSettings(listener) {
      settingsListeners.add(listener)
      return function () { settingsListeners.delete(listener) }
    }

    function useCardSettings() {
      var pair = useState(readSettings)
      var settings = pair[0]
      var setSettings = pair[1]
      useEffect(function () {
        function update() { setSettings(readSettings()) }
        var off = subscribeSettings(update)
        window.addEventListener('storage', update)
        update()
        return function () {
          off()
          window.removeEventListener('storage', update)
        }
      }, [])
      return settings
    }
    //#endregion

    //#region styles
    var STYLE_KEY = 'dsh-session-dashboard'
    var CSS = [
      '.dsd-root{width:100%;min-width:0;margin:0 0 8px;box-sizing:border-box}',
      '.dsd-root-rail{width:auto;margin:0}',
      '.dsd-root *{box-sizing:border-box}',
      '.dsd-card.dsd-card-collapsed{padding:6px 9px}',
      '.dsd-card{transition:padding .22s ease}',
      '.dsd-expand{display:grid;grid-template-rows:1fr;margin-top:7px;transition:grid-template-rows .22s ease,margin-top .22s ease}',
      '.dsd-expand-collapsed{grid-template-rows:0fr;margin-top:0}',
      '.dsd-expand-inner{display:flex;flex-direction:column;gap:7px;min-height:0;overflow:hidden}',
      '.dsd-card{display:flex;flex-direction:column;gap:0;width:100%;min-width:0;padding:9px 9px 7px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));color:var(--dsw-alias-label-primary)}',
      '.dsd-head{display:flex;align-items:center;gap:6px;min-width:0}',
      '.dsd-head-toggle{display:flex;align-items:center;gap:6px;flex:1;min-width:0;padding:0;margin:0;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.dsd-head-toggle:hover .dsd-title{color:var(--dsw-alias-label-primary)}',
      '.dsd-head-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dsd-caret{display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease}',
      '.dsd-caret-open{transform:rotate(90deg)}',
      '.dsd-title{margin:0;font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsd-mini{display:inline-flex;align-items:center;gap:7px;margin-left:2px;flex:none}',
      '.dsd-mini-item{display:inline-flex;align-items:center;gap:3px;font-size:10px;line-height:14px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.dsd-mini-dot{width:5px;height:5px;border-radius:50%;flex:none;background:currentColor}',
      '.dsd-mini-needs{color:var(--dsw-alias-state-warn-primary)}',
      '.dsd-mini-running{color:var(--dsw-alias-state-business-primary)}',
      '.dsd-mini-done{color:var(--dsw-alias-state-success-primary)}',
      '.dsd-mini-total{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}',
      '.dsd-head-actions{display:flex;align-items:center;gap:2px;margin-left:auto}',
      '.dsd-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsd-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsd-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsd-chips{display:flex;align-items:center;gap:3px;flex-wrap:wrap}',
      '.dsd-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;line-height:16px;cursor:pointer;white-space:nowrap}',
      '.dsd-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsd-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsd-chip-count{font-variant-numeric:tabular-nums;opacity:.9}',
      '.dsd-chip-all.is-active{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.12));color:var(--dsw-alias-label-primary)}',
      '.dsd-chip-needs{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 15%,transparent)}',
      '.dsd-chip-running{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 15%,transparent)}',
      '.dsd-chip-done{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 15%,transparent)}',
      '.dsd-chip-needs.is-active,.dsd-chip-running.is-active,.dsd-chip-done.is-active{border-color:color-mix(in srgb,currentColor 55%,transparent)}',
      '.dsd-list{position:relative;display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.dsd-row{display:grid;grid-template-columns:16px minmax(0,1fr);gap:7px;align-items:start;width:100%;margin:0;padding:4px 5px;min-height:41px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.dsd-row-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}',
      '.dsd-row-running{position:relative;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent)}',
      '.dsd-row-running::after{content:"";position:absolute;top:0;bottom:0;left:0;width:42%;pointer-events:none;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),transparent);transform:translateX(-120%);animation:dsd-sweep 2.4s ease-in-out infinite}',
      '.dsd-row-running > *{position:relative;z-index:1}',
      '.dsd-row-done{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 7%,transparent)}',
      '.dsd-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsd-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}',
      '.dsd-status{display:flex;align-items:center;justify-content:center;width:16px;height:16px;margin-top:1px}',
      '.dsd-status svg{display:block}',
      '.dsd-spinner svg{animation:dsd-spin 1s linear infinite}',
      '.dsd-body{min-width:0}',
      '.dsd-titleline{display:flex;height:17px;align-items:baseline;gap:6px;min-width:0}',
      '.dsd-row-title{display:block;flex:1;min-width:0;font-size:12.5px;line-height:17px;font-weight:500;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsd-subtitle{display:block;margin-top:1px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsd-time{flex:none;margin-right:4px;font-size:10.5px;line-height:17px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dsd-notice{padding:8px 2px;text-align:center;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.dsd-notice-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0}',
      '.dsd-row-filler{visibility:hidden}',
      '.dsd-foot{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:1px;padding:1px 0 0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:16px;cursor:pointer;border-radius:6px}',
      '.dsd-foot:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsd-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsd-rail{position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsd-rail:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsd-rail:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsd-badge{position:absolute;top:1px;right:1px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-bg-base);font-size:9px;line-height:14px;font-weight:600;text-align:center;font-variant-numeric:tabular-nums}',
      '.dsd-dot{position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}',
      '@keyframes dsd-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
      '@keyframes dsd-sweep{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}',
      '.dsd-settings{display:flex;flex-direction:column;gap:14px;min-width:0;max-width:520px;padding:4px 0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px}',
      '.dsd-settings-title{margin:0;font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsd-settings-intro{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}',
      '.dsd-setting{display:flex;align-items:center;gap:12px}',
      '.dsd-setting-label{flex:none;width:120px;color:var(--dsw-alias-label-secondary)}',
      '.dsd-select{min-width:160px;padding:4px 8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}',
      '.dsd-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsd-settings-hint{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}',
      // The running glyph is the card's only motion; it keeps spinning even
      // under prefers-reduced-motion because it is the primary state signal
      // requested for active sessions.
      '@media (prefers-reduced-motion:reduce){.dsd-spinner svg{animation-duration:1.4s}.dsd-row-running::after{animation-duration:3.6s}}',
    ].join('\n')

    function installStyles() {
      if (typeof document === 'undefined') return function () {}
      // Always own a fresh tag: reusing one from a previous plugin generation
      // would leave the card unstyled when that generation's disposer runs.
      var tag = document.createElement('style')
      tag.dataset.dshPlugin = STYLE_KEY
      tag.textContent = CSS
      document.head.appendChild(tag)
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
      }
    }
    //#endregion

    //#region data helpers
    var EMPTY_VALUES = {}
    var EMPTY_STATUS = new Map()
    var EMPTY_LIST = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} }

    /** Stable selector: the card renders from whole snapshots. */
    function selectAll(value) {
      return value
    }

    /** A wall clock sampled on an interval so relative times stay fresh. */
    function useClock(intervalMs) {
      var pair = useState(function () { return Date.now() })
      var now = pair[0]
      var setNow = pair[1]
      useEffect(function () {
        var timer = setInterval(function () { setNow(Date.now()) }, intervalMs)
        return function () { clearInterval(timer) }
      }, [intervalMs])
      return now
    }

    function isObject(value) {
      return typeof value === 'object' && value !== null
    }

    /** Merge the list row's cached projections with the live summary's values. */
    function projectionValuesOf(listState, sessionId) {
      var snapshot = listState.projectionsBySession ? listState.projectionsBySession[sessionId] : undefined
      var cached = isObject(snapshot) && isObject(snapshot.values) ? snapshot.values : undefined
      var summary = listState.byId ? listState.byId[sessionId] : undefined
      var live = isObject(summary) && isObject(summary.projectionValues) ? summary.projectionValues : undefined
      if (cached === undefined && live === undefined) return EMPTY_VALUES
      if (cached === undefined) return live
      if (live === undefined) return cached
      return Object.assign({}, cached, live)
    }

    /** The todo an agent is on right now, when its todo list says so. */
    function activeTodoOf(values) {
      var todos = values ? values.todos : undefined
      if (!Array.isArray(todos)) return ''
      for (var index = todos.length - 1; index >= 0; index -= 1) {
        var item = todos[index]
        if (isObject(item) && item.status === 'in_progress' && typeof item.content === 'string' && item.content.trim() !== '') {
          return item.content.trim()
        }
      }
      return ''
    }

    function lastTurnOf(values) {
      var outline = values ? values.turnOutline : undefined
      if (!Array.isArray(outline) || outline.length === 0) return undefined
      var turn = outline[outline.length - 1]
      return isObject(turn) ? turn : undefined
    }

    function turnCountOf(values) {
      var outline = values ? values.turnOutline : undefined
      if (Array.isArray(outline) && outline.length > 0) return outline.length
      var stats = values ? values.sessionStats : undefined
      if (isObject(stats) && typeof stats.turns === 'number' && stats.turns > 0) return stats.turns
      return 0
    }

    function clip(text, max) {
      var flat = String(text).replace(/\s+/g, ' ').trim()
      if (flat.length <= max) return flat
      return flat.slice(0, max - 1).trimEnd() + '…'
    }

    function statusOf(statusMap, sessionId) {
      if (!isObject(statusMap) || typeof statusMap.get !== 'function') return undefined
      return statusMap.get(sessionId)
    }

    function pendingKeyOf(pending) {
      if (!isObject(pending) || typeof pending.kind !== 'string') return null
      if (pending.kind === 'approval') return 'statusApproval'
      if (pending.kind === 'plan-review') return 'statusPlanReview'
      if (pending.kind === 'question') return 'statusAnswer'
      return null
    }

    function isPending(row) {
      return row.pending !== undefined
    }

    function isRunning(row) {
      return row.running === true && row.pending === undefined
    }

    /** A turn finished outside the main view and nobody has looked at it yet. */
    function isDone(row) {
      return row.unread === true && row.pending === undefined && row.running !== true
    }

    /**
     * Project one catalog Session into the row facts the card renders.
     * Pending interactions and live runs are the facts that must surface first;
     * the subtitle then answers "what is it doing now" with the strongest data
     * the Client holds.
     */
    function rowOf(listState, statusMap, sessionId, t) {
      var summary = listState.byId ? listState.byId[sessionId] : undefined
      if (!isObject(summary)) return undefined
      if (summary.blank === true || summary.origin === 'subagent') return undefined

      var status = statusOf(statusMap, sessionId)
      var running = isObject(status) && status.running !== undefined ? status.running === true : summary.running === true
      var pendingKey = isObject(status) ? pendingKeyOf(status.pendingInteraction) : null
      var pending = pendingKey === null ? undefined : status.pendingInteraction
      var unread = isObject(status) && status.completionUnread === true
      var values = projectionValuesOf(listState, sessionId)
      var todo = activeTodoOf(values)
      var turn = lastTurnOf(values)
      var title = typeof summary.displayTitle === 'string' && summary.displayTitle !== ''
        ? summary.displayTitle
        : (typeof summary.title === 'string' && summary.title !== '' ? summary.title : sessionId)

      var tone
      var subtitle
      if (pending !== undefined) {
        tone = 'warn'
        subtitle = t(pendingKey)
      } else if (running) {
        tone = 'running'
        var activity = todo !== '' ? todo : (turn !== undefined && typeof turn.prompt === 'string' ? turn.prompt : '')
        subtitle = activity !== '' ? t('statusWorkingOn', { task: clip(activity, 40) }) : t('statusWorking')
      } else if (unread) {
        tone = 'done'
        var turns = turnCountOf(values)
        subtitle = turns > 0
          ? t('statusCompletedUnread', { count: turns })
          : t('statusCompletedUnreadPlain')
      } else {
        tone = 'idle'
        var last = turn !== undefined
          ? (typeof turn.prompt === 'string' && turn.prompt !== '' ? turn.prompt : (typeof turn.response === 'string' ? turn.response : ''))
          : ''
        subtitle = last !== '' ? t('statusLastTask', { task: clip(last, 40) }) : t('statusIdle')
      }

      return {
        id: sessionId,
        title: title,
        cwd: typeof summary.cwd === 'string' ? summary.cwd : '',
        updatedAt: Number.isFinite(summary.updatedAt) ? summary.updatedAt : null,
        running: running,
        pending: pending,
        unread: unread,
        tone: tone,
        subtitle: subtitle,
      }
    }

    function relativeTimeOf(timestamp, now, t) {
      if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return ''
      var diff = Math.max(0, now - timestamp)
      if (diff < 60000) return t('timeNow')
      var minutes = Math.floor(diff / 60000)
      if (minutes < 60) return t('timeMinutes', { n: minutes })
      var hours = Math.floor(minutes / 60)
      if (hours < 24) return t('timeHours', { n: hours })
      var days = Math.floor(hours / 24)
      if (days < 7) return t('timeDays', { n: days })
      try {
        return new Date(timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
      } catch (_error) {
        return new Date(timestamp).toISOString().slice(5, 10)
      }
    }
    //#endregion

    //#region icons
    function PlusIcon() {
      return h('svg', {
        width: 14,
        height: 14,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, [
        h('path', { key: 'h', d: 'M8 2.5v11' }),
        h('path', { key: 'v', d: 'M2.5 8h11' }),
      ])
    }

    function ChevronIcon(props) {
      var up = props && props.up === true
      return h('svg', {
        width: 10,
        height: 10,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, h('path', { d: up ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4' }))
    }

    /** Small right-pointing disclosure caret; rotated by CSS when the card is open. */
    function CaretIcon() {
      return h('svg', {
        width: 10,
        height: 10,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, h('path', { d: 'M6 3.5l4.5 4.5L6 12.5' }))
    }

    /** Rail glyph: an activity pulse, drawn in the collapsed sidebar's icon cell. */
    function PanelIcon(props) {
      var size = props && typeof props.size === 'number' ? props.size : 16
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, h('path', { d: 'M1.5 8.5h2.4l1.5-4 2.4 7 1.5-4.2h5.2' }))
    }

    /** Leading status glyph: spinner, question, check, or quiet ring. */
    function StatusIcon(props) {
      var tone = props.tone
      if (tone === 'running') {
        return h('span', { className: 'dsd-status dsd-spinner', 'aria-hidden': 'true' },
          h('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'var(--dsw-alias-state-business-primary)',
            strokeWidth: 2,
            strokeLinecap: 'round',
          }, h('circle', { cx: 8, cy: 8, r: 6, 'stroke-dasharray': '22 16' })))
      }
      if (tone === 'warn') {
        return h('span', { className: 'dsd-status', 'aria-hidden': 'true' },
          h('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'var(--dsw-alias-state-warn-primary)',
            strokeWidth: 1.4,
          }, [
            h('circle', { key: 'c', cx: 8, cy: 8, r: 6 }),
            h('text', {
              key: 't',
              x: 8,
              y: 11.2,
              textAnchor: 'middle',
              fontSize: 9,
              fontWeight: 600,
              fill: 'var(--dsw-alias-state-warn-primary)',
              stroke: 'none',
            }, '?'),
          ]))
      }
      if (tone === 'done') {
        return h('span', { className: 'dsd-status', 'aria-hidden': 'true' },
          h('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'var(--dsw-alias-state-success-primary)',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }, [
            h('circle', { key: 'c', cx: 8, cy: 8, r: 6 }),
            h('path', { key: 'p', d: 'M5.2 8.3l1.9 1.9 3.7-4' }),
          ]))
      }
      return h('span', { className: 'dsd-status', 'aria-hidden': 'true' },
        h('svg', {
          width: 14,
          height: 14,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'var(--dsw-alias-label-caption)',
          strokeWidth: 1.4,
        }, h('circle', { cx: 8, cy: 8, r: 3.2 })))
    }
    //#endregion

    //#region components
    function FilterChip(props) {
      var className = 'dsd-chip dsd-chip-' + props.tone + (props.active ? ' is-active' : '')
      return h('button', {
        type: 'button',
        className: className,
        'aria-pressed': props.active ? 'true' : 'false',
        onClick: props.onSelect,
      }, [
        h('span', { key: 'label' }, props.label),
        h('span', { key: 'count', className: 'dsd-chip-count' }, String(props.count)),
      ])
    }

    function CompactRow(props) {
      var row = props.row
      var t = props.t
      return h('button', {
        type: 'button',
        className: 'dsd-row dsd-row-' + row.tone,
        title: t('openSession', { title: row.title }),
        'aria-label': t('openSession', { title: row.title }),
        onClick: function () { props.onOpen(row.id) },
      }, [
        h(StatusIcon, { key: 'status', tone: row.tone }),
        h('span', { key: 'body', className: 'dsd-body' }, [
          h('span', { key: 'titleline', className: 'dsd-titleline' }, [
            h('span', { key: 'title', className: 'dsd-row-title' }, row.title),
            row.updatedAt === null ? null : h('span', { key: 'time', className: 'dsd-time' },
              relativeTimeOf(row.updatedAt, props.now, t)),
          ]),
          h('span', { key: 'subtitle', className: 'dsd-subtitle' }, row.subtitle),
        ]),
      ])
    }

    /**
     * Invisible row that reserves one list slot, so filtering to a shorter
     * result keeps the card's height instead of collapsing it.
     */
    function FillerRow() {
      return h('div', { className: 'dsd-row dsd-row-filler', 'aria-hidden': 'true' }, [
        h('span', { key: 'status', className: 'dsd-status' }),
        h('span', { key: 'body', className: 'dsd-body' }, [
          h('span', { key: 'titleline', className: 'dsd-titleline' }, [
            h('span', { key: 'title', className: 'dsd-row-title' }, '\u00a0'),
            h('span', { key: 'time', className: 'dsd-time' }, '\u00a0'),
          ]),
          h('span', { key: 'subtitle', className: 'dsd-subtitle' }, '\u00a0'),
        ]),
      ])
    }

    /**
     * Seat gate. The card's data seats are hooks, so the component that calls
     * them must call the same set on every render; this wrapper is hook-free
     * and swaps the whole child when a seat disappears, which resets that
     * child's hook list instead of desynchronizing it.
     */
    function SidebarEntry(props) {
      var available = typeof props.useSessions === 'function'
        && typeof props.useSessionStatus === 'function'
        && typeof props.useWorkspaces === 'function'
      if (!available) {
        if (props.wide !== true) return null
        return h('div', { className: 'dsd-root' },
          h('div', { className: 'dsd-card' },
            h('div', { className: 'dsd-notice' }, translate(readSettings().lang, 'seatsUnavailable'))))
      }
      return h(SessionCard, props)
    }

    function SessionCard(props) {
      var settings = useCardSettings()
      var t = function (key, vars) { return translate(settings.lang, key, vars) }
      var rawListState = props.useSessions(selectAll)
      var listState = isObject(rawListState) ? rawListState : EMPTY_LIST
      var rawStatusMap = props.useSessionStatus(selectAll)
      var statusMap = isObject(rawStatusMap) ? rawStatusMap : EMPTY_STATUS
      var rawWorkspaces = props.useWorkspaces(selectAll)
      var workspacesState = isObject(rawWorkspaces) ? rawWorkspaces : null
      var now = useClock(15000)
      var filterState = useState('all')
      var filter = filterState[0]
      var setFilter = filterState[1]
      var expandedState = useState(false)
      var expanded = expandedState[0]
      var setExpanded = expandedState[1]

      var rows = useMemo(function () {
        var ids = Array.isArray(listState.ids) ? listState.ids : []
        var archived = workspacesState !== null && Array.isArray(workspacesState.archivedSessionIds)
          ? new Set(workspacesState.archivedSessionIds)
          : null
        var collected = []
        for (var index = 0; index < ids.length; index += 1) {
          if (archived !== null && archived.has(ids[index])) continue
          var row = rowOf(listState, statusMap, ids[index], t)
          if (row !== undefined) collected.push(row)
        }
        // Attention first, then activity: a pending approval, a live run, or a
        // finished-but-unseen turn must be visible in the card's few rows even
        // when it is not the newest.
        function rank(row) {
          if (isPending(row)) return 0
          if (isRunning(row)) return 1
          if (isDone(row)) return 2
          return 3
        }
        collected.sort(function (left, right) {
          var rankDelta = rank(left) - rank(right)
          if (rankDelta !== 0) return rankDelta
          var leftAt = left.updatedAt
          var rightAt = right.updatedAt
          if (leftAt === null && rightAt === null) return left.id < right.id ? -1 : (left.id > right.id ? 1 : 0)
          if (leftAt === null) return 1
          if (rightAt === null) return -1
          if (rightAt !== leftAt) return rightAt - leftAt
          return left.id < right.id ? -1 : (left.id > right.id ? 1 : 0)
        })
        return collected
      }, [listState, statusMap, workspacesState, t])

      var counts = useMemo(function () {
        var needs = 0
        var running = 0
        var done = 0
        for (var index = 0; index < rows.length; index += 1) {
          if (isPending(rows[index])) needs += 1
          if (isRunning(rows[index])) running += 1
          if (isDone(rows[index])) done += 1
        }
        return { all: rows.length, needs: needs, running: running, done: done }
      }, [rows])

      var visible = useMemo(function () {
        return rows.filter(function (row) {
          if (filter === 'needs') return isPending(row)
          if (filter === 'running') return isRunning(row)
          if (filter === 'done') return isDone(row)
          return true
        })
      }, [rows, filter])

      var LIMIT = settings.rows
      var LIMIT_EXPANDED = 10
      var limit = expanded ? LIMIT_EXPANDED : LIMIT
      var shown = visible.slice(0, limit)
      var loading = listState.phase === 'pending'
      var openSession = props.openSession
      var startSession = props.startSession

      function onOpen(sessionId) {
        try {
          if (typeof openSession === 'function') openSession(sessionId)
        } catch (error) {
          console.error('[dsh-session-dashboard] could not open session', error)
        }
      }

      function onNewSession() {
        try {
          if (typeof startSession === 'function') startSession()
        } catch (error) {
          console.error('[dsh-session-dashboard] could not start a session', error)
        }
      }

      // Collapsed sidebar: one rail button with the needs-you count (or a
      // running dot). Clicking it brings the sidebar back, card included.
      if (props.wide !== true) {
        var railLabel = t('railLabel', { needs: counts.needs, running: counts.running, done: counts.done })
        return h('div', { className: 'dsd-root dsd-root-rail' },
          h('button', {
            type: 'button',
            className: 'dsd-rail',
            title: railLabel,
            'aria-label': railLabel,
            onClick: function () {
              try {
                if (typeof props.toggleSidebar === 'function') props.toggleSidebar()
              } catch (error) {
                console.error('[dsh-session-dashboard] could not toggle the sidebar', error)
              }
            },
          }, [
            h(PanelIcon, { key: 'icon', size: 16 }),
            counts.needs > 0
              ? h('span', { key: 'badge', className: 'dsd-badge' }, counts.needs > 99 ? '99+' : String(counts.needs))
              : (counts.running > 0 || counts.done > 0 ? h('span', { key: 'dot', className: 'dsd-dot' }) : null),
          ]))
      }

      var chips = [
        { key: 'all', tone: 'all', label: t('filterAll'), count: counts.all },
        { key: 'needs', tone: 'needs', label: t('filterNeeds'), count: counts.needs },
        { key: 'running', tone: 'running', label: t('filterRunning'), count: counts.running },
        { key: 'done', tone: 'done', label: t('filterDone'), count: counts.done },
      ]

      // Reserve one slot per row the current mode can show, independent of the
      // active filter, so switching filters never changes the card's height.
      var slots = Math.min(limit, rows.length)
      var body
      if (loading) {
        body = h('div', { className: 'dsd-notice', role: 'status' }, t('loading'))
      } else if (rows.length === 0) {
        body = h('div', { className: 'dsd-notice', role: 'status' }, t('empty'))
      } else {
        var items = shown.map(function (row) {
          return h(CompactRow, { key: row.id, row: row, now: now, t: t, onOpen: onOpen })
        })
        for (var slot = shown.length; slot < slots; slot += 1) {
          items.push(h(FillerRow, { key: 'slot-' + slot }))
        }
        if (shown.length === 0) {
          items.unshift(h('div', { key: 'notice', className: 'dsd-notice dsd-notice-overlay', role: 'status' }, t('noMatches')))
        }
        body = items
      }

      var expandable = rows.length > LIMIT
      var collapsed = settings.collapsed === true
      var collapseLabel = collapsed ? t('expandCard') : t('collapseCard')

      function miniItem(key, tone, value, label) {
        return h('span', {
          key: key,
          className: 'dsd-mini-item dsd-mini-' + tone,
          title: label + ': ' + value,
        }, [
          h('span', { key: 'dot', className: 'dsd-mini-dot' }),
          String(value),
        ])
      }

      var collapsedSummary = []
      if (counts.needs > 0) collapsedSummary.push(miniItem('needs', 'needs', counts.needs, t('filterNeeds')))
      if (counts.running > 0) collapsedSummary.push(miniItem('running', 'running', counts.running, t('filterRunning')))
      if (counts.done > 0) collapsedSummary.push(miniItem('done', 'done', counts.done, t('filterDone')))
      if (collapsedSummary.length === 0) {
        collapsedSummary.push(h('span', { key: 'total', className: 'dsd-mini-total' }, String(counts.all)))
      }

      var children = [
        h('div', { key: 'head', className: 'dsd-head' }, [
          h('button', {
            key: 'toggle',
            type: 'button',
            className: 'dsd-head-toggle',
            'aria-label': collapseLabel,
            'aria-expanded': collapsed ? 'false' : 'true',
            title: collapseLabel,
            onClick: function () { writeSettings({ collapsed: !collapsed }) },
          }, [
            h('span', { key: 'caret', className: collapsed ? 'dsd-caret' : 'dsd-caret dsd-caret-open' }, h(CaretIcon)),
            h('span', { key: 'title', className: 'dsd-title' }, t('title')),
            collapsed ? h('span', { key: 'summary', className: 'dsd-mini' }, collapsedSummary) : null,
          ]),
          h('div', { key: 'actions', className: 'dsd-head-actions' }, [
            h('button', {
              key: 'new',
              type: 'button',
              className: 'dsd-icon-btn',
              'aria-label': t('newSession'),
              title: t('newSession'),
              onClick: onNewSession,
            }, h(PlusIcon)),
          ]),
        ]),
      ]
      children.push(h('div', {
        key: 'expand',
        className: collapsed ? 'dsd-expand dsd-expand-collapsed' : 'dsd-expand',
        'aria-hidden': collapsed ? 'true' : 'false',
        inert: collapsed ? '' : undefined,
      }, h('div', { key: 'inner', className: 'dsd-expand-inner' }, [
        h('div', { key: 'chips', className: 'dsd-chips', role: 'group', 'aria-label': t('filters') },
          chips.map(function (chip) {
            return h(FilterChip, {
              key: chip.key,
              tone: chip.tone,
              label: chip.label,
              count: chip.count,
              active: filter === chip.key,
              onSelect: function () { setFilter(chip.key) },
            })
          })),
        h('div', { key: 'list', className: 'dsd-list', role: 'list' }, body),
        expandable ? h('button', {
          key: 'more',
          type: 'button',
          className: 'dsd-foot',
          onClick: function () { setExpanded(!expanded) },
        }, [
          h('span', { key: 'label' }, expanded ? t('collapse') : t('expand')),
          h(ChevronIcon, { key: 'chevron', up: expanded }),
        ]) : null,
      ])))
      return h('div', { className: 'dsd-root' },
        h('div', { className: collapsed ? 'dsd-card dsd-card-collapsed' : 'dsd-card' }, children),
      )
    }
    //#endregion

    /**
     * Settings page body: language of the card copy and the number of rows the
     * collapsed card shows. Stored in this browser's localStorage.
     */
    function SettingsPanel() {
      var settings = useCardSettings()
      var t = function (key, vars) { return translate(settings.lang, key, vars) }
      return h('div', { className: 'dsd-settings' }, [
        h('h3', { key: 'title', className: 'dsd-settings-title' }, t('settingsTitle')),
        h('p', { key: 'intro', className: 'dsd-settings-intro' }, t('settingsIntro')),
        h('label', { key: 'language', className: 'dsd-setting' }, [
          h('span', { key: 'label', className: 'dsd-setting-label' }, t('settingsLanguage')),
          h('select', {
            key: 'select',
            className: 'dsd-select',
            value: settings.lang,
            onChange: function (event) { writeSettings({ lang: event.target.value }) },
          }, [
            h('option', { key: 'en', value: 'en' }, t('langEn')),
            h('option', { key: 'zh', value: 'zh' }, t('langZh')),
          ]),
        ]),
        h('label', { key: 'rows', className: 'dsd-setting' }, [
          h('span', { key: 'label', className: 'dsd-setting-label' }, t('settingsRows')),
          h('select', {
            key: 'select',
            className: 'dsd-select',
            value: String(settings.rows),
            onChange: function (event) { writeSettings({ rows: Number(event.target.value) }) },
          }, ROW_OPTIONS.map(function (n) {
            return h('option', { key: n, value: String(n) }, t('rowOption', { n: n }))
          })),
        ]),
        h('p', { key: 'rowsHint', className: 'dsd-settings-intro' }, t('settingsRowsHint')),
        h('p', { key: 'hint', className: 'dsd-settings-hint' }, t('settingsHint')),
      ])
    }

    //#region plugin
    var ENTRY_ID = 'session-dashboard'

    /** Browser services this plugin reads. */
    var inject = ['uiWorkspace', 'layout', 'slots', 'locale']

    function apply(ctx) {
      // A throw during a client plugin's bootstrap runs on the shell's own boot
      // path; contain it so a defective card can never blank the app.
      try {
        mount(ctx)
      } catch (error) {
        console.error('[dsh-session-dashboard] mounting failed; the session card is unavailable in this session.', error)
      }
    }

    function mount(ctx) {
      ctx.effect(function () {
        return installStyles()
      }, 'dsh-session-dashboard: styles')

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'dsh-session-dashboard: dictionaries')

      var navT = ctx.locale.bind(NS)

      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: ENTRY_ID,
          order: 30,
          locale: NS,
          label: function () { return navT('settingsTitle') },
        }, SettingsPanel)
      })

      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action',
          id: ENTRY_ID,
          order: 10,
          locale: NS,
          inject: function () {
            return {
              openSession: function (sessionId) { ctx.uiWorkspace.openSession(sessionId) },
              startSession: function () { ctx.uiWorkspace.startSession() },
              toggleSidebar: function () { ctx.layout.toggleSidebar() },
            }
          },
        }, SidebarEntry)
      })
    }

    exports.name = 'dsh-session-dashboard'
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
