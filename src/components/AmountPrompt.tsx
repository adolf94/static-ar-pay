import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Landmark } from 'lucide-react';

export type AmountPromptMode = 'wallet' | 'edit';

interface AmountPromptProps {
  open: boolean;
  /** 'wallet': the GCash/Maya amount check (≤1k choice + amount entry).
   *  'edit': embed an amount directly on the QR on screen ("Add amount"). */
  mode: AmountPromptMode;
  /** Human name shown in the labels (e.g. "GCash", "BPI") */
  walletName?: string;
  /** Input validation ceiling (wallets: 1,000 · banks: 50,000) */
  maxAmount?: number;
  /** Both modes submit the entered amount */
  onSubmit: (amount: number) => void;
  /** Wallet mode only: "More than ₱1,000" → bank redirect */
  onLarge?: () => void;
  onDismiss: () => void;
}

/**
 * Amount gate for wallets (GCash/Maya): more than ₱1,000 goes to a
 * bank transfer; small amounts ask for the exact value so it can be
 * embedded in — and controlled by — the QR itself. In 'edit' mode the
 * modal just embeds an amount on whatever QR is on screen.
 */
const AmountPrompt: React.FC<AmountPromptProps> = ({ open, ...cardProps }) => (
  <AnimatePresence>
    {open && <AmountPromptCard key="amount-prompt" {...cardProps} />}
  </AnimatePresence>
);

const AmountPromptCard: React.FC<Omit<AmountPromptProps, 'open'>> = ({
  mode,
  walletName,
  maxAmount = 1000,
  onSubmit,
  onLarge,
  onDismiss,
}) => {
  const [step, setStep] = useState<'choose' | 'enter'>(mode === 'edit' ? 'enter' : 'choose');
  const [amount, setAmount] = useState('');

  const parsed = Number(amount);
  const amountValid =
    amount.trim() !== '' && Number.isFinite(parsed) && parsed >= 1 && parsed <= maxAmount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="prompt-overlay"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="How much are you sending?"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
        className="prompt-card"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'choose' ? (
          <>
            <h2 className="prompt-title">How much are you sending?</h2>
            <p className="prompt-subtitle">Wallet transfers cost me a fee</p>

            <div className="prompt-actions">
              <button className="amount-option" onClick={() => setStep('enter')}>
                <span className="amount-option-icon">
                  <Wallet size={20} />
                </span>
                <span className="amount-option-text">
                  <span className="amount-option-label">₱1,000 or less</span>
                  <span className="amount-option-hint">{walletName ?? 'GCash or Maya'}</span>
                </span>
              </button>

              <button className="amount-option" onClick={onLarge}>
                <span className="amount-option-icon">
                  <Landmark size={20} />
                </span>
                <span className="amount-option-text">
                  <span className="amount-option-label">More than ₱1,000</span>
                  <span className="amount-option-hint">BPI bank transfer</span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="prompt-title">Enter amount</h2>
            <p className="prompt-subtitle">
              {mode === 'edit'
                ? 'The amount will be shown on the QR'
                : `Up to ₱${maxAmount.toLocaleString()} for ${walletName ?? 'wallets'}`}
            </p>

            <div className="amount-entry">
              <span className="amount-entry-currency">₱</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={maxAmount}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                aria-label="Amount in Philippine pesos"
              />
            </div>

            {amount.trim() !== '' && !amountValid && (
              <p className="amount-error">
                Enter an amount between ₱1 and ₱{maxAmount.toLocaleString()}
              </p>
            )}

            <div className="prompt-actions">
              <button
                className="prompt-btn-primary"
                disabled={!amountValid}
                onClick={() => onSubmit(parsed)}
              >
                <span>{mode === 'edit' ? 'Add to QR' : 'Continue'}</span>
              </button>
              <button
                className="prompt-btn-ghost"
                onClick={mode === 'edit' ? onDismiss : () => setStep('choose')}
              >
                <span>Back</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AmountPrompt;
