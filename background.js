// Global variable to track if popup is open (Can be removed if not used elsewhere, but keep for now for context)
let isPopupOpen = false;
let hasActivePort = false;
let activePort = null;
let isMessagingActive = false; // Track if messaging is active even when popup is closed

// Track when popup connects
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    console.log('Popup opened');
    isPopupOpen = true;
    hasActivePort = true;
    activePort = port;
    
    // Listen for popup disconnect
    port.onDisconnect.addListener(() => {
      console.log('Popup closed');
      isPopupOpen = false;
      hasActivePort = false;
      activePort = null;
    });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Log received messages for debugging background issues
  console.log("BG: Received message:", msg.type, "from", sender.tab ? "tab " + sender.tab.id : "extension");
  
  if (msg.type === "notify") {
    console.log(`BG: Notification requested: Title="${msg.title}", Message="${msg.message}"`);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png', // Ensure icon.png exists at the root
      title: msg.title || "Speaky Auto Messenger",
      message: msg.message || "Action completed",
      priority: 0 // Default priority
    }, (notificationId) => {
      // This callback runs after the notification attempt completes
      if (chrome.runtime.lastError) {
        // Log error if creation failed (e.g., permission denied, invalid icon)
        console.error("BG: Notification creation error:", chrome.runtime.lastError.message);
      } else {
        console.log("BG: Notification shown:", notificationId);
        // Optional: Clear the notification automatically after a few seconds
        // setTimeout(() => { chrome.notifications.clear(notificationId); }, 5000);
      }
      // We don't need to call sendResponse here unless the content script needs it.
    });
    // IMPORTANT: Return true immediately because chrome.notifications.create is asynchronous.
    // This keeps the message channel open for the callback above.
    return true;
  }
  
  if (msg.type === "progress") {
    console.log("BG: Progress update received:", msg);
    isMessagingActive = !msg.done; // Track state based on progress
    chrome.storage.local.set({
      isMessagingActive: isMessagingActive,
      messagingProgress: {
        current: `${msg.current}/${msg.total} completed`,
        percentage: `${msg.percentage}%`,
        total: msg.total,
        currentCount: msg.current,
        stopped: msg.stopped || false
      }
    });
    // Return true as storage access can be async
    return true;
  }
  
  if (msg.type === "stop_messaging") {
    console.log("BG: Stop request received");
    isMessagingActive = false; // Update state
    chrome.storage.local.set({ isMessagingActive: false });
     // Return true as storage access can be async
    return true;
  }
  
  // If the message type wasn't one of the above, indicate it wasn't handled asynchronously.
  console.log("BG: Message type not handled or synchronous:", msg.type);
  return false;
});

// Extension installation handler
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    console.log("Speaky Auto Messenger installed successfully!");
  }
});

// Handle tab updates for Speaky pages (Optional: Can be removed if not used)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.speaky.com')) {
    console.log("On Speaky website");
  }
});
  