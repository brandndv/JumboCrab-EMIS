import { Button } from "@/components/ui/button";
import { ArrowUpRight, CirclePlay } from "lucide-react";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative isolate min-h-screen flex items-center justify-center overflow-hidden">
      <Image
        src="/hero-background.png"
        alt="Seafood spread at JumboCrab"
        fill
        priority
        sizes="100vw"
        className="object-cover -z-20"
      />
      <div
        className="absolute inset-0 -z-10 bg-linear-to-r from-black/80 via-black/45 to-black/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-2/3 bg-linear-to-r from-black/60 via-black/25 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-(--breakpoint-xl) w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 px-5 sm:px-8 pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="text-center lg:text-left">
          <h1 className="mt-4 sm:mt-6 max-w-[18ch] text-4xl sm:text-5xl lg:text-[2.85rem] xl:text-[3.35rem] font-semibold leading-[1.15]! tracking-[-0.04em] text-orange-300 mx-auto lg:mx-0">
            Crack into JumboCrab nights.
          </h1>
          <p className="mt-6 max-w-[62ch] sm:text-lg text-white/80 mx-auto lg:mx-0">
            Fresh catch hit the docks, grills flare, and chili garlic butter
            flows. Meet Bohol&apos;s favorite crab feasts, smoky skewers, and
            sunset cocktails—best shared, best enjoyed messy.
          </p>
          <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <Button
              size="lg"
              className="rounded-full text-base shadow-lg shadow-primary/30"
            >
              Reserve a table <ArrowUpRight className="h-5! w-5!" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full text-base border-white/30 bg-white/15 text-white shadow-none backdrop-blur"
            >
              <CirclePlay className="h-5! w-5!" /> See the feast
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
