(function() {
  'use strict';
  const CONFIG = {
    LIKE_THRESHOLD: 0.30, // 30% watch progress
    SELECTOR_VIDEO: 'video',
    SELECTOR_LIKE_BUTTON: 'like-button-view-model button[aria-label], ytd-toggle-button-renderer button[aria-label*="like" i]',
    POLL_INTERVAL: 1000,
    MAX_RETRIES: 10
  };

  let state = {
    videoElement: null,
    hasLiked: false,
    currentVideoId: null,
    observer: null
  };

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

  function attemptLike() {
    if (state.hasLiked) return;
    const likeButton = findLikeButton();
    if (!likeButton) return;
    const ariaPressed = likeButton.getAttribute('aria-pressed');
    if (ariaPressed === 'true') {
      state.hasLiked = true;
      return;
    }

    likeButton.click();
    state.hasLiked = true;
  }

  function handleTimeUpdate() {
    const video = state.videoElement;
    if (!video || !video.duration || isNaN(video.duration)) return;

    const progress = video.currentTime / video.duration;
    if (progress >= CONFIG.LIKE_THRESHOLD && !state.hasLiked) {
      attemptLike();
    }
  }

  function resetState() {
    if (state.videoElement) {
      state.videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    }
    state.videoElement = null;
    state.hasLiked = false;
    state.currentVideoId = getVideoId();
  }

  function initializeVideoLogic() {
    const video = findVideoElement();
    const videoId = getVideoId();

    if (!video) {
        return; 
    }

    if (state.videoElement !== video || state.currentVideoId !== videoId) {
      resetState();
      state.videoElement = video;
      state.currentVideoId = videoId;
      
      state.videoElement.addEventListener('timeupdate', handleTimeUpdate);
      handleTimeUpdate();
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
