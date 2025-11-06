import { WebsiteAnnotation } from "@annotation";

export type WebsiteGraphState = typeof WebsiteAnnotation.State;

// export interface WebsiteBuilderGraphState extends CoreGraphState {
//     task?: CodeTaskType;
//     queue?: CodeTaskType[];
//     completedTasks?: CodeTaskType[];
//     componentOverviews?: ComponentOverviewType[];
//     taskHistory?: TaskHistoryType[];
//     project?: ProjectType;
//     pages?: PageType[];
//     website?: WebsiteType;
//     files?: FileMap;
// }