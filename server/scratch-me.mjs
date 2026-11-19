import mongoose from 'mongoose'
import { User } from './modules/users/users.model.js'
import { meDto } from './modules/users/users.service.js'
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
const u = await User.findOne({ email: /^t[^@]*@gmail\.com$/i })
console.log('homeCountry before', u.homeCountry, 'picker', u.pickerCountry)
try { const d = await meDto(u); console.log('meDto OK, keys:', Object.keys(d).length) } catch (e) { console.log('meDto THROWS:', e.stack) }
await mongoose.disconnect()
process.exit(0)
