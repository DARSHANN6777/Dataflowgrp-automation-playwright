import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Cookie management helpers
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

async function saveCookies(page: any, email: string) {
  const cookies = await page.context().cookies();
  const cookieData = {
    email,
    cookies,
    timestamp: Date.now()
  };
  
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookieData, null, 2));
  console.log(`🍪 Cookies saved for ${email}`);
}

async function loadCookies(page: any) {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
      
      // Check if cookies are not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - cookieData.timestamp > maxAge) {
        console.log('🍪 Cookies are too old, will need fresh login');
        return null;
      }
      
      await page.context().addCookies(cookieData.cookies);
      console.log(`🍪 Cookies loaded for ${cookieData.email}`);
      return cookieData.email;
    }
  } catch (error) {
    console.log('🍪 Error loading cookies:', error.message);
  }
  return null;
}

// IMPROVED dropdown selection - using actual input element and waiting properly
async function selectDropdownOption(page: any, testId: string, optionText: string) {
  console.log(`🔍 Attempting to select "${optionText}" for ${testId}`);
  
  try {
    console.log(`🔄 Taking screenshot before attempting dropdown selection...`);
    await page.screenshot({ path: `before-${testId}-selection.png` });
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Method 1: Click directly on the input field using data-testid
    console.log(`🔄 Method 1: Clicking dropdown input field using testId...`);
    
    let inputSelector = '';
    if (testId === 'testSpeciality') {
      inputSelector = '[data-testid="testSpeciality-dropdownInput"]';
    } else if (testId === 'testSubSpeciality') {
      // For second dropdown, wait for it to appear and be enabled
      await page.waitForTimeout(3000);
      inputSelector = '[data-testid="testSubSpeciality-dropdownInput"]';
    }
    
    // Wait for the input to be visible and enabled
    await page.waitForSelector(inputSelector, { timeout: 10000 });
    
    // Check if element is actually clickable
    const inputElement = page.locator(inputSelector);
    await expect(inputElement).toBeVisible();
    
    // Click the input field to open dropdown
    await inputElement.click();
    console.log(`✅ Clicked dropdown input field: ${inputSelector}`);
    
    // Wait for dropdown options to appear
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `after-${testId}-click.png` });
    
    // Method 2: Try multiple approaches to select the option
    console.log(`🔄 Looking for option: ${optionText}`);
    
    // Strategy A: Direct text match
    try {
      await page.waitForSelector(`text="${optionText}"`, { timeout: 5000 });
      await page.click(`text="${optionText}"`);
      console.log(`✅ Selected option using direct text: ${optionText}`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `after-${testId}-selection.png` });
      return true;
    } catch (directTextError) {
      console.log(`⚠️ Direct text click failed, trying other methods...`);
    }
    
    // Strategy B: Look for dropdown menu items with various selectors
    const optionSelectors = [
      `[role="option"]:has-text("${optionText}")`,
      `[class*="menuItem"]:has-text("${optionText}")`,
      `[class*="dropdown"]:has-text("${optionText}")`,
      `.dropdown-module_menuItemLabel__VJuGM:has-text("${optionText}")`,
      `li:has-text("${optionText}")`,
      `div[role="listbox"] div:has-text("${optionText}")`,
      `ul li:has-text("${optionText}")`
    ];
    
    let optionClicked = false;
    for (const selector of optionSelectors) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          await element.click();
          console.log(`✅ Successfully clicked option using selector: ${selector}`);
          optionClicked = true;
          break;
        }
      } catch (e) {
        console.log(`⚠️ Selector ${selector} didn't work, trying next...`);
        continue;
      }
    }
    
    // Strategy C: If no selector worked, try keyboard navigation
    if (!optionClicked) {
      console.log(`🔄 Trying keyboard navigation method...`);
      try {
        // Clear the input and type the option
        await inputElement.click();
        await page.keyboard.press('Control+A'); // Select all
        await page.keyboard.type(optionText);
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        console.log(`✅ Selected option using keyboard navigation: ${optionText}`);
        optionClicked = true;
      } catch (keyboardError) {
        console.log(`⚠️ Keyboard navigation failed: ${keyboardError.message}`);
      }
    }
    
    // Strategy D: If still not clicked, use manual intervention
    if (!optionClicked) {
      console.log(`❌ Could not click option automatically. Manual intervention required.`);
      console.log(`👉 The dropdown should be open. Please manually click on "${optionText}" option, then press Resume`);
      await page.pause();
      optionClicked = true; // Assume user clicked it
    }
    
    // Wait for selection to complete and form to update
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `after-${testId}-selection.png` });
    
    console.log(`✅ Dropdown selection completed for ${testId}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Error in dropdown selection: ${error.message}`);
    await page.screenshot({ path: `error-${testId}-selection.png` });
    
    // Show current page state for debugging
    console.log(`🔍 Debug: Current URL: ${page.url()}`);
    
    // Check if dropdown inputs exist
    try {
      const allDropdowns = await page.locator('[data-testid*="-dropdownInput"]').count();
      console.log(`🔍 Debug: Found ${allDropdowns} dropdown inputs on page`);
      
      if (allDropdowns > 0) {
        const testIds = await page.locator('[data-testid*="-dropdownInput"]').all();
        for (let i = 0; i < testIds.length; i++) {
          const testIdValue = await testIds[i].getAttribute('data-testid');
          console.log(`🔍 Debug: Dropdown ${i}: ${testIdValue}`);
        }
      }
    } catch (debugError) {
      console.log(`🔍 Debug logging failed: ${debugError.message}`);
    }
    
    console.log(`🛑 MANUAL INTERVENTION REQUIRED:`);
    console.log(`   Field: ${testId}`);
    console.log(`   Option to select: ${optionText}`);
    console.log(`   Please manually select the option and press Resume`);
    
    await page.pause();
    return true;
  }
}

// Legacy function for backward compatibility - updated to use new approach
async function selectDropdownByTestId(page: any, testId: string, optionText: string) {
  console.log(`🔍 Selecting dropdown option "${optionText}" for testId: ${testId}`);
  return await selectDropdownOption(page, testId, optionText);
}

