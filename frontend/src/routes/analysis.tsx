import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { analysisService } from "@/lib/api/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AnalysisOutput } from "@/lib/api/types";

export const Route = createFileRoute("/analysis")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("epilink_token") : null;
    if (!token) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "AI Analysis - EpiLink" },
      { name: "description", content: "AI-powered disease report analysis using Groq." },
    ],
  }),
  component: AnalysisPage,
});

const SEVERITY_BADGES: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  moderate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ALERT_BADGES: Record<string, string> = {
  NORMAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const SAMPLE_TEXTS = [
  "3 cases of acute diarrhea in children under 5, Cairo governorate, suspected cholera. Lab sample taken.",
  "Female, age 30-59, fever and rash since 3 days, Giza — suspected measles. Contact with confirmed case.",
  "Male patient with high fever, severe headache, joint pain. Travel history to Red Sea governorate. Suspected dengue.",
  "Animal bite wound infection in Minya. Patient presenting with fever, muscle spasms. Rabies suspected.",
  "Cluster of 5 respiratory illness cases in Alexandria. COVID-19 suspected. Two patients hospitalized.",
];

function AnalysisPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisOutput | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: (input: string) => analysisService.analyze(input),
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast.success("Analysis complete", { description: data.message });
      } else {
        toast.error("Analysis failed", { description: data.message });
      }
    },
    onError: (e) => toast.error("Analysis failed", { description: (e as Error).message }),
  });

  const handleSubmit = () => {
    if (!text.trim()) return;
    analyzeMutation.mutate(text);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Powered by Groq LLaMA 3. Paste clinical text for instant epidemiological assessment.
            </p>
          </div>
        </header>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-base">Clinical Text Input</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Paste clinical report, SMS, or case notes</Label>
              <textarea
                className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. 3 cases of acute diarrhea in Cairo, suspected cholera. Lab sample taken. Age group under 5."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSubmit} disabled={analyzeMutation.isPending || !text.trim()}>
                {analyzeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {analyzeMutation.isPending ? "Analyzing..." : "Run AI Analysis"}
              </Button>
              <span className="text-xs text-muted-foreground">or try a sample:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_TEXTS.map((s, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setText(s)}
                >
                  Sample {i + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {analyzeMutation.isPending && (
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-sm text-muted-foreground">
                Sending to Groq LLaMA 3.3-70B for analysis...
              </span>
            </CardContent>
          </Card>
        )}

        {result && result.success && (
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Classification Result
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge
                      className={cn("border text-[10px]", SEVERITY_BADGES[result.severity] ?? "")}
                    >
                      {result.severity.toUpperCase()}
                    </Badge>
                    <Badge
                      className={cn("border text-[10px]", ALERT_BADGES[result.alert_level] ?? "")}
                    >
                      {result.alert_level}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <InfoRow
                  icon={<Activity className="h-4 w-4" />}
                  label="Disease"
                  value={result.disease_name ?? "Unknown"}
                />
                <InfoRow
                  icon={<Info className="h-4 w-4" />}
                  label="ICD-10 Code"
                  value={result.icd10_code ?? "N/A"}
                />
                <InfoRow
                  icon={<Activity className="h-4 w-4" />}
                  label="Confidence"
                  value={`${Math.round(result.confidence * 100)}%`}
                />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Governorate"
                  value={result.governorate ?? "Not detected"}
                />
                {result.district && (
                  <InfoRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="District"
                    value={result.district}
                  />
                )}
                {result.age_group && (
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Age Group"
                    value={result.age_group}
                  />
                )}
                {result.sex && (
                  <InfoRow icon={<User className="h-4 w-4" />} label="Sex" value={result.sex} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium">{result.recommendation}</span>
                </div>
              </CardContent>
            </Card>

            {result.risk_factors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Factors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.risk_factors.map((rf, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {rf}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.nearby_governorates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Nearby Governorates to Monitor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.nearby_governorates.map((g, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {g}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {result && !result.success && (
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-red-600">{result.message}</span>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
