# Interactive Tutorial Feature - Implementation Summary

## 📋 Overview

Implementasi interactive tutorial untuk fitur ISBN Scanner menggunakan **Shepherd.js**. Tutorial ini akan otomatis muncul saat first-time user membuka halaman Buku, dan bisa di-replay kapan saja.

---

## ✅ What's Implemented

### 1. **Interactive Tutorial Hook** (`useIsbnTutorial.ts`)
**Location**: `apps/desktop/src/features/buku/useIsbnTutorial.ts`

**Features**:
- 7-step guided tour dengan modal overlay
- Highlight target elements dengan tooltip
- Skip & replay functionality
- Auto-trigger untuk first-time users
- LocalStorage persistence (track completion status)

**Steps**:
1. Welcome message
2. Show "Impor via ISBN" button location
3. Explain scanner modes (Scan Barcode vs Input Manual)
4. Preview metadata fields
5. Auto-fill form explanation
6. Tips & tricks
7. Finish & call-to-action

### 2. **Custom CSS Styling** (`isbn-tutorial.css`)
**Location**: `apps/desktop/src/features/buku/isbn-tutorial.css`

**Features**:
- Modern, clean design
- Smooth animations & transitions
- Responsive (mobile-friendly)
- Pulse animation untuk highlight target
- Custom button styles (primary & secondary)

### 3. **Integration ke BukuList** (`BukuList.tsx`)
**Location**: `apps/desktop/src/features/buku/BukuList.tsx`

**Changes**:
- Import `useIsbnTutorial` hook
- Add tutorial state management
- First-time trigger (check localStorage)
- Auto-open ISBN scanner after tutorial complete
- Add "Tutorial ISBN" button untuk replay

**Data Attributes**:
- `data-tour="isbn-import-button"` - Target element untuk step 2

### 4. **Documentation**
**Files**:
- `docs/SCREENTOGIF_GUIDE.md` - Panduan lengkap recording GIF tutorial
- `docs/ISBN_SCANNER.md` - Updated dengan mention interactive tutorial

---

## 🎯 User Flow

### First-Time User
1. User buka halaman Buku (pertama kali)
2. Delay 1 detik (biar UI render dulu)
3. Tutorial modal muncul otomatis
4. User bisa:
   - **Follow tutorial**: Step-by-step guide (7 steps)
   - **Skip tutorial**: Klik "Skip Tutorial" atau close button
5. Setelah complete/skip → `localStorage.setItem('isbn-tutorial-completed', 'true')`
6. Jika complete → auto-open ISBN Scanner modal

### Returning User
1. User buka halaman Buku
2. Tutorial tidak muncul (sudah pernah complete/skip)
3. User bisa replay tutorial dengan klik tombol **"Tutorial ISBN"**

---

## 🔧 Technical Details

### Dependencies
```json
{
  "shepherd.js": "^15.2.2"
}
```

### LocalStorage Key
```typescript
'isbn-tutorial-completed' // 'true' jika sudah pernah complete/skip
```

### Hook API
```typescript
const { startTour, cancelTour, tour } = useIsbnTutorial({
  enabled: true,           // Enable/disable tutorial
  onComplete: () => {},    // Callback saat tutorial selesai
  onSkip: () => {},        // Callback saat user skip
});
```

### CSS Classes
- `.shepherd-theme-custom` - Custom theme class
- `.shepherd-element` - Modal container
- `.shepherd-button` - Button styles
- `.shepherd-target-highlight` - Pulse animation untuk target

---

## 📱 Responsive Design

Tutorial fully responsive:
- **Desktop**: Full-width modal dengan arrow pointer
- **Mobile**: Compact modal, smaller text, touch-friendly buttons

---

## 🎨 Customization

### Change Tutorial Steps
Edit `useIsbnTutorial.ts`:
```typescript
tour.addStep({
  id: 'custom-step',
  title: 'Custom Title',
  text: '<p>Custom content</p>',
  attachTo: {
    element: '[data-tour="target-element"]',
    on: 'bottom', // top, bottom, left, right
  },
  buttons: [
    { text: 'Back', action: tour.back, secondary: true },
    { text: 'Next', action: tour.next },
  ],
});
```

### Change Styling
Edit `isbn-tutorial.css`:
```css
.shepherd-element {
  background: white;
  border-radius: 8px;
  /* Custom styles */
}
```

### Change Trigger Delay
Edit `BukuList.tsx`:
```typescript
const timer = setTimeout(() => {
  setShowTutorial(true);
}, 1000); // Change delay here (ms)
```

