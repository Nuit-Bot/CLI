import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";

const LOCKFILE_NAME = "nuit.lock";

interface LockfileModule {
    version: string;
    commit: string;
}

interface LockfileData {
    modules: Record<string, LockfileModule>;
}

function getLockfilePath(): string {
    return join(cwd(), LOCKFILE_NAME);
}

export async function readLockfile(): Promise<LockfileData> {
    try {
        const content = await readFile(getLockfilePath(), { encoding: "utf-8" });
        return JSON.parse(content) as LockfileData;
    } catch {
        return { modules: {} };
    }
}

export async function writeLockfile(data: LockfileData): Promise<void> {
    await writeFile(getLockfilePath(), JSON.stringify(data, null, 2), {
        encoding: "utf-8",
    });
}

export async function addModuleToLockfile(
    name: string,
    version: string,
    commit: string,
): Promise<void> {
    const data = await readLockfile();
    data.modules[name] = { version, commit };
    await writeLockfile(data);
}

export async function removeModuleFromLockfile(name: string): Promise<void> {
    const data = await readLockfile();
    delete data.modules[name];
    await writeLockfile(data);
}
