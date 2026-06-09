import { type RegistryModule } from "./install";
import { getRegistries } from "./install";
import { fetchRegistry } from "./install";
import { readLockfile } from "./lockfile";
import chalk from "chalk";

const NPM_REGISTRY = "https://registry.npmjs.org";

interface NpmPackageInfo {
    "dist-tags": {
        latest: string;
    };
}

export default async function info(name: string) {
    const registries = await getRegistries();
    const moduleResults = await Promise.all(
        registries.map((reg) => fetchRegistry(reg.raw)),
    );

    const registryModules: RegistryModule[] = moduleResults
        .filter((r): r is RegistryModule[] => r !== null)
        .flat();

    const exact = registryModules.find(
        (m) => m.package.toLowerCase() === name.toLowerCase(),
    );

    if (exact) {
        const lockfile = await readLockfile();
        const isInstalled = name.toLowerCase() in lockfile.modules;
        const installedVersion = isInstalled
            ? lockfile.modules[name.toLowerCase()]?.version ?? null
            : null;

        let latestVersion: string | null = null;
        try {
            const res = await fetch(`${NPM_REGISTRY}/${exact.package}`);
            if (res.ok) {
                const pkgInfo = (await res.json()) as NpmPackageInfo;
                latestVersion = pkgInfo["dist-tags"].latest;
            }
        } catch {
            // Ignore errors when fetching latest version
        }

        const displayVersion = installedVersion ?? exact.version;
        const hasUpdate =
            latestVersion &&
            installedVersion &&
            latestVersion !== installedVersion;

        let versionStr = `v${displayVersion}`;
        if (hasUpdate) {
            versionStr += ` ${chalk.yellow(`(update to: v${latestVersion})`)}`;
        }

        console.log(
            `${chalk.green(exact.package)} ${chalk.gray(`${versionStr} by ${exact.author}`)}`,
        );
        console.log(`${chalk.white(exact.description)}`);
        console.log(
            `${chalk.gray("Tags: ")}${chalk.green(exact.tags.join(", "))}`,
        );
        console.log(
            `${chalk.gray("Installed?: ")}${isInstalled ? chalk.green("Yes") : chalk.red("No")}`,
        );
        return;
    } else {
        console.log(chalk.yellow("No modules found."));
        return;
    }
}
