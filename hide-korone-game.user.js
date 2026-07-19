// ==UserScript==
// @name         Hide Frappe
// @namespace    https://pekora.zip/
// @version      2.0
// @description  Removes specific games from pekora.zip/Korone game (Hides Frappe By Default)
// @author       you
// @match        *://*.pekora.zip/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'hiddenGameIds';
  const DEFAULT_HIDDEN_IDS = ['840249'];


  const ID_KEYS = [
    'id', 'Id', 'ID',
    'gameId', 'GameId',
    'universeId', 'UniverseId',
    'placeId', 'PlaceId',
    'rootPlaceId', 'RootPlaceId'
  ];

  function getHiddenIds() {
    return GM_getValue(STORAGE_KEY, DEFAULT_HIDDEN_IDS).map(String);
  }

  function setHiddenIds(ids) {
    GM_setValue(STORAGE_KEY, ids);
  }

  function isHiddenId(value) {
    if (value === undefined || value === null) return false;
    return getHiddenIds().includes(String(value));
  }


  function stripHiddenGames(data) {
    if (Array.isArray(data)) {
      return data
        .filter((item) => {
          if (item && typeof item === 'object') {
            return !ID_KEYS.some((key) => key in item && isHiddenId(item[key]));
          }
          return true;
        })
        .map(stripHiddenGames);
    }
    if (data && typeof data === 'object') {
      const out = {};
      for (const key of Object.keys(data)) {
        out[key] = stripHiddenGames(data[key]);
      }
      return out;
    }
    return data;
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response;

    try {
      const json = await response.clone().json();
      const filtered = stripHiddenGames(json);
      return new Response(JSON.stringify(filtered), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (e) {
      return response; 
    }
  };


  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._interceptedUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('readystatechange', function () {
      if (this.readyState !== 4) return;
      try {
        const contentType = this.getResponseHeader('content-type') || '';
        if (!contentType.includes('application/json')) return;

        const json = JSON.parse(this.responseText);
        const filteredText = JSON.stringify(stripHiddenGames(json));

        Object.defineProperty(this, 'responseText', { get: () => filteredText, configurable: true });
        Object.defineProperty(this, 'response', { get: () => filteredText, configurable: true });
      } catch (e) {

      }
    });
    return originalSend.apply(this, args);
  };

  function addGameId() {
    const id = prompt('Enter the game ID to hide (the number in /games/{id}/...):');
    if (!id) return;
    const trimmed = id.trim();
    if (!/^\d+$/.test(trimmed)) {
      alert("That doesn't look like a valid game ID (numbers only).");
      return;
    }
    const ids = getHiddenIds();
    if (!ids.includes(trimmed)) {
      setHiddenIds([...ids, trimmed]);
      alert(`Game ${trimmed} will be filtered out. Refresh the page to see it gone.`);
    } else {
      alert('That game is already hidden.');
    }
  }

  function removeGameId() {
    const ids = getHiddenIds();
    if (!ids.length) {
      alert('No games are currently hidden.');
      return;
    }
    const id = prompt(`Currently hidden: ${ids.join(', ')}\n\nEnter the game ID to unhide:`);
    if (!id) return;
    const trimmed = id.trim();
    if (!ids.includes(trimmed)) {
      alert("That ID isn't in the hidden list.");
      return;
    }
    setHiddenIds(ids.filter((x) => x !== trimmed));
    alert(`Game ${trimmed} unhidden. Refresh the page to see it again.`);
  }

  function listGameIds() {
    const ids = getHiddenIds();
    alert(ids.length ? `Hidden game IDs:\n${ids.join('\n')}` : 'No games are currently hidden.');
  }

  GM_registerMenuCommand('Hide a game by ID', addGameId);
  GM_registerMenuCommand('Unhide a game by ID', removeGameId);
  GM_registerMenuCommand('List hidden games', listGameIds);
})();
