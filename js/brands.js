/* ==========================================================================
   brands.js — the brand registry.

   A brand owns its artwork, its badge lockups, its backdrop set and the
   colours the text treatments draw from. Everything else in the studio is
   brand-agnostic: the canvas, the layout, uploads, video and export all work
   the same whichever brand is selected.

   To add a brand: drop its files under assets/<brand>/, add an entry here,
   and it appears in the header dropdown. Nothing else needs touching.
   ========================================================================== */

/* --- Ask Ruth ------------------------------------------------------------ */

const ASK_RUTH_PALETTE = {
  ink:     '#3b003a',
  plum:    '#4a0649',
  magenta: '#8c008f',
  mauve:   '#974498',
  orchid:  '#e18adf',
  pink:    '#ff8eff',
  blush:   '#ffdafe',
  lilac:   '#f5e5f5',
  cream:   '#f8f6ee',
  bodyOnDark:  '#efe4ef',
  bodyOnLight: '#654364',
};

const ASK_RUTH_ASSETS = {
  'pattern-pink':  'assets/pattern-pink.png',
  'pattern-lilac': 'assets/pattern-lilac.png',
  'pattern-plum':  'assets/pattern-plum.png',
  // v3.10 · the single motifs the patterns are built from (Figma › Brand assets › Pattern motifs)
  'motif-logo-plum':    'assets/motifs/askruth-logo-plum.png',
  'motif-logo-pink':    'assets/motifs/askruth-logo-pink.png',
  'motif-logo-cluster': 'assets/motifs/askruth-logo-cluster.png',

  'fuchsia-burst-portrait':  'assets/bg-fuchsia-burst-portrait.jpg',
  'fuchsia-burst-landscape': 'assets/bg-fuchsia-burst-landscape.jpg',
  'velvet-burst-portrait':   'assets/bg-velvet-burst-portrait.jpg',
  'velvet-burst-landscape':  'assets/bg-velvet-burst-landscape.jpg',
  'plum-burst-portrait':     'assets/bg-plum-burst-portrait.jpg',
  'plum-burst-landscape':    'assets/bg-plum-burst-landscape.jpg',
  'magenta-crop-portrait':   'assets/bg-magenta-crop-portrait.jpg',
  'magenta-crop-landscape':  'assets/bg-magenta-crop-landscape.jpg',
  'orchid-crop-portrait':    'assets/bg-orchid-crop-portrait.jpg',
  'orchid-crop-landscape':   'assets/bg-orchid-crop-landscape.jpg',
  'shadow-crop-portrait':    'assets/bg-shadow-crop-portrait.jpg',
  'shadow-crop-landscape':   'assets/bg-shadow-crop-landscape.jpg',

  'badge-plum':  'assets/badge-plum.png',
  'badge-cream': 'assets/badge-cream.png',
};

/* v3.23 · Stripes, in every brand: the classic TV colour bars, and bars in the brand's own colours.
   Patterns (kind 'tile') drawn by backdrops.js stripesFill — listed under Pattern, with Size and Tone down. */
const STRIPES_CLASSIC = ['#c8c8c8', '#d4cc00', '#00c4d2', '#00be3a', '#cc1fcc', '#d21a1a', '#1a2ad2'];
const stripeBackdrops = (prefix, brandColours, badge = 'plum') => [
  { id: `${prefix}stripes-classic`, name: 'Stripes Classic', kind: 'tile', base: '#c8c8c8', tone: 'light', badge, card: 'none', stripes: { colors: STRIPES_CLASSIC, w: 1 / 7 } },
  { id: `${prefix}stripes-brand`, name: 'Stripes Brand', kind: 'tile', base: brandColours[0], tone: 'light', badge, card: 'none', stripes: { colors: brandColours, w: 1 / 7 } },
];

const ASK_RUTH_BACKDROPS = [
  { id: 'pattern-pink',  name: 'Pattern Pink',  kind: 'tile', asset: 'pattern-pink',  base: '#ffacff', tone: 'light', badge: 'plum',  card: 'plum', motif: { asset: 'motif-logo-plum', tile: 0.0577, gx: 0.1, gy: 0.1, row: 0.5, ground: '#ffdafe', over: ['#ff8eff', 0.6] } },
  { id: 'pattern-lilac', name: 'Pattern Lilac', kind: 'tile', asset: 'pattern-lilac', base: '#f5e5f5', tone: 'light', badge: 'plum',  card: 'plum', motif: { asset: 'motif-logo-cluster', tile: 0.1307, gx: 0.1, gy: 0.1, row: 0, ground: '#f5e5f5', over: ['#f5e5f5', 0.5] } },
  { id: 'pattern-plum',  name: 'Pattern Plum',  kind: 'tile', asset: 'pattern-plum',  base: '#4a0649', tone: 'dark',  badge: 'cream', card: 'none', motif: { asset: 'motif-logo-pink', tile: 0.0577, gx: 0.1, gy: 0.1, row: 0.5, ground: '#4a0649', over: ['#4a0649', 0.5] } },

  { id: 'fuchsia-burst', name: 'Fuchsia Burst', kind: 'art', asset: 'fuchsia-burst', base: '#ff8eff', tone: 'light', badge: 'plum',  card: 'plum' },
  { id: 'velvet-burst',  name: 'Velvet Burst',  kind: 'art', asset: 'velvet-burst',  base: '#9d479c', tone: 'dark',  badge: 'cream', card: 'none' },
  { id: 'plum-burst',    name: 'Plum Burst',    kind: 'art', asset: 'plum-burst',    base: '#9d479c', tone: 'dark',  badge: 'cream', card: 'none' },

  { id: 'magenta-crop',  name: 'Magenta Crop',  kind: 'art', asset: 'magenta-crop',  base: '#a8319f', tone: 'dark',  badge: 'cream', card: 'none' },
  { id: 'orchid-crop',   name: 'Orchid Crop',   kind: 'art', asset: 'orchid-crop',   base: '#ce5ecd', tone: 'dark',  badge: 'cream', card: 'none' },
  { id: 'shadow-crop',   name: 'Shadow Crop',   kind: 'art', asset: 'shadow-crop',   base: '#9d669c', tone: 'dark',  badge: 'cream', card: 'none' },

  // Solid colours are not shown in the gallery — they are the seven swatches
  // of the Background colour picker, in this order.
  { id: 'solid-cream',   name: 'Cream',         kind: 'solid', base: '#f8f6ee', tone: 'light', badge: 'plum',  card: 'none' },
  { id: 'solid-blush',   name: 'Blush',         kind: 'solid', base: '#ffdafe', tone: 'light', badge: 'plum',  card: 'none' },
  { id: 'solid-pink',    name: 'Pink',          kind: 'solid', base: '#ff8eff', tone: 'light', badge: 'plum',  card: 'plum' },
  { id: 'solid-orchid',  name: 'Orchid',        kind: 'solid', base: '#e18adf', tone: 'light', badge: 'plum',  card: 'plum' },
  { id: 'solid-magenta', name: 'Magenta',       kind: 'solid', base: '#8c008f', tone: 'dark',  badge: 'cream', card: 'none' },
  { id: 'solid-plum',    name: 'Plum',          kind: 'solid', base: '#4a0649', tone: 'dark',  badge: 'cream', card: 'none' },
  { id: 'solid-ink',     name: 'Ink',           kind: 'solid', base: '#3b003a', tone: 'dark',  badge: 'cream', card: 'none' },
];

