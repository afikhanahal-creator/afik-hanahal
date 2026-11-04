// One phone design for the three messaging screens — the inbox (SocialInboxTab), the chats (GreenAPIChat + ChatComposer)
// and the Lead Center (MetaLeadsTab + LeadConversation, also the inbox's WhatsApp view and the lead card's chat).
// Injected once by AdminPanel after the components' own styles exist in the DOM order, so every rule here is scoped with
// :root (one more class of specificity) and !important only where the component sets the value inline.
//
// The scale (2026-11-04):
//   touch targets   icon buttons 40 px (36 px inside a composer bar), primary buttons 40 px, chips 32 px
//   icons           20 px in bars, 18 px in chips, stroke ≈ 2
//   radii           bubbles 12 px (tail corner 4 px), cards / composer 22 px, chips and pills 999 px
//   type            names 16 px / 600, body 15 px, secondary 12.5 px, meta 11 px; inputs 16 px (iOS zooms below 16)
//   spacing         4 · 8 · 12 · 16
//   header          one row of who (back · face · name + phone), then one sideways-scrolling row of tools
//   composer        the text on top, a bar of icon buttons under it, a round send button at its end
export const MOBILE_MSG_CSS = `
/* ── Touch screens: press-and-hold opens a bubble's menu (ChatMsgMenu), so the ▾ corner button never covers the text ── */
@media (hover: none) {
  :root .wa-bubble .wa-bub-btn, :root .lcv-b .wa-bub-btn, :root .si-bub .wa-bub-btn { display: none !important; }
  :root .wa-bubble, :root .lcv-b, :root .si-bub { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  :root .wa-bubble a, :root .lcv-b a, :root .si-bub a { -webkit-touch-callout: default; }
}

@media (max-width: 760px) {
  /* ── Chats tab: the header — who on the first row, the tools on a second, sideways-scrolling row ── */
  :root .wa-root .wa-chathead { height: auto !important; min-height: 56px; flex-wrap: wrap !important; overflow: visible !important; padding: 6px 8px 0 !important; gap: 4px 10px !important; align-content: flex-start; }
  :root .wa-root .wa-cname { min-width: 0 !important; flex: 1 1 0 !important; }
  :root .wa-root .wa-cname > div:first-child { font-size: 16px !important; line-height: 1.3; }
  :root .wa-root .wa-cname > div:last-child { font-size: 12.5px !important; }
  :root .wa-root .wa-head-tools { order: 9; flex: 0 0 calc(100% + 16px); margin: 2px -8px 0; display: flex; align-items: center; gap: 8px; overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 6px 12px 8px; border-top: 1px solid rgba(var(--ov), .07); }
  :root .wa-root .wa-head-tools::-webkit-scrollbar { display: none; }
  :root .wa-root .wa-head-tools > *, :root .wa-root .wa-head-tools > span > * { flex: none; }
  :root .wa-root .wa-head-tools button { min-height: 32px; }
  :root .wa-root .wa-head-tools .lp-chip { max-width: none; }
  /* bubbles: wide like the WhatsApp app, one radius, comfortable text */
  :root .wa-root .wa-bubble { max-width: 84% !important; min-width: 72px !important; font-size: 15px !important; line-height: 1.45 !important; border-radius: 12px !important; }
}
@media (min-width: 761px) { :root .wa-head-tools { display: contents; } }

@media (max-width: 640px) {
  /* ── Chats tab composer (ChatComposer) ── */
  :root .ccm { padding: 6px 8px 8px; }
  :root .ccm-card { border-radius: 22px; }
  :root .ccm textarea { font-size: 16px; line-height: 22px; padding: 11px 14px 3px; min-height: 44px; max-height: 132px; }
  :root .ccm-bar { gap: 2px; padding: 2px 4px 4px; }
  :root .ccm-ib { width: 38px; height: 38px; border-radius: 50%; color: var(--ccm-sub); }
  :root .ccm-ib svg { width: 21px; height: 21px; }
  :root .ccm-tpl { width: 38px; height: 38px; padding: 0; margin: 0; justify-content: center; border: none; border-radius: 50%; font-size: 0; gap: 0; color: var(--ccm-sub); }
  :root .ccm-tpl svg { width: 20px; height: 20px; }
  :root .ccm-tpl[aria-pressed=true] { background: rgba(0,168,132,.12); }
  :root .ccm-send { width: 42px; height: 42px; padding: 0; border-radius: 50%; margin-inline-start: auto; }
  :root .ccm-send svg { width: 19px; height: 19px; }
  :root .ccm-strip { padding: 6px 8px 6px 12px; }
  :root .ccm-emoji { grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); }
  :root .ccm-emoji button { height: 44px; font-size: 24px; }

  /* ── The shared conversation (LeadConversation): Lead Center, the inbox's WhatsApp, the lead card ── */
  :root .lcv-b { max-width: 84% !important; font-size: 15px; line-height: 20px; border-radius: 12px; }
  :root .lcv-b.tail.out { border-top-right-radius: 4px; } :root .lcv-b.tail.in { border-top-left-radius: 4px; }
  :root .lcv-card { border-radius: 22px; }
  :root .lcv-in { font-size: 16px; line-height: 22px; min-height: 42px; padding: 10px 14px 2px; max-height: 132px; }
  :root .lcv-bar { gap: 2px; padding: 2px 4px 4px; }
  :root .lcv-tplbtn { width: 38px; height: 38px; padding: 0; gap: 0; justify-content: center; border: none; border-radius: 50%; background: transparent; }
  :root .lcv-tplbtn span { display: none; }
  :root .lcv-tplbtn svg { width: 20px; height: 20px; }
  :root .lcv-tplbtn[aria-expanded=true] { background: rgba(0,168,132,.12); }
  :root .lcv-send { height: 42px; min-width: 42px; padding: 0 14px; margin-inline-start: auto; justify-content: center; }
  :root .lcv-send:not(.is-first):not(.is-label) { width: 42px; padding: 0; border-radius: 50%; font-size: 0; gap: 0; }
  :root .lcv-send svg { width: 19px; height: 19px; flex: none; }
  :root .lcv-quick { inset-inline: 4px; max-height: min(440px, 62vh); }

  /* small close / done buttons get a finger-sized target */
  :root .admin-shell .admin-notice > button:last-child { min-width: 36px !important; min-height: 36px !important; }
  :root .wa-root .wa-done-btn { width: 34px; height: 34px; font-size: 15px; }
  /* ── Lead Center list header: the KPIs a little smaller, the search box iOS-sized ── */
  :root .lc .lc-head-in { gap: 8px 10px; }
  :root .lc .lc-kpi { padding: 6px 10px; } :root .lc .lc-kpi b { font-size: 16px; }
  :root .lc .lc-tab { min-height: 34px; font-size: 13px; }

  /* ── Inbox (SocialInboxTab) ── */
  :root .si .si-conv { padding-left: 0 !important; padding-right: 0 !important; }   /* the public site's section { padding: 16px !important } */
  :root .si-conv-head { min-height: 56px; padding: 6px 8px !important; gap: 8px !important; }
  :root .si-who-name { font-size: 16px; }
  :root .si-who small { font-size: 12.5px; }
  :root .si-conv-head .si-icon { width: 40px; height: 40px; border: none; border-radius: 50%; }
  :root .si-tools { padding: 6px 12px 8px !important; }
  :root .si-bub { max-width: 84%; font-size: 15px; border-radius: 12px; }
  :root .si-msgs { padding: 12px 10px; }
  :root .si-composer { padding: 6px 8px 8px; gap: 6px; align-items: flex-end; }
  :root .si-composer textarea { font-size: 16px; line-height: 22px; min-height: 44px; max-height: 132px; border-radius: 22px; padding: 10px 14px; resize: none; }
  :root .si-composer .si-tplbtn, :root .si-composer .si-iconb { width: 40px; height: 44px; padding: 0; border: none; border-radius: 50%; justify-content: center; }
  :root .si-composer .si-send { width: 44px; height: 44px; padding: 0; border-radius: 50%; justify-content: center; font-size: 0; gap: 0; }
  :root .si-composer .si-send svg { width: 19px; height: 19px; }
  :root .si-search input, :root .lc .lc-input, :root .wa-root input[type=text], :root .wa-root input[type=search], :root .wa-root input:not([type]) { font-size: 16px; }
  :root .si-filters { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -14px; padding-inline: 14px; }
  :root .si-filters::-webkit-scrollbar, :root .si-pages::-webkit-scrollbar { display: none; }
  :root .si-filters button { flex: none; height: 32px; }
  :root .si-pages { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -14px; padding-inline: 14px; }
  :root .si-pages button { height: 30px; }
  :root .si-row { padding: 10px 8px; }
  :root .si-top > .si-muted:not(.si-small) { display: none; }   /* the screen's long description — the filters say it */
}
`
