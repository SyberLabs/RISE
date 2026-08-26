/**
 * Names the Chapel's own collections. The Navigator draws these; it does
 * not invent them.
 */
import { chapelCollectionIds, chapelCollectionLabel } from './collections.js';
import { doreCollectionLabel } from './dore-provider.js';

export { chapelCollectionIds };

export function isChapelCollection(id) {
  return typeof id === 'string' && (id.startsWith('chapel-') || id.startsWith('dore:'));
}

export function readingCollectionLabel(id) {
  return chapelCollectionLabel(id)
    || doreCollectionLabel(id)
    || gospelLabel(id)
    || id;
}

function gospelLabel(id) {
  if (typeof id !== 'string' || !id.startsWith('chapel-gospel-')) return null;
  return id.slice('chapel-gospel-'.length).split('-')
    .map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}
