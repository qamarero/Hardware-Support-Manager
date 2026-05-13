"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { supportSubmissions, incidents, eventLogs, clients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/get-session";
import {
  createSubmissionSchema,
  dismissSubmissionSchema,
  convertSubmissionSchema,
} from "@/lib/validators/support-submission";
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/constants/support-submissions";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { generateSequentialId } from "@/lib/utils/id-generator";
import {
  getSupportSubmissions,
  getPendingSubmissionsCount,
  findClientByName,
  type SupportSubmissionRow,
} from "@/server/queries/support-submissions";
import type { ActionResult, PaginationParams } from "@/types";
import type { SupportSubmissionStatus } from "@/lib/constants/support-submissions";
import { ilike, isNull } from "drizzle-orm";

/**
 * PUBLIC action — no auth required.
 * Creates a new support submission from the CX team public form.
 */
export async function submitSupportRequest(
  input: unknown
): Promise<ActionResult<{ submissionId: string }>> {
  // Rate limit by IP
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const rateLimitResult = checkRateLimit(
    `submit:${ip}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: "Demasiadas sumisiones desde esta IP. Espera unos minutos.",
    };
  }

  // Validate input
  const parsed = createSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos: ${fields}` };
  }

  // Honeypot: if "website" field has any value, silently reject as spam
  if (parsed.data.website && parsed.data.website.length > 0) {
    // Return fake success to not tip off bots
    return { success: true, data: { submissionId: "honeypot" } };
  }

  const {
    submitterName,
    submitterEmail,
    clientName,
    title,
    description,
    priority,
    deviceType,
    deviceBrand,
    deviceModel,
    deviceSerialNumber,
    contactPhone,
    intercomUrl,
  } = parsed.data;

  try {
    // Try to auto-match client by name
    let matchedClientId: string | null = null;
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(ilike(clients.name, clientName.trim()), isNull(clients.deletedAt)))
      .limit(1);
    if (client) matchedClientId = client.id;

    const [submission] = await db
      .insert(supportSubmissions)
      .values({
        submitterName,
        submitterEmail,
        clientName,
        clientId: matchedClientId,
        title,
        description,
        priority,
        deviceType: deviceType || null,
        deviceBrand: deviceBrand || null,
        deviceModel: deviceModel || null,
        deviceSerialNumber: deviceSerialNumber || null,
        contactPhone: contactPhone || null,
        intercomUrl: intercomUrl || null,
      })
      .returning({ id: supportSubmissions.id });

    revalidatePath("/submissions");
    return { success: true, data: { submissionId: submission.id } };
  } catch (err) {
    console.error("submitSupportRequest error:", err);
    return { success: false, error: "Error al enviar la sumisión" };
  }
}

/** Auth-required: fetch paginated list of submissions */
export async function fetchSupportSubmissions(
  params: PaginationParams & { status?: SupportSubmissionStatus }
) {
  await getRequiredSession();
  return getSupportSubmissions(params);
}

/** Auth-required: count of pending submissions (for sidebar badge) */
export async function fetchPendingSubmissionsCount(): Promise<number> {
  await getRequiredSession();
  return getPendingSubmissionsCount();
}

/** Auth-required: find client by name (for manual matching in review UI) */
export async function fetchClientByName(name: string) {
  await getRequiredSession();
  return findClientByName(name);
}

/** Auth-required: convert a submission into an incident */
export async function convertSubmissionToIncident(
  input: unknown
): Promise<ActionResult<{ incidentId: string; incidentNumber: string }>> {
  const session = await getRequiredSession();

  const parsed = convertSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    return { success: false, error: `Datos inválidos: ${fields}` };
  }

  const { submissionId, category, hardwareOrigin, ...overrides } = parsed.data;

  try {
    // Fetch submission
    const [submission] = await db
      .select()
      .from(supportSubmissions)
      .where(eq(supportSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return { success: false, error: "Sumisión no encontrada" };
    }

    if (submission.status === "convertida") {
      return { success: false, error: "Esta sumisión ya fue convertida" };
    }

    // Resolve final values (overrides from reviewer > original submission)
    const finalTitle = overrides.title || submission.title;
    const finalDescription = overrides.description || submission.description;
    const finalPriority = overrides.priority || submission.priority;
    const finalClientId = overrides.clientId || submission.clientId;
    const finalDeviceType = overrides.deviceType ?? submission.deviceType;
    const finalDeviceBrand = overrides.deviceBrand ?? submission.deviceBrand;
    const finalDeviceModel = overrides.deviceModel ?? submission.deviceModel;
    const finalDeviceSerial = overrides.deviceSerialNumber ?? submission.deviceSerialNumber;
    const finalContactPhone = overrides.contactPhone ?? submission.contactPhone;
    const finalIntercomUrl = overrides.intercomUrl ?? submission.intercomUrl;

    // Resolve client name from ID or free text
    let resolvedClientName: string | null = submission.clientName;
    if (finalClientId) {
      const [client] = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, finalClientId))
        .limit(1);
      if (client) resolvedClientName = client.name;
    }

    const result = await db.transaction(async (tx) => {
      const incidentNumber = await generateSequentialId("INC");

      const [newIncident] = await tx
        .insert(incidents)
        .values({
          incidentNumber,
          title: finalTitle,
          description: finalDescription,
          category,
          hardwareOrigin,
          priority: finalPriority,
          status: "nuevo",
          clientId: finalClientId || null,
          clientName: resolvedClientName,
          deviceType: finalDeviceType || null,
          deviceBrand: finalDeviceBrand || null,
          deviceModel: finalDeviceModel || null,
          deviceSerialNumber: finalDeviceSerial || null,
          contactName: submission.submitterName, // CX submitter as contact
          contactPhone: finalContactPhone || null,
          intercomUrl: finalIntercomUrl || null,
        })
        .returning({ id: incidents.id, incidentNumber: incidents.incidentNumber });

      await tx
        .update(supportSubmissions)
        .set({
          status: "convertida",
          convertedIncidentId: newIncident.id,
          convertedByUserId: session.user.id,
          convertedAt: new Date(),
        })
        .where(eq(supportSubmissions.id, submissionId));

      await tx.insert(eventLogs).values({
        entityType: "incident",
        entityId: newIncident.id,
        action: "created",
        toState: "nuevo",
        userId: session.user.id,
        details: {
          source: "support_submission",
          submissionId,
          submitterEmail: submission.submitterEmail,
        },
      });

      return newIncident;
    });

    revalidatePath("/submissions");
    revalidatePath("/incidents");
    return {
      success: true,
      data: { incidentId: result.id, incidentNumber: result.incidentNumber },
    };
  } catch (err) {
    console.error("convertSubmissionToIncident error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al convertir sumisión: ${message}` };
  }
}

/** Auth-required: dismiss a submission */
export async function dismissSubmission(
  input: unknown
): Promise<ActionResult<void>> {
  const session = await getRequiredSession();

  const parsed = dismissSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  try {
    await db
      .update(supportSubmissions)
      .set({
        status: "descartada",
        dismissedByUserId: session.user.id,
        dismissedAt: new Date(),
        dismissReason: parsed.data.reason || null,
      })
      .where(eq(supportSubmissions.id, parsed.data.submissionId));

    revalidatePath("/submissions");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al descartar sumisión" };
  }
}

export type { SupportSubmissionRow };
