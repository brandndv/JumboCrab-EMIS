// src/app/(users)/(admin)/admin/(nav)/users/[id]/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface PageProps {
  params: {
    id: string;
  };
  searchParams?: {
    [key: string]: string | string[] | undefined;
  };
}

export default function UserPage({ params }: PageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleRedirect() {
      try {
        // Await the params if it's a Promise
        const resolvedParams = await Promise.resolve(params);
        const { id } = resolvedParams;

        if (!id) {
          setError("No ID provided in params");
          return;
        }

        router.push(`/admin/users/${id}/view`);
      } catch (err) {
        console.error("Error in UserPage:", err);
        setError("Failed to load user data");
      } finally {
        setIsLoading(false);
      }
    }

    handleRedirect();
  }, [params, router]);

  if (isLoading) {
    return <div>Loading...</div>; // or a nice loading spinner
  }

  if (error) {
    return <div>Error: {error}</div>; // or a nice error component
  }

  return null;
}
