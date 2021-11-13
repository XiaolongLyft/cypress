import { DataContext } from '@packages/data-context'
import os from 'os'
import { app } from 'electron'

import specsUtil from './util/specs'
import type { FindSpecs, FoundBrowser, LaunchArgs, LaunchOpts, OpenProjectLaunchOptions, PlatformName, Preferences, SettingsOptions } from '@packages/types'
import browserUtils from './browsers/utils'
import auth from './gui/auth'
import user from './user'
import * as config from './config'
import { EventEmitter } from 'events'
import { openProject } from './open_project'
import cache from './cache'
import errors from './errors'
import { graphqlSchema } from '@packages/graphql/src/schema'
import { openExternal } from '@packages/server/lib/gui/links'
import app_data from './util/app_data'

const { getBrowsers, ensureAndGetByNameOrPath } = browserUtils

interface MakeDataContextOptions {
  mode: 'run' | 'open'
  os: PlatformName
  rootBus: EventEmitter
  launchArgs: LaunchArgs
}

let legacyDataContext: DataContext | undefined

// For testing
export function clearLegacyDataContext () {
  legacyDataContext = undefined
}

export function makeLegacyDataContext (launchArgs: LaunchArgs = {} as LaunchArgs, mode: 'open' | 'run' = 'run'): DataContext {
  if (legacyDataContext && process.env.LAUNCHPAD) {
    throw new Error(`Expected ctx to be passed as an arg, but used legacy data context`)
  } else if (!legacyDataContext) {
    legacyDataContext = makeDataContext({
      mode,
      rootBus: new EventEmitter,
      launchArgs,
      os: os.platform() as PlatformName,
    })
  }

  return legacyDataContext
}

export function getLegacyDataContext () {
  if (!legacyDataContext) {
    throw new Error(`legacyDataContext`)
  }

  return legacyDataContext
}

export function makeDataContext (options: MakeDataContextOptions) {
  return new DataContext({
    schema: graphqlSchema,
    ...options,
    launchOptions: {},
    electronApp: app,
    appApi: {
      getBrowsers,
      ensureAndGetByNameOrPath (nameOrPath: string, browsers: FoundBrowser[]) {
        return ensureAndGetByNameOrPath(nameOrPath, false, browsers)
      },
    },
    appDataApi: app_data,
    authApi: {
      getUser () {
        return user.get()
      },
      logIn (onMessage) {
        return auth.start(onMessage, 'launchpad')
      },
      logOut () {
        return user.logOut()
      },
    },
    projectApi: {
      getConfig (projectRoot: string, options?: SettingsOptions) {
        return config.get(projectRoot, options)
      },
      launchProject (browser: FoundBrowser, spec: Cypress.Spec, options?: LaunchOpts) {
        return openProject.launch({ ...browser }, spec, options)
      },
      initializeProject (args: LaunchArgs, options: OpenProjectLaunchOptions, browsers: FoundBrowser[]) {
        return openProject.create(args.projectRoot, args, options, browsers).then((p) => p.browsers as FoundBrowser[])
      },
      insertProjectToCache (projectRoot: string) {
        cache.insertProject(projectRoot)
      },
      getProjectRootsFromCache () {
        return cache.getProjectRoots()
      },
      findSpecs (payload: FindSpecs) {
        return specsUtil.findSpecs(payload)
      },
      clearLatestProjectsCache () {
        return cache.removeLatestProjects()
      },
      getProjectPreferencesFromCache () {
        return cache.getProjectPreferences()
      },
      clearProjectPreferences (projectTitle: string) {
        return cache.removeProjectPreferences(projectTitle)
      },
      clearAllProjectPreferences () {
        return cache.removeAllProjectPreferences()
      },
      insertProjectPreferencesToCache (projectTitle: string, preferences: Preferences) {
        cache.insertProjectPreferences(projectTitle, preferences)
      },
      removeProjectFromCache (path: string) {
        return cache.removeProject(path)
      },
      closeActiveProject () {
        return openProject.closeActiveProject()
      },
      error (type: string, ...args: any) {
        throw errors.throw(type, ...args)
      },
    },
    electronApi: {
      openExternal,
    },
  })
}
