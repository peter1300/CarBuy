/** Magyarország megyéi + országos opció a keresőhöz / hirdetésfeladáshoz. */
export const HUNGARY_LOCATIONS = [
  'Teljes Magyarország',
  'Budapest',
  'Bács-Kiskun',
  'Baranya',
  'Békés',
  'Borsod-Abaúj-Zemplén',
  'Csongrád-Csanád',
  'Fejér',
  'Győr-Moson-Sopron',
  'Hajdú-Bihar',
  'Heves',
  'Jász-Nagykun-Szolnok',
  'Komárom-Esztergom',
  'Nógrád',
  'Pest',
  'Somogy',
  'Szabolcs-Szatmár-Bereg',
  'Tolna',
  'Vas',
  'Veszprém',
  'Zala',
] as const

export type HungaryLocation = (typeof HUNGARY_LOCATIONS)[number]
