import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CloudOff, Save, Send, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { referenceService, reportsService } from "@/lib/api/services";
import { QUERY_KEYS } from "@/lib/api/config";
import { offlineQueue } from "@/lib/offline-queue";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportInput } from "@/lib/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Report — EpiLink" },
      {
        name: "description",
        content:
          "Submit a clinical disease report. Works offline — submissions auto-sync when you reconnect.",
      },
    ],
  }),
  component: SubmitReportPage,
});

const schema = z.object({
  disease: z.string().min(1, "Required"),
  symptoms: z.string().min(1, "Required"),
  location: z.string().min(1, "Required"),
  facility: z.string().optional(),
  notes: z.string().optional(),
  anonymous: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function SubmitReportPage() {
  const online = useOnline();
  const navigate = useNavigate();
  const diseasesQ = useQuery({
    queryKey: QUERY_KEYS.diseases,
    queryFn: () => referenceService.diseases(),
  });
  const { register, handleSubmit, formState, reset, setValue, watch } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { anonymous: false },
    });

  const submitMutation = useMutation({
    mutationFn: (payload: ReportInput) => reportsService.create(payload),

    onSuccess: (r) => {
      toast.success("Report submitted", {
        description: "Analysis pipeline started.",
      });
      reset();
      // Backend returns { report_id, status, reporting_group, alert_triggered, message }
      navigate({ to: "/analysis", search: { id: r.report_id } as never });
    },
    onError: (e) => {
      toast.error("Submission failed", { description: (e as Error).message });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (!online) {
      offlineQueue.enqueue({
        facility_id: data.facility || "FAC001",
        physician_id: "DOC001",
        governorate: data.location,
        district: data.location,
        age_group: "15-29",
        sex: "Male",
        nationality: "Egyptian",

        icd10_code: "A80",

        symptom_onset_date: new Date().toISOString().split("T")[0],
        diagnosis_basis: "Clinical",

        hospitalized: false,
        outcome: "Alive",
        lab_sample_taken: false,
        submission_mode: "offline-cached",
      });
      toast.success("Saved offline", {
        description: "Will sync automatically when you reconnect.",
      });
      reset();
      return;
    }

    console.log("The disease data is ", diseasesQ.data)

    const selectedDisease = diseasesQ.data?.find(
      (d) => d.name === data.disease
    );

    if (!selectedDisease) {
      toast.error("Please select a valid disease");
      return;
    }

    console.log({
      facility_id: data.facility || "FAC001",
      physician_id: "DOC001",
      governorate: data.location,
      district: data.location,
      age_group: "15-29",
      sex: "Male",
      nationality: "Egyptian",
      icd10_code: selectedDisease.icd10_code,
      symptom_onset_date: new Date().toISOString().split("T")[0],
      diagnosis_basis: "Clinical",
      hospitalized: false,
      outcome: "Alive",
      lab_sample_taken: false,
      submission_mode: "online",
    });



    submitMutation.mutate({
      facility_id: data.facility ?? "UNKNOWN",
      physician_id: "demo-doctor",
      governorate: data.location,
      district: "UNKNOWN",
      age_group: "30-59",
      sex: "Male",
      nationality: "Egyptian",
      icd10_code: selectedDisease.icd10_code,
      symptom_onset_date: new Date().toISOString().split("T")[0],
      diagnosis_basis: "Clinical",
      hospitalized: false,
      outcome: "Unknown",
      lab_sample_taken: false,
      submission_mode: "online",
    });
  };

  const saveOffline = () => {
    // Declare data first to avoid ReferenceError
    const data = watch();
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      toast.error("Fill in required fields first");
      return;
    }

    const selectedDisease = diseasesQ.data?.find(
      (d) => d.name === parsed.data.disease
    );

    if (!selectedDisease) {
      toast.error("Please select a valid disease");
      return;
    }

    offlineQueue.enqueue({
      facility_id: parsed.data.facility || "FAC001",
      physician_id: "DOC001",
      governorate: parsed.data.location,
      district: parsed.data.location,
      age_group: "15-29",
      sex: "Male",
      nationality: "Egyptian",
      icd10_code: selectedDisease.icd10_code,
      symptom_onset_date: new Date().toISOString().split("T")[0],
      diagnosis_basis: "Clinical",
      hospitalized: false,
      outcome: "Alive",
      lab_sample_taken: false,
      submission_mode: "offline-cached",
    });
    toast.success("Saved offline");
    reset();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-100 text-sky-700">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Submit Report</h1>
            <p className="text-sm text-slate-500">
              Clinician intake. Fast, structured, offline-ready.
            </p>
          </div>
          {!online && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <CloudOff className="h-3.5 w-3.5" /> Offline mode
            </span>
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New disease report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
              <div className="grid gap-1.5">
                <Label>Disease</Label>

                <Select
                  value={watch("disease")}
                  onValueChange={(value) =>
                    setValue("disease", value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a disease" />
                  </SelectTrigger>

                  <SelectContent>
                    {(diseasesQ.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {formState.errors.disease && (
                  <p className="text-xs text-red-600">
                    {formState.errors.disease.message}
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="symptoms">Symptoms (comma separated)</Label>
                <Input
                  id="symptoms"
                  placeholder="fever, vomiting, dehydration"
                  {...register("symptoms")}
                />
                {formState.errors.symptoms && (
                  <p className="text-xs text-red-600">
                    {formState.errors.symptoms.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="District, Country"
                    {...register("location")}
                  />
                  {formState.errors.location && (
                    <p className="text-xs text-red-600">
                      {formState.errors.location.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="facility">Facility</Label>
                  <Input
                    id="facility"
                    placeholder="Hospital or clinic name"
                    {...register("facility")}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  placeholder="Anything relevant — travel history, contacts, lab results."
                  {...register("notes")}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Submit anonymously</div>
                  <div className="text-xs text-slate-500">
                    Hide clinician identity from downstream reviewers.
                  </div>
                </div>
                <Switch
                  checked={watch("anonymous")}
                  onCheckedChange={(v) => setValue("anonymous", v)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={submitMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : "Submit Report"}
                </Button>
                <Button type="button" variant="outline" onClick={saveOffline}>
                  <Save className="mr-2 h-4 w-4" /> Save Offline
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
