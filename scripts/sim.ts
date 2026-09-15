#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import {
  SCENARIO_NAMES,
  isScenarioName,
  runScenarios,
  runSimulation,
} from "../src/headless.ts";
import type { ScenarioName } from "../src/headless.ts";

type OutputFormat = "json" | "csv";

function usage(): string {
  return [
    "Usage: npm run sim -- [--scenario NAME|all] [--dt N] [--output PATH] [--format json|csv]",
    `Scenarios: ${SCENARIO_NAMES.join(", ")}`,
  ].join("\n");
}

function parseArgs(args: string[]): { scenario: string; dt?: number; output?: string; format: OutputFormat } {
  let scenario = "balanced";
  let dt: number | undefined;
  let output: string | undefined;
  let format: OutputFormat = "json";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    const value = args[index + 1];
    if (arg === "--scenario" && value) { scenario = value; index += 1; continue; }
    if (arg === "--dt" && value) { dt = Number(value); index += 1; continue; }
    if (arg === "--output" && value) { output = value; index += 1; continue; }
    if (arg === "--format" && value) {
      if (value !== "json" && value !== "csv") throw new Error(`Unknown format: ${value}`);
      format = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n${usage()}`);
  }
  if (dt !== undefined && (!Number.isFinite(dt) || dt <= 0)) throw new Error("--dt must be a positive number");
  return { scenario, dt, output, format };
}

function csvCell(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${String(text ?? "").replace(/"/g, '""')}"`;
}

function toCsv(results: ReturnType<typeof runSimulation>[]): string {
  if (results.length === 0) return "\n";
  const fields = ["scenario", "outcome", "time", "classroomTime", "distance", "cause", "failures", "acceptedActions", "warnings", "extrema"] as const;
  const rows = [fields.join(",")];
  for (const result of results) rows.push(fields.map((field) => csvCell(result[field])).join(","));
  return `${rows.join("\n")}\n`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.scenario !== "all" && !isScenarioName(args.scenario)) throw new Error(`Unknown scenario: ${args.scenario}\n${usage()}`);
  const options = { dt: args.dt, trace: false };
  const results = args.scenario === "all"
    ? runScenarios(SCENARIO_NAMES, options)
    : [runSimulation({ ...options, scenario: args.scenario as ScenarioName, policy: args.scenario as ScenarioName })];
  const output = args.format === "csv" ? toCsv(results) : `${JSON.stringify(results.length === 1 ? results[0] : results, null, 2)}\n`;
  if (args.output) writeFileSync(args.output, output, "utf8");
  else process.stdout.write(output);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
