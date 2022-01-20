import type { AuthenticatedUserShape } from '@packages/data-context/src/data'
import type {
  CurrentProject,
  Browser,
  WizardBundler,
  WizardFrontendFramework,
  GlobalProject,
  VersionData,
  LocalSettings,
} from '../generated/test-graphql-types.gen'
import { resetTestNodeIdx } from './clientTestUtils'
import { stubBrowsers } from './stubgql-Browser'
import * as cloudTypes from './stubgql-CloudTypes'
import { createTestCurrentProject, createTestGlobalProject, stubGlobalProject } from './stubgql-Project'
import { allBundlers } from './stubgql-Wizard'

export interface ClientTestContext {
  currentProject: CurrentProject | null
  projects: GlobalProject[]
  app: {
    currentBrowser: Browser | null
    browsers: Browser[] | null
  }
  versions: VersionData
  isAuthBrowserOpened: boolean
  localSettings: LocalSettings
  wizard: {
    chosenBundler: WizardBundler | null
    chosenFramework: WizardFrontendFramework | null
    chosenManualInstall: boolean
    allBundlers: WizardBundler[]
    chosenBrowser: null
    warnings: []
  }
  migration: {
    manualFiles: string[]
  }
  user: AuthenticatedUserShape | null
  cloudTypes: typeof cloudTypes
  __mockPartial: any
}

/**
 * We create a new "context" per test, which we can use as a mutable state object
 * to manipulate resolvers
 */
export function makeClientTestContext (): ClientTestContext {
  resetTestNodeIdx()

  const testProject = createTestCurrentProject('test-project')

  return {
    currentProject: testProject,
    projects: [stubGlobalProject, createTestGlobalProject('another-test-project')],
    app: {
      browsers: stubBrowsers,
      currentBrowser: stubBrowsers[0],
    },
    versions: {
      __typename: 'VersionData',
      current: {
        __typename: 'Version',
        id: '8.7.0',
        version: '8.7.0',
        released: '2021-10-25T21:38:59.983Z',
      },
      latest: {
        __typename: 'Version',
        id: '8.6.0',
        version: '8.6.0',
        released: '2021-10-11T19:40:49.036Z',
      },
    },
    isAuthBrowserOpened: false,
    wizard: {
      chosenBundler: null,
      chosenFramework: null,
      chosenManualInstall: false,
      allBundlers,
      chosenBrowser: null,
      warnings: [],
    },
    user: null,
    cloudTypes,
    localSettings: {
      __typename: 'LocalSettings',
      preferences: {
        __typename: 'LocalSettingsPreferences',
        autoScrollingEnabled: true,
      },
      availableEditors: [
        {
          __typename: 'Editor',
          id: 'code',
          name: 'VS Code',
          binary: 'code',
        },
        {
          __typename: 'Editor',
          id: 'vim',
          name: 'Vim',
          binary: 'vim',
        },
      ],
    },
    migration: {
      manualFiles: [],
    },
    __mockPartial: {},
  }
}