import { fetchIpfsUrl } from "./utils";
import sharp from "sharp";
import { join } from "path";
const overlayImage = require("./overlays/tubby.png");

const handler = async (
    event: AWSLambda.APIGatewayEvent
): Promise<any> => {
    const imageUrl = event.pathParameters!.imageUrl!;
    const realUrl = new Buffer(imageUrl, 'base64').toString()
    const imageData = await fetchIpfsUrl(realUrl).then(r => r.arrayBuffer())
    const { data: overlay } = await sharp(join(__dirname, '..', overlayImage))
        .resize({
            fit: sharp.fit.contain,
            height: 2000,
            width: 2000
        })
        .toBuffer({ resolveWithObject: true })
    const composed = await sharp(Buffer.from(imageData))
        .resize(2000, 2000)
        .composite([{
            input: overlay
        }])
        .toBuffer()
    return {
        statusCode: 200,
        body: composed.toString("base64"),
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": `max-age=${24*3600}`, // 24 h
        },
        isBase64Encoded: true
    }
}
/*
handler({
    pathParameters: {
        imageUrl: "aXBmczovL1FtWEFZbTJwWjdvbkdtcENqa0NxS0ZMRDRkMXFhVGRKY0txQk1UckQ2M0V3MTEvNTQ5MS5wbmc="
    }
} as any)
*/

export default handler