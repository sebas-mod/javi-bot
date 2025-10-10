let handler = async (m, { conn, args }) => {
    let usersPremium = Object.entries(global.db.data.users)
        .filter(([_, v]) => new Date() - v.premiumTime < 0)
        .map(([jid, v]) => ({ ...v, jid }));

    if (!usersPremium.length) return m.reply("🍩 *No hay usuarios premium activos.*");

    let sorted = usersPremium.map(toNumber("premiumTime")).sort(sort("premiumTime"));
    let len =
        args[0] && args[0].length > 0
            ? Math.min(100, Math.max(parseInt(args[0]), 10))
            : Math.min(10, sorted.length);

    let caption = `🍰 *Lista de Usuarios Premium*\n\n`;
    caption += sorted
        .slice(0, len)
        .map(({ jid, premiumTime }, i) => {
            let restante = premiumTime > 0 ? clockString(premiumTime - new Date() * 1) : "Expirado 🚫";
            return `${i + 1}. @${jid.split("@")[0]}\n   ⏱️ ${restante}`;
        })
        .join("\n\n");

    await conn.reply(m.chat, caption, m, { mentions: sorted.map((v) => v.jid) });
};

handler.help = ["premlist"];
handler.tags = ["info"];
handler.command = /^(listprem|premlist)$/i;
handler.owner = true;

export default handler;

function clockString(ms) {
    let d = isNaN(ms) ? "--" : Math.floor(ms / 86400000);
    let h = isNaN(ms) ? "--" : Math.floor(ms / 3600000) % 24;
    let m = isNaN(ms) ? "--" : Math.floor(ms / 60000) % 60;
    let s = isNaN(ms) ? "--" : Math.floor(ms / 1000) % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
}

function sort(property, ascending = true) {
    if (property)
        return (...args) => args[ascending & 1][property] - args[!ascending & 1][property];
    else return (...args) => args[ascending & 1] - args[!ascending & 1];
}

function toNumber(property, _default = 0) {
    if (property)
        return (a, i, b) => ({
            ...b[i],
            [property]: a[property] === undefined ? _default : a[property],
        });
    else return (a) => (a === undefined ? _default : a);
}