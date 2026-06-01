# מפרט טכני: ממשק צ'אט Green API — מערכת ניהול אפיק הנחל

**גרסה:** 1.1  
**קהל יעד:** מפתח Frontend + מעצב UI/UX  
**מטרה:** שכפול מדויק של ממשק המשתמש של Green API console, מוטמע בעמוד הצ'אטים של מערכת האדמין.  
**עדיפות עליונה:** הצ'אט חייב לתפוס את **כל שטח הדף** — ללא ריווח מיותר בצדדים.

---

## 1. מה כבר קיים (מה שאין לשנות)

| פיצ'ר | סטטוס |
|---|---|
| שליחת הודעות WhatsApp דרך Green API | ✅ עובד |
| שמירת הודעות ב-Supabase (`chats` table) | ✅ עובד |
| רשימת שיחות (מלידים) | ✅ עובד |
| עיצוב WhatsApp Dark Theme | ✅ עובד |
| פריסת full-page לצ'אט | ✅ הוטמע בגרסה נוכחית |
| סרגל סטטוס Green API (ירוק/כתום/אדום) | ✅ הוטמע בגרסה נוכחית |
| כפתור "שיחה חדשה" (+) | ✅ הוטמע בגרסה נוכחית |
| `GET /api/chats/status` | ✅ הוטמע בגרסה נוכחית |
| `POST /api/chats/webhook` (מקבל הודעות נכנסות) | ✅ הוטמע בגרסה נוכחית |
| אסימוני Green API — **שרת בלבד**, לא חשופים לדפדפן | ✅ תמיד |

---

## 2. מה עדיין חסר (לפיתוח עתידי)

### 2.1 עדיפות גבוהה

#### א. עדכוני סטטוס הודעה בזמן אמת (ווּ כחול)
- כרגע: ✓✓ מוצג תמיד כ"נקרא" (כחול)
- נדרש: ✓ נשלח → ✓✓ אפור (נמסר) → ✓✓ כחול (נקרא)
- **מימוש:** שמירת `status` בטבלת `chats`, עדכון ב-webhook מסוג `outgoingMessageStatus`

#### ב. עדכונים בזמן אמת (Server-Sent Events)
- כרגע: polling כל 5 שניות
- נדרש: SSE endpoint שדוחף הודעות חדשות מיד כשנכנסות
- **מימוש:**
  ```js
  // Server: GET /api/chats/events (SSE)
  res.setHeader('Content-Type', 'text/event-stream')
  // Push on new message: res.write(`data: ${JSON.stringify(msg)}\n\n`)
  
  // Client:
  const es = new EventSource(`${API_BASE}/api/chats/events?auth=${ADMIN_TOKEN}`)
  es.onmessage = e => { const msg = JSON.parse(e.data); updateChats(msg) }
  ```

#### ג. תגי "הודעה נכנסת חדשה"
- Badge (מספר אדום) על כל שיחה ברשימה
- Badge על טאב "צ'אטים" בסרגל הניווט

#### ד. מוביל (Attachment) — שליחת קובץ/תמונה
- כפתור 📎 ליד שדה ההקלדה
- **Backend:** `POST /api/chats/send-file` → Green API `sendFileByUpload`
- תמיכה ב: jpeg/png, pdf

---

### 2.2 עדיפות בינונית

#### ה. אמוג'י picker
- כפתור 🙂 שפותח picker
- ספרייה מומלצת: `emoji-mart` (`npm install @emoji-mart/react @emoji-mart/data`)
- RTL-compatible

#### ו. תשובה להודעה (Quoted Reply)
- לחיצה ימנית / swipe על הודעה → "ענה"
- Green API תומך: פרמטר `quotedMessageId` ב-sendMessage

#### ז. שיחות שאינן בלידים
- כרגע: רשימת השיחות מסוננת מטבלת `contacts`
- נדרש: הצגת **כל** מספרי הטלפון מטבלת `chats` + מיזוג עם לידים
- `GET /api/chats/conversations` כבר קיים — רק לחבר לרשימה

