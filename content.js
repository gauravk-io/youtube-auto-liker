(function() {
  'use strict';
  const CONFIG = {
    LIKE_THRESHOLD: 0.90,
    COMMENT_THRESHOLD: 0.90,
    DEFAULT_COMMENT: "Automated comment. I built an extension so creators still get support even when I forget to like and comment.",
    SELECTOR_VIDEO: 'video',
    SELECTOR_LIKE_BUTTON: 'like-button-view-model button[aria-label], ytd-toggle-button-renderer button[aria-label*="like" i]',
    SELECTOR_COMMENT_PLACEHOLDER: '#simplebox-placeholder',
    SELECTOR_COMMENT_TEXTAREA: '#contenteditable-root',
    SELECTOR_COMMENT_SUBMIT: 'ytd-comment-simplebox-renderer #submit-button',
    POLL_INTERVAL: 1000,
    MAX_RETRIES: 10
  };

  let state = {
    videoElement: null,
    hasLiked: false,
    hasCommented: false,
    currentVideoId: null,
    initialProgress: 0,
    observer: null
  };

  async function getPersistentState(videoId) {
    if (!videoId) return { hasLiked: false, hasCommented: false };
    return new Promise((resolve) => {
      chrome.storage.local.get([videoId], (result) => {
        resolve(result[videoId] || { hasLiked: false, hasCommented: false });
      });
    });
  }

  async function savePersistentState(videoId, data) {
    if (!videoId) return;
    const update = {};
    update[videoId] = data;
    chrome.storage.local.set(update);
    
    // Keep storage footprint small
    chrome.storage.local.get(null, (allData) => {
      const keys = Object.keys(allData);
      if (keys.length > 50) {
        chrome.storage.local.remove(keys.slice(0, keys.length - 50));
      }
    });
  }

  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  function findVideoElement() {
    return document.querySelector(CONFIG.SELECTOR_VIDEO);
  }

  function findLikeButton() {
    const buttons = document.querySelectorAll(CONFIG.SELECTOR_LIKE_BUTTON);
    for (const button of buttons) {
      const ariaLabel = button.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.toLowerCase().includes('like') && !ariaLabel.toLowerCase().includes('dislike')) {
        return button;
      }
    }
    return null;
  }

  async function attemptLike() {
    if (state.hasLiked) return;
    const likeButton = findLikeButton();
    if (!likeButton) return;
    const ariaPressed = likeButton.getAttribute('aria-pressed');
    
    if (ariaPressed === 'true') {
      state.hasLiked = true;
      savePersistentState(state.currentVideoId, { hasLiked: true, hasCommented: state.hasCommented });
      return;
    }

    likeButton.click();
    state.hasLiked = true;
    savePersistentState(state.currentVideoId, { hasLiked: true, hasCommented: state.hasCommented });
  }

  async function attemptComment() {
    if (state.hasCommented) return;
    
    const placeholder = document.querySelector(CONFIG.SELECTOR_COMMENT_PLACEHOLDER);
    if (!placeholder) return;

    // Lock state immediately to prevent multiple triggers from handleTimeUpdate
    state.hasCommented = true;
    savePersistentState(state.currentVideoId, { hasLiked: state.hasLiked, hasCommented: true });

    placeholder.scrollIntoView({ behavior: 'smooth', block: 'center' });
    placeholder.click();

    setTimeout(() => {
      const textArea = document.querySelector(CONFIG.SELECTOR_COMMENT_TEXTAREA);
      const submitButton = document.querySelector(CONFIG.SELECTOR_COMMENT_SUBMIT);

      if (textArea && submitButton) {
        textArea.innerText = '';
        textArea.focus();
        document.execCommand('insertText', false, CONFIG.DEFAULT_COMMENT);
        textArea.dispatchEvent(new Event('input', { bubbles: true }));

        setTimeout(() => {
          if (!submitButton.disabled) {
            submitButton.click();
          }
        }, 500);
      } else {
        state.hasCommented = false;
      }
    }, 1500);
  }

  function handleTimeUpdate() {
    const video = state.videoElement;
    if (!video || !video.duration || isNaN(video.duration)) return;

    const progress = video.currentTime / video.duration;
    
    if (progress >= CONFIG.LIKE_THRESHOLD && !state.hasLiked) {
      attemptLike();
    }

    if (progress >= CONFIG.COMMENT_THRESHOLD && !state.hasCommented && state.initialProgress < CONFIG.COMMENT_THRESHOLD) {
      attemptComment();
    }
  }

  function resetState() {
    if (state.videoElement) {
      state.videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    }
    state.videoElement = null;
    state.hasLiked = false;
    state.hasCommented = false;
    state.initialProgress = 0;
    state.currentVideoId = getVideoId();
  }

  async function initializeVideoLogic() {
    const video = findVideoElement();
    const videoId = getVideoId();

    if (!video || !videoId) {
        return; 
    }

    if (state.videoElement !== video || state.currentVideoId !== videoId) {
      resetState();
      state.videoElement = video;
      state.currentVideoId = videoId;
      
      const persistent = await getPersistentState(videoId);
      state.hasLiked = persistent.hasLiked;
      state.hasCommented = persistent.hasCommented;

      if (video.duration && !isNaN(video.duration)) {
        state.initialProgress = video.currentTime / video.duration;
      } else {
        state.initialProgress = 0;
      }
      
      state.videoElement.addEventListener('timeupdate', handleTimeUpdate);
    }
  }

  function startNavigationObserver() {
    document.addEventListener('yt-navigate-finish', () => {
      setTimeout(initializeVideoLogic, 1000); 
    });
    setInterval(() => {
        const video = findVideoElement();
        if (video && video !== state.videoElement) {
            initializeVideoLogic();
        } else if (getVideoId() !== state.currentVideoId) {
             initializeVideoLogic();
        }
    }, CONFIG.POLL_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startNavigationObserver);
  } else {
    startNavigationObserver();
  }
  
  setTimeout(initializeVideoLogic, 1000);

})();
