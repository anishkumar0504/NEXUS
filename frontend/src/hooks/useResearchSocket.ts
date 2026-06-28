import { useEffect, useState, useCallback } from "react";

export interface ResearchStep {
  step: number;
  status: "running" | "complete" | "error";
  tool?: string;
  model?: string;
  provider?: string;
  label?: string;
  sourcesCount?: number;
  imageUrl?: string;
  error?: string;
}

export interface ResearchResult {
  answer: string;
  sources: { title: string; url: string; content: string }[];
  mindMapImageUrl: string | null;
  followUpQuestions: string[];
}

export interface ResearchProgress {
  jobId: string;
  steps: ResearchStep[];
  currentStep: number;
  isComplete: boolean;
  result?: ResearchResult;
  error?: string;
}

export function useResearchSocket(socket: any | null) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);

  const startTracking = useCallback((jobId: string) => {
    setActiveJobId(jobId);
    setProgress({
      jobId,
      steps: [],
      currentStep: 0,
      isComplete: false,
    });
  }, []);

  const clearTracking = useCallback(() => {
    setActiveJobId(null);
    setProgress(null);
  }, []);

  useEffect(() => {
    if (!socket || !activeJobId) {
      setProgress(null);
      return;
    }

    const handleStep = (data: ResearchStep & { jobId: string }) => {
      if (data.jobId !== activeJobId) return;

      setProgress((prev) => {
        if (!prev) return null;

        const steps = [...prev.steps];
        const existingIndex = steps.findIndex((s) => s.step === data.step);

        if (existingIndex >= 0) {
          steps[existingIndex] = data;
        } else {
          steps.push(data);
        }

        steps.sort((a, b) => a.step - b.step);

        return {
          ...prev,
          steps,
          currentStep: data.status === "running" ? data.step : prev.currentStep,
        };
      });
    };

    const handleComplete = (data: { jobId: string; result: ResearchResult }) => {
      if (data.jobId !== activeJobId) return;

      setProgress((prev) =>
        prev
          ? { ...prev, isComplete: true, currentStep: 0, result: data.result }
          : null
      );
    };

    const handleError = (data: { jobId: string; error: string }) => {
      if (data.jobId !== activeJobId) return;

      setProgress((prev) =>
        prev
          ? {
              ...prev,
              isComplete: true,
              error: data.error,
              steps: [
                ...prev.steps,
                {
                  step: prev.currentStep || 1,
                  status: "error",
                  error: data.error,
                  label: "Research failed",
                },
              ],
            }
          : null
      );
    };

    socket.on("research:step", handleStep);
    socket.on("research:complete", handleComplete);
    socket.on("research:error", handleError);

    return () => {
      socket.off("research:step", handleStep);
      socket.off("research:complete", handleComplete);
      socket.off("research:error", handleError);
    };
  }, [socket, activeJobId]);

  return { progress, startTracking, clearTracking };
}