---

### 2.3 עדיפות נמוכה (Nice-to-have)

- ⬜ הפעלת הודעות קוליות
- ⬜ Lightbox לתמונות (לחיצה מגדילה)
- ⬜ Group chat support
- ⬜ Typing indicator (Green API לא חושף — workaround נדרש)
- ⬜ העברת הודעות (Forward)

---

## 3. פלטת צבעים (Dark WhatsApp Theme)

| אלמנט | ערך |
|---|---|
| רקע ראשי | `#0B141A` |
| רקע sidebar | `#111B21` |
| header panels | `#202C33` |
| קו מפריד | `#2A3942` |
| בועת הודעה יוצאת | `#005C4B` |
| בועת הודעה נכנסת | `#1F2C33` |
| טקסט ראשי | `#E9EDEF` |
| טקסט משני/זמנים | `#8696A0` |
| טיק כחול (נקרא) | `#53BDEB` |
| ירוק (כפתור שליחה) | `#00A884` |

---

## 4. Webhook — הגדרה ב-Green API console

כדי לקבל הודעות נכנסות **בזמן אמת**, יש להגדיר ב-Green API:

1. כנס ל: `console.green-api.com`
2. בחר את ה-instance שלך
3. לחץ על "Settings" → "Webhooks"
4. הגדר:
   - **Webhook URL:** `https://afik-hanahal-server.onrender.com/api/chats/webhook`
   - **Events to enable:** `incomingMessageReceived`, `outgoingMessageStatus`, `stateInstanceChanged`
5. שמור

> עכשיו כל הודעה נכנסת נשמרת אוטומטית ב-Supabase ומוצגת כעבור ≤5 שניות (polling) או מיד (SSE — לפיתוח עתידי).

---

## 5. משתני סביבה (Render)

כל האסימונים חייבים להיות **על השרת בלבד** (Render env vars):

| משתנה | תיאור |
|---|---|
| `WA_GREENAPI_INSTANCE` | ID ה-instance מ-Green API console |
| `WA_GREENAPI_TOKEN` | apiTokenInstance מ-Green API console |
| `WA_GREENAPI_URL` | ברירת מחדל: `https://api.green-api.com` |
| `ADMIN_TOKEN` | טוקן ניהול — מגן על כל endpoints של `/api/chats` |

**אף אחד מהם לא עובר לדפדפן.** `VITE_*` variables בלבד עוברים ל-Vite.

---

## 6. ארכיטקטורת API הקיימת

```
Frontend (Vercel)          Backend (Render)           Green API
────────────────           ────────────────           ──────────
GET /api/chats/status  →   getStateInstance       →   Green API
POST /api/chats/send   →   sendMessage            →   Green API → WhatsApp
GET /api/chats/:phone  →   Supabase query
GET /api/chats/conv.   →   Supabase query
POST /api/chats/webhook←   (Green API pushes)     ←   incoming messages
```

---

## 7. קריטריוני קבלה

| # | תנאי |
|---|---|
| 1 | הצ'אט תופס את כל שטח הדף — ללא ריווח |
| 2 | שליחת הודעה מגיעה ל-WhatsApp של הנמען תוך ≤5 שניות |
| 3 | הודעה נכנסת מופיעה בממשק תוך ≤5 שניות (polling) |
| 4 | אסימוני Green API לא נראים ב-DevTools של הדפדפן |
| 5 | ניתן להתחיל שיחה עם מספר שאינו ברשימת הלידים |
| 6 | סרגל הסטטוס מציג מצב חיבור נכון (ירוק/כתום/אדום) |
| 7 | הממשק פועל ב-RTL עברית |
| 8 | טעינה מחדש מחזירה לשיחה האחרונה שנבחרה |

---

**סוף מפרט**