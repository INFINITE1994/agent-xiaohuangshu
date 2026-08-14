# Agent小黄书

> 面向零基础学习者的 AI 智能体实践指南，以及一套可持续维护、公开发布的中文教程网站。

[在线阅读](https://infinite1994.github.io/agent-xiaohuangshu/) · [作者工作台](https://infinite1994.github.io/agent-xiaohuangshu/author) · [云端同步部署说明](./RENDER_SYNC_DEPLOY.md)

## 教程定位

**Agent小黄书**不是单一工具的操作手册，而是一条从理解 AI 智能体、完成环境配置、掌握开发工作流，到形成可交付能力与变现路径的学习路线。教程保持中文语境、可执行步骤和持续修订的出版物形式，适合第一次接触 AI Agent 的学习者，也适合希望整理实践方法的开发者与内容创作者。

全书目前包含 **33 个内容单元**与 **8 个篇章及附录**。读者可以在线阅读、复制代码与表格、导出当前章节或整本教程；作者可以在独立工作台中维护内容并发布给所有访客。

## 内容地图

| 模块 | 学习重点 | 覆盖内容 |
| --- | --- | --- |
| 前言与准备 | 建立学习路径与最短上手路线 | 教程使用方式、30 分钟安装第一个智能体 |
| 第一篇：认识智能体 | 理解概念与工具格局 | 智能体原理、AI 编程工具演进、2026 格局速览 |
| 第二篇：安装与配置 | 完成基础环境 | API Key、Claude Code、Codex、Hermes、Ollama |
| 第三篇：Skill 完全指南 | 建立可复用能力单元 | Skill 标准、生态、筛选、编写与完整文件组织 |
| 第四篇：开发流程与标准工作流 | 把任务转化为可交付成果 | 需求、开发、联调、测试、上线、复盘与提示词模板 |
| 第五篇：变现指南 | 把能力转化为实践路径 | 变现逻辑、路径选择、起步路线与避坑 |
| 第六篇：安全与合规 | 建立必要边界 | 权限控制、安全铁律、法律红线与合规速查 |
| 附录与资源 | 随时查阅与落地 | 命令、工具资源、报错、费用模型与术语表 |

教程原稿位于 [`source/agent-xiaohuangshu.md`](./source/agent-xiaohuangshu.md)。站点内置内容数据位于 `client/src/data/tutorial.ts`；日常修订建议通过线上作者工作台完成。

## 项目能力

该项目将教程作为一个可以长期修订的公开知识库，而非一次性静态页面。阅读端以清晰的目录、章节阅读、代码和表格复制、章节/整本导出为主；作者端使用受保护的 `/author` 工作台完成章节检索、富文本 Markdown 编辑、实时预览、图片素材维护与发布。

| 领域 | 实现方式 |
| --- | --- |
| 内容阅读 | Markdown 渲染、目录导航、章节阅读、代码/引用/表格复制与 PDF/Markdown 导出 |
| 作者维护 | 独立工作台、章节新增/编辑/删除、排版工具栏、实时预览、图片库与发布流程 |
| 内容安全 | 本地模式采用 AES-GCM 加密快照与 IndexedDB 会话密钥；云端模式采用短期作者会话令牌 |
| 跨设备发布 | 作者通过 Render API 发布完整内容快照，访客从 SQLPub MySQL 读取已发布版本 |
| 搜索发现 | 页面元数据、JSON-LD、robots.txt、XML sitemap 与 GitHub Pages 规范 URL 生成 |

## 技术架构

前端使用 **React 19、TypeScript、Vite 7、Tailwind CSS 4 与 shadcn/ui**。教程正文由 `marked` 渲染，并在展示前使用 DOMPurify 清理；路由使用 Wouter，并支持 GitHub Pages 的项目子路径。

生产环境采用“静态阅读站 + 受控同步 API”的分层架构：GitHub Pages 负责公开访问与静态资源，Render 托管 Node/Express 同步服务，SQLPub MySQL 保存已发布教程与图片二进制数据。数据库凭据仅保存在 Render 环境变量中，不会进入 Git 仓库或浏览器端代码。

```text
公开读者
    │
    ▼
GitHub Pages（React 阅读站）
    │  读取已发布教程与图片
    ▼
Render Node / Express API
    │
    ▼
SQLPub MySQL（内容快照、图片）

作者
    │
    ▼
/author 独立工作台 ── 发布 ──► Render API
```

## 项目结构

```text
client/
  src/pages/              阅读页与作者工作台
  src/data/tutorial.ts    站点内置教程数据
  src/lib/                Markdown、导出、加密、云端同步与图片处理模块
  public/offline-assets/  书封与品牌静态资源
server/
  sync-api.mjs            Render 同步 API
  sql/                    SQLPub 初始化脚本
source/
  agent-xiaohuangshu.md   教程原稿
scripts/
  prepare-github-pages.mjs  Pages 规范 URL、robots 与 sitemap 生成
```

## 本地运行

本项目使用 Node.js 22 与 pnpm 10。安装依赖后，可按以下命令启动、检查和构建。

```bash
pnpm install
pnpm run dev
pnpm run check
pnpm run build:pages
```

`pnpm run dev` 启动本地阅读站；`pnpm run check` 执行 TypeScript 检查；`pnpm run build:pages` 会生成兼容 GitHub Pages 项目子路径的生产产物，并同步生成 `robots.txt`、`sitemap.xml` 与规范 URL。

若需要本地运行云端同步 API，请先配置数据库环境变量，再执行：

```bash
pnpm run start:sync-api
```

详细的 Render、SQLPub 与 GitHub Actions 变量配置见 [云端同步部署说明](./RENDER_SYNC_DEPLOY.md)。

## 部署方式

推送到 `main` 分支后，GitHub Actions 会自动构建并发布至 GitHub Pages。公开前端使用 `CONTENT_API_URL` 变量连接 Render 服务；未设置该变量时，网站仍能以仓库内置教程运行，但作者修改只会保存在当前浏览器的加密本地快照中。

部署到 Render 时，请使用仓库根目录的 [`render.yaml`](./render.yaml)。`DB_PASSWORD`、`AUTHOR_SESSION_SECRET` 与作者访问控制相关配置必须仅保存在 Render 环境变量中，不能提交到仓库。

## 维护原则

教程正文应保持可验证、可执行与面向初学者的写作方式。技术实现遵循公开阅读优先、作者操作受控、密钥不进入前端、内容发布可回溯的原则。提交代码时，应保留与产品和运行有关的说明，避免将临时任务、内部审计、设计过程或调试记录加入公开仓库。

## 许可

项目代码采用 MIT 许可；教程内容的使用与转载请遵循作者声明。
