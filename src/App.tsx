import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, ShieldCheck, CreditCard, Wallet, Landmark, Zap, Download, Globe, X, Share, Copy, Check, Plus } from 'lucide-react';
import { toPng } from 'html-to-image';
import { providers, GENERIC_BANK_LOGO, ACCOUNTS_DATA_URL, WALLET_IDS, LARGE_AMOUNT_BANK_ID } from './config';
import type { Provider } from './config';
import { verifyAccountToken } from './utils/jwt';
import { embedAmount } from './utils/qrph';
import ThemeToggle from './components/ThemeToggle';
import AmountPrompt, { type AmountPromptMode } from './components/AmountPrompt';
import './index.css';

const IconMap: Record<string, React.ReactNode> = {
  BPI: <Landmark size={18} />,
  GCash: <Wallet size={18} />,
  GoTyme: <Smartphone size={18} />,
  Maya: <Zap size={18} />,
  Unionbank: <Landmark size={18} />,
  BDO: <Landmark size={18} />,
};

// Remembers the visitor's last-used bank on this device.
const SELECTED_BANK_KEY = 'ar-pay:selected-bank';

// Per-bank deep links: pay.adolfrey.com/#bpi, /#gcash, /#bdo, ...
// Matching is case-insensitive; aliases cover legacy names.
const BANK_ALIASES: Record<string, string> = {
  paymaya: 'Maya', // config.js historically used "Paymaya"
};

