export type CarMakesData = {
  CAR_MAKES: string[]
  CAR_MAKES_MODELS: Record<string, string[]>
}

let cache: CarMakesData | null = null
let loadPromise: Promise<CarMakesData> | null = null

export async function loadCarMakesModels(): Promise<CarMakesData> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = import('../data/carMakesModels').then((mod) => {
      cache = { CAR_MAKES: mod.CAR_MAKES, CAR_MAKES_MODELS: mod.CAR_MAKES_MODELS }
      return cache
    })
  }
  return loadPromise
}
