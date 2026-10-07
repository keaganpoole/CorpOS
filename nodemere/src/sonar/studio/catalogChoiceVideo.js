import { api } from '../lib/api';
import { avatarVideoUrl } from './catalogGeometry';

let request = null;
let media = null;
let cancelLoad = null;
let generation = 0;

export function preloadCatalogChoiceVideo() {
  if (request) return request;
  const currentGeneration = generation;
  request = api.getCatalogVideoCandidates().then(rows => {
    if (currentGeneration !== generation) return null;
    const sources = [...new Set((Array.isArray(rows) ? rows : []).map(row =>
      typeof row.avatar_video === 'string' ? row.avatar_video.trim() : '').filter(Boolean).map(avatarVideoUrl))];
    if (!sources.length) return null;
    media = document.createElement('video');
    media.muted = true; media.loop = true; media.playsInline = true; media.preload = 'auto';
    media.className = 'ns-choice-catalog-video';
    media.setAttribute('aria-hidden', 'true'); media.tabIndex = -1;
    const video = media;
    return new Promise(resolve => {
      const finish = value => {
        video.removeEventListener('loadeddata', loaded);
        video.removeEventListener('error', failed);
        cancelLoad = null;
        resolve(value);
      };
      const loaded = () => finish(video);
      let attempts = 0;
      const failed = () => {
        if (currentGeneration !== generation || attempts >= sources.length) {
          finish(null);
          return;
        }
        video.src = sources[attempts++];
        video.load();
      };
      cancelLoad = () => finish(null);
      video.addEventListener('loadeddata', loaded, { once: true });
      video.addEventListener('error', failed);
      // A broken first source should not leave the hire card blank.
      const startIndex = Math.floor(Math.random() * sources.length);
      sources.push(...sources.splice(0, startIndex));
      failed();
    });
  }).catch(() => null).then(video => {
    if (!video && currentGeneration === generation) {
      media?.removeAttribute('src');
      media = null;
      request = null;
    }
    return video;
  });
  return request;
}

export function disposeCatalogChoiceVideo() {
  generation++;
  cancelLoad?.();
  if (media) {
    media.pause(); media.removeAttribute('src'); media.load(); media.remove();
  }
  media = null; request = null;
}
