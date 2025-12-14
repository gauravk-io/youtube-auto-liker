(function() {
  'use strict';
  let state = {
    videoElement: null,
    hasLiked: false,
    lastUrl: null,
    timeUpdateHandler: null
  };

  const CONFIG = {
    LIKE_THRESHOLD: 0.40, // 40% watch progress
    SELECTOR_VIDEO: 'video',
    SELECTOR_LIKE_BUTTON: 'like-button-view-model button[aria-label], ytd-toggle-button-renderer button[aria-label*="like" i]',
    DEBOUNCE_MS: 500
  };

  function findVideoElement() {
    const videos = document.querySelectorAll(CONFIG.SELECTOR_VIDEO);
    for (const video of videos) {
      if (video.duration && video.duration > 0) {
        return video;
      }
    }
    return null;
  }

  function findLikeButton() {
    const buttons = document.querySelectorAll(CONFIG.SELECTOR_LIKE_BUTTON);
    
    for (const button of buttons) {
      const ariaLabel = button.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.toLowerCase().includes('like')) {
        if (!ariaLabel.toLowerCase().includes('dislike')) {
          return button;
        }
      }
    }
    return null;
  }

  function isVideoLiked(likeButton) {
    if (!likeButton) return false;
    const ariaPressed = likeButton.getAttribute('aria-pressed');
    return ariaPressed === 'true';
  }

  function likeVideo() {
    const likeButton = findLikeButton();
    
    if (!likeButton) {
      return { success: false, alreadyLiked: false };
    }

    if (isVideoLiked(likeButton)) {
      return { success: true, alreadyLiked: true };
    }

    likeButton.click();
    return { success: true, alreadyLiked: false };
  }

  function onTimeUpdate() {
    const video = state.videoElement;
    if (!video || !video.duration) return;

    const currentTime = video.currentTime;
    const duration = video.duration;
    const watchPercentage = currentTime / duration;

    if (!state.hasLiked && watchPercentage >= CONFIG.LIKE_THRESHOLD) {
      const result = likeVideo();
      if (result.success) {
        state.hasLiked = true;
        if (!result.alreadyLiked) {
          console.log('[YouTube Auto-Liker] Video liked');
        }
        cleanupVideoListeners();
      }
    }
  }

  function cleanupVideoListeners() {
    if (state.videoElement && state.timeUpdateHandler) {
      state.videoElement.removeEventListener('timeupdate', state.timeUpdateHandler);
    }
    state.timeUpdateHandler = null;
  }

  function attachVideoListeners(video) {
    cleanupVideoListeners();

    let debounceTimer = null;
    state.timeUpdateHandler = function() {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        onTimeUpdate();
        debounceTimer = null;
      }, CONFIG.DEBOUNCE_MS);
    };

    video.addEventListener('timeupdate', state.timeUpdateHandler);
  }

  function initializeForVideo() {
    const video = findVideoElement();
    if (!video) return;

    const currentUrl = window.location.href;
    const isNewVideo = video !== state.videoElement || currentUrl !== state.lastUrl;

    if (isNewVideo) {
      state.videoElement = video;
      state.hasLiked = false;
      state.lastUrl = currentUrl;
      attachVideoListeners(video);
    }
  }

  function observeUrlChanges() {
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setTimeout(initializeForVideo, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    initializeForVideo();
    observeUrlChanges();
    
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(initializeForVideo, 500);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
