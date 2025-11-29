import { FileEntry, FrameworkDetectionResult } from "./code-cleaner";
import {
  addLog,
  updateProgress,
  updateStatus,
  setResult,
  setError,
  setAbortController,
  isJobCancelled,
  AnalysisResult,
} from "./job-store";
import {
  createSentinelAgent,
  createGuardianAgent,
  generateProjectTree,
  EndpointProfile,
  FlowProfile,
  SecurityChecklist,
  SENTINEL_PROJECT_TREE_DEPTH,
} from "./agents";

// Custom error for cancellation
class CancellationError extends Error {
  constructor() {
    super("Job was cancelled");
    this.name = "CancellationError";
  }
}

// Helper to simulate async delay with cancellation support
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancellationError());
      return;
    }
    
    const timeout = setTimeout(resolve, ms);
    
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new CancellationError());
    });
  });
}

// Check if job should continue
function checkCancellation(jobId: string, signal?: AbortSignal): void {
  if (signal?.aborted || isJobCancelled(jobId)) {
    throw new CancellationError();
  }
}

/**
 * Run the dummy analysis process
 * This simulates a long-running analysis with various stages
 */
export async function runAnalysis(
  jobId: string,
  files: FileEntry[],
  framework: FrameworkDetectionResult
): Promise<void> {
  const startTime = Date.now();
  
  // Create abort controller for this job
  const abortController = new AbortController();
  setAbortController(jobId, abortController);
  const signal = abortController.signal;

  try {
    // Start the job
    updateStatus(jobId, "running");
    addLog(jobId, "info", "🚀 Starting code analysis...");
    await delay(500, signal);

    // Stage 1: Initialize
    checkCancellation(jobId, signal);
    updateProgress(jobId, 5, 100, "Initializing analysis engine");
    addLog(jobId, "info", `📦 Detected framework: ${framework.framework}`);
    addLog(jobId, "info", `📊 Files to analyze: ${files.length}`);
    await delay(800, signal);

    // Stage 2: Parse files
    checkCancellation(jobId, signal);
    updateProgress(jobId, 15, 100, "Parsing source files");
    addLog(jobId, "info", "🔍 Parsing source files...");
    await delay(600, signal);

    const fileTypes = new Map<string, number>();
    for (const file of files) {
      const ext = file.path.split(".").pop() || "unknown";
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
    }

    for (const [ext, count] of fileTypes) {
      checkCancellation(jobId, signal);
      addLog(jobId, "info", `   Found ${count} .${ext} files`);
      await delay(200, signal);
    }

    // Stage 3: Sentinel Agent - Endpoint Tracing
    checkCancellation(jobId, signal);
    updateProgress(jobId, 20, 100, "Running Sentinel Agent");
    addLog(jobId, "info", "🛡️ Starting Sentinel Agent for endpoint analysis...");
    
    let endpointProfiles: EndpointProfile[] = [];
    let projectTree = "";
    try {
      const sentinelAgent = createSentinelAgent({
        saveDebugOutput: true,
        onLog: (message) => {
          addLog(jobId, "info", `   ${message}`);
        },
        abortSignal: signal,
      });
      
      endpointProfiles = await sentinelAgent.analyze(files);
      projectTree = generateProjectTree(files, SENTINEL_PROJECT_TREE_DEPTH);
      
      addLog(jobId, "success", `   Sentinel Agent found ${endpointProfiles.length} endpoints`);
      
      for (const endpoint of endpointProfiles) {
        addLog(
          jobId,
          "info",
          `   📍 ${endpoint.entry_point} [${endpoint.sensitivity_level}] - ${endpoint.purpose}`
        );
      }
    } catch (error) {
      if (error instanceof CancellationError) {
        throw error;
      }
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      addLog(jobId, "warn", `   ⚠️ Sentinel Agent encountered an issue: ${errorMsg}`);
      addLog(jobId, "info", "   Continuing with remaining analysis stages...");
    }

    // Stage 4: Guardian Agent - Security Checklist Generation
    checkCancellation(jobId, signal);
    let securityChecklists: SecurityChecklist[] = [];
    
    if (endpointProfiles.length > 0) {
      updateProgress(jobId, 35, 100, "Running Guardian Agent");
      addLog(jobId, "info", "🔐 Starting Guardian Agent for security analysis...");
      
      try {
        // Convert EndpointProfiles to FlowProfiles (exclude mark_down)
        const flowProfiles: FlowProfile[] = endpointProfiles.map((ep) => ({
          flow_name: ep.flow_name,
          purpose: ep.purpose,
          entry_point: ep.entry_point,
          input_types: ep.input_types,
          output_types: ep.output_types,
          sensitivity_level: ep.sensitivity_level,
        }));

        const guardianAgent = createGuardianAgent({
          saveDebugOutput: true,
          onLog: (message) => {
            addLog(jobId, "info", `   ${message}`);
          },
          abortSignal: signal,
        });

        securityChecklists = await guardianAgent.analyzeFlows(
          flowProfiles,
          framework,
          projectTree
        );

        addLog(jobId, "success", `   Guardian Agent generated ${securityChecklists.length} security checklists`);
        
        // Log summary of security controls
        let totalRequired = 0;
        let totalRecommended = 0;
        for (const checklist of securityChecklists) {
          totalRequired += checklist.required_controls.length;
          totalRecommended += checklist.recommended_controls.length;
        }
        addLog(jobId, "info", `   📋 Total: ${totalRequired} required controls, ${totalRecommended} recommended controls`);
      } catch (error) {
        if (error instanceof CancellationError) {
          throw error;
        }
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        addLog(jobId, "warn", `   ⚠️ Guardian Agent encountered an issue: ${errorMsg}`);
        addLog(jobId, "info", "   Continuing with remaining analysis stages...");
      }
    } else {
      addLog(jobId, "info", "⏭️ Skipping Guardian Agent (no endpoints found)");
    }

    // Stage 5: Build dependency graph
    checkCancellation(jobId, signal);
    updateProgress(jobId, 50, 100, "Building dependency graph");
    addLog(jobId, "info", "🕸️ Building dependency graph...");
    await delay(1000, signal);
    addLog(jobId, "success", "   Dependency graph constructed");
    await delay(300, signal);

    // Stage 6: Analyze code patterns
    checkCancellation(jobId, signal);
    updateProgress(jobId, 60, 100, "Analyzing code patterns");
    addLog(jobId, "info", "🔬 Analyzing code patterns...");
    await delay(800, signal);

    // Simulate analyzing some files
    const filesToShow = files.slice(0, Math.min(5, files.length));
    for (let i = 0; i < filesToShow.length; i++) {
      checkCancellation(jobId, signal);
      const file = filesToShow[i];
      const progress = 50 + Math.floor((i / filesToShow.length) * 15);
      updateProgress(jobId, progress, 100, `Analyzing ${file.path}`);
      addLog(jobId, "info", `   Analyzing: ${file.path}`);
      await delay(400, signal);
    }

    if (files.length > 5) {
      addLog(jobId, "info", `   ... and ${files.length - 5} more files`);
      await delay(300, signal);
    }

    // Stage 7: Security scan
    checkCancellation(jobId, signal);
    updateProgress(jobId, 80, 100, "Running security scan");
    addLog(jobId, "info", "🔒 Running security scan...");
    await delay(1200, signal);
    addLog(jobId, "success", "   No critical vulnerabilities found");
    await delay(200, signal);

    // Stage 8: Code quality check
    checkCancellation(jobId, signal);
    updateProgress(jobId, 90, 100, "Checking code quality");
    addLog(jobId, "info", "✨ Checking code quality...");
    await delay(800, signal);

    // Generate some dummy findings
    const findings: AnalysisResult["findings"] = [];

    if (files.length > 10) {
      findings.push({
        type: "suggestion",
        severity: "info",
        message: "Consider splitting large modules into smaller components",
      });
    }

    if (framework.framework !== "unknown") {
      findings.push({
        type: "best-practice",
        severity: "info",
        message: `Following ${framework.framework} best practices detected`,
      });
    }

    // Add a warning for demonstration
    findings.push({
      type: "code-smell",
      severity: "warning",
      message: "Some files could benefit from additional documentation",
    });

    for (const finding of findings) {
      checkCancellation(jobId, signal);
      const icon = finding.severity === "warning" ? "⚠️" : "ℹ️";
      addLog(
        jobId,
        finding.severity === "warning" ? "warn" : "info",
        `${icon} ${finding.message}`
      );
      await delay(300, signal);
    }

    // Stage 9: Generate report
    checkCancellation(jobId, signal);
    updateProgress(jobId, 95, 100, "Generating report");
    addLog(jobId, "info", "📝 Generating analysis report...");
    await delay(600, signal);

    // Complete
    updateProgress(jobId, 100, 100, "Complete");
    
    const analysisTime = Date.now() - startTime;

    const result: AnalysisResult = {
      summary: `Analysis completed successfully for ${framework.framework} project with ${files.length} files.`,
      findings,
      endpointProfiles,
      securityChecklists,
      metrics: {
        filesAnalyzed: files.length,
        endpointsFound: endpointProfiles.length,
        securityChecklistsGenerated: securityChecklists.length,
        issuesFound: findings.filter((f) => f.severity !== "info").length,
        analysisTime,
      },
    };

    setResult(jobId, result);
    addLog(
      jobId,
      "success",
      `✅ Analysis completed in ${(analysisTime / 1000).toFixed(1)}s`
    );
    updateStatus(jobId, "completed");

  } catch (error) {
    if (error instanceof CancellationError) {
      // Job was cancelled - status already updated by cancelJob
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    addLog(jobId, "error", `❌ Analysis failed: ${errorMessage}`);
    setError(jobId, errorMessage);
  }
}
