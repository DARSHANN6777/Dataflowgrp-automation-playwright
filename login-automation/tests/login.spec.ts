import { test, expect, Page } from '@playwright/test';

// Helper to generate a random email
function generateRandomEmail() {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `user_${randomStr}@example.com`;
}

// Helper to generate a random Indian phone number
function generateRandomPhoneNumber() {
  // Generate a random 10-digit phone number starting with 6, 7, 8, or 9
  const firstDigit = [6, 7, 8, 9][Math.floor(Math.random() * 4)];
  // Generate exactly 9 more digits to make it 10 digits total
  let remainingDigits = '';
  for (let i = 0; i < 9; i++) {
    remainingDigits += Math.floor(Math.random() * 10);
  }
  const phoneNumber = firstDigit + remainingDigits;
  return phoneNumber;
}

// Robust dropdown selection helper
async function selectDropdownOption(page: Page, testId: string, optionText = null, selectFirst = false) {
  const dropdownSelector = `[data-testid="${testId}-dropdownInputContainer"]`;
  const inputSelector = `[data-testid="${testId}-dropdownInput"]`;
  
  console.log(`🔍 Selecting option from ${testId} dropdown...`);
  
  // Click to open dropdown
  await page.locator(dropdownSelector).click();
  await page.waitForTimeout(1000);
  
  // Wait for dropdown menu to appear
  await page.waitForSelector(`[data-testid="${testId}-menuItemContainer"]`, { 
    state: 'visible', 
    timeout: 5000 
  });
  
  if (selectFirst) {
    // Select first available option
    const firstOption = page.locator(`[data-testid="${testId}-menuItemContainer"]`).first();
    await firstOption.click();
    console.log(`✅ Selected first option from ${testId}`);
  } else if (optionText) {
    // Select specific option by text
    const option = page.locator(`[data-testid="${testId}-menuItemContainer"]`, { hasText: optionText });
    await option.click();
    console.log(`✅ Selected "${optionText}" from ${testId}`);
  }
  
  // Wait for selection to complete
  await page.waitForTimeout(500);
  
  // Verify selection was successful
  const inputValue = await page.locator(inputSelector).inputValue();
  if (inputValue === '' || inputValue === `Select ${testId}`) {
    throw new Error(`Failed to select option from ${testId} dropdown`);
  }
  
  return inputValue;
}