/** Sharper deep links: #bpi and #gcash?amt=500 (tag 54 in refactored TLV form). */
const parseHash = (hash: string): { id: string | null; amount: number | null } => {
  const raw = hash.trim().replace(/^#/, '').trim();
  if (!raw) return { id: null, amount: null };
  const [slug, query = ''] = raw.split('?');
  const lower = slug.trim().toLowerCase();
  const id = BANK_ALIASES[lower] ?? providers.find((p) => p.id.toLowerCase() === lower)?.id ?? null;
  let amount: number | null = null;
  if (id && query) {
    for (const pair of query.split('&')) {
      const [key, value = ''] = pair.split('=');
      if (key === 'amt') {
        const n = Number(value);
        amount = Number.isFinite(n) && n >= 1 ? n : null;
      }
    }
    // Wallet deep links follow the small-amount rule — >₱1,000 belongs
    // in bank territory, so the amount is simply ignored there.
    if (amount != null && WALLET_IDS.includes(id) && amount > 1000) amount = null;
  }
  return { id, amount };
};

const getInitialSelectedId = (): string | null => {
  // Deep link wins. Then the last-opened bank — but wallets (GCash,
  // Maya) are never auto-reopened: they're only for small amounts,
  // so a fresh open goes back to the selector instead. First-timers
  // (nothing remembered) also get the selector.
  const fromLink = parseHash(window.location.hash).id;
  if (fromLink) return fromLink;

  try {
    const saved = window.localStorage.getItem(SELECTED_BANK_KEY);
    if (saved && providers.some((p) => p.id === saved) && !WALLET_IDS.includes(saved)) {
      return saved;
    }
  } catch {
    // Storage unavailable (e.g. private browsing) — fall through
  }
  return null;
};

const getInitialHashAmount = (): number | null => {
  // Deep links can carry an amount (#gcash?amt=500 or #bpi?amt=1500)
  const { id, amount } = parseHash(window.location.hash);
  return id ? amount : null;
};

const App: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);

  // 1. Detect System Preference as Initial Value
  const getSystemTheme = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const [theme, setTheme] = useState<'light' | 'dark'>(getSystemTheme());
  // Null = first time (or last-used was a wallet) → bank selector
  const [selectedId, setSelectedId] = useState<string | null>(getInitialSelectedId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeBlob, setActiveBlob] = useState<Blob | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [verifiedProvider, setVerifiedProvider] = useState<Provider | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  // Amount modal (wallet-tile flow and the "Add amount" edit flow)
  const [amountPromptOpen, setAmountPromptOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<AmountPromptMode>('wallet');
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null);
  // Exact amount embedded in the displayed QR (QRPh tag 54);
  // deep links initialize it too (#gcash?amt=500)
  const [embeddedAmount, setEmbeddedAmount] = useState<number | null>(getInitialHashAmount);

  const handleCopyName = () => {
    if (!isAccountVerified || !displayProvider.name) return;
    navigator.clipboard.writeText(displayProvider.name);
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 2000);
  };

  const handleCopyAccount = () => {
    if (!isAccountVerified || !displayProvider.account) return;
    navigator.clipboard.writeText(displayProvider.account);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleSelectBank = useCallback((id: string, rememberAs?: string) => {
    setSelectedId(id);
    // Banks keep no embedded amount when switching away
    if (!WALLET_IDS.includes(id)) setEmbeddedAmount(null);
    // Remember the visitor's last-used bank for their next visit.
    // `rememberAs` lets a redirect be remembered as the bank the
    // visitor actually tapped (see the >₱1,000 wallet redirect).
    try {
      window.localStorage.setItem(SELECTED_BANK_KEY, rememberAs ?? id);
    } catch {
      // Ignore — selection just won't persist
    }
    // Mirror the selection into the URL hash so the current view is a
    // shareable deep link (pay.adolfrey.com/#bpi). replaceState adds no
    // history entry and does not fire 'hashchange'.
    window.history.replaceState(null, '', `#${id.toLowerCase()}`);
  }, []);

  // ── Amount-based routing ─────────────────────────────────────────
  // Wallets are for small amounts only (wallet funds can't be moved
  // to a bank for free): tapping GCash/Maya asks about the amount —
  // ₱1,000 or less → that wallet's QR, more → BPI bank transfer.
  const handleWalletTileTap = (walletId: string) => {
    setPendingWalletId(walletId);
    setAmountPromptOpen(true);
  };

  // Submit from the amount modal — the wallet-tile flow navigates to
  // the tapped wallet; the edit flow embeds the amount in place.
  // The amount is also mirrored into the URL hash (shareable).
  const handleSubmitAmount = (amount: number) => {
    setAmountPromptOpen(false);
    setEmbeddedAmount(amount);
    if (promptMode === 'wallet' && pendingWalletId) handleSelectBank(pendingWalletId);
    setPendingWalletId(null);
    const idForUrl = promptMode === 'wallet' ? pendingWalletId : selectedId;
    if (idForUrl) {
      window.history.replaceState(null, '', `#${idForUrl.toLowerCase()}?amt=${amount}`);
    }
  };

  // "Add amount" affordance / amount badge — embeds an amount on the
  // QR that's currently on screen (works for wallets and banks).
  const handleEditAmount = () => {
    setPendingWalletId(null);
    setPromptMode('edit');
    setAmountPromptOpen(true);
  };

  const handleAmountLarge = () => {
    setAmountPromptOpen(false);
    // Show BPI for this transfer, but remember the wallet that was
    // actually tapped — the next open still follows the wallet rule
    // (first-time selector flow) instead of reopening on BPI.
    setEmbeddedAmount(null);
    handleSelectBank(LARGE_AMOUNT_BANK_ID, pendingWalletId ?? undefined);
    setPendingWalletId(null);
  };


  // Fetch accounts data with remote-first & local fallback
  useEffect(() => {
    // We try to fetch the latest from Cloudflare proxy if deployed, 
    // otherwise fallback to the local internal version
    const fetchData = async () => {
      try {
        const response = await fetch(ACCOUNTS_DATA_URL);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const data = await response.json();
        setTokens(data);
      } catch (err) {
        console.warn("Remote fetch failed, falling back to local accounts.json:", err);
        // Fallback to local internal file if remote fails (e.g. 403 or server error)
        fetch("/accounts/accounts.json")
          .then(res => res.json())
          .then(data => setTokens(data))
          .catch(fallbackErr => console.error("Final fallback load failed:", fallbackErr));
      }
    };

    fetchData();
  }, []);


  // 2. Sync with DOM and listen for system changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Auto-switch when system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // 3. Follow the URL hash while the app is open (e.g. a shared
  // pay.adolfrey.com/#bpi?amt=1500 link pasted into the address bar)
  useEffect(() => {
    const handleHashChange = () => {
      const { id, amount } = parseHash(window.location.hash);
      if (id) handleSelectBank(id);
      setEmbeddedAmount(amount);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [handleSelectBank]);

  const currentProvider = selectedId ? providers.find((p) => p.id === selectedId) : undefined;
  const [logoUrl, setLogoUrl] = useState<string>(currentProvider?.logo || GENERIC_BANK_LOGO);

  useEffect(() => {
    // No bank selected (chooser view) — nothing to verify yet.
    // selectedId can only be null on first load, when every state
    // managed below is still at its initial value, so no reset needed.
    if (!currentProvider) return;

    if (currentProvider.logo) {
      const img = new Image();
      img.src = currentProvider.logo;
      img.onload = () => setLogoUrl(currentProvider.logo!);
      img.onerror = () => setLogoUrl(GENERIC_BANK_LOGO);
    } else {
      setLogoUrl(GENERIC_BANK_LOGO);
    }

    // Verify JWT if present in consolidated tokens
    const token = tokens[currentProvider.id.toLowerCase()];
    setError(null); // Clear previous errors
    
    if (token) {
      setIsVerifying(true);
      verifyAccountToken(token)
        .then((payload) => {
          // If valid, override with verified data
          setVerifiedProvider({
            ...currentProvider,
            token,
            name: payload.accountName || currentProvider.name,
            account: payload.accountId || currentProvider.account,
            qrData: payload.qrData || currentProvider.qrData,
          });
        })
        .catch((err) => {
          setError(err.message);
          setVerifiedProvider(null);
        })
        .finally(() => {
          setIsVerifying(false);
        });
    } else {
      setVerifiedProvider(null);
      // No token means it's unverified (unless it's during initial load)
      if (Object.keys(tokens).length > 0) {
        setIsVerifying(false);
      }
    }
  }, [currentProvider?.id, theme, tokens]);



  const handleDownload = async () => {
    if (!currentProvider || cardRef.current === null) return;

    try {
      cardRef.current.classList.add('is-exporting');

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2.5, // Better stability for Messenger
        backgroundColor: theme === 'dark' ? '#050505' : '#fdfdfd',
      });

      cardRef.current.classList.remove('is-exporting');

      // Convert to Blob for memory safety
      const blob = await (await fetch(dataUrl)).blob();
      const blobUrl = URL.createObjectURL(blob);

      setActiveBlob(blob);
      setPreviewUrl(blobUrl);
      setIsPreviewOpen(true);

      // Attempt direct download (Backup for Desktop)
      const link = document.createElement('a');
      link.download = `${currentProvider.app}_QR_Transfer.png`;
      link.href = blobUrl;
      link.click();
    } catch (err) {
      cardRef.current?.classList.remove('is-exporting');
      console.error('Failed to generate image:', err);
    }
  };

  const handleShare = async () => {
    if (!activeBlob || !currentProvider) return;
    try {
      const file = new File([activeBlob], `${currentProvider.app}_QR.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Transfer QR—${currentProvider.app}`,
          text: `Scan to transfer to ${currentProvider.name}`,
        });
      }
    } catch (err) {
      console.warn('Native share failed:', err);
    }
  };

  // ── Neutral chooser (first visit / no saved choice) ──────────────────
  // No bank is preselected: every provider is an equally weighted card,
  // so payers pick the app they actually bank with instead of
  // defaulting to whatever QR happens to be shown first.
  if (!currentProvider) {
    return (
      <div className="app-container">
        <div className="bg-glow" />
        <div className="glass-card">
          <div className="theme-toggle-wrapper">
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="error-alert"
            >
              <ShieldCheck size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="chooser-view"
          >
            <div className="header">
              <h1 className="title">How would you like to pay?</h1>
              <p className="subtitle">Choose your bank or e-wallet</p>
            </div>

            {/* Banks open directly; wallets ask about the amount first */}
            <div className="chooser-grid">
              {providers.map((p) => (
                <button
                  key={p.id}
                  className="bank-card"
                  onClick={() =>
                    WALLET_IDS.includes(p.id) ? handleWalletTileTap(p.id) : handleSelectBank(p.id)
                  }
                  style={{ '--card-brand': p.color } as React.CSSProperties}
                >
                  <span className="bank-card-logo">
                    {p.logo ? (
                      <img
                        src={p.logo}
                        alt={p.app}
                        className="tab-brand-icon"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      IconMap[p.id] || <CreditCard size={20} />
                    )}
                  </span>
                  <span className="bank-card-name">{p.app}</span>
                </button>
              ))}
            </div>

            <p className="chooser-hint">Wallets (GCash, Maya) are for amounts of ₱1,000 or less.</p>
          </motion.div>

          <div className="footer-info">
            <ShieldCheck size={14} color={theme === 'light' ? '#15803d' : '#32d74b'} />
            <span>Adolf Rey Along • 2026</span>
          </div>
        </div>

        {/* Amount modal — wallet check from the selector, "Add amount"
            edit flow from the QR view */}
        <AmountPrompt
          open={amountPromptOpen}
          mode={promptMode}
          walletName={pendingWalletId ? providers.find((p) => p.id === pendingWalletId)?.app : undefined}
          maxAmount={1000}
          onSubmit={handleSubmitAmount}
          onLarge={handleAmountLarge}
          onDismiss={() => setAmountPromptOpen(false)}
        />
      </div>
    );
  }

  const isAccountVerified = !!verifiedProvider;
  const displayProvider = verifiedProvider || currentProvider;
  // Any QR can carry an embedded amount (QRPh tag 54 + fresh CRC)
  const qrValue =
    displayProvider.qrData && embeddedAmount != null
      ? embedAmount(displayProvider.qrData, embeddedAmount)
      : displayProvider.qrData;

  return (
    <div className="app-container" style={{ '--brand-color': currentProvider.color } as any}>
      <div className="bg-glow" />
      <div className="glass-card">
        <div className="theme-toggle-wrapper">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="error-alert"
          >
            <ShieldCheck size={18} />
            <span>{error}</span>
          </motion.div>
        )}


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
              {isVerifying ? (
                <div className="qr-placeholder">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Smartphone size={32} opacity={0.5} />
                  </motion.div>
                  <span>Verifying...</span>
                </div>
              ) : isAccountVerified && qrValue ? (
                <motion.div
                  key={currentProvider.id + theme}
                  initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <QRCodeSVG
                    value={qrValue}
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
              ) : (
                <div className="qr-placeholder unverified">
                  <ShieldCheck size={40} color="#ff453a" opacity={0.2} />
                  <span>{error ? "Verification Failed" : "Unverified Account"}</span>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Embedded amount — content, so it stays in exports; tap to change */}
          {embeddedAmount != null && (
            <p
              className="qr-amount-badge"
              onClick={handleEditAmount}
              title="Tap to change the amount"
            >
              Amount: ₱{embeddedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          )}

          <motion.div
            key={displayProvider.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="account-info"
          >
            <div className="account-header-wrapper">
              <div 
                className={`account-header ${isAccountVerified ? 'copyable' : ''}`}
                onClick={isAccountVerified ? handleCopyName : undefined}
                title={isAccountVerified ? "Click to copy name" : undefined}
              >
                <h2 className="account-name" style={(!isAccountVerified && !isVerifying) ? { color: '#ff453a' } : undefined}>
                  {!isAccountVerified && !isVerifying ? (error || 'Security Verification Required') : (displayProvider.name || 'Fetching Account...')}
                </h2>

                {isAccountVerified && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="verified-badge"
                    title="Verified by auth.adolfrey.com"
                  >
                    <ShieldCheck size={16} color="#32d74b" fill="rgba(50, 215, 75, 0.1)" />
                  </motion.div>
                )}

                {isAccountVerified && (
                  <span className="copy-icon-wrapper copy-btn">
                    {copiedName ? <Check size={14} className="copy-success-icon" /> : <Copy size={14} className="copy-default-icon" />}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {copiedName && (
                  <motion.span
                    initial={{ opacity: 0, y: 5, scale: 0.8 }}
                    animate={{ opacity: 1, y: -10, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.8 }}
                    className="copy-tooltip"
                  >
                    Copied Name!
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="account-number-wrapper">
              <div
                className={`account-number-container ${isAccountVerified ? 'copyable' : ''}`}
                onClick={isAccountVerified ? handleCopyAccount : undefined}
                title={isAccountVerified ? "Click to copy account number" : undefined}
              >
                <p className="account-number">
                  {isAccountVerified ? displayProvider.account : (isVerifying ? 'Decrypting...' : 'Unauthorized Access')}
                </p>

                {isAccountVerified && (
                  <span className="copy-icon-wrapper copy-btn">
                    {copiedAccount ? <Check size={14} className="copy-success-icon" /> : <Copy size={14} className="copy-default-icon" />}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {copiedAccount && (
                  <motion.span
                    initial={{ opacity: 0, y: 5, scale: 0.8 }}
                    animate={{ opacity: 1, y: -10, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.8 }}
                    className="copy-tooltip"
                  >
                    Copied Account!
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <div className="branded-link">
            <Globe size={12} className="url-icon" />
            <span>pay.adolfrey.com</span>
          </div>

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

        <button 
          className="download-btn" 
          onClick={handleDownload} 
          style={{ background: currentProvider.color, opacity: isAccountVerified ? 1 : 0.5, cursor: isAccountVerified ? 'pointer' : 'not-allowed' }}
          disabled={!isAccountVerified}
        >
          <Download size={18} />
          <span>{isAccountVerified ? 'Save as Image' : 'Secure Data Locked'}</span>
        </button>
        <p className="screenshot-tip">
          {isAccountVerified ? "Can't save? Take a screenshot!" : "Verification required to view payment details."}
        </p>

        {/* "Add amount" — small affordance near the bottom of the card.
            UI only, so it lives outside the export area and never shows
            in saves; the amount badge under the QR stays in exports. */}
        {embeddedAmount == null && (
          <button className="add-amount-hint" onClick={handleEditAmount}>
            <Plus size={13} />
            <span>Add amount</span>
          </button>
        )}

        {/* Bank switcher — the 2-row tile panel. Banks switch directly;
            wallet tiles tap through the amount check. Pure UI, so it
            lives outside the export area and never shows in saves. */}
        <div className="tabs-container">
          {providers.map((p) => (
            <button
              key={p.id}
              className={`tab-item ${selectedId === p.id ? 'active' : ''}`}
              onClick={() =>
                WALLET_IDS.includes(p.id) ? handleWalletTileTap(p.id) : handleSelectBank(p.id)
              }
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

      {/* Preview Overlay for Messenger Compatibility */}
      <AnimatePresence>
        {isPreviewOpen && previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="preview-overlay"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="preview-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-preview" onClick={() => setIsPreviewOpen(false)}>
                <X size={24} />
              </button>
              <div className="preview-card-wrapper">
                <img src={previewUrl} alt="Transfer QR" className="preview-image" />
              </div>

              <div className="preview-actions">
                <button className="share-action" onClick={handleShare}>
                  <Share size={20} />
                  <span>Share or Save QR</span>
                </button>

                <div className="preview-instruction">
                  <Smartphone size={18} />
                  <span>Long-press OR Screenshot to save</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Amount modal — wallet check and "Add amount" edit flow */}
      <AmountPrompt
        open={amountPromptOpen}
        mode={promptMode}
        walletName={
          promptMode === 'edit'
            ? currentProvider.app
            : pendingWalletId
              ? providers.find((p) => p.id === pendingWalletId)?.app
              : undefined
        }
        maxAmount={promptMode === 'edit' && !WALLET_IDS.includes(currentProvider.id) ? 50000 : 1000}
        onSubmit={handleSubmitAmount}
        onLarge={handleAmountLarge}
        onDismiss={() => setAmountPromptOpen(false)}
      />
    </div>
  );
};

export default App;
