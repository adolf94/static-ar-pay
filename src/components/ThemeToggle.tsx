import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="theme-toggle-btn"
      style={{
        position: 'relative',
        width: '64px',
        height: '32px',
        borderRadius: '32px',
        border: '1px solid var(--glass-border)',
        background: 'var(--tab-bg)',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.3s ease',
      }}
    >
      <motion.div
        animate={{ x: theme === 'light' ? 2 : 32 }}
        className="toggle-handle"
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {theme === 'light' ? (
          <Sun size={14} color="var(--bg)" strokeWidth={3} />
        ) : (
          <Moon size={14} color="var(--bg)" strokeWidth={3} />
        )}
      </motion.div>
    </button>
  );
};

export default ThemeToggle;