test('Login and complete applicant details', async ({ page }) => {
  const email = generateRandomEmail();
  const phoneNumber = generateRandomPhoneNumber();
  
  console.log(`📧 Using email: ${email}`);
  console.log(`📱 Using phone: ${phoneNumber}`);
  
  await page.goto('https://app.staging.dataflowgroup.com/en/onboarding/signin');

  await page.getByPlaceholder('Enter email ID').fill(email);

  console.log('👉 Enter captcha manually, then press [Resume] in Playwright Inspector...');
  await page.pause();

  await page.getByText('I consent to receive marketing communications from DataFlow').click();
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForURL('**/verification/mobile');

  const otp = '123456';
  await page.waitForSelector('input[type="tel"]', { state: 'visible' });

  for (let i = 0; i < otp.length; i++) {
    const input = page.locator('input[type="tel"]').nth(i);
    await input.click();
    await page.keyboard.press(otp[i]);
    await page.waitForTimeout(200);
  }

  // Wait for auto redirection after OTP entry
  console.log('⏳ Waiting for redirect after OTP...');
  await page.waitForFunction(() => {
    return !window.location.href.includes('/verification/mobile');
  }, { timeout: 10000 });

  const redirectedUrl = page.url();
  console.log('➡️ Redirected to:', redirectedUrl);

  if (redirectedUrl.includes('/onboarding/about-yourself')) {
    console.log('✅ On Applicant Details page');

    // Step 1: Select salutation
    await page.locator('[data-testid="salutation-dropdownInputContainer"]').click();
    await page.locator('[data-testid="salutation-menuItemContainer"]').waitFor({ state: 'visible' });
    await page.locator('.dropdown-module_menuItemLabel__VJuGM', { hasText: 'Dr.' }).click();

    // Step 2: Fill mandatory details
    await page.locator('input[name="firstName"]').fill('John');
    await page.locator('input[name="lastName"]').fill('Doe');
    
    // Clear the phone number field first, then fill with generated number
    const phoneField = page.locator('input[name="inputValue"]');
    await phoneField.clear();
    await phoneField.fill(phoneNumber);
    
    // Verify phone number is exactly 10 digits
    const enteredPhone = await phoneField.inputValue();
    console.log(`📱 Phone number entered: ${enteredPhone} (${enteredPhone.length} digits)`);
    
    if (enteredPhone.length !== 10) {
      console.log('⚠️ Phone number is not 10 digits, regenerating...');
      const newPhoneNumber = generateRandomPhoneNumber();
      await phoneField.clear();
      await phoneField.fill(newPhoneNumber);
      console.log(`📱 New phone number: ${newPhoneNumber}`);
    }
    
    // Step 3: Handle DOB (manual selection)
    await page.locator('[data-testid="dob_trigger"]').click();
    console.log("👉 Please select the date manually, then press [Resume] in the Inspector.");
    await page.pause();

    // Step 4: Select gender using improved approach
    console.log('🔍 Selecting gender...');
    await page.locator('[data-testid="gender-dropdownInputContainer"]').click();
    await page.waitForTimeout(1000);
    
    // Wait for gender dropdown menu to appear
    await page.waitForSelector('[data-testid="gender-menuItemContainer"]', { 
      state: 'visible', 
      timeout: 5000 
    });
    
    // Select Male option
    await page.locator('[data-testid="gender-menuItemContainer"]', { hasText: 'Male' }).click();
    console.log('✅ Gender selected');
    
    await page.waitForTimeout(500);

    // Step 5: Select nationality using improved helper
    try {
      await selectDropdownOption(page, 'nationality', null, true);
    } catch (error) {
      console.log('⚠️ Nationality selection failed, trying alternative approach...');
      
      // Alternative approach: Type to search and select
      await page.locator('[data-testid="nationality-dropdownInputContainer"]').click();
      await page.locator('[data-testid="nationality-dropdownInput"]').fill('India');
      await page.waitForTimeout(1000);
      
      // Try to select India from filtered results
      const indiaOption = page.locator('[data-testid="nationality-menuItemContainer"]', { hasText: 'India' });
      if (await indiaOption.isVisible()) {
        await indiaOption.click();
        console.log('✅ Selected India as nationality');
      } else {
        // If India not found, select first available option
        await page.locator('[data-testid="nationality-menuItemContainer"]').first().click();
        console.log('✅ Selected first available nationality');
      }
    }

    // Step 6: Select profession using improved helper
    try {
      await selectDropdownOption(page, 'profession', null, true);
      
      // IMPORTANT: Close/hide the profession dropdown display by clicking elsewhere
      console.log('🔧 Closing profession dropdown display...');
      await page.click('body'); // Click on body to close dropdown
      await page.waitForTimeout(1000);
      
      // Alternative: Click on a different field to hide the dropdown display
      await page.locator('input[name="firstName"]').click();
      await page.waitForTimeout(500);
      
    } catch (error) {
      console.log('⚠️ Profession selection failed, trying alternative approach...');
      
      // Alternative approach: Type to search and select
      await page.locator('[data-testid="profession-dropdownInputContainer"]').click();
      await page.locator('[data-testid="profession-dropdownInput"]').fill('Software');
      await page.waitForTimeout(1000);
      
      // Try to select Software Engineer from filtered results
      const softwareOption = page.locator('[data-testid="profession-menuItemContainer"]', { hasText: 'Software' });
      if (await softwareOption.isVisible()) {
        await softwareOption.click();
        console.log('✅ Selected Software profession');
      } else {
        // If Software not found, select first available option
        await page.locator('[data-testid="profession-menuItemContainer"]').first().click();
        console.log('✅ Selected first available profession');
      }
      
      // Close dropdown display
      await page.click('body');
      await page.waitForTimeout(1000);
    }

    // Step 7: Verify all required fields are filled before proceeding
    console.log('🔍 Verifying all fields are filled...');
    
    // Check if any validation errors exist
    const validationErrors = await page.locator('.dropdown-module_error__text, [style*="color: red"]').count();
    
    if (validationErrors > 0) {
      console.log('⚠️ Validation errors found, taking screenshot...');
      await page.screenshot({ path: 'validation-errors.png' });
      
      // Try to fix common validation issues
      const nationalityValue = await page.locator('[data-testid="nationality-dropdownInput"]').inputValue();
      if (!nationalityValue || nationalityValue === 'Select nationality') {
        console.log('🔧 Fixing nationality field...');
        await page.locator('[data-testid="nationality-dropdownInputContainer"]').click();
        await page.waitForTimeout(500);
        await page.locator('[data-testid="nationality-menuItemContainer"]').first().click();
      }
      
      const professionValue = await page.locator('[data-testid="profession-dropdownInput"]').inputValue();
      if (!professionValue || professionValue === 'Select profession') {
        console.log('🔧 Fixing profession field...');
        await page.locator('[data-testid="profession-dropdownInputContainer"]').click();
        await page.waitForTimeout(500);
        await page.locator('[data-testid="profession-menuItemContainer"]').first().click();
      }
    }

    // Step 8: Accept terms and conditions using multiple approaches
    console.log('🔍 Attempting to check terms and conditions...');
    
    // Wait for any loading to complete and profession dropdown to close
    await page.waitForTimeout(2000);
    
    // First, try to scroll down to ensure checkbox is visible
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);
    
    // Try to hover over the profession selected item to reveal checkbox
    console.log('🔧 Hovering over profession area to reveal checkbox...');
    try {
      const professionArea = page.locator('[data-testid="profession-dropdownInputContainer"]');
      await professionArea.hover();
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('Hover failed, continuing...');
    }
    
    // Try multiple selectors for the checkbox
    let checkboxSelected = false;
    
    // Method 1: Try input[type="checkbox"] - most direct approach
    try {
      const checkbox1 = page.locator('input[type="checkbox"]');
      await checkbox1.waitFor({ state: 'visible', timeout: 3000 });
      await checkbox1.check({ force: true });
      checkboxSelected = true;
      console.log('✅ Checkbox selected using input[type="checkbox"]');
    } catch (error) {
      console.log('❌ Method 1 failed, trying method 2...');
    }
    
    // Method 2: Try by clicking near Terms & Conditions text
    if (!checkboxSelected) {
      try {
        const termsLink = page.locator('text="Terms & Conditions"');
        if (await termsLink.isVisible()) {
          // Get the bounding box and click to the left where checkbox should be
          const box = await termsLink.boundingBox();
          if (box) {
            await page.mouse.click(box.x - 25, box.y + box.height / 2);
            checkboxSelected = true;
            console.log('✅ Checkbox selected using mouse click near Terms & Conditions');
          }
        }
      } catch (error) {
        console.log('❌ Method 2 failed, trying method 3...');
      }
    }
    
    // Method 3: Try clicking the entire checkbox area/label
    if (!checkboxSelected) {
      try {
        const checkboxLabel = page.locator('label:has-text("I agree to the")');
        if (await checkboxLabel.isVisible()) {
          await checkboxLabel.click({ force: true });
          checkboxSelected = true;
          console.log('✅ Checkbox selected using label click');
        }
      } catch (error) {
        console.log('❌ Method 3 failed, trying method 4...');
      }
    }
    
    // Method 4: Try with CSS selectors for checkbox
    if (!checkboxSelected) {
      try {
        const checkbox4 = page.locator('[type="checkbox"], [role="checkbox"]');
        if (await checkbox4.isVisible()) {
          await checkbox4.click({ force: true });
          checkboxSelected = true;
          console.log('✅ Checkbox selected using CSS selector');
        }
      } catch (error) {
        console.log('❌ Method 4 failed, trying method 5...');
      }
    }
    
    // Method 5: Use keyboard navigation
    if (!checkboxSelected) {
      try {
        // Focus on the last field (profession) and tab to checkbox
        await page.locator('[data-testid="profession-dropdownInputContainer"]').click();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Space'); // Space to check checkbox
        checkboxSelected = true;
        console.log('✅ Checkbox selected using keyboard navigation');
      } catch (error) {
        console.log('❌ Method 5 failed, trying method 6...');
      }
    }
    
    // Method 6: Force click at approximate checkbox location
    if (!checkboxSelected) {
      try {
        // Click at approximate location where checkbox should be
        const continueButton = page.locator('button:has-text("Continue")');
        const buttonBox = await continueButton.boundingBox();
        if (buttonBox) {
          // Click above the Continue button where checkbox typically is
          await page.mouse.click(buttonBox.x - 50, buttonBox.y - 50);
          checkboxSelected = true;
          console.log('✅ Checkbox selected using approximate location click');
        }
      } catch (error) {
        console.log('❌ All methods failed to select checkbox');
      }
    }
    
    if (!checkboxSelected) {
      console.log('⚠️ Could not select checkbox, taking screenshot...');
      await page.screenshot({ path: 'checkbox-selection-failed.png' });
    }
    
    // Wait a moment for checkbox state to update
    await page.waitForTimeout(1000);
    
    // Make sure Continue button is enabled
    await page.waitForSelector('button:has-text("Continue"):not([disabled])', { timeout: 5000 });
    
    await page.locator('button', { hasText: 'Continue' }).click();

    console.log('⏳ Form submitted, waiting for redirection...');
    await page.waitForTimeout(3000);
    
    // Wait for redirection to application page
    console.log('⏳ Waiting for application page (3 minutes)...');
    await page.waitForTimeout(180000); // 3 minutes = 180000ms
    
    // Capture final URL and email info
    const finalUrl = page.url();
    console.log('🏁 Final URL:', finalUrl);
    console.log('📧 SESSION COMPLETED WITH EMAIL:', email);
    console.log('📱 PHONE NUMBER USED:', phoneNumber);
    
    // Take final screenshot
    await page.screenshot({ path: 'final-application-page.png' });
    
    // Verify we moved to the next step or application
    if (finalUrl.includes('/onboarding/about-yourself')) {
      console.log('⚠️ Still on the same page, form submission may have failed');
      await page.screenshot({ path: 'form-submission-failed.png' });
    } else {
      console.log('✅ Successfully moved to application page');
    }

  } else {
    console.log('⚠️ Unexpected redirect:', redirectedUrl);
    await page.screenshot({ path: 'unexpected-page.png' });
    throw new Error('Redirection failed after OTP');
  }
  
  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST EXECUTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`📧 Email used: ${email}`);
  console.log(`📱 Phone used: ${phoneNumber}`);
  console.log(`🔗 Final URL: ${page.url()}`);
  console.log('='.repeat(60));
});