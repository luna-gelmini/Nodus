
const { createServicesStatusImage } = require("../utils/imageGenerator");

function parseCsStatus(rawDataString) {
    try {
        if (!rawDataString) return null;
        if (typeof rawDataString !== "string") {
            console.warn(
                "[ParseCSStatus] Received non-string data:",
                typeof rawDataString,
            );

            if (typeof rawDataString === "object")
                rawDataString = JSON.stringify(rawDataString);
            else return null;
        }
        return JSON.parse(rawDataString);
    } catch (e) {
        console.error("[ParseCSStatus] Failed to parse CS status JSON:", e);
        return null;
    }
}

module.exports = {
    name: "status",
    aliases: ["s"],
    description: "Status do Counter-Strike 2",

    subcommands: {
        services: {
            aliases: ["s", "svc"],
            devOnly: false,
            description: "Status dos serviços principais do CS.",
            execute: async (client, message, args) => {
                const rawData = client.statusDataMap.get("counterStrike");
                const statusData = parseCsStatus(rawData);

                if (rawData === undefined || rawData === null) {
                    return message
                        .reply(
                            "Ainda não foi possível obter dados da API de status. Verificando novamente em breve.",
                        )
                        .catch(console.error);
                }

                try {
                    await message.channel.sendTyping().catch(console.warn);
                    const imageBuffer =
                        await createServicesStatusImage(statusData);
                    if (!imageBuffer || imageBuffer.length === 0) {
                        return message
                            .reply({
                                content: "Falha ao gerar imagem de status.",
                            })
                            .catch(console.error);
                    }
                    const imageName = `cs_services_status_${Date.now()}.png`;

                    await message.reply({
                        content: `*${new Date().toLocaleString("pt-BR")}*`,
                        files: [{ attachment: imageBuffer, name: imageName }],
                    });
                } catch (error) {
                    console.error(
                        "Error processing or generating services status image:",
                        error,
                    );
                    await message
                        .reply({
                            content:
                                "Ocorreu um erro ao gerar a imagem de status.",
                        })
                        .catch(console.error);
                }
            },
        },
    },
};
