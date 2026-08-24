import { describe, expect, it } from 'vitest'
import { COLORS } from './skins'
import { EYE_W } from './face'
import {
  DEFAULT_GRADE,
  GRADE_BY_ID,
  GRADES,
  gradeCss,
  gradeOeil,
  gradeOutset,
  gradeVisible,
  teinteDuRang
} from './grades'

/** Contraste WCAG entre deux hex. Le liseré doit rester lisible sur le papier. */
function contraste(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const lin = (v: number) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  }
  const paire = [lum(a), lum(b)].sort((x, y) => y - x)
  return (paire[0]! + 0.05) / (paire[1]! + 0.05)
}

const PAPIER = '#f9f9f9'

describe('catalogue des grades', () => {
  it('expose les cinq rangs dans l ordre du jeu', () => {
    expect(GRADES.map((g) => g.id)).toEqual(['normal', 'common', 'rare', 'unique', 'legend'])
    expect(DEFAULT_GRADE).toBe('normal')
  })

  it('indexe par id, y compris une valeur relue du stockage', () => {
    expect(GRADE_BY_ID.get('rare')?.id).toBe('rare')
    expect(GRADE_BY_ID.get('inconnu')).toBeUndefined()
  })

  it('ne dessine rien au rang normal', () => {
    const normal = GRADE_BY_ID.get('normal')!
    expect(gradeVisible(normal)).toBe(false)
    expect(gradeOutset(normal)).toBe(0)
    expect(gradeCss('abc', normal)).toBe('')
  })

  it('dessine un liseré des le rang courant', () => {
    expect(gradeVisible(GRADE_BY_ID.get('common')!)).toBe(true)
    expect(gradeOutset(GRADE_BY_ID.get('common')!)).toBeGreaterThan(0)
  })

  /*
   * Le cadre d'export est calcule pour loger le liseré le plus large, mais il
   * doit rester sous 140 (les anneaux d'orbite, cf. export.test.ts). Un rang
   * trop gras ferait taire ce test-ci avant de casser le cadre.
   */
  it('tient le liseré dans la marge que le cadre d export peut offrir', () => {
    const pics = GRADES.map(gradeOutset)
    for (let i = 1; i < pics.length; i++) {
      expect(pics[i]!, GRADES[i]!.id).toBeGreaterThanOrEqual(pics[i - 1]!)
    }
    expect(Math.max(...pics)).toBeLessThan(0.146)
  })

  it('reserve le mouvement aux trois rangs superieurs', () => {
    expect(GRADE_BY_ID.get('common')!.motion).toBe('none')
    expect(GRADE_BY_ID.get('rare')!.motion).toBe('pulse')
    expect(GRADE_BY_ID.get('unique')!.motion).toBe('sweep')
    expect(GRADE_BY_ID.get('legend')!.motion).toBe('shimmer')
    expect(GRADE_BY_ID.get('legend')!.dual).toBe(true)
    expect(GRADE_BY_ID.get('unique')!.flare).toBe(true)
    expect(GRADE_BY_ID.get('legend')!.flare).toBe(true)
    expect(GRADE_BY_ID.get('rare')!.flare).toBeUndefined()
    expect(GRADE_BY_ID.get('unique')!.pupils).toBe(true)
    expect(GRADE_BY_ID.get('legend')!.pupils).toBe(true)
    expect(GRADE_BY_ID.get('rare')!.pupils).toBeUndefined()
  })

  /*
   * La pupille est DANS le trou : si elle depassait la demi-largeur d'un oeil
   * au repos, le clip la mangerait et on n'aurait plus un blanc autour.
   */
  it('loge la pupille dans un oeil au repos, unique plus discrete que legend', () => {
    const unique = gradeOeil(GRADE_BY_ID.get('unique')!)!
    const legend = gradeOeil(GRADE_BY_ID.get('legend')!)!
    expect(gradeOeil(GRADE_BY_ID.get('rare')!)).toBeNull()
    expect(unique.iris).toBe(0)
    expect(legend.iris).toBeGreaterThan(unique.pupil)
    expect(unique.pupil).toBeLessThan(legend.pupil)
    expect(legend.pupil).toBeLessThan(EYE_W / 2)
    expect(legend.iris).toBeLessThan(EYE_W / 2)
  })

  it('ecrit le css dans le SVG, sans script, et l annule si on reduit le mouvement', () => {
    const unique = gradeCss('abc', GRADE_BY_ID.get('unique')!)
    expect(unique).toContain('@keyframes')
    expect(unique).toContain('prefers-reduced-motion')
    expect(unique).toContain('.grade-flare')
    expect(unique).toContain('.grade-pupil')
    expect(unique).toContain('.grade-glint')
    expect(unique.toLowerCase()).not.toContain('<script')
    expect(gradeCss('abc', GRADE_BY_ID.get('common')!)).toBe('')
  })

  /*
   * Le piege du unique : dasharray sur l'anneau principal faisait disparaitre
   * 80 % du trait. L'eclair circule A COTE, le liseré reste plein.
   */
  it('fait circuler un eclair sans decouper l anneau unique', () => {
    const unique = gradeCss('abc', GRADE_BY_ID.get('unique')!)
    const legend = gradeCss('abc', GRADE_BY_ID.get('legend')!)
    expect(unique).not.toMatch(/\.grade-ring\{[^}]*stroke-dasharray/)
    expect(unique).toContain('.grade-flare{')
    expect(legend).toContain('grade-flare')
    expect(legend).toContain('grade-ring--dual')
    expect(legend).toContain('stroke-dasharray')
  })
})

