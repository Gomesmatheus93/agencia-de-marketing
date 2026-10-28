import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Login from "./pages/Login";
import Dashboard from "./pages/OperationalDashboard";
import Chat from "./pages/Chat";
import Images from "./pages/Images";
import Videos from "./pages/Videos";
import Articles from "./pages/Articles";
import Posts from "./pages/Posts";
import Settings from "./pages/Settings";
import PrototipoCarrossel from "./pages/PrototipoCarrossel";
import Analytics from "./pages/Analytics";
import CalendarPage from "./pages/Calendar";
import Reels from "./pages/Reels";
import CommentAutomations from "./pages/CommentAutomations";
import AdminPanel from "./pages/AdminPanel";
import Stories from "./pages/Stories";
import Resize from "./pages/Resize";
import Report from "./pages/Report";
import Onboarding from "./pages/Onboarding";
import ArtStudio from "./pages/ArtStudio";
import Approve from "./pages/Approve";
import Team from "./pages/Team";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AccountSecurity from "./pages/AccountSecurity";
import CreativeStudio from "./pages/CreativeStudio";
import Agents from "./pages/Agents";
import AgentOffice from "./pages/AgentOffice";
import Planning from "./pages/Planning";
import AuditPage from "./pages/Audit";
import Brand from "./pages/Brand";
import { CreateCarousel, CreatePost, CreateStories, CreateVideoAgent } from "./pages/CreateWithAgent";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Login} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/chat" component={Chat} />
      <Route path="/dashboard/studio" component={CreativeStudio} />
      <Route path="/escritorio" component={AgentOffice} />
      <Route path="/dashboard/planejamento" component={Planning} />
      <Route path="/dashboard/auditoria" component={AuditPage} />
      <Route path="/dashboard/marca" component={Brand} />
      <Route path="/dashboard/criar/carrossel" component={CreateCarousel} />
      <Route path="/dashboard/criar/post" component={CreatePost} />
      <Route path="/dashboard/criar/video" component={CreateVideoAgent} />
      <Route path="/dashboard/criar/stories" component={CreateStories} />
      <Route path="/dashboard/agents" component={Agents} />
      <Route path="/dashboard/agents/:slug" component={Agents} />
      <Route path="/dashboard/images" component={Images} />
      <Route path="/dashboard/videos" component={Videos} />
      <Route path="/dashboard/articles" component={Articles} />
      <Route path="/dashboard/carousel" component={PrototipoCarrossel} />
      <Route path="/dashboard/prototipo" component={PrototipoCarrossel} />
      <Route path="/dashboard/analytics" component={Analytics} />
      <Route path="/dashboard/posts" component={Posts} />
      <Route path="/dashboard/calendar" component={CalendarPage} />
      <Route path="/dashboard/reels" component={Reels} />
      <Route path="/dashboard/settings" component={Settings} />
      <Route path="/dashboard/comment-automations" component={CommentAutomations} />
      <Route path="/dashboard/stories" component={Stories} />
      <Route path="/dashboard/resize" component={Resize} />
      <Route path="/dashboard/report" component={Report} />
      <Route path="/dashboard/onboarding" component={Onboarding} />
      <Route path="/dashboard/artes" component={ArtStudio} />
      <Route path="/dashboard/team" component={Team} />
      <Route path="/dashboard/security" component={AccountSecurity} />
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
