
import WebTorrent from 'webtorrent/dist/webtorrent.min.js';
import {
  WEBTORRENT_ANNOUNCE,
  WEBTORRENT_SERVICE_WORKER_URL,
  TORRENT_SUPPORTED_VIDEO_EXTENSIONS,
} from './config';

let client = null;
let serviceWorkerRegistration = null;
let serverCreated = false;
let currentTorrent = null;
let currentLoadId = 0;

function emitStatus(callback, status, extra = {}) {
  if (typeof callback === 'function') {
    callback({ status, ...extra });
  }
}

function extensionOf(name = '') {
  const cleanName = name.split(/[?#]/)[0];
  const dot = cleanName.lastIndexOf('.');
  return dot >= 0 ? cleanName.slice(dot).toLowerCase() : '';
}

function chooseVideoFile(files, fileIndex) {
  if (fileIndex !== undefined && fileIndex !== null && fileIndex !== '') {
    const index = Number(fileIndex);
    if (Number.isInteger(index) && files[index]) return files[index];
  }

  return files
    .filter((file) =>
      TORRENT_SUPPORTED_VIDEO_EXTENSIONS.includes(extensionOf(file.name)),
    )
    .sort((a, b) => (b.length || b.size || 0) - (a.length || a.size || 0))[0] || null;
}

async function removeCurrentTorrent() {
  const torrent = currentTorrent;
  currentTorrent = null;

  if (!torrent || !client) return;

  try {
    await client.remove(torrent.infoHash, { destroyStore: true });
  } catch (error) {
    console.warn('[WebTorrent] Torrent cleanup:', error);
  }
}

export async function initClient() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('This browser does not support service-worker streaming.');
  }

  if (!client) {
    if (WebTorrent.WEBRTC_SUPPORT === false) {
      throw new Error('WebRTC is not supported in this browser.');
    }

    client = new WebTorrent();
    client.on('error', (error) => {
      console.error('[WebTorrent client]', error);
    });
  }

  if (!serviceWorkerRegistration) {
    serviceWorkerRegistration = await navigator.serviceWorker.register(
      WEBTORRENT_SERVICE_WORKER_URL,
      { scope: '/' },
    );
  }

  serviceWorkerRegistration = await navigator.serviceWorker.ready;

  if (!serviceWorkerRegistration.active) {
    throw new Error('The WebTorrent service worker did not become active.');
  }

  if (!serverCreated) {
    client.createServer({ controller: serviceWorkerRegistration });
    serverCreated = true;
  }

  return client;
}

export async function destroyCurrent() {
  currentLoadId += 1;
  await removeCurrentTorrent();
}

export async function loadSource({ magnet, fileIndex, onStatus } = {}) {
  if (!magnet || typeof magnet !== 'string') {
    throw new Error('This release does not have a valid magnet link.');
  }

  const loadId = ++currentLoadId;

  await removeCurrentTorrent();

  if (loadId !== currentLoadId) {
    throw new Error('This torrent request was cancelled.');
  }

  emitStatus(onStatus, 'initialising');

  const activeClient = await initClient();

  if (loadId !== currentLoadId) {
    throw new Error('This torrent request was cancelled.');
  }

  emitStatus(onStatus, 'connecting');

  const torrent = await new Promise((resolve, reject) => {
    let settled = false;

    const onClientError = (error) => {
      if (settled) return;
      settled = true;
      activeClient.off('error', onClientError);
      reject(error);
    };

    activeClient.once('error', onClientError);

    try {
      activeClient.add(
        magnet,
        { announce: WEBTORRENT_ANNOUNCE },
        (addedTorrent) => {
          if (settled) return;
          settled = true;
          activeClient.off('error', onClientError);
          resolve(addedTorrent);
        },
      );
    } catch (error) {
      onClientError(error);
    }
  });

  if (loadId !== currentLoadId) {
    try {
      await activeClient.remove(torrent.infoHash, { destroyStore: true });
    } catch {
      // The request was cancelled; cleanup is best effort.
    }
    throw new Error('This torrent request was cancelled.');
  }

  currentTorrent = torrent;

  const file = chooseVideoFile(torrent.files || [], fileIndex);

  if (!file) {
    await removeCurrentTorrent();
    throw new Error('No supported video file was found in this release.');
  }

  file.select();

  emitStatus(onStatus, 'buffering', {
    torrent,
    file,
    peers: torrent.numPeers || 0,
    progress: file.progress || 0,
  });

  const streamUrl = file.streamURL;

  if (!streamUrl) {
    await removeCurrentTorrent();
    throw new Error('WebTorrent could not create a stream URL for this file.');
  }

  return { torrent, file, streamUrl };
}

export function getCurrentTorrent() {
  return currentTorrent;
}

export function getTorrentClient() {
  return client;
}
