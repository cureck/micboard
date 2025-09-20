'use strict';

import { Sortable, Plugins } from '@shopify/draggable';


import { micboard } from './app.js';
import { initChart, charts } from './chart-smoothie.js';
import { renderDisplayList, updateViewOnly } from './channelview.js';
import { postJSON } from './data.js';
import { toggleDisplayMode } from './display';

let swappable;
let _isTogglingSidebar = false; // kept for backwards safety, primary gating uses DOM dataset now

function slotOrder() {
  const slotList = [];
  const currentBoard = document.getElementById('micboard').getElementsByClassName('col-sm');

  for (let i = 0; i < currentBoard.length; i += 1) {
    const slot = parseInt(currentBoard[i].id.replace(/[^\d.]/g, ''), 10);
    if (slot && (slotList.indexOf(slot) === -1)) {
      slotList.push(slot);
    } else if (currentBoard[i].classList.contains('blank')) {
      slotList.push(0);
    }
  }

  console.log('slotlist:' + slotList);
  return slotList;
}


function renderEditSlots(dl) {
  const sidebar = document.querySelector('.sidebar');
  const listEl = (sidebar && sidebar.querySelector('#eslotlist')) || document.getElementById('eslotlist');
  if (!listEl) return;
  listEl.innerHTML = '';

  const tx = micboard.transmitters;
  dl.forEach((e) => {
    let t;
    if (e !== 0) {
      t = document.getElementById('column-template').content.cloneNode(true);
      const targetSlot = tx[e] ? tx[e].slot : e;
      t.querySelector('div.col-sm').id = 'slot-' + targetSlot;
      if (tx[e]) updateViewOnly(t, tx[e]);
    } else {
      t = document.createElement('div');
      t.className = 'col-sm';
    }
    listEl.appendChild(t);
  });

  const b = document.getElementById('column-template').content.cloneNode(true);
  b.querySelector('p.name').innerHTML = 'BLANK';
  b.querySelector('.col-sm').classList.add('blank');
  listEl.appendChild(b);
}


function calcEditSlots() {
  const output = [];
  micboard.config.slots.forEach((slot) => {
    if (micboard.displayList.indexOf(slot.slot) === -1) {
      output.push(slot.slot);
    }
  });

  return output;
}

function clearAll() {
  micboard.displayList = [];
  renderDisplayList(micboard.displayList);

  const eslots = calcEditSlots();
  renderEditSlots(eslots);
}

function onDrop(id, src, dst) {
  const slot = parseInt(id.id.replace(/[^\d.]/g, ''), 10);
  console.log('DSLOT: ' + slot);
  micboard.displayList = slotOrder();

  const eslots = calcEditSlots();
  renderEditSlots(eslots);


  // if (src === 'micboard' && dst === 'micboard') {
  // }
  if (src === 'eslotlist' && dst === 'micboard' && slot) {
    charts[slot] = initChart(document.getElementById(id.id), micboard.transmitters[slot]);
  }
  if (src === 'micboard' && dst === 'eslotlist' && slot) {
    charts[slot].slotChart.stop();
  }
}

export function updateEditor(group) {
  let title = '';
  let chartCheck = false;

  if (micboard.groups[group]) {
    title = micboard.groups[group]['title'];
    chartCheck = micboard.groups[group]['hide_charts'];
  }

  const sidebar = document.querySelector('.sidebar');
  const sidebarTitle = sidebar ? sidebar.querySelector('#sidebarTitle') : null;
  const groupTitle = sidebar ? sidebar.querySelector('#groupTitle') : null;
  const chartToggle = sidebar ? sidebar.querySelector('#chartCheck') : null;

  if (sidebarTitle) sidebarTitle.innerHTML = 'Group ' + group;
  if (groupTitle) groupTitle.value = title;
  if (chartToggle) chartToggle.checked = chartCheck;
}

