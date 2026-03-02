#!/usr/bin/env node
// Ensures demo/node_modules/orb-ui is always a symlink to the repo root.
// Runs automatically after `yarn install` via the postinstall script.
// This prevents yarn from replacing the symlink with a frozen directory copy.

const { existsSync, lstatSync, rmSync, symlinkSync } = require('fs')
const { join } = require('path')

const link   = join(__dirname, '..', 'node_modules', 'orb-ui')
const target = join(__dirname, '..', '..')

const isSymlink = existsSync(link) && lstatSync(link).isSymbolicLink()
if (!isSymlink) {
  try { rmSync(link, { recursive: true, force: true }) } catch (_) {}
  symlinkSync(target, link)
  console.log('✓ orb-ui symlink restored →', target)
} else {
  console.log('✓ orb-ui symlink OK')
}
