'use strict';

import { micboard, updateHash } from './app.js';
import { renderGroup } from './channelview.js';
import { JsonUpdate } from './data.js';
import { groupEditToggle } from './dnd.js';

/**
 * Consistent navigation helper functions following SPA best practices
 * Based on web search results for optimal single-page application navigation
 */

/**
 * Navigate to main micboard view (all devices or specific group)
 * @param {number} groupId - Group ID (0 for all devices)
 * @param {boolean} forceRefresh - Whether to force data refresh
 */
export function navigateToMain(groupId = 0, forceRefresh = false) {
  console.log(`[Navigation] Navigating to main view, group=${groupId}, forceRefresh=${forceRefresh}`);
  
  // Set application state
  micboard.settingsMode = 'NONE';
  micboard.group = groupId;
  updateHash();
  
  // Hide all other views
  $('.integrations-page').hide();
  $('.settings').hide();
  $('.message-board').hide();
  $('.sidebar-nav').show();
  $('#micboard').show();
  
  if (forceRefresh) {
    // Force refresh data and then render
    Promise.resolve()
      .then(() => {
        console.log('[Navigation] Starting data refresh...');
        return JsonUpdate();
      })
      .then(() => {
        console.log('[Navigation] Data refresh complete, rendering group', groupId);
        // Log diagnostics
        const txCount = (micboard.transmitters || []).filter(Boolean).length;
        const slotCount = (micboard.config && micboard.config.slots) ? micboard.config.slots.length : 0;
        console.log('[Navigation] Post-refresh state: txCount=', txCount, 'slotCount=', slotCount);
        
        renderGroup(groupId);
        
        // Update live service indicator
        try {
          import('./app.js').then(m => m.updateLiveServiceIndicator && m.updateLiveServiceIndicator());
        } catch (e) {
          console.warn('[Navigation] Could not update live service indicator:', e);
        }
      })
      .catch((error) => {
        console.error('[Navigation] Data refresh failed, rendering anyway:', error);
        // Fall back to render without refresh
        renderGroup(groupId);
      });
  } else {
    // Just render directly
    console.log('[Navigation] Rendering group without refresh', groupId);
    renderGroup(groupId);
  }
  
  // Collapse mobile menu
  $('.collapse').collapse('hide');
}

/**
 * Navigate to config editor
 */
export function navigateToConfig() {
  console.log('[Navigation] Navigating to config editor');
  
  // Import and call initConfigEditor
  import('./config.js').then(module => {
    module.initConfigEditor();
  }).catch(error => {
    console.error('[Navigation] Failed to load config editor:', error);
  });
  
  // Collapse mobile menu
  $('.collapse').collapse('hide');
}

/**
 * Navigate to integrations
 */
export function navigateToIntegrations() {
  console.log('[Navigation] Navigating to integrations');
  
  // Import and call initIntegrationsUI
  import('./integrations.js').then(module => {
    module.initIntegrationsUI();
  }).catch(error => {
    console.error('[Navigation] Failed to load integrations:', error);
  });
  
  // Collapse mobile menu
  $('.collapse').collapse('hide');
}

/**
 * Navigate to extended name editor
 */
export function navigateToExtended() {
  console.log('[Navigation] Navigating to extended name editor');
  
  // Import and call slotEditToggle
  import('./extended.js').then(module => {
    module.slotEditToggle();
  }).catch(error => {
    console.error('[Navigation] Failed to load extended editor:', error);
  });
  
  // Collapse mobile menu
  $('.collapse').collapse('hide');
}

/**
 * Navigate to group editor
 */
export function navigateToGroupEdit() {
  console.log('[Navigation] Navigating to group editor');
  
  if (micboard.group !== 0) {
    import('./dnd.js').then(module => {
      module.groupEditToggle();
    }).catch(error => {
      console.error('[Navigation] Failed to load group editor:', error);
    });
  }
  
  // Collapse mobile menu
  $('.collapse').collapse('hide');
}

/**
 * Handle back navigation from any settings screen
 * This ensures consistent behavior when returning to main view
 */
export function navigateBack() {
  console.log('[Navigation] Handling back navigation from settings screen');
  
  // Always force refresh when coming back from settings
  // This ensures data consistency regardless of what was changed
  navigateToMain(0, true);
}

/**
 * Initialize consistent navigation system
 * Call this to replace existing navigation handlers
 */
export function initConsistentNavigation() {
  console.log('[Navigation] Initializing consistent navigation system');
  
  // Remove any existing handlers to avoid duplicates
  $('#go-config').off('click');
  $('#go-integrations').off('click');
  $('#go-extended').off('click');
  $('#go-groupedit').off('click');
  $('.preset-link').off('click');
  
  // Set up consistent navigation handlers
  $('#go-config').on('click', (e) => {
    e.preventDefault();
    navigateToConfig();
  });
  
  $('#go-integrations').on('click', (e) => {
    e.preventDefault();
    navigateToIntegrations();
  });
  
  $('#go-extended').on('click', (e) => {
    e.preventDefault();
    navigateToExtended();
  });
  
  // Debounce to avoid double toggle from duplicate bindings or rapid clicks
  let lastGroupEditClick = 0;
  $('#go-groupedit').on('click', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastGroupEditClick < 900) {
      return; // ignore double-fire within 300ms
    }
    lastGroupEditClick = now;
    groupEditToggle();
    $('.collapse').collapse('hide');
  });
  
  // Handle group navigation (preset-links)
  $('.preset-link').each(function() {
    const $link = $(this);
    const id = $link.attr('id');
    
    if (id && id.startsWith('go-group-')) {
      const groupId = parseInt(id.replace('go-group-', ''), 10);
      
      $link.on('click', (e) => {
        e.preventDefault();
        navigateToMain(groupId, false);
      });
    }
  });
  
  console.log('[Navigation] Consistent navigation system initialized');
}
