# Agent小黄书｜GitHub Pages 搜索收录配置

网站已围绕核心关键词 **Agent小黄书** 配置了页面标题、中文描述、关键词、Open Graph、Twitter 卡片、`WebSite` / `Article` 结构化数据、`robots.txt` 与站点地图。

## 部署前必须更新

请打开 `client/public/sitemap.xml`，将下列占位地址替换为你的真实 GitHub Pages 地址：

```xml
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/
```

如果绑定了自定义域名，请直接使用自定义域名首页地址。完成替换后重新提交并部署。

## 提交收录

部署完成后，在 Google Search Console 与 Bing Webmaster Tools 添加并验证站点。随后分别提交：

```text
https://你的站点域名/sitemap.xml
```

搜索引擎收录时间由其抓取周期决定，站点地图和结构化数据可以帮助发现页面，但不能保证立即排名或收录。后续应持续补充与 “Agent小黄书” 相关的原创章节、外部链接和更新频率。
