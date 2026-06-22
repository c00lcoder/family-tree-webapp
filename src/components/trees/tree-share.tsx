"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

interface Person {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
}
interface Member {
  userId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  role: "admin" | "member";
}
interface Invite {
  id: string;
  email: string;
  role: "admin" | "member";
}
interface ShareData {
  owner: Person | null;
  members: Member[];
  invites: Invite[];
}

export function TreeShare({ treeId }: { treeId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ShareData | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trees/${treeId}/members`);
    if (res.ok) setData(await res.json());
  }, [treeId]);

  useEffect(() => {
    // Load members when the dialog opens; state updates happen after the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void load();
  }, [open, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/trees/${treeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Could not invite");
      setNotice(
        result.type === "invite"
          ? `Invited ${email} — they'll get access when they sign up.`
          : `Added ${email}.`,
      );
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(memberEmail: string, newRole: string) {
    setError(null);
    const res = await fetch(`/api/trees/${treeId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail, role: newRole }),
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      setError(r.error ?? "Could not change role");
    }
    await load();
  }

  async function removeMember(userId: string) {
    await fetch(`/api/trees/${treeId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    await load();
  }

  async function cancelInvite(inviteId: string) {
    await fetch(`/api/trees/${treeId}/members?inviteId=${inviteId}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-5 w-5" aria-hidden />
        Share
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share tree"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-6 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Share this tree</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="h-6 w-6" aria-hidden />
              </Button>
            </div>

            <form onSubmit={invite} className="mt-4">
              <Label htmlFor="invite-email">Invite by email</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  placeholder="relative@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={role}
                  aria-label="Role"
                  onChange={(e) => setRole(e.target.value as "member" | "admin")}
                  className="sm:w-32"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
                <Button type="submit" disabled={busy}>
                  Invite
                </Button>
              </div>
            </form>
            {notice ? (
              <p className="mt-2 text-sm text-primary" role="status">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <ul className="mt-6 space-y-2">
              {data?.owner && (
                <li className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <Identity person={data.owner} />
                  <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                    <Crown className="h-4 w-4" aria-hidden /> Owner
                  </span>
                </li>
              )}
              {data?.members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <Identity person={m} />
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      className="h-10 min-h-10 w-28 text-sm"
                      onChange={(e) => changeRole(m.email, e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.email}`}
                      onClick={() => removeMember(m.userId)}
                    >
                      <X className="h-5 w-5 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
              {data?.invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3"
                >
                  <div>
                    <p className="font-semibold">{inv.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Pending invite · {inv.role}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInvite(inv.id)}
                  >
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm text-muted-foreground">
              A tree can have up to two admins. Members can view and edit; admins
              can also manage sharing.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Identity({ person }: { person: Person | Member }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold">{person.name ?? person.email}</p>
      {person.name ? (
        <p className="truncate text-sm text-muted-foreground">{person.email}</p>
      ) : null}
    </div>
  );
}
