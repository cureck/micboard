'use strict';

import { micboard, updateHash } from './app.js';
import { postJSON } from './data.js';

let allTeams = {};
let allPositions = {};
let selectedServiceTypes = [];

const NET_DEVICE_TYPES = ['axtd', 'ulxd', 'qlxd', 'uhfr', 'p10t'];

function updateEditEntry(t, e) {
  t.querySelector('.cfg-ip').value = e.ip || '';
  t.querySelector('.cfg-type').value = e.type || '';
  t.querySelector('.cfg-channel').value = e.channel || '';
  
  // Handle PCO team/position fields
  const teamSelect = t.querySelector('.cfg-pco-team');
  const positionSelect = t.querySelector('.cfg-pco-position');
  
  if (teamSelect) {
    teamSelect.value = e.pco_team || '';
    console.log(`Setting team value for slot ${e.slot}: ${e.pco_team || 'empty'}`);
  }
  if (positionSelect) {
    positionSelect.value = e.pco_position || '';
    console.log(`Setting position value for slot ${e.slot}: ${e.pco_position || 'empty'}`);
  }
}


function getMaxSlot() {
  let max = 0;
  if (micboard.config && micboard.config.slots) {
    micboard.config.slots.forEach((e) => {
      if (e.slot > max) {
        max = e.slot;
      }
    });
  }
  return max;
}


function updateSlotID() {
  const configList = document.querySelectorAll('#editor_holder .cfg-row');
  let i = 1;
  configList.forEach((t) => {
    t.querySelector('.slot-number label').innerHTML = 'slot ' + i;
    t.id = 'editslot-' + i;
    i += 1;
  });
}

function moveSlotUp(element) {
  const currentRow = element.closest('.cfg-row');
  const previousRow = currentRow.previousElementSibling;
  
  if (previousRow && previousRow.classList.contains('cfg-row')) {
    console.log('[Move] Moving slot up');
    currentRow.parentNode.insertBefore(currentRow, previousRow);
    updateSlotID();
  }
}

function moveSlotDown(element) {
  const currentRow = element.closest('.cfg-row');
  const nextRow = currentRow.nextElementSibling;
  
  if (nextRow && nextRow.classList.contains('cfg-row')) {
    console.log('[Move] Moving slot down');
    currentRow.parentNode.insertBefore(nextRow, currentRow);
    updateSlotID();
  }
}

function setupMoveButtons() {
  console.log('[Move] Setting up move buttons');
  
  // Remove existing event listeners
  $('.move-up, .move-down').off('click');
  
  // Add new event listeners
  $('.move-up').on('click', function() {
    moveSlotUp(this);
  });
  
  $('.move-down').on('click', function() {
    moveSlotDown(this);
  });
}

function renderSlotList() {
  // Check if micboard.config exists
  if (!micboard.config || !micboard.config.slots) {
    console.warn('Config not loaded yet');
    return;
  }
  
  const config = micboard.config.slots;
  // Smart slot calculation: minimum 4 slots, but no extra empty slots if > 4 configured
  const maxSlot = getMaxSlot();
  const slotCount = maxSlot > 4 ? maxSlot : 4; // Exact slots if > 4, otherwise minimum 4
  let t;

  document.getElementById('editor_holder').innerHTML = '';

  for (let i = 1; i <= slotCount; i += 1) {
    t = document.getElementById('config-slot-template').content.cloneNode(true);
    t.querySelector('label').innerHTML = 'slot ' + i;
    t.querySelector('.cfg-row').id = 'editslot-' + i;
    document.getElementById('editor_holder').append(t);
  }

  config.forEach((e) => {
    const slotID = 'editslot-' + e.slot;
    t = document.getElementById(slotID);
    updateEditEntry(t, e);
  });

  // Initialize PCO dropdowns after rendering slots
  if (selectedServiceTypes.length > 0) {
    loadPCOTeamsForSettings().then(() => {
      // After teams are loaded, apply saved PCO mappings from integrations config
      console.log('Teams loaded, now loading existing mappings');
      loadPCOSettingsForConfig();
    });
  } else {
    // If no service types selected, still try to load existing mappings
    loadPCOSettingsForConfig();
  }
}


