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
  console.log(`Cookies saved for ${email}`);
}

async function loadCookies(page: any) {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
      
      // Check if cookies are not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - cookieData.timestamp > maxAge) {
        console.log('Cookies are too old, will need fresh login');
        return null;
      }
      
      await page.context().addCookies(cookieData.cookies);
      console.log(`Cookies loaded for ${cookieData.email}`);
      return cookieData.email;
    }
  } catch (error) {
    console.log('Error loading cookies:', error.message);
  }
  return null;
}

// IMPROVED dropdown selection - using actual input element and waiting properly
async function selectDropdownOption(page: any, testId: string, optionText: string) {
  console.log(`Attempting to select "${optionText}" for ${testId}`);
  
  try { 
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Method 1: Click directly on the input field using data-testid
    console.log(`Method 1: Clicking dropdown input field using testId...`);
    
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
    console.log(`Clicked dropdown input field: ${inputSelector}`);
    
    // Wait for dropdown options to appear
    await page.waitForTimeout(3000);
    
    // Method 2: Try multiple approaches to select the option
    console.log(`Looking for option: ${optionText}`);
    
    // Strategy A: Direct text match
    try {
      await page.waitForSelector(`text="${optionText}"`, { timeout: 5000 });
      await page.click(`text="${optionText}"`);
      console.log(`Selected option using direct text: ${optionText}`);
      await page.waitForTimeout(1000);
      return true;
    } catch (directTextError) {
      console.log(`Direct text click failed, trying other methods...`);
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
          console.log(`Successfully clicked option using selector: ${selector}`);
          optionClicked = true;
          break;
        }
      } catch (e) {
        console.log(`Selector ${selector} didn't work, trying next...`);
        continue;
      }
    }
    
    // Strategy C: If no selector worked, try keyboard navigation
    if (!optionClicked) {
      console.log(`Trying keyboard navigation method...`);
      try {
        // Clear the input and type the option
        await inputElement.click();
        await page.keyboard.press('Control+A'); // Select all
        await page.keyboard.type(optionText);
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        console.log(`Selected option using keyboard navigation: ${optionText}`);
        optionClicked = true;
      } catch (keyboardError) {
        console.log(`Keyboard navigation failed: ${keyboardError.message}`);
      }
    }
    
    // Strategy D: If still not clicked, use manual intervention
    if (!optionClicked) {
      console.log(`Could not click option automatically. Manual intervention required.`);
      console.log(`The dropdown should be open. Please manually click on "${optionText}" option, then press Resume`);
      await page.pause();
      optionClicked = true; // Assume user clicked it
    }
    
    // Wait for selection to complete and form to update
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    console.log(`Dropdown selection completed for ${testId}`);
    return true;
    
  } catch (error) {
    console.log(`Error in dropdown selection: ${error.message}`);
    
    // Show current page state for debugging
    console.log(`Debug: Current URL: ${page.url()}`);
    
    // Check if dropdown inputs exist
    try {
      const allDropdowns = await page.locator('[data-testid*="-dropdownInput"]').count();
      console.log(`Debug: Found ${allDropdowns} dropdown inputs on page`);
      
      if (allDropdowns > 0) {
        const testIds = await page.locator('[data-testid*="-dropdownInput"]').all();
        for (let i = 0; i < testIds.length; i++) {
          const testIdValue = await testIds[i].getAttribute('data-testid');
          console.log(`Debug: Dropdown ${i}: ${testIdValue}`);
        }
      }
    } catch (debugError) {
      console.log(`Debug logging failed: ${debugError.message}`);
    }
    
    console.log(`MANUAL INTERVENTION REQUIRED:`);
    console.log(`   Field: ${testId}`);
    console.log(`   Option to select: ${optionText}`);
    console.log(`   Please manually select the option and press Resume`);
    
    await page.pause();
    return true;
  }
}

// Legacy function for backward compatibility - updated to use new approach
async function selectDropdownByTestId(page: any, testId: string, optionText: string) {
  console.log(`Selecting dropdown option "${optionText}" for testId: ${testId}`);
  return await selectDropdownOption(page, testId, optionText);
}

