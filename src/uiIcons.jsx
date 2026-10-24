// One line-icon set for the messaging screens (chat composer, template windows, the templates tab) instead of emoji:
// 24-unit strokes in currentColor, so every icon follows the text color of light / dark themes. Shapes after Lucide (ISC).
const SHAPES = {
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>,
  send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  paperclip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
  smile: <><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></>,
  x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  pencil: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  image: <><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></>,
  star: <path d="M12 2.5 14.9 8.4l6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  insert: <><path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></>,
  file: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></>,
  plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
  undo: <><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></>,
  arrowBack: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></>,
  video: <><path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  // categories
  welcome: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/></>,
  followup: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  progress: <><path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/></>,
  closing: <><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></>,
  deal: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></>,
  personal: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  general: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>,
  sparkle: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>,
}

/** <Icon name="send" size={18}/> — `flip` mirrors it (a send arrow in a right-to-left screen points left) */
export function Icon({ name, size = 18, sw = 1.8, flip = false, style, title }) {
  const shape = SHAPES[name] || SHAPES.general
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false"
      style={{ flex: 'none', display: 'block', ...(flip ? { transform: 'scaleX(-1)' } : null), ...style }}>
      {title && <title>{title}</title>}
      {shape}
    </svg>
  )
}

/** A template category's icon on a soft tile of the category's color */
export function CatTile({ cat, color = '#8490D8', size = 34, radius = 9 }) {
  return (
    <span aria-hidden style={{ flex: 'none', width: size, height: size, borderRadius: radius, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}1C`, color }}>
      <Icon name={SHAPES[cat] ? cat : 'general'} size={Math.round(size * 0.5)} sw={1.9}/>
    </span>
  )
}
