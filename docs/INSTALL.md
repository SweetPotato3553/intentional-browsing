# 安装与更新

[返回首页](../README.md)

## 支持什么

电脑端 Chrome / Edge，B站与小红书网页版。要求 Chromium 120 或以上，已在 Windows Edge 上完成模拟站点自动化验证。其他满足最低版本的 Chromium 浏览器预计兼容，欢迎反馈兼容性问题。手机里的 B站 / 小红书 App 不适用。

## 方式一：下载正式安装包

1. 打开 [v1.0.0 下载页](https://github.com/SweetPotato3553/intentional-browsing/releases/tag/v1.0.0)。
2. 在 Assets 下载 [intentional-browsing-chromium-1.0.0.zip](https://github.com/SweetPotato3553/intentional-browsing/releases/download/v1.0.0/intentional-browsing-chromium-1.0.0.zip)。普通使用者不需要下载带 `source` 的开发包。
3. 解压到固定位置，例如自己新建的插件文件夹。

正确的加载层级：

```text
解压后的文件夹/
├── extension/          ← 加载这个文件夹
│   ├── manifest.json
│   ├── background.js
│   └── ...
└── README.md
```

## 方式二：直接下载源码

在仓库点 **Code → Download ZIP**，解压后也能找到 `extension` 文件夹。加载这个文件夹即可，无需安装 Node.js、Python 或运行构建。

熟悉 Git 的使用者也可 clone 本仓库，再手动加载其中的 `extension`。`git clone` 只是下载源码，并不会把扩展自动安装到浏览器；普通使用者按 ZIP 方法操作即可。

## 在浏览器加载

| 浏览器 | 地址栏输入 | 操作 |
| --- | --- | --- |
| Chrome | `chrome://extensions` | 打开开发者模式 → 加载已解压的扩展程序 |
| Edge | `edge://extensions` | 打开开发人员模式 → 加载解压缩的扩展 |

不同版本的中文按钮文字可能略有差异。选择含 `manifest.json` 的 `extension` 文件夹，然后刷新已打开的 B站 / 小红书页面，访问首页。

可以在浏览器扩展菜单中固定图标，之后从工具栏切换风格。安装文件夹需要一直保留，不要装好就删，也不要直接加载 ZIP 文件。

## 更新并保留设置

1. 下载新版并解压。
2. 把新版 `extension` 内文件覆盖到**原来正在加载的同一目录**。
3. 回扩展管理页，在原扩展卡片点击「重新加载」。
4. 刷新 B站 / 小红书标签页。

同一路径、同一个扩展的本地收藏和设置会保留。加载不同目录可能成为另一份扩展，设置不会自动跨扩展复制。只启用一份同类首页接管扩展。

## 停用 / 卸载

在扩展管理页关闭开关，刷新网站即可恢复原站行为。卸载扩展会移除其浏览器存储；重新安装前请自行保留需要的收藏地址或留言。

## 装不上时

- 提示找不到清单：选择里面的 `extension`，不要选外层文件夹。
- 首页没有变化：确认扩展已启用，允许访问对应网站，然后刷新；避免多个首页插件同时运行。
- 出现开发者模式提示：本项目目前采用手动加载方式，没有声称已上架浏览器商店。
- 想提交问题：先看 [常见问题](USAGE.md)，再附浏览器版本和复现步骤提交 Issue。
