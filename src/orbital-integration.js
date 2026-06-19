/**
 * ChamberOrbital Integration for V1
 * Wires the orbital UI to V1's existing logic
 */

/**
 * Initialize orbital interface
 */
export function initOrbital(state, elements) {
  console.log('[Orbital] Initializing interface...');

  // Track which modal is open
  let currentModal = null;

  // Get orbital elements
  const orbitalNodes = document.querySelectorAll('[data-orbit]');
  const modals = {
    temporal: document.getElementById('modal-temporal'),
    audio: document.getElementById('modal-audio'),
    visual: document.getElementById('modal-visual')
  };
  const modalCloses = document.querySelectorAll('[data-close]');
  const textSourceEl = document.getElementById('text-source');
  const beginBtn = document.getElementById('enter-button');

  // Orbit node clicks -> open modals
  orbitalNodes.forEach(node => {
    node.addEventListener('click', () => {
      const orbitType = node.dataset.orbit;
      openModal(orbitType);
    });
  });

  // Modal close buttons
  modalCloses.forEach(btn => {
    btn.addEventListener('click', () => {
      const modalType = btn.dataset.close;
      closeModal(modalType);
    });
  });

  // Close modal on overlay click
  Object.values(modals).forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(currentModal);
      }
    });
  });

  function openModal(type) {
    // Close current modal if any
    if (currentModal && modals[currentModal]) {
      modals[currentModal].hidden = true;
    }

    // Open new modal
    if (modals[type]) {
      modals[type].hidden = false;
      currentModal = type;
    }
  }

  function closeModal(type) {
    if (modals[type]) {
      modals[type].hidden = true;
      currentModal = null;
    }
  }

  // Update orbital status displays
  function updateOrbitalStatus() {
    const temporalStatus = document.getElementById('temporal-status');
    const audioStatus = document.getElementById('audio-status');
    const visualStatus = document.getElementById('visual-status');

    if (temporalStatus) {
      temporalStatus.textContent = `${state.wpm} WPM · ${state.chunkMode} · ${state.curveType}`;
    }

    if (audioStatus) {
      const presetNames = {
        silent: 'Silent',
        focus: 'Focus',
        deep: 'Deep',
        gateway: 'Gateway'
      };
      audioStatus.textContent = presetNames[state.audioPreset] || 'Silent';
    }

    if (visualStatus) {
      const modeNames = {
        focal: 'Focal',
        chamber: 'Chamber',
        orbital: 'Orbital'
      };
      visualStatus.textContent = modeNames[state.displayMode] || 'Focal';
    }
  }

  // Wire WPM slider in temporal modal
  const wpmSlider = document.querySelector('#modal-temporal #wpm-slider');
  const wpmValue = document.querySelector('#modal-temporal #wpm-value');
  if (wpmSlider && wpmValue) {
    wpmSlider.addEventListener('input', (e) => {
      const wpm = parseInt(e.target.value);
      state.wpm = wpm;
      wpmValue.textContent = wpm;
      updateOrbitalStatus();
    });
  }

  // Wire chunk mode buttons
  const chunkBtns = document.querySelectorAll('#modal-temporal .chunk-option');
  chunkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      state.chunkMode = mode;
      chunkBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateOrbitalStatus();
    });
  });

  // Wire curve buttons
  const curveBtns = document.querySelectorAll('#modal-temporal .curve-option');
  curveBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const curve = btn.dataset.curve;
      state.curveType = curve;
      curveBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateOrbitalStatus();
    });
  });

  // Wire audio preset buttons
  const audioPresetBtns = document.querySelectorAll('#modal-audio .audio-preset-option');
  audioPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      state.audioPreset = preset;
      audioPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateOrbitalStatus();
    });
  });

  // Wire voice toggle
  const voiceToggle = document.querySelector('#modal-audio #voice-toggle');
  if (voiceToggle) {
    voiceToggle.addEventListener('change', (e) => {
      state.voiceEnabled = e.target.checked;
    });
  }

  // Wire display mode buttons
  const modeBtns = document.querySelectorAll('#modal-visual .mode-option');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      state.displayMode = mode;
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateOrbitalStatus();
    });
  });

  // Wire visual interlocution toggle
  const visualsToggle = document.querySelector('#modal-visual #visuals-toggle');
  const interlocutionControls = document.getElementById('interlocution-controls');
  if (visualsToggle && interlocutionControls) {
    visualsToggle.addEventListener('change', (e) => {
      state.audioEnabled = e.target.checked; // This should be visualEnabled but keeping V1 state
      interlocutionControls.classList.toggle('disabled', !e.target.checked);
    });
  }

  // Initial status update
  updateOrbitalStatus();

  console.log('[Orbital] Interface initialized');

  return { updateOrbitalStatus };
}