// Helper function to handle report transfer page
async function handleReportTransferPage(page: any) {
  console.log('📊 Starting report transfer page handling...');
  
  try {
    // Wait for the report transfer page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot of the report transfer page
    await page.screenshot({ path: 'report-transfer-page.png' });
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`📍 Current URL on report transfer page: ${currentUrl}`);
    
    // Check if the report transfer page is visible
    const reportTransferTitle = await page.isVisible('text="Reuse your previous DataFlow report"');
    if (reportTransferTitle) {
      console.log('✅ Report transfer page loaded successfully');
      
      // Log the current selections visible on the page
      const selections = [
        await page.isVisible('text="Bahrain"') ? '🇧🇭 Bahrain' : '',
        await page.isVisible('text="National Health Regulatory Authority"') ? '🏛️ NHRA' : '',
        await page.isVisible('text="Foreign Education Recognition"') ? '🎓 Foreign Education Recognition' : '',
        await page.isVisible('text="Fresh Graduates - Bahraini Nationals"') ? '👨‍🎓 Fresh Graduates - Bahraini Nationals' : ''
      ].filter(Boolean);
      
      console.log('✅ Confirmed selections:', selections.join(', '));
    } else {
      console.log('⚠️ Report transfer page may not be fully loaded');
    }
    
    // Check if there are existing reports shown
    const hasExistingReports = await page.isVisible('text="Already have an existing Dataflow report?"');
    if (hasExistingReports) {
      console.log('ℹ️ Page shows option to find existing reports');
    }
    
    // Check if the "Find Your Report" button is visible (optional action)
    const findReportButton = await page.isVisible('button:has-text("Find Your Report")');
    if (findReportButton) {
      console.log('ℹ️ "Find Your Report" button is available but we will proceed with Continue');
    }
    
    // Step 1: Look for and click the Continue button
    console.log('🔍 Looking for and clicking the Continue button...');
    
    try {
      // Wait for Continue button to be visible and enabled
      await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
      
      const continueButton = page.locator('button:has-text("Continue")');
      const isEnabled = await continueButton.isEnabled();
      const isVisible = await continueButton.isVisible();
      
      console.log(`🔍 Continue button - visible: ${isVisible}, enabled: ${isEnabled}`);
      
      if (isVisible && isEnabled) {
        // Take screenshot before clicking
        await page.screenshot({ path: 'before-continue-click-report-transfer.png' });
        
        await continueButton.click();
        console.log('✅ Successfully clicked Continue button on report transfer page');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`📍 After Continue click URL: ${newUrl}`);
        await page.screenshot({ path: 'after-continue-click-report-transfer.png' });
        
        // Verify that we've moved to the next step
        if (newUrl !== currentUrl) {
          console.log('✅ Successfully navigated to next page after clicking Continue');
          
          // Check what type of page we landed on
          const hasUploadSection = await page.isVisible('text="Upload", text="Choose File", text="Browse", input[type="file"]');
          const hasPersonalInfo = await page.isVisible('text="Personal Information", text="Name", text="Date of Birth"');
          const hasApplicationForm = await page.isVisible('text="Application Form", text="Submit", text="Review"');
          
          if (hasUploadSection) {
            console.log('📁 Detected file upload section - moved to document upload page');
          } else if (hasPersonalInfo) {
            console.log('👤 Detected personal information section - moved to profile/details page');
          } else if (hasApplicationForm) {
            console.log('📋 Detected application form - moved to final application page');
          } else {
            console.log('📄 Moved to next page (type not immediately identified)');
          }
          
        } else {
          console.log('⚠️ URL didn\'t change - checking for other indicators of progress...');
          
          // Check if page content changed
          await page.waitForTimeout(2000);
          const pageChanged = !(await page.isVisible('text="Reuse your previous DataFlow report"'));
          if (pageChanged) {
            console.log('✅ Page content changed - navigation likely successful');
          }
        }
        
      } else {
        console.log('⚠️ Continue button is not visible or enabled');
        console.log('👉 Please manually verify the page state and click Continue if available, then press Resume');
        await page.pause();
      }
      
    } catch (continueError) {
      console.log('❌ Could not find or click Continue button:', continueError.message);
      await page.screenshot({ path: 'continue-button-error-report-transfer.png' });
      
      // Try alternative button selectors for this page
      const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Next")',
        'button:has-text("Proceed")',
        'button:has-text("Submit")',
        '.btn-primary',
        '.continue-btn',
        '[data-testid*="continue"]',
        '[data-testid*="next"]'
      ];
      
      let buttonClicked = false;
      for (const buttonSelector of buttonSelectors) {
        try {
          console.log(`🔄 Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`✅ Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('👉 Could not find Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
    console.log('🎉 Report transfer page handling completed successfully!');
    
  } catch (reportTransferError) {
    console.log('❌ Error during report transfer page handling:', reportTransferError.message);
    await page.screenshot({ path: 'report-transfer-error.png' });
    
    // Enhanced debug information
    console.log('🔍 Debug: Current page state...');
    console.log(`🔍 Debug: Current URL: ${page.url()}`);
    console.log(`🔍 Debug: Page title: ${await page.title()}`);
    
    // Log available buttons for debugging
    try {
      const allButtons = await page.locator('button').allTextContents();
      console.log('🔍 Debug: Available buttons:', allButtons);
      
      const allLinks = await page.locator('a').allTextContents();
      console.log('🔍 Debug: Available links:', allLinks.slice(0, 10)); // Limit to first 10 to avoid spam
      
      // Check for specific elements on this page
      const hasReportTitle = await page.isVisible('text="Reuse your previous DataFlow report"');
      const hasContinueBtn = await page.isVisible('button:has-text("Continue")');
      const hasFindBtn = await page.isVisible('button:has-text("Find Your Report")');
      
      console.log(`🔍 Debug: Report title visible: ${hasReportTitle}`);
      console.log(`🔍 Debug: Continue button visible: ${hasContinueBtn}`);
      console.log(`🔍 Debug: Find Report button visible: ${hasFindBtn}`);
      
    } catch (debugError) {
      console.log('🔍 Debug logging failed:', debugError.message);
    }
    
    throw reportTransferError;
  }
}

// Helper function to handle document requirements page
async function handleDocumentRequirements(page: any) {
  console.log('📄 Starting document requirements page handling...');
  
  try {
    // Wait for the documents page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot of the document requirements page
    await page.screenshot({ path: 'document-requirements-page.png' });
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`📍 Current URL on documents page: ${currentUrl}`);
    
    // Check if the mandatory documents section is visible
    const mandatorySection = await page.isVisible('text="Mandatory Document(s) Required"');
    if (mandatorySection) {
      console.log('✅ Document requirements page loaded successfully');
    } else {
      console.log('⚠️ Document requirements page may not be fully loaded');
    }
    
    // Step 1: Find and check the mandatory acknowledgment checkbox
    console.log('🔍 Looking for the mandatory documents acknowledgment checkbox...');
    
    let checkboxClicked = false;
    
    // Try multiple methods to find and click the checkbox
    const checkboxSelectors = [
      'input[type="checkbox"]',
      '[type="checkbox"]',
      'input:has-text("I understand that these document(s) are mandatory")',
      'label:has-text("I understand that these document(s) are mandatory") input',
      '.checkbox input',
      '[data-testid*="checkbox"]',
      '[role="checkbox"]'
    ];
    
    for (const selector of checkboxSelectors) {
      try {
        console.log(`🔄 Trying checkbox selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        
        const checkbox = page.locator(selector);
        if (await checkbox.isVisible()) {
          // Check if it's already checked
          const isChecked = await checkbox.isChecked();
          console.log(`🔍 Checkbox checked status: ${isChecked}`);
          
          if (!isChecked) {
            await checkbox.check();
            console.log('✅ Successfully checked the mandatory documents checkbox');
            checkboxClicked = true;
            break;
          } else {
            console.log('✅ Checkbox was already checked');
            checkboxClicked = true;
            break;
          }
        }
      } catch (selectorError) {
        console.log(`⚠️ Selector ${selector} didn't work, trying next...`);
        continue;
      }
    }
    
    // Alternative approach: Click on the label text containing the checkbox
    if (!checkboxClicked) {
      try {
        console.log('🔄 Trying to click the label text to activate checkbox...');
        const labelText = 'I understand that these document(s) are mandatory for my verification application';
        await page.click(`text="${labelText}"`);
        console.log('✅ Clicked checkbox via label text');
        checkboxClicked = true;
      } catch (labelError) {
        console.log('⚠️ Label text click method failed');
      }
    }
    
    // If still not clicked, try clicking near the checkbox icon
    if (!checkboxClicked) {
      try {
        console.log('🔄 Trying to click checkbox icon/area...');
        // Look for elements that might contain the checkbox visually
        await page.click('.checkbox, [class*="check"], [class*="tick"], span:near(:text("I understand"))');
        console.log('✅ Clicked checkbox via icon/area method');
        checkboxClicked = true;
      } catch (iconError) {
        console.log('⚠️ Checkbox icon click method failed');
      }
    }
    
    // Manual intervention if automatic methods fail
    if (!checkboxClicked) {
      console.log('❌ Could not automatically check the mandatory documents checkbox');
      console.log('👉 Please manually check the checkbox that says "I understand that these document(s) are mandatory..." then press Resume');
      await page.pause();
      checkboxClicked = true; // Assume user checked it
    }
    
    // Wait a moment for any UI updates after checkbox interaction
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'after-checkbox-checked.png' });
    
    // Step 2: Click the Proceed button
    console.log('🔍 Looking for and clicking the Proceed button...');
    
    try {
      // Wait for Proceed button to be visible and enabled
      await page.waitForSelector('button:has-text("Proceed")', { timeout: 10000 });
      
      const proceedButton = page.locator('button:has-text("Proceed")');
      const isEnabled = await proceedButton.isEnabled();
      console.log(`🔍 Proceed button enabled status: ${isEnabled}`);
      
      if (isEnabled) {
        await proceedButton.click();
        console.log('✅ Successfully clicked Proceed button');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`📍 After Proceed click URL: ${newUrl}`);
        await page.screenshot({ path: 'after-proceed-click.png' });
        
        // Verify that we've moved to the next step
        if (newUrl !== currentUrl) {
          console.log('✅ Successfully navigated to next page after clicking Proceed');
        } else {
          console.log('⚠️ URL didn\'t change - checking for other indicators of progress...');
          
          // Check if page content changed indicating progress
          const hasUploadSection = await page.isVisible('text="Upload", text="Choose File", text="Browse", input[type="file"]');
          if (hasUploadSection) {
            console.log('✅ Detected file upload section - likely moved to document upload page');
          }
        }
        
      } else {
        console.log('⚠️ Proceed button is not enabled - checkbox may not be properly checked');
        console.log('👉 Please manually verify checkbox is checked and click Proceed, then press Resume');
        await page.pause();
      }
      
    } catch (proceedError) {
      console.log('❌ Could not find or click Proceed button:', proceedError.message);
      await page.screenshot({ path: 'proceed-button-error.png' });
      
      // Try alternative button selectors
      const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("Submit")',
        '.btn-primary',
        '.proceed-btn'
      ];
      
      let buttonClicked = false;
      for (const buttonSelector of buttonSelectors) {
        try {
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`✅ Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('👉 Could not find Proceed button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
    console.log('🎉 Document requirements page handling completed successfully!');
    
  } catch (docError) {
    console.log('❌ Error during document requirements handling:', docError.message);
    await page.screenshot({ path: 'document-requirements-error.png' });
    
    // Enhanced debug information
    console.log('🔍 Debug: Current page state...');
    console.log(`🔍 Debug: Current URL: ${page.url()}`);
    console.log(`🔍 Debug: Page title: ${await page.title()}`);
    
    // Log available buttons for debugging
    try {
      const allButtons = await page.locator('button').allTextContents();
      console.log('🔍 Debug: Available buttons:', allButtons);
      
      const allInputs = await page.locator('input').count();
      console.log(`🔍 Debug: Found ${allInputs} input elements on page`);
      
      // Check for checkboxes specifically
      const checkboxes = await page.locator('input[type="checkbox"]').count();
      console.log(`🔍 Debug: Found ${checkboxes} checkbox elements on page`);
      
    } catch (debugError) {
      console.log('🔍 Debug logging failed:', debugError.message);
    }
    
    throw docError;
  }
}

test('Create Verification Request', async ({ page }) => {
  console.log('🚀 Starting Verification Request Test');
  
  const specificEmail = 'ndarshan+story47@dataflowgroup.com';
  
  // Try to load saved cookies first
  const savedEmail = await loadCookies(page);
  
  if (savedEmail && savedEmail === specificEmail) {
    console.log(`🍪 Using saved cookies for email: ${savedEmail}`);
    
    // Navigate directly to dashboard with cookies
    console.log('🌐 Loading DataFlow dashboard with saved cookies...');
    await page.goto('https://app.staging.dataflowgroup.com/en/dashboard/home');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check if we're actually logged in - look for elements that indicate successful login
    try {
      // Look for sidebar, user profile, or dashboard-specific elements
      await page.waitForSelector('text="Home", text="Verifications", text="Start New Verification", .sidebar, [class*="sidebar"]', { timeout: 1000 });
      console.log('✅ Dashboard loaded successfully with cookies - user is logged in');
      
      // Take screenshot to verify we're logged in
      await page.screenshot({ path: 'logged-in-with-cookies.png' });
      
      // Skip to verification creation
      await createVerificationRequest(page);
      return; // IMPORTANT: Exit here, don't continue to login flow
      
    } catch (error) {
      console.log('⚠️ Could not verify login state, checking URL...');
      
      // Secondary check - if we're on dashboard URL, assume login worked
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ On dashboard URL, assuming cookies worked');
        await createVerificationRequest(page);
        return; // IMPORTANT: Exit here
      }
      
      console.log('⚠️ Cookies may be invalid, proceeding with fresh login...');
    }
  } else {
    console.log('🔄 No valid cookies found or different email, proceeding with fresh login...');
  }
  
  // Fresh login process
  console.log('🌐 Loading DataFlow login page for fresh authentication...');
  await page.goto('https://app.staging.dataflowgroup.com/en/onboarding/signin');
  
  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
  console.log('✅ Login page loaded successfully');
  
  // Fill the specific email
  await page.getByPlaceholder('Enter email ID').fill(specificEmail);
  console.log(`📧 Email filled: ${specificEmail}`);
  
  // Pause for manual captcha entry
  console.log('👉 Please enter captcha manually, then press [Resume] in Playwright Inspector...');
  await page.pause();
  
  // Continue with login flow
  await page.getByText('I consent to receive marketing communications from DataFlow').click();
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForURL('**/verification/mobile');
  console.log('✅ Redirected to OTP verification page');
  
  // Pause for manual OTP entry
  console.log('👉 Please enter OTP manually, then press [Resume] in Playwright Inspector...');
  await page.pause();
  
  // Wait for redirection to dashboard/home
  console.log('⏳ Waiting for redirect to dashboard...');
  await page.waitForFunction(() => {
    return window.location.href.includes('/dashboard') || window.location.href.includes('/home');
  }, { timeout: 5000 });
  
  const currentUrl = page.url();
  console.log('➡️ Redirected to:', currentUrl);
  
  // Save cookies after successful login
  await saveCookies(page, specificEmail);
  console.log('✅ Login completed and cookies saved!');
  
  // Verify we're on the dashboard
  await expect(page).toHaveURL(/.*dashboard.*/);
  console.log('🔐 Authentication verified - we are logged in');
  
  // Proceed to create verification request
  await createVerificationRequest(page);
});

// Helper function to wait for manual confirmation that loaders are done
async function waitForManualConfirmation(page: any, message: string) {
  console.log(`👉 ${message}`);
  await page.pause();
  console.log('✅ Manual confirmation received, continuing...');
}

// IMPROVED form filling function with better error handling and retries
async function fillVerificationForm(page: any) {
  console.log('📋 Starting verification form dropdown selections...');
  
  try {
    // Wait for the form to load completely
    await page.waitForTimeout(5000); // Increased wait time
    await page.waitForLoadState('networkidle');
    
    // Take screenshot before form filling
    await page.screenshot({ path: 'before-form-filling.png' });
    
    // Verify we're on the right page
    const currentUrl = page.url();
    console.log(`📍 Current URL before form filling: ${currentUrl}`);
    
    // Check if dropdowns are present
    const firstDropdownExists = await page.locator('[data-testid="testSpeciality-dropdownInput"]').isVisible();
    console.log(`🔍 First dropdown visible: ${firstDropdownExists}`);
    
    if (!firstDropdownExists) {
      console.log('⚠️ First dropdown not found, waiting longer...');
      await page.waitForTimeout(3000);
      await page.waitForSelector('[data-testid="testSpeciality-dropdownInput"]', { timeout: 15000 });
    }
    
    // Step 1: Select "Foreign Education Recognition" in the first dropdown
    console.log('🔍 Step 1: Selecting verification reason - Foreign Education Recognition...');
    await selectDropdownOption(page, 'testSpeciality', 'Foreign Education Recognition');
    
    // Wait for form to update after first selection - increased wait time
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'after-first-dropdown-selection.png' });
    
    // Step 2: Check if second dropdown appeared and is enabled
    console.log('🔍 Step 2: Checking for second dropdown availability...');
    
    // Wait for second dropdown to become available
    let secondDropdownReady = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!secondDropdownReady && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Attempt ${attempts}: Checking second dropdown...`);
      
      try {
        await page.waitForSelector('[data-testid="testSubSpeciality-dropdownInput"]', { timeout: 3000 });
        const secondDropdown = page.locator('[data-testid="testSubSpeciality-dropdownInput"]');
        
        if (await secondDropdown.isVisible() && await secondDropdown.isEnabled()) {
          secondDropdownReady = true;
          console.log('✅ Second dropdown is ready');
        } else {
          console.log('⏳ Second dropdown not ready yet, waiting...');
          await page.waitForTimeout(2000);
        }
      } catch (error) {
        console.log(`⏳ Second dropdown not available yet (attempt ${attempts}), waiting...`);
        await page.waitForTimeout(2000);
      }
    }
    
    if (!secondDropdownReady) {
      console.log('⚠️ Second dropdown did not become available, trying anyway...');
    }
    
    // Step 3: Select "Fresh Graduates - Bahraini Nationals" in the second dropdown
    console.log('🔍 Step 3: Selecting verification type - Fresh Graduates - Bahraini Nationals...');
    await selectDropdownOption(page, 'testSubSpeciality', 'Fresh Graduates - Bahraini Nationals');
    
    // Wait for form to update after second selection
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'after-second-dropdown-selection.png' });
    
    // Step 4: Look for and click Continue button
    console.log('🔍 Step 4: Looking for Continue button...');
    
    try {
      // Wait for Continue button to be enabled
      await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
      
      // Check if button is enabled
      const continueButton = page.locator('button:has-text("Continue")');
      const isEnabled = await continueButton.isEnabled();
      console.log(`🔍 Continue button enabled status: ${isEnabled}`);
      
      if (isEnabled) {
        await continueButton.click();
        console.log('✅ Clicked Continue button');
        
        // Wait for navigation to next page
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'after-continue-click.png' });
      } else {
        console.log('⚠️ Continue button found but not enabled - may need manual verification');
        console.log('👉 Please manually verify selections and click Continue if needed, then press Resume');
        await page.pause();
      }
      
    } catch (continueError) {
      console.log('⚠️ Continue button not found or not clickable');
      console.log('📝 This might be expected behavior - form selections may be complete');
      
      // Check if we've moved to a different page or if form is complete
      const newUrl = page.url();
      if (newUrl !== currentUrl) {
        console.log('✅ Page changed - form submission likely successful');
      } else {
        console.log('👉 Please manually click Continue if visible, then press Resume');
        await page.pause();
      }
    }
    
    console.log('🎉 Verification form dropdown selections completed successfully!');
    
  } catch (formError) {
    console.log('❌ Error during form filling:', formError.message);
    await page.screenshot({ path: 'form-filling-error.png' });
    
    // Enhanced debug information
    console.log('🔍 Debug: Taking screenshot of current state...');
    await page.screenshot({ path: 'debug-current-state.png' });
    
    // Log current URL and page title
    console.log(`🔍 Debug: Current URL: ${page.url()}`);
    console.log(`🔍 Debug: Page title: ${await page.title()}`);
    
    // Log all available dropdowns for debugging
    try {
      const allDropdowns = await page.locator('[data-testid*="-dropdownInputContainer"]').count();
      console.log(`🔍 Debug: Found ${allDropdowns} dropdown containers on page`);
      
      const allInputs = await page.locator('[data-testid*="-dropdownInput"]').count();
      console.log(`🔍 Debug: Found ${allInputs} dropdown inputs on page`);
      
      // Log specific testIds if available
      if (allInputs > 0) {
        const testIds = await page.locator('[data-testid*="-dropdownInput"]').all();
        for (let i = 0; i < testIds.length; i++) {
          const testIdValue = await testIds[i].getAttribute('data-testid');
          const isVisible = await testIds[i].isVisible();
          const isEnabled = await testIds[i].isEnabled();
          console.log(`🔍 Debug: Dropdown ${i}: ${testIdValue}, visible: ${isVisible}, enabled: ${isEnabled}`);
        }
      }
      
    } catch (debugError) {
      console.log('🔍 Debug logging failed:', debugError.message);
    }
    
    throw formError;
  }
}

