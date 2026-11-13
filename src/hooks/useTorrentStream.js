
import { useCallback, useEffect, useRef, useState } from 'react';
import { destroyCurrent, loadSource } from '../lib/torrentClient';
import { TORRENT_PEER_TIMEOUT_MS } from '../lib/config';

const initialState = {
  status: 'idle',
  streamUrl: '',
  torrent: null,
  file: null,
  peers: 0,
  downloadSpeed: 0,
  progress: 0,
  error: '',
  noPeers: false,
};

export default function useTorrentStream(source) {
  const [state, setState] = useState(initialState);
  const [retryKey, setRetryKey] = useState(0);
  const generation = useRef(0);

  const retry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!source?.magnet) {
      setState({ ...initialState });
      return undefined;
    }

    let active = true;
    const thisGeneration = ++generation.current;
    let peerTimeout = null;
    let pollTimer = null;
    let connected = false;

    setState({ ...initialState, status: 'initialising' });

    const update = (patch) => {
      if (active && generation.current === thisGeneration) {
        setState((current) => ({ ...current, ...patch }));
      }
    };

    async function start() {
      try {
        const result = await loadSource({
          magnet: source.magnet,
          fileIndex: source.file_index ?? source.fileIndex,
          onStatus: ({ status }) => update({ status }),
        });

        if (!active || generation.current !== thisGeneration) {
          await destroyCurrent();
          return;
        }

        const { torrent, file, streamUrl } = result;

        update({
          status: 'buffering',
          torrent,
          file,
          streamUrl,
          peers: torrent.numPeers || 0,
          progress: file.progress || 0,
        });

        const markConnected = () => {
          connected = true;
          if (peerTimeout) window.clearTimeout(peerTimeout);
          update({ noPeers: false });
        };

        torrent.on('wire', markConnected);
        if (torrent.numPeers > 0) markConnected();

        peerTimeout = window.setTimeout(() => {
          if (!connected && active) {
            update({
              status: 'error',
              noPeers: true,
              error: 'No WebRTC peers found for this release',
            });
          }
        }, TORRENT_PEER_TIMEOUT_MS);

        pollTimer = window.setInterval(() => {
          update({
            peers: torrent.numPeers || 0,
            downloadSpeed: torrent.downloadSpeed || 0,
            progress: file.progress || 0,
          });
        }, 500);
      } catch (error) {
        if (active) {
          update({
            status: 'error',
            error: error.message || 'Unable to start this torrent.',
          });
        }
      }
    }

    start();

    return () => {
      active = false;
      if (peerTimeout) window.clearTimeout(peerTimeout);
      if (pollTimer) window.clearInterval(pollTimer);
      destroyCurrent();
    };
  }, [source?.id, source?.magnet, source?.file_index, source?.fileIndex, retryKey]);

  const setReady = useCallback(() => {
    setState((current) => ({ ...current, status: 'ready' }));
  }, []);

  const setPlaybackError = useCallback(() => {
    setState((current) => ({
      ...current,
      status: 'error',
      error: "Your browser can't play this file. Ask the admin for an MP4 (H.264/AAC) release.",
      noPeers: false,
    }));
  }, []);

  return { ...state, retry, setReady, setPlaybackError };
}