/* --- Moshpit --------------------------------------------------------------
   Colours come from the "Color" variables in the moshpit.dev — UI Figma file
   (its Light and Dark modes); the token each value was taken from is noted.
   The header mark is the round MoshPit badge. There is no export lockup yet,
   so the canvas has no badge.
   ------------------------------------------------------------------------ */

const MOSHPIT_PALETTE = {
  ink:     '#2a2316',   // text/headline · Light
  plum:    '#30302e',   // surface/card · Dark
  magenta: '#046e83',   // brand/cta · Light
  mauve:   '#41413d',   // surface/inner-card · Dark
  orchid:  '#0bb8d9',   // brand/cta-alt · Dark
  pink:    '#f346db',   // brand/pinkmosh · Dark
  blush:   '#d4d1c5',   // text/headline · Dark
  lilac:   '#a8a59c',   // text/foreground · Dark
  cream:   '#f1eee5',   // surface/background · Light
  bodyOnDark:  '#a8a59c',   // text/foreground · Dark
  bodyOnLight: '#3d3929',   // text/foreground · Light
};

const MOSHPIT_ASSETS = {
  // "Powered by" lockups (moshpit.dev logo), built like Ask Ruth's
  'mp-badge-dark':  'assets/moshpit/badge-dark.png',
  'mp-badge-light': 'assets/moshpit/badge-light.png',
  'mp-badge-sticker':      'assets/moshpit/badge-sticker.png',
  'mp-badge-sticker-pink': 'assets/moshpit/badge-sticker-pink.png',
  'mp-badge-ada':   'assets/t4r/badge-ada.png',     // shared with T4R Labs
  'mp-badge-clara': 'assets/t4r/badge-clara.png',
  'mp-badge-jimmy': 'assets/t4r/badge-jimmy.png',
  'pattern-specks': 'assets/moshpit/pattern-specks.png',
  'pattern-pink': 'assets/moshpit/pattern-pink.png',
  'pattern-skulls': 'assets/moshpit/pattern-skulls.png',
  'motif-skull': 'assets/motifs/moshpit-skull.png',
  'motif-logo':  'assets/motifs/moshpit-logo.png',
  'skull-burst-light-portrait':  'assets/moshpit/skull-burst-light-portrait.jpg',
  'skull-burst-light-landscape': 'assets/moshpit/skull-burst-light-landscape.jpg',
  'skull-burst-dark-portrait':  'assets/moshpit/skull-burst-dark-portrait.jpg',
  'skull-burst-dark-landscape': 'assets/moshpit/skull-burst-dark-landscape.jpg',
  'skull-badge-portrait':  'assets/moshpit/skull-badge-portrait.jpg',
  'skull-badge-landscape': 'assets/moshpit/skull-badge-landscape.jpg',
  'skull-badge-night-portrait':  'assets/moshpit/skull-badge-night-portrait.jpg',
  'skull-badge-night-landscape': 'assets/moshpit/skull-badge-night-landscape.jpg',
  // portraits
  'portrait-clara-portrait':  'assets/moshpit/portrait-clara-portrait.jpg',
  'portrait-clara-landscape': 'assets/moshpit/portrait-clara-landscape.jpg',
  'portrait-clara-circle-portrait':  'assets/moshpit/portrait-clara-circle-portrait.jpg',
  'portrait-clara-circle-landscape': 'assets/moshpit/portrait-clara-circle-landscape.jpg',
  'portrait-ada-portrait':  'assets/moshpit/portrait-ada-portrait.jpg',
  'portrait-ada-landscape': 'assets/moshpit/portrait-ada-landscape.jpg',
  'portrait-ada-circle-portrait':  'assets/moshpit/portrait-ada-circle-portrait.jpg',
  'portrait-ada-circle-landscape': 'assets/moshpit/portrait-ada-circle-landscape.jpg',
  'portrait-jimmy-portrait':  'assets/moshpit/portrait-jimmy-portrait.jpg',
  'portrait-jimmy-landscape': 'assets/moshpit/portrait-jimmy-landscape.jpg',
  'portrait-jimmy-circle-portrait':  'assets/moshpit/portrait-jimmy-circle-portrait.jpg',
  'portrait-jimmy-circle-landscape': 'assets/moshpit/portrait-jimmy-circle-landscape.jpg',
};

