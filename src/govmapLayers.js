// GovMap real-estate layer definitions, split into their own module so they can
// be imported (e.g. by the admin settings UI) WITHOUT pulling in the heavier
// GovMapWidget component — which lets the widget itself be lazy-loaded.

// Real-estate layers — on:true = shown by default.
// IMPORTANT: the `id` of each layer MUST be a real GovMap server layer code, taken
// verbatim from GovMap's official "Appendix A" (api.govmap.gov.il/docs/intro/attache-a).
// Invalid codes are silently ignored by setVisibleLayers — which is why the previous
// codes (PARCEL_HOKS, TABA_DEST, TAMA38, ARCHEOLOGY, NATBDR, TRAIN_LINES, …) showed
// nothing. Every code below was verified against that appendix.
export const LAYERS_DEF = [
  // ── מגרשים ──
  { id:'PARCEL_ALL',          label:'חלקות',                 on:true,  color:'#4B8CE8', cat:'מגרשים' },
  { id:'SUB_GUSH_ALL',        label:'גושים',                 on:true,  color:'#5566AA', cat:'מגרשים' },
  { id:'retzefMigrashim',     label:'מגרשי תב"ע (רמ"י)',     on:false, color:'#8490D8', cat:'מגרשים' },
  { id:'migrashim_msbs',      label:'מגרשים (משב"ש)',        on:false, color:'#6C7BD0', cat:'מגרשים' },
  // ── תכנון ──
  { id:'retzefGvulot',        label:'תב"ע - רמ"י',           on:false, color:'#E84B4B', cat:'תכנון'  },
  { id:'taba_msbs_itm',       label:'תב"ע - משב"ש',          on:false, color:'#F7A348', cat:'תכנון'  },
  { id:'BlueLines_Tamatamam', label:'תיחומי תמ"א / תמ"מ',    on:false, color:'#A25DDC', cat:'תכנון'  },
  { id:'mitchmim_mshbsh',     label:'התחדשות עירונית',       on:false, color:'#00C875', cat:'תכנון'  },
  // ── נדל"ן ──
  { id:'Michrazim',           label:'מכרזי רמ"י',            on:false, color:'#FF7A45', cat:'נדל"ן'  },
  { id:'Michrazim_Haluka',    label:'מכרזי רמ"י - מגרשים',   on:false, color:'#FFA94D', cat:'נדל"ן'  },
  // ── גבולות ──
  { id:'LOCALITY_210410',     label:'גבולות ישובים',        on:false, color:'#E2445C', cat:'גבולות' },
  { id:'LOCALITY_VAAD0410',   label:'גבולות וועדים',         on:false, color:'#D6336C', cat:'גבולות' },
  { id:'MMI_districts',       label:'מחוזות רמ"י',           on:false, color:'#BE4BDB', cat:'גבולות' },
  // ── מגבלות ──
  { id:'atikot_sites_itm',    label:'אתרי עתיקות',           on:false, color:'#C4A35A', cat:'מגבלות' },
  // ── סביבה ──
  { id:'bus_stops',           label:'תחנות אוטובוס',         on:false, color:'#82F67F', cat:'סביבה'  },
  { id:'GASSTATIONS',         label:'תחנות דלק',             on:false, color:'#F7C948', cat:'סביבה'  },
  { id:'trans_lines',         label:'תחבורה ציבורית',        on:false, color:'#20C997', cat:'סביבה'  },
  { id:'BL_LIN_P',            label:'תכניות רכבת',           on:false, color:'#0073EA', cat:'סביבה'  },
]

export const LAYER_CATS_DEF = ['מגרשים', 'תכנון', 'נדל"ן', 'גבולות', 'מגבלות', 'סביבה']

export const BG_OPTIONS = [
  { v:'0', label:'רחובות ומבנים' },
  { v:'1', label:'תצלום אוויר'  },
  { v:'2', label:'משולב'        },
  { v:'9', label:'טופוגרפי'     },
  { v:'3', label:'CIR'          },
]
