/**
 * The Stations of the Cross as a liturgy definition — the second
 * LiturgyRunner instance (spec §5).
 *
 * Each station: title → the painting held → the traditional versicle
 * and response → Liguori's meditation → silence. Fourteen fixed
 * stations; an opening prayer and a closing. Progression is manual by
 * default — the reader moves between stations deliberately, as one
 * walks a nave (the Via room's By-hand default); a timed mode exists
 * for those who want to be carried.
 */

import {
  STATIONS,
  STATIONS_VERSICLE,
  STATIONS_RESPONSE
} from './stations.js';
import { ROSARY_PRAYERS } from './rosary.js';

const DURATIONS = Object.freeze({
  opening: 9000,
  announce: 6000,
  versicle: 8000,
  meditation: 26000,
  silence: 12000,
  closing: 12000
});

const OPENING_TEXT =
  'In the name of the Father, and of the Son, and of the Holy Spirit. Amen. '
  + 'Lord Jesus, walk with us on this way of the Cross.';

const CLOSING_TEXT =
  'Lord Jesus Christ, by Thy Passion and Death Thou hast redeemed the world. '
  + 'Grant that, having walked Thy way of sorrows, we may share in Thy Resurrection. Amen. '
  + 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.';

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh',
  'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth'];

export function buildStationsDefinition() {
  const steps = [
    {
      id: 'via-opening',
      text: OPENING_TEXT,
      durationMs: DURATIONS.opening,
      state: { phase: 'opening', station: null }
    }
  ];

  for (const station of STATIONS) {
    const n = station.number;
    const stationState = { station: n, title: station.title };
    steps.push(
      {
        id: `station-${n}-announce`,
        text: `The ${ORDINALS[n - 1]} Station: ${station.title}.`,
        durationMs: DURATIONS.announce,
        state: { ...stationState, phase: 'announce' }
      },
      {
        id: `station-${n}-versicle`,
        text: `${STATIONS_VERSICLE}\n${STATIONS_RESPONSE}`,
        durationMs: DURATIONS.versicle,
        state: { ...stationState, phase: 'versicle' }
      },
      {
        id: `station-${n}-meditation`,
        text: station.meditation,
        durationMs: DURATIONS.meditation,
        state: { ...stationState, phase: 'meditation' }
      },
      {
        id: `station-${n}-silence`,
        text: '·',
        durationMs: DURATIONS.silence,
        state: { ...stationState, phase: 'silence' }
      }
    );
  }

  steps.push({
    id: 'via-closing',
    text: CLOSING_TEXT,
    durationMs: DURATIONS.closing,
    state: { phase: 'closing', station: null }
  });

  return {
    id: 'via-crucis',
    title: 'The Stations of the Cross',
    steps
  };
}
