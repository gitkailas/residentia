import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { session, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    if (role === "master_admin" || role === "owner") nav({ to: "/admin/dashboard" });
    else nav({ to: "/resident/home" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary via-primary to-[oklch(0.25_0.05_250)] px-4">
      <header className="py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 text-primary-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-gold-foreground shadow-sm">
              <span className="font-bold">R</span>
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold">Residentia</div>
              <div className="text-[11px] uppercase tracking-wider opacity-80">
                RWA Malabar Red Orchids
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-xl">
          <Brand />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Enter your credentials to continue.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Phone</Label>
              <Input id="email" type="text" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email or phone number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            Residentia — RWA Malabar Red Orchids · Resident & Admin Portal
          </p>
        </Card>
      </main>

      <footer className="py-6 text-center text-xs text-primary-foreground/70">
        © {new Date().getFullYear()} Residentia — RWA Malabar Red Orchids
      </footer>
    </div>
  );
}
