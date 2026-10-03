/**
 * The fixed application route table. Room modules stay lazy, while their
 * application-level capabilities are explicit at this composition boundary.
 */

export function createRouteManifest(operations) {
  return [
    {
      id: 'portal',
      containerId: 'view-portal',
      load: () => import('../components/Portal.js'),
      create: (container, data, { Portal }) => new Portal(container, {
        demoMode: data?.demoMode === true,
        onNavigate: operations.handleNavigate,
        onLaunchJevReading: operations.launchJevReading,
        onLaunchJevSample: operations.launchJevSample,
        onAdjustReading: operations.adjustJevReading,
        getAudioEngine: operations.getAudioEngine,
        getCurrentSession: operations.getCurrentSession
      })
    },
    {
      id: 'vault',
      containerId: 'view-vault',
      load: () => import('../components/Vault.js'),
      create: (container, data, { Vault }) => new Vault(container, {
        onNavigate: operations.handleNavigate,
        onSelectSequence: operations.handleSequenceSelection,
        onSelectBlueprint: operations.handleCreateSession,
        getAudioEngine: operations.getAudioEngine,
        initialSection: data?.section
      })
    },
    {
      id: 'chamber',
      containerId: 'view-chamber',
      load: () => import('../components/ChamberOrbital.js'),
      create: (container, textData, { ChamberOrbital }) => {
        const orbital = new ChamberOrbital(container, {
          onBeginSession: operations.handleBeginSession,
          onNavigate: operations.handleNavigate,
          getAudioEngine: operations.getAudioEngine,
          getSettings: operations.getSettings,
          onSettingChange: operations.handleSettingsChange,
          onSettingsTransaction: operations.handleSettingsTransaction,
          notify: operations.showToast
        });
        if (textData?.text) {
          orbital.loadText(textData.text, textData.source || 'Library', textData.config);
        }
        return orbital;
      }
    },
    {
      id: 'chamber-session',
      containerId: 'view-chamber',
      load: () => import('./chamber-session-factory.js'),
      create: (container, sessionData, { createChamberSession }) => createChamberSession(
        operations.chamberSession,
        container,
        sessionData
      )
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
            today: {
              onNavigate: operations.handleNavigate,
              onBegin: operations.handleBeginSession
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
      id: 'workshop',
      containerId: 'view-workshop',
      load: () => import('../components/Workshop.js'),
      create: (container, data, { Workshop }) => {
        const workshop = new Workshop(container, {
          onNavigate: operations.handleNavigate,
          onCreateSession: operations.handleCreateSession,
          audioEngineProvider: operations.getAudioEngine,
          onBlueprintsChanged: operations.refreshVaultBlueprints
        });
        if (data) workshop.update(data);
        return workshop;
      }
    },
    {
      id: 'settings',
      containerId: 'view-settings',
      load: () => import('../components/Settings.js'),
      create: (container, _data, { Settings }) => new Settings(container, {
        settings: operations.getSettings(),
        onNavigate: operations.handleNavigate,
        onChange: operations.handleSettingsChange,
        onDataCleared: operations.handleDataCleared,
        notify: operations.showToast
      })
    },
    {
      id: 'scriptorium',
      containerId: 'view-scriptorium',
      load: () => import('../components/Scriptorium.js'),
      create: (container, data, { Scriptorium }) => {
        const room = new Scriptorium(container, {
          onNavigate: operations.handleNavigate,
          onCreateSession: operations.handleCreateSession,
          getSettings: operations.getSettings,
          onSettingsTransaction: operations.handleSettingsTransaction
        });
        room.mount();
        return room;
      }
    },
    {
      id: 'emotions',
      containerId: 'view-emotions',
      load: () => import('../components/Emotions.js'),
      create: (container, _data, { Emotions }) => new Emotions(container, {
        onNavigate: operations.handleNavigate
      })
    },
    {
      id: 'visual-lab',
      containerId: 'view-visual-lab',
      load: () => import('../components/VisualLab.js'),
      create: (container, data, { VisualLab }) => new VisualLab(container, {
        mode: 'route',
        recipe: data?.recipe || null,
        onUseInReading: operations.useRecipeInReading,
        onEditInWorkshop: () => operations.handleNavigate('workshop'),
        onClose: () => operations.handleNavigate('portal')
      })
    },
    {
      id: 'visual-catalog',
      containerId: 'view-visual-catalog',
      load: () => import('../components/VisualCatalog.js'),
      create: (container, data, { VisualCatalog }) => new VisualCatalog(container, {
        search: data?.search ?? globalThis.location?.search ?? '',
        onNavigate: (...args) => operations.handleNavigate(...args)
      })
    },
    {
      // The host for a live Current: a prompt, and the controls over the Chamber.
      // Loaded whole on demand, so first load does not carry it.
      id: 'live',
      containerId: 'view-live',
      load: () => import('../live/host/LiveHost.js'),
      create: (container, _data, { LiveHost }) => new LiveHost(container, {
        router: operations.router,
        onNavigate: (...args) => operations.handleNavigate(...args)
      })
    }
  ];
}
