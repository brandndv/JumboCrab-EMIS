import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

const Home = async () => {
  const session = await getSession();

  if (session.isLoggedIn) {
    const userRole = session.role?.toLowerCase();
    redirect(`/${userRole}/dashboard`);
  } else {
    redirect("/sign-in");
  }
};

export default Home;
