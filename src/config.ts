export type Provider = {
  id: string;
  app: string;
  color: string;
  gradient: string;
  logo?: string;
  // Account details (loaded via tokens)
  name?: string;
  account?: string;
  qrData?: string;
  token?: string;
};

export const ACCOUNTS_DATA_URL = "/accounts/accounts.json";

export const providers: Provider[] = [
  {
    id: "BPI",
    app: "BPI",
    color: "#D71921",
    gradient: "linear-gradient(135deg, #FF4B2B 0%, #D71921 100%)",
    logo: "/resources/bpi.jpg",
  },
  {
    id: "BDO",
    app: "BDO",
    color: "#003DA5",
    gradient: "linear-gradient(135deg, #003DA5 0%, #002D72 100%)",
    logo: "/resources/bdo.png",
  },
  {
    id: "GoTyme",
    app: "GoTyme",
    color: "#2CBA8F",
    gradient: "linear-gradient(135deg, #38ef7d 0%, #11998e 100%)",
    logo: "/resources/gotyme.jpg",
  },
  {
    id: "Unionbank",
    app: "Unionbank",
    color: "#F68B1F",
    gradient: "linear-gradient(135deg, #FF9500 0%, #F68B1F 100%)",
    logo: "/resources/unionbank.jpg",
  },
  {
    id: "GCash",
    app: "GCash",
    color: "#007DFE",
    gradient: "linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)",
    logo: "/resources/gcash.jpg",
  },
  {
    id: "Maya",
    app: "Maya",
    color: "#32D74B",
    gradient: "linear-gradient(135deg, #000000 0%, #1A1A1A 100%)",
    logo: "/resources/paymaya.png",
  },
];

// E-wallets: small amounts only. Tapping one in the selector first
// checks the amount; wallets are also never auto-reopened on return
// visits — the selector shows again instead.
export const WALLET_IDS = ["GCash", "Maya"];

// Amount-based routing: ₱1,000 or less goes to the e-wallets;
// more than that goes to a bank transfer (wallet funds can't be
// moved to a bank for free, so bigger amounts belong with a bank).
export const LARGE_AMOUNT_BANK_ID = "BPI";

export const GENERIC_BANK_LOGO = "/resources/instapay.jpg";
