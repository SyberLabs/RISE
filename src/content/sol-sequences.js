/**
 * SOL Sequences
 * Functional content for lived time.
 */

export const SOL_TAXONOMY = {
  temporal: [
    { id: 'temporal-dawn', name: 'Dawn', tags: ['temporal'] },
    { id: 'temporal-morning', name: 'Morning', tags: ['temporal'] },
    { id: 'temporal-midday', name: 'Midday', tags: ['temporal'] },
    { id: 'temporal-afternoon', name: 'Afternoon', tags: ['temporal'] },
    { id: 'temporal-evening', name: 'Evening', tags: ['temporal'] },
    { id: 'temporal-night', name: 'Night', tags: ['temporal'] },
    { id: 'temporal-deepnight', name: 'Deep Night', tags: ['temporal'] }
  ],
  situational: [
    { id: 'sit-threshold', name: 'Before the Threshold', tags: ['situational'] },
    { id: 'sit-storm', name: 'After the Storm', tags: ['situational'] },
    { id: 'sit-resolution', name: 'Resolution', tags: ['situational'] },
    { id: 'sit-fidelity', name: 'Fidelity', tags: ['situational'] },
    { id: 'sit-grief', name: 'Grief Space', tags: ['situational'] }
  ],
  archetypal: [
    { id: 'arch-cosmological', name: 'Cosmological Motivation', tags: ['archetypal'] },
    { id: 'arch-warrior', name: 'Historical Warrior', tags: ['archetypal'] },
    { id: 'arch-creator', name: 'The Creator', tags: ['archetypal'] },
    { id: 'arch-microcosmic', name: 'Microcosmic Body', tags: ['archetypal'] }
  ]
};

