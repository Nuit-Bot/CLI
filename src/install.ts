import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config, cwd } from "node:process";
import toml from "toml";

async function getRegistries(path = cwd()) {
    let privateConfigFile;
    let configFile;
    let exampleConfigFile;

    try {
        privateConfigFile = await readFile(join(path, "config.private.toml"), {
            encoding: "utf-8",
        });
    } catch {}

    try {
        configFile = await readFile(join(path, "config.toml"), {
            encoding: "utf-8",
        });
    } catch {}

    try {
        exampleConfigFile = await readFile(join(path, "config.example.toml"), {
            encoding: "utf-8",
        });
    } catch {}

    const registries: { raw: string }[] = [];

    if (privateConfigFile) {
        const registriesList: Array<{ raw: string }> =
            toml.parse(privateConfigFile).registries;
        registriesList.forEach((reg) => registries.push(reg));
    }

    if (configFile) {
        const registriesList: Array<{ raw: string }> =
            toml.parse(configFile).registries;
        registriesList.forEach((reg) => registries.push(reg));
    }

    if (exampleConfigFile) {
        const registriesList: Array<{ raw: string }> =
            toml.parse(exampleConfigFile).registries;
        registriesList.forEach((reg) => registries.push(reg));
    }

    return registries;
}

export default async function install(moduleName: string) {
    const registries = await getRegistries();

    registries.forEach(async (reg) => {
        try {
            const res = await fetch(reg.raw);

            if (!res.ok) return;

            const regData:
                | Array<{ id: string; commit: string; version: string }>
                | undefined
                | unknown = await res.json();

            if (!regData) return;

            if (Array.isArray(regData)) {
                (regData as Array<{ id: string; commit: string; version: string }>).forEach(() => {});
            }
        } catch {}
    });

    try {
        await exec(`bun install ${moduleName}`);
    } catch (e) {
        throw new Error(`Failed to install package: ${e}`);
    }
}
