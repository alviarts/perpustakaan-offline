/**
 * Automated Test Script for ISBN Tutorial
 * 
 * This script can be run in browser DevTools Console to test the tutorial flow
 * 
 * Usage:
 * 1. Open app in browser (pnpm tauri:dev)
 * 2. Navigate to /buku page
 * 3. Open DevTools (F12) → Console
 * 4. Copy-paste this entire script
 * 5. Run: testIsbnTutorial()
 */

async function testIsbnTutorial() {
  console.log('🧪 Starting ISBN Tutorial Test...\n');

  const results = {
    passed: [],
    failed: [],
  };

  function pass(test) {
    console.log(`✅ PASS: ${test}`);
    results.passed.push(test);
  }

  function fail(test, reason) {
    console.error(`❌ FAIL: ${test}\n   Reason: ${reason}`);
    results.failed.push({ test, reason });
  }

  // Test 1: Check if tutorial hook is imported
  console.log('\n📋 Test 1: Check tutorial files loaded');
  try {
    const shepherdCSS = Array.from(document.styleSheets).some(sheet => 
      sheet.href && sheet.href.includes('shepherd')
    );
    if (shepherdCSS) {
      pass('Shepherd.js CSS loaded');
    } else {
      fail('Shepherd.js CSS loaded', 'shepherd.css not found in stylesheets');
    }
  } catch (e) {
    fail('Shepherd.js CSS loaded', e.message);
  }

  // Test 2: Check localStorage key
  console.log('\n📋 Test 2: Check localStorage');
  const tutorialCompleted = localStorage.getItem('isbn-tutorial-completed');
  console.log(`   Current value: ${tutorialCompleted}`);
  if (tutorialCompleted === null || tutorialCompleted === 'true') {
    pass('localStorage key exists and valid');
  } else {
    fail('localStorage key exists and valid', `Unexpected value: ${tutorialCompleted}`);
  }

  // Test 3: Check data-tour attribute
  console.log('\n📋 Test 3: Check data-tour attributes');
  const isbnButton = document.querySelector('[data-tour="isbn-import-button"]');
  if (isbnButton) {
    pass('data-tour="isbn-import-button" found');
    console.log('   Button text:', isbnButton.textContent.trim());
  } else {
    fail('data-tour="isbn-import-button" found', 'Element not found in DOM');
  }

  // Test 4: Check Tutorial ISBN button
  console.log('\n📋 Test 4: Check Tutorial ISBN replay button');
  const tutorialButton = Array.from(document.querySelectorAll('button')).find(
    btn => btn.textContent.includes('Tutorial ISBN')
  );
  if (tutorialButton) {
    pass('Tutorial ISBN button found');
    console.log('   Button text:', tutorialButton.textContent.trim());
  } else {
    fail('Tutorial ISBN button found', 'Button not found in DOM');
  }

  // Test 5: Trigger tutorial manually
  console.log('\n📋 Test 5: Trigger tutorial manually');
  console.log('   Clearing localStorage...');
  localStorage.removeItem('isbn-tutorial-completed');
  
  console.log('   Waiting 2 seconds for tutorial to appear...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const shepherdModal = document.querySelector('.shepherd-element');
  if (shepherdModal) {
    pass('Tutorial modal appeared after clearing localStorage');
    
    // Check modal content
    const title = shepherdModal.querySelector('.shepherd-title');
    const text = shepherdModal.querySelector('.shepherd-text');
    
    if (title) {
      console.log('   Modal title:', title.textContent.trim());
      pass('Tutorial modal has title');
    } else {
      fail('Tutorial modal has title', 'Title element not found');
    }
    
    if (text) {
      console.log('   Modal text preview:', text.textContent.trim().substring(0, 50) + '...');
      pass('Tutorial modal has text content');
    } else {
      fail('Tutorial modal has text content', 'Text element not found');
    }
    
    // Check buttons
    const buttons = shepherdModal.querySelectorAll('.shepherd-button');
    if (buttons.length > 0) {
      pass(`Tutorial modal has ${buttons.length} button(s)`);
      buttons.forEach((btn, i) => {
        console.log(`   Button ${i + 1}:`, btn.textContent.trim());
      });
    } else {
      fail('Tutorial modal has buttons', 'No buttons found');
    }
    
  } else {
    fail('Tutorial modal appeared after clearing localStorage', 'Modal not found in DOM');
  }

  // Test 6: Check if tutorial can be closed
  console.log('\n📋 Test 6: Check close functionality');
  const closeButton = document.querySelector('.shepherd-cancel-icon');
  if (closeButton) {
    pass('Tutorial close button found');
  } else {
    fail('Tutorial close button found', 'Close icon not found');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📈 Success Rate: ${((results.passed.length / (results.passed.length + results.failed.length)) * 100).toFixed(1)}%`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(({ test, reason }) => {
      console.log(`   - ${test}`);
      console.log(`     ${reason}`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  return {
    passed: results.passed.length,
    failed: results.failed.length,
    details: results,
  };
}

// Helper: Clear tutorial and reload
function resetTutorial() {
  console.log('🔄 Resetting tutorial...');
  localStorage.removeItem('isbn-tutorial-completed');
  console.log('✅ localStorage cleared');
  console.log('🔄 Reloading page in 1 second...');
  setTimeout(() => location.reload(), 1000);
}

// Helper: Force show tutorial
function showTutorial() {
  console.log('🎬 Forcing tutorial to show...');
  localStorage.removeItem('isbn-tutorial-completed');
  console.log('✅ localStorage cleared');
  console.log('🔄 Please refresh the page (F5) to see tutorial');
}

// Helper: Check tutorial status
function checkTutorialStatus() {
  const completed = localStorage.getItem('isbn-tutorial-completed');
  console.log('📊 Tutorial Status:');
  console.log(`   Completed: ${completed === 'true' ? 'Yes' : 'No'}`);
  console.log(`   localStorage value: ${completed}`);
  
  const shepherdModal = document.querySelector('.shepherd-element');
  console.log(`   Modal visible: ${shepherdModal ? 'Yes' : 'No'}`);
  
  const isbnButton = document.querySelector('[data-tour="isbn-import-button"]');
  console.log(`   Target button exists: ${isbnButton ? 'Yes' : 'No'}`);
  
  return {
    completed: completed === 'true',
    modalVisible: !!shepherdModal,
    targetExists: !!isbnButton,
  };
}

console.log('✅ ISBN Tutorial Test Script Loaded!');
console.log('\n📚 Available Commands:');
console.log('   testIsbnTutorial()     - Run full test suite');
console.log('   resetTutorial()        - Clear localStorage and reload');
console.log('   showTutorial()         - Force show tutorial (requires refresh)');
console.log('   checkTutorialStatus()  - Check current tutorial state');
console.log('\n💡 Quick Start: Run testIsbnTutorial()');
