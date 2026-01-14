import { TrackingHelper } from "./fixtures/tracking";

/**
 * Playwright global setup - runs before all tests start.
 * Builds the tracking-test website using the real Buildable pipeline.
 *
 * This is a convenience to ensure the build exists before any tests run.
 * Individual test suites can also call TrackingHelper.ensureBuildExists()
 * in a beforeAll hook if they need to ensure fresh build state.
 */
async function globalSetup() {
}

export default globalSetup;