function GridLayout() {
  const containerSelector = '.drag-container';
  const containers = document.querySelectorAll(containerSelector);

  if (containers.length === 0) {
    return false;
  }

  swappable = new Sortable(containers, {
    draggable: '.col-sm',
    mirror: {
      appendTo: containerSelector,
      constrainDimensions: true,
    },

    plugins: [Plugins.ResizeMirror],
  });
  renderEditSlots(calcEditSlots());
  swappable.on('sortable:stop', (evt) => {
    console.log('DROP');
    console.log(evt.dragEvent);

    setTimeout(onDrop, 125, evt.dragEvent.source, evt.oldContainer.id, evt.newContainer.id)
  });

  return swappable;
}

export function groupEditToggle() {
  const container = document.getElementsByClassName('container-fluid')[0];
  console.log('[GroupEdit] toggle requested', { hasContainer: !!container, hasSidebar: true });
  // Trace call origin to locate duplicate callers
  // Using console.trace is safe and helps debug duplicate events
  if (console && console.trace) { console.trace('[GroupEdit] call stack'); }
  const now = Date.now();
  const isOpen = container.classList.contains('sidebar-open');
  const nextAction = isOpen ? 'close' : 'open';

  // DOM-level gating to survive duplicate module instances
  const lastAt = parseInt(container.dataset.lastToggleAt || '0', 10);
  const lastAction = container.dataset.lastToggleAction || '';
  const isBusy = container.dataset.toggling === 'true';

  // Reentrancy/rapid-click guard to prevent immediate open->close loops
  if (_isTogglingSidebar) {
    console.log('[GroupEdit] toggle suppressed (busy)');
    return;
  }
  // Suppress opposite action if it comes too quickly after a prior toggle
  if (lastAction && (now - lastAt) < 1200) {
    if ((lastAction === 'open' && nextAction === 'close') || (lastAction === 'close' && nextAction === 'open')) {
      console.log(`[GroupEdit] ${nextAction} suppressed (debounce)`);
      return;
    }
  }
  if (isBusy || _isTogglingSidebar) {
    console.log('[GroupEdit] toggle suppressed (busy)');
    return;
  }
  _isTogglingSidebar = true;
  container.dataset.toggling = 'true';
  setTimeout(() => { _isTogglingSidebar = false; container.dataset.toggling = 'false'; }, 700);
  
  if (container.classList.contains('sidebar-open')) {
    container.classList.remove('sidebar-open');
    if (swappable) {
      swappable.destroy();
      swappable = null;
    }
    console.log('[GroupEdit] closed');
    container.dataset.lastToggleAt = String(now);
    container.dataset.lastToggleAction = 'close';
  } else {
    if (micboard.displayMode === 'tvmode') {
      toggleDisplayMode();
    }
    container.classList.add('sidebar-open');
    // Update the sidebar with current group info
    updateEditor(micboard.group);
    
    GridLayout();
    console.log('[GroupEdit] opened for group', micboard.group);
    container.dataset.lastToggleAt = String(now);
    container.dataset.lastToggleAction = 'open';
  }
}

function submitSlotUpdate() {
  const url = 'api/group';

  const update = {
    group: micboard.group,
    title: (document.querySelector('.sidebar #groupTitle') || document.getElementById('groupTitle')).value,
    hide_charts: (document.querySelector('.sidebar #chartCheck') || document.getElementById('chartCheck')).checked,
    slots: slotOrder(),
  };


  console.log(update);
  postJSON(url, update);
  groupEditToggle();
}

export function initEditor() {
  const sidebar = document.querySelector('.sidebar');
  const closeBtn = (sidebar && sidebar.querySelector('#editorClose')) || document.getElementById('editorClose');
  const saveBtn = (sidebar && sidebar.querySelector('#editorSave')) || document.getElementById('editorSave');
  const clearBtn = (sidebar && sidebar.querySelector('#editorClear')) || document.getElementById('editorClear');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      groupEditToggle();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      submitSlotUpdate();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearAll();
    });
  }
}
