"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
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
        return;
      }

      // Se entra directo al destino del rol en vez de mandar a todo el mundo a
      // /dashboard. El refresh sobra: push ya trae el árbol nuevo del servidor.
      //
      // Leer el rol NO puede impedir entrar. getSession() llama a
      // /api/auth/session, y si esa respuesta no es JSON —un proxy que
      // devuelve HTML, la red del cliente— lanza un AuthError. Sin este
      // try/catch la excepción subía, nunca se liberaba isLoading ni se
      // navegaba, y el botón se quedaba en «Entrando…» para siempre sin decir
      // nada. La sesión ya está establecida a estas alturas, así que lo
      // correcto es seguir: el middleware ya manda al Visor a /consulta.
      let destino = "/dashboard";
      try {
        const session = await getSession();
        if (session?.user?.role === "viewer") destino = "/consulta";
      } catch {
        // Destino por defecto; el middleware corrige si hace falta.
      }

      // Carga completa del servidor en vez de router.push(). Con la navegación
      // del lado cliente, si la pantalla de destino no termina de montarse el
      // botón se queda en «Entrando…» para siempre y no se ve ni un error: era
      // lo que les pasaba a los Visores, que van a /consulta, mientras los
      // Técnicos entraban porque van a /dashboard. Así el navegador navega de
      // verdad y lo que falle, si falla, se ve en la pantalla de destino.
      window.location.href = destino;
    } catch {
      setError("No se pudo completar el inicio de sesión. Inténtalo de nuevo.");
      setIsLoading(false);
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
