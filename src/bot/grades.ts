import { clamp } from './math'

/**
 * Rangs du personnalisateur : un liseré autour de la silhouette, et aux rangs
 * hauts une pupille posee dans le trou de l'oeil. Pas une nouvelle couleur
 * de corps, et surtout pas une mesure : le regard reste celui du moteur.
 *
 * Comme les formes de `skins.ts`, ce catalogue est CHOISI et non releve sur la
 * video. Les constantes du moteur restent des mesures ; ici on distingue une
 * valeur (normale, courante, rare, unique, legendaire) sans toucher au regard
 * ni aux anneaux d'orbite, qui veulent dire autre chose.
 *
 * Le liseré est un trait CENTRE sur le contour : la moitie interieure passe
 * sous le corps, seule la moitie exterieure se voit. `width` est cette moitie
 * visible, en unites de rayon de boule. `gradeOutset` en deduit la place a
 * reserver dans le cadre d'export.
 *
 * La TEINTE, elle, n'est pas dans le catalogue : elle se deduit de la couleur
 * du corps (`teinteDuRang`). Un or fixe sur un rose, ou un bleu fixe sur une
 * encre, c'est ce qu'on evite.
 */

export type GradeId = 'normal' | 'common' | 'rare' | 'unique' | 'legend'

export type GradeMotion = 'none' | 'pulse' | 'sweep' | 'shimmer'

export interface BotGrade {
  id: GradeId
  /** moitie visible du trait, en unites de rayon de boule */
  width: number
  /** halo au-dela du trait, en unites de rayon de boule */
  glow: number
  motion: GradeMotion
  /** second anneau, plus large, pour le rang legendaire */
  dual?: boolean
  /**
   * Eclair qui circule sur le contour. Le trait principal reste plein : c'est
   * lui qui manquait — un dash sur l'anneau seul vidait 80 % du liseré.
   */
  flare?: boolean
  /**
   * Pupille decorative dans le trou de l'oeil. Unique et legend seulement :
   * le trou reste un trou, on pose le disque DESSUS, rogne par le meme chemin.
   */
  pupils?: boolean
}

/** Couleurs du liseré, deduites du corps. */
export interface GradePaint {
  stroke: string
  stroke2?: string
}

export const GRADES: BotGrade[] = [
  { id: 'normal', width: 0, glow: 0, motion: 'none' },
  { id: 'common', width: 0.028, glow: 0, motion: 'none' },
  { id: 'rare', width: 0.036, glow: 0.045, motion: 'pulse' },
  { id: 'unique', width: 0.04, glow: 0.06, motion: 'sweep', flare: true, pupils: true },
  {
    id: 'legend',
    width: 0.042,
    glow: 0.062,
    motion: 'shimmer',
    dual: true,
    flare: true,
    pupils: true
  }
]

export const GRADE_BY_ID = new Map<string, BotGrade>(GRADES.map((g) => [g.id, g]))
export const DEFAULT_GRADE = 'normal'

/** Un rang qui ne trace rien : pas de groupe, pas de CSS, pas de marge. */
export function gradeVisible(grade: BotGrade): boolean {
  return grade.width > 0
}

/**
 * Place a reserver au-dela du rayon de la forme, en unites de rayon de boule.
 *
 * Le plafond 0,146 est celui du cadre d'export : au-dela, `DEMI_CADRE` passerait
 * 140 et rognerait les anneaux d'un cycle, ou ferait tomber le remplissage
 * sous 70 %. Un test le verrouille.
 */
export function gradeOutset(grade: BotGrade): number {
  if (!gradeVisible(grade)) return 0
  const extra = Math.max(
    grade.flare ? grade.width * 0.5 : 0,
    grade.dual ? grade.width * 0.75 : 0
  )
  return grade.width + grade.glow + extra
}

/** Rayons de la pupille, en unites de rayon de boule. Dans le trou, pas autour. */
export interface GradeOeil {
  pupil: number
  iris: number
  glint: number
  glint2: number
}

