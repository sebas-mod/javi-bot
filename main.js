/* global conn */
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
import "./config.js";
import "./global.js";
import { naruyaizumi, protoType, serialize } from "./lib/simple.js";
import { schedule } from "./lib/cron.js";
import {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    useMultiFileAuthState,
} from "baileys";
import { EventEmitter } from "events";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import P from "pino";
import { initReload, initCron, connectionUpdateHandler } from "./lib/connection.js";

EventEmitter.defaultMaxListeners = 0;

const pairingAuth = global.config.pairingAuth;
const pairingNumber = global.config.pairingNumber;

protoType();
serialize();

async function IZUMI() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");
    const { version: baileysVersion } = await fetchLatestBaileysVersion();
    console.log(
        chalk.cyan.bold(`
╭────────────────────────────────────╮
│ 📡  Inicialización de Baileys 📡
│ ─────────────────────────────────
│ 📡  Versión de Baileys : v${baileysVersion.join(".")}
│ 📅  Fecha : ${new Date().toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
│ 🌐  Sistema : ${process.platform} CPU: ${process.arch}
╰────────────────────────────────────╯
`)
    );
    const connectionOptions = {
        version: baileysVersion,
        logger: P({ level: "silent" }),
        printQRInTerminal: !pairingAuth,
        browser: Browsers.ubuntu("Safari"),
        emitOwnEvents: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(
                state.keys,
                P().child({ level: "silent", stream: "store" })
            ),
        },
    };
    global.conn = naruyaizumi(connectionOptions);
    conn.isInit = false;
    if (pairingAuth && !conn.authState.creds.registered) {
        setTimeout(async () => {
            let code = await conn.requestPairingCode(pairingNumber, conn.Pairing);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(
                chalk.cyan.bold(`
╭────────────────────────────────────╮
│ 🎉  ¡Código de Emparejamiento Listo!  🎉
│ ─────────────────────────────────
│ 📲  Tu Número      : ${chalk.white.bold(pairingNumber)}
│ 📄  Código         : ${chalk.white.bold(code)}
│ 🕒  Generado En    : ${chalk.white.bold(new Date().toLocaleString("es-ES"))}
╰────────────────────────────────────╯
`)
            );
        }, 3000);
    }

    schedule(
        "autosave",
        async () => {
            if (global.db?.data) {
                try {
                    global.db.write();
                } catch (e) {
                    console.error("DB autosave gagal:", e);
                }
            }
        },
        { intervalSeconds: 5 }
    );

    let isInit = true;
    let handler = await import("./handler.js");
    global.reloadHandler = async function (restartConn) {
        try {
            const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
            if (Object.keys(Handler || {}).length) handler = Handler;
        } catch (e) {
            console.error(e);
        }
        if (restartConn) {
            const oldChats = global.conn.chats;
            try {
                global.conn.ws.close();
            } catch {
                // ignore
            }
            conn.ev.removeAllListeners();
            global.conn = naruyaizumi(connectionOptions, { chats: oldChats });
            isInit = true;
        }
        if (!isInit) {
            conn.ev.off("messages.upsert", conn.handler);
            conn.ev.off("group-participants.update", conn.participantsUpdate);
            conn.ev.off("message.delete", conn.onDelete);
            conn.ev.off("connection.update", conn.connectionUpdate);
            conn.ev.off("creds.update", conn.credsUpdate);
        }
        conn.spromote = "@user ahora es admin!";
conn.sdemote = "@user ya no es admin!";
conn.welcome = "¡Hola @user! Bienvenido/a a @subject\n\n@desc";
conn.bye = "¡Adiós @user!";
conn.sRevoke = "El enlace del grupo ha sido cambiado a:\n@revoke";
        conn.handler = handler.handler.bind(global.conn);
        conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
        conn.onDelete = handler.deleteUpdate.bind(global.conn);
        conn.connectionUpdate = connectionUpdateHandler.bind(global.conn);
        conn.credsUpdate = saveCreds.bind(global.conn);
        conn.ev.on("messages.upsert", conn.handler);
        conn.ev.on("group-participants.update", conn.participantsUpdate);
        conn.ev.on("message.delete", conn.onDelete);
        conn.ev.on("connection.update", conn.connectionUpdate);
        conn.ev.on("creds.update", conn.credsUpdate);
        isInit = false;
        return true;
    };
    const pluginFolder = global.__dirname(
        join(global.__dirname(import.meta.url), "./plugins/index")
    );

    function getAllPlugins(dir) {
        let results = [];
        for (let file of readdirSync(dir)) {
            let filepath = join(dir, file);
            let stat = statSync(filepath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getAllPlugins(filepath));
            } else if (/\.js$/.test(file)) {
                results.push(filepath);
            }
        }
        return results;
    }

    await initReload(conn, pluginFolder, getAllPlugins);
    initCron();
    await global.reloadHandler();
}

IZUMI();
