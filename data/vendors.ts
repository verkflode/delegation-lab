/**
 * Vendor name pool — realistic European company names spanning industries.
 * Used by the fallback scenario generator when the Claude API is unavailable.
 */
export const VENDORS = [
  "Nordström Logistik AB",
  "Helvetia Print GmbH",
  "Brouwerij De Vries B.V.",
  "Lumière Industriel SARL",
  "Fjord Cloud Services AS",
  "Rheinland Komponenten GmbH",
  "Båtsman Marine OY",
  "Ferrara Ufficio S.r.l.",
  "Aalto Värkstad AB",
  "Stadsbyggnad Konsult AB",
  "Köln Datendienste GmbH",
  "Belgrade IT Solutions d.o.o.",
  "Lisboa Papelaria Lda.",
  "Krakow Mechatronik Sp. z o.o.",
  "Tallinn Energia AS",
  "Bilbao Acero S.L.",
  "Vienna Beratung GmbH",
  "Kiruna Mining Supplies AB",
  "Galway Foods Ltd.",
  "Marseille Maritime SAS",
];

let cursor = 0;
export function nextVendor(): string {
  const v = VENDORS[cursor % VENDORS.length];
  cursor++;
  return v;
}
