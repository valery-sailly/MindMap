// Scanner de bas niveau pour parse.ts. Pas un tokenizer générique TeX : uniquement les primitives
// nécessaires au sous-ensemble strict décrit dans ./grammar.md (voir parse.ts pour la grammaire).

export class ParseError extends Error {
  readonly line: number
  readonly column: number

  constructor(message: string, line: number, column: number) {
    super(`${message} (ligne ${line}, colonne ${column})`)
    this.name = 'ParseError'
    this.line = line
    this.column = column
  }
}

export class Scanner {
  private pos = 0
  private readonly source: string

  constructor(source: string) {
    this.source = source
  }

  get eof(): boolean {
    this.skipWhitespace()
    return this.pos >= this.source.length
  }

  get position(): number {
    return this.pos
  }

  private locate(at: number): { line: number; column: number } {
    let line = 1
    let column = 1
    for (let i = 0; i < at && i < this.source.length; i += 1) {
      if (this.source[i] === '\n') {
        line += 1
        column = 1
      } else {
        column += 1
      }
    }
    return { line, column }
  }

  error(message: string, at: number = this.pos): never {
    const { line, column } = this.locate(at)
    throw new ParseError(message, line, column)
  }

  skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) this.pos += 1
  }

  /** Consomme la chaîne littérale attendue (après avoir sauté les espaces) ; erreur sinon. */
  expect(literal: string): void {
    this.skipWhitespace()
    if (this.source.startsWith(literal, this.pos)) {
      this.pos += literal.length
      return
    }
    this.error(`Attendu "${literal}"`)
  }

  /** Essaie de consommer la chaîne littérale ; ne consomme que si elle est présente. */
  tryConsume(literal: string): boolean {
    this.skipWhitespace()
    if (this.source.startsWith(literal, this.pos)) {
      this.pos += literal.length
      return true
    }
    return false
  }

  peekLiteral(literal: string): boolean {
    this.skipWhitespace()
    return this.source.startsWith(literal, this.pos)
  }

  /** Lit une séquence de caractères jusqu'à rencontrer l'un des `stopChars`. */
  readUntil(stopChars: string): string {
    this.skipWhitespace()
    const start = this.pos
    while (this.pos < this.source.length && !stopChars.includes(this.source[this.pos])) this.pos += 1
    return this.source.slice(start, this.pos).trim()
  }

  /**
   * Lit un groupe `{ ... }` avec profondeur d'accolades équilibrée et renvoie son contenu brut
   * (sans les accolades). Toute paire précédée d'un `\` (ex: `\{`, `\}`, `\\`) est traitée comme
   * opaque pour le comptage de profondeur, ce qui suffit pour les échappements de ./grammar.md.
   */
  readBraceGroup(): string {
    this.skipWhitespace()
    if (this.source[this.pos] !== '{') this.error('Attendu "{"')
    const outerStart = this.pos
    this.pos += 1
    const contentStart = this.pos
    let depth = 1
    while (this.pos < this.source.length && depth > 0) {
      const ch = this.source[this.pos]
      if (ch === '\\') {
        this.pos += 2
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      this.pos += 1
    }
    if (depth !== 0) this.error('Accolade "{" non fermée', outerStart)
    return this.source.slice(contentStart, this.pos - 1)
  }

  /**
   * Lit un groupe `[ ... ]` avec profondeur de crochets équilibrée et renvoie son contenu brut.
   * Les accolades internes (ex: `every node/.style={...}`) ne sont pas comptées : seule la
   * profondeur de crochets importe pour trouver la fin du groupe.
   */
  readBracketGroup(): string {
    this.skipWhitespace()
    if (this.source[this.pos] !== '[') this.error('Attendu "["')
    const outerStart = this.pos
    this.pos += 1
    const contentStart = this.pos
    let depth = 1
    while (this.pos < this.source.length && depth > 0) {
      const ch = this.source[this.pos]
      if (ch === '[') depth += 1
      else if (ch === ']') depth -= 1
      this.pos += 1
    }
    if (depth !== 0) this.error('Crochet "[" non fermé', outerStart)
    return this.source.slice(contentStart, this.pos - 1)
  }
}
