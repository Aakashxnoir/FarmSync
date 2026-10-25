// Builds the README's animated SVGs into .github/readme/.
//
//   node scripts/readme/build.mjs
//
// The colours and tagline are read from the Flutter app (lib/core/theme.dart,
// lib/core/brand.dart). The screenshots are pulled out of
// FarmSync_Phone_Preview.pdf with pdfimages (poppler) and shrunk to WebP with
// ImageMagick (`magick`). Everything moves with CSS keyframes or SMIL, because
// GitHub shows these as plain images.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, '.github', 'readme');
mkdirSync(OUT, { recursive: true });
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// The app's own palette (AppColors) and tagline (AppBrand).
const C = Object.fromEntries(
  [...read('flutter_app/lib/core/theme.dart').matchAll(/static const (\w+) = Color\(0xFF([0-9A-F]{6})\)/g)].map(([, k, v]) => [k, `#${v}`])
);
const TAGLINE = read('flutter_app/lib/core/brand.dart').match(/tagline = '([^']+)'/)[1];

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
const mix = (a, b, t) => `#${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;

const INK = C.cream;
const MUTED = mix(C.cream, C.deepGreen, 0.38);
const DIM = rgba(C.cream, 0.4);
const EDGE = rgba(C.cream, 0.14);
const ACC = C.terracotta;
const ACC2 = mix(C.terracotta, C.cream, 0.4);
const BEZEL = mix(C.deepGreen, '#000000', 0.8);
const NODE = mix(C.deepGreen, '#000000', 0.35);
const EASE = 'cubic-bezier(.65,0,.35,1)';
const OUTE = 'cubic-bezier(.2,.7,.2,1)';

// Headline numbers from PRD.md §3 and TRD.md §2.3.
const FACTS = { qubits: 12, optimum: '25/25', sortWrong: '65%' };

// The seeded demo farm's /rank result, as the app shows it in
// FarmSync_Phone_Preview.pdf (screens 6 and 12).
const DEMO = {
  farm: 'Home field · delta alluvium · 1.2 ha',
  seasons: ['Kharif', 'Rabi', 'Summer'],
  crops: ['Paddy', 'Black gram', 'Groundnut', 'Maize'],
  quantum: { order: [0, 1, 2], value: '₹1,69,532' },
  sort: { order: [0, 2, 1], value: '₹1,68,420' },
  greedy: { order: [0, 2, 1], value: '₹1,68,420' },
  gap: '₹1,111',
  bonus: '₹6,052',
};

// One caption per screenshot, in the PDF's order.
const SCREENS = [
  ['Sign in', 'Google through Clerk, or three demo farms'],
  ['Farms', 'N/P/K badges, crop order, yearly earnings'],
  ['Add farm', 'Land, location and Soil Health Card readings'],
  ['Soil card', 'The readings in plain words'],
  ['Water', 'Water on the farm, and the NDVI panel'],
  ['Crop order', 'What cannot grow here, and the year’s plan'],
  ['Best crops', 'Every feasible crop, ranked on its own'],
  ['Soil needs', 'Season by season, then the fertiliser bags'],
  ['Planner', 'Pick a farm, set water and budget limits'],
  ['What changed', 'The plan re-runs as the limits move'],
  ['Qualify', 'Which crops still fit, and why the rest went'],
  ['Compare', 'The quantum plan against sorting and greedy'],
  ['Report', 'Every farm: earnings, soil, plans ready'],
  ['Optimiser', 'How often the circuit beat a simple sort'],
];

const BASE_CSS = `
.b{font-family:Roboto,Inter,'Segoe UI','Helvetica Neue',Arial,sans-serif}
.m{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.mo{display:none}}`;

const f2 = (n) => +n.toFixed(2);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

function frame(w, h, body, { css = '', defs = '', title }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${attr(title)}">
<title>${esc(title)}</title>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="${mix(C.deepGreen, '#000000', 0.62)}"/><stop offset=".55" stop-color="${mix(C.deepGreen, '#000000', 0.42)}"/><stop offset="1" stop-color="${mix(C.deepGreen, '#000000', 0.2)}"/></linearGradient>
<pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 .5H.5V48" fill="none" stroke="${INK}" stroke-opacity=".05"/></pattern>
<radialGradient id="gridfade" cx=".5" cy=".4" r=".7"><stop offset=".3" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="gridmask"><rect width="${w}" height="${h}" fill="url(#gridfade)"/></mask>
<radialGradient id="glow"><stop offset="0" stop-color="${ACC}" stop-opacity=".55"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></radialGradient>
<clipPath id="card"><rect width="${w}" height="${h}" rx="22"/></clipPath>
<clipPath id="scr" clipPathUnits="objectBoundingBox"><rect width="1" height="1" rx=".08" ry=".037"/></clipPath>
${defs}
</defs>
<style>${BASE_CSS}${css}</style>
<g clip-path="url(#card)">
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#grid)" mask="url(#gridmask)"/>
${body}
</g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="21.5" fill="none" stroke="${EDGE}"/>
</svg>
`;
}

