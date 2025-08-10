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

// Improved dropdown selection function based on actual HTML structure
async function selectDropdownByTestId(page: any, testId: string, optionText: string) {
  console.log(`🔍 Selecting dropdown option "${optionText}" for testId: ${testId}`);
  
  try {
    // Method 1: Click the dropdown container by data-testid
    const dropdownContainer = `[data-testid="${testId}-chipContainer"]`;
    await page.waitForSelector(dropdownContainer, { timeout: 10000 });
    await page.click(dropdownContainer);
    console.log(`✅ Clicked dropdown container: ${dropdownContainer}`);
    
    await page.waitForTimeout(1500); // Wait for dropdown to open
    
    // Click the option by its label
    const optionSelector = `.dropdown-module_menuItemLabel__VJuGM:has-text("${optionText}")`;
    await page.waitForSelector(optionSelector, { timeout: 5000 });
    await page.click(optionSelector);
    console.log(`✅ Selected option: "${optionText}"`);
    
    return true;
  } catch (error) {
    console.log(`❌ Method 1 failed: ${error.message}`);
    
    try {
      // Method 2: Try clicking the chip text area
      const chipTextSelector = `[data-testid="${testId}-selectedOption"]`;
      await page.click(chipTextSelector);
      console.log(`✅ Clicked chip text: ${chipTextSelector}`);
      
      await page.waitForTimeout(1500);
      
      const optionSelector = `.dropdown-module_menuItemLabel__VJuGM:has-text("${optionText}")`;
      await page.click(optionSelector);
      console.log(`✅ Selected option: "${optionText}" (Method 2)`);
      
      return true;
    } catch (error2) {
      console.log(`❌ Method 2 failed: ${error2.message}`);
      
      try {
        // Method 3: Force click approach
        const dropdownContainer = `[data-testid="${testId}-chipContainer"]`;
        await page.locator(dropdownContainer).click({ force: true });
        console.log(`✅ Force clicked dropdown container`);
        
        await page.waitForTimeout(1500);
        
        const optionLocator = page.locator(`.dropdown-module_menuItemLabel__VJuGM`).filter({ hasText: optionText });
        await optionLocator.click({ force: true });
        console.log(`✅ Force selected option: "${optionText}"`);
        
        return true;
      } catch (error3) {
        console.log(`❌ All methods failed for dropdown ${testId}`);
        throw error3;
      }
    }
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
      await page.waitForSelector('text="Home", text="Verifications", text="Start New Verification", .sidebar, [class*="sidebar"]', { timeout: 10000 });
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
  }, { timeout: 15000 });
  
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

// Improved form filling function using the new dropdown selection method
async function fillVerificationForm(page: any) {
  console.log('📋 Starting verification form dropdown selections...');
  
  try {
    // Wait for the form to load completely
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot before form filling
    await page.screenshot({ path: 'before-form-filling.png' });
    
    // Step 1: Select "Foreign Education Recognition" in the first dropdown
    console.log('🔍 Selecting verification reason - Foreign Education Recognition...');
    await selectDropdownByTestId(page, 'testSpeciality', 'Foreign Education Recognition');
    
    // Wait for form to update after first selection
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'after-first-dropdown-selection.png' });
    
    // Step 2: Select "Fresh Graduates - Bahraini Nationals" in the second dropdown
    console.log('🔍 Selecting verification type - Fresh Graduates - Bahraini Nationals...');
    
    // The second dropdown might have a different testId - let's try common patterns
    const secondDropdownTestIds = [
      'testSpecialityType',
      'testVerificationType', 
      'testSubSpeciality',
      'testGraduateType'
    ];
    
    let secondDropdownSelected = false;
    
    for (const testId of secondDropdownTestIds) {
      try {
        await selectDropdownByTestId(page, testId, 'Fresh Graduates - Bahraini Nationals');
        secondDropdownSelected = true;
        break;
      } catch (error) {
        console.log(`⚠️ TestId ${testId} not found, trying next...`);
        continue;
      }
    }
    
    if (!secondDropdownSelected) {
      console.log('🔄 Trying alternative approach for second dropdown...');
      
      // Alternative: Find all chip containers and try the second one
      try {
        const allChipContainers = page.locator('[class*="dropdown-module_chipContainer"]');
        const count = await allChipContainers.count();
        console.log(`Found ${count} dropdown containers`);
        
        if (count > 1) {
          // Click the second dropdown
          await allChipContainers.nth(1).click();
          await page.waitForTimeout(1500);
          
          // Select the option
          await page.click('.dropdown-module_menuItemLabel__VJuGM:has-text("Fresh Graduates - Bahraini Nationals")');
          console.log('✅ Selected second dropdown using nth(1) approach');
          secondDropdownSelected = true;
        }
      } catch (error) {
        console.log('❌ Alternative approach also failed:', error.message);
      }
    }
    
    if (!secondDropdownSelected) {
      throw new Error('Could not select second dropdown after trying all methods');
    }
    
    // Wait for form to update after second selection
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'after-second-dropdown-selection.png' });
    
    // Step 3: Look for and click Continue button
    console.log('🔍 Looking for Continue button...');
    
    try {
      // Wait for Continue button to be enabled
      await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
      
      // Click the Continue button
      await page.click('button:has-text("Continue")');
      console.log('✅ Clicked Continue button');
      
      // Wait for navigation to next page
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'after-continue-click.png' });
      
    } catch (continueError) {
      console.log('⚠️ Continue button not found or not clickable - this might be expected');
      console.log('📝 Form selections completed, no Continue button needed');
    }
    
    console.log('🎉 Verification form dropdown selections completed successfully!');
    
  } catch (formError) {
    console.log('❌ Error during form filling:', formError.message);
    await page.screenshot({ path: 'form-filling-error.png' });
    
    // Debug information
    console.log('🔍 Debug: Taking screenshot of current state...');
    await page.screenshot({ path: 'debug-current-state.png' });
    
    // Log all available dropdowns for debugging
    try {
      const allDropdowns = await page.locator('[class*="dropdown-module_chipContainer"]').count();
      console.log(`Debug: Found ${allDropdowns} dropdown containers on page`);
      
      const allTestIds = await page.locator('[data-testid*="chip"]').allTextContents();
      console.log('Debug: Available elements with testid containing "chip":', allTestIds);
    } catch (debugError) {
      console.log('Debug logging failed:', debugError.message);
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
    
    console.log('🎯 Complete verification flow (Bahrain → NHRA → Form) completed successfully!');
    
  } catch (error) {
    console.log('⚠️ Country/Authority selection failed:', error.message);
    await page.screenshot({ path: 'selection-process-error.png' });
    throw error;
  }
}