// Helper function to handle verification request creation
async function createVerificationRequest(page: any) {
  console.log('📋 Starting verification request creation...');
  
  // Manual pause to wait for loaders - you control when to continue
  await waitForManualConfirmation(page, 'Please wait for all loaders to complete on the homepage, then press [Resume] in Playwright Inspector...');
  
  // Take a screenshot to see the dashboard
  await page.screenshot({ path: 'dashboard-before-click.png' });
  
  const currentUrl = page.url();
  console.log(`📍 Current URL: ${currentUrl}`);
  
  // Step 1: Click Start New Verification first (as per requirement)
  console.log('🔍 Looking for Start New Verification in left sidebar...');
  
  try {
    // Method 1: Try clicking the exact text from the sidebar
    console.log('🔄 Trying to click Start New Verification...');
    await page.waitForSelector('text="Start New Verification"', { timeout: 10000 });
    await page.getByText('Start New Verification').click();
    console.log('✅ Clicked Start New Verification from sidebar');
  } catch (error) {
    console.log('🔄 Trying alternative selectors...');
    try {
      // Method 2: Try as a link
      await page.getByRole('link', { name: 'Start New Verification' }).click();
      console.log('✅ Clicked Start New Verification (link method)');
    } catch (error2) {
      console.log('🔄 Trying CSS selectors...');
      try {
        // Method 3: Try CSS selectors
        await page.click('a[href*="verification"], .nav-link:has-text("Start New Verification"), [data-cy="start-verification"]');
        console.log('✅ Clicked Start New Verification (CSS method)');
      } catch (error3) {
        console.log('❌ Could not find Start New Verification button');
        await page.screenshot({ path: 'verification-button-not-found.png' });
        
        // Log all available links for debugging
        const links = await page.locator('a').allTextContents();
        console.log('Available links on page:', links);
        
        throw new Error('Start New Verification button not found');
      }
    }
  }
  
  // Wait for navigation/loading after clicking Start New Verification
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded after clicking Start New Verification');
  
  // Take screenshot after clicking Start New Verification
  await page.screenshot({ path: 'after-start-verification-click.png' });
  
  // Step 2: Now select Bahrain (improved approach)
  console.log('🌍 Looking for Bahrain selection...');
  
  try {
    // Wait for the country selection page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give extra time for elements to render
    
    // Take a screenshot before attempting to click
    await page.screenshot({ path: 'before-bahrain-selection.png' });
    
    // Method 1: Try clicking the entire Bahrain card container
    try {
      console.log('🔄 Attempting to click Bahrain card container...');
      await page.waitForSelector('.gridCards-module_passiveTabContainer__OFKYG:has-text("Bahrain")', { timeout: 10000 });
      await page.click('.gridCards-module_passiveTabContainer__OFKYG:has-text("Bahrain")');
      console.log('✅ Selected Bahrain country (card container method)');
    } catch (error1) {
      console.log('🔄 Card container method failed, trying purpose text...');
      
      // Method 2: Try clicking the purpose text specifically
      try {
        await page.waitForSelector('.gridCards-module_purposeText__sUuM2:has-text("Bahrain")', { timeout: 5000 });
        await page.click('.gridCards-module_purposeText__sUuM2:has-text("Bahrain")');
        console.log('✅ Selected Bahrain country (purpose text method)');
      } catch (error2) {
        console.log('🔄 Purpose text method failed, trying image container...');
        
        // Method 3: Try clicking the image area
        try {
          await page.click('.gridCards-module_passiveTabContainer__OFKYG .gridCards-module_purposeIcon__MVzdp:has-text("Bahrain")');
          console.log('✅ Selected Bahrain country (image container method)');
        } catch (error3) {
          console.log('🔄 Image container method failed, trying direct text click...');
          
          // Method 4: Force click on the text "Bahrain"
          try {
            const bahrainElement = await page.locator('text="Bahrain"').first();
            await bahrainElement.click({ force: true });
            console.log('✅ Selected Bahrain country (forced text click)');
          } catch (error4) {
            console.log('🔄 Forced text click failed, trying coordinate-based click...');
            
            // Method 5: Get the bounding box and click in the center
            try {
              const bahrainCard = await page.locator('.gridCards-module_passiveTabContainer__OFKYG:has-text("Bahrain")');
              const box = await bahrainCard.boundingBox();
              if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                console.log('✅ Selected Bahrain country (coordinate click)');
              } else {
                throw new Error('Could not get bounding box');
              }
            } catch (error5) {
              console.log('❌ All Bahrain selection methods failed');
              await page.screenshot({ path: 'bahrain-selection-all-failed.png' });
              
              // Debug: Log all available country options
              const countryTexts = await page.locator('.gridCards-module_purposeText__sUuM2').allTextContents();
              console.log('Available countries:', countryTexts);
              
              // Debug: Log all clickable elements containing "Bahrain"
              const bahrainElements = await page.locator(':has-text("Bahrain")').count();
              console.log('Number of elements containing "Bahrain":', bahrainElements);
              
              throw new Error('Could not select Bahrain after trying multiple methods');
            }
          }
        }
      }
    }
    
    // Wait for any loading/navigation after country selection
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    const newUrl = page.url();
    console.log(`📍 After Bahrain selection URL: ${newUrl}`);
    await page.screenshot({ path: 'after-bahrain-selection.png' });
    
    // Verify that Bahrain was actually selected (check URL or page content)
    if (newUrl.includes('bahrain') || newUrl.includes('BHR') || await page.isVisible('text="NHRA"')) {
      console.log('✅ Bahrain selection confirmed');
    } else {
      console.log('⚠️ Bahrain selection may not have worked, continuing anyway...');
    }
    
    // Step 3: Now select NHRA (National Health Regulatory Authority)
    console.log('🏛️ Looking for NHRA selection...');
    
    try {
      // Wait for NHRA elements to appear
      await page.waitForTimeout(2000); // Give time for page to load
      await page.waitForLoadState('networkidle');
      
      // Take screenshot before NHRA selection
      await page.screenshot({ path: 'before-nhra-selection.png' });
      
      // Method 1: Try clicking using the specific CSS classes from the DOM
      try {
        console.log('🔄 Attempting to click NHRA using specific CSS classes...');
        await page.waitForSelector('.gridCards-module_purposeText__sUuM2.gridCards-module_large__HFUti:has-text("National Health Regulatory Authority")', { timeout: 10000 });
        await page.click('.gridCards-module_purposeText__sUuM2.gridCards-module_large__HFUti:has-text("National Health Regulatory Authority")');
        console.log('✅ Selected NHRA (CSS classes method)');
      } catch (nhraError1) {
        console.log('🔄 CSS classes method failed, trying container click...');
        
        // Method 2: Try clicking the container that holds NHRA
        try {
          await page.click('.gridCards-module_passiveTabContainer__OFKYG:has-text("National Health Regulatory Authority")');
          console.log('✅ Selected NHRA (container method)');
        } catch (nhraError2) {
          console.log('🔄 Container method failed, trying text-based click...');
          
          // Method 3: Try clicking by text content
          try {
            await page.getByText('National Health Regulatory Authority (NHRA)').click();
            console.log('✅ Selected NHRA (full text method)');
          } catch (nhraError3) {
            console.log('🔄 Full text method failed, trying NHRA abbreviation...');
            
            // Method 4: Try clicking just "NHRA"
            try {
              await page.getByText('NHRA').click();
              console.log('✅ Selected NHRA (abbreviation method)');
            } catch (nhraError4) {
              console.log('🔄 NHRA abbreviation failed, trying force click...');
              
              // Method 5: Force click on NHRA element
              try {
                const nhraElement = await page.locator('text="National Health Regulatory Authority"').first();
                await nhraElement.click({ force: true });
                console.log('✅ Selected NHRA (forced click method)');
              } catch (nhraError5) {
                console.log('❌ All NHRA selection methods failed');
                await page.screenshot({ path: 'nhra-selection-all-failed.png' });
                
                // Debug: Log all available authority options
                const authorityTexts = await page.locator('.gridCards-module_purposeText__sUuM2').allTextContents();
                console.log('Available authorities:', authorityTexts);
                
                // Debug: Log all elements containing "NHRA"
                const nhraElements = await page.locator(':has-text("NHRA")').count();
                console.log('Number of elements containing "NHRA":', nhraElements);
                
                throw new Error('Could not select NHRA after trying multiple methods');
              }
            }
          }
        }
      }
      
      // Wait for any loading/navigation after NHRA selection
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle');
      
      const nhraUrl = page.url();
      console.log(`📍 After NHRA selection URL: ${nhraUrl}`);
      await page.screenshot({ path: 'after-nhra-selection.png' });
      
      // Verify that NHRA was actually selected (check URL or page content)
      if (nhraUrl.includes('nhra') || nhraUrl.includes('authority') || await page.isVisible('text="verification"')) {
        console.log('✅ NHRA selection confirmed');
      } else {
        console.log('⚠️ NHRA selection may not have worked, but continuing...');
      }
      
      console.log('🎯 NHRA selection process completed successfully!');
      
    } catch (nhraError) {
      console.log('⚠️ NHRA selection failed:', nhraError.message);
      await page.screenshot({ path: 'nhra-selection-failed.png' });
      throw nhraError;
    }
    
    // Step 4: Fill the verification form dropdowns using the improved method
    await fillVerificationForm(page);
    
    // Step 5: Handle document requirements page
    await handleDocumentRequirements(page);
    
    // Step 6: Handle report transfer page
    await handleReportTransferPage(page);
     
    // Step 7: Handle verify education page (NEW)
    await handleVerifyEducationPage(page);
    
    console.log('🎯 Complete verification flow (Bahrain → NHRA → Form → Documents → Report Transfer) completed successfully!');
    
  } catch (error) {
    console.log('⚠️ Country/Authority selection failed:', error.message);
    await page.screenshot({ path: 'selection-process-error.png' });
    throw error;
  }
 
  // Function to handle the "Verify your education" page
