import { useSearchParams, Link } from 'react-router-dom';
import { AuthCard } from '../components/auth/AuthCard';
import { PageTransition } from '../components/layout/PageTransition';

interface AuthPageProps {
  defaultMode?: 'login' | 'register';
}

export default function AuthPage({ defaultMode = 'register' }: AuthPageProps) {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') as 'login' | 'register' | null;
  const initialMode = modeParam || defaultMode;

  return (
    <PageTransition className="min-h-screen bg-black text-white flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Subtle background ambient glow */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-copper-500/10 blur-[180px] pointer-events-none rounded-full" />
      
      {/* Header / Brand */}
      <header className="relative z-10 w-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white group">
          <span className="w-2 h-2 rounded-full bg-copper-400" />
          <span className="font-display font-bold text-lg tracking-wider uppercase">Bedrock</span>
        </Link>
      </header>

      {/* Center Auth Card */}
      <main className="relative z-10 w-full my-auto py-8 flex items-center justify-center">
        <AuthCard initialMode={initialMode} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full flex items-center justify-between text-xs text-gray-600 font-mono">
        <span>© {new Date().getFullYear()} Bedrock Inc.</span>
        <span>Secure Authentication</span>
      </footer>
    </PageTransition>
  );
}
