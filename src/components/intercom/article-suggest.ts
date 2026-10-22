import { DEVICE_TYPES, DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { ArticleOption } from "@/components/proto/article-combobox";

/**
 * El catálogo es texto libre y el detector de Intercom devuelve la marca en
 * mayúsculas: «AQPROX», «aqprox» y «Aq-Prox» tienen que ser la misma.
 */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Artículos del catálogo que encajan con la marca —y, si lo hay, el modelo—
 * del formulario. Sin marca no se sugiere nada: el tipo a secas («impresora»)
 * abarca demasiado para ser una sugerencia útil.
 */
export function suggestArticles(
  articles: ArticleOption[],
  brand: string,
  model = "",
): ArticleOption[] {
  const b = normalize(brand);
  if (!b) return [];
  const byBrand = articles.filter((a) => normalize(a.brand) === b);

  const m = normalize(model);
  if (!m) return byBrand;
  const byModel = byBrand.filter((a) => {
    const am = normalize(a.model);
    return am !== "" && (am.includes(m) || m.includes(am));
  });
  // Un modelo que no está en el catálogo no debe esconder los de la marca.
  return byModel.length > 0 ? byModel : byBrand;
}

/**
 * Tipo de la lista fija del formulario que corresponde al de un artículo. El
 * catálogo guarda el tipo como texto libre, así que vale tanto el valor
 * interno («Printer WiFi») como la etiqueta («Impresora WiFi»). `null` si no
 * hay equivalente claro: «impresora» a secas no dice si es WiFi o USB/LAN.
 */
export function matchDeviceType(type: string): DeviceType | null {
  const t = normalize(type);
  if (!t) return null;
  return (
    DEVICE_TYPES.find((d) => normalize(d) === t || normalize(DEVICE_TYPE_LABELS[d]) === t) ?? null
  );
}
