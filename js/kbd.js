'use strict';

import { micboard, updateHash, generateQR } from './app.js';
import { toggleInfoDrawer, toggleImageBackground, toggleVideoBackground, toggleDisplayMode } from './display';
import { renderGroup } from './channelview.js';
import { groupEditToggle, initEditor } from './dnd.js';
import { slotEditToggle } from './extended.js';
import { initConfigEditor } from './config.js';


// https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
function toggleFullScreen() {
  if (!document.webkitFullscreenElement) {
    document.documentElement.webkitRequestFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

export function keybindings() {
  if (window.__MB_KBD_BOUND) {
    return;
  }
  window.__MB_KBD_BOUND = true;
  $('#hud-button').click( function() {
    $('#hud').hide();
  });


  let lastEAt = 0;
  document.addEventListener('keydown', (e) => {
    // Ignore keystrokes while typing in inputs/textareas/selects or contentEditable
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
      return;
    }
    if (e.repeat) {
      return;
    }
    if (e.key === 'Escape') {
      micboard.settingsMode = 'NONE';
      updateHash();
      window.location.reload();
    }
    if ($('.settings').is(':visible')) {
      return;
    }
    if ($('.editzone').is(':visible')) {
      return;
    }
    // Do not block keyboard shortcuts merely because the left nav is visible

    // Use consistent navigation for keyboard shortcuts
    if (e.key >= '0' && e.key <= '9') {
      const groupId = parseInt(e.key, 10);
      import('./navigation.js').then(nav => {
        nav.navigateToMain(groupId, false);
      }).catch(error => {
        console.error('Failed to load navigation module for keyboard shortcut, using fallback:', error);
        renderGroup(groupId);
      });
    }

    if (e.key === 'd') {
      micboard.url.demo = !micboard.url.demo;
      updateHash();
      window.location.reload();
    }

    if (e.key === 'e') {
      if (micboard.group !== 0) {
        const now = Date.now();
        if (now - lastEAt < 900) {
          return;
        }
        lastEAt = now;
        groupEditToggle();
      }
    }

    if (e.key === 'f') {
      toggleFullScreen();
    }

    if (e.key === 'g') {
      toggleImageBackground();
    }

    if (e.key === 'i') {
      toggleInfoDrawer();
    }

    if (e.key === 'n') {
      slotEditToggle();
    }

    if (e.key === 'N') {
      slotEditToggle();
      $('#paste-box').show();
    }

    if (e.key === 's') {
      import('./navigation.js').then(nav => {
        nav.navigateToConfig();
      }).catch(error => {
        console.error('Failed to load navigation module for keyboard shortcut, using fallback:', error);
        initConfigEditor();
      });
    }

    if (e.key === 'q') {
      generateQR();
      $('.modal').modal('toggle');
    }

    if (e.key === 't') {
      toggleDisplayMode();
    }

    if (e.key === 'v') {
      toggleVideoBackground();
    }

    if (e.key === '?') {
      $('#hud').toggle();
    }
  }, false);
}
