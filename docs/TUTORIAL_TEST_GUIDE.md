# 🎓 ISBN Tutorial - Quick Test Reference

## 🚀 Quick Start (5 Steps)

```bash
# 1. App sudah running (pnpm tauri:dev)
# 2. Login → Navigate ke halaman Buku
# 3. Buka DevTools (F12)
# 4. Console: localStorage.removeItem('isbn-tutorial-completed')
# 5. Refresh (F5) → Tutorial muncul!
```

---

## 🧪 Test Commands (DevTools Console)

### Load Test Script
```javascript
// Copy-paste from: apps/desktop/public/test-tutorial.js
// Or load from URL:
fetch('/test-tutorial.js').then(r => r.text()).then(eval);
```

### Run Tests
```javascript
testIsbnTutorial()        // Full test suite
resetTutorial()           // Clear & reload
showTutorial()            // Force show (requires refresh)
checkTutorialStatus()     // Check current state
```

---

## ✅ Manual Test Checklist

- [ ] Tutorial muncul otomatis (first-time)
- [ ] Modal overlay (background gelap)
- [ ] Welcome screen: "🎉 Fitur Baru: ISBN Scanner"
- [ ] Buttons: "Skip Tutorial" | "Mulai"
- [ ] Navigate 7 steps (Next/Back)
- [ ] Arrow pointer ke "Impor via ISBN" button
- [ ] Step 7: "Mulai Scan" → ISBN Scanner auto-open
- [ ] localStorage: `isbn-tutorial-completed = 'true'`
- [ ] Tombol "Tutorial ISBN" ada (replay)
- [ ] After complete: refresh → no tutorial
- [ ] Styling smooth & responsive

---

## 🎯 Expected Flow

### First-Time User
1. Open /buku page
2. Wait 1 second
3. Tutorial modal appears
4. Follow 7 steps or skip
5. localStorage set
6. ISBN Scanner auto-opens (if complete)

### Returning User
1. Open /buku page
2. No tutorial (already completed)
3. "Tutorial ISBN" button available

---

## 🐛 Troubleshooting

### Tutorial tidak muncul?
```javascript
localStorage.getItem('isbn-tutorial-completed')  // Check value
localStorage.clear()                             // Force clear
location.reload()                                // Reload
```

### Button tidak ter-highlight?
```javascript
document.querySelector('[data-tour="isbn-import-button"]')
// Should return: <button> element
```

### Check if Shepherd.js loaded?
```javascript
Array.from(document.styleSheets).some(s => s.href?.includes('shepherd'))
// Should return: true
```

---

## 📊 Success Criteria

✅ **Tutorial berhasil jika:**
- Modal muncul otomatis untuk first-time user
- Semua 7 steps bisa di-navigate
- Target element ter-highlight
- Skip/Complete berfungsi
- localStorage persistence OK
- Replay button works
- Auto-open scanner after complete
- Styling smooth & responsive

---

## 📂 Files

- **Hook**: `apps/desktop/src/features/buku/useIsbnTutorial.ts`
- **CSS**: `apps/desktop/src/features/buku/isbn-tutorial.css`
- **Integration**: `apps/desktop/src/features/buku/BukuList.tsx`
- **Test Script**: `apps/desktop/public/test-tutorial.js`
- **Test Guide**: `apps/desktop/public/test-tutorial.html`

---

## 🔗 Quick Links

- **Open Test Guide**: http://localhost:1420/test-tutorial.html
- **Technical Docs**: `docs/INTERACTIVE_TUTORIAL.md`
- **GIF Guide**: `docs/SCREENTOGIF_GUIDE.md`
- **User Guide**: `docs/ISBN_SCANNER.md`

---

## 💡 Pro Tips

1. **Clear localStorage** sebelum test first-time flow
2. **Use test script** untuk automated testing
3. **Check Console** untuk errors
4. **Screenshot** setiap step untuk documentation
5. **Test di mobile** (responsive design)

---

## 📞 Need Help?

- Check `docs/INTERACTIVE_TUTORIAL.md` untuk technical details
- Run `checkTutorialStatus()` untuk debug
- Screenshot error di Console dan share

---

**Happy Testing! 🎉**
