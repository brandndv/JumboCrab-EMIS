import { getSession } from "@/lib/auth";
import { getPostSignInPath, normalizeRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

const Home = async () => {
  const session = await getSession();

  if (session.isLoggedIn) {
    const role = normalizeRole(session.role);
    if (role) {
      redirect(getPostSignInPath(role, Boolean(session.mustChangePassword)));
    }
  }

  redirect("/sign-in");
};

export default Home;
