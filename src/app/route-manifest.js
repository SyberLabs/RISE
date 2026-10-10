/**
 * The fixed application route table. Room modules stay lazy, while their
 * application-level capabilities are explicit at this composition boundary.
 */
import { appLocation } from '../core/embed-address.js';

export function createRouteManifest(operations) {
  return [
    {
      id: 'home',
      containerId: 'view-home',
      load: () => import('../components/Home.js'),
      create: (container, data, { Home }) => new Home(container, {
        demoMode: data?.demoMode === true,
        onNavigate: operations.handleNavigate,
        onLaunchJevReading: operations.launchJevReading,
        onLaunchJevSample: operations.launchJevSample,
        onAdjustReading: operations.adjustJevReading,
        onLaunchToday: operations.launchToday,
        getAudioEngine: operations.getAudioEngine,
        getCurrentSession: operations.getCurrentSession
      })
    },
    {
      // Reading is one room (§8.45): the setup, the Chamber and the live host
      // are its panes. The Player is still built only by the chamber-session
      // factory, which the chamber pane calls as this table used to.
      id: 'read',
      containerId: 'view-read',
      load: () => import('../components/Read.js'),
      create: async (container, data, { Read }) => {
        const read = new Read(container, {
          setup: {
            onBeginSession: operations.handleBeginSession,
            onNavigate: operations.handleNavigate,
            getAudioEngine: operations.getAudioEngine,
            getSettings: operations.getSettings,
            onSettingChange: operations.handleSettingsChange,
            onSettingsTransaction: operations.handleSettingsTransaction
          },
          chamber: operations.chamberSession,
          // The host for a live Current: a prompt, and the controls over the
          // Chamber. Loaded whole on demand, so first load does not carry it.
          live: {
            router: operations.router,
            onNavigate: (...args) => operations.handleNavigate(...args),
            // The engine the reading's Chamber plays its beds on, so the host can trace them and duck them under its voice.
            ensureAudioEngine: () => operations.chamberSession.ensureAudioEngine(),
            // The reader's own browser voice for the card is a saved setting (cardVoice).
            getSettings: operations.getSettings,
            onSettingChange: operations.handleSettingsChange,
            // Read when the view is built: in a host's card the query is the card's, not the window's.
            get search() { return appLocation().search; }
          },
          load: {
            chamber: () => import('./chamber-session-factory.js'),
            live: () => import('../live/host/LiveHost.js')
          }
        });
        await read.update(data);
        return read;
      }
    },
    {
      id: 'library',
      containerId: 'view-library',
      load: () => import('../components/Library.js'),
      // The Library hosts the corpus programs as panes (§8.43). Each pane
      // gets what its own room was given; the address data (a Chapel
      // chapter, a Rosary icon) reaches it through `data`.
      create: async (container, data, { Library }) => {
        const library = new Library(container, {
          onNavigate: operations.handleNavigate,
          onSelectText: operations.handleTextSelection,
          getAudioEngine: operations.getAudioEngine,
          paneCapabilities: {
            chapel: {
              onNavigate: operations.handleNavigate,
              getAudioEngine: operations.getAudioEngine,
              onAddressChange: next => operations.router?.updateAddress({ ...next, pane: 'chapel' }),
              onLaunchRosary: operations.launchRosary,
              onLaunchReading: operations.launchChapelReading
            },
            rosary: {
              onNavigate: operations.handleNavigate,
              getAudioEngine: operations.getAudioEngine
            },
            stations: {
              onNavigate: operations.handleNavigate,
              getAudioEngine: operations.getAudioEngine
            },
            journeys: {
              onNavigate: operations.handleNavigate,
              onBeginSession: operations.handleBeginSession,
              getAudioEngine: operations.getAudioEngine
            },
            keystones: {
              onNavigate: operations.handleNavigate,
              onLaunch: operations.launchKeystone
            },
            mint: {
              onNavigate: operations.handleNavigate,
              onOpen: operations.openMintedProgram
            },
            provenance: {
              onNavigate: operations.handleNavigate
            }
          }
        });
        await library.update(data);
        return library;
      }
    },
    {
      id: 'make',
      containerId: 'view-make',
      load: () => import('../components/Make.js'),
      // Make hosts the authoring rooms as tabs (§8.44). Each tab gets what
      // its own room was given; the address data (a Vault section, a
      // catalog search) reaches it through `data`.
      create: async (container, data, { Make }) => {
        const make = new Make(container, {
          onNavigate: operations.handleNavigate,
          tabCapabilities: {
            workshop: {
              onNavigate: operations.handleNavigate,
              onCreateSession: operations.handleCreateSession,
              audioEngineProvider: operations.getAudioEngine,
              onBlueprintsChanged: operations.refreshVaultBlueprints
            },
            vault: {
              onNavigate: operations.handleNavigate,
              onSelectSequence: operations.handleSequenceSelection,
              onSelectBlueprint: operations.handleCreateSession,
              getAudioEngine: operations.getAudioEngine
            },
            scriptorium: {
              onNavigate: operations.handleNavigate,
              onCreateSession: operations.handleCreateSession,
              getSettings: operations.getSettings,
              onSettingsTransaction: operations.handleSettingsTransaction
            },
            'visual-lab': {
              mode: 'route',
              onUseInReading: operations.useRecipeInReading,
              onEditInWorkshop: () => operations.handleNavigate('workshop'),
              onClose: () => operations.handleNavigate('home')
            },
            'visual-catalog': {
              onNavigate: (...args) => operations.handleNavigate(...args)
            }
          }
        });
        await make.update(data);
        return make;
      }
    },
    {
      id: 'settings',
      containerId: 'view-settings',
      load: () => import('../components/Settings.js'),
      // `/emotions` opens the Affect section (data.pane === 'affect').
      create: async (container, data, { Settings }) => {
        const settings = new Settings(container, {
          settings: operations.getSettings(),
          onNavigate: operations.handleNavigate,
          onChange: operations.handleSettingsChange,
          onDataCleared: operations.handleDataCleared,
          notify: operations.showToast
        });
        await settings.update(data);
        return settings;
      }
    }
  ];
}
