# 隐私说明 · Privacy

适用版本 1.0.0；说明更新于 2026-10-31。

扩展不设置遥测、广告或分析服务，也不把数据上传给开发者。搜索与登录操作会访问 B站/小红书自身服务，适用原站的隐私规则。

- 风格、语言、自定义朋友名字/留言、收藏地址及浮窗位置保存在浏览器扩展本地存储。收藏 URL 可能包含原站访问参数，请勿公开分享含个人参数的设置。
- 搜索词、待恢复目标、限时放行/登录/收藏设置截止时间保存在会话存储。标签关闭会清理其待恢复目标；超过 30 分钟的目标不再自动恢复。会话状态由浏览器管理，不同步到开发者服务器。
- 网站访问权限限于清单列出的 B站/小红书域名，用于首页导航、登录/收藏识别和浮窗。内容脚本会检查当前网址及相关页面元素，例如登录框和收藏标签；这些识别数据不上传给开发者。
- `storage` 用于保存本地设置和浏览器会话状态；`alarms` 用于计时到期处理。
- `declarativeNetRequestWithHostAccess` 让浏览器按规则将首页导航转到纯净入口，并在设定时段临时放行原站首页。首页重定向由浏览器规则执行；登录、收藏识别和到期处理还会使用内容脚本及后台逻辑。
- 卸载扩展会移除其浏览器存储；本地源码和你自己下载的 ZIP 需自行管理。

No analytics, ads, telemetry, or developer data uploads. Preferences and collection URLs are stored locally; pending searches and temporary deadlines use browser session storage. Search and sign-in visit the original platforms. Removing the extension removes its browser-managed data. Runtime code has no third-party libraries.

Host access is limited to the Bilibili and Xiaohongshu domains listed in the manifest. Content scripts inspect the current URL and relevant page elements, such as login forms and collection tabs, without uploading this recognition data to the developer. `storage` saves preferences and session state; `alarms` handles deadlines. `declarativeNetRequestWithHostAccess` applies browser rules for home-page redirects and temporary access; content scripts and background logic also handle login, collections and expiry.
