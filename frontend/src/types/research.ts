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