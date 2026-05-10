type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, stage: string, message: string, data?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    stage,
    message,
    ...(data ? { data } : {}),
  };
  if (level === "error") {
    console.error(`[${stage}] ${message}`);
  } else {
    console.log(`[${stage}] ${message}`);
  }
  if (data && level === "debug") {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (stage: string, message: string, data?: Record<string, unknown>) => log("info", stage, message, data),
  warn: (stage: string, message: string, data?: Record<string, unknown>) => log("warn", stage, message, data),
  error: (stage: string, message: string, data?: Record<string, unknown>) => log("error", stage, message, data),
  debug: (stage: string, message: string, data?: Record<string, unknown>) => log("debug", stage, message, data),
};
