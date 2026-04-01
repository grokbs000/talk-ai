import { useState, useEffect } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { ChatScreen } from './components/ChatScreen';
import { Tutor } from './data/tutors';
import { Scenario } from './data/scenarios';
import { Sun, Moon } from 'lucide-react';

interface AppConfig {
  language: string;
  level: string;
  tutor: Tutor;
  scenario: Scenario;
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleStart = (newConfig: AppConfig) => {
    setConfig(newConfig);
  };

  const handleEnd = () => {
    setConfig(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans selection:bg-primary/20 transition-colors duration-300">
      <button
        onClick={() => setIsDark(!isDark)}
        className="fixed top-4 right-4 z-50 p-2 rounded-full glass hover:bg-accent transition-all duration-300"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-primary" />}
      </button>

      <div className="relative z-10">
        {!config ? (
          <SetupScreen onStart={handleStart} />
        ) : (
          <ChatScreen config={config} onEnd={handleEnd} />
        )}
      </div>

      {/* Decorative background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px] animate-pulse delay-700" />
      </div>
    </div>
  );
}