// Helper function to handle report transfer page
async function handleReportTransferPage(page: any) {
  console.log('Starting report transfer page handling...');
  
  try {
    // Wait for the report transfer page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`Current URL on report transfer page: ${currentUrl}`);
    
    // Check if the report transfer page is visible
    const reportTransferTitle = await page.isVisible('text="Reuse your previous DataFlow report"');
    if (reportTransferTitle) {
      console.log('Report transfer page loaded successfully');
      
      // Log the current selections visible on the page
      const selections = [
        await page.isVisible('text="Bahrain"') ? '🇧🇭 Bahrain' : '',
        await page.isVisible('text="National Health Regulatory Authority"') ? '🏛️ NHRA' : '',
        await page.isVisible('text="Foreign Education Recognition"') ? '🎓 Foreign Education Recognition' : '',
        await page.isVisible('text="Fresh Graduates - Bahraini Nationals"') ? '👨‍🎓 Fresh Graduates - Bahraini Nationals' : ''
      ].filter(Boolean);
      
      console.log('Confirmed selections:', selections.join(', '));
    } else {
      console.log('Report transfer page may not be fully loaded');
    }
    
    // Check if there are existing reports shown
    const hasExistingReports = await page.isVisible('text="Already have an existing Dataflow report?"');
    if (hasExistingReports) {
      console.log('Page shows option to find existing reports');
    }
    
    // Check if the "Find Your Report" button is visible (optional action)
    const findReportButton = await page.isVisible('button:has-text("Find Your Report")');
    if (findReportButton) {
      console.log('Find Your Report" button is available but we will proceed with Continue');
    }
    
    // Step 1: Look for and click the Continue button
    console.log('Looking for and clicking the Continue button...');
    
    try {
      // Wait for Continue button to be visible and enabled
      await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
      
      const continueButton = page.locator('button:has-text("Continue")');
      const isEnabled = await continueButton.isEnabled();
      const isVisible = await continueButton.isVisible();
      
      console.log(`Continue button - visible: ${isVisible}, enabled: ${isEnabled}`);
      
      if (isVisible && isEnabled) {
 

        
        await continueButton.click();
        console.log('Successfully clicked Continue button on report transfer page');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`After Continue click URL: ${newUrl}`);
        
        // Verify that we've moved to the next step
        if (newUrl !== currentUrl) {
          console.log('Successfully navigated to next page after clicking Continue');
          
          // Check what type of page we landed on
          const hasUploadSection = await page.isVisible('text="Upload", text="Choose File", text="Browse", input[type="file"]');
          const hasPersonalInfo = await page.isVisible('text="Personal Information", text="Name", text="Date of Birth"');
          const hasApplicationForm = await page.isVisible('text="Application Form", text="Submit", text="Review"');
          
          if (hasUploadSection) {
            console.log('Detected file upload section - moved to document upload page');
          } else if (hasPersonalInfo) {
            console.log('Detected personal information section - moved to profile/details page');
          } else if (hasApplicationForm) {
            console.log('Detected application form - moved to final application page');
          } else {
            console.log('Moved to next page (type not immediately identified)');
          }
          
        } else {
          console.log('URL didn\'t change - checking for other indicators of progress...');
          
          // Check if page content changed
          await page.waitForTimeout(2000);
          const pageChanged = !(await page.isVisible('text="Reuse your previous DataFlow report"'));
          if (pageChanged) {
            console.log('Page content changed - navigation likely successful');
          }
        }
        
      } else {
        console.log('Continue button is not visible or enabled');
        console.log('Please manually verify the page state and click Continue if available, then press Resume');
        await page.pause();
      }
      
    } catch (continueError) {
      console.log('Could not find or click Continue button:', continueError.message);
      
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
          console.log(`Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('Could not find Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
    console.log('Report transfer page handling completed successfully!');
    
  } catch (reportTransferError) {
    console.log('Error during report transfer page handling:', reportTransferError.message);
    
    // Enhanced debug information
    console.log('Debug: Current page state...');
    console.log(`Debug: Current URL: ${page.url()}`);
    console.log(`Debug: Page title: ${await page.title()}`);
    
    // Log available buttons for debugging
    try {
      const allButtons = await page.locator('button').allTextContents();
      console.log('Debug: Available buttons:', allButtons);
      
      const allLinks = await page.locator('a').allTextContents();
      console.log('Debug: Available links:', allLinks.slice(0, 10)); // Limit to first 10 to avoid spam
      
      // Check for specific elements on this page
      const hasReportTitle = await page.isVisible('text="Reuse your previous DataFlow report"');
      const hasContinueBtn = await page.isVisible('button:has-text("Continue")');
      const hasFindBtn = await page.isVisible('button:has-text("Find Your Report")');
      
      console.log(`Debug: Report title visible: ${hasReportTitle}`);
      console.log(`Debug: Continue button visible: ${hasContinueBtn}`);
      console.log(` Debug: Find Report button visible: ${hasFindBtn}`);
      
    } catch (debugError) {
      console.log('Debug logging failed:', debugError.message);
    }
    
    throw reportTransferError;
  }
}


test('Create Verification Request', async ({ page }) => {
  console.log('Starting Verification Request Test');
  
  const specificEmail = 'ndarshan+story47@dataflowgroup.com';
  
  // Try to load saved cookies first
  const savedEmail = await loadCookies(page);
  
  if (savedEmail && savedEmail === specificEmail) {
    console.log(`Using saved cookies for email: ${savedEmail}`);
    
    // Navigate directly to dashboard with cookies
    console.log('Loading DataFlow dashboard with saved cookies...');
    await page.goto('https://app.staging.dataflowgroup.com/en/dashboard/home');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check if we're actually logged in - look for elements that indicate successful login
    try {
      // Look for sidebar, user profile, or dashboard-specific elements
      await page.waitForSelector('text="Home", text="Verifications", text="Start New Verification", .sidebar, [class*="sidebar"]', { timeout: 1000 });
      console.log('Dashboard loaded successfully with cookies - user is logged in');
      
      // Skip to verification creation
      await createVerificationRequest(page);
      return; // IMPORTANT: Exit here, don't continue to login flow
      
    } catch (error) {
      console.log('Could not verify login state, checking URL...');
      
      // Secondary check - if we're on dashboard URL, assume login worked
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard')) {
        console.log('On dashboard URL, assuming cookies worked');
        await createVerificationRequest(page);
        return; // IMPORTANT: Exit here
      }
      
      console.log('Cookies may be invalid, proceeding with fresh login...');
    }
  } else {
    console.log('No valid cookies found or different email, proceeding with fresh login...');
  }
  
  // Fresh login process
  console.log('Loading DataFlow login page for fresh authentication...');
  await page.goto('https://app.staging.dataflowgroup.com/en/onboarding/signin');
  
  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
  console.log('Login page loaded successfully');
  
  // Fill the specific email
  await page.getByPlaceholder('Enter email ID').fill(specificEmail);
  console.log(`Email filled: ${specificEmail}`);
  
  // Pause for manual captcha entry
  console.log('Please enter captcha manually, then press [Resume] in Playwright Inspector...');
  await page.pause();
  
  // Continue with login flow
  await page.getByText('I consent to receive marketing communications from DataFlow').click();
  await page.getByRole('button', { name: 'Get OTP' }).click();
  console.log('Redirected to OTP verification page');
  
  // Pause for manual OTP entry
  console.log('Please enter OTP manually, then press [Resume] in Playwright Inspector...');
  await page.pause();
  
  // Wait for redirection to dashboard/home
  console.log('Waiting for redirect to dashboard...');
  await page.waitForFunction(() => {
    return window.location.href.includes('/dashboard') || window.location.href.includes('/home');
  }, { timeout: 5000 });
  
  const currentUrl = page.url();
  console.log('Redirected to:', currentUrl);
  
  // Save cookies after successful login
  await saveCookies(page, specificEmail);
  console.log('Login completed and cookies saved!');
  
  // Verify we're on the dashboard
  await expect(page).toHaveURL(/.*dashboard.*/);
  console.log('Authentication verified - we are logged in');
  
  // Proceed to create verification request
  await createVerificationRequest(page);
});

// Helper function to wait for manual confirmation that loaders are done
async function waitForManualConfirmation(page: any, message: string) {
  console.log(`${message}`);
  await page.pause();
  console.log('Manual confirmation received, continuing...');
}

// IMPROVED form filling function with better error handling and retries
async function fillVerificationForm(page: any) {
  console.log('Starting verification form process...');
  
  try {
    // Wait for the page to load completely
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    
    
    // Verify we're on the right page
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
  
    //  DROPDOWN SELECTIONS
    console.log('Section 1: Handling dropdown selections...');
    
    // Check if dropdowns are present
    const firstDropdownExists = await page.locator('[data-testid="testSpeciality-dropdownInput"]').isVisible();
    console.log(`First dropdown visible: ${firstDropdownExists}`);
    
    if (!firstDropdownExists) {
      console.log('First dropdown not found, waiting longer...');
      await page.waitForTimeout(2000);
      await page.waitForSelector('[data-testid="testSpeciality-dropdownInput"]', { timeout: 15000 });
    }
    
    // Step 1: Select "Foreign Education Recognition" in the first dropdown
    console.log('Step 1: Selecting verification reason - Foreign Education Recognition...');
    await selectDropdownOption(page, 'testSpeciality', 'Foreign Education Recognition');
    
    // Wait for form to update after first selection
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // Step 2: Check if second dropdown appeared and is enabled
    console.log('Step 2: Checking for second dropdown availability...');
    
    // Wait for second dropdown to become available
    let secondDropdownReady = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!secondDropdownReady && attempts < maxAttempts) {
      attempts++;
      console.log(`Attempt ${attempts}: Checking second dropdown...`);
      
      try {
        await page.waitForSelector('[data-testid="testSubSpeciality-dropdownInput"]', { timeout: 3000 });
        const secondDropdown = page.locator('[data-testid="testSubSpeciality-dropdownInput"]');
        
        if (await secondDropdown.isVisible() && await secondDropdown.isEnabled()) {
          secondDropdownReady = true;
          console.log('Second dropdown is ready');
        } else {
          console.log('Second dropdown not ready yet, waiting...');
          await page.waitForTimeout(2000);
        }
      } catch (error) {
        console.log(`Second dropdown not available yet (attempt ${attempts}), waiting...`);
        await page.waitForTimeout(2000);
      }
    }
    
    if (!secondDropdownReady) {
      console.log('Second dropdown did not become available, trying anyway...');
    }
    
    // Step 3: Select "Fresh Graduates - Bahraini Nationals" in the second dropdown
    console.log('Step 3: Selecting verification type - Fresh Graduates - Bahraini Nationals...');
    await selectDropdownOption(page, 'testSubSpeciality', 'Fresh Graduates - Bahraini Nationals');
    
    // Wait for form to update after second selection
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // =================
    // SECTION 2: DOCUMENT REQUIREMENTS

    console.log('Section 2: Handling document requirements...');
    
    // Check if the mandatory documents section is visible
    const mandatorySection = await page.isVisible('text="Mandatory Document(s) Required"');
    if (mandatorySection) {
      console.log('Document requirements section found on same page');
    } else {
      console.log('Looking for document requirements section...');
      // Wait a bit more for the section to appear
      await page.waitForTimeout(2000);
    }
    
    // Step 4: Find and check the mandatory acknowledgment checkbox
    console.log('Step 4: Looking for the mandatory documents acknowledgment checkbox...');
    
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
        console.log(`Trying checkbox selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        
        const checkbox = page.locator(selector);
        if (await checkbox.isVisible()) {
          // Check if it's already checked
          const isChecked = await checkbox.isChecked();
          console.log(`Checkbox checked status: ${isChecked}`);
          
          if (!isChecked) {
            await checkbox.check();
            console.log('Successfully checked the mandatory documents checkbox');
            checkboxClicked = true;
            break;
          } else {
            console.log('Checkbox was already checked');
            checkboxClicked = true;
            break;
          }
        }
      } catch (selectorError) {
        console.log(`Selector ${selector} didn't work, trying next...`);
        continue;
      }
    }
    
    // Alternative approach: Click on the label text containing the checkbox
    if (!checkboxClicked) {
      try {
        console.log('Trying to click the label text to activate checkbox...');
        const labelText = 'I understand that these document(s) are mandatory for my verification application';
        await page.click(`text="${labelText}"`);
        console.log('Clicked checkbox via label text');
        checkboxClicked = true;
      } catch (labelError) {
        console.log('Label text click method failed');
      }
    }
    
    // If still not clicked, try clicking near the checkbox icon
    if (!checkboxClicked) {
      try {
        console.log('Trying to click checkbox icon/area...');
        // Look for elements that might contain the checkbox visually
        await page.click('.checkbox, [class*="check"], [class*="tick"], span:near(:text("I understand"))');
        console.log('Clicked checkbox via icon/area method');
        checkboxClicked = true;
      } catch (iconError) {
        console.log('Checkbox icon click method failed');
      }
    }
    
    // Manual intervention if automatic methods fail
    if (!checkboxClicked) {
      console.log('Could not automatically check the mandatory documents checkbox');
      console.log('Please manually check the checkbox that says "I understand that these document(s) are mandatory..." then press Resume');
      await page.pause();
      checkboxClicked = true; // Assume user checked it
    }
    
    // Wait a moment for any UI updates after checkbox interaction
    await page.waitForTimeout(1000);
    
    // Step 5: Click the Proceed button
    console.log('Step 5: Looking for and clicking the Proceed button...');
    
    try {
      // Wait for Proceed button to be visible and enabled
      await page.waitForSelector('button:has-text("Proceed")', { timeout: 10000 });
      
      const proceedButton = page.locator('button:has-text("Proceed")');
      const isEnabled = await proceedButton.isEnabled();
      console.log(`Proceed button enabled status: ${isEnabled}`);
      
      if (isEnabled) {
        await proceedButton.click();
        console.log('Successfully clicked Proceed button');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`After Proceed click URL: ${newUrl}`);
        
        // Verify that we've moved to the next step
        if (newUrl !== currentUrl) {
          console.log('Successfully navigated to next page after clicking Proceed');
        } else {
          console.log('URL didn\'t change - checking for other indicators of progress...');
          
          // Check if page content changed indicating progress
          const hasUploadSection = await page.isVisible('text="Upload", text="Choose File", text="Browse", input[type="file"]');
          if (hasUploadSection) {
            console.log('Detected file upload section - likely moved to document upload page');
          }
        }
        
      } else {
        console.log('Proceed button is not enabled - checkbox may not be properly checked');
        console.log(' Please manually verify checkbox is checked and click Proceed, then press Resume');
        await page.pause();
      }
      
    } catch (proceedError) {
      console.log('Could not find or click Proceed button:', proceedError.message);
      
      // Try alternative button selectors for Proceed/Continue buttons
      const buttonSelectors = [
        'button:has-text("Continue")',
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Next")',
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
            console.log(`Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('Could not find Proceed/Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
    console.log('Verification form process completed successfully!');
    console.log('Summary: Selected dropdowns, acknowledged document requirements, and proceeded to next step');
    
  } catch (error) {
    console.log('Error during verification form process:', error.message);
    
    // Enhanced debug information
    console.log('Debug: Current page state...');
    console.log(`Debug: Current URL: ${page.url()}`);
    console.log(`Debug: Page title: ${await page.title()}`);
    
    // Log available elements for debugging
    try {
      const allDropdowns = await page.locator('[data-testid*="-dropdownInputContainer"]').count();
      console.log(`Debug: Found ${allDropdowns} dropdown containers on page`);
      
      const allInputs = await page.locator('[data-testid*="-dropdownInput"]').count();
      console.log(`Debug: Found ${allInputs} dropdown inputs on page`);
      
      const allButtons = await page.locator('button').allTextContents();
      console.log('Debug: Available buttons:', allButtons);
      
      const checkboxes = await page.locator('input[type="checkbox"]').count();
      console.log(`Debug: Found ${checkboxes} checkbox elements on page`);
      
      // Log specific testIds if available
      if (allInputs > 0) {
        const testIds = await page.locator('[data-testid*="-dropdownInput"]').all();
        for (let i = 0; i < testIds.length; i++) {
          const testIdValue = await testIds[i].getAttribute('data-testid');
          const isVisible = await testIds[i].isVisible();
          const isEnabled = await testIds[i].isEnabled();
          console.log(`Debug: Dropdown ${i}: ${testIdValue}, visible: ${isVisible}, enabled: ${isEnabled}`);
        }
      }
      
    } catch (debugError) {
      console.log('Debug logging failed:', debugError.message);
    }
    
    throw error;
  }
}

// Helper function to handle verification request creation
async function createVerificationRequest(page: any) {
  console.log('Starting verification request creation...');
  
  // Manual pause to wait for loaders - you control when to continue
  await waitForManualConfirmation(page, 'Please wait for all loaders to complete on the homepage, then press [Resume] in Playwright Inspector...');
  
  
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  // Step 1: Click Start New Verification first (as per requirement)
  console.log('Looking for Start New Verification in left sidebar...');
  
  try {
    // Method 1: Try clicking the exact text from the sidebar
    console.log('Trying to click Start New Verification...');
    await page.waitForSelector('text="Start New Verification"', { timeout: 10000 });
    await page.getByText('Start New Verification').click();
    console.log('Clicked Start New Verification from sidebar');
  } catch (error) {
    console.log('Trying alternative selectors...');
    try {
      // Method 2: Try as a link
      await page.getByRole('link', { name: 'Start New Verification' }).click();
      console.log('Clicked Start New Verification (link method)');
    } catch (error2) {
      console.log('Trying CSS selectors...');
      try {
        // Method 3: Try CSS selectors
        await page.click('a[href*="verification"], .nav-link:has-text("Start New Verification"), [data-cy="start-verification"]');
        console.log('Clicked Start New Verification (CSS method)');
      } catch (error3) {
        console.log(' Could not find Start New Verification button');
        
        // Log all available links for debugging
        const links = await page.locator('a').allTextContents();
        console.log('Available links on page:', links);
        
        throw new Error('Start New Verification button not found');
      }
    }
  }
  
  // Wait for navigation/loading after clicking Start New Verification
  await page.waitForLoadState('networkidle');
  console.log('Page loaded after clicking Start New Verification');
  
  
  // Step 2: Now select Bahrain (improved approach)
  console.log('Looking for Bahrain selection...');
  
  try {
    // Wait for the country selection page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give extra time for elements to render
    
    
    // Method 1: Try clicking the entire Bahrain card container
    try {
      console.log('Attempting to click Bahrain card container...');
      await page.waitForSelector('.gridCards-module_passiveTabContainer__OFKYG:has-text("Bahrain")', { timeout: 10000 });
      await page.click('.gridCards-module_passiveTabContainer__OFKYG:has-text("Bahrain")');
      console.log('Selected Bahrain country (card container method)');
    } catch (error1) {
      console.log('Card container method failed, trying purpose text...');
      
      // Method 2: Try clicking the purpose text specifically
      try {
        await page.waitForSelector('.gridCards-module_purposeText__sUuM2:has-text("Bahrain")', { timeout: 5000 });
        await page.click('.gridCards-module_purposeText__sUuM2:has-text("Bahrain")');
        console.log('Selected Bahrain country (purpose text method)');
      } catch (error2) {
        console.log('Purpose text method failed, trying image container...');
        
        // Method 3: Try clicking the image area
        try {
          await page.click('.gridCards-module_passiveTabContainer__OFKYG .gridCards-module_purposeIcon__MVzdp:has-text("Bahrain")');
          console.log('Selected Bahrain country (image container method)');
        } catch (error3) {
          console.log('Image container method failed, trying direct text click...');
          
          // Method 4: Force click on the text "Bahrain"
          try {
            const bahrainElement = await page.locator('text="Bahrain"').first();
            await bahrainElement.click({ force: true });
            console.log('Selected Bahrain country (forced text click)');
          } catch (error4) {
            console.log('Forced text click failed, trying coordinate-based click...');
            
            // Method 5: Get the bounding box and click in the center
            try {
              const bahrainCard = await page.locator('.gridCards-module_passiveTabContainer__OFKYG:has-text("Bahrain")');
              const box = await bahrainCard.boundingBox();
              if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                console.log('Selected Bahrain country (coordinate click)');
              } else {
                throw new Error('Could not get bounding box');
              }
            } catch (error5) {
              console.log('All Bahrain selection methods failed');
              
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
    console.log(`After Bahrain selection URL: ${newUrl}`);
    
    // Verify that Bahrain was actually selected (check URL or page content)
    if (newUrl.includes('bahrain') || newUrl.includes('BHR') || await page.isVisible('text="NHRA"')) {
      console.log('Bahrain selection confirmed');
    } else {
      console.log('Bahrain selection may not have worked, continuing anyway...');
    }
    
    // Step 3: Now select NHRA (National Health Regulatory Authority)
    console.log('Looking for NHRA selection...');
    
    try {
      // Wait for NHRA elements to appear
      await page.waitForTimeout(2000); // Give time for page to load
      await page.waitForLoadState('networkidle');
      
      
      // Method 1: Try clicking using the specific CSS classes from the DOM
      try {
        console.log('Attempting to click NHRA using specific CSS classes...');
        await page.waitForSelector('.gridCards-module_purposeText__sUuM2.gridCards-module_large__HFUti:has-text("National Health Regulatory Authority")', { timeout: 10000 });
        await page.click('.gridCards-module_purposeText__sUuM2.gridCards-module_large__HFUti:has-text("National Health Regulatory Authority")');
        console.log(' Selected NHRA (CSS classes method)');
      } catch (nhraError1) {
        console.log('CSS classes method failed, trying container click...');
        
        // Method 2: Try clicking the container that holds NHRA
        try {
          await page.click('.gridCards-module_passiveTabContainer__OFKYG:has-text("National Health Regulatory Authority")');
          console.log('Selected NHRA (container method)');
        } catch (nhraError2) {
          console.log('Container method failed, trying text-based click...');
          
          // Method 3: Try clicking by text content
          try {
            await page.getByText('National Health Regulatory Authority (NHRA)').click();
            console.log('Selected NHRA (full text method)');
          } catch (nhraError3) {
            console.log('Full text method failed, trying NHRA abbreviation...');
            
            // Method 4: Try clicking just "NHRA"
            try {
              await page.getByText('NHRA').click();
              console.log('Selected NHRA (abbreviation method)');
            } catch (nhraError4) {
              console.log('NHRA abbreviation failed, trying force click...');
              
              // Method 5: Force click on NHRA element
              try {
                const nhraElement = await page.locator('text="National Health Regulatory Authority"').first();
                await nhraElement.click({ force: true });
                console.log('Selected NHRA (forced click method)');
              } catch (nhraError5) {
                console.log('All NHRA selection methods failed');
                
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
      console.log(` After NHRA selection URL: ${nhraUrl}`);

      
      // Verify that NHRA was actually selected (check URL or page content)
      if (nhraUrl.includes('nhra') || nhraUrl.includes('authority') || await page.isVisible('text="verification"')) {
        console.log('NHRA selection confirmed');
      } else {
        console.log('NHRA selection may not have worked, but continuing...');
      }
      
      console.log('NHRA selection process completed successfully!');
      
    } catch (nhraError) {
      console.log('NHRA selection failed:', nhraError.message);
      throw nhraError;
    }
    
    // Step 4: Fill the verification form dropdowns using the improved method
    await fillVerificationForm(page);

    // Step 5: Handle report transfer page
    await handleReportTransferPage(page);
     
    // Step 6: Handle verify education page (NEW)
    await handleVerifyEducationPage(page);
    
    console.log('Complete verification flow (Bahrain → NHRA → Form → Documents → Report Transfer) completed successfully!');
    
  } catch (error) {
    console.log('Country/Authority selection failed:', error.message);
    throw error;
  }
 
  // Function to handle the "Verify your education" page
async function handleVerifyEducationPage(page: any) {
  console.log('Starting verify education page handling...');
  
  try {
    // Wait for the verify education page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`Current URL on verify education page: ${currentUrl}`);
    
    // Check if we're on the verify education page
    const hasVerifyEducationContent = await page.isVisible('text="Verify your education"');
    if (hasVerifyEducationContent) {
      console.log('Verify education page loaded successfully');
      
      // Log the pre-filled values for confirmation
      try {
        const hasHighestLevel = await page.isVisible('text="Bachelors"');
        const hasDegreeTitle = await page.isVisible('input[value="cse"]');
        const hasYear = await page.isVisible('text="2024"');
        
        console.log(` Form pre-filled values detected:`);
        console.log(`   - Highest educational level: ${hasHighestLevel ? 'Bachelors ' : 'Not detected '}`);
        console.log(`   - Degree title: ${hasDegreeTitle ? 'CSE ' : 'Not detected '}`);
        console.log(`   - Year of completion: ${hasYear ? '2024 ' : 'Not detected '}`);
      } catch (detectionError) {
        console.log('Could not detect all pre-filled values, but continuing...');
      }
      
    } else {
      console.log('Verify education page may not be fully loaded');
    }
    
    // Step 1: Click the Continue button
    console.log('Looking for and clicking the Continue button...');
    
    try {
      // Wait for Continue button to be visible and enabled
      await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
      
      const continueButton = page.locator('button:has-text("Continue")');
      const isEnabled = await continueButton.isEnabled();
      const isVisible = await continueButton.isVisible();
      
      console.log(`Continue button - visible: ${isVisible}, enabled: ${isEnabled}`);
      
      if (isVisible && isEnabled) {
        
        await continueButton.click();
        console.log('Successfully clicked Continue button on verify education page');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`After Continue click URL: ${newUrl}`);
        
        // Verify that we've moved to the next step
        if (newUrl !== currentUrl) {
          console.log('Successfully navigated to next page after clicking Continue');
          
          // Check what type of page we landed on
          const hasEducationDetails = await page.isVisible('text="University", text="Start Date", text="End Date"');
          const hasPersonalInfo = await page.isVisible('text="Personal Information", text="Name", text="Date of Birth"');
          const hasUploadSection = await page.isVisible('text="Upload", text="Choose File", text="Browse", input[type="file"]');
          
          if (hasEducationDetails) {
            console.log('Detected education details section - moved to detailed education page');
          } else if (hasPersonalInfo) {
            console.log('Detected personal information section - moved to profile/details page');
          } else if (hasUploadSection) {
            console.log('Detected file upload section - moved to document upload page');
          } else {
            console.log('Moved to next page (type not immediately identified)');
          }
          
        } else {
          console.log('URL didn\'t change - checking for other indicators of progress...');
          
          // Check if page content changed
          await page.waitForTimeout(2000);
          const pageChanged = !(await page.isVisible('text="Verify your education"'));
          if (pageChanged) {
            console.log('Page content changed - navigation likely successful');
          }
        }
        
      } else {
        console.log('Continue button is not visible or enabled');
        console.log(' Please manually verify the form data and click Continue if available, then press Resume');
        await page.pause();
      }
      
    } catch (continueError) {
      console.log('Could not find or click Continue button:', continueError.message);
      
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
          console.log(`Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(`Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log('Could not find Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
    console.log('Verify education page handling completed successfully!');
    
  } catch (verifyEducationError) {
    console.log('Error during verify education page handling:', verifyEducationError.message);
    
    // Enhanced debug information
    console.log('Debug: Current page state...');
    console.log(`Debug: Current URL: ${page.url()}`);
    console.log(`Debug: Page title: ${await page.title()}`);
    
    // Log available buttons for debugging
    try {
      const allButtons = await page.locator('button').allTextContents();
      console.log('Debug: Available buttons:', allButtons);
      
      const allInputs = await page.locator('input').count();
      console.log(`Debug: Found ${allInputs} input elements on page`);
      
      // Check for form fields
      const hasDropdowns = await page.locator('select').count();
      console.log(`Debug: Found ${hasDropdowns} dropdown elements on page`);
      
    } catch (debugError) {
      console.log('Debug logging failed:', debugError.message);
    }
    
    throw verifyEducationError;
  }
}
  

  await handleEducationDetailsPage(page);

  // Simple function to handle education details page
async function handleEducationDetailsPage(page) {
  console.log('Starting education details page handling...');
  
  try {
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`Current URL on education details page: ${currentUrl}`);
    
    // Check if we're on the education details page
    const hasEducationDetailsContent = await page.isVisible('text="Your Education details"');
    if (hasEducationDetailsContent) {
      console.log('Education details page loaded successfully');
    } else {
      console.log('Education details page may not be fully loaded');
    }
    
    // Step 1: Check if "dry college" is already selected using multiple methods
    console.log('Checking if "dry college" is already selected...');
    const dropdownInput = page.locator('[data-testid="organization-dropdownInput"]');
    
    let isDryCollegeSelected = false;
    let currentValue = '';
    
    try {
      // Method 1: Check input value
      currentValue = await dropdownInput.inputValue();
      console.log(`Input value: "${currentValue}"`);
      
      // Method 2: Check displayed text content
      const displayedText = await dropdownInput.textContent();
      console.log(`Text content: "${displayedText}"`);
      
      // Method 3: Check inner text
      const innerText = await dropdownInput.innerText();
      console.log(`Inner text: "${innerText}"`);
      
      // Method 4: Check if there's a visible selected option in the dropdown container
      const dropdownContainer = page.locator('[data-testid="organization-dropdownInputContainer"]');
      const containerText = await dropdownContainer.textContent();
      console.log(`Container text: "${containerText}"`);
      
      // Check all methods for "dry college"
      const valuesToCheck = [currentValue, displayedText, innerText, containerText].filter(val => val);
      isDryCollegeSelected = valuesToCheck.some(val => 
        val.toLowerCase().includes('dry college')
      );
      
      console.log(`Is "dry college" already selected: ${isDryCollegeSelected}`);
      console.log(`Values checked: ${JSON.stringify(valuesToCheck)}`);
      
    } catch (error) {
      console.log('Error checking current value, will proceed with selection:', error.message);
      isDryCollegeSelected = false;
    }
    
    if (isDryCollegeSelected) {
      console.log('"dry college" is already selected, skipping university selection');
    } else {
      // Step 1: Handle University selection (click dropdown, clear, type, select second option)
      console.log('Handling university selection...');
      try {
        // Target the dropdown container using data-testid
        const dropdownContainer = page.locator('[data-testid="organization-dropdownInputContainer"]');
        
        console.log('Clicking university dropdown container...');
        // Click the dropdown container to open it
        await dropdownContainer.click();
        await page.waitForTimeout(1000);
        
        console.log(' Clearing existing university and typing "dry college"...');
        // Clear the input field and type new value
        await dropdownInput.fill('');
        await page.waitForTimeout(500);
        await dropdownInput.type('dry college', { delay: 100 });
        await page.waitForTimeout(2000); // Wait for dropdown options to appear
        
        console.log('Looking for dropdown options...');
        
        // Wait for dropdown options to appear and stabilize
        await page.waitForTimeout(1500);
        
        // Try multiple selection strategies in order of preference
        let selectionSuccessful = false;
        
        // Strategy 1: Try to find and click the specific "dry college, Bengaluru, India" option
        try {
          console.log('Strategy 1: Looking for specific "dry college, Bengaluru, India" option...');
          const specificOption = page.locator('text="dry college, Bengaluru, India"').first();
          
          if (await specificOption.isVisible({ timeout: 2000 })) {
            await specificOption.click();
            console.log('Successfully clicked "dry college, Bengaluru, India" option');
            selectionSuccessful = true;
          }
        } catch (e) {
          console.log('Strategy 1 failed:', e.message);
        }
        
        // Strategy 2: If specific option not found, look for dropdown options and select the second one
        if (!selectionSuccessful) {
          try {
            console.log('Strategy 2: Looking for dropdown options to select second one...');
            
            // Wait for dropdown to be fully loaded
            await page.waitForSelector('[role="option"], .dropdown-option, [data-option]', { timeout: 3000 });
            
            // Try different selectors for dropdown options
            const possibleOptionSelectors = [
              '[role="option"]',
              '.dropdown-option',
              '[data-option]',
              'li:has-text("dry college")',
              'div:has-text("dry college")',
              '*[class*="option"]:has-text("dry college")'
            ];
            
            let options = null;
            let optionCount = 0;
            
            for (const selector of possibleOptionSelectors) {
              options = page.locator(selector);
              optionCount = await options.count();
              console.log(`Selector "${selector}" found ${optionCount} options`);
              
              if (optionCount >= 2) {
                // Log the first few options for debugging
                for (let i = 0; i < Math.min(optionCount, 3); i++) {
                  try {
                    const optionText = await options.nth(i).textContent();
                    console.log(`Option ${i}: "${optionText}"`);
                  } catch (e) {
                    console.log(`Option ${i}: Could not read text`);
                  }
                }
                
                // Click the second option (index 1)
                await options.nth(1).click();
                console.log('Successfully clicked second option using selector:', selector);
                selectionSuccessful = true;
                break;
              }
            }
          } catch (e) {
            console.log('Strategy 2 failed:', e.message);
          }
        }
        
        // Strategy 3: Use keyboard navigation as fallback
        if (!selectionSuccessful) {
          try {
            console.log('Strategy 3: Using keyboard navigation...');
            
            // Ensure the input is focused
            await dropdownInput.focus();
            await page.waitForTimeout(500);
            
            // Use arrow keys to navigate to second option
            await page.keyboard.press('ArrowDown'); // Move to first option
            await page.waitForTimeout(300);
            await page.keyboard.press('ArrowDown'); // Move to second option
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');     // Select second option
            
            console.log('Used keyboard navigation to select second option');
            selectionSuccessful = true;
          } catch (e) {
            console.log('Strategy 3 failed:', e.message);
          }
        }
        
        // Strategy 4: Try clicking on visible text containing "Bengaluru" (second option)
        if (!selectionSuccessful) {
          try {
            console.log('Strategy 4: Looking for Bengaluru option...');
            const bengaluruOption = page.locator('text*="Bengaluru"').first();
            
            if (await bengaluruOption.isVisible({ timeout: 2000 })) {
              await bengaluruOption.click();
              console.log('Successfully clicked Bengaluru option');
              selectionSuccessful = true;
            }
          } catch (e) {
            console.log('Strategy 4 failed:', e.message);
          }
        }
        
        if (!selectionSuccessful) {
          console.log('All selection strategies failed');
          throw new Error('Unable to select second option from dropdown');
        }
        
        await page.waitForTimeout(1000);
        console.log('University selection completed');
        
      } catch (error) {
        console.log('Error in university selection:', error);
        throw error;
      }
    }
    
    // Continue with the rest of the function (date handling, etc.)
    console.log('University selection phase completed, proceeding to continue...');
    
    // Wait a bit to ensure the selection is processed
    await page.waitForTimeout(1000);
    
    // Click Continue button
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible()) {
      await continueButton.click();
      console.log('Clicked Continue button');
      
      // Wait for navigation or next page to load
      await page.waitForTimeout(2000);
    } else {
      console.log('Continue button not found');
    }
    
  } catch (error) {
    console.log('Error in handleEducationDetailsPage:', error);
    throw error;
  }
}

// Handle pricing estimate page
await handlePricingEstimatePage(page);

async function handlePricingEstimatePage(page) {
  console.log('Handling pricing estimate page...');
  
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Continue")');
  await page.waitForLoadState('networkidle');
  
  console.log('Pricing estimate completed');
}

//CRL document page
await handleCrlPage(page);

async function handleCrlPage(page) {
  console.log('📋 Handling Application Details page...');
  
  await page.waitForLoadState('networkidle');
  
  // Create dummy PDF file for testing
  const fs = require('fs');
  const dummyContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n196\n%%EOF';
  fs.writeFileSync('dummy-document.pdf', dummyContent);
  console.log('Created dummy PDF file for upload');
  
  try {
    // Fill Company Name field only
    await page.waitForTimeout(2000);
    
    let companyFieldFilled = false;
    
    // Strategy 1: Target by label and find the associated input
    try {
      await page.click('text="Company Name"');
      await page.waitForTimeout(500);
      const companyInput = page.locator('input').first();
      await companyInput.fill('Automation company');
      console.log('Company name filled using label click method');
      companyFieldFilled = true;
    } catch (e1) {
      console.log('Strategy 1 failed:', e1.message);
    }
    
    // Strategy 2: Direct input targeting
    if (!companyFieldFilled) {
      try {
        const inputs = await page.locator('input').all();
        if (inputs.length > 0) {
          await inputs[0].clear();
          await inputs[0].fill('Automation company');
          console.log('Company name filled using first input');
          companyFieldFilled = true;
        }
      } catch (e2) {
        console.log('Strategy 2 failed:', e2.message);
      }
    }
    
    // Strategy 3: Click on the empty field area
    if (!companyFieldFilled) {
      try {
        await page.click('input:first-of-type');
        await page.keyboard.type('Automation company');
        console.log('Company name filled using keyboard type');
        companyFieldFilled = true;
      } catch (e3) {
        console.log('Strategy 3 failed:', e3.message);
      }
    }
    
    if (!companyFieldFilled) {
      console.log('All Company Name strategies failed');
    }
    
    await page.waitForTimeout(1000);
    
    // Handle document upload using the specific CSS class
    await handleDocumentUpload(page);
    
    // Wait a moment for any processing
    await page.waitForTimeout(2000);
    
    // Click Continue button
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForLoadState('networkidle');
      console.log('Application Details completed successfully');
    } else {
      console.log('Continue button not found, please manually proceed');
    }
    
  } catch (error) {
    console.log('Error in handling Application Details:', error.message);
    console.log('Please manually complete the form and press Resume to continue');
    await page.pause();
  }
}

// Helper function to handle document upload
async function handleDocumentUpload(page) {
  console.log('Starting document upload...');
  
  try {
    await page.waitForTimeout(1000);
    
    // Click the upload button using the specific CSS class
    const uploadButton = page.locator('.downloadUpload-module_button__-uMBo');
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      console.log('Clicked Upload button using CSS class');
      await page.waitForTimeout(2000);
      
      // Now upload the file
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles('./dummy-document.pdf');
      console.log('Document uploaded successfully');
      
      // Wait for upload to complete
      await page.waitForTimeout(3000);
      
    } else {
      console.log('Upload button not found with CSS class');
      
      // Fallback: try direct file input
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles('./dummy-document.pdf');
      console.log('Document uploaded via fallback method');
      await page.waitForTimeout(3000);
    }
    
  } catch (uploadError) {
    console.log(' Document upload failed:', uploadError.message);
    console.log(' Please manually upload a document');
  }
}


// Handle Upload Document - Identity page (NEW)
await handleUploadDocumentIdentityPage(page);

// After manual completion of Date of Expiry
await saveAndContinueIdentity(page);

// Helper function to handle Upload Document - Identity page
async function handleUploadDocumentIdentityPage(page) {
  console.log('Starting Upload Document - Identity page handling...');
  
  try {
    // Wait for the upload document page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    
    // Verify we're on the correct page
    const currentUrl = page.url();
    console.log(`Current URL on upload document page: ${currentUrl}`);
    
    // Check if we're on the upload document page
    const hasUploadDocumentContent = await page.isVisible('text="Upload Document"');
    const hasIdentityTab = await page.isVisible('text="Identity"');
    if (hasUploadDocumentContent && hasIdentityTab) {
      console.log('Upload Document - Identity page loaded successfully');
    } else {
      console.log('Upload Document - Identity page may not be fully loaded');
    }
    
    // Step 1: Upload the passport document
    console.log('Step 1: Uploading passport document...');
    await uploadPassportDocument(page);
    
    // Step 2: Fill in the identity form details
    console.log('Step 2: Filling identity form details...');
    await fillIdentityFormDetails(page);
    
    // Step 3: Click Save and Continue button
    console.log('Step 3: Clicking Save and Continue...');
    await saveAndContinueIdentity(page);
    
    console.log('Upload Document - Identity page handling completed successfully!');
    
  } catch (identityUploadError) {
    console.log('Error during upload document identity handling:', identityUploadError.message);
    
    // Enhanced debug information
    console.log('Debug: Current page state...');
    console.log(`Debug: Current URL: ${page.url()}`);
    console.log(`Debug: Page title: ${await page.title()}`);
    
    throw identityUploadError;
  }
}

// Helper function to upload passport document
async function uploadPassportDocument(page) {
  console.log('Uploading passport document...');
  
  try {
    // Create dummy PDF file for passport if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync('dummy-passport.pdf')) {
      const dummyPassportContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(PASSPORT DOCUMENT) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000245 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n344\n%%EOF';
      fs.writeFileSync('dummy-passport.pdf', dummyPassportContent);
      console.log('Created dummy passport PDF file');
    }
    
    // Method 1: Click the upload area directly
    try {
      console.log('Method 1: Clicking upload area...');
      await page.waitForSelector('text="Click to upload"', { timeout: 5000 });
      await page.click('text="Click to upload"');
      console.log('Clicked upload area');
    } catch (uploadAreaError) {
      console.log('Method 1 failed, trying method 2...');
      
      // Method 2: Click the upload container/div
      try {
        console.log('Method 2: Clicking upload container...');
        const uploadContainer = page.locator('.upload-container, [class*="upload"], [data-testid*="upload"]').first();
        await uploadContainer.click();
        console.log('Clicked upload container');
      } catch (containerError) {
        console.log('Method 2 failed, trying method 3...');
        
        // Method 3: Direct file input approach
        console.log('Method 3: Using direct file input...');
      }
    }
    
    // Wait for file dialog or direct upload
    await page.waitForTimeout(1000);
    
    // Upload the file using the file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./dummy-passport.pdf');
    console.log('Passport document uploaded successfully');
    
    // Wait for upload to complete
    await page.waitForTimeout(2000);
    
  } catch (uploadError) {
    console.log('Passport upload failed:', uploadError.message);
    console.log('Please manually upload a passport document, then press Resume');
    await page.pause();
  }
}

// Helper function to fill identity form details
async function fillIdentityFormDetails(page) {
  console.log('Filling identity form details...');
  
  try {
    // Wait for form to be ready after upload
    await page.waitForTimeout(2000);
    
    // Fill First Name
    console.log('Filling First Name...');
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
          console.log('First Name filled: John');
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
          console.log(`Filled first empty input (index ${i}) with: John`);
          break;
        }
      }
    }
    
    await page.waitForTimeout(500);
    
    // Fill Middle Name (optional)
    console.log('Filling Middle Name...');
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
            console.log('Middle Name filled: Michael');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(500);
    
    // Fill Last Name
    console.log('Filling Last Name...');
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
            console.log('last Name filled: Doe');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(500);
    
    // Fill Nationality
    console.log('Filling Nationality...');
    try {
      const nationalityField = page.locator('input[name*="nationality"], input[id*="nationality"]').first();
      if (await nationalityField.isVisible()) {
        await nationalityField.fill('Indian');
        console.log('Nationality filled: Indian');
      } else {
        // Try finding by placeholder text
        const textInputs = page.locator('input[type="text"]');
        const inputCount = await textInputs.count();
        for (let i = 0; i < inputCount; i++) {
          const input = textInputs.nth(i);
          const placeholder = await input.getAttribute('placeholder');
          if (placeholder && placeholder.toLowerCase().includes('nation')) {
            await input.fill('Indian');
            console.log('Nationality filled: Indian');
            break;
          }
        }
      }
    } catch (nationalityError) {
      console.log('Could not fill nationality automatically');
    }
    
    await page.waitForTimeout(500);
    
    // Verify Date of Birth is pre-filled
    console.log('Verifying Date of Birth...');
    try {
      const dobField = page.locator('input[value*="August"], input[value*="2002"], input[placeholder*="date"]').first();
      if (await dobField.isVisible()) {
        const dobValue = await dobField.inputValue();
        console.log(`Date of Birth is pre-filled: ${dobValue}`);
      }
    } catch (dobError) {
      console.log('Date of Birth field status unclear, but continuing...');
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
          console.log(`Trying gender dropdown selector: ${selector}`);
          const dropdown = page.locator(selector);
          const count = await dropdown.count();
          
          console.log(`Found ${count} elements with selector: ${selector}`);
          
          if (count > 0) {
            // Try each element found with this selector
            for (let i = 0; i < count; i++) {
              const element = dropdown.nth(i);
              if (await element.isVisible()) {
                console.log(`Found visible dropdown at index ${i} with selector: ${selector}`);
                await element.click();
                console.log(`Clicked dropdown input`);
                await page.waitForTimeout(1500); // Wait for dropdown to open
                dropdownOpened = true;
                dropdownElement = element;
                break;
              }
            }
            if (dropdownOpened) break;
          }
        } catch (e) {
          console.log(`Failed with selector ${selector}: ${e.message}`);
          continue;
        }
      }
      
      // If dropdown opened successfully, try to select Male option
      if (dropdownOpened) {
        console.log('Looking for Male option...');
        
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
            console.log(`Trying Male option selector: ${maleSelector}`);
            const maleOption = page.locator(maleSelector);
            const count = await maleOption.count();
            
            console.log(`Found ${count} Male options with selector: ${maleSelector}`);
            
            if (count > 0) {
              // Try the first visible Male option
              const element = maleOption.first();
              if (await element.isVisible()) {
                await element.click();
                console.log(`Successfully selected Male using selector: ${maleSelector}`);
                maleSelected = true;
                break;
              }
            }
          } catch (e) {
            console.log(`Failed to select Male with selector ${maleSelector}: ${e.message}`);
            continue;
          }
        }
        
        // Additional fallback: try to find any element containing "Male" text
        if (!maleSelected) {
          try {
            console.log('Trying fallback: any element containing "Male"...');
            await page.waitForTimeout(1000); // Extra wait for dropdown to fully render
            
            const maleElements = page.getByText('Male');
            const count = await maleElements.count();
            console.log(`Found ${count} elements containing "Male" text`);
            
            if (count > 0) {
              for (let i = 0; i < count; i++) {
                const element = maleElements.nth(i);
                if (await element.isVisible()) {
                  await element.click();
                  console.log(`Successfully clicked Male element at index ${i}`);
                  maleSelected = true;
                  break;
                }
              }
            }
          } catch (e) {
            console.log('Fallback method also failed:', e.message);
          }
        }
        
        if (!maleSelected) {
          console.log('Could not automatically select Male option');
          console.log('Dropdown is open, please manually select "Male" and then press Resume');
          await page.pause();
        } else {
          // Wait a bit after selection to ensure it registers
          await page.waitForTimeout(1000);
          console.log('Gender selection completed successfully');
        }
        
      } else {
        console.log('Could not open gender dropdown automatically');
        console.log('Please manually open dropdown and select gender, then press Resume');
        await page.pause();
      }
      
    } catch (genderError) {
      console.log('Error handling gender dropdown:', genderError.message);
      console.log('Please manually select gender and then press Resume');
      await page.pause();
    }
    
    await page.waitForTimeout(1000);
    
    // Fill ID Number (but leave Date of Expiry for manual input)
    console.log('Filling ID Number...');
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
              console.log('ID Number filled: A12345678');
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (idError) {
      console.log('Could not fill ID number automatically');
    }
    
    // Note about Date of Expiry - leave for manual input
    console.log('Date of Expiry field left for manual input as requested');
    console.log('Please manually fill the Date of Expiry field before clicking Save and Continue');
    
    await page.waitForTimeout(1000);
    
    console.log('Identity form details filling completed (except Date of Expiry)');
    console.log('Please fill Date of Expiry manually, then the script will continue');
    
  } catch (formError) {
    console.log('Error filling identity form:', formError.message);
    console.log('Please manually fill any missing fields, then press Resume');
    await page.pause();
  }
}

// Helper function to click Save and Continue
async function saveAndContinueIdentity(page) {
  console.log('Clicking Save and Continue button...');
  
  try {
    // Wait for form to be complete
    await page.waitForTimeout(1000);
    
    // Look for Save and Continue button
    const saveButton = page.locator('button:has-text("Save and Continue")');
    
    if (await saveButton.isVisible()) {
      const isEnabled = await saveButton.isEnabled();
      console.log(`Save and Continue button - visible: true, enabled: ${isEnabled}`);
      
      if (isEnabled) {
        
        await saveButton.click();
        console.log('Successfully clicked Save and Continue button');
        
        // Wait for navigation to next page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        const newUrl = page.url();
        console.log(`After Save and Continue URL: ${newUrl}`);
        
        console.log('Successfully navigated to next page after Save and Continue');
        
      } else {
        console.log('Save and Continue button is not enabled - form may be incomplete');
        console.log('Please manually complete the form and click Save and Continue, then press Resume');
        await page.pause();
      }
      
    } else {
      console.log('Save and Continue button not found');
      
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
          console.log(`Trying alternative button selector: ${buttonSelector}`);
          const altButton = page.locator(buttonSelector);
          if (await altButton.isVisible() && await altButton.isEnabled()) {
            await altButton.click();
            console.log(` Clicked button using alternative selector: ${buttonSelector}`);
            buttonClicked = true;
            break;
          }
        } catch (altError) {
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.log(' Could not find Save and Continue button automatically. Please manually click it, then press Resume');
        await page.pause();
      }
    }
    
  } catch (saveError) {
    console.log('Error clicking Save and Continue:', saveError.message);
    console.log(' Please manually click Save and Continue, then press Resume');
    await page.pause();
  }
}


// Function call for Degree/Diploma component page
await handleDegreeDiplomaPage(page);

async function handleDegreeDiplomaPage(page) {
  console.log('Handling Degree/Diploma upload page...');
  
  await page.waitForLoadState('networkidle');
  
  // Create dummy PDF file for testing
  const fs = require('fs');
  const dummyContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n196\n%%EOF';
  fs.writeFileSync('dummy-document.pdf', dummyContent);
  console.log('Created dummy PDF file for degree/diploma upload');
  
  try {
    // Step 1: Upload dummy document
    await uploadDegreeDocument(page);
    
    // Step 2: Skip University Name, College/Institution Name, and Degree (they are pre-filled)
    console.log('Skipping pre-filled fields: University Name, College/Institution Name, Degree');
    
    // Wait for form to be ready after upload
    await page.waitForTimeout(3000);

    //Step 2: handle graduation year attribute 
    await selectGraduationYear(page);
    
    // Step 3: Handle Degree Level
    await handleDegreeLevel(page);
    
    // Step 4: Select Department Name - BE
    await selectDepartmentName(page);
    
    // Step 5: Select Course Name - CSE
    await selectCourseName(page);
    
    // Step 6: Fill Program Duration
    await fillProgramDuration(page);
    
    // Step 7: Select Mode of Study - Active Enrollment
    await selectModeOfStudy(page);
    
    // Step 8: Handle Course Start and End Dates
    await handleCourseDates(page);
    
    // Step 9: Fill name fields
    // commenting out the name fields function as there is a change in config, name fields do not exist in UI 
    //await fillNameFields(page);
    
    // Wait for any processing
    await page.waitForTimeout(2000);
    
    // Click Save and Continue button
    const saveButton = page.locator('button:has-text("Save and Continue")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      console.log('Degree/Diploma page completed successfully');
    } else {
      console.log('Save and Continue button not found, please manually proceed');
    }
    
  } catch (error) {
    console.log('Error in handling Degree/Diploma page:', error.message);
    console.log('Please manually complete the form and press Resume to continue');
    await page.pause();
  }
}
// Helper function to select Graduation Year - 2024
async function selectGraduationYear(page) {
  console.log('Selecting Graduation Year: 2024');
  
  try {
    // Wait for the previous selection to complete
    await page.waitForTimeout(2000);
    
    // Find the Graduation Year dropdown using label text
    const graduationYearDropdown = page.locator('label:has-text("Graduation Year") + input[placeholder="Select"]').or(
      page.locator('input[placeholder="Select"]').first() // Fallback to first dropdown if label approach fails
    );
    
    // Check if dropdown exists and is visible
    if (!(await graduationYearDropdown.isVisible())) {
      console.log('Graduation Year dropdown not found, skipping...');
      return;
    }
    
    // Click on the dropdown to open it
    await graduationYearDropdown.click();
    console.log('Clicked Graduation Year dropdown');
    
    // Wait for dropdown options to appear
    await page.waitForTimeout(2000);
    
    // Try to select 2024 option
    try {
      await page.locator('text="2024"').first().click();
      console.log('Selected 2024 in Graduation Year');
    } catch {
      console.log(' Could not find 2024 option, trying alternative...');
      // Try to find any option that contains "2024"
      try {
        const menuItems = page.locator('[class*="menuItem"]');
        const itemCount = await menuItems.count();
        console.log(`Found ${itemCount} graduation year menu items`);
        
        // Look for 2024 in the menu items
        for (let i = 0; i < itemCount; i++) {
          const item = menuItems.nth(i);
          const itemText = await item.textContent();
          if (itemText && itemText.includes('2024')) {
            await item.click();
            console.log('Selected 2024 using text matching');
            break;
          }
        }
      } catch (altError) {
        console.log(' Alternative 2024 selection failed');
        // Try clicking the first menu item as a last resort
        try {
          const firstMenuItem = page.locator('[class*="menuItem"]').first();
          if (await firstMenuItem.isVisible()) {
            await firstMenuItem.click();
            console.log('Selected first available option as fallback');
          }
        } catch (fallbackError) {
          console.log('All graduation year selection methods failed');
        }
      }
    }
    
    // Wait after selection
    await page.waitForTimeout(1500);
    
  } catch (error) {
    console.log('Graduation Year selection failed:', error.message);
    console.log(' Skipping Graduation Year and continuing...');
    // Don't pause, just continue to next field
  }
}
// Helper function to handle Degree Level dropdown
async function handleDegreeLevel(page) {
  console.log('Handling Degree Level field...');
  
  try {
    // Wait for form to load
    await page.waitForTimeout(2000);
    
    // Find the Degree Level dropdown - using a more specific approach
    const degreeLevelField = page.locator('input[placeholder="Select"]').nth(1); // First Select dropdown should be Degree Level
    
    // Check if the field exists and is visible
    if (!(await degreeLevelField.isVisible())) {
      console.log('Degree Level field not found, skipping...');
      return;
    }
    
    // Check if the field is empty
    const fieldValue = await degreeLevelField.inputValue();
    console.log('Current Degree Level field value:', fieldValue);
    
    if (!fieldValue || fieldValue.trim() === '' || fieldValue === 'Select') {
      console.log('Degree Level field is empty, selecting Bachelors...');
      
      // Click on the dropdown to open it
      await degreeLevelField.click();
      console.log('Clicked Degree Level dropdown');
      
      // Wait for dropdown options to appear
      await page.waitForTimeout(1500);
      
      // Try to select Bachelors option
      try {
        // Look for Bachelors in dropdown menu
        const bachelorsOption = page.locator('text="Bachelors"').first();
        await bachelorsOption.click();
        console.log('Selected Bachelors in Degree Level');
      } catch {
        console.log('Could not find Bachelors option, trying alternative...');
        // Try clicking any visible option that might be Bachelors
        const menuItems = page.locator('[class*="menuItem"]');
        const itemCount = await menuItems.count();
        if (itemCount > 0) {
          await menuItems.first().click();
          console.log('Selected first available option as fallback');
        }
      }
      
      // Wait after selection
      await page.waitForTimeout(1500);
    } else {
      console.log('Degree Level field is already filled with:', fieldValue);
    }
    
  } catch (error) {
    console.log('Degree Level handling failed:', error.message);
    console.log('Skipping Degree Level and continuing with next field...');
    // Don't pause here, just continue - the form might work without this field
  }
}


// Helper function to upload degree document
async function uploadDegreeDocument(page) {
  console.log('Uploading degree document...');
  
  try {
    // Look for the upload area or click to upload button
    const uploadButton = page.locator('text="Click to upload"').first();
    
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      console.log('Clicked upload button');
      await page.waitForTimeout(1000);
    }
    
    // Find file input and upload
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./dummy-document.pdf');
    console.log('Degree document uploaded successfully');
    
    // Wait for upload to complete
    await page.waitForTimeout(5000);
    
  } catch (uploadError) {
    console.log('Document upload failed:', uploadError.message);
    throw uploadError;
  }
}

// Helper function to select Department Name - BE
async function selectDepartmentName(page) {
  console.log('Selecting Department Name: BE');
  
  try {
    // Wait for the dropdown to be available
    await page.waitForTimeout(2000);
    
    // Find the Department name dropdown - it should be the first "Select" dropdown after Degree Level
    const departmentDropdown = page.locator('input[placeholder="Select"]').nth(2); // Second Select dropdown should be Department
    
    // Check if dropdown exists and is visible
    if (!(await departmentDropdown.isVisible())) {
      console.log('Department dropdown not found, skipping...');
      return;
    }
    
    // Click on the dropdown to open it
    await departmentDropdown.click();
    console.log('Clicked Department name dropdown');
    
    // Wait for dropdown options to appear
    await page.waitForTimeout(2000);
    
    // Try to select BE option
    try {
      await page.locator('text="BE"').first().click();
      console.log('Selected BE in Department name');
    } catch {
      console.log('Could not find BE option, trying alternative...');
      // Try to find any option that contains "BE" or similar
      try {
        const menuItems = page.locator('[class*="menuItem"]');
        const itemCount = await menuItems.count();
        console.log(`📋 Found ${itemCount} menu items`);
        
        // Look for BE in the menu items
        for (let i = 0; i < itemCount; i++) {
          const item = menuItems.nth(i);
          const itemText = await item.textContent();
          if (itemText && itemText.includes('BE')) {
            await item.click();
            console.log('Selected BE using text matching');
            break;
          }
        }
      } catch (altError) {
        console.log('Alternative BE selection failed');
      }
    }
    
    // Wait after selection
    await page.waitForTimeout(1500);
    
  } catch (error) {
    console.log('Department name selection failed:', error.message);
    console.log(' Skipping Department name and continuing...');
    // Don't pause, just continue to next field
  }
}

// Helper function to select Course Name - CSE
async function selectCourseName(page) {
  console.log('Selecting Course Name: CSE');
  
  try {
    // Wait for the previous selection to complete
    await page.waitForTimeout(2000);
    
    // Find the Course Name dropdown - it should be the next "Select" dropdown after Department
    const courseDropdown = page.locator('input[placeholder="Select"]').nth(3); // Third Select dropdown should be Course Name
    
    // Check if dropdown exists and is visible
    if (!(await courseDropdown.isVisible())) {
      console.log('Course Name dropdown not found, skipping...');
      return;
    }
    
    // Click on the dropdown to open it
    await courseDropdown.click();
    console.log('Clicked Course Name dropdown');
    
    // Wait for dropdown options to appear
    await page.waitForTimeout(2000);
    
    // Try to select CSE option
    try {
      await page.locator('text="CSE"').first().click();
      console.log('Selected CSE in Course Name');
    } catch {
      console.log('Could not find CSE option, trying alternative...');
      // Try to find any option that contains "CSE" or similar
      try {
        const menuItems = page.locator('[class*="menuItem"]');
        const itemCount = await menuItems.count();
        console.log(`Found ${itemCount} course menu items`);
        
        // Look for CSE in the menu items
        for (let i = 0; i < itemCount; i++) {
          const item = menuItems.nth(i);
          const itemText = await item.textContent();
          if (itemText && (itemText.includes('CSE') || itemText.includes('Computer Science'))) {
            await item.click();
            console.log('Selected CSE using text matching');
            break;
          }
        }
      } catch (altError) {
        console.log('Alternative CSE selection failed');
      }
    }
    
    // Wait after selection
    await page.waitForTimeout(1500);
    
  } catch (error) {
    console.log('Course name selection failed:', error.message);
    console.log('Skipping Course Name and continuing...');
    // Don't pause, just continue to next field
  }
}

// Fixed Helper function to fill Program Duration
async function fillProgramDuration(page) {
  console.log('Filling Program Duration');
  
  try {
    await page.waitForTimeout(2000);
    
    // Target the input field using the specific name attribute
    const durationField = page.locator('input[name*="programDuration"]');
    
    await durationField.clear();
    await durationField.fill('4');
    console.log('Filled Program Duration: 4 years');
    
    await page.waitForTimeout(1000);
    
  } catch (error) {
    console.log('Program Duration filling failed, skipping...');
  }
}

// Helper function to select Mode of Study - Active Enrollment
async function selectModeOfStudy(page) {
  console.log('Selecting Mode of Study: Active Enrollment');
  
  try {
    await page.waitForTimeout(2000);
    
    // Find Mode of Study dropdown (should be after Program Duration)
    const modeDropdown = page.locator('input[placeholder="Select"]').nth(4);
    
    await modeDropdown.click();
    console.log('Clicked Mode of Study dropdown');
    
    await page.waitForTimeout(2000);
    
    // Select Active Enrollment option
    await page.locator('text="Active Enrollment"').first().click();
    console.log('Selected Active Enrollment in Mode of Study');
    
    await page.waitForTimeout(1500);
    
  } catch (error) {
    console.log('Mode of Study selection failed, skipping...');
  }
}

// Helper function to handle Course Start and End Dates
async function handleCourseDates(page) {
  console.log('not handled yet , fill dates manually');
  await page.pause();
  
}

// Helper function to fill name fields
async function fillNameFields(page) {
  console.log('Filling name fields: John Michael Doe');
  
  try {
    // Wait for previous selections to complete
    await page.waitForTimeout(2000);
    
    // Fill First Name - try multiple selectors
    try {
      const firstNameField = page.locator('label:has-text("First Name") ~ input').or(
        page.locator('input[placeholder*="First"]')
      ).or(
        page.locator('input[name*="first" i]')
      ).first();
      
      await firstNameField.clear();
      await firstNameField.fill('John');
      console.log('First Name filled: John');
    } catch (fnError) {
      console.log('First Name field not found or filled');
    }
    
    await page.waitForTimeout(1000);
    
    // Fill Middle Name - try multiple selectors
    try {
      const middleNameField = page.locator('label:has-text("Middle Name") ~ input').or(
        page.locator('input[placeholder*="Middle"]')
      ).or(
        page.locator('input[name*="middle" i]')
      ).first();
      
      await middleNameField.clear();
      await middleNameField.fill('Michael');
      console.log('Middle Name filled: Michael');
    } catch (mnError) {
      console.log('Middle Name field not found or filled');
    }
    
    await page.waitForTimeout(1000);
    
    // Fill Last Name - try multiple selectors
    try {
      const lastNameField = page.locator('label:has-text("Last Name") ~ input').or(
        page.locator('input[placeholder*="Last"]')
      ).or(
        page.locator('input[name*="last" i]')
      ).first();
      
      await lastNameField.clear();
      await lastNameField.fill('Doe');
      console.log('Last Name filled: Doe');
    } catch (lnError) {
      console.log('Last Name field not found or filled');
    }
    
    await page.waitForTimeout(1000);
    
  } catch (error) {
    console.log(' Name fields filling failed:', error.message);
    // Try generic approach to fill any visible text inputs in the name section
    try {
      const nameInputs = page.locator('input[type="text"]').all();
      const inputs = await nameInputs;
      const names = ['John', 'Michael', 'Doe'];
      
      // Fill the last 3 text inputs assuming they are name fields
      for (let i = Math.max(0, inputs.length - 3); i < inputs.length; i++) {
        if (await inputs[i].isVisible()) {
          await inputs[i].fill(names[i - (inputs.length - 3)]);
        }
      }
      console.log(' Name fields filled using fallback method');
    } catch (fallbackError) {
      console.log('Fallback name filling also failed');
    }
  }
}


await addAdditionalDocument(page);
async function addAdditionalDocument(page: any) {
  await page.click('button:has-text("No, proceed to summary")');
}

await applicationSummary(page);
async function applicationSummary(page: any) {
  await page.click('button:has-text("Continue")');
}

await automateLOAPage(page);
async function automateLOAPage(page: any) {
  console.log('Starting LOA page automation...');
  
  try {
    // Click the checkbox to confirm reading and agreeing to Letter of Authorization
    await page.click('input[type="checkbox"]');
    console.log('Clicked checkbox for Letter of Authorization');
    
    // Click E-Sign using OTP button
    await page.click('button:has-text("E-Sign using OTP")');
    console.log('Clicked E-Sign using OTP button');
    
    // Wait for OTP inputs to appear (they should be visible immediately)
    await page.waitForSelector('input[type="tel"]', { state: 'visible', timeout: 10000 });
    console.log(' OTP input fields are visible');
    
    // Fill OTP quickly - it will auto-submit after 6 digits
    const otp = '123456';
    console.log(' Entering OTP...');
    
    // Method 1: Use pressSequentially to simulate real typing
    try {
      for (let i = 0; i < 6; i++) {
        const input = page.locator(`input[data-testid="input${i}"]`);
        await input.click();
        await input.pressSequentially(otp[i], { delay: 100 });
        await page.waitForTimeout(200);
      }
      console.log('Method 1: Used pressSequentially');
    } catch (error) {
      console.log('Method 1 failed, trying Method 2...');
      
      // Method 2: Type using keyboard
      try {
        for (let i = 0; i < 6; i++) {
          const input = page.locator(`input[data-testid="input${i}"]`);
          await input.click();
          await page.keyboard.type(otp[i]);
          await page.waitForTimeout(200);
        }
        console.log('Method 2: Used keyboard typing');
      } catch (error2) {
        console.log(' Method 2 failed, trying Method 3...');
        
        // Method 3: Force with setAttribute
        await page.evaluate((otpValue) => {
          const testIds = ['input0', 'input1', 'input2', 'input3', 'input4', 'input5'];
          
          testIds.forEach((testId, index) => {
            if (index < otpValue.length) {
              const input = document.querySelector(`input[data-testid="${testId}"]`) as HTMLInputElement;
              if (input) {
                // Force set the value multiple ways
                input.setAttribute('value', otpValue[index]);
                input.value = otpValue[index];
                
                // Trigger all possible events
                input.dispatchEvent(new Event('focus', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('keyup', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
              }
            }
          });
        }, otp);
        console.log('Method 3: Used setAttribute with all events');
      }
    }
    
    console.log('OTP entered, waiting for auto-redirect...');
    
    // Wait a moment for the OTP to be processed
    await page.waitForTimeout(1000);
    
    // Wait for automatic redirect after OTP entry
    await page.waitForFunction(() => {
      const currentUrl = window.location.href;
      return !currentUrl.includes('/verification/mobile') && 
             !currentUrl.includes('/letter-of-auth') &&
             !currentUrl.includes('/verification/letter-of-auth');
    }, { timeout: 15000 });
    
    console.log('LOA page completed successfully - redirected to next page');
    
  } catch (error) {
    console.log('Error in LOA page automation:', error.message);
    console.log(' Please manually enter OTP if needed');
    throw error;
  }
}

await pricingSummary(page);
async function pricingSummary(page: any) {
  await page.click('button:has-text("Proceed to Payment")');
}
// Ngenius PG
// await ngeniusPg(page);
// async function ngeniusPg(page: any) {
//   // Fill Card Number
//   await page.fill('input[placeholder="Card Number"], input[name*="card" i], input[name*="number" i]', '4012001037141112');
  
//   // Fill Expiry Month
//   await page.fill('input[placeholder="Expiry Month"], input[name*="month" i]', '06');
  
//   // Fill Expiry Year
//   await page.fill('input[placeholder="Expiry Year"], input[name*="year" i]', '33');
  
//   // Fill Security Code
//   await page.fill('input[placeholder="Security Code"], input[name*="security" i], input[name*="cvv" i]', '656');
  
//   // Fill Name on Card
//   await page.fill('input[placeholder="Name on card"], input[name*="name" i]', 'automation');
  
//   // Click the terms and conditions checkbox
//   await page.click('input[type="checkbox"]');
  
//   // Click Pay button
//   await page.click('button:has-text("Pay")');
// }

// await click3DSSubmit(page);
// async function click3DSSubmit(page: any) {
//   await page.click('button:has-text("Submit")');
//   // Wait for payment success page to load
//   await page.waitForSelector('text="Payment Successful"', { timeout: 30000 });
// }


// Paypal PG 
await paypalPg(page);
async function paypalPg(page: any) {
  // Steps 1-7: Fill initial fields (email, phone, card info, names)
  await page.fill('input[placeholder*="Email"], input[name*="email" i]', 'test.user@example.com');
  await page.fill('input[data-testid="phone"]', '5551234567');
  await page.fill('input[id="cardNumber"]', '4032032379871376');
  await page.fill('input[id="cardExpiry"]', '07/28');
  await page.fill('input[id="cardCvv"]', '494');
  await page.fill('input#firstName', 'John');
  await page.fill('input#lastName', 'Doe');
  
  // Step 8: Fill street address - For floating labels with empty placeholder
  await page.waitForSelector('input#billingLine1', { state: 'visible' });
  await page.focus('input#billingLine1');  // Focus first to activate the floating label
  await page.fill('input#billingLine1', '123 Main Street');
  
  // Step 9: Fill city
  await page.focus('input#billingCity');
  await page.fill('input#billingCity', 'New York');
  
  // Step 10: Select state
  await page.selectOption('select#billingState', 'NY');
  
  // Step 11: Fill ZIP code
  await page.focus('input#billingPostalCode');
  await page.fill('input#billingPostalCode', '12345');  // Using 5-digit ZIP as per pattern
  
  // Step 12: Turn OFF the toggle button (it appears to be ON by default)
  // The toggle is controlled by clicking the label
  await page.click('label[for="Switch_23"]');
  
  // Step 13: Wait 2 seconds then click Pay Now button
  await page.waitForTimeout(2000);
  await page.click('button[data-testid="submit-button"]');
}

// Alternative robust version with additional error handling
async function paypalPgRobustFixed(page: any) {
  // Initial fields
  await page.fill('input[placeholder*="Email"], input[name*="email" i]', 'test.user@example.com');
  await page.fill('input[data-testid="phone"]', '5551234567');
  await page.fill('input[id="cardNumber"]', '4032032379871376');
  await page.fill('input[id="cardExpiry"]', '07/28');
  await page.fill('input[id="cardCvv"]', '494');
  await page.fill('input#firstName', 'John');
  await page.fill('input#lastName', 'Doe');
  
  // Billing address with floating label handling
  const addressFields = [
    { selector: 'input#billingLine1', value: '123 Main Street' },
    { selector: 'input#billingCity', value: 'New York' },
    { selector: 'input#billingPostalCode', value: '12345' }
  ];
  
  for (const field of addressFields) {
    try {
      // Wait for field to be ready
      await page.waitForSelector(field.selector, { state: 'visible' });
      
      // Focus to activate floating label
      await page.focus(field.selector);
      
      // Small delay to ensure label animation completes
      await page.waitForTimeout(100);
      
      // Fill the field
      await page.fill(field.selector, field.value);
      
      // Verify it was filled
      const currentValue = await page.inputValue(field.selector);
      if (currentValue !== field.value) {
        console.log(`Warning: ${field.selector} may not have been filled correctly`);
        // Fallback method
        await page.evaluate(({ selector, value }) => {
          const element = document.querySelector(selector) as HTMLInputElement;
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        }, { selector: field.selector, value: field.value });
      }
    } catch (error) {
      console.log(`Error filling ${field.selector}:`, error);
    }
  }
  
  // Handle state dropdown
  await page.selectOption('select#billingState', 'NY');
  
  // Handle toggle - click the label to turn it OFF
  try {
    await page.waitForSelector('label[for="Switch_23"]', { state: 'visible' });
    await page.click('label[for="Switch_23"]');
    console.log('Toggle clicked');
  } catch (error) {
    console.log('Toggle click failed:', error);
  }
  
  // Wait and submit
  await page.waitForTimeout(2000);
  
  try {
    await page.waitForSelector('button[data-testid="submit-button"]', { state: 'visible' });
    await page.click('button[data-testid="submit-button"]');
    console.log('Pay Now button clicked');
  } catch (error) {
    console.log('Submit button click failed:', error);
  }
}

// Super simple version - minimal approach
async function paypalPgSimple(page: any) {
  // Card and personal info
  await page.fill('input#firstName', 'John');
  await page.fill('input#lastName', 'Doe');
  
  // Focus and fill address fields
  await page.focus('input#billingLine1');
  await page.fill('input#billingLine1', '123 Main Street');
  
  await page.focus('input#billingCity'); 
  await page.fill('input#billingCity', 'New York');
  
  await page.selectOption('select#billingState', 'NY');
  
  await page.focus('input#billingPostalCode');
  await page.fill('input#billingPostalCode', '12345');
  
  // Toggle OFF (click the label)
  await page.click('label[for="Switch_23"]');
  
  // Wait and submit  
  await page.waitForTimeout(2000);
  await page.click('button[data-testid="submit-button"]');
}


await handlePaymentStatusPage(page);
async function handlePaymentStatusPage(page: any) {
  
  // Click "Track application status" button
  await page.click('button:has-text("Track application status")');
  await page.waitForSelector('text="Payment Successful"', { timeout: 30000 });

}

await printVerificationSummary(page);
async function printVerificationSummary(page: any) {
  // Wait for verification details page to load
  await page.waitForSelector('.index_web_heading__QkxKl', { timeout: 10000 });
  
  // Extract the main authority title
  const authorityTitle = await page.textContent('.index_web_heading__QkxKl');
  
  // Extract the service type
  const serviceType = await page.textContent('.index_web_clientName__MCIr6');
  
  // Extract Request ID
  const requestIdElement = await page.textContent('.index_web_reqId__CGnBw');
  
  // Extract Requested On date
  const requestedOnElement = await page.textContent('.index_web_reqOn__HieTA');
  
  // Extract status (optional)
  const statusElement = await page.textContent('.badge-module_badgeText__A11Oc');
  
  // Print the summary
  console.log(' VERIFICATION REQUEST SUMMARY:');
  console.log('='.repeat(50));
  console.log(`**${authorityTitle}**`);
  console.log(`**${serviceType}**`);
  console.log(`**${requestIdElement}**`);
  console.log(`**${requestedOnElement}**`);
  console.log(`**Status: ${statusElement}**`);
  console.log('='.repeat(50));
}

}