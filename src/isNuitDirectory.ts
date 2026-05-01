import { existsSync } from "node:fs";
import { join } from "node:path";

export function isNuitDirectory(directory: string) {
    return existsSync(join(directory, "nuit.toml"));
}
