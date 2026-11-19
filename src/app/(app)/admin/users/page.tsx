import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isAppAdmin, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DeleteUserDialog, type WorkspaceLine } from "./delete-user-dialog";

export const metadata: Metadata = { title: "Users" };

type UserRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  is_app_admin: boolean;
  workspaces: WorkspaceLine[];
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

// Every Polaris account, for app admins only: who they are, their workspaces, and Delete user.
export default async function AdminUsersPage() {
  const session = await requireSession();
  if (!(await isAppAdmin())) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_user_overview");
  const users = (data ?? []) as UserRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Polaris admin"
        title="Users"
        description="Every account in Polaris. Deleting a user removes workspaces only they belong to and transfers their work in shared workspaces to the workspace owner."
      />

      {error ? (
        <p className="text-base text-destructive">
          Could not load users: {error.message}. Has migration 20261127000000_delete_users.sql been run?
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/40">
                <TableHead>User</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const name = u.full_name?.trim() || u.email.split("@")[0];
                const self = u.user_id === session.userId;
                return (
                  <TableRow key={u.user_id} className="border-border/40 align-top">
                    <TableCell>
                      <div className="font-semibold">
                        {name}
                        {self && <span className="font-normal text-muted-foreground"> (you)</span>}
                      </div>
                      <a href={`mailto:${u.email}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                        {u.email}
                      </a>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {u.is_app_admin && <Badge variant="secondary">App admin</Badge>}
                        {!u.confirmed && <Badge variant="outline">Email not confirmed</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.workspaces.length === 0 ? (
                        <span className="text-muted-foreground">–</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {u.workspaces.map((w) => (
                            <li key={w.name}>
                              {w.name}{" "}
                              <span className="text-muted-foreground">
                                · {w.role} · {w.members} {w.members === 1 ? "member" : "members"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{date(u.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {date(u.last_sign_in_at) ?? <span className="text-muted-foreground">Never</span>}
                    </TableCell>
                    <TableCell>
                      {self || u.is_app_admin ? (
                        <span
                          className="text-muted-foreground"
                          title={self ? "You cannot delete your own account here." : "App admins cannot be deleted here."}
                        >
                          –
                        </span>
                      ) : (
                        <DeleteUserDialog userId={u.user_id} email={u.email} name={name} workspaces={u.workspaces} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