// Add this function to your script and call it between handleReportTransferPage and handleEducationDetailsPage
async function handleVerifyEducationPage(page: any) {
  console.log('🎓 Starting verify education page handling...');
  
  try {
    // Wait for the verify education page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot of the verify education page
    await page.screenshot({ path: 'verify-education-page.png' });
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`📍 Current URL on verify education page: ${currentUrl}`);
    
    // Check if we're on the verify education page
    const hasVerifyEducationContent = await page.isVisible('text="Verify your education"');
    if (hasVerifyEducationContent) {
      console.log('✅ Verify education page loaded successfully');
      
      // Log the pre-filled values for confirmation
      try {
        const hasHighestLevel = await page.isVisible('text="Bachelors"');
        const hasDegreeTitle = await page.isVisible('input[value="cse"]');
        const hasYear = await page.isVisible('text="2024"');
        
        console.log(`📝 Form pre-filled values detected:`);
        console.log(`   - Highest educational level: ${hasHighestLevel ? 'Bachelors ✅' : 'Not detected ⚠️'}`);
        console.log(`   - Degree title: ${hasDegreeTitle ? 'CSE ✅' : 'Not detected ⚠️'}`);
        console.log(`   - Year of completion: ${hasYear ? '2024 ✅' : 'Not detected ⚠️'}`);
      } catch (detectionError) {
        console.log('📝 Could not detect all pre-filled values, but continuing...');
      }
      
    } else {
      console.log('⚠️ Verify education page may not be fully loaded');
    }
    
    // Step 1: Click the Continue button
    console.log('🔍 Looking for and clicking the Continue button...');
    
    try {
      // Wait for Continue button to be visible and enabled
      await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
      
      const continueButton = page.locator('button:has-text("Continue")');
      const isEnabled = await continueButton.isEnabled();
      const isVisible = await continueButton.isVisible();
      
      console.log(`🔍 Continue button - visible: ${isVisible}, enabled: ${isEnabled}`);
      
      if (isVisible && isEnabled) {
        // Take screenshot before clicking
        await page.screenshot({ path: 'before-continue-click-verify-education.png' });
        
        await continueButton.click();
        console.log('✅ Successfully clicked Continue button on verify education page');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`📍 After Continue click URL: ${newUrl}`);
        await page.screenshot({ path: 'after-continue-click-verify-education.png' });
        
        // Verify that we've moved to the next step
        if (newUrl !== currentUrl) {
          console.log('✅ Successfully navigated to next page after clicking Continue');
          
          // Check what type of page we landed on
          const hasEducationDetails = await page.isVisible('text="University", text="Start Date", text="End Date"');
          const hasPersonalInfo = await page.isVisible('text="Personal Information", text="Name", text="Date of Birth"');
          const hasUploadSection = await page.isVisible('text="Upload", text="Choose File", text="Browse", input[type="file"]');
          
          if (hasEducationDetails) {
            console.log('🎓 Detected education details section - moved to detailed education page');
          } else if (hasPersonalInfo) {
            console.log('👤 Detected personal information section - moved to profile/details page');
          } else if (hasUploadSection) {
            console.log('📁 Detected file upload section - moved to document upload page');
          } else {
            console.log('📄 Moved to next page (type not immediately identified)');
          }
          
        } else {
          console.log('⚠️ URL didn\'t change - checking for other indicators of progress...');
          
          // Check if page content changed
          await page.waitForTimeout(2000);
          const pageChanged = !(await page.isVisible('text="Verify your education"'));
          if (pageChanged) {
            console.log('✅ Page content changed - navigation likely successful');
          }
        }
        
      } else {
        console.log('⚠️ Continue button is not visible or enabled');
        console.log('👉 Please manually verify the form data and click Continue if available, then press Resume');
        await page.pause();
      }
      
    } catch (continueError) {
      console.log('❌ Could not find or click Continue button:', continueError.message);
      await page.screenshot({ path: 'continue-button-error-verify-education.png' });
      
      // Try alternative button selectors
      const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Next")',
        'button:has-text("Proceed")',
        'button:has-text("Submit")',
        '.btn-primary',
        '.continue-btn',
        '[data-testid*="continue"]',
        '[data-testid*="next"]'
      ];
      
      let buttonClicked = false;
      for (const buttonSelector of buttonSelectors) {
        try {
          console.log(`🔄 Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`✅ Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('👉 Could not find Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
    console.log('🎉 Verify education page handling completed successfully!');
    
  } catch (verifyEducationError) {
    console.log('❌ Error during verify education page handling:', verifyEducationError.message);
    await page.screenshot({ path: 'verify-education-error.png' });
    
    // Enhanced debug information
    console.log('🔍 Debug: Current page state...');
    console.log(`🔍 Debug: Current URL: ${page.url()}`);
    console.log(`🔍 Debug: Page title: ${await page.title()}`);
    
    // Log available buttons for debugging
    try {
      const allButtons = await page.locator('button').allTextContents();
      console.log('🔍 Debug: Available buttons:', allButtons);
      
      const allInputs = await page.locator('input').count();
      console.log(`🔍 Debug: Found ${allInputs} input elements on page`);
      
      // Check for form fields
      const hasDropdowns = await page.locator('select').count();
      console.log(`🔍 Debug: Found ${hasDropdowns} dropdown elements on page`);
      
    } catch (debugError) {
      console.log('🔍 Debug logging failed:', debugError.message);
    }
    
    throw verifyEducationError;
  }
}
  

  await handleEducationDetailsPage(page);

  // Simple function to handle education details page
async function handleEducationDetailsPage(page) {
  console.log('🎓 Starting education details page handling...');
  
  try {
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot of the education details page
    await page.screenshot({ path: 'education-details-page.png' });
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`📍 Current URL on education details page: ${currentUrl}`);
    
    // Check if we're on the education details page
    const hasEducationDetailsContent = await page.isVisible('text="Your Education details"');
    if (hasEducationDetailsContent) {
      console.log('✅ Education details page loaded successfully');
    } else {
      console.log('⚠️ Education details page may not be fully loaded');
    }
    
    // Step 1: Check if "dry college" is already selected using multiple methods
    console.log('🔍 Checking if "dry college" is already selected...');
    const dropdownInput = page.locator('[data-testid="organization-dropdownInput"]');
    
    let isDryCollegeSelected = false;
    let currentValue = '';
    
    try {
      // Method 1: Check input value
      currentValue = await dropdownInput.inputValue();
      console.log(`📝 Input value: "${currentValue}"`);
      
      // Method 2: Check displayed text content
      const displayedText = await dropdownInput.textContent();
      console.log(`📝 Text content: "${displayedText}"`);
      
      // Method 3: Check inner text
      const innerText = await dropdownInput.innerText();
      console.log(`📝 Inner text: "${innerText}"`);
      
      // Method 4: Check if there's a visible selected option in the dropdown container
      const dropdownContainer = page.locator('[data-testid="organization-dropdownInputContainer"]');
      const containerText = await dropdownContainer.textContent();
      console.log(`📝 Container text: "${containerText}"`);
      
      // Check all methods for "dry college"
      const valuesToCheck = [currentValue, displayedText, innerText, containerText].filter(val => val);
      isDryCollegeSelected = valuesToCheck.some(val => 
        val.toLowerCase().includes('dry college')
      );
      
      console.log(`🎯 Is "dry college" already selected: ${isDryCollegeSelected}`);
      console.log(`🔍 Values checked: ${JSON.stringify(valuesToCheck)}`);
      
    } catch (error) {
      console.log('⚠️ Error checking current value, will proceed with selection:', error.message);
      isDryCollegeSelected = false;
    }
    
    if (isDryCollegeSelected) {
      console.log('✅ "dry college" is already selected, skipping university selection');
    } else {
      // Step 1: Handle University selection (click dropdown, clear, type, select second option)
      console.log('🏫 Handling university selection...');
      try {
        // Target the dropdown container using data-testid
        const dropdownContainer = page.locator('[data-testid="organization-dropdownInputContainer"]');
        
        console.log('🔄 Clicking university dropdown container...');
        // Click the dropdown container to open it
        await dropdownContainer.click();
        await page.waitForTimeout(1000);
        
        console.log('🧹 Clearing existing university and typing "dry college"...');
        // Clear the hidden input field and type new value
        await dropdownInput.fill('');
        await page.waitForTimeout(500);
        await dropdownInput.type('dry college', { delay: 100 });
        await page.waitForTimeout(2000); // Wait for dropdown options to appear
        
        console.log('🔍 Looking for dropdown options...');
        // Wait for dropdown options to appear
        await page.waitForTimeout(1500);
        
        // First try to find the specific second option we want: "dry college, bengaluru, india"
        const specificOption = page.locator('text="dry college, bengaluru, india"').first();
        const specificOptionExists = await specificOption.isVisible();
        
        console.log(`🔍 Looking for specific option "dry college, bengaluru, india": ${specificOptionExists}`);
        
        if (specificOptionExists) {
          await specificOption.click();
          console.log('✅ Successfully clicked "dry college, bengaluru, india" option');
        } else {
          console.log('🔍 Specific option not found, trying alternative approaches...');
          
          // Try to find all dropdown options containing "dry college"
          const allDryCollegeOptions = page.locator('*:has-text("dry college")');
          const optionCount = await allDryCollegeOptions.count();
          console.log(`📋 Found ${optionCount} options containing "dry college"`);
          
          // Log all options for debugging
          for (let i = 0; i < Math.min(optionCount, 5); i++) {
            try {
              const optionText = await allDryCollegeOptions.nth(i).textContent();
              console.log(`🔍 Option ${i}: "${optionText}"`);
            } catch (e) {
              console.log(`🔍 Option ${i}: Could not read text`);
            }
          }
          
          if (optionCount >= 2) {
            // Click the second option (index 1)
            await allDryCollegeOptions.nth(1).click();
            console.log('✅ Clicked second option from "dry college" results');
          } else {
            console.log('⚠️ Not enough options found, trying keyboard selection...');
            // Use arrow keys to select second option
            await page.keyboard.press('ArrowDown'); // Move to first option
            await page.keyboard.press('ArrowDown'); // Move to second option  
            await page.keyboard.press('Enter');     // Select second option
            console.log('✅ Used keyboard to select second option');
          }
        }
        
        await page.waitForTimeout(1000);
        console.log('✅ University selection completed');
        
      } catch (error) {
        console.log('❌ Error in university selection:', error);
        throw error;
      }
    }
    
    // Continue with the rest of the function (date handling, etc.)
    console.log('🎯 University selection phase completed, proceeding to continue...');
    
    // Click Continue button
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible()) {
      await continueButton.click();
      console.log('✅ Clicked Continue button');
    } else {
      console.log('⚠️ Continue button not found');
    }
    
  } catch (error) {
    console.log('❌ Error in handleEducationDetailsPage:', error);
    throw error;
  }
}

