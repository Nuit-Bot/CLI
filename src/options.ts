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
import install from "./install";
import uninstall from "./uninstall";
import { readLockfile } from "./lockfile";

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

export default commander;
