"use client";

import { Button } from "@/components/ui/button";
import { FullScreenLoadingState } from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { signInUser } from "@/actions/auth/auth-action";
import { getHomePathForRole, normalizeRole } from "@/lib/rbac";
import { withMinimumDelay } from "@/lib/min-loading-delay";
import Image from "next/image";

const SignInForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    let shouldResetLoading = true;

    try {
      const result = await withMinimumDelay(
        signInUser({ username, password }),
      );

      if (result.success && result.user) {
        const role = normalizeRole(result.user.role);
        if (!role) {
          setError("Your account role is not recognized. Contact an admin.");
          return;
        }

        toast.success("Signed in successfully.", {
          description: "Redirecting you to your dashboard.",
        });
        shouldResetLoading = false;
        router.replace(getHomePathForRole(role));
        return;
      } else {
        setError(
          result.error || "Sign in failed. Please check your credentials."
        );
      }
    } catch (error) {
      setError("An error occurred. Please try again");
      console.error("Sign in error:", error);
    } finally {
      if (shouldResetLoading) {
        setLoading(false);
      }
    }
  };

  return (
    <>
      {loading ? (
        <FullScreenLoadingState
          title="Signing you in"
          description="Verifying your credentials and preparing the right dashboard for your role."
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-[30rem] flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-300/35 blur-2xl dark:bg-orange-500/18" />
            <Image
              src="/logo-icon.png"
              alt="JumboCrab EMIS logo"
              width={132}
              height={132}
              className="relative h-33 w-33 object-contain drop-shadow-[0_18px_34px_rgba(249,115,22,0.28)]"
              priority
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary/80">
              Secure Portal
            </p>
            <p className="mt-2 text-[2rem] font-extrabold tracking-tight text-foreground dark:text-slate-50">
              JumboCrab EMIS
            </p>
            <p className="mt-2 text-base text-muted-foreground dark:text-slate-300">
              Employee Management Information System
            </p>
          </div>
        </div>

        <Card className="w-full rounded-[2rem] border-white/70 bg-white/92 shadow-[0_28px_90px_-42px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-slate-950/78 dark:shadow-[0_30px_90px_-36px_rgba(0,0,0,0.78)]">
          <CardHeader className="space-y-2 px-6 pt-8 text-center sm:px-8">
            <CardTitle className="text-4xl font-extrabold tracking-tight text-foreground dark:text-white">
              Sign In
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2.5">
                <Label
                  htmlFor="username"
                  className="text-base font-semibold text-foreground dark:text-slate-200"
                >
                  Username
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <User className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    className="h-14 rounded-2xl border-slate-200 bg-slate-50/90 pl-13 text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus-visible:border-primary/50 focus-visible:bg-white focus-visible:ring-primary/20 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-primary/60 dark:focus-visible:bg-slate-950 dark:focus-visible:ring-primary/25"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-base font-semibold text-foreground dark:text-slate-200"
                  >
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-14 rounded-2xl border-slate-200 bg-slate-50/90 pl-13 pr-13 text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus-visible:border-primary/50 focus-visible:bg-white focus-visible:ring-primary/20 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-primary/60 dark:focus-visible:bg-slate-950 dark:focus-visible:ring-primary/25"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => {
                      setShowPassword((current) => !current);
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_18px_38px_-20px_rgba(249,115,22,0.9)] dark:shadow-[0_18px_38px_-18px_rgba(249,115,22,0.65)]"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="px-6 pb-8 pt-0 sm:px-8">
            <p className="w-full text-center text-sm leading-relaxed text-muted-foreground dark:text-slate-400">
              No account yet? Please contact your administrator.
            </p>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};

export default SignInForm;
