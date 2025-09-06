'use strict';

import { micboard, updateHash } from './app.js';
import { postJSON } from './data.js';
import { renderGroup } from './channelview.js';
import { JsonUpdate } from './data.js';

let integrationsConfig = {};
let serviceTypes = [];
let allTeams = {};
let allPositions = {};

export function initIntegrationsUI() {
  if (micboard.settingsMode === 'INTEGRATIONS') {
    return;
  }

  micboard.settingsMode = 'INTEGRATIONS';
  updateHash();
  
  // Hide all other pages
  $('#micboard').hide();
  $('.settings').hide();
  $('.sidebar-nav').hide();
  $('.message-board').hide();
  
  // Show integrations page
  $('.integrations-page').show();

  // Check if integration elements exist before proceeding
  if (!document.getElementById('pco-authorize')) {
    console.warn('Integration UI elements not found');
    return;
  }

  // Load current integrations config
  loadIntegrationsConfig();

  // Set up event handlers
  setupEventHandlers();
  
  // Show loading message for schedule
  const scheduleStatusElement = document.getElementById('pco-schedule-status');
  if (scheduleStatusElement) {
    scheduleStatusElement.innerHTML = '<span class="text-info">Initializing...</span>';
  }
  
  // Show loading message for schedule content
  const scheduleContentElement = document.getElementById('pco-schedule-content');
  if (scheduleContentElement) {
    scheduleContentElement.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
        <h5>Loading Schedule</h5>
        <p>Please wait while we fetch your Planning Center schedule...</p>
      </div>
    `;
  }
  
  // Auto-refresh schedule cache if PCO is configured
  setTimeout(() => {
    const pcoConfig = integrationsConfig.planning_center || {};
    if (pcoConfig.client_id && pcoConfig.client_secret) {
      console.log('PCO configured, auto-refreshing schedule cache...');
      
      // First test if the endpoint is working
      fetch('/api/pco/health')
        .then(response => response.json())
        .then(data => {
          console.log('PCO health check:', data);
          
          // Now try to refresh the schedule cache
          return fetch('/api/pco/force-refresh-schedule', { method: 'POST' });
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.status === 'success') {
            console.log('Schedule cache auto-refreshed successfully');
            // Load the schedule after cache refresh
            setTimeout(() => {
              loadDailySchedule();
            }, 1000);
          } else {
            throw new Error(data.message || 'Cache refresh failed');
          }
        })
        .catch(error => {
          console.error('Auto-refresh schedule cache error:', error);
          // Show error message in schedule content
          const scheduleContentElement = document.getElementById('pco-schedule-content');
          if (scheduleContentElement) {
            scheduleContentElement.innerHTML = `
              <div class="text-center text-warning py-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <h5>Cache Refresh Failed</h5>
                <p>Failed to refresh the schedule cache from Planning Center.</p>
                <p class="small">Error: ${error.message}</p>
                <p class="small">Trying to load schedule directly...</p>
                <button class="btn btn-outline-warning btn-sm" onclick="loadDailySchedule()">
                  <i class="fas fa-sync-alt"></i> Load Schedule
                </button>
              </div>
            `;
            
            // Try to load the schedule directly as a fallback
            setTimeout(() => {
              loadDailySchedule();
            }, 2000);
          }
        });
    }
  }, 2000); // Wait 2 seconds for config to load
}

function loadIntegrationsConfig() {
  fetch('/api/integrations')
    .then(response => response.json())
    .then(data => {
      integrationsConfig = data;
      updateUI();
    })
    .catch(error => {
      console.error('Error loading integrations config:', error);
    });
}

function updateUI() {
  // Check if elements exist before updating
  if (!document.getElementById('pco-auth-status')) {
    return;
  }

  // Update PCO section
  const pcoConfig = integrationsConfig.planning_center || {};
  if (pcoConfig.client_id && pcoConfig.client_secret) {
    $('#pco-auth-status').html('<span class="text-success">Authorized</span>');
    $('#pco-settings').show();
    $('#pco-daily-schedule').show();
    loadPCOSettings();
    loadDailySchedule();
  } else {
    $('#pco-auth-status').html('<span class="text-muted">Not authorized</span>');
    $('#pco-settings').hide();
    $('#pco-daily-schedule').hide();
  }

  // Update Drive section
  const driveConfig = integrationsConfig.google_drive || {};
  if (driveConfig.tokens && driveConfig.tokens.access_token) {
    $('#drive-auth-status').html('<span class="text-success">Authorized</span>');
    $('#drive-settings').show();
    loadDriveFolders(); // Load folders when Drive is authorized
  } else {
    $('#drive-auth-status').html('<span class="text-muted">Not authorized</span>');
    $('#drive-settings').hide();
  }
}

function loadPCOSettings() {
  const pcoConfig = integrationsConfig.planning_center || {};
  
  // Check if elements exist
  if (!document.getElementById('pco-service-types')) {
    return;
  }
  
  // Load service types
  fetch('/api/pco/service-types')
    .then(response => response.json())
    .then(types => {
      serviceTypes = types;
      const select = $('#pco-service-types');
      select.empty();
      
      // Get currently selected service types from config
      const selectedTypes = pcoConfig.service_types || [];
      const selectedTypeIds = selectedTypes.map(st => st.id);
      
      types.forEach(type => {
        const option = $('<option>')
          .val(type.id)
          .text(`${type.name} (${type.frequency})`);
        
        // Check if this service type is selected
        if (selectedTypeIds.includes(type.id)) {
          option.prop('selected', true);
        }
        
        select.append(option);
      });
      
      // Load teams for selected service types if any are selected
      if (selectedTypeIds.length > 0) {
        loadTeamsAndPositions(selectedTypeIds);
      }
    })
    .catch(error => {
      console.error('Error loading service types:', error);
    });

  // Set other fields
  $('#pco-lead-time').val(pcoConfig.lead_time_hours || 2);
  $('#pco-manual-plan').val(pcoConfig.manual_plan_id || '');
}

function loadTeamsAndPositions(serviceTypeIds) {
  if (!serviceTypeIds || serviceTypeIds.length === 0) {
    return;
  }
  
  // Load teams
  const teamsUrl = `/api/pco/teams?${serviceTypeIds.map(id => `service_type_ids[]=${id}`).join('&')}`;
  fetch(teamsUrl)
    .then(response => response.json())
    .then(teams => {
      allTeams = {};
      teams.forEach(team => {
        allTeams[team.name] = team;
      });
    })
    .catch(error => {
      console.error('Error loading teams:', error);
      alert('Error loading teams: ' + error.message);
    });
}

async function buildPCOStructure(serviceTypeIds) {
  console.log('Building PCO structure for service types:', serviceTypeIds);
  
  const pcoConfig = integrationsConfig.planning_center || {};
  const updatedServiceTypes = [];
  
  for (const serviceTypeId of serviceTypeIds) {
    console.log(`Building structure for service type: ${serviceTypeId}`);
    
    // Get teams for this service type
    const teamsUrl = `/api/pco/teams?service_type_ids[]=${serviceTypeId}`;
    const teamsResponse = await fetch(teamsUrl);
    const teams = await teamsResponse.json();
    
    const serviceTypeStructure = {
      id: serviceTypeId,
      teams: [],
      reuse_rules: pcoConfig.service_types?.find(st => st.id === serviceTypeId)?.reuse_rules || []
    };
    
    // Build team structure with positions
    for (const team of teams) {
      console.log(`Building structure for team: ${team.name} (ID: ${team.id})`);
      
      // Get positions for this team in this service type
      const positionsUrl = `/api/pco/positions?service_type_ids[]=${serviceTypeId}&team_name=${encodeURIComponent(team.name)}`;
      const positionsResponse = await fetch(positionsUrl);
      const positions = await positionsResponse.json();
      
      const teamStructure = {
        name: team.name,
        id: team.id,
        positions: positions.map(pos => ({
          name: pos.name,
          id: pos.id
        }))
      };
      
      serviceTypeStructure.teams.push(teamStructure);
    }
    
    updatedServiceTypes.push(serviceTypeStructure);
  }
  
  // Update the config
  integrationsConfig.planning_center = {
    ...pcoConfig,
    service_types: updatedServiceTypes
  };
  
  console.log('Updated PCO structure:', integrationsConfig.planning_center);
  
  // Save the updated config
  await savePCOSettings();
  
  return updatedServiceTypes;
}

function setupEventHandlers() {
  // Check if elements exist before adding handlers
  const pcoAuthorize = document.getElementById('pco-authorize');
  const driveAuthorize = document.getElementById('drive-authorize');
  
  if (!pcoAuthorize || !driveAuthorize) {
    return;
  }

  // Back button - use consistent navigation
  $('#integrations-back').on('click', function() {
    import('./navigation.js').then(nav => {
      nav.navigateBack();
    }).catch(error => {
      console.error('[Integrations] Failed to load navigation module:', error);
      // Fallback to direct navigation
      $('.integrations-page').hide();
      $('#micboard').show();
      $('.sidebar-nav').show();
      micboard.settingsMode = 'NONE';
      updateHash();
      renderGroup(0);
    });
  });

  // Load saved OAuth credentials
  loadOAuthCredentials();

  // Save OAuth credentials
  $('#save-oauth-credentials').on('click', saveOAuthCredentials);

  // PCO Authorization
  $('#pco-authorize').on('click', function() {
    // Use fetch instead of opening a new window
    fetch('/api/pco/authorize')
      .then(response => {
        if (!response.ok) {
          throw new Error('Authorization failed');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Update the UI to show authorized status
          $('#pco-auth-status').html('<span class="text-success">Authorized</span>');
          $('#pco-settings').show();
          loadPCOSettings();
          alert('Planning Center credentials validated successfully!');
        } else {
          alert('Authorization failed: ' + (data.message || 'Unknown error'));
        }
      })
      .catch(error => {
        console.error('PCO authorization error:', error);
        alert('Authorization failed: ' + error.message);
      });
  });

  // PCO Manual Sync
  $('#pco-sync-now').on('click', function() {
    $('#pco-sync-status').html('<span class="text-warning">Syncing...</span>');
    
    fetch('/api/pco/sync', { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          $('#pco-sync-status').html('<span class="text-success">Sync completed</span>');
        } else {
          $('#pco-sync-status').html('<span class="text-danger">Sync failed</span>');
        }
      })
      .catch(error => {
        console.error('PCO sync error:', error);
        $('#pco-sync-status').html('<span class="text-danger">Error</span>');
      });
  });

  // PCO Reset Sync State
  $('#pco-reset-sync').on('click', function() {
    $('#pco-reset-status').html('<span class="text-warning">Resetting...</span>');
    
    fetch('/api/pco/reset', { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          $('#pco-reset-status').html('<span class="text-success">Reset completed</span>');
        } else {
          $('#pco-reset-status').html('<span class="text-danger">Reset failed</span>');
        }
      })
      .catch(error => {
        console.error('PCO reset error:', error);
        $('#pco-reset-status').html('<span class="text-danger">Error</span>');
      });
  });

  // PCO Refresh Structure
  $('#pco-refresh-structure').on('click', async function() {
    const button = $(this);
    const statusSpan = $('#pco-refresh-status');
    
    button.prop('disabled', true);
    statusSpan.html('<span class="text-warning">Refreshing PCO structure...</span>');
    
    try {
      const pcoConfig = integrationsConfig.planning_center || {};
      const selectedServiceTypes = pcoConfig.service_types || [];
      const serviceTypeIds = selectedServiceTypes.map(st => st.id);
      
      if (serviceTypeIds.length === 0) {
        statusSpan.html('<span class="text-danger">No service types selected</span>');
        return;
      }
      
      await buildPCOStructure(serviceTypeIds);
      statusSpan.html('<span class="text-success">PCO structure refreshed successfully</span>');
      
      // Reload the config page if it's open to show updated structure
      if (micboard.settingsMode === 'CONFIG') {
        // Trigger a reload of the config page
        window.location.reload();
      }
      
    } catch (error) {
      console.error('Error refreshing PCO structure:', error);
      statusSpan.html('<span class="text-danger">Refresh failed: ' + error.message + '</span>');
    } finally {
      button.prop('disabled', false);
    }
  });
  
  // Drive Authorization
  $('#drive-authorize').on('click', function() {
    window.open('/api/drive/authorize', 'drive_auth', 'width=600,height=800');
  });
  
  // Drive folder refresh
  $('#drive-refresh-folders').on('click', loadDriveFolders);
  
  // Drive file status refresh
  $('#drive-refresh-status').on('click', loadDriveFileStatus);
  
  // Drive folder selection change
  $('#drive-folder-select').on('change', function() {
    const folderId = $(this).val();
    if (folderId) {
      loadDriveFileStatus();
    } else {
      $('#drive-file-status').hide();
    }
  });
  
  // Service type selection change
  $('#pco-service-types').on('change', function() {
    const selectedIds = $(this).val() || [];
    if (selectedIds.length > 0) {
      loadTeamsAndPositions(selectedIds);
    }
  });
  
  // Save PCO settings
  $('#pco-save').on('click', savePCOSettings);
  
  // Save Drive settings
  $('#drive-save').on('click', saveDriveSettings);
  
  // Listen for OAuth success messages
  // PCO Daily Schedule refresh
  $('#pco-refresh-schedule').on('click', function() {
    loadDailySchedule();
  });
  
  // PCO Force Schedule Cache Refresh
  $('#pco-force-refresh-schedule').on('click', function() {
    const button = $(this);
    const statusSpan = $('#pco-schedule-status');
    
    button.prop('disabled', true);
    statusSpan.html('<span class="text-warning">Force refreshing schedule cache...</span>');
    
    fetch('/api/pco/force-refresh-schedule', { method: 'POST' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'success') {
          statusSpan.html('<span class="text-success">Cache refreshed, loading schedule...</span>');
          // Wait a moment for the cache to update, then load the schedule
          setTimeout(() => {
            loadDailySchedule();
          }, 1000);
        } else {
          statusSpan.html('<span class="text-danger">Cache refresh failed: ' + (data.message || 'Unknown error') + '</span>');
        }
      })
      .catch(error => {
        console.error('PCO force refresh error:', error);
        statusSpan.html('<span class="text-danger">Error refreshing cache: ' + error.message + '</span>');
      })
      .finally(() => {
        button.prop('disabled', false);
      });
  });
  
  // PCO Check Schedule Cache Status
  $('#pco-check-cache').on('click', function() {
    const button = $(this);
    const statusSpan = $('#pco-schedule-status');
    
    button.prop('disabled', true);
    statusSpan.html('<span class="text-info">Checking cache status...</span>');
    
    fetch('/api/pco/cache-status')
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          const cacheInfo = data.cache_info;
          const lastUpdate = new Date(cacheInfo.generated_at).toLocaleString();
          const daysWindow = cacheInfo.days;
          statusSpan.html(`<span class="text-success">Cache: ${daysWindow} days, last updated: ${lastUpdate}</span>`);
        } else {
          statusSpan.html('<span class="text-warning">Cache status unavailable</span>');
        }
      })
      .catch(error => {
        console.error('PCO cache status error:', error);
        statusSpan.html('<span class="text-danger">Error checking cache</span>');
      })
      .finally(() => {
        button.prop('disabled', false);
      });
  });
  
  window.addEventListener('message', function(event) {
    if (event.data.type === 'pco_auth_success') {
      loadIntegrationsConfig();
    } else if (event.data.type === 'drive_auth_success') {
      loadIntegrationsConfig();
      loadDriveFolders(); // Load folders after successful auth
    }
  });
}

function savePCOSettings() {
  const selectedServiceTypes = $('#pco-service-types').val() || [];
  const leadTimeHours = parseInt($('#pco-lead-time').val()) || 2;
  const manualPlanId = $('#pco-manual-plan').val() || null;
  
  if (selectedServiceTypes.length === 0) {
    alert('Please select at least one service type');
    return;
  }
  
  // Preserve existing configuration
  const existingConfig = integrationsConfig.planning_center || {};
  const existingServiceTypes = existingConfig.service_types || [];
  
  // Build service types configuration, preserving existing mappings
  const serviceTypesConfig = [];
  
  selectedServiceTypes.forEach(serviceTypeId => {
    // Find existing config for this service type
    const existingServiceType = existingServiceTypes.find(st => st.id === serviceTypeId);
    
    const config = {
      id: serviceTypeId,
      teams: existingServiceType?.teams || [],
      reuse_rules: existingServiceType?.reuse_rules || []
    };
    serviceTypesConfig.push(config);
  });
  
  // Update integrations config
  if (!integrationsConfig.planning_center) {
    integrationsConfig.planning_center = {};
  }
  
  integrationsConfig.planning_center.lead_time_hours = leadTimeHours;
  integrationsConfig.planning_center.service_types = serviceTypesConfig;
  integrationsConfig.planning_center.manual_plan_id = manualPlanId;
  
  // Save to server
  postJSON('/api/integrations', { planning_center: integrationsConfig.planning_center }, () => {
    alert('Planning Center settings saved successfully!');
    
    // Trigger PCO sync after saving settings
    console.log('Triggering PCO sync after settings update...');
    fetch('/api/pco/sync', { method: 'POST' })
      .then(response => {
        if (response.ok) {
          console.log('PCO sync completed after settings update');
        }
      })
      .catch(error => {
        console.error('Error triggering PCO sync after settings update:', error);
      });
  });
}

function saveDriveSettings() {
  const folderId = $('#drive-folder-select').val();
  
  if (!folderId) {
    alert('Please select a Drive folder');
    return;
  }
  
  // Update integrations config
  if (!integrationsConfig.google_drive) {
    integrationsConfig.google_drive = {};
  }
  
  integrationsConfig.google_drive.folder_id = folderId;
  
  // Save to server
  postJSON('/api/integrations', { google_drive: integrationsConfig.google_drive }, () => {
    alert('Google Drive settings saved successfully!');
  });
}

function loadDriveFolders() {
  fetch('/api/drive/folders')
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Google Drive not authorized. Please authorize first.');
        } else if (response.status === 400) {
          // Try to get the specific error message from the response
          return response.json().then(data => {
            throw new Error(data.error || 'Google Drive configuration error');
          });
        }
        throw new Error('Failed to load folders');
      }
      return response.json();
    })
    .then(data => {
      const select = $('#drive-folder-select');
      select.empty();
      select.append('<option value="">Select a folder...</option>');
      
      if (data.folders && data.folders.length > 0) {
        data.folders.forEach(folder => {
          const option = $('<option></option>')
            .val(folder.id)
            .text(folder.name);
          select.append(option);
        });
        
        // Set current selection if available
        const currentFolderId = integrationsConfig.google_drive?.folder_id;
        if (currentFolderId) {
          select.val(currentFolderId);
        }
      } else {
        select.append('<option value="" disabled>No folders found</option>');
      }
    })
    .catch(error => {
      console.error('Error loading Drive folders:', error);
      alert('Error loading folders: ' + error.message);
    });
}

function loadDriveFileStatus() {
  const folderId = $('#drive-folder-select').val();
  if (!folderId) {
    return;
  }
  
  fetch(`/api/drive/files-status?folder_id=${encodeURIComponent(folderId)}`)
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Google Drive not authorized. Please authorize first.');
        } else if (response.status === 400) {
          // Try to get the specific error message from the response
          return response.json().then(data => {
            throw new Error(data.error || 'Google Drive configuration error');
          });
        }
        throw new Error('Failed to load file status');
      }
      return response.json();
    })
    .then(data => {
      const tbody = $('#drive-files-tbody');
      tbody.empty();
      
      let hasDownloadingFiles = false;
      
      if (data.files && data.files.length > 0) {
        data.files.forEach(file => {
          const row = $('<tr>');
          
          // File name
          row.append($('<td>').text(file.name));
          
          // Local name
          row.append($('<td>').text(file.local_name));
          
          // Status with icon
          const statusCell = $('<td>');
          let statusIcon, statusText, statusClass;
          
          switch (file.status) {
            case 'synced':
              statusIcon = '<i class="fas fa-check-circle text-success"></i>';
              statusText = 'Synced';
              statusClass = 'text-success';
              break;
            case 'downloading':
              statusIcon = '<i class="fas fa-sync-alt fa-spin text-primary"></i>';
              statusText = 'Downloading...';
              statusClass = 'text-primary';
              hasDownloadingFiles = true;
              break;
            case 'outdated':
              statusIcon = '<i class="fas fa-exclamation-triangle text-warning"></i>';
              statusText = 'Outdated';
              statusClass = 'text-warning';
              break;
            case 'not_synced':
              statusIcon = '<i class="fas fa-times-circle text-danger"></i>';
              statusText = 'Not Synced';
              statusClass = 'text-danger';
              break;
            default:
              statusIcon = '<i class="fas fa-question-circle text-muted"></i>';
              statusText = 'Unknown';
              statusClass = 'text-muted';
          }
          
          statusCell.html(`${statusIcon} <span class="${statusClass}">${statusText}</span>`);
          row.append(statusCell);
          
          tbody.append(row);
        });
        
        $('#drive-file-status').show();
        
        // Auto-refresh if there are downloading files
        if (hasDownloadingFiles) {
          setTimeout(loadDriveFileStatus, 2000); // Refresh every 2 seconds
        }
      } else {
        tbody.append('<tr><td colspan="3" class="text-muted">No files found in this folder</td></tr>');
        $('#drive-file-status').show();
      }
    })
    .catch(error => {
      console.error('Error loading Drive file status:', error);
      alert('Error loading file status: ' + error.message);
    });
}

function loadOAuthCredentials() {
  // Load from localStorage
  const pcoClientId = localStorage.getItem('pco_client_id') || '';
  const pcoClientSecret = localStorage.getItem('pco_client_secret') || '';
  const googleClientId = localStorage.getItem('google_client_id') || '';
  const googleClientSecret = localStorage.getItem('google_client_secret') || '';
  
  // Populate form fields
  $('#pco-client-id').val(pcoClientId);
  $('#pco-client-secret').val(pcoClientSecret);
  $('#google-client-id').val(googleClientId);
  $('#google-client-secret').val(googleClientSecret);
}

function saveOAuthCredentials() {
  const pcoClientId = $('#pco-client-id').val().trim();
  const pcoClientSecret = $('#pco-client-secret').val().trim();
  const googleClientId = $('#google-client-id').val().trim();
  const googleClientSecret = $('#google-client-secret').val().trim();
  
  // Validate that at least one set of credentials is provided
  if ((!pcoClientId || !pcoClientSecret) && (!googleClientId || !googleClientSecret)) {
    alert('Please enter at least one set of credentials (PCO Client ID/Secret or Google Client ID/Secret)');
    return;
  }
  
  // Save to localStorage
  localStorage.setItem('pco_client_id', pcoClientId);
  localStorage.setItem('pco_client_secret', pcoClientSecret);
  localStorage.setItem('google_client_id', googleClientId);
  localStorage.setItem('google_client_secret', googleClientSecret);
  
  // Send to server
  fetch('/api/oauth-credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pco_client_id: pcoClientId,
      pco_client_secret: pcoClientSecret,
      google_client_id: googleClientId,
      google_client_secret: googleClientSecret
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      $('#oauth-save-status').html('<span class="text-success">✓ Credentials saved successfully!</span>');
      setTimeout(() => {
        $('#oauth-save-status').html('');
      }, 3000);
    } else {
      $('#oauth-save-status').html('<span class="text-danger">✗ Error: ' + data.error + '</span>');
    }
  })
  .catch(error => {
    console.error('Error saving OAuth credentials:', error);
    $('#oauth-save-status').html('<span class="text-danger">✗ Error saving credentials</span>');
  });
}

function loadDailySchedule() {
  const statusElement = document.getElementById('pco-schedule-status');
  const contentElement = document.getElementById('pco-schedule-content');
  
  if (!statusElement || !contentElement) {
    return;
  }
  
  statusElement.innerHTML = '<span class="text-info">Loading...</span>';
  
  // Use the new unified upcoming-plans endpoint
  fetch('/api/pco/upcoming-plans')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'success') {
        statusElement.innerHTML = '<span class="text-success">Loaded</span>';
        console.log('Upcoming plans received:', data.plans);
        
        if (!data.plans || data.plans.length === 0) {
          contentElement.innerHTML = '<div class="text-muted">No upcoming services scheduled</div>';
          return;
        }
        
        // Display the unified plan list
        displayUpcomingPlans(data.plans, data.current_plan_id);
      } else {
        throw new Error(data.error || 'Failed to load plans');
      }
    })
    .catch(error => {
      console.error('Error loading schedule:', error);
      statusElement.innerHTML = '<span class="text-danger">Error loading schedule</span>';
      contentElement.innerHTML = `<div class="text-danger">Failed to load schedule: ${error.message}</div>`;
    });
}

// New function to display unified upcoming plans
function displayUpcomingPlans(plans, currentPlanId) {
  const contentElement = document.getElementById('pco-schedule-content');
  
  if (!contentElement) {
    return;
  }
  
  // Add CSS styles for better visibility
  let html = `
    <style>
      .upcoming-plans {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .plan-item {
        border: 1px solid #495057;
        border-radius: 8px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: #e9ecef;
        transition: all 0.2s;
      }
      .plan-item:hover {
        border-color: #007bff;
        background: rgba(255, 255, 255, 0.12);
      }
      .plan-item.live {
        border-color: #28a745;
        background: rgba(40, 167, 69, 0.15);
      }
      .plan-item.manual-live {
        border-color: #ffc107;
        background: rgba(255, 193, 7, 0.15);
      }
      .plan-item.ready {
        border-color: #17a2b8;
        background: rgba(23, 162, 184, 0.15);
      }
      .plan-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        color: #f8f9fa;
      }
      .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
      }
      .status-badge.live {
        background: #28a745;
        color: white;
      }
      .status-badge.manual-live {
        background: #ffc107;
        color: #333;
      }
      .status-badge.ready {
        background: #17a2b8;
        color: white;
      }
      .status-badge.upcoming {
        background: #6c757d;
        color: white;
      }
      .plan-details {
        margin-bottom: 10px;
      }
      .plan-title {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 4px;
        color: #f8f9fa;
      }
      .plan-times {
        font-size: 12px;
        color: #adb5bd;
        margin-bottom: 4px;
      }
      .plan-slots {
        font-size: 12px;
        color: #adb5bd;
      }
      .plan-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }
      .plan-actions .text-success {
        color: #28a745 !important;
      }
      .plan-actions .text-muted {
        color: #6c757d !important;
      }
    </style>
    <div class="upcoming-plans">
  `;
  
  plans.forEach(plan => {
    const liveTime = new Date(plan.live_time);
    const serviceTime = new Date(plan.service_time);
    const now = new Date();
    
    // Determine status
    let statusClass = '';
    let statusText = '';
    
    if (plan.plan_id === currentPlanId) {
      if (plan.is_manual) {
        statusClass = 'manual-live';
        statusText = 'LIVE (Manual)';
      } else {
        statusClass = 'live';
        statusText = 'LIVE';
      }
    } else if (liveTime <= now && now < serviceTime) {
      statusClass = 'ready';
      statusText = 'Ready';
    } else {
      statusClass = 'upcoming';
      statusText = 'Upcoming';
    }
    
    // Format times
    const liveTimeStr = liveTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const serviceTimeStr = serviceTime.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Count assigned slots
    const slotCount = Object.keys(plan.slot_assignments || {}).length;
    
    html += `
      <div class="plan-item ${statusClass}" data-plan-id="${plan.plan_id}">
        <div class="plan-header">
          <span class="status-badge ${statusClass}">${statusText}</span>
          <strong>${plan.service_type_name}</strong>
        </div>
        <div class="plan-details">
          <div class="plan-title">${plan.title || plan.dates}</div>
          <div class="plan-times">
            <span>Live: ${liveTimeStr}</span>
            <span class="mx-2">|</span>
            <span>Service: ${serviceTimeStr}</span>
          </div>
          <div class="plan-slots">
            <i class="fas fa-microphone"></i> ${slotCount} slots assigned
          </div>
        </div>
        <div class="plan-actions">
          ${renderPlanActions(plan, statusClass, currentPlanId)}
        </div>
      </div>
    `;
  });
  
  html += '</div></div>';  // Close upcoming-plans div and wrapper
  html += `
    <div class="mt-3">
      <button class="btn btn-primary btn-sm" onclick="forceRefreshSchedule()">
        <i class="fas fa-sync"></i> Force Refresh
      </button>
    </div>
  `;
  
  contentElement.innerHTML = html;
}

function renderPlanActions(plan, status, currentPlanId) {
  // Can't manually select if a scheduled plan is live
  const hasLivePlan = currentPlanId && !plan.is_manual;
  
  if (plan.plan_id === currentPlanId && plan.is_manual) {
    return `
      <button class="btn btn-sm btn-danger" onclick="clearManualPlan()">
        Clear Manual
      </button>
    `;
  } else if (status === 'live' && !plan.is_manual) {
    return '<span class="text-success">Currently Live</span>';
  } else if (!hasLivePlan && status !== 'live') {
    return `
      <button class="btn btn-sm btn-success" onclick="setManualPlan('${plan.plan_id}')">
        Set Live
      </button>
    `;
  } else {
    return '<span class="text-muted">Cannot set during live service</span>';
  }
}

// Keep old function for compatibility but it won't be used
function displayDailySchedule(schedules) {
  const contentElement = document.getElementById('pco-schedule-content');
  
  if (!contentElement) {
    return;
  }
  
  if (Object.keys(schedules).length === 0) {
    // Check if PCO is configured but no service types are selected
    const pcoConfig = integrationsConfig.planning_center || {};
    const serviceTypes = pcoConfig.service_types || [];
    
    if (serviceTypes.length === 0) {
      contentElement.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="fas fa-cog fa-3x mb-3"></i>
          <h5>No Service Types Configured</h5>
          <p>No service types are selected in your Planning Center configuration.</p>
          <p class="small">To see schedules:</p>
          <ol class="list-unstyled small text-start">
            <li>1. Go to the Integrations settings</li>
            <li>2. Select the service types you want to monitor</li>
            <li>3. Save your configuration</li>
            <li>4. Refresh the schedule</li>
          </ol>
          <button class="btn btn-outline-primary btn-sm" onclick="window.location.reload()">
            <i class="fas fa-cog"></i> Go to Settings
          </button>
        </div>
      `;
    } else {
      contentElement.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="fas fa-calendar-times fa-3x mb-3"></i>
          <h5>No Services Scheduled</h5>
          <p>No services are scheduled for the next 8 days.</p>
          <p class="small">This could mean:</p>
          <ul class="list-unstyled small">
            <li>• No plans have been created in Planning Center</li>
            <li>• Plans exist but are outside the 8-day window</li>
            <li>• There's an issue with the date filtering</li>
          </ul>
          <button class="btn btn-outline-primary btn-sm" onclick="loadDailySchedule()">
            <i class="fas fa-sync-alt"></i> Refresh Schedule
          </button>
        </div>
      `;
    }
    return;
  }
  
  let html = '';
  
  Object.entries(schedules).forEach(([serviceTypeId, schedule]) => {
    if (schedule.length === 0) {
      // Show message for service types with no plans
      const pcoConfig = integrationsConfig.planning_center || {};
      const serviceTypes = pcoConfig.service_types || [];
      const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
      const serviceTypeName = serviceType ? serviceType.name : `Service Type ${serviceTypeId}`;
      
      html += `<div class="card mb-3">`;
      html += `<div class="card-header"><h6>${serviceTypeName} (${serviceTypeId})</h6></div>`;
      html += `<div class="card-body text-center text-muted py-3">`;
      html += `<i class="fas fa-calendar-times fa-2x mb-2"></i>`;
      html += `<p class="mb-0">No plans scheduled for this service type in the next 8 days</p>`;
      html += `<small class="text-muted">Check Planning Center for future plans</small>`;
      html += `</div></div>`;
      return;
    }
    
    // Each item in schedule is now a plan with services array
    const planGroups = {};
    let totalServices = 0;
    schedule.forEach(plan => {
      const planId = plan.plan_id;
      const services = plan.services || [];
      totalServices += services.length;
      planGroups[planId] = {
        plan_title: plan.plan_title,
        plan_date: plan.dates,
        live_start: plan.live_start,
        live_end: plan.live_end,
        services: services
      };
    });
    
    // Get service type name from config
    const pcoConfig = integrationsConfig.planning_center || {};
    const serviceTypes = pcoConfig.service_types || [];
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    const serviceTypeName = serviceType ? serviceType.name : `Service Type ${serviceTypeId}`;
    
    html += `<div class="card mb-3">`;
    html += `<div class="card-header d-flex justify-content-between align-items-center">`;
    html += `<h6 class="mb-0">${serviceTypeName} (${serviceTypeId})</h6>`;
    html += `<small class="text-muted">${schedule.length} plan${schedule.length !== 1 ? 's' : ''}, ${totalServices} service${totalServices !== 1 ? 's' : ''}</small>`;
    html += `</div>`;
    html += `<div class="card-body">`;
    
    Object.entries(planGroups).forEach(([planId, planData]) => {
      // Sort services by start time
      planData.services.sort((a, b) => new Date(a.service_start) - new Date(b.service_start));
      
      // Use the plan-level live window
      const liveStart = new Date(planData.live_start);
      const liveEnd = new Date(planData.live_end);
      const now = new Date();
      
      // Determine overall plan status
      let planStatusClass = 'text-muted';
      let planStatusText = 'Upcoming';
      let isLive = false;
      
      if (now >= liveStart && now <= liveEnd) {
        planStatusClass = 'text-success';
        planStatusText = 'LIVE NOW';
        isLive = true;
      } else if (now > liveEnd) {
        planStatusClass = 'text-muted';
        planStatusText = 'Ended';
      }
      
      // Plan header with better formatting
      html += `<div class="mb-3 p-3 border rounded" style="background-color: #f8f9fa;">`;
      html += `<div class="row align-items-center">`;
      const planTitle = planData.plan_title && planData.plan_title.trim() ? planData.plan_title : 'Untitled Plan';
      html += `<div class="col-md-6"><h6 class="mb-1">${planTitle}</h6><small class="text-muted">${planData.plan_date || 'No date'}</small></div>`;
      html += `<div class="col-md-3"><small class="text-muted">Live: ${liveStart.toLocaleTimeString()} - ${liveEnd.toLocaleTimeString()}</small></div>`;
      html += `<div class="col-md-3 text-end">`;
      html += `<span class="badge ${planStatusClass === 'text-success' ? 'bg-success' : planStatusClass === 'text-info' ? 'bg-info' : 'bg-secondary'}">${planStatusText}</span>`;
      
      // Add manual plan selection button (only if not currently live)
      if (!isLive && now < liveStart) {
        html += `<button class="btn btn-outline-primary btn-sm ms-2 set-manual-plan-btn" data-plan-id="${planId}" title="Set as live plan">`;
        html += `<i class="fas fa-play"></i> Set Live</button>`;
      }
      
      html += `</div>`;
      html += `</div>`;
      
      // Show plan date in a more readable format
      if (planData.plan_date) {
        try {
          const planDate = new Date(planData.plan_date);
          const formattedDate = planDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          html += `<div class="mt-2"><small class="text-info"><i class="fas fa-calendar"></i> ${formattedDate}</small></div>`;
        } catch (e) {
          // If date parsing fails, show the raw date
          html += `<div class="mt-2"><small class="text-info"><i class="fas fa-calendar"></i> ${planData.plan_date}</small></div>`;
        }
      }
      
      // Individual services within the plan
      if (planData.services.length > 0) {
        html += `<div class="mt-3">`;
        planData.services.forEach((service, index) => {
          const serviceStart = new Date(service.service_start);
          
          // Individual service status (based on plan live window)
          let serviceStatusClass = 'text-muted';
          let serviceStatusText = 'Upcoming';
          
          if (now >= liveStart && now <= liveEnd) {
            if (now >= serviceStart) {
              serviceStatusClass = 'text-success';
              serviceStatusText = 'ACTIVE';
            } else {
              serviceStatusClass = 'text-info';
              serviceStatusText = 'LIVE (Upcoming)';
            }
          } else if (now > liveEnd) {
            serviceStatusClass = 'text-muted';
            serviceStatusText = 'Ended';
          }
          
          const serviceName = service.service_name && service.service_name.trim() ? service.service_name : 'Service';
          html += `<div class="row mb-2 align-items-center">`;
          html += `<div class="col-md-1 text-end"><span class="text-muted small">${index + 1}.</span></div>`;
          html += `<div class="col-md-5"><strong>${serviceName}</strong></div>`;
          html += `<div class="col-md-3"><span class="text-muted">${serviceStart.toLocaleTimeString()}</span></div>`;
          html += `<div class="col-md-3 text-end"><span class="badge ${serviceStatusClass === 'text-success' ? 'bg-success' : serviceStatusClass === 'text-info' ? 'bg-info' : 'bg-secondary'}">${serviceStatusText}</span></div>`;
          html += `</div>`;
        });
        html += `</div>`;
      } else {
        html += `<div class="mt-2 text-center text-muted py-2">`;
        html += `<i class="fas fa-exclamation-triangle fa-1x mb-1"></i>`;
        html += `<p class="mb-0 small"><em>No service times configured for this plan</em></p>`;
        html += `<small class="text-muted">Check Planning Center to add service times</small>`;
        html += `</div>`;
      }
      html += `</div>`;
    });
    
    html += `</div></div>`;
  });
  
  // Add summary at the end
  const totalPlans = Object.values(schedules).reduce((sum, schedule) => sum + schedule.length, 0);
  const totalServices = Object.values(schedules).reduce((sum, schedule) => {
    return sum + schedule.reduce((planSum, plan) => planSum + (plan.services || []).length, 0);
  }, 0);
  
  if (totalPlans > 0) {
    html += `
      <div class="mt-4 p-3 bg-light border rounded">
        <div class="row text-center">
          <div class="col-md-6">
            <h6 class="text-muted mb-1">Total Plans</h6>
            <h4 class="text-primary">${totalPlans}</h4>
          </div>
          <div class="col-md-6">
            <h6 class="text-muted mb-1">Total Services</h6>
            <h4 class="text-success">${totalServices}</h4>
          </div>
        </div>
        <div class="text-center mt-2">
          <small class="text-muted">Schedule covers the next 8 days</small>
        </div>
        <div class="text-center mt-2">
          <button class="btn btn-outline-secondary btn-sm" onclick="loadDailySchedule()">
            <i class="fas fa-sync-alt"></i> Refresh Schedule
          </button>
          <button class="btn btn-outline-warning btn-sm ms-2 clear-manual-plan-btn" title="Clear any manually selected plan">
            <i class="fas fa-times"></i> Clear Manual Plan
          </button>
        </div>
      </div>
    `;
  }
  
  contentElement.innerHTML = html;
  
  // Add event listeners for manual plan selection buttons
  document.querySelectorAll('.set-manual-plan-btn').forEach(button => {
    button.addEventListener('click', function() {
      const planId = this.getAttribute('data-plan-id');
      setManualPlan(planId);
    });
  });
  
  // Add event listener for clear manual plan button
  document.querySelectorAll('.clear-manual-plan-btn').forEach(button => {
    button.addEventListener('click', function() {
      clearManualPlan();
    });
  });
}

// Manual Plan Selection Functions
// New functions for the simplified scheduler
// Make function globally accessible for onclick handlers
window.forceRefreshSchedule = function() {
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
  
  fetch('/api/pco/refresh-schedule', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      showNotification(`Schedule refreshed: ${data.plan_count} plans loaded`, 'success');
      loadDailySchedule(); // Reload the display
    } else {
      showNotification('Failed to refresh schedule', 'error');
    }
  })
  .catch(error => {
    console.error('Error refreshing schedule:', error);
    showNotification('Error refreshing schedule', 'error');
  })
  .finally(() => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync"></i> Force Refresh';
  });
}

// Make function globally accessible for onclick handlers
window.clearManualPlan = function() {
  fetch('/api/pco/clear-manual-plan', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      showNotification('Manual plan cleared', 'success');
      loadDailySchedule(); // Reload the display
    }
  })
  .catch(error => {
    console.error('Error clearing manual plan:', error);
    showNotification('Error clearing manual plan', 'error');
  });
}

function showNotification(message, type = 'info') {
  const alertClass = type === 'error' ? 'danger' : type;
  const notification = document.createElement('div');
  notification.className = `alert alert-${alertClass} notification`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    min-width: 250px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Make function globally accessible for onclick handlers
window.setManualPlan = function(planId) {
  console.log('Setting manual plan:', planId);
  
  // Show loading state - find the button by plan ID
  const button = document.querySelector(`[data-plan-id="${planId}"]`);
  let originalContent = '';
  if (button) {
    originalContent = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting...';
    button.disabled = true;
  }
  
  fetch('/api/pco/set-manual-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan_id: planId })
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      console.log('Manual plan set successfully:', data.message);
      
      // Show success message
      showNotification('Manual plan set successfully!', 'success');
      
      // Refresh the schedule to show updated status
      setTimeout(() => {
        loadDailySchedule();
      }, 1000);
    } else {
      console.error('Failed to set manual plan:', data.message);
      showNotification(`Failed to set manual plan: ${data.message}`, 'error');
      
      // Restore button state
      if (button) {
        button.innerHTML = originalContent;
        button.disabled = false;
      }
    }
  })
  .catch(error => {
    console.error('Error setting manual plan:', error);
    showNotification('Error setting manual plan. Please try again.', 'error');
    
    // Restore button state
    if (button) {
      button.innerHTML = originalContent;
      button.disabled = false;
    }
  });
}

// Duplicate clearManualPlan and showNotification removed - using the ones defined earlier
