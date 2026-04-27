import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Holdings from "./pages/Holdings";
import BuySell from "./pages/BuySell";
import BuySellDetails from "./pages/BuySellDetails";
import Watchlist from "./pages/Watchlist";
import RiskAnalysis from "./pages/RiskAnalysis";
import Transactions from "./pages/Transactions";
import AIAssistant from "./pages/AIAssistant";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"}>
        {() => (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/holdings"}>
        {() => (
          <DashboardLayout>
            <Holdings />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/buy-sell"}>
        {() => (
          <DashboardLayout>
            <BuySell />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/buy-sell/:assetId"}>
        {() => (
          <DashboardLayout>
            <BuySellDetails />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/watchlist"}>
        {() => (
          <DashboardLayout>
            <Watchlist />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/risk-analysis"}>
        {() => (
          <DashboardLayout>
            <RiskAnalysis />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/transactions"}>
        {() => (
          <DashboardLayout>
            <Transactions />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/ai-assistant"}>
        {() => (
          <DashboardLayout>
            <AIAssistant />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
