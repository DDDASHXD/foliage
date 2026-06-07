import fs from 'node:fs/promises'
import path from 'node:path'

import { defaultSettings } from './settings.mjs'

const frontmatterContent = `---
title: My Project
subtitle: A new foliage project
author: You
---

`

const chapterContent = `### Hello foliage!

Welcome to foliage.
`

export const createProjectScaffold = async (projectRoot) => {
  const resolvedRoot = path.resolve(projectRoot)

  await fs.mkdir(path.join(resolvedRoot, 'project'), { recursive: true })
  await fs.mkdir(path.join(resolvedRoot, 'other'), { recursive: true })
  await fs.mkdir(path.join(resolvedRoot, '.foliage'), { recursive: true })

  await fs.writeFile(path.join(resolvedRoot, 'project', '_frontmatter.md'), frontmatterContent, 'utf8')
  await fs.writeFile(path.join(resolvedRoot, 'project', 'chapter-1.md'), chapterContent, 'utf8')
  await fs.writeFile(
    path.join(resolvedRoot, '.foliage', 'settings.json'),
    `${JSON.stringify(defaultSettings, null, 2)}\n`,
    'utf8',
  )

  return {
    path: resolvedRoot,
    name: path.basename(resolvedRoot),
  }
}
