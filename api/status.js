import { getProviderAvailability } from '../server/core.js';

export default function handler(req, res) {
  return res.status(200).json({
    mode: 'live',
    providers: getProviderAvailability(),
  });
}
