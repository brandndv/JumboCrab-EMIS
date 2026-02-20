"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { ArrowUpRight } from "lucide-react";

const HomeHeader = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const baseClasses =
    "fixed inset-x-0 top-0 z-50 transition-all duration-300 border-b";
  const scrollClasses = scrolled
    ? "bg-transparent text-white border-white/5 backdrop-blur-md backdrop-saturate-150 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.35)]"
    : "bg-transparent text-white border-transparent backdrop-blur-0 shadow-none";

  return (
    <header className={`${baseClasses} ${scrollClasses}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <Image
            src="/logo.svg"
            alt="JumboCrab logo"
            width={48}
            height={48}
            className="h-10 w-auto"
            priority
          />
          <span className="hidden text-xl font-black leading-tight sm:block text-orange-300">
            JumboCrab
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-md font-medium md:flex">
          <Link
            className="transition-colors text-white/80 hover:text-orange-300"
            href="/"
          >
            Home
          </Link>
          <Link
            className="transition-colors text-white/80 hover:text-orange-300"
            href="/about"
          >
            About
          </Link>
          <Link
            className="transition-colors text-white/80 hover:text-orange-300"
            href="/contact"
          >
            Visit
          </Link>
        </nav>

        <Button
          asChild
          size="sm"
          className="rounded-full bg-primary text-primary-foreground text-sm shadow-sm shadow-primary/20 hover:bg-primary/90"
        >
          <Link href="/contact">
            Book now <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
};

export default HomeHeader;
