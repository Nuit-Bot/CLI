import Fuse from "fuse.js";
import { type RegistryModule } from "./install";
import { getRegistries } from "./install";
import { fetchRegistry } from "./install";
import chalk from "chalk";

export default async function search(name: string) {
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
        console.log(`${chalk.green("Exact match!")}`);
        console.log(
            `${chalk.green(exact.package)} ${chalk.gray(`v${exact.version} by ${exact.author}`)}`,
        );
        console.log(`${chalk.white(exact.description)}`);
        console.log(
            `${chalk.gray("Tags: ")}${chalk.green(exact.tags.join(", "))}`,
        );
        console.log();
        return;
    }

    const fuse = new Fuse(registryModules, {
        threshold: 0.4,
        keys: [
            {
                name: "package",
                weight: 5,
            },
            { name: "tags", weight: 3 },
            { name: "description", weight: 1 },
        ],
    });

    const results = fuse.search(name).slice(0, 20);

    if (results.length === 0) {
        console.log(chalk.yellow("No modules found."));
        return;
    }

    results.forEach((m) => {
        console.log(
            `${chalk.green(m.item.package)} ${chalk.gray(`v${m.item.version} by ${m.item.author}`)}`,
        );
        console.log(`${chalk.white(m.item.description)}`);
        console.log(
            `${chalk.gray("Tags: ")}${chalk.green(m.item.tags.join(", "))}`,
        );
        console.log();
    });
}
