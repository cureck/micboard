"use strict";

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import QRCode from 'qrcode';
import 'whatwg-fetch';

import { autoRandom, seedTransmitters } from './demodata.js';
import { renderGroup, renderDisplayList, updateSlot } from './channelview.js';
import { initLiveData } from './data.js';
import { groupEditToggle, initEditor } from './dnd.js';
import { slotEditToggle } from './extended.js';
import { keybindings } from './kbd.js';
import { setBackground, setInfoDrawer } from './display.js';
import { setTimeMode } from './chart-smoothie.js';
import { initConfigEditor } from './config.js';
import { initIntegrationsUI } from './integrations.js';

import '../css/colors.scss';
import '../css/style.scss';
import '../node_modules/@ibm/plex/css/ibm-plex.css';


export const dataURL = 'data.json';

export const micboard = [];
micboard.MIC_MODELS = ['uhfr', 'qlxd', 'ulxd', 'axtd'];
micboard.IEM_MODELS = ['p10t'];
micboard.url = [];
micboard.displayMode = 'deskmode';
micboard.infoDrawerMode = 'elinfo11';
micboard.backgroundMode = 'NONE';
micboard.settingsMode = 'NONE';
micboard.chartTimeSrc = 'SERVER';

micboard.group = 0;
micboard.connectionStatus = 'CONNECTING';

micboard.transmitters = [];

micboard.displayList = [];

export function ActivateMessageBoard(h1, p) {
  if (!h1) {
    h1 = 'Connection Error!';
    p = 'Could not connect to the micboard server. Please <a href=".">refresh</a> the page.';
  }

  $('#micboard').hide();
  $('.settings').hide();
  const eb = document.getElementsByClassName('message-board')[0];
  eb.querySelector('h1').innerHTML = h1;
  eb.querySelector('p').innerHTML = p;

  $('.message-board').show();

  micboard.connectionStatus = 'DISCONNECTED';
}

export function generateQR() {
  const qrOptions = {
    width: 600,
    margin: 0,
  };

  const url = micboard.localURL + location.pathname + location.search;
  document.getElementById('largelink').href = url;
  document.getElementById('largelink').innerHTML = url;
  QRCode.toCanvas(document.getElementById('qrcode'), url, qrOptions, (error) => {
    if (error) console.error(error)
    console.log('success!');
  });

  document.getElementById('micboard-version').innerHTML = 'Micboard version: ' + VERSION;
}

function groupTableBuilder(data) {
  const plist = {};

  data.config.groups.forEach((e) => {
    const entry = {
      slots: e.slots,
      title: e.title,
      hide_charts: e.hide_charts,
    };

    if (entry.hide_charts == null) {
      entry.hide_charts = false;
    }

    plist[e.group] = entry;
  });

  return plist;
}

