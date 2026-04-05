export type Provider = {
  id: string;
  app: string;
  name: string;
  account: string;
  color: string;
  gradient: string;
  logo?: string;
  qrData: string;
};

export const providers: Provider[] = [
  {
    id: "GCash",
    app: "GCash",
    name: "Adolf Rey Along",
    account: "09151792560",
    color: "#007DFE",
    gradient: "linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)",
    logo: "/resources/gcash.jpg",
    qrData: "00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWDA19C5204601653036085802PH5912AD**F R** A.6011San Joaquin6104123463046987",
  },
  {
    id: "BPI",
    app: "BPI",
    name: "Adolf Rey Along",
    account: "4229186642",
    color: "#D71921",
    gradient: "linear-gradient(135deg, #FF4B2B 0%, #D71921 100%)",
    logo: "/resources/bpi.jpg",
    qrData: "00020101021127610012com.p2pqrpay0111BOPIPHMMXXX0208999644030414000042291866425204601653036085802PH5902ar6011Makati City630414A7",
  },
  {
    id: "GoTyme",
    app: "GoTyme",
    name: "Adolf Rey Along",
    account: "018385438253",
    color: "#2CBA8F",
    gradient: "linear-gradient(135deg, #38ef7d 0%, #11998e 100%)",
    logo: "/resources/gotyme.jpg",
    qrData: "00020101021127590012com.p2pqrpay0111GOTYPHM2XXX02089996440304120183854382535204601653036085802PH5915ADOLF REY ALONG6010Pasig City63042327",
  },
  {
    id: "Paymaya",
    app: "Maya",
    name: "Adolf Rey Along",
    account: "09151792560",
    color: "#32D74B",
    gradient: "linear-gradient(135deg, #000000 0%, #1A1A1A 100%)",
    logo: "/resources/paymaya.png",
    qrData: "00020101021127780012com.p2pqrpay0111PAPHPHM1XXX02089996440304126391517925600515+63-915-17925605204601653036085802PH5915Adolf Rey Along6010Pasig City63045B29",
  },
  {
    id: "Unionbank",
    app: "Unionbank",
    name: "Adolf Rey Along",
    account: "888170224982",
    color: "#F68B1F",
    gradient: "linear-gradient(135deg, #FF9500 0%, #F68B1F 100%)",
    logo: "/resources/unionbank.jpg",
    qrData: "00020101021127590012com.p2pqrpay0111UBPHPHMMXXX02089996440304128881702249825204601653036085802PH5920ADOLF REY ABAD ALONG6010PASIG CITY630420C2",
  },
  {
    id: "BDO",
    app: "BDO",
    name: "Adolf Rey Along",
    account: "006480138219",
    color: "#003DA5",
    gradient: "linear-gradient(135deg, #003DA5 0%, #002D72 100%)",
    logo: "/resources/bdo.png",
    qrData: "00020101021127590012com.p2pqrpay0111BNORPHMMXXX02089996440304120064801382195204601653036085802PH5902ar6011Makati City63045AF4",
  },
];

export const GENERIC_BANK_LOGO = "/resources/instapay.jpg";
