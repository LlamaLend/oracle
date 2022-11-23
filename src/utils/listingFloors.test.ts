import { getCurrentAndHistoricalFloor } from "./listingFloors"

require("dotenv").config()
getCurrentAndHistoricalFloor("0x2c889A24AF0d0eC6337DB8fEB589fa6368491146", process.env.RESERVOIR_API_KEY!).then(console.log)

