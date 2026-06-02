import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import toml from "toml";
import { addModuleToLockfile } from "./lockfile";

const NPM_REGISTRY = "https://registry.npmjs.org";

export interface RegistryModule {
    name: string;
    commit: string;
    version: string;
    author: string;
}

interface NpmPackageVersion {
    gitHead: string;
}

interface NpmPackageInfo {
    versions: Record<string, NpmPackageVersion>;
}

interface TomlConfig {
    registries?: Array<{ raw: string }>;
}

async function parseConfigFile(
    path: string,
): Promise<Array<{ raw: string }> | null> {
    try {
        const content = await readFile(path, { encoding: "utf-8" });
        const parsed: TomlConfig = toml.parse(content);
        return parsed.registries ?? null;
    } catch {
        return null;
    }
}

export async function getRegistries(basePath = cwd()) {
    const configFiles = [
        "config.private.toml",
        "config.toml",
        "config.example.toml",
    ];

    const results = await Promise.all(
        configFiles.map((file) => parseConfigFile(join(basePath, file))),
    );

    return results
        .filter((r): r is Array<{ raw: string }> => r !== null)
        .flat();
}

export async function fetchRegistry(url: string): Promise<RegistryModule[] | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Fetching ${url} failed: ${res.status}`);
            return null;
        }

        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
            console.error(`Invalid registry data from ${url}: expected array`);
            return null;
        }

        return data.filter(
            (item): item is RegistryModule =>
                typeof item === "object" &&
                item !== null &&
                "name" in item &&
                "commit" in item &&
                "version" in item &&
                typeof (item as RegistryModule).name === "string" &&
                typeof (item as RegistryModule).commit === "string" &&
                typeof (item as RegistryModule).version === "string",
        );
    } catch (error) {
        console.error(`Failed to fetch registry ${url}:`, error);
        return null;
    }
}

function runBunInstall(moduleName: string, version: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("bun", ["install", `${moduleName}@${version}`], {
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`bun install exited with code ${code}`));
            }
        });
    });
}

function runMetadataUpdateScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "bun",
            ["run", `scripts/generate-page-manifest.ts`],
            {
                stdio: "inherit",
            },
        );

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`bun run exited with code ${code}`));
            }
        });
    });
}

export default async function install(moduleName: string) {
    const registries = await getRegistries();

    const moduleResults = await Promise.all(
        registries.map((reg) => fetchRegistry(reg.raw)),
    );

    const modules: RegistryModule[] = moduleResults
        .filter((r): r is RegistryModule[] => r !== null)
        .flat();

    const targetModule = modules.find((m) => m.name === moduleName);
    if (!targetModule) {
        throw new Error(`Module not found: ${moduleName}`);
    }

    const res = await fetch(`${NPM_REGISTRY}/${moduleName}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch package info from npm: ${res.status}`);
    }

    const pkgInfo = (await res.json()) as NpmPackageInfo;
    const moduleVersion = pkgInfo.versions[targetModule.version];
    if (!moduleVersion) {
        throw new Error(
            `Version ${targetModule.version} not found for ${moduleName}`,
        );
    }

    const shasum = moduleVersion.gitHead;
    if (!shasum) {
        throw new Error(
            `No shasum found for ${moduleName}@${targetModule.version}`,
        );
    }

    if (shasum !== targetModule.commit) {
        throw new Error(
            `SHASUM mismatch for ${moduleName}: expected ${targetModule.commit}, got ${shasum}`,
        );
    }

    await runBunInstall(moduleName, targetModule.version);

    await addModuleToLockfile(
        moduleName,
        targetModule.version,
        targetModule.commit,
    );

    await runMetadataUpdateScript();
}
