// export default function handler(req, res) {
//   res.status(200).json({
//     mode: 'live',
//     providers: {
//       openai: { available: !!process.env.OPENAI_API_KEY },
//       claude: { available: !!process.env.ANTHROPIC_API_KEY },
//       gemini: { available: !!process.env.GEMINI_API_KEY },
//     },
//   });
// }

import { getProviderAvailability } from '../server/core.js';

export default function handler(req, res) {
  return res.status(200).json({
    mode: 'live',
    providers: getProviderAvailability(),
  });
}
