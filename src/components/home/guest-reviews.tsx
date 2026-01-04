import { Quote } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const reviews = [
  {
    quote:
      "Crab buckets, cocktails, and a sunset breeze—exactly what you want after a day on the water.",
    name: "Sam R.",
    role: "Travel blogger",
  },
  {
    quote:
      "The chili butter crab is unbelievable. Bring friends; the platters are huge and worth the mess.",
    name: "Mae T.",
    role: "Manila foodie",
  },
  {
    quote:
      "We booked for eight and stayed all night. Great staff, fresh seafood, and ice-cold beer.",
    name: "Lara & James",
    role: "Group trip",
  },
];

export default function GuestReviews() {
  return (
    <section className="bg-background pb-16 sm:pb-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 sm:px-8">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            Guest favorites
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
            Reviews from messy-finger nights.
          </h2>
          <p className="text-base text-foreground/70 sm:text-lg">
            What visitors say after cracking shells, sharing pancit, and staying for one more round.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {reviews.map((review) => (
            <Card
              key={review.name}
              className="h-full border-foreground/10 bg-card/90 backdrop-blur"
            >
              <CardHeader className="gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Quote className="h-5 w-5" />
                </div>
                <CardTitle className="text-base leading-snug text-foreground">
                  “{review.quote}”
                </CardTitle>
                <CardDescription className="text-sm text-foreground/70">
                  {review.name} • {review.role}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
