import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
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
import PrototipoCarrossel from "./pages/PrototipoCarrossel";
import Analytics from "./pages/Analytics";
import CalendarPage from "./pages/Calendar";
import BrandKit from "./pages/BrandKit";
import Reels from "./pages/Reels";
import CommentAutomations from "./pages/CommentAutomations";
import StyleAnalyzer from "./pages/StyleAnalyzer";
import Radar from "./pages/Radar";
import Seo from "./pages/Seo";
import AdminPanel from "./pages/AdminPanel";
import Stories from "./pages/Stories";
import Resize from "./pages/Resize";
import Campaign from "./pages/Campaign";
import Report from "./pages/Report";
import EmailMarketing from "./pages/EmailMarketing";
import Onboarding from "./pages/Onboarding";
import ArtStudio from "./pages/ArtStudio";
import Approve from "./pages/Approve";
import Team from "./pages/Team";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/chat" component={Chat} />
      <Route path="/dashboard/images" component={Images} />
      <Route path="/dashboard/videos" component={Videos} />
      <Route path="/dashboard/articles" component={Articles} />
      <Route path="/dashboard/carousel" component={PrototipoCarrossel} />
      <Route path="/dashboard/prototipo" component={PrototipoCarrossel} />
      <Route path="/dashboard/analytics" component={Analytics} />
      <Route path="/dashboard/posts" component={Posts} />
      <Route path="/dashboard/calendar" component={CalendarPage} />
      <Route path="/dashboard/brand" component={BrandKit} />
      <Route path="/dashboard/reels" component={Reels} />
      <Route path="/dashboard/settings" component={Settings} />
      <Route path="/dashboard/comment-automations" component={CommentAutomations} />
      <Route path="/dashboard/style-analyzer" component={StyleAnalyzer} />
      <Route path="/dashboard/radar" component={Radar} />
      <Route path="/dashboard/seo" component={Seo} />
      <Route path="/dashboard/stories" component={Stories} />
      <Route path="/dashboard/resize" component={Resize} />
      <Route path="/dashboard/campaign" component={Campaign} />
      <Route path="/dashboard/report" component={Report} />
      <Route path="/dashboard/email-marketing" component={EmailMarketing} />
      <Route path="/dashboard/onboarding" component={Onboarding} />
      <Route path="/dashboard/artes" component={ArtStudio} />
      <Route path="/dashboard/team" component={Team} />
      <Route path="/aprovar/:token" component={Approve} />
      <Route path="/admin" component={AdminPanel} />
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
          <Router base="/app">
            <AppRoutes />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
