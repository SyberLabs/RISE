/**
 * SOL Sequences
 * Functional content for lived time.
 *
 * Each sequence carries:
 * - content: the guided script (newline = phrase pause, blank line = long pause)
 * - config: pacing (wpm, curve), audio preset, and a visualConfig using the
 *   standard schema: visualMode 'off' | 'focals' | 'attractor' | 'interlocution'
 *
 * Durations shown in the SOL view are computed from content + wpm at render
 * time; durationEst remains as an authorial fallback only.
 */

/**
 * A SECOND VOCABULARY LIVED HERE AND NOBODY SPOKE IT.
 *
 * `SOL_TAXONOMY` was exported and imported by nothing. It listed the
 * sequences under ids that had drifted — `sit-threshold` where the live
 * data says `sol-sit-threshold` — and called their titles `name` where
 * the live data says `title`. Two shapes for one set of things, only one
 * of them read, and the unread one quietly wrong.
 *
 * It is deleted rather than corrected. SOL_SEQUENCES carries the
 * category on each entry, which is all the grouping ever needed.
 */

export const SOL_SEQUENCES = [
  // ═══════════════════════════════════════════════
  // TEMPORAL
  // ═══════════════════════════════════════════════
  {
    id: "sol-dawn",
    title: "Dawn",
    subtitle: "The threshold of waking.",
    description: "Before the day has claimed you. Intention-setting. Arrival into the body.",
    tone: "soft emergence, gradual brightening",
    durationEst: "3-5 min",
    category: "temporal",
    config: {
      wpm: 230,
      curve: "induction",
      audioPreset: "focus",
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: { sourceFamily: 'procedural', frequency: 0.2, duration: 150, sourced: [], procedural: ['turrell'] }
      }
    },
    content: "The body wakes before the mind is fully formed.\nDo not rush to fill the vessel with the world.\nLet the breath anchor the shape of your existence.\nYou are here.\n\nThe light outside is still deciding what it will be.\nSo are you.\nThis hour belongs to no one.\nNo message has reached you yet.\nNo demand has found your name.\n\nFeel the weight of the body against whatever holds it.\nFeel the breath arrive without being asked.\nThis is the baseline.\nEverything today will be measured against this stillness.\n\nThis day has not yet been spoken for.\nWhat is the single intention that will guide your hours?\nNot a list.\nOne intention.\nName it now, in the quiet, before the noise can argue.\n\nHold it lightly, like water in cupped hands.\nDo not grip it.\nA gripped intention becomes anxiety.\nA held intention becomes direction.\n\nThe sun does not hurry over the horizon.\nIt arrives at its own pace, and the world adjusts.\nArrive the same way.\n\nArrive into the body.\nArrive into the hour.\nBegin."
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
      wpm: 350,
      curve: "ascent",
      audioPreset: "deep",
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: { sourceFamily: 'procedural', frequency: 0.3, duration: 150, sourced: [], procedural: ['turrell'] }
      }
    },
    content: "The day begins its demands.\nGather your energy not from anxiety, but from purpose.\nAnxiety burns the same fuel and builds nothing.\nPurpose burns clean.\n\nYou are the architect of your own attention.\nEvery hour, something will bid for it.\nMost bids are noise.\nYou already know which work matters.\nYou knew it before you opened anything.\n\nLet distractions fall away like mist.\nThey were never solid.\nThey only looked solid while you were standing still.\nMove, and they part.\n\nName the primary work.\nOne thing that, done today, makes the day count.\nSee it finished.\nSee the state of the world after it exists.\nNow walk backward from that image to this moment.\nThat path is your morning.\n\nThe body wants motion.\nGive it motion.\nThe mind wants order.\nGive it one clear target.\n\nDo not negotiate with the day.\nEnter it.\nMove forward with clarity."
  },
  {
    id: "sol-midday",
    title: "Midday",
    subtitle: "The pause at the peak.",
    description: "Brief reset. Recalibration.",
    tone: "grounding, centering, quick",
    durationEst: "2-3 min",
    category: "temporal",
    config: {
      wpm: 290,
      curve: "flat",
      audioPreset: "focus",
      visualConfig: {
        visualMode: 'focals',
        focals: { type: 'standard', standardGlyph: 'anchor' }
      }
    },
    content: "The sun is highest.\nYou are in motion.\nStop for a moment.\n\nNot to rest.\nTo measure.\n\nWhere has the morning gone?\nName what you actually did, without judgment.\nName what pulled you sideways.\nDrift is not failure.\nUnnoticed drift is.\n\nRecalibrate your attention.\nThe afternoon is still unwritten.\nWhat is the one thing it must contain?\n\nBreathe once, fully.\nDrop the shoulders.\nUnclench the jaw you did not know was clenched.\n\nReturn to center.\nThen return to motion."
  },
  {
    id: "sol-afternoon",
    title: "Afternoon",
    subtitle: "The long slope of the day.",
    description: "Energy wanes. Attention scatters. Renewal. Second wind. Refocus.",
    tone: "revitalizing, refocusing, second-gathering",
    durationEst: "4-6 min",
    category: "temporal",
    config: {
      wpm: 320,
      curve: "wave",
      audioPreset: "gateway",
      visualConfig: {
        visualMode: 'attractor',
        attractor: { system: 'halvorsen' }
      }
    },
    content: "The slope of the day lengthens.\nAttention scatters like light through old glass.\nThis is not weakness.\nThis is physics.\nEvery system dips before its second rise.\n\nDo not fight the dip with force.\nForce at low tide is waste.\nInstead, narrow the aperture.\nOne task.\nOne surface.\nOne clean line of effort.\n\nGather the second wind.\nIt does not arrive on its own.\nIt is assembled — from posture, from breath, from a decision.\nSit up.\nBreathe down into the belly.\nDecide.\n\nWhat remains of this day is enough.\nEnough time, enough energy, enough light.\nBut only for what matters.\nThe hours will not stretch for trivia.\n\nRenew the focus.\nThe final push requires steadiness, not frantic effort.\nSteady hands finish the work.\nFinish steady."
  },
  {
    id: "sol-evening",
    title: "Evening",
    subtitle: "The unwinding.",
    description: "The day is releasing you. Transition. Processing. Letting go.",
    tone: "softening, releasing, gratitude",
    durationEst: "5-8 min",
    category: "temporal",
    config: {
      wpm: 260,
      curve: "flat",
      audioPreset: "silent",
      visualConfig: {
        visualMode: 'focals',
        focals: { type: 'standard', standardGlyph: 'breath' }
      }
    },
    content: "The day releases its grip.\nFeel the fingers loosen, one by one.\nWhatever was urgent at noon is now only true or untrue.\nUrgency was the costume it wore.\n\nTransition into the unwinding.\nThe body has carried you since dawn.\nThank it by slowing down.\n\nProcess what has happened.\nLet the events of the day pass once across the mind.\nDo not edit.\nDo not defend yourself to an imagined judge.\nJust watch the footage.\nThen let it go dark.\n\nGratitude for the work done.\nName one thing that moved forward today.\nHowever small.\nForward is forward.\n\nRelease the work left undone.\nIt will keep.\nUnfinished is not broken.\nTomorrow's hands will be stronger than tonight's worry.\n\nThe evening is not the day's failure to continue.\nIt is the day completing itself.\nComplete with it.\nSoften.\nRelease."
  },
  {
    id: "sol-night",
    title: "Night",
    subtitle: "The descent.",
    description: "You are leaving the waking world. Preparation for threshold crossing.",
    tone: "deepening, slowing, surrendering",
    durationEst: "8-12 min",
    category: "temporal",
    config: {
      wpm: 220,
      curve: "induction",
      audioPreset: "deep",
      visualConfig: {
        visualMode: 'attractor',
        attractor: { system: 'thomas' }
      }
    },
    content: "Leave the waking world behind.\nIt will manage without you.\nIt always has.\n\nThe lights of the mind go out one room at a time.\nLet them.\nDo not run back to check the locks.\nThe locks are fine.\n\nSurrender to the descent.\nDescent is not falling.\nFalling is fast and has an impact.\nDescent is slow and has a floor made of sleep.\n\nSlow the breath.\nIn, and the body fills like a sail.\nOut, and the sail empties, and the boat still floats.\nAgain.\nSlower.\n\nThe threshold of sleep approaches.\nYou will not notice crossing it.\nNo one ever does.\nThat is the kindness of the threshold —\nit asks nothing of you but absence.\n\nDeepen the stillness.\nThe thoughts that remain are just the mind talking in its sleep.\nYou do not have to answer them.\n\nDescend.\nDescend.\nRest."
  },
  {
    id: "sol-deepnight",
    title: "Deep Night",
    subtitle: "The 2am space.",
    description: "Full hypnagogic work. Extended sessions.",
    tone: "threshold, liminal, creative, receptive",
    durationEst: "15-45 min",
    category: "temporal",
    config: {
      wpm: 170,
      curve: "wave",
      audioPreset: "gateway",
      visualConfig: {
        visualMode: 'attractor',
        attractor: { system: 'aizawa' }
      }
    },
    content: "The world is entirely quiet.\nThe last engines have stopped.\nEven the house has finished settling.\nThis is the hour with no owner.\n\nThis is the liminal space.\nThe border between waking and dream is a wide country,\nand you are standing in it.\nMost people cross at full speed, asleep before they see it.\nYou are here to walk slowly.\n\nBe receptive.\nDo not reach for images.\nLet the images arrive, the way eyes adjust to darkness —\nnot by effort, but by staying.\n\nThe mind begins generating its own shapes now.\nFaces that belong to no one.\nRooms that were never built.\nWords that dissolve when read twice.\nObserve them.\nThey are the raw material of everything you have ever made.\n\nHold the threshold state.\nIf you drift toward sleep, let one breath bring you back —\nonly one.\nIf you sharpen toward waking, soften the eyes.\nThe skill is staying in the doorway.\n\nNothing is required of you here.\nNo insight must be captured.\nNo vision must be earned.\nThe visit itself is the practice.\n\nStay.\nWatch.\nLet the deep night work."
  },

  // ═══════════════════════════════════════════════
  // SITUATIONAL
  // ═══════════════════════════════════════════════
  {
    id: "sol-sit-threshold",
    title: "Before the Threshold",
    subtitle: "Exam. Interview. Performance. Competition.",
    description: "The moment before the moment.",
    tone: "calm intensity, gathered power, stillness before action",
    durationEst: "3-5 min",
    category: "situational",
    config: {
      wpm: 350,
      curve: "ascent",
      audioPreset: "focus",
      visualConfig: { visualMode: 'off' }
    },
    content: "You are here. Your body is here.\nBring the mind to the same address.\n\nYou have prepared.\nThe preparation is in the muscles now, in the pathways.\nIt does not need your supervision anymore.\nTrying to hold all of it in your head at the door\nis like carrying water to a river.\n\nYou are capable.\nNot certain — capable.\nCertainty is for people who have stopped growing.\nCapability is what walks through doors.\n\nThe fear you feel is voltage.\nIt has no opinion about you.\nIt will power clarity or panic — your choice of circuit.\nChoose clarity.\n\nThe only moment is now.\nThe outcome is not yours to control.\nThe outcome was never yours to control.\nOnly the action is yours.\nThe next word. The next step. The first move.\n\nBreathe in once, slow, through the nose.\nOut slower.\nDrop the shoulders.\n\nStep forward."
  },
  {
    id: "sol-sit-resolution",
    title: "Resolution",
    subtitle: "After conflict. After rupture. After hard conversation.",
    description: "The return to wholeness.",
    tone: "gentle, non-judgmental, spacious",
    durationEst: "8-12 min",
    category: "situational",
    config: {
      wpm: 260,
      curve: "flat",
      audioPreset: "deep",
      visualConfig: {
        visualMode: 'focals',
        focals: { type: 'standard', standardGlyph: 'lotus' }
      }
    },
    content: "Something happened.\nWords were exchanged that had edges.\nOr silence was used as a wall.\nEither way, the surface of things is disturbed.\n\nFeelings are present. Let them be.\nAnger has a right to sit in the room.\nSo does hurt. So does the embarrassed wish\nto have said it differently.\nNone of them need to be fed.\nNone of them need to be exiled.\n\nDo not draft the next argument.\nThe mind wants to win a conversation that is over.\nNotice the drafting. Set down the pen.\n\nThe other person is also lying awake somewhere,\nrunning their own tape,\nfeeling their own version of this weight.\nYou do not have to agree with their version\nto know it exists.\n\nThis too is part of the path.\nNo bond worth having has an unbroken surface.\nThe cracks are where two separate people\nkeep failing to be one person —\nwhich is to say, the cracks are honest.\n\nYou contain multitudes.\nThe one who was sharp, and the one who regrets it.\nThe one who was hurt, and the one who understands.\nAll of them are you. All of them are welcome here.\n\nTomorrow you will be different.\nSlightly. Enough.\nRepair begins as a private decision\nbefore it becomes a public word.\n\nMake the decision.\nReturn to wholeness."
  },
  {
    id: "sol-sit-fidelity",
    title: "Fidelity",
    subtitle: "Remembering what matters. Returning to center.",
    description: "When you have drifted from your values.",
    tone: "serious, warm, clear-eyed",
    durationEst: "6-10 min",
    category: "situational",
    config: {
      wpm: 290,
      curve: "flat",
      audioPreset: "focus",
      visualConfig: {
        visualMode: 'focals',
        focals: { type: 'standard', standardGlyph: 'star' }
      }
    },
    content: "What do you actually care about?\nNot what you say at dinners.\nNot what the profile claims.\nWhat you would keep if you could keep three things.\n\nName them.\nSlowly.\nNotice how few they are.\nNotice how quiet they are —\nthe things that matter rarely shout.\nThat is why they get drowned out.\n\nWhere have you drifted?\nDo not look away from the question.\nThe calendar does not lie.\nThe screen-time report does not lie.\nWhere the hours went is where the life went.\n\nDrifting is human.\nEvery ship drifts.\nThe stars were invented for exactly this reason —\nnot to prevent drift, but to make return possible.\n\nYou can return.\nNot by heroic overhaul.\nBy one degree of correction, held steadily.\nThe smallest honest adjustment, kept,\noutweighs the grand resolution, abandoned.\n\nWhat is the one degree?\nName the single change that realigns tomorrow\nwith what you said you loved.\nSmall enough to keep.\nReal enough to count.\n\nYou can begin again.\nThis is not a consolation prize.\nBeginning again is the entire practice.\nEveryone who ever stayed true\nis just someone who returned more times than they left.\n\nRecommit to the center.\nQuietly.\nNow."
  },

];
