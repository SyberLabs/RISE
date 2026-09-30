/**
 * The fixed application route table. Room modules stay lazy, while their
 * application-level capabilities are explicit at this composition boundary.
 */

export function createRouteManifest(operations) {
  return [
    {
      id: 'create',
      containerId: 'view-create',
      load: () => import('../components/Create.js'),
      create: (container, data, { Create }) => new Create(container, {
        data,
        onNavigate: operations.handleNavigate,
        onCreateSession: operations.handleCreateSession
      })
    },
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
      id: 'keystones',
      containerId: 'view-keystones',
      load: () => import('../components/Keystones.js'),
      create: (container, data, { Keystones }) => new Keystones(container, {
        initialSlug: data?.slug || null,
        onNavigate: operations.handleNavigate,
        onLaunch: operations.launchKeystone
      })
    },
    {
      id: 'mint',
      containerId: 'view-mint',
      load: () => import('../components/Mint.js'),
      create: (container, data, { Mint }) => new Mint(container, {
        entry: data?.entry || null,
        onNavigate: operations.handleNavigate,
        onOpen: operations.openMintedProgram
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
        onLaunchArchetype: operations.handleArchetypeLaunch,
        getAudioEngine: operations.getAudioEngine,
        personalizedVault: data?.personalizedVault || null,
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
      create: (container, data, { Library }) => new Library(container, {
        onNavigate: operations.handleNavigate,
        onSelectText: operations.handleTextSelection,
        getAudioEngine: operations.getAudioEngine
      })
    },
    {
      id: 'journeys',
      containerId: 'view-journeys',
      load: () => import('../components/Journeys.js'),
      create: (container, _data, { Journeys }) => new Journeys(container, {
        onNavigate: operations.handleNavigate,
        onBeginSession: operations.handleBeginSession,
        getAudioEngine: operations.getAudioEngine
      })
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
      id: 'rosarium',
      containerId: 'view-rosarium',
      load: () => import('../components/Rosarium.js'),
      create: (container, data, { Rosarium }) => new Rosarium(container, {
        onNavigate: operations.handleNavigate,
        getAudioEngine: operations.getAudioEngine,
        setId: data?.setId,
        iconId: data?.iconId,
        door: data?.door === true
      })
    },
    {
      id: 'curia',
      containerId: 'view-curia',
      load: () => import('../components/Curia.js'),
      create: (container, _data, { Curia }) => new Curia(container, {
        onNavigate: operations.handleNavigate
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
      id: 'via',
      containerId: 'view-via',
      load: () => import('../components/Via.js'),
      create: (container, _data, { Via }) => new Via(container, {
        onNavigate: operations.handleNavigate,
        getAudioEngine: operations.getAudioEngine
      })
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
      // The host for a live Current: a prompt, and the controls over the Chamber.
      // Loaded whole on demand, so first load does not carry it.
      id: 'live',
      containerId: 'view-live',
      load: () => import('../live/host/LiveHost.js'),
      create: (container, _data, { LiveHost }) => new LiveHost(container, {
        router: operations.router
      })
    },
    {
      id: 'chapel',
      containerId: 'view-chapel',
      load: () => import('../components/Chapel.js'),
      create: (container, data, { Chapel }) => new Chapel(container, {
        onNavigate: operations.handleNavigate,
        getAudioEngine: operations.getAudioEngine,
        bookId: data?.bookId,
        chapter: data?.chapter,
        onLaunchRosary: operations.launchRosary,
        onLaunchReading: operations.launchChapelReading
      })
    }
  ];
}
