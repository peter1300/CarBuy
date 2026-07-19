import { hu } from '../src/i18n/messages/hu.ts'
import fs from 'fs'
import path from 'path'

function walk(dir: string, acc: string[] = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(f) && !p.includes('messages')) acc.push(p)
  }
  return acc
}

const files = walk('src')
const used = new Set<string>()
const re = /\bt(?:Global)?\(\s*['"]([^'"]+)['"]/g
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) used.add(m[1])
}
const missing = [...used].filter((k) => !(k in hu)).sort()
console.log('used', used.size, 'missing', missing.length)
for (const k of missing) console.log(k)
