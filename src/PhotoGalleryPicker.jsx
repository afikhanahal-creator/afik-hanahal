// "גלריה" next to "צירוף" in every chat (2026-11-08): every property's photos in one window — the lead's own project first —, pick
// one or several (across properties too, in the order picked), look at a photo big, and add them to the message as an album
// (the tray's remote files: nothing is uploaded again, Green fetches each photo by its URL). Optional: the properties' links into
// the box. Rules: src/lib/photoGallery.js (tested); the list: src/lib/propertiesStore.js.
// 2026-11-11: the office's own folders (lib/gallery-folders.js, src/lib/galleryStore.js) — "+ תיקייה חדשה", photos dragged in,
// picked from the computer / phone or pasted, into a folder of its own or as extra photos of an existing property; an uploaded
// photo is selected at once, so "upload → add to the message" is two clicks. The window was redesigned with it.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './uiIcons.jsx'
import { imageThumb, uploadGalleryPhoto } from './lib/templateImage.js'
import { useSharedProperties } from './lib/propertiesStore.js'
import { useGalleryFolders, galleryOps } from './lib/galleryStore.js'
import { newFolderId, MAX_FOLDER_PHOTOS } from '../lib/gallery-folders.js'
import { galleryEntries, imageFilesOnly, togglePick, picksToFiles, picksLinks, pushRecent } from './lib/photoGallery.js'