function discoverFilter(item, currentSlotList) {
  let out = true;
  currentSlotList.forEach((e) => {
    if ((e.ip === item.ip) && (e.type === item.type) && (e.channel === item.channel)) {
      out = false;
    }
  });
  return out;
}

function renderDiscoverdDeviceList() {
  const discovered = micboard.discovered;
  const currentSlotList = generateJSONConfig();

  let t;

  document.getElementById('discovered_list').innerHTML = '';

  discovered.forEach((e) => {
    for (let i = 1; i <= e.channels; i += 1) {
      e.channel = i;
      if (discoverFilter(e, currentSlotList)) {
        t = document.getElementById('config-slot-template').content.cloneNode(true);
        updateEditEntry(t, e);
        document.getElementById('discovered_list').append(t);
      }
    }
  });
}

function generateJSONConfig() {
  const slotList = [];
  const configBoard = document.getElementById('editor_holder').getElementsByClassName('cfg-row');

  for (let i = 0; i < configBoard.length; i += 1) {
    const slot = parseInt(configBoard[i].id.replace(/[^\d.]/g, ''), 10);
    if (slot && (slotList.indexOf(slot) === -1)) {
      const output = {};

      output.slot = slot;
      output.type = configBoard[i].querySelector('.cfg-type').value;

      if (NET_DEVICE_TYPES.indexOf(output.type) > -1) {
        output.ip = configBoard[i].querySelector('.cfg-ip').value;
        output.channel = parseInt(configBoard[i].querySelector('.cfg-channel').value, 10);
      }

      // Add PCO mapping data
      const teamSelect = configBoard[i].querySelector('.cfg-pco-team');
      const positionSelect = configBoard[i].querySelector('.cfg-pco-position');
      
      if (teamSelect && teamSelect.value) {
        output.pco_team = teamSelect.value;
      }
      if (positionSelect && positionSelect.value) {
        output.pco_position = positionSelect.value;
      }

      if (output.type) {
        slotList.push(output);
      }
    }
  }
  return slotList;
}


function addAllDiscoveredDevices() {
  const devices = document.querySelectorAll('#discovered_list .cfg-row');
  const cfg_list = document.getElementById('editor_holder');
  const top = cfg_list.querySelector('.cfg-row');

  devices.forEach((e) => {
    cfg_list.insertBefore(e, top);
  });
  updateSlotID();
}

function updateHiddenSlots() {
  $('.cfg-type').each(function() {
    const type = $(this).val();
    if (type === 'offline' || type === '') {
      $(this).closest('.cfg-row').find('.cfg-ip').hide()
      $(this).closest('.cfg-row').find('.cfg-channel').hide();
    } else {
      $(this).closest('.cfg-row').find('.cfg-ip').show();
      $(this).closest('.cfg-row').find('.cfg-channel').show();
    }
  });
}

