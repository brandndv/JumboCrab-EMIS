import { getSession } from "@/lib/auth";
import { getHomePathForRole, normalizeRole } from "@/lib/rbac";
import SignInForm from "@/features/auth/sign-in";
import { redirect } from "next/navigation";

const SingInPage = async () => {
  const session = await getSession();

  if (session.isLoggedIn) {
    const role = normalizeRole(session.role);
    if (role) {
      redirect(getHomePathForRole(role));
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,237,213,0.96),_rgba(248,250,252,0.94)_38%,_rgba(241,245,249,1)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(29,78,216,0.16),_rgba(10,14,20,0.96)_36%,_rgba(5,8,13,1)_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.36),_rgba(255,255,255,0))] dark:bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.03),_rgba(255,255,255,0))]" />
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-orange-200/45 blur-3xl dark:bg-orange-500/10" />
      <div className="absolute right-[-5rem] top-[-3rem] h-72 w-72 rounded-full bg-amber-100/60 blur-3xl dark:bg-cyan-400/10" />
      <div className="absolute bottom-[-6rem] left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-100/50 blur-3xl dark:bg-indigo-500/12" />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10 sm:px-8">
        <SignInForm />
      </div>
    </main>
  );
};

export default SingInPage;
