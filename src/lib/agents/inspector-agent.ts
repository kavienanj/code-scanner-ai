import { openai } from "@ai-sdk/openai";
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from "ai";
import { promises as fs } from "fs";
import path from "path";
import { EndpointProfile } from "./sentinel-agent";
import { SecurityChecklist, SecurityControl } from "./guardian-agent";

// ============================================================================
// Configuration & Constants
// ============================================================================

/** Output directory for debug JSON files */
export const INSPECTOR_OUTPUT_DIR = path.join(process.cwd(), "output", "inspector-agent");

/** Default model to use for the Inspector Agent */
export const INSPECTOR_DEFAULT_MODEL = "claude-opus-4-5-20251101"; // "gpt-5.1-2025-11-13";

/** Maximum retries for parsing agent response */
export const INSPECTOR_MAX_RETRIES = 3;

/** System prompt for the Inspector Agent */
export const INSPECTOR_SYSTEM_PROMPT = `You are the Inspector Agent, a security auditor that matches code implementations against security checklists.

You will receive:
1. An endpoint's flow data including detailed markdown documentation of the code
2. A security checklist with required and recommended controls

## Your Task:

Analyze the code documentation and determine for each security control whether it is:
- **Implemented**: The control is present in the code (cite specific file and line numbers)
- **Missing**: The control is not implemented and should be added
- **Auto-Handled**: The framework or library automatically handles this (e.g., ORM prevents SQL injection)

## Your Process:

### Step 1: Review the Code
Read the markdown documentation carefully. Look for:
- Authentication/authorization checks
- Input validation logic
- Error handling patterns
- Security middleware usage
- Database query patterns
- Encryption/hashing usage

### Step 2: Match Controls
For each control in the checklist:
1. Search the code for evidence of implementation
2. If found, note the file path and line number(s)
3. If handled by framework, explain how
4. If missing, confirm it's not present

### Step 3: Assign Severity
For MISSING controls only, assign severity based on:
- **Critical**: Immediate security risk, data breach potential
- **High**: Significant vulnerability, should fix before production
- **Medium**: Security gap, plan to address
- **Low**: Minor improvement, nice to have

## IMPORTANT: Be Practical
- Don't be overly strict - moderate security is the goal
- If a control is partially implemented, mark as implemented with a note
- Consider the endpoint's sensitivity level
- Framework defaults count as auto-handled

## Response Format:

\`\`\`json
{
  "status": "completed",
  "result": {
    "flow_name": "User Authentication",
    "implemented": [
      {
        "control_id": "AUTH-001",
        "control_name": "Password Hashing",
        "evidence": "Uses bcrypt with cost factor 12",
        "location": {
          "file": "src/services/auth.service.ts",
          "code_snippet": "const hashedPassword = await bcrypt.hash(password, 12);"
        }
      }
    ],
    "missing": [
      {
        "control_id": "AUTH-003",
        "control_name": "Rate Limiting",
        "reason": "No rate limiting middleware found on login endpoint",
        "severity": "high",
        "recommendation": "Add express-rate-limit middleware to /auth/login route"
      }
    ],
    "auto_handled": [
      {
        "control_id": "INJ-001",
        "control_name": "SQL Injection Prevention",
        "handled_by": "Prisma ORM",
        "explanation": "Prisma uses parameterized queries by default"
      }
    ],
    "summary": {
      "total_controls": 10,
      "implemented_count": 6,
      "missing_count": 2,
      "auto_handled_count": 2,
      "overall_severity": "medium"
    }
  }
}
\`\`\`

## Severity Guidelines:
- **Critical**: 1+ critical missing controls
- **High**: No critical but 1+ high missing controls
- **Medium**: No critical/high but 1+ medium missing controls
- **Low**: Only low severity missing controls or none missing

Keep code_snippet to the most relevant line(s) of code (max 3 lines, can be multiline string).
Be concise but specific in evidence and recommendations.`;

// ============================================================================
// Types
// ============================================================================

/** Severity levels for missing controls */
export type SecuritySeverity = "critical" | "high" | "medium" | "low";

/** Code location reference */
export interface CodeLocation {
  file: string;
  code_snippet: string;
}

/** Implemented control finding */
export interface ImplementedControl {
  control_id: string;
  control_name: string;
  evidence: string;
  location: CodeLocation;
}

/** Missing control finding */
export interface MissingControl {
  control_id: string;
  control_name: string;
  reason: string;
  severity: SecuritySeverity;
  recommendation: string;
}

/** Auto-handled control finding */
export interface AutoHandledControl {
  control_id: string;
  control_name: string;
  handled_by: string;
  explanation: string;
}

/** Security report summary */
export interface SecurityReportSummary {
  total_controls: number;
  implemented_count: number;
  missing_count: number;
  auto_handled_count: number;
  overall_severity: SecuritySeverity | "none";
}

