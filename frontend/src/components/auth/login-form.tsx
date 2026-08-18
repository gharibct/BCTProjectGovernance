"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useAuthConfig, useLogin } from "@/lib/api/auth";
import { ROLE_LANDING_ROUTE } from "@/lib/menu-config";
import { useSession } from "@/stores/session";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const authConfig = useAuthConfig();
  const login = useLogin();
  const setSessionUser = useSession((s) => s.signIn);

  // No password check — this prototype has no auth system yet (LDAP
  // planned); the identifier just has to resolve to an active user (see
  // backend/app/api/v1/endpoints/auth.py).
  const signIn = () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter your corporate email or LDAP username.");
      return;
    }
    login.mutate(email.trim(), {
      onSuccess: (user) => {
        setSessionUser(user);
        router.push(ROLE_LANDING_ROUTE[user.role.code]);
      },
      onError: (err) => {
        setError(err instanceof ApiError && err.status === 404 ? "No active user found for that identifier." : "Sign-in failed. Try again.");
      },
    });
  };

  if (authConfig.isPending) {
    return null;
  }

  if (authConfig.data?.auth_type === "onelogin") {
    return (
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Sign In
        </h2>

        <p className="mt-4 text-sm text-slate-600">
          This app now signs in through your organization&apos;s OneLogin
          account.
        </p>

        <Button
          type="button"
          onClick={() => {
            window.location.href = "/api/v1/auth/onelogin/login";
          }}
          className="mt-8 h-12 w-full rounded-lg bg-[#16283e] text-sm font-semibold tracking-[0.08em] text-white uppercase hover:bg-[#1d3350]"
        >
          Sign in with OneLogin
        </Button>

        <div className="mt-8 flex items-start gap-3 rounded-xl bg-slate-100 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-slate-500" />
          <p className="text-sm leading-relaxed text-slate-600">
            Authorized personnel only. Secure login is monitored via session
            auditing. Version 0.1.0 — internal build.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight text-slate-900">
        Sign In
      </h2>

      <form
        className="mt-10"
        onSubmit={(e) => {
          e.preventDefault();
          signIn();
        }}
      >
        <div>
          <Label
            htmlFor="email"
            className="text-sm font-semibold text-slate-800"
          >
            Corporate Email
          </Label>
          <div className="relative mt-2">
            <Mail className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-lg bg-slate-50 pl-11 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-sm font-semibold text-slate-800"
            >
              Password
            </Label>
            <a
              href="#"
              className="text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative mt-2">
            <Lock className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-12 rounded-lg bg-slate-50 pr-12 pl-11 text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-500 hover:text-slate-700"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Checkbox id="remember" className="size-5 rounded-md" />
          <Label
            htmlFor="remember"
            className="text-base font-normal text-slate-700"
          >
            Remember this device
          </Label>
        </div>

        <Button
          type="submit"
          className="mt-8 h-12 w-full rounded-lg bg-[#16283e] text-sm font-semibold tracking-[0.08em] text-white uppercase hover:bg-[#1d3350]"
        >
          Sign in to System
        </Button>
      </form>

      <div className="mt-8 flex items-start gap-3 rounded-xl bg-slate-100 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-slate-500" />
        <p className="text-sm leading-relaxed text-slate-600">
          Authorized personnel only. Secure login is monitored via session
          auditing. Version 0.1.0 — internal build.
        </p>
      </div>
    </div>
  );
}
