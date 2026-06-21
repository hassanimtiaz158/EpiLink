import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import RadarGraphic from "@/components/landing/RadarGraphic";

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

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

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
    <div className="dark">
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1a] px-4 py-10 text-white">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <RadarGraphic />

        <div className="mt-8 text-center">
          <h1 className="text-5xl font-bold tracking-tight">
            Epi<span className="text-sky-400">Link</span>
          </h1>
          <p className="mt-3 text-[11px] uppercase tracking-[0.35em] text-white/35">
            Global Disease Surveillance
          </p>
          <p className="mt-5 text-sm text-white/25">
            CLINIC{" "}
            <span className="text-sky-400/60">&rarr;</span>{" "}
            AI{" "}
            <span className="text-sky-400/60">&rarr;</span>{" "}
            WHO{" "}
            <span className="text-sky-400/60">&rarr;</span>{" "}
            IN SECONDS
          </p>
        </div>

        <div className="mt-8 flex gap-14 text-center">
          <div>
            <div className="text-2xl font-bold text-sky-400">44</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-widest text-white/30">
              Diseases Tracked
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">60s</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-widest text-white/30">
              Alert Window
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">&check;</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-widest text-white/30">
              Human Final Call
            </div>
          </div>
        </div>

        <div className="mt-10 w-full max-w-sm">
          <div className="mb-4 flex rounded-lg bg-white/5 p-1">
            <button
              onClick={() => {
                setMode("login");
                setSignupError("");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
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
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="login-email" className="text-white/60">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="admin@epilink.gov.eg"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setLoginError("");
                    }}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-sky-500/50"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="login-password" className="text-white/60">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError("");
                    }}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-sky-500/50"
                    required
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-red-400">{loginError}</p>
                )}
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="bg-sky-500 text-white hover:bg-sky-600"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {loginLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="signup-name" className="text-white/60">
                    Full Name
                  </Label>
                  <Input
                    id="signup-name"
                    placeholder="Dr. Ahmed Hassan"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-sky-500/50"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="signup-email" className="text-white/60">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@epilink.gov.eg"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-sky-500/50"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="signup-password" className="text-white/60">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-sky-500/50"
                    minLength={6}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="signup-role" className="text-white/60">
                    Role
                  </Label>
                  <select
                    id="signup-role"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="epi_officer">Epi Officer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {signupError && (
                  <p className="text-sm text-red-400">{signupError}</p>
                )}
                <Button
                  type="submit"
                  disabled={signupLoading}
                  className="bg-sky-500 text-white hover:bg-sky-600"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {signupLoading ? "Creating..." : "Create Account"}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-white/20">
            Default: admin@epilink.gov.eg / admin123
          </p>
        </div>

        <div className="mt-10 flex w-full max-w-sm justify-between text-[9px] uppercase tracking-widest text-white/15">
          <span>ICD-10 MAPPED</span>
          <span>&lt;20s AI</span>
        </div>
      </div>
    </div>
  );
}
