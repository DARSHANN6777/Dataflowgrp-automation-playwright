# 🎯 Automation Testing Project with Playwright & TypeScript

This project automates an web application for filing a VR(verification request) using **Playwright** and **TypeScript**.  
For now we can just file a VR but more versions coming up........
It is designed to handle dynamic fields, timing issues, OTP verification, and form submission with robust selectors and reusable functions.

---

## 🚀 Features

- ✅ Automated filing a verification request for Primary Source Verification.  
- ✅ OTP entry simulation using `keyboard.press()`  
- ✅ Random email & phone number generation  
- ✅ Handles dropdowns, dynamic fields, and timing delays  
- ✅ Modular, maintainable test code with helper functions  
- ✅ Cross-browser testing (Chromium, Firefox, WebKit) support  

---

## 🛠️ Tech Stack

- **Language:** TypeScript  
- **Framework:** Playwright Test  
- **IDE:** Visual Studio Code  
- **Version Control:** Git & GitHub  

---

## 📂 Project Structure

```plaintext
.
├── tests/               # Playwright test scripts
├── helpers/             # Utility functions (email, phone number, waits)
├── playwright.config.ts # Playwright configuration file
├── package.json         # Project dependencies & scripts
└── README.md            # Project documentation


---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
git clone https://github.com/DARSHANN6777/proj_new_auto.git
cd proj_new_auto
2️⃣ Install Dependencies
npm install
3️⃣ Install Playwright Browsers
npx playwright install
4️⃣ Run Tests
npx playwright test
5️⃣ Debug in UI Mode
npx playwright test --ui
6️⃣ View Reports
npx playwright show-report
📸 Demo
Add screenshots or GIFs showing the automation in action.

📄 License
This project is licensed under the MIT License.

👤 Author: DARSHANN6777