/**
 * Geometrie de l'oeil de rang. Null si le rang n'en a pas. Les valeurs restent
 * sous la demi-largeur d'un oeil au repos (0,093) : au-dela le disque mangerait
 * le blanc, et le clip ne suffirait plus a le faire passer pour une pupille.
 */
export function gradeOeil(grade: BotGrade): GradeOeil | null {
  if (!grade.pupils) return null
  if (grade.dual) return { pupil: 0.068, iris: 0.084, glint: 0.02, glint2: 0.012 }
  return { pupil: 0.055, iris: 0, glint: 0.018, glint2: 0 }
}

/**
 * CSS embarque dans le SVG : l'export serialise le noeud vivant, donc sans
 * ces regles DANS le document le liseré serait figé une fois telecharge.
 *
 * `uid` prefixe les `@keyframes` : plusieurs bots inline partagent sinon le
 * meme nom, et le dernier `style` gagne pour toute la page.
 *
 * Pas de script, pas d'attribut d'evenement : le fichier reste affichable
 * dans une `<img>`.
 */
export function gradeCss(uid: string, grade: BotGrade): string {
  if (!gradeVisible(grade) || grade.motion === 'none') return ''
  const p = `g${uid}`
  const silence =
    `@media (prefers-reduced-motion:reduce){` +
    `.grade-ring,.grade-halo,.grade-ring--dual,.grade-flare,.grade-pupil,.grade-glint{animation:none!important}}`
  if (grade.motion === 'pulse') {
    return (
      `@keyframes ${p}-pulse{50%{opacity:.55}}` +
      `.grade--pulse{animation:${p}-pulse 2s ease-in-out infinite}` +
      silence
    )
  }
  if (grade.motion === 'sweep') {
    return (
      `@keyframes ${p}-sweep{to{stroke-dashoffset:-100}}` +
      `@keyframes ${p}-halo{50%{opacity:.22}}` +
      `.grade--sweep .grade-halo{animation:${p}-halo 1.4s ease-in-out infinite}` +
      `.grade--sweep .grade-flare{stroke-dasharray:28 72;animation:${p}-sweep 1.2s linear infinite}` +
      `.grade--sweep .grade-flare--alt{stroke-dasharray:12 88;animation:${p}-sweep 2s linear infinite reverse}` +
      `@keyframes ${p}-pupil{50%{fill-opacity:.22}}` +
      `@keyframes ${p}-glint{50%{opacity:.35;transform:translate(4px,3px)}}` +
      `.grade--sweep .grade-pupil{animation:${p}-pupil 1.6s ease-in-out infinite}` +
      `.grade--sweep .grade-glint{animation:${p}-glint 1.8s ease-in-out infinite}` +
      silence
    )
  }
  return (
    `@keyframes ${p}-shimmer{50%{opacity:.7}}` +
    `@keyframes ${p}-halo{50%{opacity:.16}}` +
    `@keyframes ${p}-orbit{to{stroke-dashoffset:-100}}` +
    `.grade--shimmer .grade-ring{animation:${p}-shimmer 1.25s ease-in-out infinite}` +
    `.grade--shimmer .grade-halo{animation:${p}-halo 1.25s ease-in-out infinite}` +
    `.grade--shimmer .grade-ring--dual{opacity:.88;stroke-dasharray:12 8 6 10 12 52;animation:${p}-orbit 1.7s linear infinite}` +
    `.grade--shimmer .grade-flare{stroke-dasharray:20 80;animation:${p}-orbit .7s linear infinite}` +
    `.grade--shimmer .grade-flare--alt{stroke-dasharray:8 22 8 62;animation:${p}-orbit 1.25s linear infinite reverse}` +
    `@keyframes ${p}-pupil{50%{fill-opacity:.32}}` +
    `@keyframes ${p}-twinkle{30%{opacity:1}50%{opacity:.2}80%{opacity:.85}}` +
    `.grade--shimmer .grade-pupil{animation:${p}-pupil 1.25s ease-in-out infinite}` +
    `.grade--shimmer .grade-glint{animation:${p}-twinkle 1.1s ease-in-out infinite}` +
    `.grade--shimmer .grade-glint--alt{animation:${p}-twinkle 1.1s ease-in-out infinite .35s}` +
    silence
  )
}

