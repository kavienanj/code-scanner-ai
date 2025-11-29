"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

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

// Types from agents
interface EndpointProfile {
  flow_name: string;
  purpose: string;
  entry_point: string;
  input_types: string[];
  output_types: string[];
  sensitivity_level: "low" | "medium" | "high" | "critical";
  mark_down: string;
}

interface SecurityControl {
  control_id: string;
  name: string;
  description: string;
  category: string;
  importance: "critical" | "high" | "medium" | "low";
  owasp_mapping: string[];
}

interface SecurityChecklist {
  flow_name: string;
  required_controls: SecurityControl[];
  recommended_controls: SecurityControl[];
  references: { title: string; url: string }[];
}

interface CodeLocation {
  file: string;
  code_snippet: string;
}

interface ImplementedControl {
  control_id: string;
  control_name: string;
  evidence: string;
  location: CodeLocation;
}

interface MissingControl {
  control_id: string;
  control_name: string;
  reason: string;
  severity: "critical" | "high" | "medium" | "low";
  recommendation: string;
}

interface AutoHandledControl {
  control_id: string;
  control_name: string;
  handled_by: string;
  explanation: string;
}

interface Vulnerability {
  id: string;
  title: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  location: CodeLocation;
  recommendation: string;
}

interface SecurityReport {
  flow_name: string;
  implemented: ImplementedControl[];
  missing: MissingControl[];
  auto_handled: AutoHandledControl[];
  vulnerabilities: Vulnerability[];
  summary: {
    total_controls: number;
    implemented_count: number;
    missing_count: number;
    auto_handled_count: number;
    vulnerabilities_count: number;
    overall_severity: "critical" | "high" | "medium" | "low" | "none";
  };
}

