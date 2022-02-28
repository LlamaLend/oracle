import ddb from './dynamodb'
import fetch from "node-fetch"

const handler = async (_event: any) => {
  const stats = await fetch("https://api.opensea.io/api/v1/collection/tubby-cats/stats?format=json").then(r=>r.json())
  const now = Date.now()
  const address = "0xca7ca7bcc765f77339be2d648ba53ce9c8a262bd".toLowerCase()
  await ddb.put({
    PK: `floor#${address}`,
    SK: now,
    floor: stats.stats.floor_price,
  })
};

export default handler;
