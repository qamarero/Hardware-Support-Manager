import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <FileQuestion className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold">Página no encontrada</h2>
      <p className="max-w-md text-muted-foreground">
        La página que buscas no existe o ha sido movida.
      </p>
      <Button asChild>
        <Link href="/dashboard">Volver al panel</Link>
      </Button>
    </div>
  );
}
