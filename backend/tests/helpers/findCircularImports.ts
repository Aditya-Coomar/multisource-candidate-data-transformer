import fs from 'node:fs';
import path from 'node:path';

function collectFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(resolved);
    }

    return resolved.endsWith('.ts') ? [resolved] : [];
  });
}

function resolveImportPath(fromFile: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) {
    return null;
  }

  const resolvedBase = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    `${resolvedBase}.ts`,
    `${resolvedBase}.d.ts`,
    path.join(resolvedBase, 'index.ts'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function buildGraph(rootDirectories: string[]): Map<string, string[]> {
  const files = rootDirectories.flatMap((directory) => collectFiles(directory));
  const graph = new Map<string, string[]>();
  const importPattern =
    /import(?:[\s\S]*?)from\s+['"]([^'"]+)['"]|export(?:[\s\S]*?)from\s+['"]([^'"]+)['"]/g;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const dependencies = new Set<string>();
    let match = importPattern.exec(source);

    while (match) {
      const importPath = match[1] ?? match[2];
      const resolved = resolveImportPath(file, importPath);

      if (resolved) {
        dependencies.add(resolved);
      }

      match = importPattern.exec(source);
    }

    graph.set(file, [...dependencies]);
  }

  return graph;
}

export function findCircularImports(rootDirectories: string[]): string[][] {
  const graph = buildGraph(rootDirectories);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  const visit = (node: string, trail: string[]): void => {
    if (stack.has(node)) {
      const cycleStart = trail.indexOf(node);
      cycles.push(trail.slice(cycleStart).concat(node));
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    stack.add(node);

    for (const dependency of graph.get(node) ?? []) {
      visit(dependency, [...trail, dependency]);
    }

    stack.delete(node);
  };

  for (const node of graph.keys()) {
    visit(node, [node]);
  }

  return cycles;
}
