import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js'
import { placesAutocompletePerUser, placesDetailsPerUser } from '../../middleware/rateLimit.js'
import * as schemas from './places.schemas.js'
import * as places from './places.service.js'

/* §5: any signed-in user (recruiters once the email code is done); answers in the user's UI language. */
const router = Router()

router.use(requireAuth, requireVerifiedEmail)

router.get('/autocomplete', placesAutocompletePerUser, validate({ query: schemas.autocompleteQuery }), async (req, res) => {
  res.json({ items: await places.autocomplete({ ...req.query, language: req.user.language }) })
})

router.get('/:placeId', placesDetailsPerUser, validate({ params: schemas.detailsParams, query: schemas.detailsQuery }), async (req, res) => {
  res.json(await places.placeDetails({ ...req.params, ...req.query, language: req.user.language }))
})

export default router
