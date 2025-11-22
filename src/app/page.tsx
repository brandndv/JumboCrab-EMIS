import SignInForm from "@/components/dasboard/auth/sign-in";

const Home = () => {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-primary/10 to-background text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(700px at 10% 20%, rgba(59,130,246,0.12), transparent 45%), radial-gradient(800px at 90% 10%, rgba(16,185,129,0.12), transparent 45%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-60" aria-hidden />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border/70 bg-card/85 p-8 shadow-lg backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
          <div className="mb-8 space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              JumboCrab EMIS
            </p>
            <h1 className="text-3xl font-bold leading-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to manage employees, users, and daily operations.
            </p>
          </div>
          <div className="relative z-10">
            <SignInForm />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