/** Complete security report for a flow */
export interface SecurityReport {
  flow_name: string;
  implemented: ImplementedControl[];
  missing: MissingControl[];
  auto_handled: AutoHandledControl[];
  summary: SecurityReportSummary;
}

/** Inspector Agent completed response */
export interface InspectorCompletedResponse {
  status: "completed";
  result: SecurityReport;
}

/** Inspector Agent error response */
export interface InspectorErrorResponse {
  status: "error";
  message: string;
}

export type InspectorAgentResponse =
  | InspectorCompletedResponse
  | InspectorErrorResponse;

/** Options for Inspector Agent */
export interface InspectorAgentOptions {
  model?: string;
  maxRetries?: number;
  onLog?: (message: string) => void;
  abortSignal?: AbortSignal;
  /** Enable saving debug output to JSON files */
  saveDebugOutput?: boolean;
}

/** Input for inspection - combines endpoint profile with its checklist */
export interface InspectionInput {
  endpoint: EndpointProfile;
  checklist: SecurityChecklist;
}

/** Debug output structure saved to JSON */
export interface InspectorDebugOutput {
  timestamp: string;
  model: string;
  flowsInspected: number;
  reportsGenerated: SecurityReport[];
  analysisHistory: Array<{
    flow_name: string;
    conversationHistory: Array<{ role: string; content: string }>;
    retries: number;
    success: boolean;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Save debug output to a JSON file
 */
async function saveInspectorDebugOutput(output: InspectorDebugOutput): Promise<string> {
  try {
    // Ensure output directory exists
    await fs.mkdir(INSPECTOR_OUTPUT_DIR, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `inspector-output-${timestamp}.json`;
    const filepath = path.join(INSPECTOR_OUTPUT_DIR, filename);
    
    // Write the output
    await fs.writeFile(filepath, JSON.stringify(output, null, 2), "utf-8");
    
    return filepath;
  } catch (error) {
    console.error("Failed to save debug output:", error);
    throw error;
  }
}

/**
 * Parse the Inspector Agent's JSON response
 */
function parseInspectorResponse(text: string): InspectorAgentResponse {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in agent response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    if (!parsed.status) {
      throw new Error("Response missing 'status' field");
    }

    if (parsed.status === "completed") {
      if (!parsed.result) {
        throw new Error("completed response missing 'result'");
      }
      if (!parsed.result.flow_name) {
        throw new Error("result missing 'flow_name'");
      }
      if (!Array.isArray(parsed.result.implemented)) {
        throw new Error("result missing 'implemented' array");
      }
      if (!Array.isArray(parsed.result.missing)) {
        throw new Error("result missing 'missing' array");
      }
      if (!Array.isArray(parsed.result.auto_handled)) {
        throw new Error("result missing 'auto_handled' array");
      }
      if (!parsed.result.summary) {
        throw new Error("result missing 'summary'");
      }
      return parsed as InspectorCompletedResponse;
    }

    if (parsed.status === "error") {
      return parsed as InspectorErrorResponse;
    }

    throw new Error(`Unknown status: ${parsed.status}`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Format controls for the prompt
 */
function formatControlsForPrompt(controls: SecurityControl[], type: string): string {
  if (controls.length === 0) {
    return `No ${type} controls.`;
  }
  
  return controls.map(c => 
    `- [${c.control_id}] ${c.name} (${c.importance}): ${c.description}`
  ).join("\n");
}

/**
 * Build the prompt for inspecting a flow
 */
function buildInspectionPrompt(input: InspectionInput): string {
  const { endpoint, checklist } = input;
  
  return `## Security Inspection Request

### Endpoint Overview:
- **Flow Name**: ${endpoint.flow_name}
- **Purpose**: ${endpoint.purpose}
- **Entry Point**: ${endpoint.entry_point}
- **Sensitivity Level**: ${endpoint.sensitivity_level}
- **Input Types**: ${endpoint.input_types.join(", ") || "None"}
- **Output Types**: ${endpoint.output_types.join(", ") || "None"}

### Code Documentation:
${endpoint.mark_down}

---

### Security Checklist to Verify:

#### Required Controls:
${formatControlsForPrompt(checklist.required_controls, "required")}

#### Recommended Controls:
${formatControlsForPrompt(checklist.recommended_controls, "recommended")}

---

Inspect the code documentation above and match it against the security checklist.
For each control, determine if it's implemented, missing, or auto-handled by the framework.

Be practical - moderate security is the goal. Mark partial implementations as implemented with notes.
For implemented controls, cite specific file paths and line numbers (max 3 lines) from the documentation.

Respond with the security report in the required JSON format.`;
}

// ============================================================================
// Main Agent Class
// ============================================================================

export class InspectorAgent {
  private model: string;
  private maxRetries: number;
  private log: (message: string) => void;
  private abortSignal?: AbortSignal;
  private saveDebugOutputEnabled: boolean;
  private analysisHistory: InspectorDebugOutput["analysisHistory"] = [];

  constructor(options: InspectorAgentOptions = {}) {
    this.model = options.model || INSPECTOR_DEFAULT_MODEL;
    this.maxRetries = options.maxRetries || INSPECTOR_MAX_RETRIES;
    this.log = options.onLog || console.log;
    this.abortSignal = options.abortSignal;
    this.saveDebugOutputEnabled = options.saveDebugOutput ?? true;
  }

  private checkCancellation(): void {
    if (this.abortSignal?.aborted) {
      throw new Error("Analysis cancelled");
    }
  }

  /**
   * Inspect multiple flows against their checklists
   */
  async inspectFlows(inputs: InspectionInput[]): Promise<SecurityReport[]> {
    const reports: SecurityReport[] = [];
    this.analysisHistory = [];

    this.log("🔍 Inspector Agent starting security inspection...");
    this.log(`📋 Flows to inspect: ${inputs.length}`);
    this.checkCancellation();

    for (let i = 0; i < inputs.length; i++) {
      this.checkCancellation();
      const input = inputs[i];
      
      this.log(`\n🕵️ [${i + 1}/${inputs.length}] Inspecting: ${input.endpoint.flow_name}`);
      this.log(`   Controls to check: ${input.checklist.required_controls.length + input.checklist.recommended_controls.length}`);

      try {
        const report = await this.inspectFlow(input);
        if (report) {
          reports.push(report);
          this.log(`   ✅ ${report.summary.implemented_count} implemented, ${report.summary.missing_count} missing, ${report.summary.auto_handled_count} auto-handled`);
          this.log(`   📊 Overall severity: ${report.summary.overall_severity}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        this.log(`   ❌ Failed to inspect flow: ${errorMsg}`);
      }
    }

    this.log(`\n✅ Inspector Agent complete. Generated ${reports.length}/${inputs.length} reports.`);

    // Save debug output if enabled
    if (this.saveDebugOutputEnabled) {
      try {
        const debugOutput: InspectorDebugOutput = {
          timestamp: new Date().toISOString(),
          model: this.model,
          flowsInspected: inputs.length,
          reportsGenerated: reports,
          analysisHistory: this.analysisHistory,
        };
        const filepath = await saveInspectorDebugOutput(debugOutput);
        this.log(`💾 Debug output saved to: ${filepath}`);
      } catch (error) {
        this.log(`⚠️ Failed to save debug output: ${error}`);
      }
    }

    return reports;
  }

  /**
   * Inspect a single flow against its checklist
   */
  private async inspectFlow(input: InspectionInput): Promise<SecurityReport | null> {
    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    let retries = 0;

    // Build the inspection prompt
    const prompt = buildInspectionPrompt(input);
    conversationHistory.push({ role: "user", content: prompt });

    while (retries < this.maxRetries) {
      this.checkCancellation();

      try {
        // Generate response from the agent
        const { text } = await generateText({
          model: this.model.startsWith("claude-") 
            ? anthropic(this.model)
            : openai(this.model),
          system: INSPECTOR_SYSTEM_PROMPT,
          messages: conversationHistory,
          abortSignal: this.abortSignal,
        });

        conversationHistory.push({ role: "assistant", content: text });

        // Parse the response
        const response = parseInspectorResponse(text);

        if (response.status === "completed") {
          // Record analysis history
          this.analysisHistory.push({
            flow_name: input.endpoint.flow_name,
            conversationHistory: conversationHistory.map(m => ({ role: m.role, content: m.content })),
            retries,
            success: true,
          });
          // Use original flow_name to ensure consistency across agents
          return {
            ...response.result,
            flow_name: input.endpoint.flow_name,
          };
        }

        if (response.status === "error") {
          this.log(`   ⚠️ Agent error: ${response.message}`);
          retries++;
          conversationHistory.push({
            role: "user",
            content: "Please try again and provide a valid security report.",
          });
        }
      } catch (error) {
        retries++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        this.log(`   ⚠️ Parse error (attempt ${retries}/${this.maxRetries}): ${errorMsg}`);
        
        // Remove failed response and retry
        if (conversationHistory.length > 1 && conversationHistory[conversationHistory.length - 1].role === "assistant") {
          conversationHistory.pop();
        }
      }
    }

    // Record failed analysis
    this.analysisHistory.push({
      flow_name: input.endpoint.flow_name,
      conversationHistory: conversationHistory.map(m => ({ role: m.role, content: m.content })),
      retries,
      success: false,
    });

    return null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInspectorAgent(options?: InspectorAgentOptions): InspectorAgent {
  return new InspectorAgent(options);
}
