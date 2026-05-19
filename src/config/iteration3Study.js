import { PILOT_STUDY_CASES } from './pilotStudyCases';

export const ITERATION_3_MODELS = [
  { id: 'modelA', label: 'Model A', fileName: 'model-a.html' },
  { id: 'modelB', label: 'Model B', fileName: 'model-b.html' },
  { id: 'modelC', label: 'Model C', fileName: 'model-c.html' },
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

export function getIteration3PromptUrl(caseStudyId) {
  return `/iteration3/case-study-${caseStudyId}/prompt.txt`;
}

export function getIteration3ModelHtmlUrl(caseStudyId, modelFileName) {
  return `/iteration3/case-study-${caseStudyId}/${modelFileName}`;
}

export function getIteration3CaseManifest(caseStudyId) {
  const normalizedId = Number(caseStudyId);
  const basePath = `/iteration3/case-study-${normalizedId}`;

  return {
    caseStudyId: normalizedId,
    basePath,
    promptUrl: getIteration3PromptUrl(normalizedId),
    models: ITERATION_3_MODELS.map((model) => ({
      ...model,
      htmlUrl: getIteration3ModelHtmlUrl(normalizedId, model.fileName),
    })),
  };
}

export const ITERATION_3_CASES = PILOT_STUDY_CASES.map((caseStudy) => ({
  ...caseStudy,
  ...getIteration3CaseManifest(caseStudy.caseStudyId),
}));
