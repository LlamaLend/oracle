import { getCurrentAndHistoricalFloor } from "./listingFloors"

require("dotenv").config()
getCurrentAndHistoricalFloor("0x9e629d779be89783263d4c4a765c38eb3f18671c", process.env.RESERVOIR_API_KEY!).then(console.log)

