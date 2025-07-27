import type { NodePlopAPI } from 'node-plop'

export function toFileName(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace one or more spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove all but alphanumeric characters and hyphens
    .replace(/--+/g, '-') // Combine consecutive hyphens into one
    .replace(/^-+/, '') // Remove leading hyphen
    .replace(/-+$/, '') // remove trailing hyphen
}

export function init(plop: NodePlopAPI): void {
  plop.setHelper('toFileName', toFileName)
}