interface AnalysisResult {
  summary: string;
  findings: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    message: string;
    file?: string;
  }>;
  endpointProfiles: EndpointProfile[];
  securityChecklists: SecurityChecklist[];
  securityReports: SecurityReport[];
  metrics: {
    filesAnalyzed: number;
    endpointsFound: number;
    securityChecklistsGenerated: number;
    securityReportsGenerated: number;
    issuesFound: number;
    vulnerabilitiesFound: number;
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

  const formatDuration = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = seconds / 60;
    if (minutes < 60) {
      const mins = Math.floor(minutes);
      const secs = Math.round(seconds % 60);
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = Math.round(minutes % 60);
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
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
                  <p className={`text-2xl font-bold ${(result.metrics.vulnerabilitiesFound || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {result.metrics.vulnerabilitiesFound || 0}
                  </p>
                  <p className="text-sm text-zinc-500">Vulnerabilities</p>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className={`text-2xl font-bold ${result.metrics.issuesFound > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                    {result.metrics.issuesFound}
                  </p>
                  <p className="text-sm text-zinc-500">Total Issues</p>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {formatDuration(result.metrics.analysisTime)}
                  </p>
                  <p className="text-sm text-zinc-500">Analysis Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Security Reports */}
        {result && result.securityReports && result.securityReports.length > 0 && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Security Analysis Reports
              </h2>
              <Badge variant="outline">{result.securityReports.length} endpoints</Badge>
            </div>
            
            {result.securityReports.map((report, reportIndex) => {
              // Find matching endpoint and checklist
              const endpoint = result.endpointProfiles?.find(
                (ep) => ep.flow_name === report.flow_name
              );
              const checklist = result.securityChecklists?.find(
                (cl) => cl.flow_name === report.flow_name
              );
              
              const hasVulnerabilities = (report.vulnerabilities?.length || 0) > 0;
              const hasMissing = report.summary.missing_count > 0;
              const isSecure = report.summary.overall_severity === "none";

              return (
                <Collapsible key={reportIndex} className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <CollapsibleTrigger className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg">
                    <div className="flex-1">
                      {/* Header Row */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {report.flow_name}
                        </span>
                        {hasVulnerabilities && (
                          <Badge variant="destructive" className="text-xs">
                            {report.vulnerabilities.length} vuln
                          </Badge>
                        )}
                        {hasMissing && (
                          <Badge 
                            variant={report.summary.overall_severity === "critical" || report.summary.overall_severity === "high" ? "destructive" : "secondary"} 
                            className="text-xs"
                          >
                            {report.summary.missing_count} missing
                          </Badge>
                        )}
                        {isSecure && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            ✓ Secure
                          </Badge>
                        )}
                      </div>
                      
                      {/* Overview Row */}
                      <div className="flex items-center gap-4 text-sm text-zinc-500">
                        {endpoint && (
                          <>
                            <span className="font-mono text-xs">{endpoint.entry_point}</span>
                            <Badge variant="outline" className="text-xs">
                              {endpoint.sensitivity_level}
                            </Badge>
                          </>
                        )}
                        <span className="text-xs">
                          {report.summary.implemented_count} ✓ | {report.summary.missing_count} ⚠ | {report.summary.auto_handled_count} 🔧
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="border-t border-zinc-200 dark:border-zinc-800">
                    <div className="p-4 space-y-4">
                      {/* Endpoint Overview */}
                      {endpoint && (
                        <Collapsible defaultOpen className="rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <CollapsibleTrigger className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg">
                            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                              📍 Endpoint Details
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="grid gap-3 sm:grid-cols-2 pt-2">
                              <div>
                                <p className="text-xs text-zinc-500">Entry Point</p>
                                <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                                  {endpoint.entry_point}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-zinc-500">Sensitivity</p>
                                <Badge
                                  variant={
                                    endpoint.sensitivity_level === "critical" || endpoint.sensitivity_level === "high"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {endpoint.sensitivity_level}
                                </Badge>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-xs text-zinc-500">Purpose</p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                  {endpoint.purpose}
                                </p>
                              </div>
                              {endpoint.input_types.length > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-500">Input Types</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {endpoint.input_types.map((type, i) => (
                                      <Badge 
                                        key={i} 
                                        variant="outline" 
                                        className="text-xs max-w-[150px] block overflow-hidden text-ellipsis whitespace-nowrap text-left cursor-default"
                                        title={type}
                                      >
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {endpoint.output_types.length > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-500">Output Types</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {endpoint.output_types.map((type, i) => (
                                      <Badge 
                                        key={i} 
                                        variant="outline" 
                                        className="text-xs max-w-[150px] block overflow-hidden text-ellipsis whitespace-nowrap text-left cursor-default"
                                        title={type}
                                      >
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Security Summary - Always visible */}
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                        <h4 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          📊 Security Summary
                        </h4>
                        <div className="grid grid-cols-5 gap-2 text-center">
                          <div>
                            <p className="text-xl font-bold text-green-600">{report.summary.implemented_count}</p>
                            <p className="text-xs text-zinc-500">Implemented</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-orange-600">{report.summary.missing_count}</p>
                            <p className="text-xs text-zinc-500">Missing</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-blue-600">{report.summary.auto_handled_count}</p>
                            <p className="text-xs text-zinc-500">Auto</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-red-600">{report.summary.vulnerabilities_count || 0}</p>
                            <p className="text-xs text-zinc-500">Vulns</p>
                          </div>
                          <div>
                            <Badge
                              variant={
                                report.summary.overall_severity === "critical" || report.summary.overall_severity === "high"
                                  ? "destructive"
                                  : report.summary.overall_severity === "medium"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {report.summary.overall_severity === "none" ? "✓ OK" : report.summary.overall_severity}
                            </Badge>
                            <p className="text-xs text-zinc-500 mt-1">Severity</p>
                          </div>
                        </div>
                      </div>

                      {/* Vulnerabilities */}
                      {report.vulnerabilities && report.vulnerabilities.length > 0 && (
                        <Collapsible defaultOpen className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                          <CollapsibleTrigger className="p-3 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg">
                            <span className="font-medium text-sm text-red-800 dark:text-red-200">
                              🔴 Vulnerabilities ({report.vulnerabilities.length})
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="space-y-3 pt-2">
                              {report.vulnerabilities.map((vuln, i) => (
                                <div key={i} className="rounded-lg bg-white p-3 dark:bg-zinc-900">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="font-mono text-xs">{vuln.id}</Badge>
                                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{vuln.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">{vuln.type.replace(/_/g, ' ')}</Badge>
                                      <Badge variant={vuln.severity === "critical" || vuln.severity === "high" ? "destructive" : "secondary"}>
                                        {vuln.severity}
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{vuln.description}</p>
                                  {vuln.location && (
                                    <div className="rounded bg-zinc-900 p-3 dark:bg-zinc-950 mb-2">
                                      <p className="text-xs text-zinc-400 mb-1 font-mono">📁 {vuln.location.file}</p>
                                      <pre className="text-xs text-red-400 overflow-x-auto"><code>{vuln.location.code_snippet}</code></pre>
                                    </div>
                                  )}
                                  <div className="rounded bg-zinc-100 p-2 dark:bg-zinc-800">
                                    <p className="text-xs text-zinc-500 mb-1">🛠️ Fix:</p>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{vuln.recommendation}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Missing Controls */}
                      {report.missing.length > 0 && (
                        <Collapsible defaultOpen className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                          <CollapsibleTrigger className="p-3 hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded-lg">
                            <span className="font-medium text-sm text-orange-800 dark:text-orange-200">
                              ⚠️ Missing Controls ({report.missing.length})
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="space-y-3 pt-2">
                              {report.missing.map((control, i) => (
                                <div key={i} className="rounded-lg bg-white p-3 dark:bg-zinc-900">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="font-mono text-xs">{control.control_id}</Badge>
                                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{control.control_name}</span>
                                    </div>
                                    <Badge variant={control.severity === "critical" || control.severity === "high" ? "destructive" : "secondary"}>
                                      {control.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{control.reason}</p>
                                  <div className="rounded bg-zinc-100 p-2 dark:bg-zinc-800">
                                    <p className="text-xs text-zinc-500 mb-1">💡 Recommendation:</p>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{control.recommendation}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Implemented Controls */}
                      {report.implemented.length > 0 && (
                        <Collapsible className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                          <CollapsibleTrigger className="p-3 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg">
                            <span className="font-medium text-sm text-green-800 dark:text-green-200">
                              ✅ Implemented Controls ({report.implemented.length})
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="space-y-3 pt-2">
                              {report.implemented.map((control, i) => (
                                <div key={i} className="rounded-lg bg-white p-3 dark:bg-zinc-900">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="font-mono text-xs">{control.control_id}</Badge>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{control.control_name}</span>
                                  </div>
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{control.evidence}</p>
                                  {control.location && (
                                    <div className="rounded bg-zinc-900 p-3 dark:bg-zinc-950">
                                      <p className="text-xs text-zinc-400 mb-1 font-mono">📁 {control.location.file}</p>
                                      <pre className="text-xs text-green-400 overflow-x-auto"><code>{control.location.code_snippet}</code></pre>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Auto-Handled Controls */}
                      {report.auto_handled.length > 0 && (
                        <Collapsible className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                          <CollapsibleTrigger className="p-3 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg">
                            <span className="font-medium text-sm text-blue-800 dark:text-blue-200">
                              🔧 Auto-Handled ({report.auto_handled.length})
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="space-y-3 pt-2">
                              {report.auto_handled.map((control, i) => (
                                <div key={i} className="rounded-lg bg-white p-3 dark:bg-zinc-900">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="font-mono text-xs">{control.control_id}</Badge>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{control.control_name}</span>
                                    <Badge variant="secondary" className="text-xs">{control.handled_by}</Badge>
                                  </div>
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{control.explanation}</p>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Security Checklist Reference */}
                      {checklist && (
                        <Collapsible className="rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <CollapsibleTrigger className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg">
                            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                              📋 Security Checklist
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="space-y-4 pt-2">
                              {checklist.required_controls.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Required ({checklist.required_controls.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {checklist.required_controls.map((ctrl, i) => (
                                      <Badge
                                        key={i}
                                        variant={
                                          report.implemented.some(ic => ic.control_id === ctrl.control_id) ? "default"
                                          : report.auto_handled.some(ac => ac.control_id === ctrl.control_id) ? "secondary"
                                          : "destructive"
                                        }
                                        className="text-xs"
                                        title={ctrl.description}
                                      >
                                        {ctrl.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {checklist.recommended_controls.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Recommended ({checklist.recommended_controls.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {checklist.recommended_controls.map((ctrl, i) => (
                                      <Badge
                                        key={i}
                                        variant={
                                          report.implemented.some(ic => ic.control_id === ctrl.control_id) ? "default"
                                          : report.auto_handled.some(ac => ac.control_id === ctrl.control_id) ? "secondary"
                                          : "outline"
                                        }
                                        className="text-xs"
                                        title={ctrl.description}
                                      >
                                        {ctrl.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {checklist.references.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">References</p>
                                  <div className="flex flex-wrap gap-2">
                                    {checklist.references.map((ref, i) => (
                                      <a
                                        key={i}
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        {ref.title} ↗
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
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