export function initConfigEditor() {
  if (micboard.settingsMode === 'CONFIG') {
    console.log('[Config] Already in config mode, skipping re-initialization');
    return;
  }

  // Wait for config to be loaded
  if (!micboard.config) {
    console.warn('Config not loaded yet, retrying...');
    setTimeout(() => initConfigEditor(), 100);
    return;
  }

  micboard.settingsMode = 'CONFIG';
  updateHash();
  $('#micboard').hide();
  $('.settings').show();
  $('.integrations-page').hide(); // Hide integrations page

  renderSlotList();
  renderDiscoverdDeviceList();

  setupMoveButtons();

  updateHiddenSlots();

  // Set up event handlers for PCO dropdowns
  setupPCOEventHandlers();

  // Load PCO settings for team/position mapping after teams are loaded
  // This will be called from renderSlotList after teams are loaded

  $(document).on('change', '.cfg-type', function() {
    updateHiddenSlots();
  });

  $('#add-discovered').click(function() {
    addAllDiscoveredDevices();
  });

  $('#save').click(function() {
    const data = generateJSONConfig();
    const url = 'api/config';
    console.log(data);
    postJSON(url, data, () => {
      // Use consistent navigation instead of full page reload
      import('./navigation.js').then(nav => {
        nav.navigateBack();
      }).catch(error => {
        console.error('[Config] Failed to load navigation module, falling back to reload:', error);
        // Fallback to page reload if navigation module fails
        micboard.settingsMode = 'NONE';
        updateHash();
        window.location.reload();
      });
    });
  });

  $('#editor_holder').on('click', '.del-btn', function() {
    $(this).closest('.cfg-row').remove();
    updateSlotID();
    renderDiscoverdDeviceList();
  });

  $('#clear-config').click(function() {
    $('#editor_holder .cfg-row').remove();
    let t;
    // Create 4 empty slots when clearing (reasonable default for new configs)
    for (let i = 0; i < 4; i += 1) {
      t = document.getElementById('config-slot-template').content.cloneNode(true);
      document.getElementById('editor_holder').append(t);
    }
    updateSlotID();
    updateHiddenSlots();
    renderDiscoverdDeviceList();
  });

  $('#add-config-row').click(function() {
    const t = document.getElementById('config-slot-template').content.cloneNode(true);
    document.getElementById('editor_holder').append(t);
    updateSlotID();
    updateHiddenSlots();
  });

  // Test button to manually save a mapping
  $('#test-save-mapping').click(function() {
    console.log('Testing save mapping for slot 1 -> Band / Worship Leader');
    saveSlotMapping(1, 'Band', 'Worship Leader');
  });
}

// PCO Integration Functions for Settings Page
function loadPCOTeamsForSettings() {
  if (selectedServiceTypes.length === 0) {
    // Disable all team dropdowns
    $('.cfg-pco-team').prop('disabled', true).empty().append('<option value="">Please select a service first</option>');
    $('.cfg-pco-position').prop('disabled', true).empty().append('<option value="">Select team first</option>');
    return Promise.resolve();
  }

  console.log(`Loading teams from cached PCO structure for service types:`, selectedServiceTypes);
  
  // Try to get teams from cached PCO structure first
  return fetch('/api/integrations')
    .then(response => response.json())
    .then(integrationsData => {
      const pcoConfig = integrationsData.planning_center;
      if (pcoConfig && pcoConfig.service_types) {
        // Use cached structure
        allTeams = {};
        const uniqueTeamNames = new Set();
        
        for (const serviceType of pcoConfig.service_types) {
          if (selectedServiceTypes.includes(serviceType.id)) {
            for (const team of serviceType.teams || []) {
              uniqueTeamNames.add(team.name);
              allTeams[team.name] = team;
            }
          }
        }
        
        console.log(`Loaded ${Object.keys(allTeams).length} teams from cached structure:`, Object.keys(allTeams));
        updateTeamDropdowns();
        return Promise.resolve();
      } else {
        // Fall back to API call
        console.log('No cached structure found, falling back to API call');
        return loadPCOTeamsFromAPI();
      }
    })
    .catch(error => {
      console.error('Error loading cached structure, falling back to API:', error);
      return loadPCOTeamsFromAPI();
    });
}

function loadPCOTeamsFromAPI() {
  console.log(`Loading teams from API for service types:`, selectedServiceTypes);
  
  const teamsUrl = `/api/pco/teams?${selectedServiceTypes.map(id => `service_type_ids[]=${id}`).join('&')}`;
  console.log(`Teams request URL: ${teamsUrl}`);
  
  return fetch(teamsUrl)
    .then(response => {
      console.log(`Teams API response status: ${response.status}`);
      return response.json();
    })
    .then(teams => {
      console.log(`Received ${teams.length} teams:`, teams);
      allTeams = {};
      teams.forEach(team => {
        allTeams[team.name] = team;
      });
      console.log(`Processed teams:`, Object.keys(allTeams));
      updateTeamDropdowns();
    })
    .catch(error => {
      console.error('Error loading teams:', error);
      $('.cfg-pco-team').prop('disabled', true).empty().append('<option value="">Error loading teams</option>');
    });
}

