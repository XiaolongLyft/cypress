import _ from 'lodash'
import path from 'path'

import { getProcessEnvVars, CYPRESS_SPECIAL_ENV_VARS } from '@packages/server/lib/util/config'
import type {
  ResolvedFromConfig,
  ResolvedConfigurationOptionSource,
} from '@packages/types'

import {
  matchesConfigKey,
  getPublicConfigKeys,
} from '../browser'
import { hideKeys } from '../utils'
import { options } from '../options'

const hideSpecialVals = function (val: string, key: string) {
  if (_.includes(CYPRESS_SPECIAL_ENV_VARS, key)) {
    return hideKeys(val)
  }

  return val
}

// an object with a few utility methods for easy stubbing from unit tests
export const utils = {
  getProcessEnvVars,
}

export function parseEnv (cfg: Record<string, any>, envCLI: Record<string, any>, resolved: Record<string, any> = {}) {
  const envVars: any = (resolved.env = {})

  const resolveFrom = (from: string, obj = {}) => {
    return _.each(obj, (val, key) => {
      return envVars[key] = {
        value: val,
        from,
      }
    })
  }

  const envCfg = cfg.env != null ? cfg.env : {}
  const envFile = cfg.envFile != null ? cfg.envFile : {}
  let envProc = utils.getProcessEnvVars(process.env) || {}

  envCLI = envCLI != null ? envCLI : {}

  const configFromEnv = _.reduce(envProc, (memo: string[], val, key) => {
    const cfgKey = matchesConfigKey(key)

    if (cfgKey) {
      // only change the value if it hasn't been
      // set by the CLI. override default + config
      if (resolved[cfgKey] !== 'cli') {
        cfg[cfgKey] = val
        resolved[cfgKey] = {
          value: val,
          from: 'env',
        } as ResolvedFromConfig
      }

      memo.push(key)
    }

    return memo
  }, [])

  envProc = _.chain(envProc)
  .omit(configFromEnv)
  .mapValues(hideSpecialVals)
  .value()

  resolveFrom('config', envCfg)
  resolveFrom('envFile', envFile)
  resolveFrom('env', envProc)
  resolveFrom('cli', envCLI)

  // envCfg is from cypress.config.{js,ts,mjs,cjs}
  // envFile is from cypress.env.json
  // envProc is from process env vars
  // envCLI is from CLI arguments
  return _.extend(envCfg, envFile, envProc, envCLI)
}

// combines the default configuration object with values specified in the
// configuration file like "cypress.{ts|js}". Values in configuration file
// overwrite the defaults.
export function resolveConfigValues (config: Record<string, any>, defaults: Record<string, any>, resolved: any = {}) {
  // pick out only known configuration keys
  return _
  .chain(config)
  .pick(getPublicConfigKeys())
  .mapValues((val, key) => {
    const source = (s: ResolvedConfigurationOptionSource): ResolvedFromConfig => {
      return {
        value: val,
        from: s,
      }
    }

    const r = resolved[key]

    if (r) {
      if (_.isObject(r)) {
        return r
      }

      return source(r)
    }

    if (_.isEqual(config[key], defaults[key]) || key === 'browsers') {
      // "browsers" list is special, since it is dynamic by default
      // and can only be overwritten via plugins file
      return source('default')
    }

    return source('config')
  })
  .value()
}

// Given an object "resolvedObj" and a list of overrides in "obj"
// marks all properties from "obj" inside "resolvedObj" using
// {value: obj.val, from: "plugin"}
export function setPluginResolvedOn (resolvedObj: Record<string, any>, obj: Record<string, any>): any {
  return _.each(obj, (val, key) => {
    if (_.isObject(val) && !_.isArray(val) && resolvedObj[key]) {
      // recurse setting overrides
      // inside of objected
      return setPluginResolvedOn(resolvedObj[key], val)
    }

    const valueFrom: ResolvedFromConfig = {
      value: val,
      from: 'plugin',
    }

    resolvedObj[key] = valueFrom
  })
}

interface Paths {
  projectRoot?: string
  [key: string]: string | false | undefined
}

export function setAbsolutePaths (obj: Paths) {
  obj = _.clone(obj)

  // if we have a projectRoot
  const pr = obj.projectRoot

  if (pr) {
    // reset fileServerFolder to be absolute
    // obj.fileServerFolder = path.resolve(pr, obj.fileServerFolder)

    // and do the same for all the rest
    _.extend(obj, convertRelativeToAbsolutePaths(pr, obj))
  }

  return obj
}

const folders = _(options).filter({ isFolder: true }).map('name').value()

const convertRelativeToAbsolutePaths = (projectRoot: string, obj: Paths) => {
  return _.reduce(folders, (memo: Record<string, string>, folder) => {
    const val = obj[folder]

    if ((val != null) && (val !== false)) {
      memo[folder] = path.resolve(projectRoot, val)
    }

    return memo
  }, {})
}

// instead of the built-in Node process, specify a path to 3rd party Node
export const setNodeBinary = (obj: Record<string, any>, userNodePath?: string, userNodeVersion?: string) => {
  // if execPath isn't found we weren't executed from the CLI and should used the bundled node version.
  if (userNodePath && userNodeVersion && obj.nodeVersion !== 'bundled') {
    obj.resolvedNodePath = userNodePath
    obj.resolvedNodeVersion = userNodeVersion

    return obj
  }

  obj.resolvedNodeVersion = process.versions.node

  return obj
}

export function relativeToProjectRoot (projectRoot: string, file: string) {
  if (!file.startsWith(projectRoot)) {
    return file
  }

  // captures leading slash(es), both forward slash and back slash
  const leadingSlashRe = /^[\/|\\]*(?![\/|\\])/

  return file.replace(projectRoot, '').replace(leadingSlashRe, '')
}

// require.resolve walks the symlinks, which can really change
// the results. For example
//  /tmp/foo is symlink to /private/tmp/foo on Mac
// thus resolving /tmp/foo to find /tmp/foo/index.js
// can return /private/tmp/foo/index.js
// which can really confuse the rest of the code.
// Detect this switch by checking if the resolution of absolute
// paths moved the prefix
//
// Good case: no switcheroo, return false
//   /foo/bar -> /foo/bar/index.js
// Bad case: return true
//   /tmp/foo/bar -> /private/tmp/foo/bar/index.js
export const checkIfResolveChangedRootFolder = (resolved: string, initial: string) => {
  return path.isAbsolute(resolved) &&
  path.isAbsolute(initial) &&
  !resolved.startsWith(initial)
}