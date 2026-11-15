// The Lead Center's status chips (meta_leads.status: חדש · נוצר קשר · נקבעה שיחה · סגור) and the CRM pipeline stage
// (crm_data.leadStatus) say the same thing in two places, and used to drift apart — "נוצר קשר" next to "לא רלוונטי" (2026-11-15,
// the office: "if I set the status to נוצר קשר, change the stage to נוצר קשר by itself, and the same for interested / a meeting").
// One rule both ways, used by the Lead Center (status → stage) and by PATCH /api/contacts (stage → status, from every screen).
// Pure and tested (lead-status-sync.test.mjs).

/** the status chip a pipeline stage stands for */
export function statusForStage(stage) {
  switch (stage) {
    case 'new': return 'new'
    case 'meeting':
    case 'negotiating': return 'scheduled'
    case 'won':
    case 'irrelevant': return 'closed'
    // contacted · discovery ("מתעניין") · lost ("ללא מענה" — we tried) · nurture (later): we are in touch, nothing set yet
    case 'contacted':
    case 'discovery':
    case 'lost':
    case 'nurture': return 'contacted'
    default: return null
  }
}

const TARGET = { new: 'new', contacted: 'contacted', scheduled: 'meeting' }

/**
 * The stage a status chip moves the lead to, or null when the stage already says it.
 * A lead further along that still fits the chip stays where it is ("מתעניין" stays when "נוצר קשר" is chosen) — the chip
 * never pulls a lead backwards. "סגור" moves nothing: it can be a deal or "not relevant", so the person picks the stage.
 */
export function stageForStatus(status, currentStage) {
  const target = TARGET[status]
  if (!target) return null
  const cur = currentStage || 'new'
  if (statusForStage(cur) === status) return null
  return target === cur ? null : target
}

/** "סגור" chosen while the stage doesn't say closed: the stage menu opens so the person picks won / not relevant */
export const needsStagePick = (status, currentStage) => status === 'closed' && statusForStage(currentStage || 'new') !== 'closed'
