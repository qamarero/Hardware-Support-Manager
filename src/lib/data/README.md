# Datos locales

## `postal-codes.json`

Mapa **código postal → municipio** de España (`{ "41001": "Sevilla", ... }`),
~11.000 CP. Se usa para autocompletar municipio/provincia al escribir un CP
(ver `@/server/actions/geo` → `lookupPostalCode`). La **provincia** no se guarda
aquí: se deriva del prefijo del CP en `provincias.ts`.

- **Fuente**: Callejero del Censo Electoral (INE), vía el dataset
  [`inigoflores/ds-codigos-postales-ine-es`](https://github.com/inigoflores/ds-codigos-postales-ine-es).
- **Licencia**: ODC-PDDL (Open Data Commons Public Domain Dedication) — dominio
  público, redistribución libre.
- **Notas**: los CP rurales compartidos por varios municipios se resuelven al
  primero del listado (la provincia siempre es exacta). Se descartaron 3 CP con
  prefijo no válido (`00xxx`).

### Regenerar

1. Descargar el CSV origen:
   `curl -fsSL https://raw.githubusercontent.com/inigoflores/ds-codigos-postales-ine-es/master/data/codigos_postales_municipios.csv -o cp_ine.csv`
2. Transformar a JSON compacto (CP→municipio, reubicando el artículo final tipo
   "Pobla de Massaluca, La" → "La Pobla de Massaluca", descartando prefijos no
   válidos y quedándose con el primer municipio en CP compartidos).
