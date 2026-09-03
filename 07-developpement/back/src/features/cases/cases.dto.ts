/** DTO de dossiers — source unique = le contrat partagé (@capclair/contract). */
export {
  ConfirmAiConsentInputSchema,
  CaseFileStatusResponseSchema,
  CaseFileResultResponseSchema,
  StartAnalysisResponseSchema,
  AnalysisStatusSchema,
  UpdateExtractedInfoInputSchema,
  UpdateMainDeadlineInputSchema,
  UpdateCaseScalarsInputSchema,
  RESULT_WARNING_BANNER,
  LOCKABLE_FIELDS,
  ANALYSIS_MESSAGES,
  CASE_FILE_PATHS,
} from "@capclair/contract";

export type {
  ConfirmAiConsentInput,
  CaseFileStatusResponse,
  CaseFileResultResponse,
  StartAnalysisResponse,
  UpdateExtractedInfoInput,
  UpdateMainDeadlineInput,
  UpdateCaseScalarsInput,
  LockableField,
} from "@capclair/contract";
