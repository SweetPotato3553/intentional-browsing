# 上传 GitHub 与发布 1.0.0

这是给仓库维护者的操作说明。公开仓库已发布：https://github.com/SweetPotato3553/intentional-browsing 。以下保留后续发布时的操作说明。

## 建议的仓库信息

- README 主标题：`intentional-browsing`；中文副标题：不入流｜B站 / 小红书首页去推荐插件。英文 README 标题为「Intentional Browsing: Skip the Feed, Go Straight to Search」。仓库名保持 `intentional-browsing`。
- About：`不入流｜B站 / 小红书首页去推荐插件。跳过首页推荐流，直达搜索和自己的收藏夹。`
- Topics：`browser-extension`、`chrome-extension`、`edge-extension`、`bilibili`、`xiaohongshu`、`focus`。
- 许可证已采用 MIT；版权署名使用项目集体名称 Still contributors，没有填写私人姓名或邮箱。

## 最简单的网页上传

1. 在 GitHub 新建一个公开仓库。不要额外勾选初始化 README、许可证或 .gitignore，当前目录已经提供。
2. 上传本目录**里面的内容**，让 README.md、LICENSE、extension 和 docs 位于仓库根目录。
3. 网页上传时要确认 `.github`、`.gitignore`、`.gitattributes`、`.editorconfig` 等隐藏项目配置也上传了。若浏览器没有包含它们，可用 Git 客户端完整提交。
4. 确认仓库首页能显示 README 和三张风格截图。

不要上传这个目录的外层「知止Still」、previous version、940 特别版，或者整个旧工作区的 Git 历史。此目录没有携带旧仓库的 .git。

## 使用 Git 客户端

在本目录初始化一个新的本地仓库，提交当前文件，再通过 GitHub Desktop 发布；或按新建仓库页面显示的命令添加你自己的远程地址并推送。远程地址需要使用你实际创建的仓库，不要使用示例账号。

## 发布正式安装包

[v1.0.0 Release](https://github.com/SweetPotato3553/intentional-browsing/releases/tag/v1.0.0) 已发布，包含安装 ZIP、源码 ZIP 和校验文件。后续发布可参考以下步骤：在 GitHub 仓库的 Releases 创建对应版本标签，标题可用「不入流 v1.0.0｜B站 / 小红书首页去推荐插件」。附加本次整理后构建的 `intentional-browsing-chromium-1.0.0.zip`，它补充了 MIT 许可证和公开文档，运行时代码与原正式版逐文件一致。本次交付的发布附件在源码目录旁的 `github-release-1.0.0` 文件夹中；之后自行构建则在 `dist` 中。

还可以附加源码包和同目录的 SHA256SUMS.txt，方便下载者校验。不要把 940 特别版、整个旧工作区或浏览器数据附到 Release。

首次上传源码时不要上传 dist、node_modules 或本地缓存；安装 ZIP 作为 Release 附件单独上传。

发布正文可以复制：

> 首个正式版。支持 B站和小红书网页版的纯净首页、关键词搜索、收藏夹快捷入口、限时放行，以及知止 / 你学不学 / 同桌三种风格。电脑 Chrome / Edge 手动加载使用。下载下方 chromium 安装包，解压后加载里面的 extension 文件夹。完整安装方法见仓库 README。

1.0.0 的 86 个场景为模拟站点验证，真实扫码和验证码仍需本人操作。整理后的源码使用同一套运行时代码，并补充公开文档与 MIT 许可证。分发时请保留 LICENSE。

原正式版 ZIP 保持原样。本次 GitHub 发行包因新增文档和许可证，整体哈希与原包不同，应使用本次附件的 SHA256SUMS.txt。

GitHub 官方说明：[管理 Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[为仓库选择许可证](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。
