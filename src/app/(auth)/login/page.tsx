"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Mensaje deliberadamente genérico: decir «no existe ese correo»
      // confirmaría a un desconocido qué cuentas hay dadas de alta.
      setError("Correo o contraseña incorrectos");
      setIsLoading(false);
    } else {
      // Se entra directo al destino del rol en vez de mandar a todo el mundo a
      // /dashboard y dejar que el middleware rebote al Visor hasta /consulta.
      // Ese rebote, encadenado con un router.refresh(), descartaba las Server
      // Actions que /consulta lanza al montar: Next deja su promesa sin
      // resolver ni rechazar, y la pantalla se quedaba en «Cargando…» para
      // siempre. El refresh sobra: push ya trae el árbol nuevo del servidor.
      const session = await getSession();
      router.push(session?.user?.role === "viewer" ? "/consulta" : "/dashboard");
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-lg lg:shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground lg:hidden">
          HSM
        </div>
        <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
        <CardDescription>Introduce tus credenciales para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@empresa.com"
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
