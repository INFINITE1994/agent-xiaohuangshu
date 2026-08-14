/** 静态站点资源工具：所有运行时资源均遵循 Vite BASE_URL，兼容 GitHub Pages 项目子路径。 */
export const staticAssetUrl = (fileName: string) => `${import.meta.env.BASE_URL}offline-assets/${fileName}`;