export function updateLiveServiceIndicator() {
  console.log('🔄 updateLiveServiceIndicator: Starting update check');
  
  // Read plan_of_day from data.json (already queried elsewhere), fallback to a direct fetch if needed
  fetch(dataURL)
    .then(r => r.json())
    .then(full => {
      console.log('📊 updateLiveServiceIndicator: Received data:', full);
      
      const planOfDay = full.plan_of_day || [];
      console.log('📅 updateLiveServiceIndicator: plan_of_day data:', planOfDay);
      
      // Find the live plan or the first plan if none are live
      let pod = null;
      if (Array.isArray(planOfDay)) {
        // Look for a live plan first
        pod = planOfDay.find(plan => plan.is_live);
        // If no live plan, use the first plan
        if (!pod && planOfDay.length > 0) {
          pod = planOfDay[0];
        }
      } else {
        // Fallback for old format (object with service type keys)
        const firstKey = Object.keys(planOfDay)[0];
        pod = firstKey ? planOfDay[firstKey] : null;
      }
      console.log('🎯 updateLiveServiceIndicator: Selected plan of day:', pod);
      
      if (pod && (pod.names_by_slot || pod.slot_assignments)) {
        const slotAssignments = pod.names_by_slot || pod.slot_assignments;
        console.log('👥 updateLiveServiceIndicator: slot assignments:', slotAssignments);
        console.log('👥 updateLiveServiceIndicator: slot count:', Object.keys(slotAssignments).length);
      }

      const indicator = document.getElementById('live-service-indicator');
      const icon = document.getElementById('live-service-icon');
      const text = document.getElementById('live-service-text');

      if (pod && (pod.start_time || pod.service_time) && pod.live_time) {
        const now = new Date();
        const liveStart = new Date(pod.live_time);
        const serviceStart = new Date(pod.start_time || pod.service_time);
        // Service considered live if now between live_start and end of day of start
        const endOfDay = new Date(serviceStart);
        endOfDay.setHours(23, 59, 59, 999);

        console.log('⏰ updateLiveServiceIndicator: Time comparison:', {
          now: now.toISOString(),
          liveStart: liveStart.toISOString(),
          serviceStart: serviceStart.toISOString(),
          endOfDay: endOfDay.toISOString(),
          isLive: now >= liveStart && now <= endOfDay
        });

        const startTimeEST = serviceStart.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
        const endTimeEST = endOfDay.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });

        if (now >= liveStart && now <= endOfDay) {
          console.log('🟢 updateLiveServiceIndicator: Service is LIVE - updating UI');
          icon.style.display = 'inline-block';
          // Use service type name instead of plan title
          const serviceTypeName = pod.service_type_name || pod.title || 'Service';
          text.innerHTML = `${serviceTypeName} (${startTimeEST} - ${endTimeEST} EST)`;
          indicator.className = 'text-white';
          
          // Apply slot assignments from PCO to the UI
          const slotAssignments = pod.names_by_slot || pod.slot_assignments;
          if (slotAssignments) {
            console.log('👥 updateLiveServiceIndicator: Applying slot assignments to UI:', slotAssignments);
            applySlotAssignmentsToUI(slotAssignments);
          }
          
          // Force refresh the schedule cache when we detect a live service
          // This ensures the plan_of_day data is up to date
          console.log('🔄 updateLiveServiceIndicator: Triggering schedule cache refresh');
          fetch('/api/pco/force-refresh-schedule', { method: 'POST' })
            .then(response => response.json())
            .then(data => console.log('✅ updateLiveServiceIndicator: Schedule cache refresh result:', data))
            .catch(err => console.log('❌ updateLiveServiceIndicator: Failed to refresh schedule cache:', err));
        } else {
          // Check if this is a manually selected plan (even if not in live window)
          const isManualPlan = pod.plan_id && (now < liveStart);
          if (isManualPlan) {
            console.log('🎯 updateLiveServiceIndicator: Manual plan selected - showing in navbar');
            icon.style.display = 'inline-block';
            // Use service type name instead of plan title
            const serviceTypeName = pod.service_type_name || pod.title || 'Service';
            text.innerHTML = `${serviceTypeName} (Manual - ${startTimeEST} EST)`;
            indicator.className = 'text-info';
            
            // Apply slot assignments from PCO to the UI for manual plans too
            const slotAssignments = pod.names_by_slot || pod.slot_assignments;
            if (slotAssignments) {
              console.log('👥 updateLiveServiceIndicator: Applying slot assignments to UI for manual plan:', slotAssignments);
              applySlotAssignmentsToUI(slotAssignments);
            }
          } else {
            console.log('🔴 updateLiveServiceIndicator: Service is NOT live - showing "No Service"');
            icon.style.display = 'none';
            text.innerHTML = 'No Service';
            indicator.className = 'text-muted';
          }
        }
      } else {
        console.log('⚠️ updateLiveServiceIndicator: No valid plan of day data found');
        const icon = document.getElementById('live-service-icon');
        const text = document.getElementById('live-service-text');
        icon.style.display = 'none';
        text.innerHTML = 'No Service';
      }
    }).catch((error) => {
      console.log('❌ updateLiveServiceIndicator: Error fetching data:', error);
      const icon = document.getElementById('live-service-icon');
      const text = document.getElementById('live-service-text');
      icon.style.display = 'none';
      text.innerHTML = 'No Service';
    });
}

export function updateNavLinks() {
  let str = '';
  for (let i = 1; i <= 9; i += 1) {
    str = '';
    if (micboard.groups[i]) {
      str = `${i}: ${micboard.groups[i].title}`;
    } else {
      str = `${i}:`;
    }
    document.getElementById(`go-group-${i}`).innerHTML = str;
  }
}

function mapGroups() {
  // Initialize consistent navigation system
  import('./navigation.js').then(nav => {
    nav.initConsistentNavigation();
  }).catch(error => {
    console.error('Failed to load consistent navigation, using fallback handlers:', error);
    
    // Fallback to original handlers if navigation module fails
    $('a#go-extended').click(() => {
      slotEditToggle();
      $('.collapse').collapse('hide');
    });

    $('a#go-config').click(() => {
      initConfigEditor();
      $('.collapse').collapse('hide');
    });

    $('a#go-integrations').click(() => {
      initIntegrationsUI();
      $('.collapse').collapse('hide');
    });

    $('a#go-groupedit').click(() => {
      if (micboard.group !== 0) {
        groupEditToggle();
        $('.collapse').collapse('hide');
      }
    });

    $('a.preset-link').each(function(index) {
      const id = parseInt($(this).attr('id')[9], 10);

      $(this).click(() => {
        renderGroup(id);
        $('.collapse').collapse('hide');
      });
    });
  });

  updateNavLinks();
}

// https://stackoverflow.com/questions/19491336/get-url-parameter-jquery-or-how-to-get-query-string-values-in-js
// var getUrlParameter = function getUrlParameter(sParam) {
function getUrlParameter(sParam) {
  // const sPageURL = decodeURIComponent(window.location.search.substring(1));
  const sPageURL = decodeURIComponent(window.location.hash.substring(1));
  const sURLVariables = sPageURL.split('&');
  let sParameterName;
  let i;

  for (i = 0; i < sURLVariables.length; i += 1) {
    sParameterName = sURLVariables[i].split('=');

    if (sParameterName[0] === sParam) {
      return sParameterName[1] === undefined ? true : sParameterName[1];
    }
  }
  return undefined;
}


