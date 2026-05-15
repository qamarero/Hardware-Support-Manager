import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/constants/attachments";

/**
 * Endpoint de firma para uploads directos navegador → Vercel Blob.
 * Evita el límite de 4.5 MB del body de Vercel serverless functions:
 * el archivo no pasa por la función, sino que va directo al store de Blob
 * usando un token firmado.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user) {
          throw new Error("No autenticado");
        }
        return {
          allowedContentTypes: [...ALLOWED_FILE_TYPES],
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[upload/sign] Blob subido:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("[upload/sign] Error firmando upload:", err);
    const message = err instanceof Error ? err.message : "Error al firmar la subida";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
