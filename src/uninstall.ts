import { spawn } from "child_process";
import { removeModuleFromLockfile } from "./lockfile";

function runBunInstall(moduleName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("bun", ["uninstall", `${moduleName}`], {
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`bun uninstall exited with code ${code}`));
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

export default async function uninstall(moduleName: string) {
    await runBunInstall(moduleName);
    await removeModuleFromLockfile(moduleName);
    await runMetadataUpdateScript();
}