function updateTeamDropdowns() {
  console.log(`Updating team dropdowns with teams:`, Object.keys(allTeams));
  
  $('.cfg-pco-team').each(function() {
    const select = $(this);
    const currentValue = select.val();
    
    console.log(`Updating team dropdown, current value: "${currentValue}"`);
    
    select.prop('disabled', false).empty().append('<option value="">-- Select Team --</option>');
    
    Object.keys(allTeams).sort().forEach(teamName => {
      const option = $('<option>').val(teamName).text(teamName);
      if (currentValue === teamName) {
        option.prop('selected', true);
        console.log(`Selected team "${teamName}" in dropdown`);
      }
      select.append(option);
    });
    
    console.log(`Team dropdown now has ${select.find('option').length} options`);
  });
}

function loadPositionsForTeamInSettings(teamName, positionSelect) {
  if (!selectedServiceTypes.length || !teamName) {
    positionSelect.prop('disabled', true).empty().append('<option value="">Select team first</option>');
    return Promise.resolve();
  }

  console.log(`Loading positions for team "${teamName}" from cached structure for service types:`, selectedServiceTypes);
  
  // Try to get positions from cached PCO structure first
  return fetch('/api/integrations')
    .then(response => response.json())
    .then(integrationsData => {
      const pcoConfig = integrationsData.planning_center;
      if (pcoConfig && pcoConfig.service_types) {
        // Use cached structure
        const positions = [];
        
        for (const serviceType of pcoConfig.service_types) {
          if (selectedServiceTypes.includes(serviceType.id)) {
            
            for (const team of serviceType.teams || []) {
              if (team.name === teamName) {
                positions.push(...(team.positions || []));
              }
            }
          }
        }
        
        // Deduplicate positions by name
        const uniquePositions = [];
        const seenNames = new Set();
        
        for (const position of positions) {
          if (!seenNames.has(position.name)) {
            seenNames.add(position.name);
            uniquePositions.push(position);
          }
        }
        
        console.log(`Loaded ${positions.length} positions for team "${teamName}" from cached structure, ${uniquePositions.length} unique:`, uniquePositions);
        
        const currentValue = positionSelect.val();
        positionSelect.prop('disabled', false).empty().append('<option value="">-- Select Position --</option>');
        
        uniquePositions.forEach(position => {
          const option = $('<option>').val(position.name).text(position.name);
          if (currentValue === position.name) {
            option.prop('selected', true);
          }
          positionSelect.append(option);
        });
        
        console.log(`Populated position dropdown with ${positions.length} options for team "${teamName}"`);
        return Promise.resolve();
      } else {
        // Fall back to API call
        console.log('No cached structure found, falling back to API call');
        return loadPositionsFromAPI(teamName, positionSelect);
      }
    })
    .catch(error => {
      console.error('Error loading cached structure, falling back to API:', error);
      return loadPositionsFromAPI(teamName, positionSelect);
    });
}

