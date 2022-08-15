import ddb from './dynamodb'
import {getFloorNow} from './utils'

const handler = async (_event: any) => {
  const floor = await getFloorNow()
  const now = Date.now()
  const address = "0xca7ca7bcc765f77339be2d648ba53ce9c8a262bd".toLowerCase()
  await ddb.put({
    PK: `floor#${address}`,
    SK: now,
    floor,
  })
};

export default handler;
