import { Flame, Shrimp, UtensilsCrossed, Waves } from "lucide-react";

const features = [
  {
    title: "Daily catch",
    description: "Boats dock at dawn; we cook the same night.",
    Icon: Waves,
  },
  {
    title: "Messy-good crabs",
    description: "Signature chili garlic buckets built to share.",
    Icon: Flame,
  },
  {
    title: "Grill & chill",
    description: "Smoky skewers, cold beer, and calamansi spritzes.",
    Icon: UtensilsCrossed,
  },
  {
    title: "Group-ready",
    description: "Platters, pansit, and big tables for the crew.",
    Icon: Shrimp,
  },
];

export default function FeatureStrip() {
  return (
    <section className="relative isolate overflow-hidden bg-background py-16 sm:py-20">
      <div className="absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/10 via-accent/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary/10 via-accent/5 to-transparent" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            Why guests keep cracking back
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for bold flavors, beach nights, and groups.
          </h2>
          <p className="text-base text-foreground/70 sm:text-lg">
            We mix straight-from-the-docks seafood with relaxed island vibes.
            Bring your friends, order the buckets, and stay for one more round.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ title, description, Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-foreground/10 bg-white/80 p-5 shadow-sm backdrop-blur dark:bg-secondary/40 dark:border-white/10"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm text-foreground/70">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
