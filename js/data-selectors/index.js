/**
 * Custom data selectors. The page loads this module the first time the dialog opens.
 */
import { bind } from "./dialog.js";

const timelineUpload = bind();
window.TimelineUpload = timelineUpload;

export { timelineUpload };