function loadPositionsFromAPI(teamName, positionSelect) {
  const positionsUrl = `/api/pco/positions?${selectedServiceTypes.map(id => `service_type_ids[]=${id}`).join('&')}&team_name=${encodeURIComponent(teamName)}`;
  
  console.log(`Loading positions for team "${teamName}" from API`);
  console.log(`Request URL: ${positionsUrl}`);
  
  return fetch(positionsUrl)
    .then(response => {
      console.log(`Positions API response status: ${response.status}`);
      return response.json();
    })
    .then(positions => {
      console.log(`Received ${positions.length} positions for team "${teamName}":`, positions);
      
      // Deduplicate positions by name
      const uniquePositions = [];
      const seenNames = new Set();
      
      for (const position of positions) {
        if (!seenNames.has(position.name)) {
          seenNames.add(position.name);
          uniquePositions.push(position);
        }
      }
      
      console.log(`Deduplicated to ${uniquePositions.length} unique positions for team "${teamName}"`);
      
      const currentValue = positionSelect.val();
      positionSelect.prop('disabled', false).empty().append('<option value="">-- Select Position --</option>');
      
      uniquePositions.forEach(position => {
        const option = $('<option>').val(position.name).text(position.name);
        if (currentValue === position.name) {
          option.prop('selected', true);
        }
        positionSelect.append(option);
      });
      
      console.log(`Populated position dropdown with ${uniquePositions.length} unique options for team "${teamName}"`);
    })
    .catch(error => {
      console.error('Error loading positions:', error);
      positionSelect.prop('disabled', true).empty().append('<option value="">Error loading positions</option>');
    });
}

function loadPCOSettingsForConfig() {
  // Load current PCO configuration
  fetch('/api/integrations')
    .then(response => response.json())
    .then(data => {
      const pcoConfig = data.planning_center || {};
      selectedServiceTypes = (pcoConfig.service_types || []).map(st => st.id);
      
      console.log('PCO Settings loaded, service types:', selectedServiceTypes);
      
      if (selectedServiceTypes.length > 0) {
        // Load teams first, then load existing mappings
        loadPCOTeamsForSettings().then(() => {
          console.log('Teams loaded, now loading existing mappings');
          loadExistingMappings(pcoConfig);
        });
      } else {
        // Disable all dropdowns if no services selected
        $('.cfg-pco-team').prop('disabled', true).empty().append('<option value="">Please select a service first</option>');
        $('.cfg-pco-position').prop('disabled', true).empty().append('<option value="">Select team first</option>');
      }
    })
    .catch(error => {
      console.error('Error loading PCO settings:', error);
    });
}

function loadExistingMappings(pcoConfig) {
  const serviceTypes = pcoConfig.service_types || [];
  
  console.log('Loading existing mappings from PCO config:', pcoConfig);
  console.log('Service types:', serviceTypes);
  console.log('Total config rows found:', $('.cfg-row').length);
  
  let totalRules = 0;
  let appliedRules = 0;
  
  // Apply existing mappings to the UI
  serviceTypes.forEach(serviceType => {
    const rules = serviceType.reuse_rules || [];
    console.log(`Service type ${serviceType.id} has ${rules.length} reuse rules:`, rules);
    totalRules += rules.length;
    
    rules.forEach(rule => {
      const slotNum = rule.slot;
      console.log(`Looking for slot ${slotNum} with rule:`, rule);
      
      const row = $(`.cfg-row`).filter(function() {
        const slotText = $(this).find('.slot-number label').text().trim();
        console.log(`Checking row with slot text: "${slotText}" against "slot ${slotNum}"`);
        return slotText === `slot ${slotNum}`;
      });
      
      if (row.length) {
        console.log(`Found row for slot ${slotNum}, applying team: ${rule.team_name}, position: ${rule.position_name}`);
        const teamSelect = row.find('.cfg-pco-team');
        const positionSelect = row.find('.cfg-pco-position');
        
        console.log(`Team select found:`, teamSelect.length > 0);
        console.log(`Position select found:`, positionSelect.length > 0);
        
        // Set the team value
        teamSelect.val(rule.team_name);
        console.log(`Set team "${rule.team_name}" for slot ${slotNum}`);
        
        // Load positions for this team and then set the position
        if (rule.team_name) {
          loadPositionsForTeamInSettings(rule.team_name, positionSelect).then(() => {
            // Set the position value after positions are loaded
            positionSelect.val(rule.position_name);
            console.log(`Set position "${rule.position_name}" for slot ${slotNum}`);
            appliedRules++;
          });
        }
      } else {
        console.log(`No row found for slot ${slotNum}`);
      }
    });
  });
  
  console.log(`Applied ${appliedRules} out of ${totalRules} total rules`);
}

