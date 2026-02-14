import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mist/30 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-lagoon/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-lagoon">404</span>
        </div>
        <h1 className="text-xl font-bold text-ink mb-2">Page not found</h1>
        <p className="text-ink/60 mb-6 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-lagoon hover:bg-lagoon/90 text-white font-medium py-2.5 px-5 rounded-xl transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
