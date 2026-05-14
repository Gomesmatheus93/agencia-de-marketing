import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Images from "./pages/Images";
import Videos from "./pages/Videos";
import Articles from "./pages/Articles";
import Posts from "./pages/Posts";
import Settings from "./pages/Settings";
import Carousel from "./pages/Carousel";
import PrototipoCarrossel from "./pages/PrototipoCarrossel";
import Analytics from "./pages/Analytics";

const CarouselPage = () => <Carousel />;

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/chat" component={Chat} />
      <Route path="/dashboard/images" component={Images} />
      <Route path="/dashboard/videos" component={Videos} />
      <Route path="/dashboard/articles" component={Articles} />
      <Route path="/dashboard/carousel" component={CarouselPage} />
      <Route path="/dashboard/prototipo" component={PrototipoCarrossel} />
      <Route path="/dashboard/analytics" component={Analytics} />
      <Route path="/dashboard/posts" component={Posts} />
      <Route path="/dashboard/settings" component={Settings} />
<Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
