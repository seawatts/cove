import { execSync } from 'node:child_process';
import TOML from '@iarna/toml';
import type { PlopTypes } from '@turbo/gen';

interface PackageJson {
  name: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

// Define the interface for Cargo.toml structure
interface CargoToml {
  package: {
    name: string;
    version: string;
    edition: string;
    description: string;
  };
  dependencies: Record<string, { path?: string; workspace?: boolean }>;
  [key: string]: unknown;
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator('crate', {
    description: 'Generate a new Rust crate for the Cove project',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the crate?',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter a description for the crate',
      },
      {
        type: 'list',
        name: 'crateType',
        message: 'What type of crate is this?',
        choices: ['lib', 'bin'],
      },
      {
        type: 'input',
        name: 'deps',
        message:
          'Enter a space separated list of workspace dependencies you would like to use (e.g. logging errors)',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'crates/{{ name }}/Cargo.toml',
        templateFile: 'templates/crate/cargo.toml.hbs',
      },
      {
        type: 'add',
        path: 'crates/{{ name }}/src/{{ crateType }}.rs',
        templateFile: 'templates/crate/{{ crateType }}.rs.hbs',
      },
      {
        type: 'add',
        path: 'crates/{{ name }}/package.json',
        templateFile: 'templates/crate/package.json.hbs',
      },
      {
        type: 'modify',
        path: 'crates/{{ name }}/Cargo.toml',
        transform(content, answers) {
          try {
            // Parse the TOML content
            const parsedToml = TOML.parse(content);
            const toml = parsedToml as unknown as CargoToml;

            if ('deps' in answers && typeof answers.deps === 'string') {
              const deps = answers.deps.split(' ').filter(Boolean);

              // Initialize dependencies if not exists
              toml.dependencies = toml.dependencies || {};

              // Add workspace dependencies first
              toml.dependencies.tracing = { workspace: true };
              toml.dependencies.miette = { workspace: true };
              toml.dependencies.tokio = { workspace: true };

              // Add workspace dependencies with proper formatting
              for (const dep of deps) {
                toml.dependencies[dep] = { path: `../${dep}` };
              }

              // Use TOML.stringify with proper formatting
              const output = TOML.stringify(toml as TOML.JsonMap)
                // Add a newline before workspace dependencies
                .replace(
                  /^(\[dependencies\]\n(?:.*\n)*?)((?:[\w-]+ = \{ path = "\.\.\/.*" \}\n)+)/m,
                  '$1\n# Workspace\n$2',
                );

              return output;
            }

            return content;
          } catch (error) {
            console.error('Error processing TOML:', error);
            return content;
          }
        },
      },
      async (answers) => {
        if ('name' in answers && typeof answers.name === 'string') {
          execSync('cargo fmt', { stdio: 'inherit' });
          return 'Crate scaffolded';
        }
        return 'Crate not scaffolded';
      },
    ],
  });

  plop.setGenerator('package', {
    description: 'Generate a new package for the Acme Monorepo',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message:
          'What is the name of the package? (You can skip the `@acme/` prefix)',
      },
      {
        type: 'input',
        name: 'deps',
        message:
          'Enter a space separated list of dependencies you would like to install',
      },
    ],
    actions: [
      (answers) => {
        if (
          'name' in answers &&
          typeof answers.name === 'string' &&
          answers.name.startsWith('@acme/')
        ) {
          answers.name = answers.name.replace('@acme/', '');
        }
        return 'Config sanitized';
      },
      {
        type: 'add',
        path: 'packages/{{ name }}/package.json',
        templateFile: 'templates/package/package.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{ name }}/tsconfig.json',
        templateFile: 'templates/package/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{ name }}/src/index.ts',
        template: "export const name = '{{ name }}';",
      },
      {
        type: 'modify',
        path: 'packages/{{ name }}/package.json',
        async transform(content, answers) {
          if ('deps' in answers && typeof answers.deps === 'string') {
            const pkg = JSON.parse(content) as PackageJson;
            for (const dep of answers.deps.split(' ').filter(Boolean)) {
              const version = await fetch(
                `https://registry.npmjs.org/-/package/${dep}/dist-tags`,
              )
                .then((res) => res.json())
                .then((json) => json.latest);
              if (!pkg.dependencies) pkg.dependencies = {};
              pkg.dependencies[dep] = `^${version}`;
            }
            return JSON.stringify(pkg, null, 2);
          }
          return content;
        },
      },
      async (answers) => {
        /**
         * Install deps and format everything
         */
        if ('name' in answers && typeof answers.name === 'string') {
          // execSync("pnpm dlx sherif@latest --fix", {
          //   stdio: "inherit",
          // });
          execSync('pnpm i', { stdio: 'inherit' });
          execSync(`pnpm format:fix packages/${answers.name}/**`);
          return 'Package scaffolded';
        }
        return 'Package not scaffolded';
      },
    ],
  });
}
