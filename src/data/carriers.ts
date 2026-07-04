import { Carrier } from "../types";

export const partnerRates = {
  ml: 8,
  shopee: 5,
  avulso: 8
} as const;

export const LOG_MANAGER_PACKAGE_RATE = 0.25;

export const defaultCarriers: Carrier[] = [
  { id: "chama-log", name: "Chama Log", rates: { ml: 9.5, shopee: 7.5, avulso: 9.5 }, active: true },
  { id: "ja", name: "J.A", rates: { ml: 9.5, shopee: 7, avulso: 9.5 }, active: true },
  { id: "3as", name: "3AS", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "expresso", name: "Expresso", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "anjun", name: "ANJUN", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "bras", name: "Bras", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "pomo", name: "POMO", rates: { ml: 9.5, shopee: 7, avulso: 9.5 }, active: true },
  { id: "mg", name: "MG", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "gbl", name: "GBL", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "m10", name: "M10", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "espll", name: "ESPLL", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "rm", name: "RM", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "dx", name: "DX", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "mt", name: "MT", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true },
  { id: "movi", name: "Movi", rates: { ml: 10, shopee: 7, avulso: 10 }, active: true }
];

export const salesCarrierNames = defaultCarriers.map((carrier) => carrier.name);
