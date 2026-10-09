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
      const failed = () => finish(null);
      cancelLoad = failed;
      video.addEventListener('loadeddata', loaded, { once: true });
      video.addEventListener('error', failed, { once: true });
      video.src = sources[Math.floor(Math.random() * sources.length)];
      video.load();
    });
  }).catch(() => null);
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
