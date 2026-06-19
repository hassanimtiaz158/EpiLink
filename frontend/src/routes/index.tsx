import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, LogIn, Shield, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("epilink_token") : null;
    if (token) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "EpiLink — Disease Surveillance" },
      {
        name: "description",
        content: "Egypt Disease Surveillance System. Outbreak intelligence from clinician reports.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("viewer");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = (err as Error).message || "Invalid email or password";
      setLoginError(msg);
      toast.error("Login failed", { description: msg });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);
    try {
      await signup(signupEmail, signupPassword, signupName, signupRole);
      toast.success("Account created!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = (err as Error).message || "Signup failed";
      setSignupError(msg);
      toast.error("Signup failed", { description: msg });
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-sky-600 to-indigo-700 p-10 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-bold">EpiLink</div>
              <div className="text-[11px] uppercase tracking-widest text-white/70">
                Outbreak Intelligence
              </div>
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Disease Surveillance
            <br />
            for Egypt
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/80">
            From clinician report to global signal. Real-time outbreak detection, AI-powered
            analysis, and structured reporting for the Egypt DES.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-white/20 px-4 py-1.5">45 Notifiable Diseases</span>
            <span className="rounded-full bg-white/20 px-4 py-1.5">27 Governorates</span>
            <span className="rounded-full bg-white/20 px-4 py-1.5">AI-Powered OCR</span>
            <span className="rounded-full bg-white/20 px-4 py-1.5">Group A Alerts</span>
          </div>
        </div>
        <div className="text-sm text-white/50">
          &copy; {new Date().getFullYear()} EpiLink — Egypt DES
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">EpiLink</span>
        </div>

        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Tab toggle */}
          <div className="mb-6 flex rounded-lg bg-muted p-1">
            <button
              onClick={() => {
                setMode("login");
                setSignupError("");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setLoginError("");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {mode === "login" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" /> Welcome back
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="admin@epilink.gov.eg"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setLoginError("");
                      }}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter password"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError("");
                      }}
                      required
                    />
                  </div>
                  {loginError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
                  )}
                  <Button type="submit" disabled={loginLoading}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {loginLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-4 w-4" /> Create account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      placeholder="Dr. Ahmed Hassan"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@epilink.gov.eg"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min 6 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="signup-role">Role</Label>
                    <select
                      id="signup-role"
                      value={signupRole}
                      onChange={(e) => setSignupRole(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="epi_officer">Epi Officer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {signupError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{signupError}</p>
                  )}
                  <Button type="submit" disabled={signupLoading}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {signupLoading ? "Creating..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Default: admin@epilink.gov.eg / admin123
          </p>
        </div>
      </div>
    </div>
  );
}
