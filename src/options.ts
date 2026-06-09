import { program as commander } from "commander";
import { readFileSync } from "node:fs";
import { isNuitDirectory } from "./isNuitDirectory";
import { parse } from "toml";
import { which } from "bun";
import {
    intro,
    text,
    outro,
    password,
    note,
    cancel,
    log,
    confirm,
} from "@clack/prompts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hatch } from "./hatch";
import path from "node:path";
import { stat } from "node:fs/promises";
import { rm } from "node:fs/promises";
import install, {
    getRegistries,
    fetchRegistry,
    type RegistryModule,
} from "./install";
import uninstall from "./uninstall";
import { readLockfile } from "./lockfile";
import search from "./search";
import info from "./info";

const execFileAsync = promisify(execFile);

commander.name("nuit").description("Nuit bot CLI");

commander
    .command("version")
    .description("Display version info")
    .action(() => {
        const inProject = isNuitDirectory(process.cwd());
        console.log(`CLI: 1.0.0`);
        if (inProject) {
            const toml = parse(
                readFileSync(`${process.cwd()}/nuit.toml`, "utf-8"),
            );
            console.log(`Instance: ${toml.nuit.name}`);
        }
    });

commander
    .command("init")
    .description("Creates a new Nuit bot")
    .argument("[name]", "the folder to put the bot in", undefined)
    .option("-r, --repo <url.git>", "change the Nuit bot repo")
    .action(async (name, options) => {
        if (!which("git")) {
            console.error(
                "Git is not installed, install it @ https://git-scm.com",
            );
            return;
        }

        const repoURL = options.repo ?? "https://github.com/Nuit-Bot/Nuit.git";

        intro("nuit init");

        if (!name) {
            name = await text({
                message: "Enter a name for your bot",
                placeholder: "my-nuit-bot",
                initialValue: "my-nuit-bot",
                validate(value) {
                    if (value?.length === 0) return "Value is required";
                    if (
                        !/^[^\\/:\*\?"<>\|]([^\\/:\*\?"<>\|]*[^\\/:\*\?"<>\|. ])?$/.test(
                            value as string,
                        )
                    ) {
                        return "Value contains invalid folder characters.";
                    }
                },
            });
        }

        if (!name) return;

        try {
            try {
                await stat(path.join(process.cwd(), name));

                const overwriteFolder = await confirm({
                    message: `A folder with the name ${name} already exists. Overwrite?`,
                });

                if (overwriteFolder) {
                    await rm(path.join(process.cwd(), name), {
                        force: true,
                        recursive: true,
                    });
                }
            } catch {}

            await execFileAsync("git", ["clone", repoURL, name]);
        } catch {
            return console.error(
                "Something wrong happenned during Git cloning",
            );
        }

        await hatch(true, path.join(process.cwd(), name));
    });

commander
    .command("hatch")
    .argument("[folder]", "the Nuit instance folder")
    .action(async (folder = process.cwd()) => {
        if (!isNuitDirectory(folder)) {
            return console.error("This is not a Nuit instance!");
        }

        await hatch(false, folder);
    });

commander
    .command("install")
    .argument("<module>", "The module to install")
    .action(async (moduleName) => {
        if (!isNuitDirectory(process.cwd())) {
            return console.error("This is not a Nuit instance!");
        }

        await install(moduleName);
    });

commander
    .command("uninstall")
    .argument("<module>", "The module to uninstall")
    .action(async (moduleName) => {
        if (!isNuitDirectory(process.cwd())) {
            return console.error("This is not a Nuit instance!");
        }

        await uninstall(moduleName);
    });

commander
    .command("list")
    .alias("ls")
    .description("List installed modules")
    .action(async () => {
        if (!isNuitDirectory(process.cwd())) {
            return console.error("This is not a Nuit instance!");
        }

        const lockfile = await readLockfile();
        const entries = Object.entries(lockfile.modules);

        if (entries.length === 0) {
            return console.log("No modules installed.");
        }

        for (const [name, info] of entries) {
            console.log(`${name}@${info.version} (${info.commit})`);
        }
    });

commander
    .command("info")
    .description("Show details about an installed module")
    .argument("<module>", "The module to inspect")
    .action(async (moduleName) => {
        await info(moduleName);
    });

commander
    .command("update")
    .description("Reinstall one or all modules")
    .argument("[module]", "The module to update (all if omitted)")
    .action(async (moduleName) => {
        if (!isNuitDirectory(process.cwd())) {
            return console.error("This is not a Nuit instance!");
        }

        if (moduleName) {
            await install(moduleName);
            return;
        }

        const lockfile = await readLockfile();
        const names = Object.keys(lockfile.modules);

        if (names.length === 0) {
            return console.log("No modules to update.");
        }

        for (const name of names) {
            console.log(`Updating ${name}...`);
            await install(name);
        }
    });

commander
    .command("outdated")
    .description("Check for outdated modules")
    .action(async () => {
        if (!isNuitDirectory(process.cwd())) {
            return console.error("This is not a Nuit instance!");
        }

        const lockfile = await readLockfile();
        const installed = lockfile.modules;
        const names = Object.keys(installed);

        if (names.length === 0) {
            return console.log("No modules installed.");
        }

        const registries = await getRegistries();
        const moduleResults = await Promise.all(
            registries.map((reg) => fetchRegistry(reg.raw)),
        );

        const registryModules: RegistryModule[] = moduleResults
            .filter((r): r is RegistryModule[] => r !== null)
            .flat();

        let hasOutdated = false;

        for (const name of names) {
            const current = installed[name];
            if (!current) continue;

            const latest = registryModules.find((m) => m.package === name);

            if (!latest) {
                console.log(
                    `${name}@${current.version} — not found in registry`,
                );
                hasOutdated = true;
            } else if (latest.version !== current.version) {
                console.log(`${name} ${current.version} → ${latest.version}`);
                hasOutdated = true;
            }
        }

        if (!hasOutdated) {
            console.log("All modules up to date.");
        }
    });

commander
    .command("search")
    .description("Search for a module in the registry")
    .argument("name", "The name of the module to search for")
    .action(async (name) => {
        if (!isNuitDirectory(process.cwd())) {
            return console.error("This is not a Nuit instance!");
        }

        await search(name);
    });

export default commander;
