import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { vercelBlobStorage } from "@/lib/storage/vercel-blob";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants/attachments";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "El archivo excede el tamaño máximo permitido (10MB)" }, { status: 400 });
  }

  if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  try {
    const timestamp = Date.now();
    const path = `attachments/${timestamp}-${file.name}`;
    const result = await vercelBlobStorage.upload(file, path);
    return NextResponse.json({ url: result.url, fileName: file.name, fileSize: file.size, fileType: file.type });
  } catch (err) {
    console.error("[upload] Error al subir el archivo:", err);
    const message = err instanceof Error ? err.message : "Error al subir el archivo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
