# 开发、测试与构建

[中文首页](../README.md) · [English](../README.en.md)

## 目录

```text
extension/                浏览器实际加载的运行时代码
tests/                    Playwright 回归及故障注入
tests/artifacts/*.json    1.0.0 测试记录；重新测试会覆盖
tools/verify_release.py   语法、资源、报告和版本检查
build.py                  标准库 ZIP 打包
docs/images/              公开界面截图
VERIFICATION.json         1.0.0 运行时 SHA-256 与测试范围
```

运行时无第三方依赖；测试依赖 Playwright。安装扩展本身不需要开发工具。

开发辅助工具：OpenAI Codex。该说明用于记录开发工具，不表示本项目由 OpenAI 官方发布或背书。

## 环境

- Node.js 20 或以上，以及 npm。
- Python 3.9 或以上。
- 桌面 Chromium 浏览器；完整测试以 Windows Edge 为验证环境。

在仓库根目录执行：

```shell
npm install
npm test
python tools/verify_release.py
python build.py
```

默认测试优先查找 Windows Edge。如果不在默认位置，用 `EDGE_EXECUTABLE` 指向浏览器可执行文件。示例（PowerShell）：

```powershell
$env:EDGE_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm test
```

浏览器需要支持通过启动参数加载解压扩展；不同 Chromium 发行版本可能限制这种测试方式。其他系统和浏览器的完整测试未做保证。

`PLAYWRIGHT_MODULE_PATH` 可覆盖 Playwright 模块路径；没有设置时先使用已安装的依赖。脚本也保留按当前用户主目录查找 Codex 捆绑工具的兼容逻辑，没有硬编码个人用户名。

## 测试范围

| 测试 | 场景数 |
| --- | --- |
| 发布专项 | 11 |
| 风格同步 | 5 |
| 固定留言 | 8 |
| 故障 / 恢复 | 11 |
| 每种风格的登录、收藏和浮窗 | 17 × 3 |
| 合计 | 86 |

网站响应均为模拟页面，浏览器使用独立临时配置。发布专项加载原样运行时并通过 CDP 检查 closed shadow；布局测试对临时副本开放 shadow 方便断言；故障测试向临时副本注入 API 延迟。这些测试副本不会写回 extension。

真实扫码、验证码、平台风控、所有浏览器版本、线上 DOM 改版未做端到端验证。BFCache 测试显式派发恢复事件；后台初始化恢复测试不等同于所有真实 Service Worker 终止行为。详见 [发布审查记录](../RELEASE-REVIEW.md)。

仓库随附的是 1.0.0 的历史通过记录，不代表本机刚刚重新执行了测试。修改运行时后，应先重跑测试，再运行校验脚本刷新 VERIFICATION.json。不要只修改报告状态来跳过失败。

## 构建

```shell
python build.py
python build.py --source
```

输出分别为 `dist/intentional-browsing-chromium-1.0.0.zip` 和 `dist/intentional-browsing-source-1.0.0.zip`。可用 `--output` 自选路径。

打包会验证运行时文件与 VERIFICATION.json 的 SHA-256 一致。不一致时先确认改动与测试状态，不能直接把旧版报告当作新版通过记录。安装包包含运行时与文档，源码包额外包含测试、构建和公开仓库资料；浏览器缓存、node_modules 和个人配置不应进入发行物。

本仓库新增文档、许可证和截图，因此重新构建的 ZIP 不会与最初正式版 ZIP 的整体哈希相同；extension 内文件保持一致。最初安装包可按原样附到 GitHub Release。

## 运行时结构

- `background.js`、`collection-setup.js`：会话状态、限时规则、闹钟、导航。
- `route.js`、`guard.js`、`login.js`：原站路由、遮罩、登录识别。
- `shared.js`：站点和收藏地址校验。
- `entry.*`、`popup.*`、`appearance.*`：入口、风格面板。
- `theme.js`、`friend.js`、`i18n.js`：风格、固定留言、界面语言。

保持修改范围明确。涉及临时权限、跨标签导航或登录时，补充相应成功和失败路径的回归；不需要为纯文档修改重跑整套浏览器测试。
