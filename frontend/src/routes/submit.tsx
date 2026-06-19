import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CloudOff, Save, Send, Stethoscope, Camera, FileText as FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { inputService, referenceService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { offlineQueue } from "@/lib/offline-queue";
import { useOnline } from "@/hooks/use-online";
import type { FormInputRequest } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/submit")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("epilink_token") : null;
    if (!token) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Submit Report - EpiLink" },
      { name: "description", content: "Submit a disease report via form, text, or image." },
    ],
  }),
  component: SubmitReportPage,
});

const GOVERNORATES = [
  "Cairo",
  "Alexandria",
  "Giza",
  "Qalyubia",
  "Sharqia",
  "Monufia",
  "Gharbia",
  "Kafr El Sheikh",
  "Dakahlia",
  "Damietta",
  "Port Said",
  "Ismailia",
  "Suez",
  "North Sinai",
  "South Sinai",
  "Beheira",
  "Matrouh",
  "Fayoum",
  "Beni Suef",
  "Minya",
  "Assiut",
  "Sohag",
  "Qena",
  "Luxor",
  "Aswan",
  "Red Sea",
  "New Valley",
];

function SubmitReportPage() {
  const online = useOnline();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("form");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const diseasesQ = useQuery({
    queryKey: QUERY_KEYS.diseases,
    queryFn: () => referenceService.diseases(),
  });

  const formMutation = useMutation({
    mutationFn: (data: FormInputRequest) => inputService.form(data),
    onSuccess: (r) => {
      if (r.success) {
        toast.success("Report submitted", { description: r.message });
      } else {
        toast.warning("Report submitted with warnings", { description: r.message });
      }
      if (r.report_id) navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error("Submission failed", { description: (e as Error).message }),
  });

  const textMutation = useMutation({
    mutationFn: (text: string) => inputService.text({ text, source: "manual" }),
    onSuccess: (r) => {
      if (r.success) {
        toast.success("Text processed", { description: r.message, duration: 5000 });
      } else {
        toast.warning("Processing complete", { description: r.message, duration: 5000 });
      }
      if (r.warnings.length > 0) {
        r.warnings.forEach((w) => toast.info(`Warning: ${w.message}`));
      }
    },
    onError: (e) => toast.error("Processing failed", { description: (e as Error).message }),
  });

  const imageMutation = useMutation({
    mutationFn: (imageBase64: string) =>
      inputService.image({ image_base64: imageBase64, image_format: "jpeg" }),
    onSuccess: (r) => {
      if (r.success) {
        toast.success("Image processed successfully", {
          description: r.message,
          duration: 6000,
        });
      } else {
        toast.warning("Image processed", {
          description: r.message,
          duration: 6000,
        });
      }
      if (r.structured_data?.icd10_code) {
        toast.info(
          `Detected: ${r.structured_data.icd10_code} — Confidence: ${Math.round((r.confidence_score ?? 0) * 100)}%`,
        );
      }
      if (r.warnings.length > 0) {
        r.warnings.forEach((w) => toast.info(`Note: ${w.message}`));
      }
    },
    onError: (e) => toast.error("Image processing failed", { description: (e as Error).message }),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      imageMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Submit Report</h1>
            <p className="text-sm text-muted-foreground">Structured intake. Fast, offline-ready.</p>
          </div>
          {!online && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <CloudOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="form" className="gap-2">
              <FileTextIcon className="h-4 w-4" /> Structured Form
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-2">
              <Send className="h-4 w-4" /> Free Text
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-2">
              <Camera className="h-4 w-4" /> Image / OCR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form">
            <FormTab
              diseases={diseasesQ.data ?? []}
              onSubmit={(data) => {
                if (!online) {
                  offlineQueue.enqueue(data);
                  toast.success("Saved offline", { description: "Will sync when connected." });
                  return;
                }
                formMutation.mutate(data);
              }}
              isPending={formMutation.isPending}
              online={online}
            />
          </TabsContent>

          <TabsContent value="text">
            <TextTab
              onSubmit={(text) => textMutation.mutate(text)}
              isPending={textMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="image">
            <ImageTab
              onUpload={handleImageUpload}
              isPending={imageMutation.isPending}
              fileRef={fileInputRef}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function FormTab({
  diseases,
  onSubmit,
  isPending,
  online,
}: {
  diseases: Array<{ id: string; name: string; icd10?: string }>;
  onSubmit: (data: FormInputRequest) => void;
  isPending: boolean;
  online: boolean;
}) {
  const [governorate, setGovernorate] = useState("");
  const [icd10, setIcd10] = useState("");
  const [sex, setSex] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [diagnosisBasis, setDiagnosisBasis] = useState("");
  const [outcome, setOutcome] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sex || !ageGroup || !diagnosisBasis || !outcome) return;
    onSubmit({
      facility_id: "EGY-PHC-001",
      physician_id: "physician-001",
      governorate,
      district: "Central",
      age_group: ageGroup as FormInputRequest["age_group"],
      sex: sex as FormInputRequest["sex"],
      nationality: "Egyptian",
      icd10_code: icd10,
      symptom_onset_date: new Date().toISOString().split("T")[0],
      diagnosis_basis: diagnosisBasis as FormInputRequest["diagnosis_basis"],
      hospitalized: false,
      outcome: outcome as FormInputRequest["outcome"],
      lab_sample_taken: false,
      submission_mode: "online",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Structured Case Report</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Disease (ICD-10)</Label>
            <Select value={icd10} onValueChange={setIcd10}>
              <SelectTrigger>
                <SelectValue placeholder="Select disease" />
              </SelectTrigger>
              <SelectContent>
                {diseases.map((d) => (
                  <SelectItem key={d.id} value={d.icd10 ?? d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Governorate</Label>
              <Select value={governorate} onValueChange={setGovernorate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GOVERNORATES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Age Group</Label>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {["<1", "1-4", "5-14", "15-29", "30-59", "60+"].map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Diagnosis Basis</Label>
              <Select value={diagnosisBasis} onValueChange={setDiagnosisBasis}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clinical">Clinical</SelectItem>
                  <SelectItem value="Lab-confirmed">Lab-confirmed</SelectItem>
                  <SelectItem value="Epidemiological link">Epidemiological link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alive">Alive</SelectItem>
                  <SelectItem value="Dead">Dead</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                isPending ||
                !icd10 ||
                !governorate ||
                !sex ||
                !ageGroup ||
                !diagnosisBasis ||
                !outcome
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TextTab({
  onSubmit,
  isPending,
}: {
  onSubmit: (text: string) => void;
  isPending: boolean;
}) {
  const [text, setText] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Free Text / SMS Input</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Enter clinical text or paste SMS</Label>
            <textarea
              className="min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={`Paste any disease report text — the AI will extract structured data automatically.\n\nExamples:\n• "3 cases of acute diarrhea in children under 5, Cairo governorate, lab-confirmed cholera"\n• "Female, age 30-59, fever and rash since 3 days, Giza — suspected measles, lab sample taken"\n• "Animal bite wound infection, Minya, Brucellosis suspected, clinical diagnosis"\n• "Newborn with neonatal tetanus, Assiut, dead on arrival"\n• SMS-style: "2 new dengue cases adults male sharm el sheikh south sinai"`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Accepts any format: clinical notes, SMS messages, Arabic or English text, disease names,
            symptoms, patient demographics, location, lab results, and outcomes.
          </p>
          <Button onClick={() => onSubmit(text)} disabled={isPending || !text.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {isPending ? "Processing..." : "Process Text"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ImageTab({
  onUpload,
  isPending,
  fileRef,
}: {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPending: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  const handlePreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    onUpload(e);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Image / OCR Input</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Upload a photo of a medical report, prescription, lab result, or any clinical document.
            The AI will extract all text (Arabic & English) and convert it to structured case data.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handlePreview}
          />
          {preview && (
            <div className="overflow-hidden rounded-lg border">
              <img
                src={preview}
                alt="Uploaded document"
                className="max-h-[300px] w-full object-contain"
              />
            </div>
          )}
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            variant="outline"
            className="h-24 border-dashed"
          >
            <Camera className="mr-2 h-6 w-6" />
            {isPending ? "Extracting text with AI Vision..." : "Click to upload image"}
          </Button>
          {isPending && (
            <p className="text-xs text-muted-foreground">
              Groq Vision AI is reading the document, extracting text, and classifying the
              disease...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
