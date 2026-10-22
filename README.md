# XUE GAMES · 独立游戏官网

公开作品展示、开发手记、三种主题、背景音乐和自愿支持创作。

- 公开页面：GitHub Pages，在本仓库的 **Settings → Pages** 查看网址。
- 内容管理：https://xue-games-studio.xxhhxpg.chatgpt.site/admin

## 如何更新

1. 在管理后台编辑作品、手记、音乐或捐赠通道，点击“保存并发布”。
2. 本仓库每 30 分钟检查一次已公开内容，包含你上传的封面、音频与二维码。有变化才重新发布。GitHub 可能延迟执行任务。
3. 想立即更新：打开 **Actions → Publish website → Run workflow**。
4. 页面样式与交互代码在 `public/` 中，提交到 `main` 后会触发发布。

后台仍由原来的 Sites 服务运行，登录与编辑权限保持不变。GitHub Pages 只展示公开内容，访客无需登录 ChatGPT。未公开的作品、文章、音乐及捐赠方式不会导出。图片和音频由构建流程复制到 Pages；你主动填写的外部 HTTPS 媒体链接会保持原样。

后台暂时不可用时，构建失败并保留已发布的网站，不会用旧示例覆盖内容。`content/site.json` 是首次迁移的公开快照，仅用于离线预览，不包含后台草稿。

## 本地构建

使用 Node.js 22 或更高版本，不需要安装依赖。

```sh
node scripts/build-pages.mjs
# 网络不可用时，使用首次迁移的快照检查页面：
node scripts/build-pages.mjs --offline
```

输出在 `dist/`。服务器代码、管理页和密码不会部署到 Pages。原始后台文件保留在 `public/admin.*` 供维护时参考。

GitHub 的公开仓库定时任务可能因长期没有仓库活动而停用；若同步停下，可在 Actions 页面重新启用并手动运行。网站现有公开版本仍会保留。

## 捐赠

后台“捐赠设置”可上传自己的微信 / 支付宝收款二维码或填写赞助页链接。配置并公开后才显示可用收款入口。请核对收款方后发布。

## 学习资源库

首页保留原有导航、作品展示与样式，仅在开发手记下方增加学习入口模块，点击打开 `learning.html`。14 项资源与完整练习指南在站内阅读，支持搜索、分类、三个主题及手机布局；无需 JavaScript 也能展开全部指南。定制工具入口未提供，页面标注待补充。

维护 `content/learning-resources.json` 后运行 `node scripts/build-learning.mjs` 更新生成的 `public/learning.html`；常规构建也会自动生成。CSS 与交互分别位于 `public/learning.css`、`public/learning.js`。网站数据独立保存在本仓库，不依赖另一仓库的本地路径。

首页入口使用独立的 `public/home-learning.css`，所有规则限定在 `.home-learning` 模块内；资源库整页样式只在 `learning.html` 加载。
