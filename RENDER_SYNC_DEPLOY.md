# Render + SQLPub 内容同步部署

本项目保留 GitHub Pages 作为公开阅读前端，并将作者发布接口部署到 Render。SQLPub 的 MySQL 密码只存放在 Render 的环境变量中，绝不写入 GitHub 仓库或 GitHub Pages 前端。

## Render API 部署

在 Render 创建 **Web Service** 并连接同一个 GitHub 仓库。Render 会识别仓库根目录的 `render.yaml`；若手动填写，请使用构建命令 `pnpm install --frozen-lockfile`、启动命令 `pnpm run start:sync-api` 和健康检查路径 `/health`。

在 Render 的 **Environment** 页面配置下表中的变量。数据库密码请直接在 Render 页面输入，不要通过聊天、GitHub 提交或 `.env` 文件分享。

| 变量 | 值 |
| --- | --- |
| `DB_HOST` | SQLPub 控制台显示的公网数据库主机 |
| `DB_PORT` | SQLPub 控制台显示的端口 |
| `DB_NAME` | SQLPub 控制台显示的数据库名称 |
| `DB_USER` | SQLPub 控制台显示的数据库账号 |
| `DB_PASSWORD` | SQLPub 控制台显示的密码，仅在 Render 配置 |
| `AUTHOR_ACCESS_HASH` | 当前项目 `client/src/lib/private-content.ts` 中的作者访问码 SHA-256 哈希值 |
| `AUTHOR_SESSION_SECRET` | 保留 `render.yaml` 自动生成值，或在 Render 生成一段随机密钥 |
| `ALLOWED_ORIGINS` | 最终 GitHub Pages 地址，例如 `https://YOUR_GITHUB_USERNAME.github.io` |

Render 发布成功后，访问 `https://YOUR_RENDER_SERVICE.onrender.com/health`。返回 `{"status":"ok"}` 表示 API 和 SQLPub 已连通。首次启动时 API 会自动创建 `agent_content_publications` 与 `agent_content_images` 表；对应的手动 SQL 分别位于 `server/sql/001_agent_content_publications.sql` 和 `server/sql/002_agent_content_images.sql`。

## GitHub Pages 前端配置

在 GitHub 仓库打开 **Settings → Secrets and variables → Actions → Variables**，新建变量：

| 变量 | 值 |
| --- | --- |
| `CONTENT_API_URL` | Render 服务 URL，例如 `https://YOUR_RENDER_SERVICE.onrender.com` |

GitHub Pages 工作流会将该公开 API 地址作为 `VITE_CONTENT_API_URL` 写入构建。不要把数据库密码或作者访问码写入 GitHub Variables 或 Secrets；它们只由 Render API 使用。

完成后，作者解锁并保存章节时会发布到 SQLPub；所有访客刷新页面后都会读取同一份已发布内容。若 Render API 暂不可用，网站仍会展示仓库内置教程，避免公开阅读页面空白。

## 作者图片上传

作者工作台支持上传 **JPG、PNG、WebP** 并自动插入 Markdown 图像链接。每张图片限制为 **2.5 MB**；二进制文件保存在 SQLPub 的 `agent_content_images` 表中，只有通过作者会话的请求可以上传。公开阅读、章节 PDF 和整本 PDF 通过 `GET /v1/images/:imageId` 读取图片，不暴露数据库凭据。

上传图片后，仍需点击章节的“保存并发布”，该图片链接才会进入面向所有访客的公开内容版本。未保存章节前取消编辑不会删除已上传的图片，因此请只上传准备在手册中使用的文件。
