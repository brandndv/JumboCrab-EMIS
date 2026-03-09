import { getSession } from "@/lib/auth";
import { getHomePathForRole, normalizeRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const role = normalizeRole(session.role);

  if (!session.isLoggedIn || !role) {
    redirect("/sign-in");
  }

  if (role !== "supervisor") {
    redirect(getHomePathForRole(role));
  }

  return children;
}