function setupPCOEventHandlers() {
  // Use event delegation for dynamically created elements
  $('#editor_holder').on('change', '.cfg-pco-team', function() {
    const teamName = $(this).val();
    const positionSelect = $(this).closest('.cfg-row').find('.cfg-pco-position');
    loadPositionsForTeamInSettings(teamName, positionSelect);
  });

  $('#editor_holder').on('change', '.cfg-pco-position', function() {
    const teamName = $(this).closest('.cfg-row').find('.cfg-pco-team').val();
    const positionName = $(this).val();
    const slotText = $(this).closest('.cfg-row').find('.slot-number label').text().trim();
    const slotNum = parseInt(slotText.replace('slot ', ''), 10);

    console.log(`Position changed for slot ${slotNum}: team="${teamName}", position="${positionName}"`);

    if (teamName && positionName && slotNum) {
      // Save the mapping to the current config
      saveSlotMapping(slotNum, teamName, positionName);
    }
  });
}

function saveSlotMapping(slotNum, teamName, positionName) {
  console.log(`Saving slot mapping: Slot ${slotNum} -> ${teamName} / ${positionName}`);
  
  // Get current integrations config
  fetch('/api/integrations')
    .then(response => response.json())
    .then(data => {
      const pcoConfig = data.planning_center || {};
      console.log('Current PCO config:', pcoConfig);
      
      // Find the team and position IDs for each service type
      (pcoConfig.service_types || []).forEach(serviceType => {
        if (!serviceType.reuse_rules) {
          serviceType.reuse_rules = [];
        }
        
        console.log(`Processing service type ${serviceType.id}, current reuse_rules:`, serviceType.reuse_rules);
        
        // Find the team and position IDs for this service type
        let teamId = null;
        let positionId = null;
        
        for (const team of serviceType.teams || []) {
          if (team.name === teamName) {
            teamId = team.id;
            for (const position of team.positions || []) {
              if (position.name === positionName) {
                positionId = position.id;
                break;
              }
            }
            break;
          }
        }
        
        if (!teamId || !positionId) {
          console.warn(`Could not find team/position IDs for ${teamName}/${positionName} in service type ${serviceType.id}`);
          return;
        }
        
        // Find existing rule for this slot
        const existingRuleIndex = serviceType.reuse_rules.findIndex(rule => rule.slot === slotNum);
        
        if (existingRuleIndex >= 0) {
          // Update existing rule
          serviceType.reuse_rules[existingRuleIndex] = {
            slot: slotNum,
            team_name: teamName,
            position_name: positionName,
            team_id: teamId,
            position_id: positionId,
            service_type_id: serviceType.id
          };
          console.log(`Updated existing rule for slot ${slotNum} in service type ${serviceType.id} with IDs: team=${teamId}, position=${positionId}`);
        } else {
          // Add new rule
          serviceType.reuse_rules.push({
            slot: slotNum,
            team_name: teamName,
            position_name: positionName,
            team_id: teamId,
            position_id: positionId,
            service_type_id: serviceType.id
          });
          console.log(`Added new rule for slot ${slotNum} in service type ${serviceType.id} with IDs: team=${teamId}, position=${positionId}`);
        }
        
        console.log(`Service type ${serviceType.id} reuse_rules after update:`, serviceType.reuse_rules);
      });
      
      console.log('Final PCO config to save:', pcoConfig);
      
      // Save the updated config
      return postJSON('/api/integrations', { planning_center: pcoConfig });
    })
    .then(() => {
      console.log(`Successfully saved mapping: Slot ${slotNum} -> ${teamName} / ${positionName}`);
      
      // Trigger PCO sync after saving mapping
      console.log('Triggering PCO sync after mapping update...');
      return fetch('/api/pco/sync', { method: 'POST' });
    })
    .then((syncResponse) => {
      if (syncResponse && syncResponse.ok) {
        console.log('PCO sync completed after mapping update');
      }
    })
    .catch(error => {
      console.error('Error saving slot mapping or syncing:', error);
    });
}
