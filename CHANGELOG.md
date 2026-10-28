# Changelog

## 1.0.0 — 2026-10-28

- 正式版：保留三种风格及固定自定义短信。
- 修复设置结束带走外部标签、休息结束回收内容页、失败退出提前显示已结束、闹钟无重试等问题。
- 统一收藏校验，补充 B站合集/列表格式；尊重用户主动切换原站标签。
- 登录改为标签级限时规则；入口禁止嵌入；WAR 仅保留两个 HTML，浮窗使用 closed shadow root。
- 修复失败 helper 清理、跨窗口创建、隐藏登录误判、草稿关闭丢失和 popup 错误兜底。
- 独立交付安装包、源码测试包、隐私说明和可核对的验证清单。

## 0.8.1 — 2026-10-28

- 默认短信改为「小明：大不了你就二战呗。」，细化联系人头像与灰色接收气泡。 / Refine the received-text appearance and update the shipped example.
- 修复开始休息等待网页回应、搜索初始化遮罩、隐藏登录框误识别及恢复页面后卡住的问题。 / Fix break-notification waits, search veils, hidden-dialog false positives, and stale restored-page state.
- 给设置与消息加截止时间，恢复初始化可重试，减少重复计时器重绘并防止旧偏好快照覆盖新内容。 / Bound settings/IPC waits, retry initialization, reduce timer redraws, and guard newer preferences against stale snapshots.
- 当前合并版完整代码审查及测试限制记录在 REVIEW.md。 / Record the audit and validation limits in REVIEW.md.

## 0.8.0 — 2026-10-28

- 新增「同桌」风格，中心展示自定义的【名字】留言。 / Add a Study buddy style with a user-written name and fixed message.
- 面板可编辑并保存名字与留言，提供一条示例；跨入口同步并记住，不随机、不轮换、不区分语气。 / Edit and persist a name/message, with one example and no random rotation or tone selector.
- 保留自定义原文及换行，切换界面语言或其他风格时不覆盖内容。 / Keep custom wording and line breaks unchanged across language and theme changes.
- 延续共享收藏、计时和可拖动浮窗，不增加权限。 / Preserve shared favorites, timers, and draggable widgets without adding permissions.

## 0.7.0 — 2026-10-28

- 合并为一个扩展，新增工具栏风格面板和入口页预览面板。 / Combine both editions with a popup picker and entry-page preview panel.
- 同时切换完整文案、配色、字体和页面标识，跨标签即时同步并记住选择。 / Switch complete copy, colors, typography, and page branding live across views and persist the selection.
- 共用收藏、语言与计时状态，切换风格不重置计时、不刷新页面。 / Share settings and timers without reloading pages or resetting deadlines.
- 保留 0.6.4 的收藏识别、登录备用入口、浮窗收起与拖动等功能。 / Preserve 0.6.4 collection handling, login fallback, and widget collapse/drag behavior.
- 不新增权限，发布包排除浏览器缓存和测试输出。 / Add no permissions; exclude browser-generated cache and test output from releases.
