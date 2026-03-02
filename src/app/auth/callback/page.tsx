"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthClient } from "@/lib/supabase";

// Next.js requires useSearchParams() to be inside a Suspense boundary
// during static generation — wrap the inner component accordingly.

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const client = getAuthClient();

    if (!code || !client) {
      router.replace("/?auth_error=1");
      return;
    }

    client.auth
      .exchangeCodeForSession(code)
      .then(() => router.replace("/"))
      .catch(() => router.replace("/?auth_error=1"));
  }, [searchParams, router]);

  return (
    <div
      style={{
        background: "linear-gradient(160deg, #0a0608 0%, #0f0a18 50%, #080a0f 100%)",
        color: "#f5f5f5",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <p style={{ color: "rgba(245,158,11,0.8)", fontSize: "0.9rem" }}>Signing you in…</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background: "linear-gradient(160deg, #0a0608 0%, #0f0a18 50%, #080a0f 100%)",
            minHeight: "100vh",
          }}
        />
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
