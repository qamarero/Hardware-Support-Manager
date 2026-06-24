import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { SUBMIT_IMAGE_TYPES, SUBMIT_MAX_IMAGE_SIZE } from "@/lib/constants/support-submissions";

/**
 * Endpoint de firma para subir imágenes desde el formulario PÚBLICO /submit.
 * A diferencia de /api/upload/sign, NO exige sesión (el formulario es público),
 * pero está acotado: solo imágenes y un tamaño máximo conservador. Solo genera
 * un token de subida a nuestro Blob para ese tipo/tamaño; no expone nada más.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...SUBMIT_IMAGE_TYPES],
        maximumSizeInBytes: SUBMIT_MAX_IMAGE_SIZE,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // Sin acción: la URL se devuelve al cliente y viaja con el formulario.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("[submit-upload/sign] Error firmando subida pública:", err);
    const message = err instanceof Error ? err.message : "Error al firmar la subida";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
