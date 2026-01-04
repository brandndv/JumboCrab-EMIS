import Image from "next/image";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const dishes = [
  {
    title: "Chili Garlic Crab",
    desc: "Our signature bucket—sweet chili, garlic butter, and hand-cracked claws.",
    src: "/crab-cropped.jpg",
  },
  {
    title: "Seafood Pancit",
    desc: "Smoky noodles with prawns, squid, and calamansi for the table.",
    src: "/table-background.png",
  },
  {
    title: "Charred Prawn Skewers",
    desc: "Grilled over coconut coals with palm vinegar glaze.",
    src: "/crab-clear.jpeg",
  },
  {
    title: "Sunset Spritz",
    desc: "Calamansi, citrus peel, and sparkling ginger for golden hour.",
    src: "/hero-background.png",
  },
];

export default function SignatureDishes() {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            Signature spreads
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
            Plates made for slow, shared nights.
          </h2>
          <p className="text-base text-foreground/70 sm:text-lg">
            Crack, sip, and linger. Mix a crab bucket with grills, pancit, and a
            round of calamansi spritz.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {dishes.map((dish) => (
            <Card
              key={dish.title}
              className="overflow-hidden border-foreground/10 bg-card/90 backdrop-blur"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <Image
                  src={dish.src}
                  alt={dish.title}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                  priority={dish.title === "Chili Garlic Crab"}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent" />
              </div>
              <CardHeader className="gap-2">
                <CardTitle className="text-lg">{dish.title}</CardTitle>
                <CardDescription className="text-sm text-foreground/70">
                  {dish.desc}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
