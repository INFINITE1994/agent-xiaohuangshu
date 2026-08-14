import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthorWorkbench from "./pages/AuthorWorkbench";
import Home from "./pages/Home";

/**
 * 橙皮工作台：静态内容阅读与作者管理均从单页主页进入。
 * 相对构建路径用于 GitHub Pages；生产环境从入口脚本推导仓库子路径。
 */
function getStaticRouterBase() {
  const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (configuredBase && configuredBase !== ".") return configuredBase;

  if (typeof document === "undefined") return "";
  const entryScript = Array.from(document.scripts).find(({ src }) => src.includes("/assets/"));
  if (!entryScript) return "";

  const pathname = new URL(entryScript.src).pathname;
  const assetsIndex = pathname.indexOf("/assets/");
  return assetsIndex > 0 ? pathname.slice(0, assetsIndex) : "";
}

/**
 * GitHub Pages 的静态 404 页面会将深链接编码为 ?route=... 回到站点根目录。
 * 此组件在 Wouter 基路径内部恢复路由，因此 /<仓库名>/author 的直接访问与刷新均可进入受保护页面。
 */
function StaticRouteRecovery() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const pendingRoute = new URLSearchParams(window.location.search).get("route");
    if (!pendingRoute) return;
    const target = pendingRoute.startsWith("/") ? pendingRoute : `/${pendingRoute}`;
    setLocation(target, { replace: true });
  }, [setLocation]);

  return null;
}

function ApplicationRoutes() {
  const base = getStaticRouterBase();
  return (
    <WouterRouter base={base}>
      <StaticRouteRecovery />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/author"} component={AuthorWorkbench} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <ApplicationRoutes />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
