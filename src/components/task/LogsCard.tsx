"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogEntry } from "./types";
import { formatTime, getLogColor } from "./utils";

interface LogsCardProps {
  logs: LogEntry[];
}

export function LogsCard({ logs }: LogsCardProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
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
  );
}