/* ---------------------------------------------------------- teinte du rang */

type Hsl = { h: number; s: number; l: number }

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  if (!Number.isFinite(n)) return { h: 0, s: 0, l: 0.04 }
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s)
  const ll = clamp(l)
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2
  const [r, g, b] =
    hh < 60
      ? [c, x, 0]
      : hh < 120
        ? [x, c, 0]
        : hh < 180
          ? [0, c, x]
          : hh < 240
            ? [0, x, c]
            : hh < 300
              ? [x, 0, c]
              : [c, 0, x]
  const oct = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${oct(r)}${oct(g)}${oct(b)}`
}

/** Plus court chemin entre deux teintes, en degres. */
function hueVers(from: number, to: number, t: number): number {
  const d = ((to - from + 540) % 360) - 180
  return from + d * t
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

/**
 * L'ambre et l'orange, a luminosite egale, restent trop clairs sur le papier.
 * On assombrit jusqu'a un contraste lisible, sans toucher aux teintes deja
 * assez foncees (encre, bleu, violet).
 */
function assurerContraste(hex: string, fond: string, min: number): string {
  let { h, s, l } = hexToHsl(hex)
  let out = hex
  const lumF = luminance(fond)
  for (let i = 0; i < 12; i++) {
    const lum = luminance(out)
    const [hi, lo] = lum > lumF ? [lum, lumF] : [lumF, lum]
    if ((hi + 0.05) / (lo + 0.05) >= min || l <= 0.18) return out
    l -= 0.045
    out = hslToHex(h, s, l)
  }
  return out
}

const PAPIER = '#f9f9f9'

/**
 * Couleurs du liseré, calquees sur le corps.
 *
 * - courant : meme teinte, desaturee, lisible sur le papier
 * - rare : meme teinte, plus vive
 * - unique : deux teintes voisines, plus vives, pour le degrade et l'eclair
 * - legend : tire vers l'or tout en gardant la teinte du corps (or-rose, or-bleu)
 *
 * L'encre, le gris et la creme n'ont presque pas de teinte : on reste dans
 * leur famille (acier, etain, champagne) plutot que d'inventer un arc-en-ciel.
 */
export function teinteDuRang(grade: BotGrade, corps: string): GradePaint | null {
  if (!gradeVisible(grade)) return null
  const { h, s, l } = hexToHsl(corps)
  const neutre = s < 0.12
  const hue = neutre ? (l < 0.25 ? 230 : l > 0.8 ? 40 : 0) : h

  if (grade.id === 'common') {
    return { stroke: assurerContraste(hslToHex(hue, neutre ? 0.06 : s * 0.38, 0.46), PAPIER, 1.75) }
  }
  if (grade.id === 'rare') {
    return {
      stroke: assurerContraste(
        hslToHex(hue, neutre ? 0.14 : clamp(s * 1.12, 0.42, 0.78), 0.5),
        PAPIER,
        1.75
      )
    }
  }
  if (grade.id === 'unique') {
    return {
      stroke: assurerContraste(
        hslToHex(hue - 22, neutre ? 0.22 : clamp(s * 1.18, 0.55, 0.88), 0.42),
        PAPIER,
        1.75
      ),
      stroke2: assurerContraste(
        hslToHex(hue + 34, neutre ? 0.28 : clamp(s * 1.2, 0.58, 0.9), 0.54),
        PAPIER,
        1.45
      )
    }
  }
  return {
    stroke: assurerContraste(
      hslToHex(hueVers(hue, 42, 0.14), neutre ? 0.62 : clamp(s * 0.9 + 0.28, 0.62, 0.9), 0.46),
      PAPIER,
      1.75
    ),
    stroke2: assurerContraste(
      hslToHex(hueVers(hue, 42, 0.08), neutre ? 0.48 : clamp(s * 0.55 + 0.28, 0.42, 0.72), 0.56),
      PAPIER,
      1.45
    )
  }
}
