import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
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

function ApplicationRoutes() {
  const base = getStaticRouterBase();
  return (
    <WouterRouter base={base}>
      <Switch>
        <Route path={"/"} component={Home} />
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
