// GovMap real-estate layer definitions, split into their own module so they can
// be imported (e.g. by the admin settings UI) WITHOUT pulling in the heavier
// GovMapWidget component — which lets the widget itself be lazy-loaded.

// Real-estate layers — on:true = shown by default
export const LAYERS_DEF = [
  { id:'PARCEL_ALL',       label:'חלקות',                on:true,  color:'#4B8CE8', cat:'מגרשים' },
  { id:'PARCEL_HOKS',      label:'גושים',                on:true,  color:'#5566AA', cat:'מגרשים' },
  { id:'KSHTANN_ASSETS',   label:'נכסי רמ"י',            on:false, color:'#8490D8', cat:'מגרשים' },
  { id:'TABA_DEST',        label:'ייעוד קרקע',           on:false, color:'#E84B4B', cat:'תכנון'  },
  { id:'PLAN_INFO',        label:'תכניות בניין עיר',     on:false, color:'#F7A348', cat:'תכנון'  },
  { id:'TAMA38',           label:'תמ"א 38',              on:false, color:'#A25DDC', cat:'תכנון'  },
  { id:'BUILDING_PERMITS', label:'היתרי בנייה',          on:false, color:'#00C875', cat:'תכנון'  },
  { id:'ARCHEOLOGY',       label:'אתרים ארכיאולוגיים',   on:false, color:'#C4A35A', cat:'מגבלות' },
  { id:'NATBDR',           label:'גבולות מינהליים',       on:false, color:'#E2445C', cat:'מגבלות' },
  { id:'bus_stops',        label:'תחנות אוטובוס',        on:false, color:'#82F67F', cat:'סביבה'  },
  { id:'TRAIN_LINES',      label:'קווי רכבת',            on:false, color:'#0073EA', cat:'סביבה'  },
  { id:'GASSTATIONS',      label:'תחנות דלק',            on:false, color:'#F7C948', cat:'סביבה'  },
  { id:'SCHOOL_AREAS',     label:'אזורי בתי ספר',        on:false, color:'#03C9D7', cat:'סביבה'  },
]

export const LAYER_CATS_DEF = ['מגרשים', 'תכנון', 'נדל"ן', 'גבולות', 'מגבלות', 'סביבה']

export const BG_OPTIONS = [
  { v:'0', label:'רחובות ומבנים' },
  { v:'1', label:'תצלום אוויר'  },
  { v:'2', label:'משולב'        },
  { v:'9', label:'טופוגרפי'     },
  { v:'3', label:'CIR'          },
]
