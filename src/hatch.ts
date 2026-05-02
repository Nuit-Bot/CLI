import { password, cancel, note, intro, outro, text } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { cleanMultiline } from "./cleanMultiline";
import crypto from "node:crypto";

export async function hatch(
    fromInit: boolean = false,
    folder: string = process.cwd(),
) {
    if (!fromInit) {
        await intro("nuit hatch");
    }

    const discordToken = await password({
        message: "Nuit instance's Discord token",
        mask: "•",
        clearOnError: true,
        validate: (value: string | undefined) => {
            if (!value) return "Enter a token";
            if (!/[\w-]{24,26}\.[\w-]{6}\.[\w-]{27,38}/.test(value)) {
                return "This is not a valid token.";
            }
            return;
        },
    });

    let discordClientId;

    try {
        const req = await fetch("https://discord.com/api/v10/users/@me", {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${String(discordToken)}`,
            },
        });

        if (!req.ok) {
            throw new Error("InvalidToken");
        }

        const body = (await req.json()) as { id: string; };
        discordClientId = body.id;
    } catch {
        return console.error(
            "Failed to get Discord client ID, maybe you put the wrong token?",
        );
    }

    const supabaseUrl = await password({
        message: "Supabase URL",
        mask: "•",
        clearOnError: true,
        validate: (value: string | undefined) => {
            if (!value) return "Enter a Supabase URL";
        },
    });

    note(
        "Please use a Supabase secret key, not a service role, anon (legacy) or a publishable one.",
    );

    const supabaseKey = await password({
        message: "Supabase *secret* key",
        mask: "•",
        clearOnError: true,
        validate: (value: string | undefined) => {
            if (!value) return "Enter a Supabase key";
            if (!value.startsWith("sb_secret_"))
                return "This is not a Supabase secret key!";
        },
    });

    const res = await fetch(`${String(supabaseUrl)}/auth/v1/admin/users`, {
        headers: {
            apikey: String(supabaseKey),
            Authorization: `Bearer ${String(supabaseKey)}`,
        },
    });

    if (!res.ok) {
        cancel("Invalid Supabase key");
        process.exit(1);
    }

    const sessionSecret = crypto.randomBytes(32).toHex();

    await note("The callback URL's format is: {nuit-server-base-url}/auth/discord/callback");

    const callbackUrl = await text({
        message: "Discord Callback URL"
    });

    const dotEnv = cleanMultiline(`# Discord credentials
    DISCORD_TOKEN=${String(discordToken)}
    DISCORD_CLIENT_ID=${String(discordClientId)}
    SESSION_SECRET=${sessionSecret}
    DISCORD_CALLBACK_URL=${String(callbackUrl)}
    # Supabase credentials
    SUPABASE_URL=${String(supabaseUrl)}
    SUPABASE_KEY=${String(supabaseKey)}`);

    await writeFile(path.join(folder, ".env"), dotEnv, { encoding: "utf-8" });

    await outro(
        cleanMultiline(`Done hatching! Start your Nuit instance with
        ${fromInit == true ? `cd ${folder.replaceAll("\\", "/").split("/").pop()}` : ""}
        bun ci
        bun run dev --register`),
    );
}
