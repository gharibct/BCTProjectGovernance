"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";

import {
  PASSWORD_MIN_LENGTH,
  useAuthConfig,
  useChangePassword,
  useLogout,
} from "@/lib/api/auth";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Rendered only while open (the parent mounts/unmounts it), so every field
// starts empty on each open and no typed password lingers in state after it
// closes — no reset effect needed.
function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (next.length < PASSWORD_MIN_LENGTH) {
      setError(`New password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from the current password.");
      return;
    }

    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          toast.success("Password changed.");
          onClose();
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Failed to change password."),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one of at least{" "}
            {PASSWORD_MIN_LENGTH} characters.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-current">Current password</Label>
            <Input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <Input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={changePassword.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? <ButtonSpinner /> : null}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const logout = useLogout();
  const { data: authConfig } = useAuthConfig();
  const [changeOpen, setChangeOpen] = React.useState(false);

  if (!user) return null;

  const canChangePassword = authConfig?.auth_type === "password";

  const handleSignOut = () => {
    logout.mutate(undefined, {
      onSettled: (data) => {
        signOut();
        // The QueryClient lives for the whole SPA session and is keyed by
        // query name only, not by user — without this, a different person
        // signing in right after (same tab, no full reload) can still be
        // served this user's cached data (e.g. their own rejected project
        // creation requests) until each query happens to refetch.
        queryClient.clear();
        if (data?.logout_url) {
          window.location.href = data.logout_url;
        } else {
          router.push("/login");
        }
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Profile menu"
          className="flex size-9 items-center justify-center rounded-full bg-[#1a6fc4] text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#1a6fc4] focus-visible:ring-offset-2"
        >
          {initials(user.full_name)}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56">
          <div className="px-2.5 py-2">
            <p className="text-sm font-semibold text-slate-900">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="my-1 border-t border-slate-100" />
          {canChangePassword ? (
            <DropdownMenuItem onSelect={() => setChangeOpen(true)}>
              <KeyRound className="size-4" />
              Change Password
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {changeOpen ? <ChangePasswordDialog onClose={() => setChangeOpen(false)} /> : null}
    </>
  );
}
