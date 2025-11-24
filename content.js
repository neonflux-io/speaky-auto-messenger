// This file now just has a placeholder function
// The main functionality is injected from popup.js when the user starts messaging
window.startSpeakyMessaging = async function () {
  console.log("Speaky Auto Messenger is ready!");
};

// Add a badge to let users know the extension is active
(function() {
  if (window.location.href.includes('web.speaky.com')) {
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #4569d4;
      color: white;
      padding: 10px 15px;
      border-radius: 20px;
      font-size: 13px;
      z-index: 10000;
      box-shadow: 0 3px 15px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      opacity: 0.95;
      transition: all 0.3s;
      cursor: pointer;
    `;
    badge.innerHTML = `
      <span style="margin-right: 8px; font-size: 16px;">✉️</span>
      <span>Speaky Auto Messenger Ready</span>
    `;
    
    // Add hover effects
    badge.addEventListener('mouseover', () => {
      badge.style.opacity = '1';
      badge.style.transform = 'scale(1.05)';
    });
    
    badge.addEventListener('mouseout', () => {
      badge.style.opacity = '0.95';
      badge.style.transform = 'scale(1)';
    });
    
    // Add click handler to show instructions
    badge.addEventListener('click', () => {
      const instructionsEl = document.createElement('div');
      instructionsEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        color: #333;
        padding: 20px 25px;
        border-radius: 10px;
        font-size: 14px;
        z-index: 10001;
        box-shadow: 0 5px 30px rgba(0,0,0,0.3);
        max-width: 450px;
        line-height: 1.5;
      `;
      
      instructionsEl.innerHTML = `
        <h2 style="color: #4569d4; margin-top: 0; font-size: 18px;">How to Use Speaky Auto Messenger</h2>
        <p>Please follow these steps to send automated messages:</p>
        <ol style="padding-left: 20px; margin-bottom: 15px;">
          <li>Make sure you're on the <b>Community</b> or <b>Search</b> page where user cards are displayed</li>
          <li>Click the Speaky Auto Messenger extension icon in your browser toolbar</li>
          <li>Enter your message or choose a template</li>
          <li>Set personalization options and limits</li>
          <li>Click "Start Messaging" in the popup</li>
        </ol>
        <p style="margin-bottom: 5px;"><b>Current page:</b> ${window.location.href}</p>
        <p style="font-size: 12px; margin-top: 15px; color: #777;">Click anywhere outside this box to close</p>
      `;
      
      // Add overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.5);
        z-index: 10000;
      `;
      
      // Close when clicking overlay
      overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(instructionsEl);
      });
      
      document.body.appendChild(overlay);
      document.body.appendChild(instructionsEl);
    });

    // Add to page after a delay to ensure the page is loaded
    setTimeout(() => {
      document.body.appendChild(badge);
    }, 2000);
  }
})();
  