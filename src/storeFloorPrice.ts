import ddb from './dynamodb'
import {getFloorNow, tubbyAddress} from './utils'

const handler = async (_event: any) => {
  const floor = await getFloorNow()
  const now = Date.now()
  await ddb.put({
    PK: `floor#${tubbyAddress}`,
    SK: now,
    floor,
  })
};

export default handler;