const MOSHPIT_BACKDROPS = [
  // patterns and artwork (Backdrop Creator archive) — the gallery
  { id: 'mp-pattern-specks', name: 'Pattern Specks', kind: 'tile', asset: 'pattern-specks', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none', motif: { asset: 'motif-logo', tile: 0.0909, gx: 0.22, gy: 0.17, row: 0.5, ground: '#23221c', over: ['#23221c', 0.6] } },
  { id: 'mp-pattern-pink', name: 'Pattern Pink', kind: 'tile', asset: 'pattern-pink', base: '#999999', tone: 'light', badge: 'plum', card: 'none', motif: { asset: 'motif-logo', tile: 0.0909, gx: 0.22, gy: 0.17, row: 0.5, ground: '#999999' } },
  { id: 'mp-pattern-skulls', name: 'Pattern Skulls', kind: 'tile', asset: 'pattern-skulls', base: '#37221c', tone: 'dark', badge: 'cream', card: 'none', motif: { asset: 'motif-skull', tile: 0.0896, gx: 0.22, gy: 0.17, row: 0.5, ground: '#23221c', over: ['#23221c', 0.6] } },
  { id: 'mp-skull-burst-light', name: 'Skull Burst Light', kind: 'art', asset: 'skull-burst-light', base: '#ffffff', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-skull-burst-dark', name: 'Skull Burst Dark', kind: 'art', asset: 'skull-burst-dark', base: '#000000', tone: 'dark', badge: 'cream', card: 'none' },
  { id: 'mp-skull-badge', name: 'Skull Badge', kind: 'art', asset: 'skull-badge', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-skull-badge-night', name: 'Skull Badge Night', kind: 'art', asset: 'skull-badge-night', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none' },
  // portraits — Clara, Ada, Jimmy (full bleed, colour circle)
  { id: 'mp-portrait-clara', name: 'Clara', kind: 'art', asset: 'portrait-clara', base: '#d5cbcd', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-portrait-clara-circle', name: 'Clara Circle', kind: 'art', asset: 'portrait-clara-circle', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-portrait-ada', name: 'Ada', kind: 'art', asset: 'portrait-ada', base: '#89877f', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-portrait-ada-circle', name: 'Ada Circle', kind: 'art', asset: 'portrait-ada-circle', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-portrait-jimmy', name: 'Jimmy', kind: 'art', asset: 'portrait-jimmy', base: '#ae997f', tone: 'light', badge: 'plum', card: 'none' },
  { id: 'mp-portrait-jimmy-circle', name: 'Jimmy Circle', kind: 'art', asset: 'portrait-jimmy-circle', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  // solid colours — the seven swatches of the Background colour picker
  { id: 'mp-paper',    name: 'Paper',    kind: 'solid', base: '#f1eee5', tone: 'light', badge: 'plum', card: 'none' },  // surface/background · Light
  { id: 'mp-sand',     name: 'Sand',     kind: 'solid', base: '#e3dfd2', tone: 'light', badge: 'plum', card: 'none' },  // surface/page-base · Light
  { id: 'mp-teal',     name: 'Teal',     kind: 'solid', base: '#046e83', tone: 'dark',  badge: 'cream', card: 'cream' }, // brand/cta · Light
  { id: 'mp-turquoise', name: 'Turquoise', kind: 'solid', base: '#0bb8d9', tone: 'light', badge: 'plum', card: 'none' },  // brand/cta-alt · Dark
  { id: 'mp-charcoal', name: 'Charcoal', kind: 'solid', base: '#262624', tone: 'dark',  badge: 'cream', card: 'none' },  // surface/background · Dark
  { id: 'mp-night',    name: 'Night',    kind: 'solid', base: '#1a1915', tone: 'dark',  badge: 'cream', card: 'none' },  // surface/accent · Dark
  { id: 'mp-pink',     name: 'Pink',     kind: 'solid', base: '#f346db', tone: 'light', badge: 'plum', card: 'plum' },  // brand/pinkmosh · Dark
];

/* --- T4R Labs --------------------------------------------------------------
   Type and panel colours come from the t4rlabs site and the T4R logo artwork
   (Backdrop Creator Figma file). Patterns and artwork come from the
   Backdrop Creator archive; the five solid colours are the colour picker.
   ------------------------------------------------------------------------ */

const T4R_PALETTE = {
  ink:     '#0e2236',   // site ink / headings
  plum:    '#0e253f',   // card navy — the default dark text panel
  magenta: '#123a63',   // deep blue
  mauve:   '#14283f',   // dark card
  orchid:  '#7fb4e8',   // dark-section numeral blue
  pink:    '#e751d2',   // logo pink
  blush:   '#ffffff',   // header on dark
  lilac:   '#eff3f8',   // page
  cream:   '#ffffff',   // the light text panel
  bodyOnDark:  '#eff3f8',
  bodyOnLight: '#5b6979',   // site body
};

const T4R_ASSETS = {
  // "Powered by" lockups, built like Ask Ruth's (pill on top, logo plate from 164 of 565 px)
  't4r-badge-dark':  'assets/t4r/badge-dark.png',
  't4r-badge-light': 'assets/t4r/badge-light.png',
  't4r-badge-ada':   'assets/t4r/badge-ada.png',
  't4r-badge-clara': 'assets/t4r/badge-clara.png',
  't4r-badge-jimmy': 'assets/t4r/badge-jimmy.png',
  't4r-badge-r':     'assets/t4r/badge-r.png',
  // grunge stickers — plain (black edge) and outlined
  't4r-badge-ada-sticker': 'assets/t4r/badge-ada-sticker.png',
  't4r-badge-ada-sticker-blush': 'assets/t4r/badge-ada-sticker-blush.png',
  't4r-badge-clara-sticker': 'assets/t4r/badge-clara-sticker.png',
  't4r-badge-clara-sticker-gold': 'assets/t4r/badge-clara-sticker-gold.png',
  't4r-badge-jimmy-sticker': 'assets/t4r/badge-jimmy-sticker.png',
  't4r-badge-jimmy-sticker-orange': 'assets/t4r/badge-jimmy-sticker-orange.png',
  't4r-badge-r-sticker': 'assets/t4r/badge-r-sticker.png',
  't4r-badge-r-sticker-magenta': 'assets/t4r/badge-r-sticker-magenta.png',
  'pattern-confetti': 'assets/t4r/pattern-confetti.png',
  'pattern-lilac': 'assets/t4r/pattern-lilac.png',
  'pattern-navy': 'assets/t4r/pattern-navy.png',
  'motif-confetti':   'assets/motifs/t4r-confetti.png',
  'motif-logo-light': 'assets/motifs/t4r-logo-light.png',
  'motif-logo-dark':  'assets/motifs/t4r-logo-dark.png',
  'labs-navy-portrait':  'assets/t4r/labs-navy-portrait.jpg',
  'labs-navy-landscape': 'assets/t4r/labs-navy-landscape.jpg',
  'labs-cyan-portrait':  'assets/t4r/labs-cyan-portrait.jpg',
  'labs-cyan-landscape': 'assets/t4r/labs-cyan-landscape.jpg',
  'mark-navy-portrait':  'assets/t4r/mark-navy-portrait.jpg',
  'mark-navy-landscape': 'assets/t4r/mark-navy-landscape.jpg',
  'mark-cyan-portrait':  'assets/t4r/mark-cyan-portrait.jpg',
  'mark-cyan-landscape': 'assets/t4r/mark-cyan-landscape.jpg',
  'circle-dark-portrait':  'assets/t4r/circle-dark-portrait.jpg',
  'circle-dark-landscape': 'assets/t4r/circle-dark-landscape.jpg',
  'circle-light-portrait':  'assets/t4r/circle-light-portrait.jpg',
  'circle-light-landscape': 'assets/t4r/circle-light-landscape.jpg',
  'labs-crop-portrait':  'assets/t4r/labs-crop-portrait.jpg',
  'labs-crop-landscape': 'assets/t4r/labs-crop-landscape.jpg',
  'bubbles-portrait':  'assets/t4r/bubbles-portrait.jpg',
  'bubbles-landscape': 'assets/t4r/bubbles-landscape.jpg',
  // the Ada / Clara / Jimmy portraits — the same files MoshPit uses
  'portrait-clara-portrait': 'assets/moshpit/portrait-clara-portrait.jpg',
  'portrait-clara-landscape': 'assets/moshpit/portrait-clara-landscape.jpg',
  'portrait-clara-circle-portrait': 'assets/moshpit/portrait-clara-circle-portrait.jpg',
  'portrait-clara-circle-landscape': 'assets/moshpit/portrait-clara-circle-landscape.jpg',
  'portrait-ada-portrait': 'assets/moshpit/portrait-ada-portrait.jpg',
  'portrait-ada-landscape': 'assets/moshpit/portrait-ada-landscape.jpg',
  'portrait-ada-circle-portrait': 'assets/moshpit/portrait-ada-circle-portrait.jpg',
  'portrait-ada-circle-landscape': 'assets/moshpit/portrait-ada-circle-landscape.jpg',
  'portrait-jimmy-portrait': 'assets/moshpit/portrait-jimmy-portrait.jpg',
  'portrait-jimmy-landscape': 'assets/moshpit/portrait-jimmy-landscape.jpg',
  'portrait-jimmy-circle-portrait': 'assets/moshpit/portrait-jimmy-circle-portrait.jpg',
  'portrait-jimmy-circle-landscape': 'assets/moshpit/portrait-jimmy-circle-landscape.jpg',
};

const T4R_BACKDROPS = [
  // patterns and artwork (Backdrop Creator archive) — the gallery
  { id: 't4r-pattern-confetti', name: 'Pattern Confetti', kind: 'tile', asset: 'pattern-confetti', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none', motif: { asset: 'motif-confetti', tile: 0.2504, gx: -0.11, gy: 0.03, row: 0, ground: '#e4e1d4', over: ['#e4e1d4', 0.6] } },
  { id: 't4r-pattern-lilac', name: 'Pattern Lilac', kind: 'tile', asset: 'pattern-lilac', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none', motif: { asset: 'motif-logo-light', tile: 0.1106, gx: 0.11, gy: 0.11, row: 0.5, ground: '#e4e1d4', over: ['#e4e1d4', 0.6] } },
  { id: 't4r-pattern-navy', name: 'Pattern Navy', kind: 'tile', asset: 'pattern-navy', base: '#11375e', tone: 'dark', badge: 'cream', card: 'none', motif: { asset: 'motif-logo-dark', tile: 0.1106, gx: 0.11, gy: 0.11, row: 0.5, ground: '#133d68', over: ['#10345a', 0.7] } },
  { id: 't4r-labs-navy', name: 'Labs Navy', kind: 'art', asset: 'labs-navy', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-labs-cyan', name: 'Labs Cyan', kind: 'art', asset: 'labs-cyan', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none' },
  { id: 't4r-mark-navy', name: 'Mark Navy', kind: 'art', asset: 'mark-navy', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-mark-cyan', name: 'Mark Cyan', kind: 'art', asset: 'mark-cyan', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none' },
  { id: 't4r-circle-dark', name: 'Circle Dark', kind: 'art', asset: 'circle-dark', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-circle-light', name: 'Circle Light', kind: 'art', asset: 'circle-light', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none' },
  { id: 't4r-labs-crop', name: 'Labs Crop', kind: 'art', asset: 'labs-crop', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none' },
  { id: 't4r-bubbles', name: 'Bubbles', kind: 'art', asset: 'bubbles', base: '#23221c', tone: 'dark', badge: 'cream', card: 'none' },
  // portraits (shared with MoshPit)
  { id: 't4r-portrait-clara', name: 'Clara', kind: 'art', asset: 'portrait-clara', base: '#d5cbcd', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-portrait-clara-circle', name: 'Clara Circle', kind: 'art', asset: 'portrait-clara-circle', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-portrait-ada', name: 'Ada', kind: 'art', asset: 'portrait-ada', base: '#89877f', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-portrait-ada-circle', name: 'Ada Circle', kind: 'art', asset: 'portrait-ada-circle', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-portrait-jimmy', name: 'Jimmy', kind: 'art', asset: 'portrait-jimmy', base: '#ae997f', tone: 'light', badge: 'plum', card: 'none' },
  { id: 't4r-portrait-jimmy-circle', name: 'Jimmy Circle', kind: 'art', asset: 'portrait-jimmy-circle', base: '#e4e1d4', tone: 'light', badge: 'plum', card: 'none' },
  // the Background colour picker — site and logo colours
  { id: 't4r-mist',  name: 'Mist',       kind: 'solid', base: '#eff3f8', tone: 'light', badge: 'plum', card: 'none' },  // site page
  { id: 't4r-white', name: 'White',      kind: 'solid', base: '#ffffff', tone: 'light', badge: 'plum', card: 'none' },  // site cards
  { id: 't4r-cyan',  name: 'Cyan',       kind: 'solid', base: '#03d5ff', tone: 'light', badge: 'plum', card: 'none' },  // logo cyan
  { id: 't4r-pink',  name: 'Pink',       kind: 'solid', base: '#e751d2', tone: 'light', badge: 'plum', card: 'none' },  // logo pink
  { id: 't4r-navy',  name: 'Navy',       kind: 'solid', base: '#0e253f', tone: 'dark',  badge: 'cream', card: 'none' },  // site card navy
  { id: 't4r-violet', name: 'Violet',    kind: 'solid', base: '#2d2d6b', tone: 'dark',  badge: 'cream', card: 'none' },  // logo violet
  { id: 't4r-black', name: 'Logo black', kind: 'solid', base: '#23221c', tone: 'dark',  badge: 'cream', card: 'none' },  // logo ground
  // the old grey placeholders — still resolvable for saved designs, not offered
  { id: 't4r-paper', name: 'Paper', kind: 'solid', base: '#f2f2f5', tone: 'light', badge: 'plum', card: 'none', listed: false },
  { id: 't4r-stone', name: 'Stone', kind: 'solid', base: '#e9e9ee', tone: 'light', badge: 'plum', card: 'none', listed: false },
  { id: 't4r-ink',   name: 'Ink',   kind: 'solid', base: '#0d0d10', tone: 'dark',  badge: 'cream', card: 'none', listed: false },
  { id: 't4r-slate', name: 'Slate', kind: 'solid', base: '#17171c', tone: 'dark',  badge: 'cream', card: 'none', listed: false },
];

/* --- v3.1 · Cogents -----------------------------------------------------------
   Ada, Clara, Jimmy and Ruth (the R) — the T4R portraits — as backgrounds in every brand:
   one round portrait and one grunge sticker each. A cogent background is a pattern of
   the cogent or a single large one, on a brand colour, round or as a speech bubble
   (backdrops.js `cogent` painter; its settings live in the background's adjust).
   The files are the badge artwork; `top` is where the "Powered by" pill ends. */
const COGENT_ASSETS = {
  'cogent-ada': 'assets/t4r/badge-ada.png',             'cogent-ada-sticker': 'assets/t4r/badge-ada-sticker.png',
  'cogent-clara': 'assets/t4r/badge-clara.png',         'cogent-clara-sticker': 'assets/t4r/badge-clara-sticker.png',
  'cogent-jimmy': 'assets/t4r/badge-jimmy.png',         'cogent-jimmy-sticker': 'assets/t4r/badge-jimmy-sticker.png',
  'cogent-ruth': 'assets/t4r/badge-r.png',              'cogent-ruth-sticker': 'assets/t4r/badge-r-sticker.png',
};
const COGENTS = [
  ['ada', 'Ada', 0.1718, 0.1662], ['clara', 'Clara', 0.1718, 0.1357],
  ['jimmy', 'Jimmy', 0.1718, 0.1392], ['ruth', 'Ruth', 0.1718, 0.1676],
];
/** A brand's cogent backgrounds, on its own light ground (`only`: the brand's own cast, in its order). */
const cogentBackdrops = (ground, only) => (only ? only.map((k) => COGENTS.find((c) => c[0] === k)) : COGENTS).flatMap(([id, name, top, stickerTop]) => [
  { id: `cog-${id}`, name, kind: 'cogent', asset: `cogent-${id}`, top, sticker: false, base: ground, tone: 'light', badge: 'plum', card: 'none' },
  { id: `cog-${id}-sticker`, name: `${name} Sticker`, kind: 'cogent', asset: `cogent-${id}-sticker`, top: stickerTop, sticker: true, base: ground, tone: 'light', badge: 'plum', card: 'none' },
]);

/* --- registry ------------------------------------------------------------ */

export const BRANDS = {
  askruth: {
    id: 'askruth',
    name: 'Ask Ruth.AI',
    icon: 'assets/brand-askruth.png',   // the mark, cut from the badge artwork
    mark: 'assets/brand-askruth-mark.png',   // the whole speech-bubble mark on transparent — start screen (never cropped to a circle)
    palette: ASK_RUTH_PALETTE,
    assets: { ...ASK_RUTH_ASSETS, ...COGENT_ASSETS },
    badges: {
      // logoTop: where the logo starts in the lockup file, as a fraction of its
      // height — everything above it is the "Powered by" pill (163 of 565 px).
      plum:  { asset: 'badge-plum',  label: 'Dark',  logoTop: 163 / 565 },
      cream: { asset: 'badge-cream', label: 'Light', logoTop: 163 / 565 },
      // the text badge: upper, middle and lower are all words (render.js → textBadgeImage)
      text: { kind: 'text', label: 'Text', logoTop: 0.2806 },
    },
    // the text badge's middle plate: the lockup's plum with pink type
    textBadge: { fill: '#4a0649', ink: '#ff8eff', pillInk: '#ffffff' },
    // call to action: the pink pill with plum type from the badge lockup; bold = the H1 serif
    cta: {
      button: { bg: '#ff8eff', ink: '#4a0649', family: 'Poppins, system-ui, sans-serif', weight: 700 },
      bold:   { family: 'Bitter, Georgia, serif', weight: 700 },
    },
    defaultBackdrop: 'solid-blush',    // v4.1: a calm plain colour to start; the patterns are one tap away
    backdrops: [...ASK_RUTH_BACKDROPS, ...stripeBackdrops('', ['#ffdafe', '#ff8eff', '#e18adf', '#8c008f', '#4a0649', '#f8f6ee']), ...cogentBackdrops('#f8f6ee', ['ruth', 'clara', 'ada'])   /* Ask Ruth: no Jimmy Jazz */],
    // first in the gallery: a pattern, an image, a solid colour, then one more
    /* v3.1 · Gradient partners: a colour picked for a gradient pairs with this one first
       (neighbours in the brand's own ramp, so the first result already looks intentional) */
    gradients: { 'solid-plum': 'solid-magenta', 'solid-ink': 'solid-plum', 'solid-magenta': 'solid-plum', 'solid-pink': 'solid-orchid', 'solid-orchid': 'solid-magenta', 'solid-blush': 'solid-pink', 'solid-cream': 'solid-blush' },
    featured: ['pattern-pink', 'fuchsia-burst', 'solid-plum', 'pattern-lilac'],
    // the five colours offered for text and card backgrounds (Ask Ruth palette)
    swatches: [
      { name: 'Cream', hex: '#f8f6ee' }, { name: 'Blush', hex: '#ffdafe' }, { name: 'Pink', hex: '#ff8eff' },
      { name: 'Magenta', hex: '#8c008f' }, { name: 'Plum', hex: '#4a0649' },
    ],
    /* What a first switch to this brand opens on — its own copy, background,
       badge and text style. After that the brand keeps whatever you made. */
    starter: {
      backdrop: 'pattern-pink', badge: 'plum', textTone: 'light', card: true,
      overlay: { style: 'none', strength: 0.3 }, ctaStyle: 'button',
      // draft copy (2026-10-05), to be edited by Marco
      hook:  { h1: 'Stuck on a design call?' },
      value: { h1: 'Ask Ruth', body: '- Honest feedback in seconds\n- Grounded in design principles' },
      cta:   { h1: 'Get a second opinion', body: 'Link in bio', button: 'Ask Ruth now' },
    },
    /* Start from…: designs made from this brand's own pieces. The first is the
       brand template (what a first launch opens on). bg / ctaBg are backgrounds,
       badge a key of `badges`, card + tone the text style, dim the Darken wash. */
    proposals: [
      { id: 'simple', name: 'Simple', bg: 'solid-blush', badge: 'plum', card: true, tone: 'light', ctaBg: 'solid-plum' },   // v4.1: new projects start calm
      { id: 'template', name: 'Signature', bg: 'pattern-pink', badge: 'plum', card: true, tone: 'light', ctaBg: 'solid-plum' },
      { id: 'velvet', name: 'Velvet', bg: 'velvet-burst', badge: 'cream', card: true, tone: 'dark', ctaBg: 'solid-blush' },
      { id: 'fuchsia', name: 'Fuchsia', bg: 'fuchsia-burst', badge: 'plum', card: true, tone: 'light', ctaBg: 'solid-ink' },
      { id: 'editorial', name: 'Editorial', bg: 'solid-cream', badge: 'plum', card: false, tone: 'dark', ctaBg: 'solid-pink' },
      { id: 'plum-night', name: 'Plum night', bg: 'pattern-plum', badge: 'cream', card: true, tone: 'dark', ctaBg: 'solid-magenta' },
    ],
  },

  moshpit: {
    id: 'moshpit',
    name: 'MoshPit',
    icon: 'assets/brand-moshpit.png',   // the round badge, from the Backdrop Creator Figma file
    mono: 'MP',
    palette: MOSHPIT_PALETTE,
    assets: { ...MOSHPIT_ASSETS, ...COGENT_ASSETS },
    badges: {
      plum:  { asset: 'mp-badge-dark',  label: 'Dark',  logoTop: 0.2894 },
      cream: { asset: 'mp-badge-light', label: 'Light', logoTop: 0.2894 },
      // skull stickers
      sticker:     { asset: 'mp-badge-sticker',      label: 'Sticker',      logoTop: 0.1435, size: 0.26 },
      stickerPink: { asset: 'mp-badge-sticker-pink', label: 'Sticker Pink', logoTop: 0.1425, size: 0.26 },
      // the round portrait badges, shared with T4R Labs
      ada:   { asset: 'mp-badge-ada',   label: 'Ada',   logoTop: 0.1718, size: 0.24, round: true },
      clara: { asset: 'mp-badge-clara', label: 'Clara', logoTop: 0.1718, size: 0.24, round: true },
      jimmy: { asset: 'mp-badge-jimmy', label: 'Jimmy', logoTop: 0.1718, size: 0.24, round: true },
      // the text badge: upper, middle and lower are all words (render.js → textBadgeImage)
      text: { kind: 'text', label: 'Text', logoTop: 0.2806 },
    },
    // the text badge's middle plate: night with turquoise type, Roboto Black
    textBadge: { fill: '#1a1915', ink: '#0bb8d9', pillInk: '#f1eee5' },
    // moshpit.dev CTA: turquoise (brand/cta-alt) with near-black type, Roboto Black throughout
    cta: {
      button: { bg: '#0bb8d9', ink: '#1a1915', family: "Roboto, 'Arial Black', system-ui, sans-serif", weight: 900 },
      bold:   { family: "Roboto, 'Arial Black', system-ui, sans-serif", weight: 900 },
    },
    // moshpit.dev type: Roboto Black headlines, Poppins body — no serifs.
    // Roboto runs wide and tall-capped, so the header sets a touch smaller and tighter.
    type: {
      h1: { family: "Roboto, 'Arial Black', system-ui, sans-serif", weight: 900, size: 68,
            lh: 1.16, baseline: 0.215, bullet: 0.1, bulletY: 0.27 },
    },
    defaultBackdrop: 'mp-charcoal',       // v4.1: a calm plain colour to start; the patterns are one tap away
    backdrops: [...MOSHPIT_BACKDROPS, ...stripeBackdrops('mp-', ['#f1eee5', '#0bb8d9', '#046e83', '#f346db', '#262624', '#e3dfd2']), ...cogentBackdrops('#f1eee5')],
    haloColour: '#046e83',   // v3.1: a round badge's Halo starts in the brand's teal
    gradients: { 'mp-teal': 'mp-turquoise', 'mp-turquoise': 'mp-teal', 'mp-charcoal': 'mp-teal', 'mp-night': 'mp-charcoal', 'mp-pink': 'mp-teal', 'mp-paper': 'mp-sand', 'mp-sand': 'mp-paper' },   // v3.1 · Gradient partners
    featured: ['mp-pattern-skulls', 'mp-portrait-clara', 'mp-teal', 'mp-skull-burst-dark'],
    // moshpit.dev Color variables: surface/background · Light, brand/cta-alt, brand/pinkmosh, brand/cta, surface/accent · Dark
    swatches: [
      { name: 'Paper', hex: '#f1eee5' }, { name: 'Turquoise', hex: '#0bb8d9' }, { name: 'Pink', hex: '#f346db' },
      { name: 'Teal', hex: '#046e83' }, { name: 'Night', hex: '#1a1915' },
    ],
    starter: {
      backdrop: 'mp-pattern-skulls', badge: 'sticker', textTone: 'light', card: false,
      overlay: { style: 'dim', strength: 0.35 }, ctaStyle: 'button',
      hook:  { h1: 'Your AI crew is waiting' },
      value: { h1: 'Meet your cogents', body: '- Jimmy starts every project\n- Ada, Clara and Ruth join in' },
      cta:   { h1: 'Enter the pit', body: 'moshpit.dev', button: 'moshpit.dev' },
    },
    proposals: [
      { id: 'simple', name: 'Simple', bg: 'mp-charcoal', badge: 'sticker', card: false, tone: 'light', ctaBg: 'mp-night' },   // v4.1: new projects start calm
      { id: 'template', name: 'Signature', bg: 'mp-pattern-skulls', badge: 'sticker', card: false, tone: 'light', dim: 0.35, ctaBg: 'mp-night' },
      { id: 'clara', name: 'Clara', bg: 'mp-portrait-clara-circle', badge: 'plum', card: true, tone: 'light', ctaBg: 'mp-teal' },
      { id: 'night', name: 'Night shift', bg: 'mp-night', badge: 'stickerPink', card: false, tone: 'light', ctaBg: 'mp-turquoise' },
      { id: 'burst', name: 'Skull burst', bg: 'mp-skull-burst-dark', badge: 'jimmy', card: true, tone: 'dark', ctaBg: 'mp-pink' },
      { id: 'paper', name: 'Paper', bg: 'mp-paper', badge: 'ada', card: false, tone: 'dark', ctaBg: 'mp-teal' },
    ],
  },

  t4r: {
    id: 't4r',
    name: 'T4R Labs',
    icon: 'assets/brand-t4r.svg',       // the round T4R badge, from the Backdrop Creator Figma file
    mono: 'T4R',
    ui: 'light',                // the editor itself is light (see styles.css)
    palette: T4R_PALETTE,
    assets: { ...T4R_ASSETS, ...COGENT_ASSETS },
    badges: {
      plum:  { asset: 't4r-badge-dark',  label: 'Dark',  logoTop: 0.2952 },
      cream: { asset: 't4r-badge-light', label: 'Light', logoTop: 0.2894 },
      // round portrait badges — taller than wide, so drawn narrower (`size` is the
      // width as a share of the canvas's short edge; the lockups use 0.612)
      ada:   { asset: 't4r-badge-ada',   label: 'Ada',    logoTop: 0.1718, size: 0.24, round: true },
      clara: { asset: 't4r-badge-clara', label: 'Clara',  logoTop: 0.1718, size: 0.24, round: true },
      jimmy: { asset: 't4r-badge-jimmy', label: 'Jimmy',  logoTop: 0.1718, size: 0.24, round: true },
      rmark: { asset: 't4r-badge-r',     label: 'R mark', logoTop: 0.1718, size: 0.24, round: true },
      // grunge stickers: black-edged and outlined pairs (pill takes the outline colour)
      adaSticker: { asset: 't4r-badge-ada-sticker', label: 'Ada Sticker', logoTop: 0.1662, size: 0.26 },
      adaBlush: { asset: 't4r-badge-ada-sticker-blush', label: 'Ada Blush', logoTop: 0.1653, size: 0.26 },
      claraSticker: { asset: 't4r-badge-clara-sticker', label: 'Clara Sticker', logoTop: 0.1357, size: 0.24 },
      claraGold: { asset: 't4r-badge-clara-sticker-gold', label: 'Clara Gold', logoTop: 0.1339, size: 0.24 },
      jimmySticker: { asset: 't4r-badge-jimmy-sticker', label: 'Jimmy Sticker', logoTop: 0.1392, size: 0.24 },
      jimmyOrange: { asset: 't4r-badge-jimmy-sticker-orange', label: 'Jimmy Orange', logoTop: 0.1402, size: 0.24 },
      rSticker: { asset: 't4r-badge-r-sticker', label: 'R Sticker', logoTop: 0.1676, size: 0.26 },
      rMagenta: { asset: 't4r-badge-r-sticker-magenta', label: 'R Magenta', logoTop: 0.16, size: 0.26 },
      // the text badge: upper, middle and lower are all words (render.js → textBadgeImage)
      text: { kind: 'text', label: 'Text', logoTop: 0.2806 },
    },
    // the text badge's middle plate: navy with logo cyan
    textBadge: { fill: '#0e253f', ink: '#03d5ff', pillInk: '#ffffff' },
    // T4R CTA: logo cyan with site-ink type; same type family as Ask Ruth
    cta: {
      button: { bg: '#03d5ff', ink: '#0e2236', family: 'Poppins, system-ui, sans-serif', weight: 700 },
      bold:   { family: 'Bitter, Georgia, serif', weight: 700 },
    },
    defaultBackdrop: 't4r-mist',               // v4.1: a calm plain colour to start; the patterns are one tap away
    backdrops: [...T4R_BACKDROPS, ...stripeBackdrops('t4r-', ['#eff3f8', '#03d5ff', '#e751d2', '#2d2d6b', '#0e253f', '#ffffff']), ...cogentBackdrops('#eff3f8')],
    haloColour: '#2b6a83',   // v3.1: a round badge's Halo (the teal ring of the Figma badges)
    gradients: { 't4r-navy': 't4r-violet', 't4r-violet': 't4r-pink', 't4r-cyan': 't4r-pink', 't4r-pink': 't4r-violet', 't4r-black': 't4r-navy', 't4r-mist': 't4r-white', 't4r-white': 't4r-mist' },   // v3.1 · Gradient partners (cyan → pink is the logo's)
    featured: ['t4r-pattern-confetti', 't4r-portrait-jimmy', 't4r-navy', 't4r-labs-navy'],
    // T4R Labs: site white, logo cyan, logo pink, logo violet, card navy
    swatches: [
      { name: 'White', hex: '#ffffff' }, { name: 'Cyan', hex: '#03d5ff' }, { name: 'Pink', hex: '#e751d2' },
      { name: 'Violet', hex: '#2d2d6b' }, { name: 'Navy', hex: '#0e253f' },
    ],
    starter: {
      backdrop: 't4r-portrait-jimmy', badge: 'rSticker', textTone: 'dark', card: true,
      overlay: { style: 'dim', strength: 0.3, auto: true }, ctaStyle: 'bold',
      hook:  { h1: 'Fresh out of the lab' },
      value: { h1: 'What we’re building', body: '- Small ideas, shipped fast\n- Shared while they’re raw' },
      cta:   { h1: 'Follow the experiments', body: 'Link in bio', button: 'Follow the lab' },
    },
    proposals: [
      { id: 'simple', name: 'Simple', bg: 't4r-mist', badge: 'rSticker', card: true, tone: 'dark', ctaBg: 't4r-navy' },   // v4.1: new projects start calm
      { id: 'template', name: 'Signature', bg: 't4r-portrait-jimmy', badge: 'rSticker', card: true, tone: 'dark', dim: 0.3, ctaBg: 't4r-navy' },
      { id: 'confetti', name: 'Confetti', bg: 't4r-pattern-confetti', badge: 'plum', card: true, tone: 'light', ctaBg: 't4r-violet' },
      { id: 'navy', name: 'Navy', bg: 't4r-navy', badge: 'claraGold', card: false, tone: 'light', ctaBg: 't4r-cyan' },
      { id: 'labs', name: 'Labs', bg: 't4r-labs-cyan', badge: 'cream', card: true, tone: 'dark', ctaBg: 't4r-pink' },
      { id: 'ada', name: 'Ada', bg: 't4r-portrait-ada-circle', badge: 'rMagenta', card: true, tone: 'light', ctaBg: 't4r-black' },
    ],
  },
};

/* Backgrounds that were pre-dimmed copies of another. Dim does that for any
   background now, so they were retired; a saved design that used one opens
   on the original with Dim switched on. */
export const RETIRED = {
  'mp-skull-badge-soft': 'mp-skull-badge',
  'mp-skull-badge-night-soft': 'mp-skull-badge-night',
  'mp-skull-ghost-light': 'mp-skull-burst-light',
  'mp-skull-ghost-dark': 'mp-skull-burst-dark',
  'mp-portrait-clara-soft': 'mp-portrait-clara-circle',
  'mp-portrait-ada-soft': 'mp-portrait-ada-circle',
  'mp-portrait-jimmy-soft': 'mp-portrait-jimmy-circle',
  't4r-labs-soft': 't4r-labs-navy',
  't4r-mark-soft': 't4r-mark-navy',
  't4r-circle-soft': 't4r-circle-dark',
  't4r-labs-soft-dark': 't4r-labs-cyan',
  't4r-mark-soft-dark': 't4r-mark-cyan',
  't4r-circle-soft-dark': 't4r-circle-light',
  't4r-portrait-clara-soft': 't4r-portrait-clara-circle',
  't4r-portrait-ada-soft': 't4r-portrait-ada-circle',
  't4r-portrait-jimmy-soft': 't4r-portrait-jimmy-circle',
};

export const DEFAULT_BRAND = 'askruth';
export const brandOf = (id) => BRANDS[id] || BRANDS[DEFAULT_BRAND];
