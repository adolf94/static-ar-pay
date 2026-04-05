import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, ShieldCheck, CreditCard, Wallet, Landmark, Zap, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { providers, GENERIC_BANK_LOGO } from './config';
import ThemeToggle from './components/ThemeToggle';
import './index.css';

const IconMap: Record<string, React.ReactNode> = {
  BPI: <Landmark size={18} />,
  GCash: <Wallet size={18} />,
  GoTyme: <Smartphone size={18} />,
  Paymaya: <Zap size={18} />,
  Unionbank: <Landmark size={18} />,
  BDO: <Landmark size={18} />,
};

const App: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedId, setSelectedId] = useState(providers[0].id);

  const currentProvider = providers.find(p => p.id === selectedId) || providers[0];
  const [logoUrl, setLogoUrl] = useState<string>(currentProvider.logo || GENERIC_BANK_LOGO);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (currentProvider.logo) {
      const img = new Image();
      img.src = currentProvider.logo;
      img.onload = () => setLogoUrl(currentProvider.logo!);
      img.onerror = () => setLogoUrl(GENERIC_BANK_LOGO);
    } else {
      setLogoUrl(GENERIC_BANK_LOGO);
    }
  }, [currentProvider.id, theme]);

  const handleDownload = async () => {
    if (cardRef.current === null) return;

    try {
      // Temporarily reveal icons for the high-res capture
      cardRef.current.classList.add('is-exporting');
      
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 4, 
        backgroundColor: theme === 'dark' ? '#050505' : '#fdfdfd',
      });

      // Instantly restore clean UI
      cardRef.current.classList.remove('is-exporting');

      const link = document.createElement('a');
      link.download = `${currentProvider.app}_QR_Transfer.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      cardRef.current?.classList.remove('is-exporting');
      console.error('Failed to download QR card:', err);
    }
  };

  return (
    <div className="app-container" style={{ '--brand-color': currentProvider.color } as any}>
      <div className="bg-glow" />
      <div className="glass-card">
        <div className="theme-toggle-wrapper">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>


        {/* Export Area: Compact & Branded */}
        <div ref={cardRef} className="export-area" style={{ padding: '1rem', width: '100%' }}>
          <div className="header">
            <motion.h1
              key={theme + currentProvider.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="title"
            >
              {currentProvider.app}
            </motion.h1>
            <p className="subtitle">Instapay Transfer QR</p>
          </div>

          <div className="qr-outer">
            <div className="qr-glow" style={{ background: currentProvider.color }} />
            <AnimatePresence mode="wait">
              <motion.div
                key={currentProvider.id + theme}
                initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <QRCodeSVG
                  value={currentProvider.qrData}
                  size={180} /* Compact Size */
                  level="H"
                  includeMargin={false}
                  fgColor="#000000"
                  imageSettings={{
                    src: logoUrl,
                    height: 36,
                    width: 36,
                    excavate: true,
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div
            key={currentProvider.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="account-info"
          >
            <h2 className="account-name">{currentProvider.name}</h2>
            <p className="account-number">{currentProvider.account}</p>
          </motion.div>

          <div className="branded-link">pay.adolfrey.com</div>
          
          {/* Branded Icon Row for the Downloaded Image */}
          <div className="export-footer-icons">
            {providers.map(p => (
              <div key={p.id} className="footer-icon-pill">
                {p.logo ? (
                  <img src={p.logo} alt="" className="footer-mini-icon" />
                ) : (
                  <Landmark size={10} color="white" />
                )}
              </div>
            ))}
          </div>
        </div>

        <button className="download-btn" onClick={handleDownload} style={{ background: currentProvider.color }}>
          <Download size={18} />
          <span>Save as image</span>
        </button>

        <div className="tabs-container">
          {providers.map((p) => (
            <button
              key={p.id}
              className={`tab-item ${selectedId === p.id ? 'active' : ''}`}
              onClick={() => setSelectedId(p.id)}
            >
              <span className="tab-content">
                <div className="tab-icon-wrapper">
                  {p.logo ? (
                    <img src={p.logo} alt={p.app} className="tab-brand-icon" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    IconMap[p.id] || <CreditCard size={16} />
                  )}
                </div>
                <span className="tab-app-name">{p.app}</span>
              </span>
              {selectedId === p.id && (
                <motion.div
                  layoutId="active-pill"
                  className="tab-active-bg"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="footer-info">
          <ShieldCheck size={14} color={theme === 'light' ? '#15803d' : '#32d74b'} />
          <span>Adolf Rey Along • 2026</span>
        </div>
      </div>
    </div>
  );
};

export default App;
