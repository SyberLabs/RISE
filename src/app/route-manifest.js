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
      create: (container, _data, { Portal }) => new Portal(container, {
        onNavigate: operations.handleNavigate,
        onQuickAccess: operations.quickAccess,
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
      id: 'vault',
      containerId: 'view-vault',
      load: () => import('../components/Vault.js'),
      create: (container, data, { Vault }) => new Vault(container, {
        onNavigate: operations.handleNavigate,
        onSelectSequence: operations.handleSequenceSelection,
        onSelectBlueprint: operations.handleCreateSession,
        onLaunchArchetype: operations.handleArchetypeLaunch,
        getAudioEngine: operations.getAudioEngine,
        personalizedVault: data?.personalizedVault || null
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
      create: (container, _data, { Library }) => new Library(container, {
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
      create: (container, _data, { Scriptorium }) => {
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
