"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resetPassword } from "@/server/actions/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const adminPassword = formData.get("adminPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    const result = await resetPassword({ email, newPassword, adminPassword });

    if (result.success) {
      toast.success("Contraseña actualizada correctamente");
      router.push("/login");
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Restaurar Contraseña</CardTitle>
        <CardDescription>
          Se requiere la contraseña de un administrador para verificar la
          solicitud
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email de la cuenta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="usuario@empresa.com"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repite la contraseña"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>
          <hr className="my-2" />
          <div className="space-y-2">
            <Label htmlFor="adminPassword">
              Contraseña de administrador
            </Label>
            <Input
              id="adminPassword"
              name="adminPassword"
              type="password"
              placeholder="Contraseña de cualquier admin activo"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Un administrador debe autorizar el cambio de contraseña
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Actualizando..." : "Restaurar Contraseña"}
          </Button>
          <div className="text-center text-sm">
            <Link
              href="/login"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Volver a Iniciar Sesión
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
