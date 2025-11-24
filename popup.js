document.addEventListener('DOMContentLoaded', async () => {
  // Connect to background script to indicate popup is open
  const port = chrome.runtime.connect({ name: 'popup' });
  
  const messageInput = document.getElementById('message');
  const personalizeCheck = document.getElementById('personalize');
  const limitInput = document.getElementById('limit');
  const delayInput = document.getElementById('delay');
  const startBtn = document.getElementById('start');
  const clearBtn = document.getElementById('clear');
  const debugBtn = document.getElementById('debugBtn');
  const resetBtn = document.getElementById('resetBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusElement = document.getElementById('status');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressPercentage = document.getElementById('progressPercentage');
  
  // Variable to track if we're currently messaging
  let isMessagingActive = false;
  
  // Cleanup function when popup is closed
  window.addEventListener('beforeunload', () => {
    // Remove any existing progress listeners to prevent memory leaks
    if (window.currentProgressListener) {
      chrome.runtime.onMessage.removeListener(window.currentProgressListener);
    }
    
    // Save the current messaging state
    if (isMessagingActive) {
      chrome.storage.local.set({ 
        isMessagingActive: true,
        messagingProgress: {
          current: progressText.textContent,
          percentage: progressBar.style.width
        }
      });
    }
  });
  
  // Load saved settings
  chrome.storage.sync.get(['message', 'personalize', 'limit', 'delay'], (data) => {
    if (data.message) messageInput.value = data.message;
    if (data.personalize !== undefined) personalizeCheck.checked = data.personalize;
    if (data.limit) limitInput.value = data.limit;
    if (data.delay) delayInput.value = data.delay;
  });
  
  // Check if we were in the middle of messaging
  chrome.storage.local.get(['isMessagingActive', 'messagingProgress'], (data) => {
    if (data.isMessagingActive) {
      // We were in the middle of messaging, restore UI
      isMessagingActive = true;
      startBtn.disabled = true;
      statusElement.textContent = "Messaging in progress...";
      progressContainer.style.display = "block";
      
      if (data.messagingProgress) {
        progressText.textContent = data.messagingProgress.current || "0/0 completed";
        progressBar.style.width = data.messagingProgress.percentage || "0%";
        progressPercentage.textContent = data.messagingProgress.percentage || "0%";
      }
    }
  });
  
  // Save settings when inputs change
  messageInput.addEventListener('input', saveSettings);
  personalizeCheck.addEventListener('change', saveSettings);
  limitInput.addEventListener('change', saveSettings);
  delayInput.addEventListener('change', saveSettings);
  
  function saveSettings() {
    chrome.storage.sync.set({
      message: messageInput.value,
      personalize: personalizeCheck.checked,
      limit: limitInput.value,
      delay: delayInput.value
    });
  }
  
  // Clear message history
  clearBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        localStorage.removeItem("speaky_sent_users");
        return true;
      }
    }, (results) => {
      if (results && results[0] && results[0].result) {
        statusElement.textContent = "Message history cleared successfully!";
        setTimeout(() => { statusElement.textContent = ""; }, 3000);
      }
    });
  });
  
  // Reset extension
  resetBtn.addEventListener('click', async () => {
    if (confirm("This will reset all extension settings and message history. Continue?")) {
      // Clear all stored settings
      chrome.storage.sync.clear();
      chrome.storage.local.clear();
      
      // Clear message history in the current tab
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Clear any localStorage data
          localStorage.removeItem("speaky_sent_users");
          
          // Clear any global window variables we set
          window.startSpeakyMessaging = null;
          
          // Reload the page to ensure clean state
          window.location.reload();
          
          return true;
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          // Also reset UI state
          messageInput.value = "Hello, [NAME] nice to meet you";
          personalizeCheck.checked = true;
          limitInput.value = "10";
          delayInput.value = "5";
          
          isMessagingActive = false;
          statusElement.textContent = "Extension reset successfully!";
          
          // Hide progress container
          progressContainer.style.display = "none";
          
          // Re-enable buttons
          startBtn.disabled = false;
          
          setTimeout(() => { 
            statusElement.textContent = ""; 
          }, 3000);
        }
      });
    }
  });
  
  // Start messaging process
  startBtn.addEventListener('click', async () => {
    if (!messageInput.value.trim()) {
      statusElement.textContent = "Please enter a message first!";
      return;
    }
    
    // Validate input values
    const limit = parseInt(limitInput.value);
    const delay = parseInt(delayInput.value);
    
    if (isNaN(limit) || limit < 1) {
      statusElement.textContent = "Please enter a valid message limit!";
      return;
    }
    
    if (isNaN(delay) || delay < 3) {
      statusElement.textContent = "Delay must be at least 3 seconds!";
      return;
    }
    
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Disable the button during execution
    startBtn.disabled = true;
    statusElement.textContent = "Messaging in progress...";
    progressContainer.style.display = "block";
    isMessagingActive = true;
    
    // Save the state so we know we're messaging
    chrome.storage.local.set({ isMessagingActive: true });
    
    // Set up messaging progress updates
    // Keep track of the existing listener to avoid adding multiple listeners
    if (window.currentProgressListener) {
      chrome.runtime.onMessage.removeListener(window.currentProgressListener);
    }
    
    // Store the new progress listener for future reference
    window.currentProgressListener = function(msg) {
      if (msg.type === "progress") {
        console.log("Received progress update in popup:", msg);
        
        progressBar.style.width = `${msg.percentage}%`;
        progressText.textContent = `${msg.current}/${msg.total} completed`;
        progressPercentage.textContent = `${msg.percentage}%`;
        
        // Save progress state
        chrome.storage.local.set({
          messagingProgress: {
            current: progressText.textContent,
            percentage: `${msg.percentage}%`,
            total: msg.total,
            currentCount: msg.current
          }
        });
        
        if (msg.done) {
          // Messaging is complete
          isMessagingActive = false;
          chrome.storage.local.set({ isMessagingActive: false });
          
          // Re-enable button when finished
          startBtn.disabled = false;
          
          // Show appropriate message based on if it was stopped by user
          if (msg.stopped) {
            statusElement.textContent = `Messaging stopped. ${msg.current} messages sent.`;
          } else {
            statusElement.textContent = `Messaging completed! ${msg.current} messages sent.`;
          }
          
          setTimeout(() => {
            progressContainer.style.display = "none";
          }, 5000);
        }
      }
    };
    
    // Add the new listener
    chrome.runtime.onMessage.addListener(window.currentProgressListener);
    
    // Execute content script with error handling
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: startMessaging,
      args: [{
        message: messageInput.value,
        personalize: personalizeCheck.checked,
        limit: limit,
        delay: delay
      }]
    }).then(results => {
      console.log("Script executed successfully");
    }).catch(error => {
      console.error("Error executing script:", error);
      isMessagingActive = false;
      chrome.storage.local.set({ isMessagingActive: false });
      startBtn.disabled = false;
      statusElement.textContent = "Error: " + (error.message || "Could not start messaging");
      progressContainer.style.display = "none";
    });
  });
  
  // Debug handler to analyze the page structure
  debugBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    statusElement.textContent = "Analyzing page structure...";
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: runPageAnalysis
    }, (results) => {
      if (results && results[0]) {
        statusElement.textContent = "Analysis complete! Check browser console for details.";
        setTimeout(() => { 
          statusElement.textContent = ""; 
        }, 5000);
      }
    });
  });
  
  function runPageAnalysis() {
    console.log(" SPEAKY AUTO MESSENGER PAGE ANALYSIS ", "font-size: 16px; font-weight: bold; color: #4569d4;");
    console.log("Current URL:", window.location.href);
    
    // Check if we're on Speaky
    if (!window.location.href.includes('web.speaky.com')) {
      console.warn("Not on Speaky website. Please navigate to https://web.speaky.com/");
      alert("⚠️ Not on Speaky website. Please navigate to https://web.speaky.com/");
      return false;
    }
    
    console.log("ANALYZING PAGE STRUCTURE");
    
    // Test all possible user card selectors
    const selectors = [
      'li.c-PJLV',
      '.c-PJLV',
      'a[href*="/profile/"]',
      'a.c-kOgFh',
      'li',
      '[data-testid="user-card"]',
      '.user-card',
      '.users-list > div'
    ];
    
    let foundUserCards = false;
    let bestSelector = null;
    let maxElements = 0;
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`Selector "${selector}" found ${elements.length} elements`);
      
      if (elements.length > 0) {
        // Check if these look like user cards (contain profile links or user names)
        let validCards = 0;
        for (let i = 0; i < Math.min(elements.length, 5); i++) {
          const el = elements[i];
          const hasProfileLink = el.querySelector('a[href*="/profile/"]') || 
                                (el.tagName === 'A' && el.href && el.href.includes('/profile/'));
          const hasNameElement = el.querySelector('.c-cGludH') || 
                               el.querySelector('span') || 
                               el.querySelector('p');
          
          if (hasProfileLink || hasNameElement) {
            validCards++;
          }
        }
        
        console.log(`Selector "${selector}" has ${validCards} likely user cards`);
        
        if (validCards > 0) {
          foundUserCards = true;
          if (validCards > maxElements) {
            maxElements = validCards;
            bestSelector = selector;
          }
        }
      }
    });
    
    if (foundUserCards) {
      console.log(`FOUND USER CARDS! Best selector: "${bestSelector}" with ${maxElements} cards`, "color: green; font-weight: bold;");
    } else {
      console.warn("NO USER CARDS FOUND! Please navigate to the Speaky Community or Search page");
      alert("⚠️ No user cards found! Please navigate to the Community or Search page where user profiles are displayed.");
    }
    
    // Check DOM structure for common elements
    console.log("CHECKING DOM STRUCTURE");
    const importantElements = [
      { name: "Profile links", selector: "a[href*='/profile/']" },
      { name: "User names", selector: ".c-cGludH, .c-ePwXvv span, .user-name" },
      { name: "Message buttons", selector: "button, a.button, .btn, [role='button']" },
      { name: "Text inputs", selector: "textarea, input[type='text'], [contenteditable='true']" }
    ];
    
    importantElements.forEach(item => {
      const count = document.querySelectorAll(item.selector).length;
      console.log(`${item.name}: ${count} found`);
    });
    
    console.log("ANALYSIS COMPLETE");
    return true;
  }
  
  // This function will be injected into the page
  function startMessaging(config) {
    const { message, personalize, limit, delay } = config;
    console.log("--- [SAM Debug V2] Starting Speaky messaging ---");
    console.log("--- [SAM Debug V2] Config:", config);

    (async function() { // Use an async IIFE
      console.log("--- [SAM Debug V2] Async IIFE started.");
      const delayMs = ms => new Promise(resolve => setTimeout(resolve, ms));
      window.speakyStopMessaging = false;
      
      // Setup stop listener & interval check (same as before)
      document.addEventListener('speaky_stop_messaging', () => { /* ... set flag ... */ });
      const checkStopInterval = setInterval(() => { /* ... check storage ... */ }, 5000);

      // Use a Set for efficient checking and easy saving
      let sentUsers = new Set(JSON.parse(localStorage.getItem("speaky_sent_users_set") || "[]"));
      console.log(`--- [SAM Debug V2] Loaded ${sentUsers.size} previously sent users.`);

      // --- Step 1: Get initial list page URL and profile URLs ---
      const listPageUrl = window.location.href;
      console.log(`--- [SAM Debug V2] Stored list page URL: ${listPageUrl}`);
      let initialProfileUrls = [];
      const cardSelectors = [ /* ... your list of selectors ... */ 
        'li.c-PJLV', 'a[href*="/profile/"]', 'a.c-kOgFh', '[data-testid="user-card"]',
        '.users-list > div', '.user-card', 'li > div > a[href*="/profile/"]',
        'div[class*="UserCard__"]', 'article[class*="UserCard__"]'
      ];

      console.log("--- [SAM Debug V2] Finding initial user cards and extracting profile URLs...");
      // --- Extract unique profile URLs from the initial page load ---
      const tempUrls = new Set(); // Use Set to ensure uniqueness during extraction
      for (const selector of cardSelectors) {
         const foundElements = document.querySelectorAll(selector);
         if (foundElements.length > 0) {
             for(const card of foundElements){
                 let profileLinkElement = null;
                 if (card.tagName === 'A' && card.href && card.href.includes('/profile/')) { profileLinkElement = card; }
                 else { profileLinkElement = card.querySelector('a[href*="/profile/"]') || card.closest('a[href*="/profile/"]'); }

                 if (profileLinkElement?.href) { // Optional chaining for safety
                    try {
                        const urlObj = new URL(profileLinkElement.href);
                        const normalizedUrl = urlObj.origin + urlObj.pathname; // Normalize
                        tempUrls.add(normalizedUrl);
                    } catch (e) { /* Ignore invalid URLs */ }
                 }
             }
             // If this selector found URLs, use them and stop scanning selectors
             if (tempUrls.size > 0) {
                  console.log(`--- [SAM Debug V2] Extracted ${tempUrls.size} URLs using selector "${selector}".`);
                break;
              }
            }
          }
      initialProfileUrls = Array.from(tempUrls); // Convert the Set to an Array

      if (initialProfileUrls.length === 0) {
        console.warn("--- [SAM Debug V2] No user profile URLs found on initial scan!");
        alert("Speaky Auto Messenger: Could not find any user profiles on this page.");
        chrome.runtime.sendMessage({ type: "progress", current: 0, total: 1, percentage: 100, done: true });
        clearInterval(checkStopInterval);
        return;
      }
      console.log(`--- [SAM Debug V2] Found ${initialProfileUrls.length} unique profile URLs to process.`);

      // --- Calculate how many messages to actually send ---
      let messagesSent = 0;
      const availableProfilesToSend = initialProfileUrls.filter(url => !sentUsers.has(url));
      let totalToSend = Math.min(availableProfilesToSend.length, limit); // Target based on available & limit
      console.log(`--- [SAM Debug V2] Target limit: ${limit}. Available unsent profiles: ${availableProfilesToSend.length}. Will attempt to send to ${totalToSend}.`);

      // Send initial progress
      chrome.runtime.sendMessage({ type: "progress", current: 0, total: totalToSend, percentage: 0, done: false });

      // --- Main Loop: Iterate through the STABLE initial URL list ---
      for (let i = 0; i < initialProfileUrls.length && messagesSent < totalToSend; i++) { // Stop when limit reached OR totalToSend reached
          const targetProfileUrl = initialProfileUrls[i];
          console.log(`\n--- [SAM Debug V2] Loop i=${i}: Processing target URL: ${targetProfileUrl}`);

          if (window.speakyStopMessaging) { console.log("--- [SAM Debug V2] Stop requested."); break; }

          if (sentUsers.has(targetProfileUrl)) {
              console.log(`--- [SAM Debug V2] Skipping already sent user: ${targetProfileUrl}`);
              continue; // Move to the next URL in the list
          }

          // --- Find the clickable element for this URL on the *current* page ---
          // This needs to happen *every* iteration because the page reloads
          console.log(`--- [SAM Debug V2] Finding clickable element for ${targetProfileUrl} on current page...`);
          let elementToClick = null;
          let foundElementOnPage = false;
          for (const selector of cardSelectors) { // Scan with all selectors again
              const currentElements = document.querySelectorAll(selector);
              for (const currentCard of currentElements) {
                  let profileLinkElement = null;
                  if (currentCard.tagName === 'A' && currentCard.href?.includes('/profile/')) { profileLinkElement = currentCard; }
                  else { profileLinkElement = currentCard.querySelector('a[href*="/profile/"]') || currentCard.closest('a[href*="/profile/"]'); }

                  if (profileLinkElement?.href) {
                      try {
                          const urlObj = new URL(profileLinkElement.href);
                          const currentNormalizedUrl = urlObj.origin + urlObj.pathname;
                          if (currentNormalizedUrl === targetProfileUrl) {
                              elementToClick = profileLinkElement; // Found the element corresponding to our target URL
                              console.log("--- [SAM Debug V2] Found element to click:", elementToClick);
                              foundElementOnPage = true;
                              break; // Stop searching cards within this selector
                          }
                      } catch (e) { /* ignore parse error */ }
                  }
              }
              if (foundElementOnPage) break; // Stop searching selectors if found
          }

          if (!elementToClick) {
              console.warn(`--- [SAM Debug V2] Could not find element for ${targetProfileUrl} on the current list page (URL: ${window.location.href}). Skipping.`);
              // Potential reasons: Page didn't load correctly, user navigated elsewhere, DOM changed drastically.
              continue; // Skip to the next target URL
          }

          // --- Process this user (Click -> Profile -> Message -> Navigate Back) ---
          try {
              console.log(`--- [SAM Debug V2] Clicking profile element for ${targetProfileUrl}...`);
              elementToClick.click();
              console.log("--- [SAM Debug V2] Click initiated. Waiting for profile page load (10s)...");
              await delayMs(10000);
              console.log("--- [SAM Debug V2] Finished waiting. Current URL:", window.location.href);

              // --- Profile Page Logic ---
              if (window.location.href.includes('/profile/')) { // Basic check if we are on a profile page
                  console.log("--- [SAM Debug V2] Looks like profile page.");
                  let userName = "";
                  if (personalize) { /* ... find name logic ... */ }
                  let personalizedMessage = message.replace(/\[NAME\]/gi, userName || 'there'); // Case-insensitive replace
                  console.log(`--- [SAM Debug V2] Prepared message: "${personalizedMessage}"`);

                  const messageBtn = await waitForMessageBtn(); // Use helper
          if (messageBtn) {
                      console.log("--- [SAM Debug V2] Clicking message button...");
            messageBtn.click();
                      await delayMs(12000); // Wait for form/chat

                      // --- Message Form Logic ---
                      console.log("--- [SAM Debug V2] Assuming message form/chat is open. Current URL:", window.location.href);
                      const input = document.querySelector("textarea") || document.querySelector('[contenteditable="true"]') /* ... other input selectors ... */;
                      const sendBtn = await findSendButton(); // Use helper
            
            if (input && sendBtn) {
                          console.log("--- [SAM Debug V2] Found input and send button. Sending message...");
                          input.value = personalizedMessage; // Set text
                          input.dispatchEvent(new Event("input", { bubbles: true })); // Trigger events
                          if (input.contentEditable === 'true') { input.innerHTML = personalizedMessage; /* more events? */ }
                          await delayMs(1500); // Brief pause before clicking send

              sendBtn.click();
                          console.log(`--- [SAM Debug V2] Send button clicked for: ${targetProfileUrl}`);

                          // Add to sent Set *after* successful click attempt
                          sentUsers.add(targetProfileUrl);
                          localStorage.setItem("speaky_sent_users_set", JSON.stringify(Array.from(sentUsers))); // Save updated set
                          console.log(`--- [SAM Debug V2] Added ${targetProfileUrl} to sent Set & localStorage.`);

                          // Call notification helper (which sends message to background.js)
                          showNotification("Message Sent ✅", `To: ${userName || targetProfileUrl}`);
                          
              messagesSent++;
                          console.log(`--- [SAM Debug V2] messagesSent incremented to: ${messagesSent}`);
              
              // Send progress update
                          const currentProgress = { /* ... progress data ... */ };
                          chrome.runtime.sendMessage(currentProgress);

                      } else { // Input/Send button not found on form
                         console.warn("--- [SAM Debug V2] Failed find input/send button on form.");
                         // Decide whether to try navigating back or stop
                      }
                  } else { // Message button not found on profile
                      console.warn("--- [SAM Debug V2] Failed find message button on profile.");
                      // Decide whether to try navigating back or stop
                  }
              } else { // Didn't seem to land on a profile page
                  console.warn("--- [SAM Debug V2] Did not navigate to a profile page after click. Current URL:", window.location.href);
                  // Decide whether to try navigating back or stop
              }

        } catch (error) {
              console.error(`--- [SAM Debug V2] Error processing user ${targetProfileUrl}:`, error);
              // Log the error, but attempt to navigate back to continue the loop
          } finally {
               // --- Navigate Back (Always happens after try/catch for a user) ---
               console.log(`--- [SAM Debug V2] Navigating back to list page: ${listPageUrl}`);
               window.location.href = listPageUrl; // Go back to the stored list URL
               console.log("--- [SAM Debug V2] Navigation initiated. Waiting for list page load (8s)...");
               await delayMs(8000); // Wait for navigation/load
               console.log("--- [SAM Debug V2] Finished waiting for list page load. Current URL:", window.location.href);

               if (window.location.href !== listPageUrl) {
                   console.warn("--- [SAM Debug V2] Navigation back might have failed or redirected!");
                   // Consider adding a retry or stopping if navigation consistently fails.
               }

               // Check stop flag *after* navigating back and waiting
               if (window.speakyStopMessaging) { console.log("--- [SAM Debug V2] Stop requested after navigation."); break; }

               // Wait the configured inter-message delay if we haven't reached the limit
               if (messagesSent < totalToSend) {
                   console.log(`--- [SAM Debug V2] Waiting ${delay}s inter-message delay...`);
                   await delayMs(delay * 1000);
                   console.log("--- [SAM Debug V2] Finished delay.");
               }
          }
          // Loop continues to the next URL in initialProfileUrls
      } // End of main loop

      console.log("--- [SAM Debug V2] Messaging loop finished.");
        clearInterval(checkStopInterval);

      // Final progress update
      const finalStatus = { /* ... progress data ... */ };
      chrome.runtime.sendMessage(finalStatus);

      // Define helper functions needed within this scope
      async function waitForMessageBtn() { /* ... implementation ... */ }
      async function findSendButton() { /* ... implementation ... */ }
      function showNotification(title, message) {
          console.log(`--- [SAM Debug V2] Requesting notification: ${title} - ${message}`);
          try {
             chrome.runtime.sendMessage({ type: "notify", title: title, message: message });
          } catch (err) { console.error("--- [SAM Debug V2] Error sending notify message:", err); }
       }

      console.log(`--- [SAM Debug V2] Messaging run complete! Sent ${messagesSent} messages.`);
    })(); // End of async IIFE
  } // End of startMessaging definition
  
  // Stop messaging handler
  stopBtn.addEventListener('click', async () => {
    if (!isMessagingActive) return;
    
    if (confirm("Are you sure you want to stop the messaging process?")) {
      console.log("Stopping messaging process...");
      
      // Set flag to indicate messaging is no longer active
      isMessagingActive = false;
      chrome.storage.local.set({ isMessagingActive: false });
      
      // Also notify background script to update its state
      chrome.runtime.sendMessage({
        type: "stop_messaging"
      });
      
      // Re-enable start button
      startBtn.disabled = false;
      statusElement.textContent = "Messaging stopped by user.";
      
      // Send stop message to content script
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Set a global flag that the messaging loop can check
          window.speakyStopMessaging = true;
          console.log("Stop messaging flag set to true");
          
          // Try to trigger an event that the content script might be listening for
          document.dispatchEvent(new CustomEvent('speaky_stop_messaging'));
          
          return true;
        }
      }).catch(error => {
        console.error("Error stopping messaging:", error);
      });
      
      // Hide progress after a delay
      setTimeout(() => {
        progressContainer.style.display = "none";
      }, 5000);
    }
  });
});
  