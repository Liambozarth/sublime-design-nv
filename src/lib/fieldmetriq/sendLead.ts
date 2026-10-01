import { createHmac } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import {
  buildLeadCreatedPayload,
  mapIntakeLead,
  mapQuoteLead,
  type FieldMetriqLeadInput,
  type IntakeLeadForFieldMetriq,
  type QuoteLeadForFieldMetriq,
} from "@/lib/fieldmetriq/payload";

const TIMEOUT_MS = 5_000;
const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

type RequestContextHolder = {
  get?: () => { waitUntil?: (promise: Promise<unknown>) => void };
};

/**
 * HMAC-SHA256 of `${timestamp}.${rawBody}` as `sha256=<hex>`.
 * `rawBody` must be the exact JSON string placed on the wire.
 */
export function signSdnvPayload(secret: string, timestamp: string, rawBody: string) {
  const hex = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `sha256=${hex}`;
}

export function fieldMetriqLeadIntakeConfig() {
  const url = process.env.FIELDMETRIQ_LEAD_INTAKE_URL?.trim() ?? "";
  const secret = process.env.SDNV_WEBHOOK_SECRET?.trim() ?? "";
  if (!url || !secret) return null;
  return { url, secret };
}

function vercelWaitUntil() {
  const holder = (globalThis as Record<symbol, RequestContextHolder | undefined>)[REQUEST_CONTEXT];
  const schedule = holder?.get?.()?.waitUntil;
  return typeof schedule === "function" ? schedule : null;
}

async function nextAfter() {
  try {
    const mod = await import("next/server");
    const candidate =
      (mod as { after?: unknown }).after ?? (mod as { unstable_after?: unknown }).unstable_after;
    return typeof candidate === "function" ? (candidate as (promise: Promise<unknown>) => void) : null;
  } catch {
    return null;
  }
}

/**
 * Prefer Next `after` or Vercel `waitUntil` so the homeowner response is not held
 * open for the partner call. If neither is available, wait for the timed request.
 */
export async function runWithoutBlockingResponse(task: Promise<unknown>) {
  try {
    const after = await nextAfter();
    if (after) {
      after(task);
      return;
    }
  } catch {
    // `after` rejects outside a request scope. Fall through and await.
  }

  const schedule = vercelWaitUntil();
  if (schedule) {
    try {
      waitUntil(task);
      return;
    } catch {
      // Context disappeared between the check and the call.
    }
  }

  await task;
}

async function postLead(url: string, secret: string, rawBody: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SDNV-Timestamp": timestamp,
      "X-SDNV-Signature": signSdnvPayload(secret, timestamp, rawBody),
    },
    body: rawBody,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  await response.body?.cancel().catch(() => undefined);
  return response;
}

function isRetryableStatus(status: number) {
  return status >= 500 && status <= 599;
}

async function deliverLead(input: FieldMetriqLeadInput) {
  const config = fieldMetriqLeadIntakeConfig();
  if (!config) {
    console.info(
      "[fieldmetriq] skipping lead intake; FIELDMETRIQ_LEAD_INTAKE_URL or SDNV_WEBHOOK_SECRET is unset",
    );
    return;
  }

  const rawBody = JSON.stringify(buildLeadCreatedPayload(input));

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await postLead(config.url, config.secret, rawBody);
      if (response.ok) {
        console.info(
          `[fieldmetriq] lead intake accepted for ${input.sourceLeadId} (HTTP ${response.status})`,
        );
        return;
      }
      if (isRetryableStatus(response.status) && attempt === 1) {
        console.error(
          `[fieldmetriq] lead intake HTTP ${response.status} for ${input.sourceLeadId}; retrying once`,
        );
        continue;
      }
      console.error(
        `[fieldmetriq] lead intake failed for ${input.sourceLeadId}: HTTP ${response.status}`,
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 1) {
        console.error(
          `[fieldmetriq] lead intake network error for ${input.sourceLeadId}; retrying once: ${message}`,
        );
        continue;
      }
      console.error(`[fieldmetriq] lead intake network error for ${input.sourceLeadId}: ${message}`);
      return;
    }
  }
}

export async function sendLeadToFieldMetriq(input: FieldMetriqLeadInput) {
  const task = deliverLead(input).catch((error) => {
    console.error(
      "[fieldmetriq] lead intake unexpected error:",
      error instanceof Error ? error.message : error,
    );
  });
  await runWithoutBlockingResponse(task);
}

export async function sendQuoteLeadToFieldMetriq(input: QuoteLeadForFieldMetriq) {
  const mapped = mapQuoteLead(input);
  if (!mapped) return;
  await sendLeadToFieldMetriq(mapped);
}

export async function sendIntakeLeadToFieldMetriq(input: IntakeLeadForFieldMetriq) {
  if (!input.id) return;
  await sendLeadToFieldMetriq(mapIntakeLead(input));
}
