'use strict';

import 'whatwg-fetch';
import { dataURL, ActivateMessageBoard, micboard, updateNavLinks, dataFilterFromList } from './app.js';
import { renderGroup, updateSlot } from './channelview.js';
import { updateChart } from './chart-smoothie.js';


export function postJSON(url, data, callback) {
  fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(res => res.json())
    .then((response) => {
      console.log('Success:', JSON.stringify(response))
      if (callback) {
        callback();
      }
    })
    .catch(error => console.error('Error:', error));
}

export function JsonUpdate() {
  return fetch(dataURL)
    .then(response => response.json())
    .then((data) => {
      if (micboard.connectionStatus === 'DISCONNECTED') {
        window.location.reload();
      }
      // Update live slots
      data.receivers.forEach((rx) => {
        rx.tx.forEach(updateSlot);
      });
      // Rebuild transmitters from latest data when not in demo
      if (micboard.url.demo !== 'true') {
        micboard.transmitters = [];
        dataFilterFromList(data);
      }
      micboard.connectionStatus = 'CONNECTED';
      micboard.config = data.config;
      return data;
    }).catch((error) => {
      console.log(error);
      micboard.connectionStatus = 'DISCONNECTED';
      throw error;
    });
}


function updateGroup(data) {
  console.log('dgroup: ' + data.group + ' mgroup: ' + micboard.group);
  micboard.groups[data.group].title = data.title;
  micboard.groups[data.group].slots = data.slots;
  if (micboard.group === data.group) {
    renderGroup(data.group);
  }
  updateNavLinks();
}

export function initLiveData() {
  // Prefer websocket updates; reduce polling to a 5s fallback to cut load
  wsConnect();
  setInterval(JsonUpdate, 5000);
}

function wsConnect() {
  const loc = window.location;
  let newUri;

  if (loc.protocol === 'https:') {
    newUri = 'wss:';
  } else {
    newUri = 'ws:';
  }

  newUri += '//' + loc.host + loc.pathname + 'ws';

  micboard.socket = new WebSocket(newUri);

  micboard.socket.onmessage = (msg) => {
    const data = JSON.parse(msg.data);

    if (data['chart-update']) {
      data['chart-update'].forEach(updateChart);
    }
    if (data['data-update']) {
      data['data-update'].forEach(updateSlot);
    }

    if (data['group-update']) {
      data['group-update'].forEach(updateGroup);
      updateNavLinks();
    }
  };

  micboard.socket.onclose = () => {
    ActivateMessageBoard();
  };

  micboard.socket.onerror = () => {
    ActivateMessageBoard();
  };
}