/** Keyframes from [seconds, css] stops over a `dur`-second loop, eased segment by segment. */
function track(name, dur, stops, ease = EASE) {
  const kf = stops.map(([t, css]) => `${f2((t / dur) * 100)}%{${css};animation-timing-function:${ease}}`).join('');
  return `@keyframes ${name}{${kf}}.${name}{animation:${name} ${dur}s linear infinite}`;
}

/** Shown from `a` to `b` seconds of the loop, with a fade at each end. */
function shown(name, dur, a, b, fade = 0.04) {
  const s = a <= 0 ? [[0, 'opacity:1']] : [[0, 'opacity:0'], [a, 'opacity:0'], [a + fade, 'opacity:1']];
  s.push(...(b >= dur ? [[dur, 'opacity:1']] : [[b, 'opacity:1'], [Math.min(b + fade, dur), 'opacity:0'], ...(b + fade < dur ? [[dur, 'opacity:0']] : [])]));
  return track(name, dur, s, 'linear');
}

/** Greedy word wrap by character count; good enough for short captions. */
function wrap(text, max) {
  const out = [''];
  for (const word of text.split(' ')) {
    const cur = out[out.length - 1];
    if (!cur || cur.length + 1 + word.length <= max) out[out.length - 1] = cur ? `${cur} ${word}` : word;
    else out.push(word);
  }
  return out;
}

// ----------------------------------------------------------- screenshots

const TMP = mkdtempSync(join(tmpdir(), 'farmsync-readme-'));
execFileSync('pdfimages', ['-png', join(ROOT, 'FarmSync_Phone_Preview.pdf'), join(TMP, 's')]);
const SHOTS = readdirSync(TMP).sort().map((f) => join(TMP, f));
if (SHOTS.length !== SCREENS.length) throw new Error(`The PDF has ${SHOTS.length} screenshots but SCREENS has ${SCREENS.length} captions`);

