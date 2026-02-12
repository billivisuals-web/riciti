import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div 
      className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-mist to-white flex flex-col items-center justify-center p-4"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      {/* Logo/Branding */}
      <Link href="/" className="mb-6 flex items-center gap-2 group">
        <div className="w-10 h-10 bg-lagoon rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        <span className="font-display text-2xl font-semibold text-ink">Riciti</span>
      </Link>
      
      <div className="w-full max-w-md">
        {children}
      </div>
      
      {/* Footer */}
      <p className="mt-8 text-xs text-ink/40 text-center">
        Invoice & Receipt Generator for Kenyan Businesses
      </p>
    </div>
  );
}
