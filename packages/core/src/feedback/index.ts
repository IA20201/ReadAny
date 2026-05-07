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
  appendStructuredLog,
  clearLogs,
  collectDeviceInfo,
  collectLogs,
  getFeedbackHistory,
  getRemainingSubmissions,
  installFeedbackLogCapture,
  markFeedbackReplySeen,
  refreshFeedbackStatus,
  setFeedbackWorkerUrl,
  submitFeedback,
} from "./feedback-service";