// Handle pricing estimate page
await handlePricingEstimatePage(page);

async function handlePricingEstimatePage(page) {
  console.log('💰 Handling pricing estimate page...');
  
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Continue")');
  await page.waitForLoadState('networkidle');
  
  console.log('✅ Pricing estimate completed');
}

//CRL document page
await handleClientRequirementsPage(page);

async function handleClientRequirementsPage(page, options = {}) {
  console.log('📋 Handling client requirements page...');
  
  const { automate = false, uploadBothDocuments = false } = options;
  
  await page.waitForLoadState('networkidle');
  
  // Create dummy PDF file for testing
  const fs = require('fs');
  const dummyContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n196\n%%EOF';
  fs.writeFileSync('dummy-document.pdf', dummyContent);
  console.log('📄 Created dummy PDF file for upload');
  
  // Tick first two checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  console.log('✅ Checkboxes ticked');
  
  // Clear and fill company name field
  const companyField = page.locator('input').nth(2);
  await companyField.clear();
  await companyField.fill('automation company');
  console.log('✅ Company name filled');
  
  // Handle date field
  if (automate) {
    try {
      await page.click('button:has-text("Select date")');
      await page.waitForTimeout(1000);
      await page.click('text="28"');
      console.log('✅ Date selected automatically');
    } catch (dateError) {
      console.log('⚠️ Automated date selection failed, falling back to manual');
      await handleDateManually(page);
    }
  } else {
    await handleDateManually(page);
  }
  
  // Handle file uploads
  await handleFileUploads(page, uploadBothDocuments);
  
  // Click Continue
  try {
    await page.click('button:has-text("Continue")');
    await page.waitForLoadState('networkidle');
    console.log('✅ Client requirements completed');
  } catch (continueError) {
    console.log('⚠️ Continue button click failed:', continueError.message);
    if (!automate) {
      console.log('👉 Please manually click Continue button, then press Resume');
      await page.pause();
    }
  }
}

// Helper function for manual date handling
async function handleDateManually(page) {
  console.log('📅 Please manually select the date of birth (March 21, 2024 or your preferred date)');
  console.log('👉 Click on the date field and select the appropriate date, then press Resume to continue');
  await page.pause();
}