describe('teinte du liseré', () => {
  const rare = GRADE_BY_ID.get('rare')!
  const unique = GRADE_BY_ID.get('unique')!
  const legend = GRADE_BY_ID.get('legend')!
  const common = GRADE_BY_ID.get('common')!
  const rose = '#e152b0'
  const bleu = '#3b93f0'

  it('ne peint rien au rang normal', () => {
    expect(teinteDuRang(GRADE_BY_ID.get('normal')!, rose)).toBeNull()
  })

  /*
   * Le piege evite : un bleu fixe pour « rare » et un or fixe pour « legend »
   * rendaient le rose et l'encre identiques. La teinte doit partir du corps.
   */
  it('suit la couleur du corps, pas une couleur fixe de rang', () => {
    const a = teinteDuRang(rare, rose)!
    const b = teinteDuRang(rare, bleu)!
    expect(a.stroke).not.toBe(b.stroke)
    expect(a.stroke).not.toBe('#3b82f6')
    expect(teinteDuRang(legend, rose)!.stroke).not.toBe('#e8b923')
    const rougeRose = parseInt(a.stroke.slice(1, 3), 16)
    const rougeBleu = parseInt(b.stroke.slice(1, 3), 16)
    expect(rougeRose).toBeGreaterThan(rougeBleu)
  })

  /*
   * Un leger tirage vers l'or (legend) ne doit pas faire le tour du cercle
   * : 42 % de 210° vers 42° tombait dans le vert. Le bleu reste bleu.
   */
  it('garde le legend dans la famille du corps', () => {
    const stroke = teinteDuRang(legend, bleu)!.stroke
    const r = parseInt(stroke.slice(1, 3), 16)
    const g = parseInt(stroke.slice(3, 5), 16)
    const b = parseInt(stroke.slice(5, 7), 16)
    expect(b).toBeGreaterThan(g)
    expect(b).toBeGreaterThan(r)
    const roseStroke = teinteDuRang(legend, rose)!.stroke
    expect(parseInt(roseStroke.slice(1, 3), 16)).toBeGreaterThan(
      parseInt(roseStroke.slice(5, 7), 16)
    )
  })

  it('distingue les rangs sur une meme couleur de corps', () => {
    const teintes = [common, rare, unique, legend].map((g) => teinteDuRang(g, rose)!.stroke)
    expect(new Set(teintes).size).toBe(4)
  })

  it('donne un degrade au unique et au legend seulement', () => {
    expect(teinteDuRang(common, rose)!.stroke2).toBeUndefined()
    expect(teinteDuRang(rare, rose)!.stroke2).toBeUndefined()
    expect(teinteDuRang(unique, rose)!.stroke2).toMatch(/^#[0-9a-f]{6}$/)
    expect(teinteDuRang(legend, rose)!.stroke2).toMatch(/^#[0-9a-f]{6}$/)
    expect(teinteDuRang(unique, rose)!.stroke2).not.toBe(teinteDuRang(unique, rose)!.stroke)
  })

  it('reste lisible sur le papier, pour les 12 couleurs', () => {
    for (const couleur of COLORS) {
      for (const rang of GRADES) {
        const teinte = teinteDuRang(rang, couleur.hex)
        if (!teinte) continue
        expect(contraste(teinte.stroke, PAPIER), `${couleur.id} ${rang.id}`).toBeGreaterThan(1.7)
        if (teinte.stroke2) {
          expect(contraste(teinte.stroke2, PAPIER), `${couleur.id} ${rang.id} b`).toBeGreaterThan(1.4)
        }
      }
    }
  })
})
