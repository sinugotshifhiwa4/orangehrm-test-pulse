/* ══════════════════════════════════════════
   Mock dataset — used as a fallback when the live
   fetch fails (e.g. CORS) so the dashboard still renders.
   ══════════════════════════════════════════ */
import type { RawData, RawRun } from '../types';

export const MOCK_DATA: RawData = (() => {
  const types = ['authenticate', 'regression', 'smoke', 'e2e', 'sanity', 'skip-auth', 'dashboard'];
  const branches = ['main', 'develop', 'release/2.1', 'environment/QA', '4/merge'];
  const envs = ['staging', 'production', 'qa', 'uat'];
  const roles = ['admin-user', 'general-user', 'unknown'];
  const failNames = [
    'Invalid Login Test Suite › should display invalid credentials error when submitting login form with incorrect username and password',
    'should display invalid credentials error when submitting login form with incorrect username and password',
    'PIM › add employee validates required fields',
    'Leave › submit leave request without dates',
    'Admin › change password enforces complexity',
  ];
  const byBranch: Record<string, { byTestType: Record<string, { runs: RawRun[] }> }> = {};
  let rn = 1;
  branches.forEach(branch => {
    byBranch[branch] = { byTestType: {} };
    types.slice(0, 4).forEach(type => {
      const runs: RawRun[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.now() - (i * 2 + Math.random()) * 86400000);
        const total = Math.floor(Math.random() * 60) + 40;
        const failed = Math.random() > .72 ? Math.floor(Math.random() * 4) + 1 : 0;
        const skipped = Math.floor(Math.random() * 2);
        const flaky = Math.random() > .7 ? Math.floor(Math.random() * 2) + 1 : 0;
        const passed = total - failed - skipped;
        const passRate = Math.round((passed / total) * 100);
        const failedTests: RawRun['failedTests'] = [];
        for (let f = 0; f < failed; f++) {
          failedTests.push({
            name: failNames[f % failNames.length],
            classname: `layers/ui/login/InvalidLogin.spec.ts`,
            failureMessage: `expect(locator).toBeVisible() failed`,
          });
        }
        runs.push({
          runNumber: rn++, date: date.toISOString(), branch,
          env: envs[Math.floor(Math.random() * envs.length)],
          userRole: roles[Math.floor(Math.random() * roles.length)],
          passed, failed, skipped, flaky, total, passRate,
          durationMin: +(Math.random() * 6 + 1).toFixed(2),
          reportUrl: failed > 0 ? 'https://example.com/report' : null,
          allureUrl: 'https://example.com/allure',
          failedTests,
        });
      }
      byBranch[branch].byTestType[type] = { runs };
    });
  });
  return { byBranch };
})();
