export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export class RNG {
  private state: number

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
    if (this.state === 0) this.state = 0x9e3779b9
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}

export function coordinateNoise(seed: string, x: number, y: number, salt = ''): number {
  const rng = new RNG(`${seed}:${salt}:${x}:${y}`)
  return rng.next()
}