const RECENT_KEY = 'afik_gallery_recent_v1'
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const big = url => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1600&output=webp&q=82`
const hasFiles = e => Array.from(e.dataTransfer?.types || []).includes('Files')

const TR = {
  he: { title: 'גלריית נכסים', sub: n => (n ? `בחרו תמונות לשליחה ל${n}` : 'בחרו תמונות לשליחה בשיחה'), search: 'חיפוש תיקייה, נכס, עיר, רחוב…', close: 'סגירה',
    recent: 'נבחרו לאחרונה', match: 'הנכס של הליד', hidden: 'לא באוויר', photos: n => (n === 1 ? 'תמונה אחת' : `${n} תמונות`), all: n => `בחירת כל ה-${n}`, none: 'ניקוי הבחירה',
    open: 'פתיחה באתר', zoom: 'הגדלה', picked: (n, r) => `${n} נבחרו${r > n ? ` · אפשר עד ${r}` : ' · הגעתם למקסימום'}`, nothing: 'לחיצה על תמונה בוחרת אותה. אפשר לבחור מכמה תיקיות ונכסים.',
    links: 'להוסיף להודעה קישור לנכס', add: n => (n ? `הוספה להודעה (${n})` : 'הוספה להודעה'), cancel: 'ביטול', back: 'כל התיקיות', empty: 'אין עדיין תמונות בגלריה',
    noHit: 'לא נמצא דבר בחיפוש', loading: 'טוען את הגלריה…', pick: 'בחירה', unpick: 'הסרה מהבחירה', prev: 'הקודמת', next: 'הבאה', remove: 'הסרה', count: (i, n) => `${i} מתוך ${n}`,
    newFolder: 'תיקייה חדשה', folderName: 'שם התיקייה, למשל: בן גוריון 17', create: 'יצירה', myFolders: 'התיקיות שלי', props: 'נכסים', noFolders: 'עוד אין תיקיות משלכם. תיקייה חדשה מתאימה לנכס שעוד לא עלה לאתר.',
    upload: 'העלאת תמונות', uploadSub: 'או גררו לכאן', dropHere: n => `שחררו כאן כדי להוסיף ל"${n}"`, emptyFolder: 'התיקייה ריקה', emptyHint: 'גררו לכאן תמונות, הדביקו (Ctrl+V) או בחרו מהמחשב. תמונה שעולה נבחרת מיד לשליחה.',
    choose: 'בחירת תמונות', uploading: 'מעלה…', upN: n => `מעלה ${n}…`, failed: 'ההעלאה נכשלה', retry: 'הסרה', rename: 'שינוי שם', delFolder: 'מחיקת התיקייה', delPhoto: 'מחיקה מהגלריה',
    askDelFolder: (n, c) => `למחוק את התיקייה "${n}"${c ? ` ואת ${c} התמונות שבה` : ''}?`, askDelPhoto: 'למחוק את התמונה מהגלריה?', extra: 'הועלתה לגלריה', save: 'שמירה',
    pickFirst: 'בחרו תיקייה או נכס, ואז גררו לשם את התמונות', full: `אפשר עד ${MAX_FOLDER_PHOTOS} תמונות בתיקייה`, skipped: (n, why) => `${n === 1 ? 'קובץ אחד לא נוסף' : `${n} קבצים לא נוספו`}: ${why}`, added: n => (n === 1 ? 'התמונה עלתה ונבחרה' : `${n} תמונות עלו ונבחרו`) },
  en: { title: 'Property gallery', sub: n => (n ? `Pick photos to send to ${n}` : 'Pick photos to send'), search: 'Search a folder, property, town, street…', close: 'Close',
    recent: 'Picked lately', match: 'The lead\'s property', hidden: 'Not on the site', photos: n => (n === 1 ? '1 photo' : `${n} photos`), all: n => `Select all ${n}`, none: 'Clear selection',
    open: 'Open on the site', zoom: 'Enlarge', picked: (n, r) => `${n} selected${r > n ? ` · up to ${r}` : ' · that\'s the maximum'}`, nothing: 'Click a photo to select it. You can pick from several folders and properties.',
    links: 'Add the property link to the message', add: n => (n ? `Add to message (${n})` : 'Add to message'), cancel: 'Cancel', back: 'All folders', empty: 'No photos in the gallery yet',
    noHit: 'Nothing found', loading: 'Loading the gallery…', pick: 'Select', unpick: 'Unselect', prev: 'Previous', next: 'Next', remove: 'Remove', count: (i, n) => `${i} of ${n}`,
    newFolder: 'New folder', folderName: 'Folder name, e.g. 17 Ben Gurion', create: 'Create', myFolders: 'My folders', props: 'Properties', noFolders: 'No folders of your own yet. A new folder suits a property that isn\'t on the site yet.',
    upload: 'Upload photos', uploadSub: 'or drag them here', dropHere: n => `Drop here to add to "${n}"`, emptyFolder: 'This folder is empty', emptyHint: 'Drag photos here, paste (Ctrl+V) or choose from the computer. An uploaded photo is selected right away.',
    choose: 'Choose photos', uploading: 'Uploading…', upN: n => `Uploading ${n}…`, failed: 'Upload failed', retry: 'Dismiss', rename: 'Rename', delFolder: 'Delete folder', delPhoto: 'Delete from the gallery',
    askDelFolder: (n, c) => `Delete the folder "${n}"${c ? ` and its ${c} photos` : ''}?`, askDelPhoto: 'Delete this photo from the gallery?', extra: 'Uploaded to the gallery', save: 'Save',
    pickFirst: 'Choose a folder or a property, then drag the photos there', full: `Up to ${MAX_FOLDER_PHOTOS} photos in a folder`, skipped: (n, why) => `${n === 1 ? '1 file was not added' : `${n} files were not added`}: ${why}`, added: n => (n === 1 ? 'The photo was uploaded and selected' : `${n} photos were uploaded and selected`) },
}

const CSS = `
.pgk{position:fixed;inset:0;z-index:2600;background:var(--au-overlay,rgba(0,0,0,.45));display:flex;align-items:center;justify-content:center;padding:14px}
.pgk-win{width:min(1320px,100%);height:min(880px,calc(100dvh - 28px));display:flex;flex-direction:column;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid var(--au-line,#e5e7eb);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.28);overflow:hidden;font-size:14px}
.pgk-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--au-line)}
.pgk-hico{flex:none;width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:rgba(var(--brand-rgb,63,78,176),.1);color:var(--au-brand-text,#3F4EB0)}
.pgk-head h2{margin:0;font-size:17px;font-weight:700;line-height:1.2}
.pgk-head small{display:block;font-size:12.5px;color:var(--au-text3);font-weight:500;margin-top:2px}
.pgk-search{flex:1;max-width:440px;margin-inline-start:auto;display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:999px;background:rgba(var(--ov,0,0,0),.05);border:1px solid transparent;color:var(--au-text3);transition:border-color .12s,background .12s}
.pgk-search:focus-within{border-color:rgba(var(--brand-rgb,63,78,176),.55);background:var(--au-pop)}
.pgk-search input{flex:1;min-width:0;border:none;background:transparent;color:var(--au-text);font:inherit;font-size:14px;outline:none;min-height:0;box-shadow:none}
.pgk-ib{flex:none;width:36px;height:36px;min-height:0;min-width:0;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:none;background:transparent;color:var(--au-text2);cursor:pointer;padding:0}
.pgk-ib:hover{background:rgba(var(--ov,0,0,0),.07)}
.pgk-ib.danger:hover{background:rgba(224,82,82,.12);color:var(--au-red-text,#c0392b)}
.pgk-body{flex:1;min-height:0;display:grid;grid-template-columns:316px minmax(0,1fr)}
.pgk-side{overflow-y:auto;border-inline-end:1px solid var(--au-line);padding:10px;background:rgba(var(--ov,0,0,0),.02)}
.pgk-new{width:100%;height:44px;min-height:0;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;border:1.5px dashed rgba(var(--brand-rgb,63,78,176),.45);background:rgba(var(--brand-rgb,63,78,176),.05);color:var(--au-brand-text,#3F4EB0);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.pgk-new:hover{background:rgba(var(--brand-rgb,63,78,176),.1)}
.pgk-newf{display:flex;gap:6px;align-items:center}
.pgk-inp{flex:1;min-width:0;height:40px;min-height:0;padding:0 12px;border-radius:10px;border:1px solid rgba(var(--brand-rgb,63,78,176),.55);background:var(--au-input,var(--au-pop));color:var(--au-text);font:inherit;font-size:14px;outline:none}
.pgk-inp:focus{box-shadow:0 0 0 3px rgba(var(--brand-rgb,63,78,176),.18)}
.pgk-sec{display:flex;align-items:center;gap:6px;margin:14px 6px 6px;font-size:11.5px;font-weight:700;color:var(--au-text3);letter-spacing:.02em}
.pgk-sec span{font-weight:600;background:rgba(var(--ov,0,0,0),.07);border-radius:999px;padding:0 7px;line-height:17px}
.pgk-sidehint{margin:2px 8px 4px;font-size:12.5px;line-height:1.5;color:var(--au-text3)}
.pgk-row{position:relative;width:100%;display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:11px;border:none;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;min-height:0}
.pgk-row:hover{background:rgba(var(--ov,0,0,0),.05)}
.pgk-row[aria-current=true]{background:rgba(var(--brand-rgb,63,78,176),.12)}
.pgk-row.drop{background:rgba(var(--brand-rgb,63,78,176),.16);box-shadow:inset 0 0 0 2px var(--au-brand,#3F4EB0)}
.pgk-row img,.pgk-row .ph{width:60px;height:46px;border-radius:9px;object-fit:cover;flex:none;background:rgba(var(--ov,0,0,0),.08)}
.pgk-row .ph{display:flex;align-items:center;justify-content:center;color:var(--au-text3)}
.pgk-row .ph.f{background:rgba(var(--brand-rgb,63,78,176),.1);color:var(--au-brand-text,#3F4EB0)}
.pgk-row b{display:block;font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgk-row span.s{display:block;font-size:12px;color:var(--au-text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgk-tag{display:inline-block;font-size:10.5px;font-weight:600;border-radius:999px;padding:0 7px;line-height:17px;margin-inline-start:6px;vertical-align:1px;font-style:normal}
.pgk-tag.m{background:rgba(22,163,74,.14);color:var(--au-green-text,#15803d)}
.pgk-sel{flex:none;min-width:20px;height:20px;border-radius:999px;background:var(--au-brand,#3F4EB0);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.pgk-main{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0}
.pgk-mh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--au-line)}
.pgk-mh h3{margin:0;font-size:16px;font-weight:700;min-width:0;flex:1;display:flex;flex-direction:column}
.pgk-mh h3 .t{display:flex;align-items:center;gap:6px;min-width:0}
.pgk-mh h3 .t bdi{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgk-mh h3 small{font-size:12.5px;font-weight:500;color:var(--au-text3);margin-top:2px}
.pgk-btn{height:36px;min-height:0;min-width:0;padding:0 14px;border-radius:999px;border:1px solid var(--au-line);background:var(--au-pop);color:var(--au-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;white-space:nowrap}
.pgk-btn:hover{border-color:rgba(var(--brand-rgb,63,78,176),.5)}
.pgk-btn:disabled{opacity:.5;cursor:default}
.pgk-btn.up{border-color:transparent;background:rgba(var(--brand-rgb,63,78,176),.1);color:var(--au-brand-text,#3F4EB0)}
.pgk-btn.up:hover{background:rgba(var(--brand-rgb,63,78,176),.17)}
.pgk-note{display:flex;align-items:center;gap:8px;margin:10px 16px 0;padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.4;background:rgba(245,166,35,.13);color:var(--au-amber-text,#92600a)}
.pgk-note.ok{background:rgba(22,163,74,.12);color:var(--au-green-text,#15803d)}
.pgk-note span{flex:1;min-width:0}
.pgk-note button{flex:none;border:none;background:transparent;color:inherit;cursor:pointer;min-height:0;min-width:0;padding:2px 6px;font-size:14px}
.pgk-grid{flex:1;min-height:0;overflow-y:auto;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:12px;align-content:start}
.pgk-tile{position:relative;aspect-ratio:4/3;border-radius:13px;overflow:hidden;background:rgba(var(--ov,0,0,0),.07);cursor:pointer;border:none;padding:0;min-height:0;outline:none;transition:box-shadow .12s,transform .12s}
.pgk-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .18s}
.pgk-tile:hover img{transform:scale(1.035)}
.pgk-tile:focus-visible{box-shadow:0 0 0 3px var(--au-brand)}
.pgk-tile[aria-pressed=true]{box-shadow:0 0 0 3px var(--au-brand,#3F4EB0);transform:scale(.975)}
.pgk-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.26),transparent 34%,transparent 66%,rgba(0,0,0,.3));opacity:0;transition:opacity .12s;pointer-events:none}
.pgk-tile:hover::after,.pgk-tile:focus-within::after,.pgk-tile[aria-pressed=true]::after{opacity:1}
.pgk-check{position:absolute;z-index:1;top:8px;inset-inline-start:8px;width:27px;height:27px;border-radius:999px;border:2px solid #fff;background:rgba(0,0,0,.25);color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.pgk-tile[aria-pressed=true] .pgk-check{background:var(--au-brand,#3F4EB0);border-color:#fff}
.pgk-tb{position:absolute;z-index:1;bottom:8px;width:32px;height:32px;min-height:0;min-width:0;border-radius:999px;border:none;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .12s,background .12s;padding:0}
.pgk-tb.z{inset-inline-end:8px}.pgk-tb.d{inset-inline-start:8px}
.pgk-tb.d:hover{background:#c0392b}
.pgk-tile:hover .pgk-tb,.pgk-tile:focus-within .pgk-tb{opacity:1}
@media (hover:none){.pgk-tb{opacity:1}.pgk-tile::after{opacity:1}}
.pgk-add{aspect-ratio:4/3;border-radius:13px;border:1.5px dashed rgba(var(--brand-rgb,63,78,176),.45);background:rgba(var(--brand-rgb,63,78,176),.04);color:var(--au-brand-text,#3F4EB0);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;font:inherit;font-size:13.5px;font-weight:600;min-height:0;padding:8px;text-align:center}
.pgk-add:hover{background:rgba(var(--brand-rgb,63,78,176),.1)}
.pgk-add small{font-size:12px;font-weight:500;color:var(--au-text3)}
.pgk-up{position:relative;aspect-ratio:4/3;border-radius:13px;overflow:hidden;background:rgba(var(--ov,0,0,0),.07)}
.pgk-up img{width:100%;height:100%;object-fit:cover;display:block;opacity:.45}
.pgk-up .st{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--au-text);text-align:center;padding:8px}
.pgk-up.err .st{background:rgba(224,82,82,.16);color:var(--au-red-text,#c0392b)}
.pgk-up .st button{height:28px;min-height:0;min-width:0;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:12px;padding:0 10px;cursor:pointer}
.pgk-spin{width:24px;height:24px;border-radius:50%;border:3px solid rgba(var(--brand-rgb,63,78,176),.25);border-top-color:var(--au-brand,#3F4EB0);animation:pgk-spin .8s linear infinite}
@keyframes pgk-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.pgk-spin{animation-duration:2.4s}.pgk-tile,.pgk-tile img{transition:none}}
.pgk-zero{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:20px}
.pgk-zero .box{width:min(520px,100%);border:2px dashed rgba(var(--brand-rgb,63,78,176),.4);border-radius:18px;padding:34px 24px;text-align:center;background:rgba(var(--brand-rgb,63,78,176),.035);display:flex;flex-direction:column;align-items:center;gap:8px}
.pgk-zero .ic{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(var(--brand-rgb,63,78,176),.12);color:var(--au-brand-text,#3F4EB0)}
.pgk-zero b{font-size:16px}
.pgk-zero p{margin:0 0 6px;font-size:13.5px;line-height:1.55;color:var(--au-text3);max-width:400px}
.pgk-drop{position:absolute;inset:8px;z-index:5;border-radius:16px;border:2.5px dashed var(--au-brand,#3F4EB0);background:rgba(var(--brand-rgb,63,78,176),.14);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--au-brand-text,#3F4EB0);font-size:16px;font-weight:700;pointer-events:none;text-align:center;padding:20px}
.pgk-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--au-line);background:rgba(var(--ov,0,0,0),.03)}
.pgk-strip{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;align-items:center}
.pgk-strip .it{position:relative;flex:none;width:48px;height:48px;border-radius:9px;overflow:hidden}
.pgk-strip .it img{width:100%;height:100%;object-fit:cover}
.pgk-strip .it button{position:absolute;top:2px;inset-inline-end:2px;width:18px;height:18px;min-height:0;min-width:0;border-radius:999px;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:11px;line-height:1;cursor:pointer;padding:0}
.pgk-strip .it i{position:absolute;bottom:2px;inset-inline-start:3px;font-style:normal;font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.pgk-hint{font-size:13px;color:var(--au-text3)}
.pgk-cnt{font-size:12.5px;color:var(--au-text2);white-space:nowrap}
.pgk-lk{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--au-text2);cursor:pointer;white-space:nowrap}
.pgk-lk input{width:16px;height:16px;min-height:0;accent-color:var(--au-brand);appearance:auto}
.pgk-go{height:42px;min-height:0;padding:0 22px;border-radius:999px;border:none;background:var(--au-brand,#3F4EB0);color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.pgk-go:disabled{opacity:.45;cursor:default}
.pgk-empty{padding:28px 16px;text-align:center;color:var(--au-text3);font-size:13.5px}
.pgk-lb{position:fixed;inset:0;z-index:2700;background:rgba(0,0,0,.9);display:flex;flex-direction:column;color:#fff}
.pgk-lb-top{display:flex;align-items:center;gap:10px;padding:10px 14px}
.pgk-lb-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px}
.pgk-lb-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;padding:0 60px 12px}
.pgk-lb-img img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}
.pgk-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;min-height:0;min-width:0;border-radius:999px;border:none;background:rgba(255,255,255,.14);color:#fff;font-size:24px;cursor:pointer}
.pgk-lb .pgk-ib{color:#fff}.pgk-lb .pgk-ib:hover{background:rgba(255,255,255,.12)}
.pgk-lb-pick{height:38px;min-height:0;padding:0 18px;border-radius:999px;border:none;font:inherit;font-size:14px;font-weight:700;cursor:pointer;background:#fff;color:#111}
.pgk-lb-pick[aria-pressed=true]{background:var(--au-brand,#3F4EB0);color:#fff}
.pgk-back{display:none}
@media (max-width:760px){
  .pgk{padding:0}.pgk-win{height:100dvh;border-radius:0;border:none}
  .pgk-head{flex-wrap:wrap;padding:10px 12px}.pgk-hico{display:none}.pgk-search{order:3;flex-basis:100%;max-width:none;margin:0}
  .pgk-head .pgk-ib{margin-inline-start:auto}
  .pgk-body{grid-template-columns:minmax(0,1fr)}
  .pgk-body.has-prop .pgk-side{display:none}
  .pgk-body:not(.has-prop) .pgk-main{display:none}
  .pgk-back{display:inline-flex}
  .pgk-mh{gap:6px;padding:10px 12px}.pgk-mh h3,.pgk-mh .pgk-newf{flex-basis:100%;order:-1}.pgk-mh .pgk-btn{height:38px;padding:0 12px}
  .pgk-back{width:38px;padding:0!important;justify-content:center}.pgk-back span{display:none}.pgk-mh .pgk-clear{display:none}.pgk-mh .pgk-ib.danger{margin-inline-start:auto}
  .pgk-tb{width:28px;height:28px;bottom:5px}.pgk-tb.z{inset-inline-end:5px}.pgk-tb.d{inset-inline-start:5px}.pgk-check{width:24px;height:24px;top:5px;inset-inline-start:5px}
  .pgk-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:10px}.pgk-tile,.pgk-add,.pgk-up{aspect-ratio:1;border-radius:10px}
  .pgk-add small{display:none}
  .pgk-foot{gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}.pgk-strip{flex-basis:100%}.pgk-go{flex:1}.pgk-lk{flex-basis:100%}
  .pgk-lb-img{padding:0 0 12px}.pgk-lb-nav{display:none}
}`

/** open · onClose · onAdd(files, linksText) · room (how many files the tray still takes) · project (the lead's) · leadName · lang */
export default function PhotoGalleryPicker({ open, onClose, onAdd, room = 30, project = '', leadName = '', lang = 'he' }) {
  const t = TR[lang] || TR.he
  const raw = useSharedProperties(open)
  const { folders: stored, loaded: foldersLoaded } = useGalleryFolders(open)
  const [q, setQ] = useState('')
  const [cur, setCur] = useState('')          // an entry id (a property or a folder), 'recent', or '' (phones show the list)
  const [picks, setPicks] = useState([])
  const [links, setLinks] = useState(false)
  const [zoom, setZoom] = useState(-1)       // index in the shown photos, -1 = closed
  const [recent, setRecent] = useState(readRecent)
  const [naming, setNaming] = useState(null) // { mode: 'new' | 'rename', id?, value }
  const [ups, setUps] = useState([])         // uploads on their way: { key, entryId, name, preview, state: 'up' | 'err', why }
  const [note, setNote] = useState(null)     // { text, ok }
  const [drag, setDrag] = useState('')       // 'main' | an entry id (a file is being dragged over it)
  const winRef = useRef(null), fileRef = useRef(null), dragN = useRef(0)
  const { folders, properties: props } = useMemo(() => galleryEntries(raw, stored, { project, query: q }), [raw, stored, project, q])
  const entries = useMemo(() => [...folders, ...props], [folders, props])
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches
  useEffect(() => { if (open) { setPicks([]); setQ(''); setZoom(-1); setRecent(readRecent()); setCur(''); setNaming(null); setNote(null); setDrag('') } }, [open])
  // desktop: open on the lead's own (a folder or a property), else the first property, else the first folder; a phone starts on the list
  useEffect(() => {
    if (!open || cur || narrow || !entries.length) return
    setCur((entries.find(e => e.match) || props[0] || folders[0]).id)
  }, [open, cur, entries, props, folders, narrow])
  const entry = entries.find(e => e.id === cur) || null
  const shown = useMemo(() => (cur === 'recent'
    ? recent.map(r => ({ url: r.url, propId: r.propId, title: r.title, n: r.n || 1 }))
    : (entry?.images || []).map((url, i) => ({ url, propId: entry.kind === 'property' ? entry.id : '', title: entry.title, n: i + 1, own: entry.own.includes(url) }))), [cur, recent, entry])
  const max = Math.max(0, room)
  const pickedN = useMemo(() => new Map(picks.map((p, i) => [p.url, i + 1])), [picks])
  const toggle = useCallback(pk => setPicks(cur0 => togglePick(cur0, pk, max)), [max])
  const selAll = () => setPicks(cur0 => shown.reduce((a, pk) => (a.some(x => x.url === pk.url) ? a : togglePick(a, pk, max)), cur0))
  const clearHere = () => setPicks(cur0 => cur0.filter(p => !shown.some(s => s.url === p.url)))
  const add = () => {
    if (!picks.length) return
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(readRecent(), picks))) } catch {}
    onAdd?.(picksToFiles(picks, max), links ? picksLinks(picks, { lang }) : '')
    onClose?.()
  }
  const say = (text, ok = false) => setNote(text ? { text, ok } : null)

  // ── the office's own folders ────────────────────────────────────────────────────────────────────────────────────────
  const saveNaming = async () => {
    const name = (naming?.value || '').trim()
    if (!naming || !name) { setNaming(null); return }
    const id = naming.mode === 'new' ? newFolderId() : naming.id
    setNaming(null)
    if (naming.mode === 'new') { setQ(''); setCur(id) }
    const r = await galleryOps([naming.mode === 'new' ? { op: 'create', id, name } : { op: 'rename', id, name }])
    if (!r.ok || r.errors?.length) say(r.error || r.errors[0])
  }
  const deleteFolder = async e => {
    if (!e || e.kind !== 'folder' || !window.confirm(t.askDelFolder(e.title, e.images.length))) return
    setPicks(p => p.filter(x => !e.images.includes(x.url)))
    dropRecent(e.images)
    setCur('')
    const r = await galleryOps([{ op: 'delete', id: e.id }])
    if (!r.ok) say(r.error)
  }
  const dropRecent = urls => { try { const next = readRecent().filter(x => !urls.includes(x.url)); localStorage.setItem(RECENT_KEY, JSON.stringify(next)); setRecent(next) } catch {} }
  const deletePhoto = async pk => {
    if (!entry || !pk.own || !window.confirm(t.askDelPhoto)) return
    setPicks(p => p.filter(x => x.url !== pk.url))
    dropRecent([pk.url])
    const r = await galleryOps([{ op: 'remove', id: entry.folderId, urls: [pk.url] }])
    if (!r.ok) say(r.error)
  }
  // photos from a picker, a drop or a paste → compressed, uploaded 3 at a time, added to the entry's folder and selected
  const addFiles = useCallback(async (fileList, e) => {
    if (!e) { say(t.pickFirst); return }
    const { ok, bad } = imageFilesOnly(fileList, { lang })
    const roomIn = Math.max(0, MAX_FOLDER_PHOTOS - e.own.length)
    const files = ok.slice(0, roomIn)
    if (bad.length) say(t.skipped(bad.length, bad[0].why)); else if (ok.length > files.length) say(t.full); else say('')
    if (!files.length) return
    const stamp = Date.now()
    const items = files.map((f, i) => ({ key: `${stamp}-${i}`, entryId: e.id, name: f.name, preview: URL.createObjectURL(f), state: 'up' }))
    setUps(u => [...u, ...items])
    // a property's first extra photo makes its folder (the site's property itself is never changed)
    if (e.kind === 'property' && !stored.some(f => f.id === e.folderId)) galleryOps([{ op: 'create', id: e.folderId, name: e.title, propertyId: e.id }])
    let next = 0, done = 0
    const base = e.images.length
    const worker = async () => {
      while (next < files.length) {
        const i = next++
        try {
          const r = await uploadGalleryPhoto(files[i])
          const s = await galleryOps([{ op: 'add', id: e.folderId, photos: [{ url: r.url, name: files[i].name }] }])
          if (!s.ok) throw new Error(s.error)
          done++
          setPicks(p => togglePick(p.filter(x => x.url !== r.url), { url: r.url, propId: e.kind === 'property' ? e.id : '', title: e.title, n: base + i + 1 }, max))
          setUps(u => u.filter(x => x.key !== items[i].key))
          URL.revokeObjectURL(items[i].preview)
        } catch (err) { setUps(u => u.map(x => (x.key === items[i].key ? { ...x, state: 'err', why: err?.message || t.failed } : x))) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker))
    if (done && !bad.length) say(t.added(done), true)
  }, [lang, max, stored, t])
  const dismissUp = k => setUps(u => { const x = u.find(y => y.key === k); if (x) URL.revokeObjectURL(x.preview); return u.filter(y => y.key !== k) })
  const upsHere = ups.filter(u => u.entryId === cur)

  // keys: Esc closes the name box, then the big photo, then the window; ← / → move in the big photo; space selects it
  useEffect(() => {
    if (!open) return undefined
    const k = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (naming) setNaming(null); else if (zoom >= 0) setZoom(-1); else onClose?.() }
      else if (zoom >= 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); const fwd = (e.key === 'ArrowLeft') === (lang !== 'en'); setZoom(z => (z + (fwd ? 1 : -1) + shown.length) % shown.length) }
      else if (zoom >= 0 && e.key === ' ') { e.preventDefault(); if (shown[zoom]) toggle(shown[zoom]) }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [open, zoom, shown, toggle, onClose, lang, naming])
  // a pasted picture goes into the open folder / property
  useEffect(() => {
    if (!open) return undefined
    const p = e => {
      const files = Array.from(e.clipboardData?.files || []).filter(f => /^image\//.test(f.type))
      if (!files.length) return
      e.preventDefault()
      addFiles(files, entry)
    }
    window.addEventListener('paste', p)
    return () => window.removeEventListener('paste', p)
  }, [open, entry, addFiles])
  useEffect(() => { if (open && !narrow) setTimeout(() => winRef.current?.querySelector('.pgk-search input')?.focus(), 30) }, [open, narrow])
  if (!open) return null
  const z = zoom >= 0 ? shown[zoom] : null
  const dragProps = target => ({
    onDragEnter: e => { if (!hasFiles(e)) return; e.preventDefault(); if (target === 'main') dragN.current++; setDrag(target) },
    onDragOver: e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } },
    onDragLeave: e => { if (!hasFiles(e)) return; if (target === 'main') { dragN.current = Math.max(0, dragN.current - 1); if (!dragN.current) setDrag(d => (d === 'main' ? '' : d)) } else setDrag(d => (d === target ? '' : d)) },
  })
  const row = e => {
    const n = e.images.filter(u => pickedN.has(u)).length
    const busy = ups.filter(u => u.entryId === e.id && u.state === 'up').length
    return (
      <button key={e.id} type="button" className={`pgk-row${drag === e.id ? ' drop' : ''}`} role="listitem" aria-current={cur === e.id} onClick={() => setCur(e.id)}
        {...dragProps(e.id)} onDrop={ev => { if (!hasFiles(ev)) return; ev.preventDefault(); ev.stopPropagation(); dragN.current = 0; setDrag(''); setCur(e.id); addFiles(ev.dataTransfer.files, e) }}>
        {e.cover ? <img src={imageThumb(e.cover, 120)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/> : <div className="ph f"><Icon name="folder" size={20}/></div>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b><bdi>{e.title}</bdi>{e.match && <i className="pgk-tag m">{t.match}</i>}</b>
          <span className="s">{busy ? t.upN(busy) : [e.place, t.photos(e.images.length), e.status, e.kind === 'property' && !e.live ? t.hidden : ''].filter(Boolean).join(' · ')}</span>
        </div>
        {n > 0 && <span className="pgk-sel">{n}</span>}
      </button>
    )
  }
  const loading = !raw.length && !foldersLoaded
  return createPortal(
    // React events pass through a portal to the screen that opened it: a file dropped (or pasted) here must never also land in
    // the chat's own message tray behind the window
    <div className="pgk au" dir={lang === 'en' ? 'ltr' : 'rtl'} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}
      onDragEnter={e => e.stopPropagation()} onDragLeave={e => e.stopPropagation()} onPaste={e => e.stopPropagation()}
      onDragOver={e => { e.stopPropagation(); if (hasFiles(e)) e.preventDefault() }} onDrop={e => { e.stopPropagation(); if (hasFiles(e)) e.preventDefault() }}>
      <style>{CSS}</style>
      <div className="pgk-win" ref={winRef} role="dialog" aria-modal="true" aria-label={t.title}>
        <div className="pgk-head">
          <div className="pgk-hico"><Icon name="image" size={20}/></div>
          <div style={{ minWidth: 0 }}><h2>{t.title}</h2><small>{t.sub(leadName)}</small></div>
          <label className="pgk-search"><Icon name="search" size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/></label>
          <button type="button" className="pgk-ib" onClick={onClose} aria-label={t.close} title={t.close}><Icon name="x" size={18}/></button>
        </div>
        <div className={`pgk-body${cur ? ' has-prop' : ''}`}>
          <div className="pgk-side">
            {naming?.mode === 'new' ? (
              <form className="pgk-newf" onSubmit={e => { e.preventDefault(); saveNaming() }}>
                <input className="pgk-inp" autoFocus value={naming.value} maxLength={80} placeholder={t.folderName} aria-label={t.folderName} onChange={e => setNaming(n => ({ ...n, value: e.target.value }))}/>
                <button type="submit" className="pgk-btn up" disabled={!naming.value.trim()}>{t.create}</button>
                <button type="button" className="pgk-ib" onClick={() => setNaming(null)} aria-label={t.cancel}><Icon name="x" size={16}/></button>
              </form>
            ) : (
              <button type="button" className="pgk-new" onClick={() => setNaming({ mode: 'new', value: '' })}><Icon name="folderPlus" size={18}/>{t.newFolder}</button>
            )}
            {loading && <div className="pgk-empty">{t.loading}</div>}
            {!loading && <>
              <div className="pgk-sec">{t.myFolders}<span>{folders.length}</span></div>
              <div role="list">{folders.map(row)}</div>
              {!folders.length && !q && <p className="pgk-sidehint">{t.noFolders}</p>}
              {recent.length > 0 && !q && (
                <button type="button" className="pgk-row" aria-current={cur === 'recent'} onClick={() => setCur('recent')} style={{ marginTop: 6 }}>
                  <div className="ph"><Icon name="clock" size={18}/></div>
                  <div style={{ minWidth: 0, flex: 1 }}><b>{t.recent}</b><span className="s">{t.photos(recent.length)}</span></div>
                </button>
              )}
              <div className="pgk-sec">{t.props}<span>{props.length}</span></div>
              <div role="list">{props.map(row)}</div>
              {!entries.length && <div className="pgk-empty">{q ? t.noHit : t.empty}</div>}
            </>}
          </div>
          <div className="pgk-main" {...dragProps('main')} onDrop={e => { if (!hasFiles(e)) return; e.preventDefault(); dragN.current = 0; setDrag(''); addFiles(e.dataTransfer.files, entry) }}>
            {(entry || cur === 'recent') && (
              <div className="pgk-mh">
                <button type="button" className="pgk-btn pgk-back" onClick={() => setCur('')} aria-label={t.back} title={t.back}><Icon name={lang === 'en' ? 'chevronLeft' : 'chevronRight'} size={16}/><span>{t.back}</span></button>
                {naming?.mode === 'rename' ? (
                  <form className="pgk-newf" style={{ flex: 1, minWidth: 200 }} onSubmit={e => { e.preventDefault(); saveNaming() }}>
                    <input className="pgk-inp" autoFocus value={naming.value} maxLength={80} aria-label={t.rename} onChange={e => setNaming(n => ({ ...n, value: e.target.value }))}/>
                    <button type="submit" className="pgk-btn up" disabled={!naming.value.trim()}>{t.save}</button>
                    <button type="button" className="pgk-ib" onClick={() => setNaming(null)} aria-label={t.cancel}><Icon name="x" size={16}/></button>
                  </form>
                ) : (
                  <h3>
                    <span className="t"><bdi>{cur === 'recent' ? t.recent : entry.title}</bdi>
                      {entry?.kind === 'folder' && <button type="button" className="pgk-ib" style={{ width: 30, height: 30 }} onClick={() => setNaming({ mode: 'rename', id: entry.id, value: entry.title })} aria-label={t.rename} title={t.rename}><Icon name="pencil" size={15}/></button>}
                    </span>
                    {entry && <small>{[entry.place, t.photos(entry.images.length), entry.kind === 'property' && entry.own.length ? `${entry.own.length} ${lang === 'en' ? 'uploaded here' : 'הועלו לגלריה'}` : ''].filter(Boolean).join(' · ')}</small>}
                  </h3>
                )}
                {entry && <button type="button" className="pgk-btn up" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15}/>{t.upload}</button>}
                {shown.length > 0 && <button type="button" className="pgk-btn" onClick={selAll} disabled={picks.length >= max}>{t.all(shown.length)}</button>}
                {shown.some(s => pickedN.has(s.url)) && <button type="button" className="pgk-btn pgk-clear" onClick={clearHere}>{t.none}</button>}
                {entry?.kind === 'property' && entry.live && <a className="pgk-btn" href={`/p/${encodeURIComponent(entry.id)}`} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14}/>{t.open}</a>}
                {entry?.kind === 'folder' && <button type="button" className="pgk-ib danger" onClick={() => deleteFolder(entry)} aria-label={t.delFolder} title={t.delFolder}><Icon name="trash" size={17}/></button>}
              </div>
            )}
            {note && <div className={`pgk-note${note.ok ? ' ok' : ''}`} role="status"><span>{note.text}</span><button type="button" onClick={() => setNote(null)} aria-label={t.close}>✕</button></div>}
            {entry && !shown.length && !upsHere.length ? (
              <div className="pgk-zero">
                <div className="box">
                  <div className="ic"><Icon name="upload" size={26}/></div>
                  <b>{t.emptyFolder}</b>
                  <p>{t.emptyHint}</p>
                  <button type="button" className="pgk-go" onClick={() => fileRef.current?.click()}>{t.choose}</button>
                </div>
              </div>
            ) : (
              <div className="pgk-grid">
                {entry && <button type="button" className="pgk-add" onClick={() => fileRef.current?.click()}><Icon name="plus" size={22}/>{t.upload}<small>{t.uploadSub}</small></button>}
                {upsHere.map(u => (
                  <div key={u.key} className={`pgk-up${u.state === 'err' ? ' err' : ''}`} title={u.name}>
                    <img src={u.preview} alt=""/>
                    <div className="st">{u.state === 'up' ? <><span className="pgk-spin" aria-hidden="true"/>{t.uploading}</> : <><span>{u.why || t.failed}</span><button type="button" onClick={() => dismissUp(u.key)}>{t.retry}</button></>}</div>
                  </div>
                ))}
                {shown.map((pk, i) => {
                  const n = pickedN.get(pk.url)
                  return (
                    <div key={pk.url} className="pgk-tile" role="button" tabIndex={0} aria-pressed={!!n} aria-label={`${pk.title} ${pk.n}${n ? ` · ${t.unpick}` : ''}`}
                      onClick={() => toggle(pk)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(pk) } }}>
                      <img src={imageThumb(pk.url, 420)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
                      <span className="pgk-check" aria-hidden="true">{n || ''}</span>
                      {pk.own && cur !== 'recent' && <button type="button" className="pgk-tb d" aria-label={t.delPhoto} title={t.delPhoto} onClick={e => { e.stopPropagation(); deletePhoto(pk) }}><Icon name="trash" size={15}/></button>}
                      <button type="button" className="pgk-tb z" aria-label={t.zoom} title={t.zoom} onClick={e => { e.stopPropagation(); setZoom(i) }}><Icon name="zoomIn" size={16}/></button>
                    </div>
                  )
                })}
              </div>
            )}
            {drag === 'main' && <div className="pgk-drop"><Icon name="upload" size={34}/>{entry ? t.dropHere(entry.title) : t.pickFirst}</div>}
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) addFiles(f, entry) }}/>
          </div>
        </div>
        <div className="pgk-foot">
          <div className="pgk-strip" aria-live="polite">
            {!picks.length ? <span className="pgk-hint">{t.nothing}</span> : picks.map((p, i) => (
              <div key={p.url} className="it" title={`${p.title} ${p.n}`}>
                <img src={imageThumb(p.url, 100)} alt="" referrerPolicy="no-referrer"/><i>{i + 1}</i>
                <button type="button" aria-label={`${t.remove}: ${p.title} ${p.n}`} onClick={() => toggle(p)}>✕</button>
              </div>
            ))}
          </div>
          {picks.length > 0 && <span className="pgk-cnt">{t.picked(picks.length, max)}</span>}
          {picks.some(p => p.propId) && <label className="pgk-lk"><input type="checkbox" checked={links} onChange={e => setLinks(e.target.checked)}/>{t.links}</label>}
          <button type="button" className="pgk-btn" onClick={onClose}>{t.cancel}</button>
          <button type="button" className="pgk-go" disabled={!picks.length} onClick={add}>{t.add(picks.length)}</button>
        </div>
      </div>
      {z && (
        <div className="pgk-lb" role="dialog" aria-modal="true" aria-label={z.title} onMouseDown={e => { if (e.target === e.currentTarget) setZoom(-1) }}>
          <div className="pgk-lb-top">
            <button type="button" className="pgk-ib" onClick={() => setZoom(-1)} aria-label={t.close}><Icon name="x" size={18}/></button>
            <b><bdi>{z.title}</bdi> · {t.count(zoom + 1, shown.length)}</b>
            <button type="button" className="pgk-lb-pick" aria-pressed={pickedN.has(z.url)} onClick={() => toggle(z)}>{pickedN.has(z.url) ? `✓ ${t.unpick}` : t.pick}</button>
          </div>
          <div className="pgk-lb-img">
            <img src={big(z.url)} alt="" referrerPolicy="no-referrer"/>
            {shown.length > 1 && <>
              <button type="button" className="pgk-lb-nav" style={{ insetInlineStart: 8 }} aria-label={t.prev} onClick={() => setZoom(i => (i - 1 + shown.length) % shown.length)}>{lang === 'en' ? '‹' : '›'}</button>
              <button type="button" className="pgk-lb-nav" style={{ insetInlineEnd: 8 }} aria-label={t.next} onClick={() => setZoom(i => (i + 1) % shown.length)}>{lang === 'en' ? '›' : '‹'}</button>
            </>}
          </div>
        </div>
      )}
    </div>, document.body)
}
