import https from 'https'
import fs from 'fs'

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: 'application/xml', 'Accept-Language': 'en' } }, (res) => {
        res.setEncoding('utf8')
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`${res.statusCode} ${url}`))
          else resolve(d)
        })
      })
      .on('error', reject)
  })
}

function parseItems(xml) {
  const items = []
  const re =
    /<reference:item key="([^"]+)"[^>]*>[\s\S]*?<resource:local-description[^>]*>([^<]*)<\/resource:local-description>/g
  let m
  while ((m = re.exec(xml))) {
    items.push({ key: m[1], name: m[2].trim() })
  }
  return items
}

const makesXml = await get('https://services.mobile.de/refdata/classes/Car/makes')
const makes = parseItems(makesXml).filter((m) => m.key && m.name && m.key !== 'OTHER')
makes.sort((a, b) => a.name.localeCompare(b.name, 'en'))
console.log('makes', makes.length)

const map = {}
let i = 0
for (const make of makes) {
  i++
  const enc = encodeURIComponent(make.key)
  try {
    const xml = await get(`https://services.mobile.de/refdata/classes/Car/makes/${enc}/models`)
    const models = parseItems(xml)
      .map((x) => x.name)
      .filter(Boolean)
    models.sort((a, b) => a.localeCompare(b, 'en'))
    map[make.name] = models
  } catch (e) {
    console.error('fail', make.key, e.message)
    map[make.name] = []
  }
  if (i % 25 === 0) console.log('progress', i, '/', makes.length)
}

const out = `/** Auto-generated from mobile.de refdata (Car makes/models). Do not edit by hand. */
export type CarMakeModels = Record<string, string[]>

export const CAR_MAKES_MODELS: CarMakeModels = ${JSON.stringify(map, null, 2)}

export const CAR_MAKES = Object.keys(CAR_MAKES_MODELS)
`

fs.writeFileSync('src/data/carMakesModels.ts', out, 'utf8')
console.log('written', Object.keys(map).length, 'makes')
