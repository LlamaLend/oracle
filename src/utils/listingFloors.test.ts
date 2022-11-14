import { getCurrentAndHistoricalFloor } from "./listingFloors"

require("dotenv").config()
getCurrentAndHistoricalFloor("0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258", process.env.NFTGO_API_KEY!, process.env.RESERVOIR_API_KEY!).then(console.log)

