export type SellerStatus = 'online' | 'busy' | 'offline'

export type Listing = {
  id: string
  title: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  fuel: string
  transmission: string
  power: number
  location: string
  description: string
  videoPoster: string
  videoDuration: string
  seller: {
    name: string
    type: 'private' | 'dealer'
    status: SellerStatus
    rating: number
    responseTime: string
  }
  features: string[]
  specs: { label: string; value: string }[]
  /** User-created listings only */
  ownerId?: string
  createdAt?: string
  uniqueViews?: number
}

export const listings: Listing[] = [
  {
    id: '23151001',
    title: 'BMW 320d xDrive M Sport',
    make: 'BMW',
    model: '320d',
    year: 2021,
    price: 12_490_000,
    mileage: 68_400,
    fuel: 'Dízel',
    transmission: 'Automata',
    power: 190,
    location: 'Budapest',
    description:
      'Teljes szerviztörténettel, M Sport csomaggal. A videóban végigvezetjük a beltért, a futóművet és a menetdinamikát — élő hívásban bármit megmutatunk.',
    videoPoster:
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
    videoDuration: '2:14',
    seller: {
      name: 'AutoVista Kft.',
      type: 'dealer',
      status: 'online',
      rating: 4.9,
      responseTime: '< 2 perc',
    },
    features: ['M Sport', 'xDrive', 'Navigáció', 'LED', 'Bőrülések', 'Vonóhorog'],
    specs: [
      { label: 'Évjárat', value: '2021' },
      { label: 'Kilométeróra', value: '68 400 km' },
      { label: 'Üzemanyag', value: 'Dízel' },
      { label: 'Váltó', value: 'Automata' },
      { label: 'Teljesítmény', value: '190 LE' },
      { label: 'Hajtás', value: 'Összkerék' },
      { label: 'Szín', value: 'Portimao Blue' },
      { label: 'Ajtók', value: '4' },
    ],
  },
  {
    id: '23151002',
    title: 'Tesla Model 3 Long Range',
    make: 'Tesla',
    model: 'Model 3',
    year: 2023,
    price: 16_890_000,
    mileage: 24_100,
    fuel: 'Elektromos',
    transmission: 'Automata',
    power: 366,
    location: 'Debrecen',
    description:
      'Egy tulajdonos, garanciális. A videós túrán látszik a hatótáv-kijelző, a csomagtér és az Autopilot funkciók élőben.',
    videoPoster:
      'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80',
    videoDuration: '1:48',
    seller: {
      name: 'Kovács Péter',
      type: 'private',
      status: 'online',
      rating: 5.0,
      responseTime: '< 5 perc',
    },
    features: ['Autopilot', 'Premium hang', 'Üvegtető', 'Hőtároló', 'Sentry Mode'],
    specs: [
      { label: 'Évjárat', value: '2023' },
      { label: 'Kilométeróra', value: '24 100 km' },
      { label: 'Üzemanyag', value: 'Elektromos' },
      { label: 'Váltó', value: 'Automata' },
      { label: 'Teljesítmény', value: '366 LE' },
      { label: 'Hatótáv', value: '602 km' },
      { label: 'Szín', value: 'Midnight Silver' },
      { label: 'Ajtók', value: '4' },
    ],
  },
  {
    id: '23151003',
    title: 'Audi A4 40 TDI S line',
    make: 'Audi',
    model: 'A4',
    year: 2020,
    price: 9_750_000,
    mileage: 92_300,
    fuel: 'Dízel',
    transmission: 'Automata',
    power: 204,
    location: 'Győr',
    description:
      'S line extrákkal, friss gumikkal. Videón bemutatjuk a motorhangot, a beltér állapotát és a futóművet is.',
    videoPoster:
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80',
    videoDuration: '2:01',
    seller: {
      name: 'Premium Autóház',
      type: 'dealer',
      status: 'busy',
      rating: 4.7,
      responseTime: '~ 10 perc',
    },
    features: ['S line', 'Virtual Cockpit', 'Mátrix LED', 'Bang & Olufsen'],
    specs: [
      { label: 'Évjárat', value: '2020' },
      { label: 'Kilométeróra', value: '92 300 km' },
      { label: 'Üzemanyag', value: 'Dízel' },
      { label: 'Váltó', value: 'Automata' },
      { label: 'Teljesítmény', value: '204 LE' },
      { label: 'Hajtás', value: 'Quattro' },
      { label: 'Szín', value: 'Gotland Green' },
      { label: 'Ajtók', value: '4' },
    ],
  },
  {
    id: '23151004',
    title: 'Volkswagen Golf 1.5 TSI',
    make: 'Volkswagen',
    model: 'Golf',
    year: 2019,
    price: 6_290_000,
    mileage: 78_900,
    fuel: 'Benzin',
    transmission: 'Manuális',
    power: 150,
    location: 'Szeged',
    description:
      'Megbízható, takarékos mindennapi autó. A rövid videóban végignézheted a karosszériát és a beltért sérülésmentesen.',
    videoPoster:
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80',
    videoDuration: '1:32',
    seller: {
      name: 'Nagy Anna',
      type: 'private',
      status: 'offline',
      rating: 4.8,
      responseTime: '1 óra',
    },
    features: ['App-Connect', 'Tempomat', 'ParkRadar', 'Klímaautomatika'],
    specs: [
      { label: 'Évjárat', value: '2019' },
      { label: 'Kilométeróra', value: '78 900 km' },
      { label: 'Üzemanyag', value: 'Benzin' },
      { label: 'Váltó', value: 'Manuális' },
      { label: 'Teljesítmény', value: '150 LE' },
      { label: 'Hajtás', value: 'Elsőkerék' },
      { label: 'Szín', value: 'Urano Grey' },
      { label: 'Ajtók', value: '5' },
    ],
  },
  {
    id: '23151005',
    title: 'Mercedes-Benz C 200 AMG Line',
    make: 'Mercedes-Benz',
    model: 'C 200',
    year: 2022,
    price: 15_200_000,
    mileage: 31_500,
    fuel: 'Benzin',
    transmission: 'Automata',
    power: 204,
    location: 'Pécs',
    description:
      'AMG Line megjelenés, MBUX rendszer. Élő videóhívásban körbejárjuk az autót, és megválaszoljuk a kérdéseidet azonnal.',
    videoPoster:
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
    videoDuration: '2:28',
    seller: {
      name: 'StarMotors Zrt.',
      type: 'dealer',
      status: 'online',
      rating: 4.8,
      responseTime: '< 1 perc',
    },
    features: ['AMG Line', 'MBUX', 'Kamera 360°', 'Fűtött ülések', 'Keyless'],
    specs: [
      { label: 'Évjárat', value: '2022' },
      { label: 'Kilométeróra', value: '31 500 km' },
      { label: 'Üzemanyag', value: 'Benzin' },
      { label: 'Váltó', value: 'Automata' },
      { label: 'Teljesítmény', value: '204 LE' },
      { label: 'Hajtás', value: 'Hátsókerék' },
      { label: 'Szín', value: 'Obsidian Black' },
      { label: 'Ajtók', value: '4' },
    ],
  },
  {
    id: '23151006',
    title: 'Toyota RAV4 Hybrid AWD',
    make: 'Toyota',
    model: 'RAV4',
    year: 2021,
    price: 11_350_000,
    mileage: 54_200,
    fuel: 'Hibrid',
    transmission: 'Automata',
    power: 218,
    location: 'Miskolc',
    description:
      'Családi SUV alacsony fogyasztással. A videóban látszik a csomagtér, a hátsó ülések és az AWD működés közben.',
    videoPoster:
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
    videoDuration: '1:56',
    seller: {
      name: 'Family Cars',
      type: 'dealer',
      status: 'online',
      rating: 4.6,
      responseTime: '< 3 perc',
    },
    features: ['AWD', 'Safety Sense', 'Panorámatető', 'Vonóhorog'],
    specs: [
      { label: 'Évjárat', value: '2021' },
      { label: 'Kilométeróra', value: '54 200 km' },
      { label: 'Üzemanyag', value: 'Hibrid' },
      { label: 'Váltó', value: 'Automata' },
      { label: 'Teljesítmény', value: '218 LE' },
      { label: 'Hajtás', value: 'Összkerék' },
      { label: 'Szín', value: 'White Pearl' },
      { label: 'Ajtók', value: '5' },
    ],
  },
]

export function getListingById(id: string): Listing | undefined {
  return listings.find((listing) => listing.id === id)
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat('hu-HU').format(km)} km`
}
