function assignmentOrder(left, right) {
  return left.fromCharacter - right.fromCharacter
    || left.toCharacter - right.toCharacter
    || String(left.id).localeCompare(String(right.id));
}

/**
 * Build the Inspector's canonical composition order. Source order comes from
 * the project; authoring time is deliberately ignored. Exact visual/audio
 * ranges form one synchronized passage, including legacy assignments created
 * before syncGroup was persisted.
 */
export function buildSequenceMapGroups({ sources = [], visualAssignments = [], audioAssignments = [] } = {}) {
  return sources.map((source, sourceIndex) => {
    const sourceId = String(source.id);
    const visuals = visualAssignments
      .filter(item => String(item.sourceId) === sourceId)
      .sort(assignmentOrder);
    const audios = audioAssignments
      .filter(item => String(item.sourceId) === sourceId)
      .sort(assignmentOrder);
    const usedAudioIds = new Set();
    const entries = visuals.map(visual => {
      const synchronizedAudio = audios.filter(audio => {
        const exactRange = audio.fromCharacter === visual.fromCharacter
          && audio.toCharacter === visual.toCharacter;
        const explicitSync = audio.syncGroup === `sync-${visual.id}`;
        if (!exactRange && !explicitSync) return false;
        usedAudioIds.add(audio.id);
        return true;
      });
      return {
        key: `visual:${visual.id}`,
        sourceId,
        fromCharacter: visual.fromCharacter,
        toCharacter: visual.toCharacter,
        visual,
        audio: synchronizedAudio
      };
    });
    for (const audio of audios) {
      if (usedAudioIds.has(audio.id)) continue;
      entries.push({
        key: `audio:${audio.id}`,
        sourceId,
        fromCharacter: audio.fromCharacter,
        toCharacter: audio.toCharacter,
        visual: null,
        audio: [audio]
      });
    }
    entries.sort((left, right) => left.fromCharacter - right.fromCharacter
      || left.toCharacter - right.toCharacter
      || (left.visual ? -1 : 1)
      || left.key.localeCompare(right.key));
    return { source, sourceId, sourceIndex, entries };
  });
}