---

## 🧪 Testing

### Manual Testing
1. **First-time flow**:
   ```typescript
   // Clear localStorage
   localStorage.removeItem('isbn-tutorial-completed');
   // Refresh page → tutorial should auto-start
   ```

2. **Replay flow**:
   ```typescript
   // Click "Tutorial ISBN" button
   // Tutorial should start again
   ```

3. **Skip flow**:
   ```typescript
   // Start tutorial → click "Skip Tutorial"
   // localStorage should be set
   // Tutorial should not appear on next visit
   ```

### Automated Testing (Future)
```typescript
// Playwright/Cypress test
test('should show tutorial for first-time user', async () => {
  await page.goto('/buku');
  await page.evaluate(() => localStorage.removeItem('isbn-tutorial-completed'));
  await page.reload();
  
  // Wait for tutorial modal
  await page.waitForSelector('.shepherd-element');
  
  // Check welcome step
  expect(await page.textContent('.shepherd-title')).toBe('🎉 Fitur Baru: ISBN Scanner');
  
  // Click "Mulai"
  await page.click('button:has-text("Mulai")');
  
  // Check step 2
  expect(await page.textContent('.shepherd-title')).toBe('Tombol Impor via ISBN');
});
```

---

## 📊 Analytics (Future Enhancement)

Track tutorial engagement:
```typescript
// Add analytics events
onComplete: () => {
  analytics.track('isbn_tutorial_completed');
  localStorage.setItem('isbn-tutorial-completed', 'true');
},
onSkip: () => {
  analytics.track('isbn_tutorial_skipped');
  localStorage.setItem('isbn-tutorial-completed', 'true');
},
```

---

## 🐛 Known Issues & Limitations

1. **Target Element Not Found**:
   - Jika element dengan `data-tour="isbn-import-button"` tidak ada, step akan error
   - **Solution**: Add error handling atau skip step jika element tidak ada

2. **Mobile Keyboard Overlap**:
   - Pada mobile, keyboard bisa overlap dengan tutorial modal
   - **Solution**: Adjust modal position atau disable tutorial di mobile

3. **LocalStorage Persistence**:
   - Jika user clear browser data, tutorial akan muncul lagi
   - **Solution**: Sync completion status ke backend (future)

---

## 🚀 Future Enhancements

### 1. **Multi-language Support**
```typescript
const { t } = useTranslation();

tour.addStep({
  title: t('tutorial.welcome.title'),
  text: t('tutorial.welcome.text'),
});
```

### 2. **Progress Indicator**
```typescript
// Add progress bar
tour.addStep({
  text: `
    <div class="shepherd-progress">
      <div class="shepherd-progress-bar" style="width: ${(currentStep / totalSteps) * 100}%"></div>
    </div>
    <p>Step ${currentStep} of ${totalSteps}</p>
  `,
});
```

### 3. **Contextual Tutorials**
- Tutorial berbeda untuk fitur berbeda (Peminjaman, Anggota, dll)
- Trigger tutorial saat user klik fitur baru

### 4. **Video Embed**
```typescript
tour.addStep({
  text: `
    <video autoplay loop muted playsinline>
      <source src="/assets/isbn-scanner-demo.webm" type="video/webm">
    </video>
    <p>Watch how to scan ISBN</p>
  `,
});
```

---

## 📝 Commit Message

```
feat(buku): add interactive tutorial for ISBN Scanner

- Add useIsbnTutorial hook with Shepherd.js
- 7-step guided tour with modal overlay
- Auto-trigger for first-time users
- Replay button in BukuList
- Custom CSS styling with animations
- LocalStorage persistence for completion status
- Add ScreenToGif recording guide

Closes #XX
```

---

## 📚 References

- **Shepherd.js Docs**: https://shepherdjs.dev/
- **ScreenToGif**: https://www.screentogif.com/
- **User Onboarding Best Practices**: https://www.appcues.com/blog/user-onboarding-best-practices

---

## ✅ Checklist

- [x] Install Shepherd.js
- [x] Create useIsbnTutorial hook
- [x] Add custom CSS styling
- [x] Integrate to BukuList
- [x] Add first-time trigger
- [x] Add replay button
- [x] Add data-tour attributes
- [x] Create ScreenToGif guide
- [x] Update documentation
- [ ] Manual testing (pending)
- [ ] Record GIF demos (pending)
- [ ] Create PR (pending)

---

**Status**: ✅ Implementation complete, ready for testing & PR.
