# GitHub Pages 部署说明

本项目为纯前端静态站点。内容编辑快照以 AES-GCM 加密后保存在浏览器本地，PDF 导出在浏览器端完成，因此不需要服务器或数据库，适合部署至 GitHub Pages。

## 一次性发布流程

1. 在 GitHub 创建一个空仓库，并将本项目代码推送至 `main` 分支。
2. 在仓库根目录运行以下命令生成适配项目子路径的静态资源：

   ```bash
   pnpm install
   SITE_URL=https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/ pnpm run build:pages
   ```

3. 在 GitHub 仓库依次打开 **Settings → Pages**，在 **Build and deployment** 中选择 **GitHub Actions**。
4. 提交下方工作流文件至 `.github/workflows/deploy-pages.yml`。之后每次推送到 `main` 都会自动构建并发布。

> 如果使用 GitHub 的传统「从分支部署」方式，请以 `SITE_URL` 指向最终公开地址后运行 `pnpm run build:pages`，再将生成的 `dist/public` 目录发布为 Pages 站点目录。

> GitHub Actions 会自动根据仓库名称生成正确的默认 Pages 地址，同时写入生产产物的 `sitemap.xml`、`robots.txt`、canonical URL 与 Open Graph 图片地址。该相对构建方式支持 `<用户名>.github.io` 根路径站点及 `/<仓库名>/` 项目子路径站点；应用会在生产环境从入口资源地址识别项目子路径，无需将仓库名称写入源码。

## 图片资源检查

书封图与品牌图已纳入 `client/public/offline-assets/`。提交仓库前请确认该目录至少包含 `agent-book-hero.webp` 与 `agent-book-mark.webp`；构建后它们会自动复制到 `dist/public/offline-assets/`，不依赖 Manus 专属资源路径。

## 数据保存说明

| 能力 | 实现方式 | 说明 |
| --- | --- | --- |
| 新增、编辑、删除内容 | AES-GCM 加密浏览器本地快照 | 数据仅保存在编辑所用的浏览器与设备中；刷新和退出管理模式后仍会保留。 |
| 导出 PDF | 浏览器端生成 | 点击「导出 PDF」即可下载当前显示内容。 |
| 跨设备同步 | 不包含 | 如需要多人协作或跨设备同步，需要接入带认证的后端与数据库。 |

> 作者访问码与加密快照用于静态站点中的本地访问控制和本地防窥保护，不构成服务端权限系统。请勿将需要服务器级保密的数据发布进纯静态网站。

## GitHub Actions 工作流

```yaml
name: Deploy static site to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:pages
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