function readURLParameters() {
  micboard.url.group = getUrlParameter('group');
  micboard.url.demo = getUrlParameter('demo');
  micboard.url.settings = getUrlParameter('settings');
  micboard.url.tvmode = getUrlParameter('tvmode');
  micboard.url.bgmode = getUrlParameter('bgmode');

  if (window.location.pathname.includes('demo')) {
    micboard.url.demo = 'true';
  }
}

export function updateHash() {
  let hash = '#';
  if (micboard.url.demo) {
    hash += '&demo=true';
  }
  if (micboard.group !== 0) {
    hash += '&group=' + micboard.group;
  }
  if (micboard.displayMode === 'tvmode') {
    hash += '&tvmode=' + micboard.infoDrawerMode;
  }
  if (micboard.backgroundMode !== 'NONE') {
    hash += '&bgmode=' + micboard.backgroundMode;
  }
  if (micboard.settingsMode === 'CONFIG') {
    hash = '#settings=true'
  }
  hash = hash.replace('&', '');
  history.replaceState(undefined, undefined, hash);

}

export function dataFilterFromList(data) {
  data.receivers.forEach((rx) => {
    rx.tx.forEach((t) => {
      const tx = t;
      tx.ip = rx.ip;
      tx.type = rx.type;
      micboard.transmitters[tx.slot] = tx;
    });
  });
}

function displayListChooser() {
  if (micboard.url.group) {
    renderGroup(micboard.url.group);
  } else {
    renderGroup(0);
  }
}



function initialMap(callback) {
  fetch(dataURL)
    .then((response) => {
      setTimeMode(response.headers.get('Date'));

      response.json().then((data) => {
        micboard.discovered = data.discovered;
        micboard.mp4_list = data.mp4;
        micboard.img_list = data.jpg;
        micboard.localURL = data.url;
        micboard.groups = groupTableBuilder(data);
        micboard.config = data.config;
        mapGroups();

        if (micboard.config.slots.length < 1) {
          setTimeout(function() {
            initConfigEditor();
          }, 125);
        }

        if (micboard.url.demo !== 'true') {
          dataFilterFromList(data);
        }
        displayListChooser();

        if (callback) {
          callback();
        }
        if (['MP4', 'IMG'].indexOf(micboard.url.bgmode) >= 0) {
          setBackground(micboard.url.bgmode);
        }
        if (['elinfo00', 'elinfo01', 'elinfo10', 'elinfo11'].indexOf(micboard.url.tvmode) >= 0) {
          setInfoDrawer(micboard.url.tvmode);
        }
        initEditor();
      });
    });
}


$(document).ready(() => {
  console.log('Starting Micboard version: ' + VERSION);
  readURLParameters();
  keybindings();
  
  // Initialize live service indicator
  updateLiveServiceIndicator();
  
  // Update live service indicator every 30 seconds when service is live
  setInterval(updateLiveServiceIndicator, 30 * 1000);
  
  if (micboard.url.demo === 'true') {
    setTimeout(() => {
      $('#hud').show();
    }, 100);

    initialMap();
  } else {
    initialMap(initLiveData);
  }

  if (micboard.url.settings === 'true') {
    setTimeout(() => {
      initConfigEditor();
      updateHash();
    }, 100);
  }

  /**
   * Apply slot assignments from PCO to the UI
   * @param {Object} namesBySlot - Object mapping slot numbers to person names
   */
  function applySlotAssignmentsToUI(namesBySlot) {
    console.log('🎯 applySlotAssignmentsToUI: Applying assignments:', namesBySlot);
    
    // First, clear all slot names
    for (let slotNum = 1; slotNum <= 6; slotNum++) {
      const slotElement = document.querySelector(`[data-slot="${slotNum}"] .ext-name`);
      if (slotElement) {
        slotElement.value = '';
      }
    }
    
    // Then apply the assignments
    Object.entries(namesBySlot).forEach(([slotNum, personName]) => {
      const slotNumber = parseInt(slotNum);
      const slotElement = document.querySelector(`[data-slot="${slotNumber}"] .ext-name`);
      if (slotElement) {
        slotElement.value = personName;
        console.log(`✅ applySlotAssignmentsToUI: Applied slot ${slotNumber}: ${personName}`);
      } else {
        console.warn(`⚠️ applySlotAssignmentsToUI: Slot element not found for slot ${slotNumber}`);
      }
    });
    
    // Trigger a save to persist the changes
    console.log('💾 applySlotAssignmentsToUI: Saving slot assignments to config');
    const saveButton = document.getElementById('slotSave');
    if (saveButton) {
      saveButton.click();
    }
  }
});