// Helper function for file uploads
async function handleFileUploads(page, uploadBothDocuments) {
  console.log('📤 Starting document upload process...');
  
  try {
    await page.waitForTimeout(2000);
    
    // Upload Oman Civil ID (optional)
    if (uploadBothDocuments) {
      await uploadOmanCivilId(page);
    }
    
    // Upload Experience document (required)
    await uploadExperienceDocument(page);
    
    console.log('📤 Document upload process completed');
    
  } catch (uploadError) {
    console.log('Upload error:', uploadError.message);
    console.log('Upload automation failed, but continuing...');
  }
}

// Helper function for Oman Civil ID upload
async function uploadOmanCivilId(page) {
  console.log('Uploading Oman Civil ID document...');
  
  try {
    const firstUploadInput = page.locator('input[type="file"]').first();
    await firstUploadInput.setInputFiles('./dummy-document.pdf');
    console.log('Oman Civil ID document uploaded');
  } catch (error) {
    console.log('Oman Civil ID upload failed:', error.message);
  }
  
  await page.waitForTimeout(1000);
}

// Helper function for Experience document upload
async function uploadExperienceDocument(page) {
  console.log(' Uploading Experience document...');
  
  try {
    // Try multiple approaches to find and click the Upload button
    let uploadButtonClicked = false;
    
    // Method 1: Target specific Experience Upload button
    const experienceUploadBtn = page.locator('button:has-text("Upload")').last();
    if (await experienceUploadBtn.isVisible()) {
      await experienceUploadBtn.click();
      uploadButtonClicked = true;
      console.log('Clicked Experience Upload button');
    }
    
    // Method 2: Use CSS class selector as fallback
    if (!uploadButtonClicked) {
      const uploadByClass = page.locator('.downloadUpload-module_button__-uMBo').last();
      if (await uploadByClass.isVisible()) {
        await uploadByClass.click();
        uploadButtonClicked = true;
        console.log('Clicked Upload button using CSS class');
      }
    }
    
    if (uploadButtonClicked) {
      await page.waitForTimeout(1500);
      
      // Upload file to the last file input (Experience)
      const fileInput = page.locator('input[type="file"]').last();
      await fileInput.setInputFiles('./dummy-document.pdf');
      console.log('✅ Experience document uploaded successfully');
    } else {
      // Direct approach as final fallback
      const fileInput = page.locator('input[type="file"]').last();
      await fileInput.setInputFiles('./dummy-document.pdf');
      console.log('✅ Experience document uploaded via direct method');
    }
    
  } catch (error) {
    console.log('Experience upload failed:', error.message);
    throw error;
  }
  
  await page.waitForTimeout(1500);
}

await handleCRLGroupName2Page(page);

async function handleCRLGroupName2Page(page) {
  console.log(' Handling CRL Group Name 2 page...');
  
  await page.waitForLoadState('networkidle');
  
  // Click the checkbox
  await page.click('input[type="checkbox"]');
  console.log('Checkbox clicked');
  
  // Click Continue
  await page.click('button:has-text("Continue")');
  await page.waitForLoadState('networkidle');
  
  console.log('CRL Group Name 2 completed');
}

// Handle Upload Document - Identity page (NEW)
await handleUploadDocumentIdentityPage(page);

// After manual completion of Date of Expiry
await saveAndContinueIdentity(page);

// Helper function to handle Upload Document - Identity page
async function handleUploadDocumentIdentityPage(page) {
  console.log('📄 Starting Upload Document - Identity page handling...');
  
  try {
    // Wait for the upload document page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot of the upload document page
    await page.screenshot({ path: 'upload-document-identity-page.png' });
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`📍 Current URL on upload document page: ${currentUrl}`);
    
    // Check if we're on the upload document page
    const hasUploadDocumentContent = await page.isVisible('text="Upload Document"');
    const hasIdentityTab = await page.isVisible('text="Identity"');
    if (hasUploadDocumentContent && hasIdentityTab) {
      console.log('✅ Upload Document - Identity page loaded successfully');
    } else {
      console.log('⚠️ Upload Document - Identity page may not be fully loaded');
    }
    
    // Step 1: Upload the passport document
    console.log('📤 Step 1: Uploading passport document...');
    await uploadPassportDocument(page);
    
    // Step 2: Fill in the identity form details
    console.log('📝 Step 2: Filling identity form details...');
    await fillIdentityFormDetails(page);
    
    // Step 3: Click Save and Continue button
    console.log('💾 Step 3: Clicking Save and Continue...');
    await saveAndContinueIdentity(page);
    
    console.log('🎉 Upload Document - Identity page handling completed successfully!');
    
  } catch (identityUploadError) {
    console.log('❌ Error during upload document identity handling:', identityUploadError.message);
    await page.screenshot({ path: 'upload-document-identity-error.png' });
    
    // Enhanced debug information
    console.log('🔍 Debug: Current page state...');
    console.log(`🔍 Debug: Current URL: ${page.url()}`);
    console.log(`🔍 Debug: Page title: ${await page.title()}`);
    
    throw identityUploadError;
  }
}

// Helper function to upload passport document
async function uploadPassportDocument(page) {
  console.log('📤 Uploading passport document...');
  
  try {
    // Create dummy PDF file for passport if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync('dummy-passport.pdf')) {
      const dummyPassportContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(PASSPORT DOCUMENT) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000245 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n344\n%%EOF';
      fs.writeFileSync('dummy-passport.pdf', dummyPassportContent);
      console.log('📄 Created dummy passport PDF file');
    }
    
    // Method 1: Click the upload area directly
    try {
      console.log('🔄 Method 1: Clicking upload area...');
      await page.waitForSelector('text="Click to upload"', { timeout: 5000 });
      await page.click('text="Click to upload"');
      console.log('✅ Clicked upload area');
    } catch (uploadAreaError) {
      console.log('🔄 Method 1 failed, trying method 2...');
      
      // Method 2: Click the upload container/div
      try {
        console.log('🔄 Method 2: Clicking upload container...');
        const uploadContainer = page.locator('.upload-container, [class*="upload"], [data-testid*="upload"]').first();
        await uploadContainer.click();
        console.log('✅ Clicked upload container');
      } catch (containerError) {
        console.log('🔄 Method 2 failed, trying method 3...');
        
        // Method 3: Direct file input approach
        console.log('🔄 Method 3: Using direct file input...');
      }
    }
    
    // Wait for file dialog or direct upload
    await page.waitForTimeout(1000);
    
    // Upload the file using the file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./dummy-passport.pdf');
    console.log('✅ Passport document uploaded successfully');
    
    // Wait for upload to complete
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'after-passport-upload.png' });
    
  } catch (uploadError) {
    console.log('❌ Passport upload failed:', uploadError.message);
    console.log('👉 Please manually upload a passport document, then press Resume');
    await page.pause();
  }
}

