import { FileEntry, FrameworkDetectionResult } from "./code-cleaner";
import {
  addLog,
  updateProgress,
  updateStatus,
  setResult,
  setError,
  AnalysisResult,
} from "./job-store";

// Helper to simulate async delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  try {
    // Start the job
    updateStatus(jobId, "running");
    addLog(jobId, "info", "🚀 Starting code analysis...");
    await delay(500);

    // Stage 1: Initialize
    updateProgress(jobId, 5, 100, "Initializing analysis engine");
    addLog(jobId, "info", `📦 Detected framework: ${framework.framework}`);
    addLog(jobId, "info", `📊 Files to analyze: ${files.length}`);
    await delay(800);

    // Stage 2: Parse files
    updateProgress(jobId, 15, 100, "Parsing source files");
    addLog(jobId, "info", "🔍 Parsing source files...");
    await delay(600);

    const fileTypes = new Map<string, number>();
    for (const file of files) {
      const ext = file.path.split(".").pop() || "unknown";
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
    }

    for (const [ext, count] of fileTypes) {
      addLog(jobId, "info", `   Found ${count} .${ext} files`);
      await delay(200);
    }

    // Stage 3: Build dependency graph
    updateProgress(jobId, 30, 100, "Building dependency graph");
    addLog(jobId, "info", "🕸️ Building dependency graph...");
    await delay(1000);
    addLog(jobId, "success", "   Dependency graph constructed");
    await delay(300);

    // Stage 4: Analyze code patterns
    updateProgress(jobId, 45, 100, "Analyzing code patterns");
    addLog(jobId, "info", "🔬 Analyzing code patterns...");
    await delay(800);

    // Simulate analyzing some files
    const filesToShow = files.slice(0, Math.min(5, files.length));
    for (let i = 0; i < filesToShow.length; i++) {
      const file = filesToShow[i];
      const progress = 45 + Math.floor((i / filesToShow.length) * 20);
      updateProgress(jobId, progress, 100, `Analyzing ${file.path}`);
      addLog(jobId, "info", `   Analyzing: ${file.path}`);
      await delay(400);
    }

    if (files.length > 5) {
      addLog(jobId, "info", `   ... and ${files.length - 5} more files`);
      await delay(300);
    }

    // Stage 5: Security scan
    updateProgress(jobId, 70, 100, "Running security scan");
    addLog(jobId, "info", "🔒 Running security scan...");
    await delay(1200);
    addLog(jobId, "success", "   No critical vulnerabilities found");
    await delay(200);

    // Stage 6: Code quality check
    updateProgress(jobId, 85, 100, "Checking code quality");
    addLog(jobId, "info", "✨ Checking code quality...");
    await delay(800);

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
      const icon = finding.severity === "warning" ? "⚠️" : "ℹ️";
      addLog(
        jobId,
        finding.severity === "warning" ? "warn" : "info",
        `${icon} ${finding.message}`
      );
      await delay(300);
    }

    // Stage 7: Generate report
    updateProgress(jobId, 95, 100, "Generating report");
    addLog(jobId, "info", "📝 Generating analysis report...");
    await delay(600);

    // Complete
    updateProgress(jobId, 100, 100, "Complete");
    
    const analysisTime = Date.now() - startTime;

    const result: AnalysisResult = {
      summary: `Analysis completed successfully for ${framework.framework} project with ${files.length} files.`,
      findings,
      metrics: {
        filesAnalyzed: files.length,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    addLog(jobId, "error", `❌ Analysis failed: ${errorMessage}`);
    setError(jobId, errorMessage);
  }
}
