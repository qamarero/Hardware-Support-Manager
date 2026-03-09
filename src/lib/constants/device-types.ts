export const DEVICE_TYPES = [
  "cajon_portamonedas",
  "tpv",
  "impresora_lan",
  "impresora_wifi",
  "opal",
  "flint",
  "cajon_inteligente",
  "otro",
  "desconocido",
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  cajon_portamonedas: "Cajón portamonedas",
  tpv: "TPV",
  impresora_lan: "Impresora LAN",
  impresora_wifi: "Impresora WiFi",
  opal: "Opal",
  flint: "Flint",
  cajon_inteligente: "Cajón inteligente",
  otro: "Otro",
  desconocido: "Desconocido",
};
