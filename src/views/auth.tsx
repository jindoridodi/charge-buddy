"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/PageHeader";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/client";

function Password({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Toggle password">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e);

export default function AuthPage() {
  const { set } = useApp();
  const navigate = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", purpose: "driver" as "driver" | "host" | "both" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const up = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const { data: { subscription } } = getBrowserSupabase().auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setMode("reset");
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch {
      // The page remains usable in demo mode until an auth action is requested.
    }
    return () => unsubscribe?.();
  }, []);

  const finish = (name: string, purpose: typeof f.purpose) => {
    set({ user: { name, email: f.email, phone: "(408) 555-0142", purpose }, role: purpose === "host" ? "host" : "driver" });
    toast.success(`Welcome, ${name.split(" ")[0]}!`);
    navigate.push("/dashboard");
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!emailOk(f.email)) er["email"] = "Enter a valid email";
    if (f.password.length < 6) er["password"] = "Password must be at least 6 characters";
    setErrors(er);
    if (Object.keys(er).length) return;
    try {
      const { data, error } = await getBrowserSupabase().auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) throw error;
      const purpose = data.user.user_metadata["purpose"];
      finish(data.user.user_metadata["full_name"] || (f.email.split("@")[0] ?? "Member"), purpose === "host" || purpose === "both" ? purpose : "driver");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign in"); }
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er["name"] = "Enter your full name";
    if (!emailOk(f.email)) er["email"] = "Enter a valid email";
    if (f.password.length < 6) er["password"] = "At least 6 characters";
    if (f.confirm !== f.password) er["confirm"] = "Passwords don't match";
    setErrors(er);
    if (Object.keys(er).length) return;
    try {
      const { data, error } = await getBrowserSupabase().auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name.trim(), purpose: f.purpose } } });
      if (error) throw error;
      if (data.session) finish(f.name.trim(), f.purpose);
      else toast.success("Check your email to confirm your account, then log in.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create account"); }
  };

  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border bg-card p-8 shadow-card">
        {mode === "reset" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (f.password.length < 6) return setErrors({ password: "Password must be at least 6 characters" });
              if (f.confirm !== f.password) return setErrors({ confirm: "Passwords don't match" });
              getBrowserSupabase().auth.updateUser({ password: f.password }).then(({ error }) => {
                if (error) toast.error(error.message); else { toast.success("Password updated. Please sign in."); setMode("login"); setF({ ...f, password: "", confirm: "" }); }
              }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not update password"));
            }}
            className="space-y-4"
          >
            <h1 className="text-2xl font-bold">Choose a new password</h1>
            <Field label="New password"><Password value={f.password} onChange={up("password")} /></Field>
            <Err k="password" />
            <Field label="Confirm password"><Password value={f.confirm} onChange={up("confirm")} /></Field>
            <Err k="confirm" />
            <Button className="w-full">Update password</Button>
          </form>
        ) : mode === "forgot" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!emailOk(f.email)) return setErrors({ email: "Enter a valid email" });
              getBrowserSupabase().auth.resetPasswordForEmail(f.email, { redirectTo: `${window.location.origin}/auth` }).then(({ error }) => {
                if (error) toast.error(error.message); else { toast.success("Reset link sent"); setMode("login"); }
              }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not send reset link"));
            }}
            className="space-y-4"
          >
            <h1 className="text-2xl font-bold">Reset password</h1>
            <p className="text-sm text-muted-foreground">We'll email you a link to reset your password.</p>
            <Field label="Email"><Input value={f.email} onChange={(e) => up("email")(e.target.value)} /></Field>
            <Err k="email" />
            <Button className="w-full">Send reset link</Button>
            <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-primary">Back to login</button>
          </form>
        ) : (
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "login"); setErrors({}); }}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={login} className="space-y-4">
                <Field label="Email"><Input value={f.email} onChange={(e) => up("email")(e.target.value)} placeholder="you@example.com" /></Field>
                <Err k="email" />
                <Field label="Password"><Password value={f.password} onChange={up("password")} /></Field>
                <Err k="password" />
                <button type="button" onClick={() => setMode("forgot")} className="text-sm text-primary">Forgot password?</button>
                <Button className="w-full">Log in</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signup} className="space-y-4">
                <Field label="Full name"><Input value={f.name} onChange={(e) => up("name")(e.target.value)} /></Field>
                <Err k="name" />
                <Field label="Email address"><Input value={f.email} onChange={(e) => up("email")(e.target.value)} /></Field>
                <Err k="email" />
                <Field label="Password"><Password value={f.password} onChange={up("password")} /></Field>
                <Err k="password" />
                <Field label="Confirm password"><Password value={f.confirm} onChange={up("confirm")} /></Field>
                <Err k="confirm" />
                <div className="space-y-2">
                  <span className="text-sm font-medium">I want to…</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([["driver", "Find & rent"], ["host", "List my charger"], ["both", "Both"]] as const).map(([v, l]) => (
                      <button type="button" key={v} onClick={() => setF({ ...f, purpose: v })} className={`rounded-xl border p-3 text-xs font-semibold transition-colors ${f.purpose === v ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">You can switch between driver and host anytime.</p>
                </div>
                <Button className="w-full">Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">Accounts use Supabase email/password authentication.</p>
      </div>
    </div>
  );
}