// Helper function to fill identity form details
async function fillIdentityFormDetails(page) {
  console.log('📝 Filling identity form details...');
  
  try {
    // Wait for form to be ready after upload
    await page.waitForTimeout(2000);
    
    // Fill First Name
    console.log('📝 Filling First Name...');
    const firstNameField = page.locator('input').filter({ hasText: /First Name|Type here/ }).first();
    // Try multiple selectors for first name
    const firstNameSelectors = [
      'input[placeholder*="Type here"]',
      'input[name*="firstName"]',
      'input[name*="first_name"]',
      'input[id*="firstName"]',
      'input[id*="first_name"]'
    ];
    
    let firstNameFilled = false;
    for (const selector of firstNameSelectors) {
      try {
        const field = page.locator(selector).first();
        if (await field.isVisible()) {
          await field.fill('John');
          console.log('✅ First Name filled: John');
          firstNameFilled = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!firstNameFilled) {
      // Generic approach - fill the first empty text input
      const textInputs = page.locator('input[type="text"]');
      const inputCount = await textInputs.count();
      for (let i = 0; i < inputCount; i++) {
        const input = textInputs.nth(i);
        const value = await input.inputValue();
        if (!value || value.trim() === '') {
          await input.fill('John');
          console.log(`✅ Filled first empty input (index ${i}) with: John`);
          break;
        }
      }
    }
    
    await page.waitForTimeout(500);
    
    // Fill Middle Name (optional)
    console.log('📝 Filling Middle Name...');
    const middleNameSelectors = [
      'input[placeholder*="Type here"]',
      'input[name*="middleName"]',
      'input[name*="middle_name"]',
      'input[id*="middleName"]',
      'input[id*="middle_name"]'
    ];
    
    for (const selector of middleNameSelectors) {
      try {
        const field = page.locator(selector).nth(1); // Second field is usually middle name
        if (await field.isVisible()) {
          const currentValue = await field.inputValue();
          if (!currentValue || currentValue.trim() === '') {
            await field.fill('Michael');
            console.log('✅ Middle Name filled: Michael');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(500);
    
    // Fill Last Name
    console.log('📝 Filling Last Name...');
    const lastNameSelectors = [
      'input[placeholder*="Type here"]',
      'input[name*="lastName"]',
      'input[name*="last_name"]',
      'input[id*="lastName"]',
      'input[id*="last_name"]'
    ];
    
    for (const selector of lastNameSelectors) {
      try {
        const field = page.locator(selector).nth(2); // Third field is usually last name
        if (await field.isVisible()) {
          const currentValue = await field.inputValue();
          if (!currentValue || currentValue.trim() === '') {
            await field.fill('Doe');
            console.log('✅ Last Name filled: Doe');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(500);
    
    // Fill Nationality
    console.log('📝 Filling Nationality...');
    try {
      const nationalityField = page.locator('input[name*="nationality"], input[id*="nationality"]').first();
      if (await nationalityField.isVisible()) {
        await nationalityField.fill('Indian');
        console.log('✅ Nationality filled: Indian');
      } else {
        // Try finding by placeholder text
        const textInputs = page.locator('input[type="text"]');
        const inputCount = await textInputs.count();
        for (let i = 0; i < inputCount; i++) {
          const input = textInputs.nth(i);
          const placeholder = await input.getAttribute('placeholder');
          if (placeholder && placeholder.toLowerCase().includes('nation')) {
            await input.fill('Indian');
            console.log('✅ Nationality filled: Indian');
            break;
          }
        }
      }
    } catch (nationalityError) {
      console.log('⚠️ Could not fill nationality automatically');
    }
    
    await page.waitForTimeout(500);
    
    // Verify Date of Birth is pre-filled (August 19, 2002 as seen in screenshot)
    console.log('📅 Verifying Date of Birth...');
    try {
      const dobField = page.locator('input[value*="August"], input[value*="2002"], input[placeholder*="date"]').first();
      if (await dobField.isVisible()) {
        const dobValue = await dobField.inputValue();
        console.log(`✅ Date of Birth is pre-filled: ${dobValue}`);
      }
    } catch (dobError) {
      console.log('📅 Date of Birth field status unclear, but continuing...');
    }
    
    // Handle Gender dropdown - AUTOMATICALLY SELECT MALE
    console.log('👤 Selecting Gender automatically...');
    try {
      // Target the specific dropdown structure based on the provided HTML
      const genderDropdownSelectors = [
        'input.dropdown-module_dropdownInput__l6tDa', // Specific class from your HTML
        'input[placeholder="Select"][data-testid*="dropdownInput"]', // Data testid pattern
        'input[placeholder="Select"]', // Generic placeholder
        '.dropdown-module_dropdownInput__l6tDa', // Class selector
        'input[type="text"][placeholder="Select"]' // Generic text input with Select placeholder
      ];
      
      let dropdownOpened = false;
      let dropdownElement = null;
      
      // First, find and click the dropdown input to open it
      for (const selector of genderDropdownSelectors) {
        try {
          console.log(`🔍 Trying gender dropdown selector: ${selector}`);
          const dropdown = page.locator(selector);
          const count = await dropdown.count();
          
          console.log(`Found ${count} elements with selector: ${selector}`);
          
          if (count > 0) {
            // Try each element found with this selector
            for (let i = 0; i < count; i++) {
              const element = dropdown.nth(i);
              if (await element.isVisible()) {
                console.log(`✅ Found visible dropdown at index ${i} with selector: ${selector}`);
                await element.click();
                console.log(`✅ Clicked dropdown input`);
                await page.waitForTimeout(1500); // Wait for dropdown to open
                dropdownOpened = true;
                dropdownElement = element;
                break;
              }
            }
            if (dropdownOpened) break;
          }
        } catch (e) {
          console.log(`❌ Failed with selector ${selector}: ${e.message}`);
          continue;
        }
      }
      
      // If dropdown opened successfully, try to select Male option
      if (dropdownOpened) {
        console.log('🔍 Looking for Male option...');
        
        // Target the specific Male option structure from your HTML
        const maleOptionSelectors = [
          'div.dropdown-module_menuItemLabel__VJuGM:has-text("Male")', // Specific class with Male text
          '.dropdown-module_menuItemLabel__VJuGM:has-text("Male")', // Class selector variant
          'div:has-text("Male")', // Generic div with Male text
          '[class*="menuItemLabel"]:has-text("Male")', // Partial class match
          '[class*="menuItem"]:has-text("Male")', // Another partial class match
          'text="Male"' // Exact text match as fallback
        ];
        
        let maleSelected = false;
        
        for (const maleSelector of maleOptionSelectors) {
          try {
            console.log(`🔍 Trying Male option selector: ${maleSelector}`);
            const maleOption = page.locator(maleSelector);
            const count = await maleOption.count();
            
            console.log(`Found ${count} Male options with selector: ${maleSelector}`);
            
            if (count > 0) {
              // Try the first visible Male option
              const element = maleOption.first();
              if (await element.isVisible()) {
                await element.click();
                console.log(`✅ Successfully selected Male using selector: ${maleSelector}`);
                maleSelected = true;
                break;
              }
            }
          } catch (e) {
            console.log(`❌ Failed to select Male with selector ${maleSelector}: ${e.message}`);
            continue;
          }
        }
        
        // Additional fallback: try to find any element containing "Male" text
        if (!maleSelected) {
          try {
            console.log('🔍 Trying fallback: any element containing "Male"...');
            await page.waitForTimeout(1000); // Extra wait for dropdown to fully render
            
            const maleElements = page.getByText('Male');
            const count = await maleElements.count();
            console.log(`Found ${count} elements containing "Male" text`);
            
            if (count > 0) {
              for (let i = 0; i < count; i++) {
                const element = maleElements.nth(i);
                if (await element.isVisible()) {
                  await element.click();
                  console.log(`✅ Successfully clicked Male element at index ${i}`);
                  maleSelected = true;
                  break;
                }
              }
            }
          } catch (e) {
            console.log('❌ Fallback method also failed:', e.message);
          }
        }
        
        if (!maleSelected) {
          console.log('⚠️ Could not automatically select Male option');
          console.log('👉 Dropdown is open, please manually select "Male" and then press Resume');
          await page.pause();
        } else {
          // Wait a bit after selection to ensure it registers
          await page.waitForTimeout(1000);
          console.log('✅ Gender selection completed successfully');
        }
        
      } else {
        console.log('❌ Could not open gender dropdown automatically');
        console.log('👉 Please manually open dropdown and select gender, then press Resume');
        await page.pause();
      }
      
    } catch (genderError) {
      console.log('❌ Error handling gender dropdown:', genderError.message);
      console.log('👉 Please manually select gender and then press Resume');
      await page.pause();
    }
    
    await page.waitForTimeout(1000);
    
    // Fill ID Number (but leave Date of Expiry for manual input)
    console.log('🆔 Filling ID Number...');
    try {
      // Look for the last input field that's likely the ID number
      const idNumberSelectors = [
        'input[name*="id"]',
        'input[name*="ID"]', 
        'input[id*="id"]',
        'input[id*="ID"]',
        'input[placeholder*="Type here"]:last-of-type'
      ];
      
      for (const selector of idNumberSelectors) {
        try {
          const field = page.locator(selector).last();
          if (await field.isVisible()) {
            const currentValue = await field.inputValue();
            if (!currentValue || currentValue.trim() === '') {
              await field.fill('A12345678');
              console.log('✅ ID Number filled: A12345678');
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (idError) {
      console.log('🆔 Could not fill ID number automatically');
    }
    
    // Note about Date of Expiry - leave for manual input
    console.log('📅 Date of Expiry field left for manual input as requested');
    console.log('👉 Please manually fill the Date of Expiry field before clicking Save and Continue');
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'after-identity-form-fill.png' });
    
    console.log('📝 Identity form details filling completed (except Date of Expiry)');
    console.log('👉 Please fill Date of Expiry manually, then the script will continue');
    
  } catch (formError) {
    console.log('❌ Error filling identity form:', formError.message);
    console.log('👉 Please manually fill any missing fields, then press Resume');
    await page.pause();
  }
}

// Helper function to click Save and Continue
async function saveAndContinueIdentity(page) {
  console.log('💾 Clicking Save and Continue button...');
  
  try {
    // Wait for form to be complete
    await page.waitForTimeout(1000);
    
    // Look for Save and Continue button
    const saveButton = page.locator('button:has-text("Save and Continue")');
    
    if (await saveButton.isVisible()) {
      const isEnabled = await saveButton.isEnabled();
      console.log(`🔍 Save and Continue button - visible: true, enabled: ${isEnabled}`);
      
      if (isEnabled) {
        // Take screenshot before clicking
        await page.screenshot({ path: 'before-save-continue-identity.png' });
        
        await saveButton.click();
        console.log('✅ Successfully clicked Save and Continue button');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`📍 After Save and Continue URL: ${newUrl}`);
        await page.screenshot({ path: 'after-save-continue-identity.png' });
        
        console.log('✅ Successfully navigated to next page after Save and Continue');
        
      } else {
        console.log('⚠️ Save and Continue button is not enabled - form may be incomplete');
        console.log('👉 Please manually complete the form and click Save and Continue, then press Resume');
        await page.pause();
      }
      
    } else {
      console.log('❌ Save and Continue button not found');
      
      // Try alternative button selectors
      const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Continue")',
        'button:has-text("Save")',
        'button:has-text("Next")',
        '.btn-primary',
        '.save-btn'
      ];
      
      let buttonClicked = false;
      for (const buttonSelector of buttonSelectors) {
        try {
          console.log(`🔄 Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`✅ Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('👉 Could not find Save and Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
  } catch (saveError) {
    console.log('❌ Error clicking Save and Continue:', saveError.message);
    await page.screenshot({ path: 'save-continue-error-identity.png' });
    console.log('👉 Please manually click Save and Continue, then press Resume');
    await page.pause();
  }
}

// Call this function when you reach the Degree/Diploma page
await fillDegreeDiplomaFormDetails(page);

// After manual completion of dates and file uploads
await saveAndContinueDegreeDiploma(page);

// Helper function to fill degree/diploma form details
async function fillDegreeDiplomaFormDetails(page) {
  console.log('🎓 Filling degree/diploma form details...');
  try {
    // Wait for form to be ready
    await page.waitForTimeout(1000);
    
    // Skip University Name and Degree - as requested, do not touch these fields
    console.log('🏫 Skipping University Name and Degree fields as requested');
    
    // Handle Department Name dropdown - select BE
    console.log('📚 Selecting Department Name (BE)...');
    try {
      // Find the Department Name dropdown - it shows "Select" placeholder
      const departmentDropdown = page.locator('text="Department name"').locator('..').locator('input, div[role="combobox"], div[tabindex="0"]').first();
      
      // Alternative: directly target the dropdown with "Select" text under Department name
      const departmentSelect = page.locator('text="Department name"').locator('..').locator('text="Select"').first();
      
      let departmentClicked = false;
      
      // Try clicking the Select text first (more reliable)
      if (await departmentSelect.isVisible()) {
        await departmentSelect.click();
        console.log('✅ Clicked Department Name dropdown via Select text');
        departmentClicked = true;
      } else if (await departmentDropdown.isVisible()) {
        await departmentDropdown.click();
        console.log('✅ Clicked Department Name dropdown via input');
        departmentClicked = true;
      }
      
      if (departmentClicked) {
        await page.waitForTimeout(1000);
        
        // Look for BE option in the dropdown menu
        const beOptionSelectors = [
          'div.dropdown-module_menuItemLabel__VJuGM:has-text("BE")',
          '.dropdown-module_menuItem__lQ-VE:has-text("BE")',
          'div[role="option"]:has-text("BE")',
          'li:has-text("BE")',
          'text="BE"'
        ];
        
        let departmentSelected = false;
        for (const beSelector of beOptionSelectors) {
          try {
            const beOption = page.locator(beSelector).first();
            if (await beOption.isVisible()) {
              await beOption.click();
              console.log('✅ Selected BE from Department Name dropdown');
              departmentSelected = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!departmentSelected) {
          console.log('⚠️ Could not find BE option in dropdown');
        }
      } else {
        console.log('❌ Could not find Department Name dropdown');
      }
      
    } catch (departmentError) {
      console.log('❌ Error selecting department:', departmentError.message);
    }
    
    await page.waitForTimeout(500);
    
    // Handle Course Name dropdown - select CSE
    console.log('💻 Selecting Course Name (CSE)...');
    try {
      // Find the Course Name dropdown - it shows "Select" placeholder
      const courseDropdown = page.locator('text="Course Name"').locator('..').locator('input, div[role="combobox"], div[tabindex="0"]').first();
      
      // Alternative: directly target the dropdown with "Select" text under Course Name
      const courseSelect = page.locator('text="Course Name"').locator('..').locator('text="Select"').first();
      
      let courseClicked = false;
      
      // Try clicking the Select text first (more reliable)
      if (await courseSelect.isVisible()) {
        await courseSelect.click();
        console.log('✅ Clicked Course Name dropdown via Select text');
        courseClicked = true;
      } else if (await courseDropdown.isVisible()) {
        await courseDropdown.click();
        console.log('✅ Clicked Course Name dropdown via input');
        courseClicked = true;
      }
      
      if (courseClicked) {
        await page.waitForTimeout(1000);
        
        // Look for CSE option in the dropdown menu
        const cseOptionSelectors = [
          'div.dropdown-module_menuItemLabel__VJuGM:has-text("CSE")',
          '.dropdown-module_menuItem__lQ-VE:has-text("CSE")',
          'div[role="option"]:has-text("CSE")',
          'li:has-text("CSE")',
          'text="CSE"'
        ];
        
        let courseSelected = false;
        for (const cseSelector of cseOptionSelectors) {
          try {
            const cseOption = page.locator(cseSelector).first();
            if (await cseOption.isVisible()) {
              await cseOption.click();
              console.log('✅ Selected CSE from Course Name dropdown');
              courseSelected = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!courseSelected) {
          console.log('⚠️ Could not find CSE option in dropdown');
        }
      } else {
        console.log('❌ Could not find Course Name dropdown');
      }
      
    } catch (courseError) {
      console.log('❌ Error selecting course:', courseError.message);
    }
    
    await page.waitForTimeout(500);
    
    // Fill Program Duration (in years) - type 4
    console.log('⏱️ Filling Program Duration...');
    try {
      // Find the Program Duration field by looking near the label
      const durationInput = page.locator('text="Program Duration (in years)"').locator('..').locator('input[placeholder="Type here"]').first();
      
      if (await durationInput.isVisible()) {
        await durationInput.fill('4');
        console.log('✅ Program Duration filled: 4 years');
      } else {
        console.log('❌ Could not find Program Duration input field');
      }
      
    } catch (durationError) {
      console.log('❌ Error filling program duration:', durationError.message);
    }
    
    await page.waitForTimeout(500);
    
    // Handle Mode of Study dropdown - select Active Enrollment
    console.log('📖 Selecting Mode of Study (Active Enrollment)...');
    try {
      // Find the Mode of Study dropdown - it shows "Select" placeholder
      const modeDropdown = page.locator('text="Mode of Study"').locator('..').locator('input, div[role="combobox"], div[tabindex="0"]').first();
      
      // Alternative: directly target the dropdown with "Select" text under Mode of Study
      const modeSelect = page.locator('text="Mode of Study"').locator('..').locator('text="Select"').first();
      
      let modeClicked = false;
      
      // Try clicking the Select text first (more reliable)
      if (await modeSelect.isVisible()) {
        await modeSelect.click();
        console.log('✅ Clicked Mode of Study dropdown via Select text');
        modeClicked = true;
      } else if (await modeDropdown.isVisible()) {
        await modeDropdown.click();
        console.log('✅ Clicked Mode of Study dropdown via input');
        modeClicked = true;
      }
      
      if (modeClicked) {
        await page.waitForTimeout(1000);
        
        // Look for Active Enrollment option
        const activeEnrollmentSelectors = [
          'div.dropdown-module_menuItemLabel__VJuGM:has-text("Active Enrollment")',
          'div[role="option"]:has-text("Active Enrollment")',
          'li:has-text("Active Enrollment")',
          'text="Active Enrollment"'
        ];
        
        let modeSelected = false;
        for (const activeSelector of activeEnrollmentSelectors) {
          try {
            const activeOption = page.locator(activeSelector).first();
            if (await activeOption.isVisible()) {
              await activeOption.click();
              console.log('✅ Selected Active Enrollment from Mode of Study dropdown');
              modeSelected = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!modeSelected) {
          console.log('⚠️ Could not find Active Enrollment option');
        }
      } else {
        console.log('❌ Could not find Mode of Study dropdown');
      }
      
    } catch (modeError) {
      console.log('❌ Error selecting mode of study:', modeError.message);
    }
    
    await page.waitForTimeout(500);
    
    // Note about Start Date and End Date - leave for manual input
    console.log('📅 Start Date and End Date left for manual input as requested');
    
    // Fill First Name and Last Name (same as identity page)
    console.log('📝 Filling First Name and Last Name...');
    try {
      // Fill First Name - look for input that might be first name
      const firstNameSelectors = [
        'input[name*="firstName"]',
        'input[name*="first"]',
        'input[placeholder*="First"]',
        'input[id*="firstName"]'
      ];
      
      for (const selector of firstNameSelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.isVisible()) {
            await field.fill('John');
            console.log('✅ First Name filled: John');
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      await page.waitForTimeout(500);
      
      // Fill Last Name
      const lastNameSelectors = [
        'input[name*="lastName"]',
        'input[name*="last"]',
        'input[placeholder*="Last"]',
        'input[id*="lastName"]'
      ];
      
      for (const selector of lastNameSelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.isVisible()) {
            await field.fill('Doe');
            console.log('✅ Last Name filled: Doe');
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
    } catch (nameError) {
      console.log('❌ Error filling names:', nameError.message);
    }
    
    await page.waitForTimeout(1000);
    
    // Upload dummy files for the four document types
    console.log('📁 Uploading dummy files...');
    try {
      // Look for file upload buttons or inputs
      const fileUploadSelectors = [
        'input[type="file"]',
        'button:has-text("Upload")',
        'button:has-text("Choose")',
        'button:has-text("Browse")',
        '[data-testid*="upload"]'
      ];
      
      // Create a dummy file for upload (you'll need to have actual dummy files)
      // For now, we'll just identify upload elements
      for (const selector of fileUploadSelectors) {
        try {
          const uploadElements = page.locator(selector);
          const count = await uploadElements.count();
          
          console.log(`Found ${count} upload elements with selector: ${selector}`);
          
          // Note: For actual file upload, you would need to provide file paths
          // Example: await uploadElement.setInputFiles('path/to/dummy-file.pdf');
          
        } catch (e) {
          continue;
        }
      }
      
      console.log('📁 File upload elements identified');
      console.log('👉 Please manually upload the required documents, or provide file paths for automation');
      
    } catch (uploadError) {
      console.log('❌ Error with file uploads:', uploadError.message);
    }
    
    await page.screenshot({ path: 'after-degree-diploma-form-fill.png' });
    
    console.log('🎓 Degree/Diploma form details filling completed');
    console.log('👉 Please manually:');
    console.log('   - Fill Start Date and End Date');
    console.log('   - Upload the four required documents');
    console.log('   - Then click Save and Continue');
    
  } catch (formError) {
    console.log('❌ Error filling degree/diploma form:', formError.message);
    console.log('👉 Please manually complete any missing fields, then press Resume');
    await page.pause();
  }
}

// Helper function to click Save and Continue for degree/diploma page
async function saveAndContinueDegreeDiploma(page) {
  console.log('💾 Clicking Save and Continue button for Degree/Diploma...');
  
  try {
    // Wait for form to be complete
    await page.waitForTimeout(1000);
    
    // Look for Save and Continue button
    const saveButton = page.locator('button:has-text("Save and Continue")');
    
    if (await saveButton.isVisible()) {
      const isEnabled = await saveButton.isEnabled();
      console.log(`🔍 Save and Continue button - visible: true, enabled: ${isEnabled}`);
      
      if (isEnabled) {
        // Take screenshot before clicking
        await page.screenshot({ path: 'before-save-continue-degree.png' });
        
        await saveButton.click();
        console.log('✅ Successfully clicked Save and Continue button');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`📍 After Save and Continue URL: ${newUrl}`);
        await page.screenshot({ path: 'after-save-continue-degree.png' });
        
        console.log('✅ Successfully navigated to next page after Save and Continue');
        
      } else {
        console.log('⚠️ Save and Continue button is not enabled - form may be incomplete');
        console.log('👉 Please manually complete the form and click Save and Continue, then press Resume');
        await page.pause();
      }
      
    } else {
      console.log('❌ Save and Continue button not found - trying alternative selectors');
      
      // Try alternative button selectors
      const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Continue")',
        'button:has-text("Save")',
        'button:has-text("Next")',
        '.btn-primary',
        '.save-btn'
      ];
      
      let buttonClicked = false;
      for (const buttonSelector of buttonSelectors) {
        try {
          console.log(`🔄 Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`✅ Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('👉 Could not find Save and Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
  } catch (saveError) {
    console.log('❌ Error clicking Save and Continue:', saveError.message);
    await page.screenshot({ path: 'save-continue-error-degree.png' });
    console.log('👉 Please manually click Save and Continue, then press Resume');
    await page.pause();
  }
}

}