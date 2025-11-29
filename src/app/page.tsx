"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface FileEntry {
  path: string;
  content: string;
  size: number;
}

interface FrameworkInfo {
  framework: string;
  confidence: "high" | "medium" | "low";
  indicators: string[];
}

interface ApiResponse {
  success: boolean;
  message: string;
  files?: FileEntry[];
  totalFiles?: number;
  repoName?: string;
  framework?: FrameworkInfo;
  stats?: {
    totalFilesProcessed: number;
    filesIncluded: number;
    filesIgnored: number;
  };
  error?: string;
}

export default function Home() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [patToken, setPatToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".zip")) {
        setUploadedFile(file);
        setError(null);
      } else {
        setError("Please upload a ZIP file");
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith(".zip")) {
        setUploadedFile(file);
        setError(null);
      } else {
        setError("Please upload a ZIP file");
      }
    }
  };

  const handleZipUpload = async () => {
    if (!uploadedFile) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const response = await fetch("/api/upload-zip", {
        method: "POST",
        body: formData,
      });

      const data: ApiResponse = await response.json();

      if (!data.success) {
        setError(data.error || data.message || "Failed to process ZIP file");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubFetch = async () => {
    if (!repoUrl) {
      setError("Please provide a repository URL");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/fetch-repo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl,
          patToken: patToken || undefined,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!data.success) {
        setError(data.error || data.message || "Failed to fetch repository");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setUploadedFile(null);
    setRepoUrl("");
    setPatToken("");
    setError(null);
    setResult(null);
  };

  const handleStartAnalysis = async () => {
    if (!result?.files || !result.framework) return;

    setIsStartingAnalysis(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: result.files,
          framework: result.framework,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to start analysis");
      } else {
        // Redirect to the task page
        router.push(`/task/${data.jobId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Code Scanner AI
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            Upload your codebase for intelligent analysis
          </p>
        </div>

        {/* Success Result */}
        {result && result.success && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardContent>
              <div className="flex items-start gap-3">
                <svg
                  className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    {result.message}
                  </h3>
                  <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                    {result.totalFiles} files ready for analysis
                    {result.repoName && ` from ${result.repoName}`}
                  </p>
                  
                  {/* Framework Detection Info */}
                  {result.framework && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        {result.framework.framework === "unknown" 
                          ? "Generic Project" 
                          : result.framework.framework.charAt(0).toUpperCase() + result.framework.framework.slice(1)}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        result.framework.confidence === "high" 
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : result.framework.confidence === "medium"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                      }`}>
                        {result.framework.confidence} confidence
                      </span>
                    </div>
                  )}

                  {/* Stats */}
                  {result.stats && (
                    <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                      Processed {result.stats.totalFilesProcessed} files, 
                      included {result.stats.filesIncluded}, 
                      ignored {result.stats.filesIgnored}
                    </p>
                  )}
                  
                  <div className="mt-3 flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleStartAnalysis}
                      disabled={isStartingAnalysis}
                    >
                      {isStartingAnalysis ? (
                        <>
                          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Starting...
                        </>
                      ) : (
                        "Start Analysis"
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetState}>
                      Upload Another
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardContent>
              <div className="flex items-start gap-3">
                <svg
                  className="h-6 w-6 shrink-0 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    Error
                  </h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setError(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Upload Your Codebase</CardTitle>
            <CardDescription>
              Choose how you want to provide your code for scanning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="zip" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="zip">Upload ZIP File</TabsTrigger>
                <TabsTrigger value="github">GitHub Repository</TabsTrigger>
              </TabsList>

              <TabsContent value="zip" className="mt-6">
                <div className="space-y-4">
                  <div
                    className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    
                    {uploadedFile ? (
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-green-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {uploadedFile.name}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {formatFileSize(uploadedFile.size)}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFile(null);
                          }}
                          className="mt-2 text-sm text-red-500 hover:text-red-600"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-zinc-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-zinc-500">ZIP files only (max 50MB)</p>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleZipUpload}
                    disabled={!uploadedFile || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      "Scan Codebase"
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="github" className="mt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="repo-url">Repository URL</Label>
                    <Input
                      id="repo-url"
                      type="url"
                      placeholder="https://github.com/username/repository"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500">
                      Enter the full URL of your GitHub repository
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pat-token">
                      Personal Access Token (PAT)
                      <span className="ml-1 text-xs font-normal text-zinc-400">— optional for public repos</span>
                    </Label>
                    <Input
                      id="pat-token"
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={patToken}
                      onChange={(e) => setPatToken(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500">
                      Required for private repositories. Generate a token with repo access at{" "}
                      <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        GitHub Settings
                      </a>
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleGitHubFetch}
                    disabled={!repoUrl || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Fetching...
                      </>
                    ) : (
                      "Fetch & Scan Repository"
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Your code is analyzed securely and never stored permanently
        </p>
      </main>
    </div>
  );
}