export const SOL_SEQUENCES = [
  // TEMPORAL
  {
    id: "sol-dawn",
    title: "Dawn",
    subtitle: "The threshold of waking.",
    description: "Before the day has claimed you. Intention-setting. Arrival into the body.",
    tone: "soft emergence, gradual brightening",
    durationEst: "3-5 min",
    category: "temporal",
    config: { 
      wpm: 160, 
      curve: "induction", 
      audioPreset: "focus",
      visualConfig: {
        enabled: true,
        visualMode: 'interlocution',
        interlocution: { frequency: 0.2, duration: 120, sourced: ['solar'], procedural: [] }
      }
    },
    content: "The body wakes before the mind is fully formed.\nDo not rush to fill the vessel with the world.\nLet the breath anchor the shape of your existence.\nYou are here.\nThis day has not yet been spoken for.\nWhat is the single intention that will guide your hours?\nHold it lightly, like water in cupped hands.\nArrive into the body."
  },
  {
    id: "sol-morning",
    title: "Morning",
    subtitle: "The gathering of energy.",
    description: "You are entering the day. Activation. Clarity. Purpose.",
    tone: "energizing, clarifying, forward-moving",
    durationEst: "5-8 min",
    category: "temporal",
    config: { 
      wpm: 240, 
      curve: "ascent", 
      audioPreset: "deep",
      visualConfig: {
        enabled: true,
        visualMode: 'interlocution',
        interlocution: { frequency: 0.3, duration: 90, sourced: ['solar'], procedural: [] }
      }
    },
    content: "The day begins its demands.\nGather your energy not from anxiety, but from purpose.\nYou are the architect of your own attention.\nLet distractions fall away like mist.\nFocus on the primary work.\nMove forward with clarity."
  },
  {
    id: "sol-midday",
    title: "Midday",
    subtitle: "The pause at the peak.",
    description: "Brief reset. Recalibration.",
    tone: "grounding, centering, quick",
    durationEst: "2-3 min",
    category: "temporal",
    config: { wpm: 200, curve: "flat", audioPreset: "focus" },
    content: "The sun is highest.\nYou are in motion.\nStop for a moment.\nRecalibrate your attention.\nWhere have you drifted?\nReturn to center."
  },
  {
    id: "sol-afternoon",
    title: "Afternoon",
    subtitle: "The long slope of the day.",
    description: "Energy wanes. Attention scatters. Renewal. Second wind. Refocus.",
    tone: "revitalizing, refocusing, second-gathering",
    durationEst: "4-6 min",
    category: "temporal",
    config: { wpm: 220, curve: "wave", audioPreset: "gateway" },
    content: "The slope of the day lengthens.\nAttention scatters.\nGather the second wind.\nRenew the focus.\nThe final push requires steadiness, not frantic effort."
  },
  {
    id: "sol-evening",
    title: "Evening",
    subtitle: "The unwinding.",
    description: "The day is releasing you. Transition. Processing. Letting go.",
    tone: "softening, releasing, gratitude",
    durationEst: "5-8 min",
    category: "temporal",
    config: { wpm: 180, curve: "flat", audioPreset: "silent" },
    content: "The day releases its grip.\nTransition into the unwinding.\nProcess what has happened, and let it go.\nGratitude for the work done.\nRelease the work left undone."
  },
  {
    id: "sol-night",
    title: "Night",
    subtitle: "The descent.",
    description: "You are leaving the waking world. Preparation for threshold crossing.",
    tone: "deepening, slowing, surrendering",
    durationEst: "8-12 min",
    category: "temporal",
    config: { wpm: 150, curve: "induction", audioPreset: "deep" },
    content: "Leave the waking world behind.\nSurrender to the descent.\nThe threshold of sleep approaches.\nSlow the breath.\nDeepen the stillness."
  },
  {
    id: "sol-deepnight",
    title: "Deep Night",
    subtitle: "The 2am space.",
    description: "Full hypnagogic work. Extended sessions.",
    tone: "threshold, liminal, creative, receptive",
    durationEst: "15-45 min",
    category: "temporal",
    config: { wpm: 120, curve: "wave", audioPreset: "gateway" },
    content: "The world is entirely quiet.\nThis is the liminal space.\nReceptive and creative.\nHold the threshold state.\nObserve the mind generating its own shapes."
  },

  // SITUATIONAL
  {
    id: "sol-sit-threshold",
    title: "Before the Threshold",
    subtitle: "Exam. Interview. Performance. Competition.",
    description: "The moment before the moment.",
    tone: "calm intensity, gathered power, stillness before action",
    durationEst: "3-5 min",
    category: "situational",
    config: { wpm: 240, curve: "ascent", audioPreset: "focus" },
    content: "You are here. Your body is here.\nYou have prepared. You are capable.\nThe only moment is now.\nThe outcome is not yours to control.\nOnly the action is yours.\nStep forward."
  },
  {
    id: "sol-sit-storm",
    title: "After the Storm",
    subtitle: "After the performance. After the thing.",
    description: "The adrenaline is fading. What now?",
    tone: "exhale, release, gentle return",
    durationEst: "4-6 min",
    category: "situational",
    config: { wpm: 160, curve: "flat", audioPreset: "silent" },
    content: "It is done.\nLet the tension go.\nWhat happens next is not yours to control.\nYou are still you.\nExhale.\nReturn to baseline."
  },
  {
    id: "sol-sit-resolution",
    title: "Resolution",
    subtitle: "After conflict. After rupture. After hard conversation.",
    description: "The return to wholeness.",
    tone: "gentle, non-judgmental, spacious",
    durationEst: "8-12 min",
    category: "situational",
    config: { wpm: 180, curve: "flat", audioPreset: "deep" },
    content: "Something happened.\nFeelings are present. Let them be.\nThis too is part of the path.\nYou contain multitudes.\nTomorrow you will be different.\nReturn to wholeness."
  },
  {
    id: "sol-sit-fidelity",
    title: "Fidelity",
    subtitle: "Remembering what matters. Returning to center.",
    description: "When you have drifted from your values.",
    tone: "serious, warm, clear-eyed",
    durationEst: "6-10 min",
    category: "situational",
    config: { wpm: 200, curve: "flat", audioPreset: "focus" },
    content: "What do you actually care about?\nWhere have you drifted?\nDrifting is human.\nYou can return.\nYou can begin again.\nRecommit to the center."
  },
  {
    id: "sol-sit-grief",
    title: "Grief Space",
    subtitle: "Loss. Absence. The gone that will not return.",
    description: "Not to fix. Just to be with.",
    tone: "quiet, holding, no resolution offered",
    durationEst: "10-15 min",
    category: "situational",
    config: { wpm: 140, curve: "flat", audioPreset: "silent" },
    content: "You are allowed to feel this.\nThe grief is here, and you are here.\nLove does not end.\nGrief has its own time.\nBe with it."
  },

  // ARCHETYPAL
  {
    id: "sol-arch-cosmological",
    title: "Cosmological Motivation",
    subtitle: "Zoom out. Way out. See the scale.",
    description: "You are carbon. You are stellar ash. You are brief.",
    tone: "awe, sobriety, urgency-without-panic",
    durationEst: "8-12 min",
    category: "archetypal",
    config: { wpm: 260, curve: "climax", audioPreset: "gateway" },
    content: "The universe is unimaginably vast.\nConsciousness is incredibly rare.\nYou have only so many days.\nWhat will you do with this brief, improbable existence?\nAct with urgency, without panic."
  },
  {
    id: "sol-arch-warrior",
    title: "Historical Warrior",
    subtitle: "Those who came before. Those who faced worse.",
    description: "Those who continued anyway.",
    tone: "steel, honor, quiet fire",
    durationEst: "6-10 min",
    category: "archetypal",
    config: { wpm: 240, curve: "ascent", audioPreset: "deep" },
    content: "Think of those who faced impossible odds.\nThey faced terror and continued.\nYou are in this lineage of human endurance.\nTheir strength is available to you.\nFind the quiet fire.\nContinue."
  },
  {
    id: "sol-arch-creator",
    title: "The Creator",
    subtitle: "You make things. This is what you do.",
    description: "You have always made things. You will continue.",
    tone: "affirming, activating, unblocking",
    durationEst: "5-8 min",
    category: "archetypal",
    config: { wpm: 220, curve: "wave", audioPreset: "focus" },
    content: "You are a maker.\nYou are allowed to make.\nMaking is how you think.\nThe work knows more than you do.\nLet the doubt exist, but make anyway."
  },
  {
    id: "sol-arch-microcosmic",
    title: "Microcosmic Body",
    subtitle: "The body is a cosmos. The cosmos is a body.",
    description: "Your spine is a spiral staircase. Your crown is ablaze.",
    tone: "luminous, embodied, sacred-material",
    durationEst: "8-15 min",
    category: "archetypal",
    config: { wpm: 160, curve: "induction", audioPreset: "gateway" },
    content: "You are not in a body, you are a body.\nAs above, so below.\nThe vital river flows through you.\nFlesh and cosmos are one thing.\nBecome luminous."
  }
];
