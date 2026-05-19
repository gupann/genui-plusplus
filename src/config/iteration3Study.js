import { getPilotStudyCase, PILOT_STUDY_CASES } from './pilotStudyCases';

export const ITERATION_3_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', fileName: 'openai_generated_output.html' },
  { id: 'gemini', label: 'Gemini', fileName: 'gemini_generated_output.html' },
  { id: 'claude', label: 'Claude', fileName: 'claude_generated_output.html' },
];

const ITERATION_3_MODEL_SLOTS = [
  { id: 'modelA', label: 'Model A' },
  { id: 'modelB', label: 'Model B' },
  { id: 'modelC', label: 'Model C' },
];

const SLOT_PERMUTATIONS = [
  ['openai', 'gemini', 'claude'],
  ['openai', 'claude', 'gemini'],
  ['gemini', 'openai', 'claude'],
  ['gemini', 'claude', 'openai'],
  ['claude', 'openai', 'gemini'],
  ['claude', 'gemini', 'openai'],
];

export const ITERATION_3_CRITERIA = [
  { id: 'requirementFulfillment', label: 'Requirement Fulfillment' },
  { id: 'consistencyOriginal', label: 'Consistency with Original UI' },
  { id: 'visualUsability', label: 'Visual & Usability Quality' },
  { id: 'minimality', label: 'Minimality of Changes' },
  { id: 'noRegressions', label: 'No New Regressions' },
];

export const ITERATION_3_RATING_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'partial', label: 'Partial' },
  { value: 'fail', label: 'Fail' },
];

function getIteration3BasePath(caseStudyId) {
  const caseStudy = getPilotStudyCase(caseStudyId);
  if (!caseStudy) {
    return `/iteration-3-screens/unknown/${caseStudyId}`;
  }

  const folderName = encodeURIComponent(caseStudy.assetFolder);
  return `/iteration-3-screens/${folderName}/${caseStudy.screenId}`;
}

export function getIteration3PromptUrl(caseStudyId) {
  return `${getIteration3BasePath(caseStudyId)}/revision_prompt.txt`;
}

export function getIteration3ModelHtmlUrl(caseStudyId, modelFileName) {
  return `${getIteration3BasePath(caseStudyId)}/${modelFileName}`;
}

function getCasePermutation(caseStudyId) {
  const normalizedId = Number(caseStudyId) || 1;
  return SLOT_PERMUTATIONS[(normalizedId - 1) % SLOT_PERMUTATIONS.length];
}

export function getIteration3CaseManifest(caseStudyId) {
  const normalizedId = Number(caseStudyId);
  const caseStudy = getPilotStudyCase(normalizedId);
  const basePath = getIteration3BasePath(normalizedId);
  const providerOrder = getCasePermutation(normalizedId);
  const providersById = Object.fromEntries(
    ITERATION_3_PROVIDERS.map((provider) => [provider.id, provider]),
  );

  return {
    caseStudyId: normalizedId,
    screenId: caseStudy?.screenId || normalizedId,
    assetFolder: caseStudy?.assetFolder || '',
    basePath,
    promptUrl: getIteration3PromptUrl(normalizedId),
    originalHtmlUrl: `${basePath}/${caseStudy?.screenId || normalizedId}.html`,
    originalImageUrl: `${basePath}/${caseStudy?.screenId || normalizedId}.png`,
    models: ITERATION_3_MODEL_SLOTS.map((slot, index) => {
      const providerId = providerOrder[index];
      const provider = providersById[providerId];
      return {
        ...slot,
        providerId,
        providerLabel: provider.label,
        fileName: provider.fileName,
        htmlUrl: getIteration3ModelHtmlUrl(normalizedId, provider.fileName),
      };
    }),
  };
}

export const ITERATION_3_CASES = PILOT_STUDY_CASES.map((caseStudy) => ({
  ...caseStudy,
  ...getIteration3CaseManifest(caseStudy.caseStudyId),
}));