function shot(i, w, q = 60) {
  const buf = execFileSync('magick', [SHOTS[i], '-resize', `${w}x`, '-quality', String(q), 'webp:-']);
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

/** The phone's body around a w-wide screen. Screens are 375 × 812. */
function bezel(w) {
  const h = f2((w * 812) / 375);
  const b = f2(w * 0.04);
  return `<rect x="${-b}" y="${-b}" width="${f2(w + 2 * b)}" height="${f2(h + 2 * b)}" rx="${f2(w * 0.12)}" fill="${BEZEL}" stroke="${EDGE}"/>`;
}

// ------------------------------------------------------------------ hero

function hero() {
  const W = 960;
  const H = 480;
  const pw = 196;
  const ph = f2((pw * 812) / 375);
  const [px, py] = [700, 28];
  const T = 9.6;
  const cycle = [0, 1, 11];
  const P = T / cycle.length;
  const imgs = cycle.map((i) => shot(i, 392, 62));
  let css = '';

  const screens = imgs
    .map((src, k) => {
      if (k) css += shown(`sc${k}`, T, k * P, k === cycle.length - 1 ? T - 0.5 : (k + 1) * P + 0.5, 0.5);
      return `<image class="${k ? `sc sc${k}` : ''}" href="${src}" width="${pw}" height="${ph}" clip-path="url(#scr)"/>`;
    })
    .join('\n');

  const stats = [
    [FACTS.qubits, 'qubits, one per choice'],
    [FACTS.optimum, 'exact optima recovered'],
    [FACTS.sortWrong, 'of farms a sort gets wrong'],
  ]
    .map(
      ([v, l], i) => `<g transform="translate(${48 + i * 184} 0)">
<text class="b" x="0" y="438" font-size="40" font-weight="500" fill="${INK}">${esc(v)}</text>
<text class="b" x="0" y="460" font-size="12" fill="${MUTED}">${esc(l)}</text>
${i ? `<path d="M-18 402V464" stroke="${EDGE}"/>` : ''}</g>`
    )
    .join('');

  const [t1, t2] = TAGLINE.split(', ');
  const body = `
<ellipse cx="${px + pw / 2}" cy="${py + ph / 2}" rx="230" ry="210" fill="url(#glow)" opacity=".3"/>
<g class="r r0"><text class="m" x="48" y="64" font-size="11" letter-spacing="2" fill="${ACC2}">QUANTUM-AI CROP ADVISOR · TAMIL NADU</text></g>
<g clip-path="url(#wm)"><text class="b wm" x="42" y="178" font-size="104" font-weight="700" letter-spacing="-3" fill="${INK}">FarmSync</text></g>
<path class="rule" d="M48 208H600" stroke="${INK}" stroke-opacity=".2"/>
<g class="r r1">
<text class="b" font-size="28" fill="${INK}"><tspan x="48" y="252">${esc(t1)},</tspan><tspan x="48" y="286">${esc(t2)}</tspan></text>
<text class="b" font-size="14" fill="${MUTED}"><tspan x="48" y="324">A guidebook for new farmers in Tamil Nadu: which crops</tspan><tspan x="48" y="344">will grow on their land, the order to plant them across</tspan><tspan x="48" y="364">the year, and what the soil needs first.</tspan></text>
</g>
<path class="r r2" d="M48 392H600" stroke="${EDGE}"/>
<g class="r r2">${stats}</g>
<g class="r r1" transform="translate(${px} ${py})">${bezel(pw)}
${screens}</g>`;

  css += `
.sc{opacity:0}
@keyframes rise{from{opacity:0;transform:translateY(16px)}}
.r{animation:rise .9s ${OUTE} both}.r0{animation-delay:.1s}.r1{animation-delay:.9s}.r2{animation-delay:1.3s}
@keyframes wm{from{transform:translateY(120px)}}
.wm{animation:wm 1.1s ${OUTE} .2s both}
@keyframes rule{from{transform:scaleX(0)}}
.rule{transform-origin:48px 208px;animation:rule 1.2s ${EASE} .7s both}`;

  const defs = `<clipPath id="wm"><rect x="0" y="80" width="${W}" height="120"/></clipPath>`;
  return frame(W, H, body, {
    css,
    defs,
    title: `FarmSync, a quantum-AI crop advisor for Tamil Nadu. ${TAGLINE} A phone cycles through sign-in, the farm list and the plan comparison.`,
  });
}

// --------------------------------------------------------------- screens

function screens() {
  const W = 960;
  const H = 450;
  const pw = 150;
  const ph = f2((pw * 812) / 375);
  const pitch = 180;
  const strip = SCREENS.length * pitch;
  const imgs = SCREENS.map((_, i) => shot(i, 260, 56));

  const defs = `${imgs.map((src, i) => `<image id="p${i}" width="${pw}" height="${ph}" href="${src}"/>`).join('\n')}
<linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset=".06" stop-color="#fff"/><stop offset=".94" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="fade"><rect width="${W}" height="${H}" fill="url(#edge)"/></mask>`;

  const card = ([tag, text], i, x) => `<g transform="translate(${x} 34)">${bezel(pw)}<use href="#p${i}" clip-path="url(#scr)"/>
<text class="m" y="${ph + 32}" font-size="10" letter-spacing="1.5" fill="${ACC2}">${String(i + 1).padStart(2, '0')} · ${esc(tag.toUpperCase())}</text>
<text class="b" font-size="12.5" fill="${INK}">${wrap(text, 24).map((t, j) => `<tspan x="0" y="${ph + 52 + j * 16}">${esc(t)}</tspan>`).join('')}</text></g>`;
  const once = SCREENS.map((s, i) => card(s, i, 48 + i * pitch)).join('\n');
  const twice = SCREENS.map((s, i) => card(s, i, 48 + strip + i * pitch)).join('\n');

  const css = `@keyframes slide{to{transform:translateX(-${strip}px)}}.track{animation:slide ${SCREENS.length * 4}s linear infinite}`;
  const body = `<g mask="url(#fade)"><g class="track">${once}${twice}</g></g>`;
  return frame(W, H, body, { css, defs, title: `${SCREENS.length} screens of the app sliding past, from ${SCREENS[0][0]} to ${SCREENS.at(-1)[0]}` });
}

// -------------------------------------------------------------- sequence

function sequence() {
  const W = 960;
  const H = 380;
  const { seasons, crops } = DEMO;
  const [cx, cw, ch, gap] = [150, 84, 44, 8];
  const rowY = (r) => 116 + r * (ch + gap);
  const colX = (c) => cx + c * (cw + gap);
  // Illustrative shots; the last frame is the real answer.
  const samples = [[2, 0, 1], [0, 3, 2], [1, 0, 3], [0, 2, 1], [3, 1, 0], [0, 1, 3]];
  const P = 0.45;
  const T = 8;
  const settle = samples.length * P;
  const bits = (s) => s.map((c) => crops.map((_, j) => (j === c ? '1' : '0')).join('')).join(' ');
  let css = '';

  const head = crops.map((c, j) => `<text class="m" x="${colX(j) + cw / 2}" y="104" font-size="10.5" fill="${MUTED}" text-anchor="middle">${esc(c)}</text>`).join('');
  const base = seasons
    .map(
      (s, r) => `<text class="m" x="48" y="${rowY(r) + 26}" font-size="11" letter-spacing="1" fill="${MUTED}">${esc(s.toUpperCase())}</text>
${crops.map((_, j) => `<rect x="${colX(j) + 0.5}" y="${rowY(r) + 0.5}" width="${cw - 1}" height="${ch - 1}" rx="8" fill="${rgba(C.cream, 0.03)}" stroke="${EDGE}"/><text class="m" x="${colX(j) + cw / 2}" y="${rowY(r) + 27}" font-size="13" fill="${DIM}" text-anchor="middle">0</text>`).join('')}`
    )
    .join('\n');

  const lit = (s, final) =>
    s
      .map(
        (c, r) => `<rect x="${colX(c)}" y="${rowY(r)}" width="${cw}" height="${ch}" rx="8" fill="${ACC}" fill-opacity="${final ? 1 : 0.7}"/><text class="m" x="${colX(c) + cw / 2}" y="${rowY(r) + 27}" font-size="13" fill="${INK}" text-anchor="middle">1</text>`
      )
      .join('');

  const frames = [...samples, DEMO.quantum.order]
    .map((s, k) => {
      const final = k === samples.length;
      css += shown(`f${k}`, T, k * P, final ? T : (k + 1) * P, 0.01);
      return `<g class="f f${k}">${final ? `<ellipse cx="${colX(1) + cw / 2}" cy="${rowY(1) + ch / 2}" rx="230" ry="110" fill="url(#glow)" opacity=".18"/>` : ''}${lit(s, final)}
<text class="m" x="48" y="300" font-size="11" fill="${final ? ACC2 : MUTED}">${final ? 'most measured' : `shot ${k + 1}`}</text>
<text class="m" x="${cx}" y="301" font-size="15" letter-spacing="1" fill="${INK}">${bits(s)}</text></g>`;
    })
    .join('\n');
  // Without animation, only the answer shows.
  css += `.f{opacity:0}.f${samples.length}{opacity:1}`;

  const order = (o) => o.map((c) => crops[c]).join(' → ');
  const row = (y, tag, plan, cls = '') => `<g${cls ? ` class="${cls}"` : ''}>
<text class="m" x="600" y="${y + 22}" font-size="10" letter-spacing="1.2" fill="${MUTED}">${esc(tag)}</text>
<text class="b" x="896" y="${y + 24}" font-size="16" font-weight="600" fill="${INK}" text-anchor="end">${esc(plan.value)}</text>
<text class="b" x="600" y="${y + 44}" font-size="13" fill="${INK}">${esc(order(plan.order))}</text></g>`;
  const box = (y) => `<rect x="584.5" y="${y + 0.5}" width="327" height="57" rx="10" fill="${rgba(C.cream, 0.04)}" stroke="${EDGE}"/>`;
  css += shown('qa', T, settle, T, 0.25) + shown('qb', T, 0, settle, 0.04) + '.qb{opacity:0}';

  const body = `
<text class="m" x="48" y="62" font-size="11" letter-spacing="1.5" fill="${ACC2}">x[season][crop] · ${seasons.length} × ${crops.length} = ${seasons.length * crops.length} QUBITS</text>
${head}
${base}
${frames}
<text class="b" font-size="12" fill="${MUTED}"><tspan x="48" y="332">The XY mixer keeps exactly one crop per season in every shot.</tspan><tspan x="48" y="350">The most-measured plan is the answer; nothing is re-sorted after.</tspan></text>
<path d="M552 40V350" stroke="${EDGE}"/>
<text class="m" x="584" y="62" font-size="11" letter-spacing="1.5" fill="${ACC2}">${esc(DEMO.farm.toUpperCase())}</text>
${box(84)}${row(84, 'SORT BY PROFIT', DEMO.sort)}
${box(152)}${row(152, 'GREEDY LOOK-AHEAD', DEMO.greedy)}
<rect x="584.5" y="220.5" width="327" height="57" rx="10" fill="${rgba(C.cream, 0.04)}" stroke="${EDGE}" stroke-dasharray="4 5"/>
<text class="m qb" x="600" y="254" font-size="11" fill="${MUTED}">sampling 2048 shots…</text>
<g class="qa"><rect x="584.5" y="220.5" width="327" height="57" rx="10" fill="${ACC}" fill-opacity=".14" stroke="${ACC}"/>${row(220, 'QUANTUM ORDER', DEMO.quantum)}
<text class="b" x="584" y="312" font-size="15" font-weight="600" fill="${INK}">+${esc(DEMO.gap)} over the year.</text>
<text class="b" font-size="12" fill="${MUTED}"><tspan x="584" y="332">Black gram after paddy earns ${esc(DEMO.bonus)} more than it</tspan><tspan x="584" y="350">would on its own. A sort cannot see that.</tspan></text></g>`;

  return frame(W, H, body, {
    css,
    title: `A grid of ${seasons.length * crops.length} qubits, ${seasons.length} seasons by ${crops.length} crops, flickers through samples with one crop per season, then settles on ${order(DEMO.quantum.order)}, which beats sorting by profit by ${DEMO.gap} on the demo farm`,
  });
}

// ---------------------------------------------------------------- wiring

function wiring() {
  const W = 960;
  const H = 380;
  const w = 160;
  const X = (i) => 40 + i * 180;
  const node = ({ x, y, h, title, sub, accent = false }) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="10" fill="${accent ? mix(NODE, ACC, 0.18) : NODE}" fill-opacity=".9" stroke="${accent ? ACC : EDGE}"/>
<text class="m" x="${x + 12}" y="${y + 22}" font-size="11.5" fill="${INK}">${esc(title)}</text>
${sub.map((s, i) => `<text class="b" x="${x + 12}" y="${y + 40 + i * 14}" font-size="10.5" fill="${MUTED}">${esc(s)}</text>`).join('')}`;

  const src = [
    ['Farmer', ['location, land size,', 'Soil Health Card']],
    ['crops.yaml', ['pH, salt and water', 'tolerance per crop']],
    ['weather · NDVI', ['Open-Meteo, NASA POWER,', 'Sentinel-2']],
    ['rotation.yaml', ['break-crop multipliers,', 'nitrogen credit']],
    ['fertilizers.yaml', ['nutrient grades,', 'bag sizes']],
  ].map(([title, sub], i) => ({ x: X(i), y: 52, h: 66, title, sub }));
  const pipe = [
    ['soil_card.py', ['readings → Low,', 'Medium, High'], 'ICAR thresholds'],
    ['crop_feasibility.py', ['which crops can grow,', 'and why not the rest'], 'agronomic rules'],
    ['yield_model.py', ['LightGBM: ₹ per crop,', 'with a P10–P90 band'], 'classical'],
    ['sparq.py', ['QAOA picks the order', `on ${FACTS.qubits} qubits`], 'quantum'],
    ['advisory.py', ['fertiliser bags, pH,', 'irrigation'], 'rules'],
  ].map(([title, sub, tag], i) => ({ x: X(i), y: 156, h: 66, title, sub, tag, accent: i === 3 }));
  const out = [
    ['RotationPlan', ['saved: order, circuit,', 'baselines, advice']],
    ['/farms/{id}/rank', ['POST · one call runs', 'the whole pipeline']],
    ['Flutter app', ['plan, quantum panel,', 'planner, report']],
  ].map(([title, sub], i) => ({ x: X(i + 2), y: 282, h: 66, title, sub }));

  const mid = (n) => n.x + w / 2;
  const curve = ([x1, y1], [x2, y2]) => {
    const dy = (y2 - y1) / 2;
    return `M${x1} ${y1}C${x1} ${y1 + dy} ${x2} ${y2 - dy} ${x2} ${y2}`;
  };
  const edges = [
    ...src.map((s, i) => ({ d: `M${mid(s)} ${s.y + s.h}V${pipe[i].y}`, begin: 0 })),
    ...pipe.slice(1).map((p, i) => ({ d: `M${pipe[i].x + w} ${p.y + p.h / 2}H${p.x}`, begin: 0.6 + i * 0.5 })),
    { d: curve([pipe[4].x + w - 28, pipe[4].y + pipe[4].h], [mid(out[1]), out[1].y]), begin: 2.8 },
    { d: `M${out[1].x} ${out[1].y + out[1].h / 2}H${out[0].x + w}`, begin: 3.4 },
    { d: `M${out[1].x + w} ${out[1].y + out[1].h / 2}H${out[2].x}`, begin: 3.4 },
  ];
  const lines = edges.map((e) => `<path d="${e.d}" fill="none" stroke="${ACC}" stroke-opacity=".35" stroke-width="1.2"/>`).join('');
  const packets = edges
    .map((e) => `<g class="mo"><circle r="8" fill="url(#glow)"/><circle r="2.6" fill="${INK}"/><animateMotion dur="1.6s" begin="${e.begin}s" repeatCount="indefinite" path="${e.d}"/></g>`)
    .join('');
  const tags = pipe.map((p) => `<text class="m" x="${mid(p)}" y="${p.y + p.h + 18}" font-size="10" fill="${p.accent ? ACC2 : DIM}" text-anchor="middle">${esc(p.tag)}</text>`).join('');

  const body = `
<g class="m" font-size="10" fill="${DIM}" letter-spacing="1.5"><text x="40" y="38">INPUTS</text><text x="40" y="146">PIPELINE</text><text x="40" y="272">SERVED</text></g>
${lines}
${[...src, ...pipe, ...out].map(node).join('\n')}
${tags}
${packets}`;
  return frame(W, H, body, {
    title: 'Farmer readings, crop and rotation tables, weather and NDVI feed soil_card, crop_feasibility, the LightGBM yield model, the SPARQ quantum step and advisory, served by POST /farms/{id}/rank to the Flutter app',
  });
}

// ---------------------------------------------------------------- footer

function footer() {
  const W = 960;
  const H = 210;
  const xs = [330, 480, 630];
  const d = `M${xs[0]} 64H${xs[2]}`;
  const dots = DEMO.seasons
    .map(
      (s, i) => `<circle cx="${xs[i]}" cy="64" r="6" fill="${mix(C.deepGreen, '#000000', 0.4)}" stroke="${ACC}" stroke-width="1.6"/>
<text class="m" x="${xs[i]}" y="94" font-size="10" letter-spacing="1.2" fill="${MUTED}" text-anchor="middle">${esc(s.toUpperCase())}</text>
<text class="b" x="${xs[i]}" y="112" font-size="13" fill="${INK}" text-anchor="middle">${esc(DEMO.crops[DEMO.quantum.order[i]])}</text>`
    )
    .join('');
  const body = `
<ellipse cx="480" cy="64" rx="180" ry="44" fill="url(#glow)" opacity=".25"/>
<path d="${d}" stroke="${ACC}" stroke-opacity=".5" stroke-width="1.2"/>
${dots}
<g class="mo"><circle r="12" fill="url(#glow)"/><circle r="3" fill="${INK}"/><animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.8;1" calcMode="linear" path="${d}"/></g>
<text class="b" x="480" y="160" font-size="22" fill="${INK}" text-anchor="middle">${esc(TAGLINE)}</text>
<text class="m" x="480" y="188" font-size="11" fill="${MUTED}" text-anchor="middle">Thanjavur  ·  Tamil Nadu  ·  farmsync-tan.vercel.app</text>`;
  return frame(W, H, body, { title: `${DEMO.seasons.join(', ')}: one crop each. ${TAGLINE}` });
}

// --------------------------------------------------------------- divider

function divider() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 16" width="960" height="16" role="img" aria-label="">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${MUTED}" stop-opacity="0"/><stop offset=".5" stop-color="${MUTED}" stop-opacity=".55"/><stop offset="1" stop-color="${MUTED}" stop-opacity="0"/></linearGradient>
<radialGradient id="s"><stop offset="0" stop-color="${ACC}"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></radialGradient></defs>
<style>@keyframes run{from{transform:translate(-80px,0)}to{transform:translate(1040px,0)}}.s{animation:run 5s ${EASE} infinite}@media (prefers-reduced-motion:reduce){.s{animation:none;opacity:0}}</style>
<rect x="0" y="7.5" width="452" height="1" fill="url(#g)"/><rect x="508" y="7.5" width="452" height="1" fill="url(#g)"/>
<path d="M464 8H496" stroke="${ACC}" stroke-opacity=".6"/>
${[464, 480, 496].map((x) => `<circle cx="${x}" cy="8" r="3" fill="none" stroke="${ACC}" stroke-opacity=".85" stroke-width="1.2"/>`).join('')}
<ellipse class="s" cy="8" rx="40" ry="3" fill="url(#s)"/>
</svg>
`;
}

const files = {
  'hero.svg': hero(),
  'screens.svg': screens(),
  'sequence.svg': sequence(),
  'wiring.svg': wiring(),
  'footer.svg': footer(),
  'divider.svg': divider(),
};
rmSync(TMP, { recursive: true, force: true });
for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, name), svg);
  console.log(`${name.padEnd(13)} ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
}
