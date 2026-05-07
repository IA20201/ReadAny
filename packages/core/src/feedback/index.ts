export type {
  DeviceInfo,
  FeedbackRecord,
  FeedbackStatusItem,
  FeedbackSubmission,
  FeedbackSubmitResult,
  FeedbackType,
} from "./feedback-types";

export {
  appendLog,
  clearLogs,
  collectDeviceInfo,
  collectLogs,
  getFeedbackHistory,
  getRemainingSubmissions,
  refreshFeedbackStatus,
  setFeedbackWorkerUrl,
  submitFeedback,
} from "./feedback-service";
