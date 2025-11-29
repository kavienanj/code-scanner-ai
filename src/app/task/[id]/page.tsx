"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

interface ProgressData {
  current: number;
  total: number;
  stage: string;
}

interface AnalysisResult {
  summary: string;
  findings: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    message: string;
    file?: string;
  }>;
  metrics: {
    filesAnalyzed: number;
    endpointsFound: number;
    securityChecklistsGenerated: number;
    issuesFound: number;
    analysisTime: number;
  };
}

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export default function TaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [status, setStatus] = useState<JobStatus>("pending");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressData>({
    current: 0,
    total: 100,
    stage: "Initializing",
  });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Connect to SSE stream
  useEffect(() => {
    if (!taskId) return;

    const eventSource = new EventSource(`/api/analyze/${taskId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "log":
            setLogs((prev) => [...prev, data.data]);
            break;
          case "progress":
            setProgress(data.data);
            break;
          case "status":
            setStatus(data.data);
            break;
          case "result":
            setResult(data.data);
            break;
          case "error":
            setError(data.data);
            break;
        }
      } catch (e) {
        console.error("Failed to parse SSE event:", e);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "running":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "cancelled":
        return "bg-orange-500";
      default:
        return "bg-zinc-500";
    }
  };

  const handleCancelJob = async () => {
    if (isCancelling) return;
    
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/analyze/${taskId}/cancel`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error("Failed to cancel job:", data.error);
      }
    } catch (error) {
      console.error("Failed to cancel job:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "info":
        return "text-zinc-600 dark:text-zinc-400";
      case "warn":
        return "text-yellow-600 dark:text-yellow-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      case "success":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-zinc-600 dark:text-zinc-400";
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 font-sans dark:bg-black">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Analysis Task
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Task ID: <code className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-800">{taskId}</code>
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/")}>
            ← Back to Home
          </Button>
        </div>

        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Status</CardTitle>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${getStatusColor(status)} ${
                    status === "running" ? "animate-pulse" : ""
                  }`}
                />
                <span className="text-sm font-medium capitalize">{status}</span>
                {connected && status === "running" && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Live
                  </Badge>
                )}
                {(status === "running" || status === "pending") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelJob}
                    disabled={isCancelling}
                    className="ml-2"
                  >
                    {isCancelling ? "Cancelling..." : "Terminate"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {progress.stage}
                </span>
                <span className="font-medium">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Logs Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Logs</CardTitle>
            <CardDescription>Real-time analysis output</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 overflow-y-auto rounded-lg bg-zinc-900 p-4 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-zinc-500">Waiting for logs...</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="shrink-0 text-zinc-500">
                      [{formatTime(log.timestamp)}]
                    </span>
                    <span className={getLogColor(log.level)}>{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Error Card */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardHeader>
              <CardTitle className="text-lg text-red-800 dark:text-red-200">
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Cancelled Card */}
        {status === "cancelled" && (
          <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <CardHeader>
              <CardTitle className="text-lg text-orange-800 dark:text-orange-200">
                Analysis Cancelled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700 dark:text-orange-300">
                The analysis was terminated by user request.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results Card */}
        {result && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardHeader>
              <CardTitle className="text-lg text-green-800 dark:text-green-200">
                Analysis Complete
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-300">
                {result.summary}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Metrics */}
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {result.metrics.filesAnalyzed}
                  </p>
                  <p className="text-sm text-zinc-500">Files Analyzed</p>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {result.metrics.endpointsFound}
                  </p>
                  <p className="text-sm text-zinc-500">Endpoints Found</p>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {result.metrics.securityChecklistsGenerated}
                  </p>
                  <p className="text-sm text-zinc-500">Security Checklists</p>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {result.metrics.issuesFound}
                  </p>
                  <p className="text-sm text-zinc-500">Issues Found</p>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {(result.metrics.analysisTime / 1000).toFixed(1)}s
                  </p>
                  <p className="text-sm text-zinc-500">Analysis Time</p>
                </div>
              </div>

              {/* Findings */}
              {result.findings.length > 0 && (
                <div>
                  <h4 className="mb-3 font-semibold text-green-800 dark:text-green-200">
                    Findings
                  </h4>
                  <div className="space-y-2">
                    {result.findings.map((finding, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-lg bg-white p-3 dark:bg-zinc-900"
                      >
                        <Badge
                          variant={
                            finding.severity === "critical"
                              ? "destructive"
                              : finding.severity === "warning"
                              ? "secondary"
                              : "outline"
                          }
                          className="shrink-0"
                        >
                          {finding.severity}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {finding.message}
                          </p>
                          {finding.file && (
                            <p className="text-xs text-zinc-500">{finding.file}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => router.push("/")}>
            Start New Analysis
          </Button>
        </div>
      </div>
    </div>
  );
}
