"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// User type from Supabase
type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
};

export function AuthNav() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

<<<<<<< HEAD
    try {
      const supabase = createClient();

      supabase.auth.getUser().then(({ data: { user } }: { data: { user: SupabaseUser | null } }) => {
        setUser(user);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event: string, session: { user: SupabaseUser | null } | null) => {
        setUser(session?.user ?? null);
      });
      subscription = sub;
    } catch {
      // Supabase not configured – show unauthenticated UI
      setLoading(false);
    }
=======
    supabase.auth.getUser()
      .then(({ data: { user } }: { data: { user: SupabaseUser | null } }) => {
        setUser(user);
        setLoading(false);
      })
      .catch(() => {
        // Supabase not reachable or misconfigured — show logged-out state
        setUser(null);
        setLoading(false);
      });
>>>>>>> 179497d (everything. am accessing my repo via github and can only see it has the readme file)

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      router.refresh();
    } catch {
      // Still clear local state even if signout request fails
      setUser(null);
    }
  };

  if (loading) {
    return <div className="w-20 h-8 bg-gray-100 animate-pulse rounded-lg" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="text-sm text-ink/70 hover:text-ink font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="text-sm text-white font-medium px-3 py-1.5 rounded-lg bg-lagoon hover:bg-lagoon/90 transition-colors"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const initials = user.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0].toUpperCase() || "U";

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
      >
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt={user.user_metadata?.full_name || user.email}
            className="w-7 h-7 rounded-full"
          />
        ) : (
          <div className="w-7 h-7 bg-lagoon text-white rounded-full flex items-center justify-center text-xs font-medium">
            {initials}
          </div>
        )}
        <svg
          className={`w-3.5 h-3.5 text-ink/60 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setDropdownOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-ink truncate">
                {user.user_metadata?.full_name || "User"}
              </p>
              <p className="text-xs text-ink/60 truncate">{user.email}</p>
            </div>

            <div className="py-1">
              <Link
                href="/dashboard"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </Link>
            </div>

            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  handleSignOut();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
