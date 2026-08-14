# Agent小黄书｜SOLID 与 GitHub Pages 审计

审计日期：2026-08-14。审计范围为 React 前端、作者内容持久化、静态资源、Vite 构建与 GitHub Pages 工作流。

## 结论

当前项目可以作为纯静态网站部署到 GitHub Pages。工作流使用 `pnpm exec vite build --base=./`，产物目录与上传目录均为 `dist/public`。书封与品牌图片已纳入仓库的 `client/public/offline-assets/`，运行时和 SEO 不再依赖 Manus 专属资源路径。2026-08-14 的复审确认：根路径站点和 `/<仓库名>/` 项目子路径站点均能进入主页。

| 原则 | 审计结论 | 本次处理 |
|---|---|---|
| 单一职责原则 | 首页仍负责编排阅读、编辑和导出流程，但会话密钥存储不应继续耦合在页面组件内。 | 将 IndexedDB 的作者会话密钥读写抽离到 `client/src/lib/author-session-key-store.ts`。 |
| 开放封闭原则 | 图片路径不应散落在 JSX 中，也不应绑定某个托管环境。 | 新增 `client/src/lib/assets.ts`，通过 `import.meta.env.BASE_URL` 统一生成静态资源路径。 |
| 里氏替换原则 | 项目没有继承层次，页面组件与数据模型均采用组合方式。 | 无阻塞问题。 |
| 接口隔离原则 | 作者会话模块只暴露保存、读取和清除三个最小接口。 | 页面不再接触 IndexedDB 事务细节。 |
| 依赖倒置原则 | 页面通过资产与会话存储模块的稳定接口协作，而非直接依赖具体资源地址和 IndexedDB 实现。 | 保留页面作为交互编排层；后续可继续拆分 PDF 导出和编辑器状态。 |

## GitHub Pages 验证

| 检查项 | 结果 |
|---|---|
| 类型检查 | `pnpm run check` 通过。 |
| GitHub Pages 构建 | `pnpm exec vite build --base=./` 通过。 |
| 构建产物图片 | `dist/public/offline-assets/agent-book-hero.webp` 与 `agent-book-mark.webp` 均存在，扩展名与实际 WebP 编码一致。 |
| Manus 专属资源路径 | 构建产物中无 `/manus-storage/` 引用。 |
| 根路径静态预览 | 首页、书封图和品牌图均返回 HTTP 200；作者编辑、刷新、退出管理模式后再次刷新均能恢复已保存内容。 |
| 项目子路径静态预览 | 在模拟 `/<仓库名>/` 的静态服务器中，主页、打包脚本、书封图和品牌图均返回 HTTP 200；作者编辑、刷新、退出管理模式后再次刷新均能恢复已保存内容。 |
| 项目子路径路由 | 应用从入口脚本的 `assets` 路径识别 GitHub Pages 子路径并传递给 Wouter，避免项目仓库部署时被识别为 404。 |
| 生产调试请求 | 预览日志采集器仅在开发服务器启用；GitHub Pages 构建不再输出 `/__manus__/debug-collector.js` 请求。 |
| 发布工作流 | `.github/workflows/deploy-pages.yml` 在 `main` 分支推送时构建并发布 `dist/public`。 |

## 部署边界

网站当前为单页静态阅读站，既支持 GitHub Pages 根路径，也支持项目仓库子路径。作者的本地编辑内容使用加密的 `localStorage` 快照与 `IndexedDB` 中的会话密钥保存，不会同步到 Git 仓库或其他设备；这是纯静态模式下的预期行为。访问码和本地加密不应被视作替代服务端认证与权限系统。

## 后续建议

后续可将 `Home.tsx` 的 PDF 导出、内容编辑器和目录导航继续拆分为独立模块，以进一步降低页面组件复杂度。若需要跨浏览器或跨设备同步作者内容，则应升级为具备后端与身份认证的应用。
